package clickhouse

import (
	"context"
	"datacia/pkg/common"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
)

type ClickHouseClient interface {
	Connect(host, port, username, password, database string, test bool) error
	Close() error
	Ping() error
	RunQuery(queryId, queryType, sql string) (common.QueryResult, error)
	CancelQuery(queryId string) error
	ListTables() ([]string, error)
	ListDatabases() (common.DatabaseInfo, error)
	GetConnectionInfo() (map[string]string, error)
}

var _ ClickHouseClient = (*ClickHouse)(nil)

type ClickHouse struct {
	conn driver.Conn
	*common.ConnectionState
}

func New() *ClickHouse {
	return &ClickHouse{
		ConnectionState: &common.ConnectionState{},
	}
}

func (ch *ClickHouse) Connect(host, port, username, password, database string, test bool) error {
	connection, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%s", host, port)},
		Auth: clickhouse.Auth{
			Database: database,
			Username: username,
			Password: password,
		},
		Settings: clickhouse.Settings{
			"max_execution_time": 300,
		},
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		},
		DialTimeout:     10 * time.Second,
		MaxOpenConns:    10,
		MaxIdleConns:    5,
		ConnMaxLifetime: 0,
	})
	if err != nil {
		return err
	}

	ctx, cancel := common.NewTimeoutContext(2 * time.Second)
	defer cancel()
	if err := connection.Ping(ctx); err != nil {
		return err
	}

	if !test {
		ch.Mu.Lock()
		if ch.conn != nil {
			_ = ch.conn.Close()
		}
		ch.conn = connection
		ch.Host = host
		ch.Port = port
		ch.Username = username
		ch.Password = password
		ch.Database = database
		ch.Mu.Unlock()
	} else {
		// if test=true → close right away (don't keep state)
		_ = connection.Close()
	}

	return nil
}

func (ch *ClickHouse) Close() error {
	ch.ActiveQueries = sync.Map{}

	ch.Mu.Lock()
	defer ch.Mu.Unlock()

	if ch.conn == nil {
		return nil
	}

	err := ch.conn.Close()
	if err != nil {
		return err
	}
	ch.conn = nil
	return nil
}

func (ch *ClickHouse) Ping() error {
	ch.Mu.RLock()
	conn := ch.conn
	ch.Mu.RUnlock()

	if conn == nil {
		return errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	return conn.Ping(ctx)
}

func (ch *ClickHouse) RunQuery(queryID, queryType, sql string) (common.QueryResult, error) {
	if queryID == "" {
		queryID = uuid.NewString()
	}

	// Grab connection under read lock
	ch.Mu.RLock()
	conn := ch.conn
	ch.Mu.RUnlock()

	if conn == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	if _, exists := ch.ActiveQueries.Load(queryID); exists {
		return common.QueryResult{}, fmt.Errorf("query with ID %s is already running", queryID)
	}

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	ch.ActiveQueries.Store(queryID, cancel)
	defer func() {
		cancel()
		ch.ActiveQueries.Delete(queryID)
	}()

	switch common.QueryType(queryType) {
	case common.QueryTypeCommand:
		return ch.execute(ctx, conn, sql, queryID)
	case common.QueryTypeRead:
		return ch.query(ctx, conn, sql, queryID)
	default:
		return common.QueryResult{Type: common.QueryTypeUnknown}, fmt.Errorf("unsupported query type: %s", queryType)
	}
}

func (ch *ClickHouse) execute(ctx context.Context, conn driver.Conn, sql string, queryID string) (common.QueryResult, error) {
	var queryCtx context.Context
	if queryID != "" {
		queryCtx = clickhouse.Context(ctx, clickhouse.WithQueryID(queryID))
	} else {
		queryCtx = ctx
	}

	err := conn.Exec(queryCtx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeCommand}, err
	}
	return common.QueryResult{Type: common.QueryTypeCommand}, nil
}

func (ch *ClickHouse) query(ctx context.Context, conn driver.Conn, sql string, queryID string) (common.QueryResult, error) {
	var queryCtx context.Context
	if queryID != "" {
		queryCtx = clickhouse.Context(ctx, clickhouse.WithQueryID(queryID))
	} else {
		queryCtx = ctx
	}

	rows, err := conn.Query(queryCtx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()

	columns, data, err := ScanDynamicColumns(queryCtx, rows)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	return common.QueryResult{Type: common.QueryTypeRead, Columns: columns, Data: data}, nil
}

func (ch *ClickHouse) CancelQuery(queryID string) error {
	if queryID == "" {
		return errors.New("queryID cannot be empty")
	}

	// First try context cancellation
	if val, exists := ch.ActiveQueries.LoadAndDelete(queryID); exists {
		if cancelFunc, ok := val.(context.CancelFunc); ok {
			cancelFunc()
		}
	}

	// Also try server-side kill as backup
	return ch.killQueryOnServer(queryID)
}

func (ch *ClickHouse) killQueryOnServer(queryID string) error {
	ch.Mu.RLock()
	conn := ch.conn
	ch.Mu.RUnlock()

	if conn == nil {
		return errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(3 * time.Second)
	defer cancel()

	killSQL := fmt.Sprintf("KILL QUERY WHERE query_id = '%s'", queryID)
	// Ignore errors from KILL QUERY as it might already be completed
	conn.Exec(ctx, killSQL)
	return nil
}

func (ch *ClickHouse) ListTables() ([]string, error) {
	ch.Mu.RLock()
	conn := ch.conn
	ch.Mu.RUnlock()

	if conn == nil {
		return nil, errors.New("no active connection found")
	}

	const sql = `
		SELECT name
		FROM system.tables
		WHERE database = {db:String}
		ORDER BY name
	`

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	rows, err := conn.Query(ctx, sql, clickhouse.Named("db", ch.Database))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tables, nil
}

func (ch *ClickHouse) ListDatabases() (common.DatabaseInfo, error) {
	ch.Mu.RLock()
	conn := ch.conn
	currentDB := ch.Database
	ch.Mu.RUnlock()

	if conn == nil {
		return common.DatabaseInfo{}, errors.New("no active connection found")
	}

	const sql = `
		SELECT name
		FROM system.databases
		ORDER BY name
	`

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	rows, err := conn.Query(ctx, sql)
	if err != nil {
		return common.DatabaseInfo{}, err
	}
	defer rows.Close()

	var databases []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return common.DatabaseInfo{}, err
		}
		databases = append(databases, name)
	}

	if err := rows.Err(); err != nil {
		return common.DatabaseInfo{}, err
	}

	return common.DatabaseInfo{
		Databases:       databases,
		CurrentDatabase: currentDB,
	}, nil
}

func (ch *ClickHouse) GetConnectionInfo() (map[string]string, error) {
	ch.Mu.RLock()
	defer ch.Mu.RUnlock()

	if ch.conn == nil {
		return nil, errors.New("no active connection found")
	}

	return map[string]string{
		"engine":   "clickhouse",
		"host":     ch.Host,
		"port":     ch.Port,
		"username": ch.Username,
		"password": ch.Password,
		"database": ch.Database,
	}, nil
}

func (ch *ClickHouse) GetTableData(table string, limit, offset int) (common.QueryResult, error) {
	ch.Mu.RLock()
	conn := ch.conn
	ch.Mu.RUnlock()

	if conn == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	defer cancel()

	// Use backticks for table name escaping in ClickHouse
	sql := fmt.Sprintf("SELECT * FROM `%s` LIMIT %d OFFSET %d", table, limit, offset)
	return ch.query(ctx, conn, sql, "")
}

func (ch *ClickHouse) GetTableSchema(table string) (common.QueryResult, error) {
	ch.Mu.RLock()
	conn := ch.conn
	currentDB := ch.Database
	ch.Mu.RUnlock()

	if conn == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	// Query system.columns for table schema
	sql := `
		SELECT 
			*
		FROM system.columns
		WHERE database = {db:String} AND table = {table:String}
		ORDER BY position
	`

	rows, err := conn.Query(ctx, sql, clickhouse.Named("db", currentDB), clickhouse.Named("table", table))
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()

	columns, data, err := ScanDynamicColumns(ctx, rows)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	return common.QueryResult{
		Type:    common.QueryTypeRead,
		Columns: columns,
		Data:    data,
	}, nil
}

// func (ch *ClickHouse) SaveConnection(name string, config map[string]string) error {
// 	return ch.engine.SaveConnection(name, config)
// }

// func (ch *ClickHouse) ListConnections() []string {
// 	connections, err := ch.engine.ListConnections()
// 	if err != nil {
// 		return []string{}
// 	}
// 	return connections
// }
