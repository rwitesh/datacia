package clickhouse

import (
	"context"
	"datacia/pkg/common"
	"errors"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
)

type ClickHouse struct {
	conn driver.Conn
	*common.ConnectionState
}

func New() *ClickHouse {
	return &ClickHouse{
		ConnectionState: &common.ConnectionState{},
	}
}

func (ch *ClickHouse) Connect(host, port, username, password, database string) error {
	connection, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{net.JoinHostPort(host, port)},
		Auth: clickhouse.Auth{
			Database: database,
			Username: username,
			Password: password,
		},
		Settings: clickhouse.Settings{
			"max_execution_time": 300,
		},
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionZSTD,
		},
		DialTimeout:     common.CONNECT_TIMEOUT,
		MaxOpenConns:    10,
		MaxIdleConns:    5,
		ConnMaxLifetime: 0,
	})
	if err != nil {
		return err
	}

	ctx, cancel := common.NewTimeoutContext(common.CONNECT_TIMEOUT)
	defer cancel()
	if err := connection.Ping(ctx); err != nil {
		_ = connection.Close()
		return err
	}

	ch.Mu.Lock()
	ch.conn = connection
	ch.Host = host
	ch.Port = port
	ch.Username = username
	ch.Database = database
	ch.Password = common.NewSecureString(password)
	ch.Mu.Unlock()
	return nil
}

func (ch *ClickHouse) Close() error {
	ch.Mu.Lock()
	conn := ch.conn
	ch.conn = nil
	ch.ClearAllStateUnsafe() // Calling unsafe method since it is already in lock
	ch.Mu.Unlock()

	if conn == nil {
		return nil
	}
	ch.CancelAll()
	return conn.Close()
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

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	if _, exists := ch.ActiveQueries.LoadOrStore(queryID, cancel); exists {
		cancel()
		return common.QueryResult{}, fmt.Errorf("query with ID %s is already running", queryID)
	}
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
	err := conn.Exec(clickhouse.Context(ctx, clickhouse.WithQueryID(queryID)), sql)
	return common.QueryResult{Type: common.QueryTypeCommand}, err
}

type queryProgress struct {
	mu        sync.Mutex
	rowsRead  uint64
	bytesRead uint64
}

func (ch *ClickHouse) query(ctx context.Context, conn driver.Conn, sql string, queryID string) (common.QueryResult, error) {
	progress := &queryProgress{}
	progressCB := clickhouse.WithProgress(func(p *clickhouse.Progress) {
		progress.mu.Lock()
		progress.rowsRead += p.Rows
		progress.bytesRead += p.Bytes
		progress.mu.Unlock()
	})
	var queryCtx context.Context
	if queryID != "" {
		queryCtx = clickhouse.Context(ctx, progressCB, clickhouse.WithQueryID(queryID))
	} else {
		queryCtx = clickhouse.Context(ctx, progressCB)
	}

	rows, err := conn.Query(queryCtx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()

	columns, data, err := scanDynamicColumns(queryCtx, rows, 0)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	progress.mu.Lock()
	rowsRead := progress.rowsRead
	bytesRead := progress.bytesRead
	progress.mu.Unlock()

	rowsReturned := uint64(len(data))

	logs := common.QueryLogs{
		RowsReturned: &rowsReturned,
		RowsRead:     &rowsRead,
		BytesRead:    &bytesRead,
	}

	return common.QueryResult{
		Type:    common.QueryTypeRead,
		Columns: columns,
		Data:    data,
		Logs:    logs,
	}, nil
}

// ReadOnlyQuery runs sql with readonly=2, which blocks writes but still
// allows the connection's own settings (max_execution_time), and
// allow_ddl=0, which also disables table functions such as url() and s3().
func (ch *ClickHouse) ReadOnlyQuery(ctx context.Context, sql string, maxRows int) (common.QueryResult, error) {
	ch.Mu.RLock()
	conn := ch.conn
	ch.Mu.RUnlock()

	if conn == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(ctx, common.QUERY_TIMEOUT)
	defer cancel()

	queryCtx := clickhouse.Context(ctx, clickhouse.WithSettings(clickhouse.Settings{"readonly": 2, "allow_ddl": 0}))
	rows, err := conn.Query(queryCtx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()
	// Cancel before rows.Close so unread rows aren't drained.
	defer cancel()

	columns, data, err := scanDynamicColumns(queryCtx, rows, maxRows)
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
	// Validate queryID is a valid UUID to prevent SQL injection
	if err := common.ValidateUUID(queryID); err != nil {
		return fmt.Errorf("invalid query ID: %w", err)
	}

	ch.Mu.RLock()
	conn := ch.conn
	ch.Mu.RUnlock()

	if conn == nil {
		return errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(3 * time.Second)
	defer cancel()

	// queryID is validated as UUID format, safe to use in query
	killSQL := fmt.Sprintf("KILL QUERY WHERE query_id = '%s'", queryID)
	// Ignore errors from KILL QUERY as it might already be completed
	conn.Exec(ctx, killSQL)
	return nil
}

func (ch *ClickHouse) ListTables() ([]string, error) {
	ch.Mu.RLock()
	conn := ch.conn
	database := ch.Database
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

	rows, err := conn.Query(ctx, sql, clickhouse.Named("db", database))
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
		"password": "", // Password not exposed for security
		"database": ch.Database,
	}, nil
}

func (ch *ClickHouse) GetTableData(table string, limit, offset int, orderBy, orderDir string) (common.QueryResult, error) {
	ch.Mu.RLock()
	conn := ch.conn
	ch.Mu.RUnlock()

	if conn == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	defer cancel()

	sqlStr, err := common.TableDataSQL(table, orderBy, orderDir, limit, offset, common.QuoteBacktick)
	if err != nil {
		return common.QueryResult{}, err
	}
	return ch.query(ctx, conn, sqlStr, "")
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

	columns, data, err := scanDynamicColumns(ctx, rows, 0)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	return common.QueryResult{
		Type:    common.QueryTypeRead,
		Columns: columns,
		Data:    data,
	}, nil
}

func (ch *ClickHouse) GetDDL(table string) (string, error) {
	ch.Mu.RLock()
	conn := ch.conn
	currentDB := ch.Database
	ch.Mu.RUnlock()

	if conn == nil {
		return "", errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	sql := `
		SELECT create_table_query
		FROM system.tables
		WHERE database = {db:String} AND name = {table:String}
	`
	var ddl string
	err := conn.QueryRow(ctx, sql, clickhouse.Named("db", currentDB), clickhouse.Named("table", table)).Scan(&ddl)
	if err != nil {
		return "", err
	}
	return ddl, nil
}
