package clickhouse

import (
	"context"
	"errors"
	"fmt"
	"layerbits/pkg/common"
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
	conn          driver.Conn
	host          string
	port          string
	username      string
	password      string
	database      string
	activeQueries sync.Map
	mu            sync.RWMutex
}

func New() *ClickHouse {
	return &ClickHouse{}
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

	ctx, cancel := NewTimeoutContext(2 * time.Second)
	defer cancel()
	if err := connection.Ping(ctx); err != nil {
		return err
	}

	if !test {
		ch.mu.Lock()
		if ch.conn != nil {
			_ = ch.conn.Close()
		}
		ch.conn = connection
		ch.host = host
		ch.port = port
		ch.username = username
		ch.password = password
		ch.database = database
		ch.mu.Unlock()
	} else {
		// if test=true → close right away (don't keep state)
		_ = connection.Close()
	}

	return nil
}

func (ch *ClickHouse) Close() error {
	ch.activeQueries = sync.Map{}

	ch.mu.Lock()
	defer ch.mu.Unlock()

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
	ch.mu.RLock()
	conn := ch.conn
	ch.mu.RUnlock()

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
	ch.mu.RLock()
	conn := ch.conn
	ch.mu.RUnlock()

	if conn == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	if _, exists := ch.activeQueries.Load(queryID); exists {
		return common.QueryResult{}, fmt.Errorf("query with ID %s is already running", queryID)
	}

	ctx, cancel := NewTimeoutContext(QUERY_TIMEOUT)
	ch.activeQueries.Store(queryID, cancel)
	defer func() {
		cancel()
		ch.activeQueries.Delete(queryID)
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
	if val, exists := ch.activeQueries.LoadAndDelete(queryID); exists {
		if cancelFunc, ok := val.(context.CancelFunc); ok {
			cancelFunc()
		}
	}

	// Also try server-side kill as backup
	return ch.killQueryOnServer(queryID)
}

func (ch *ClickHouse) killQueryOnServer(queryID string) error {
	ch.mu.RLock()
	conn := ch.conn
	ch.mu.RUnlock()

	if conn == nil {
		return errors.New("no active connection found")
	}

	ctx, cancel := NewTimeoutContext(3 * time.Second)
	defer cancel()

	killSQL := fmt.Sprintf("KILL QUERY WHERE query_id = '%s'", queryID)
	// Ignore errors from KILL QUERY as it might already be completed
	conn.Exec(ctx, killSQL)
	return nil
}

func (ch *ClickHouse) ListTables() ([]string, error) {
	ch.mu.RLock()
	conn := ch.conn
	ch.mu.RUnlock()

	if conn == nil {
		return nil, errors.New("no active connection found")
	}

	const sql = `
		SELECT name
		FROM system.tables
		WHERE database = {db:String}
		ORDER BY name
	`

	ctx, cancel := NewTimeoutContext(META_TIMEOUT)
	defer cancel()

	rows, err := conn.Query(ctx, sql, clickhouse.Named("db", ch.database))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

func (ch *ClickHouse) ListDatabases() (common.DatabaseInfo, error) {
	ch.mu.RLock()
	conn := ch.conn
	currentDB := ch.database
	ch.mu.RUnlock()

	if conn == nil {
		return common.DatabaseInfo{}, errors.New("no active connection found")
	}

	const sql = `
		SELECT name
		FROM system.databases
		ORDER BY name
	`

	ctx, cancel := NewTimeoutContext(META_TIMEOUT)
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
	ch.mu.RLock()
	defer ch.mu.RUnlock()

	if ch.conn == nil {
		return nil, errors.New("no active connection found")
	}

	return map[string]string{
		"engine":   "clickhouse",
		"host":     ch.host,
		"port":     ch.port,
		"username": ch.username,
		"password": ch.password,
		"database": ch.database,
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
