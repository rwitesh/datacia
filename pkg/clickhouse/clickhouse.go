package clickhouse

import (
	"context"
	"crypto/tls"
	"datacia/pkg/common"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
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

func (ch *ClickHouse) Connect(config common.ConnectionConfig) error {
	tlsSettings, err := config.TLSSettings()
	if err != nil {
		return err
	}
	connection, err := open(config, tlsSettings.Config, clickhouse.Native)
	// A port speaks either the native protocol (9000, 9440) or HTTP (8123,
	// 8443). An HTTP port answers the native handshake with "HTTP/1.1 400",
	// whose "H" the driver reports as packet 72, so retry over HTTP then.
	if err != nil && strings.Contains(err.Error(), "unexpected packet [72]") {
		connection, err = open(config, tlsSettings.Config, clickhouse.HTTP)
	}
	// A secure port closes a plaintext connection without a word.
	if err != nil && tlsSettings.Config == nil && errors.Is(err, io.EOF) {
		return fmt.Errorf("%w; if this is a secure port (9440, 8443), set SSL to Require or Verify", err)
	}
	if err != nil {
		return err
	}

	ch.Mu.Lock()
	ch.conn = connection
	ch.Host = config.Host
	ch.Port = config.Port
	ch.Username = config.Username
	ch.Database = config.Database
	ch.SetSSL(config)
	ch.Password = common.NewSecureString(config.Password)
	ch.Mu.Unlock()
	return nil
}

// open connects with protocol and pings the server. Neither protocol can
// negotiate TLS, so it is on only when asked for, on the server's secure port.
func open(config common.ConnectionConfig, tlsConfig *tls.Config, protocol clickhouse.Protocol) (driver.Conn, error) {
	connection, err := clickhouse.Open(&clickhouse.Options{
		Protocol: protocol,
		Addr:     []string{net.JoinHostPort(config.Host, config.Port)},
		TLS:      tlsConfig,
		Auth: clickhouse.Auth{
			Database: config.Database,
			Username: config.Username,
			Password: config.Password,
		},
		Settings: clickhouse.Settings{
			"max_execution_time": 300,
		},
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionZSTD,
		},
		DialTimeout:  common.CONNECT_TIMEOUT,
		MaxOpenConns: 10,
		MaxIdleConns: 5,
	})
	if err != nil {
		return nil, err
	}

	ctx, cancel := common.NewTimeoutContext(common.CONNECT_TIMEOUT)
	defer cancel()
	if err := connection.Ping(ctx); err != nil {
		_ = connection.Close()
		return nil, err
	}
	return connection, nil
}

func (ch *ClickHouse) Close() error {
	ch.Mu.Lock()
	conn := ch.conn
	ch.conn = nil
	ch.ClearAllStateUnsafe()
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
		return ch.query(ctx, conn, sql, queryID, common.MaxEditorRows)
	default:
		return common.QueryResult{Type: common.QueryTypeUnknown}, fmt.Errorf("unsupported query type: %s", queryType)
	}
}

func (ch *ClickHouse) execute(ctx context.Context, conn driver.Conn, sql string, queryID string) (common.QueryResult, error) {
	err := conn.Exec(clickhouse.Context(ctx, clickhouse.WithQueryID(queryID)), sql)
	return common.QueryResult{Type: common.QueryTypeCommand}, err
}

// queryProgress sums the server's progress packets. Only the native protocol
// sends them, so reported stays false over HTTP.
type queryProgress struct {
	mu        sync.Mutex
	reported  bool
	rowsRead  uint64
	bytesRead uint64
}

func (ch *ClickHouse) query(ctx context.Context, conn driver.Conn, sql string, queryID string, maxRows int) (common.QueryResult, error) {
	progress := &queryProgress{}
	progressCB := clickhouse.WithProgress(func(p *clickhouse.Progress) {
		progress.mu.Lock()
		progress.reported = true
		progress.rowsRead += p.Rows
		progress.bytesRead += p.Bytes
		progress.mu.Unlock()
	})
	options := []clickhouse.QueryOption{progressCB}
	if queryID != "" {
		options = append(options, clickhouse.WithQueryID(queryID))
	}
	queryCtx := clickhouse.Context(ctx, options...)

	rows, err := conn.Query(queryCtx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()

	columns, data, truncated, err := scanDynamicColumns(queryCtx, rows, maxRows)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	rowsReturned := uint64(len(data))
	logs := common.QueryLogs{RowsReturned: &rowsReturned}

	progress.mu.Lock()
	if progress.reported {
		rowsRead, bytesRead := progress.rowsRead, progress.bytesRead
		logs.RowsRead, logs.BytesRead = &rowsRead, &bytesRead
	}
	progress.mu.Unlock()

	return common.QueryResult{
		Type:      common.QueryTypeRead,
		Columns:   columns,
		Data:      data,
		Logs:      logs,
		Truncated: truncated,
	}, nil
}

// ReadOnlyQuery runs sql with readonly=1, which blocks writes, table
// functions such as url() and remote(), and SETTINGS that would lift the
// limits set here.
func (ch *ClickHouse) ReadOnlyQuery(ctx context.Context, sql string, maxRows int) (common.QueryResult, error) {
	ch.Mu.RLock()
	conn := ch.conn
	ch.Mu.RUnlock()

	if conn == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(ctx, common.QUERY_TIMEOUT)
	defer cancel()

	// The driver also sets max_execution_time from ctx's deadline, so the
	// server stops the query even if a cancelled HTTP request doesn't.
	queryCtx := clickhouse.Context(ctx, clickhouse.WithSettings(clickhouse.Settings{"readonly": 1, "allow_ddl": 0}))
	rows, err := conn.Query(queryCtx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()
	// Cancel before rows.Close so unread rows aren't drained.
	defer cancel()

	columns, data, truncated, err := scanDynamicColumns(queryCtx, rows, maxRows)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	return common.QueryResult{Type: common.QueryTypeRead, Columns: columns, Data: data, Truncated: truncated}, nil
}

// CancelQuery cancels the query's context, which makes the driver send a
// cancel packet, and also runs KILL QUERY in case that never reaches the server.
func (ch *ClickHouse) CancelQuery(queryID string) error {
	if val, exists := ch.ActiveQueries.LoadAndDelete(queryID); exists {
		if cancelFunc, ok := val.(context.CancelFunc); ok {
			cancelFunc()
		}
	}

	// Only a UUID is spliced into KILL QUERY, so it can't inject SQL.
	if _, err := uuid.Parse(queryID); err != nil {
		return fmt.Errorf("invalid query ID %q", queryID)
	}

	ch.Mu.RLock()
	conn := ch.conn
	ch.Mu.RUnlock()

	if conn == nil {
		return errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(3 * time.Second)
	defer cancel()

	// The query may have finished already.
	_ = conn.Exec(ctx, fmt.Sprintf("KILL QUERY WHERE query_id = '%s'", queryID))
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
	return ch.query(ctx, conn, sqlStr, "", 0)
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

	sql := `
		SELECT *
		FROM system.columns
		WHERE database = {db:String} AND table = {table:String}
		ORDER BY position
	`

	rows, err := conn.Query(ctx, sql, clickhouse.Named("db", currentDB), clickhouse.Named("table", table))
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()

	columns, data, _, err := scanDynamicColumns(ctx, rows, 0)
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
