package postgres

import (
	"context"
	"datacia/pkg/common"
	"errors"
	"fmt"
	"net"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgconn/ctxwatch"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
	// session runs the editor's statements, so a transaction, SET or temporary
	// table carries over from one run to the next. Everything else uses the
	// pool. session and sessionInTx are only used while holding sessionLock.
	session     *pgxpool.Conn
	sessionInTx bool
	sessionLock chan struct{}
	*common.ConnectionState
}

func New() *Postgres {
	return &Postgres{
		ConnectionState: &common.ConnectionState{},
	}
}

// cancelOnServer makes a cancelled context send a cancel request, so the
// server stops the statement and the connection (and its transaction) stays
// usable. pgx's default only closes the socket, leaving the statement
// running. The deadline is the fallback if the server doesn't respond.
func cancelOnServer(conn *pgconn.PgConn) ctxwatch.Handler {
	return &pgconn.CancelRequestContextWatcherHandler{Conn: conn, DeadlineDelay: 5 * time.Second}
}

func (p *Postgres) Connect(config common.ConnectionConfig) error {
	// Construct DSN with proper URL encoding for username, password, and database
	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(config.Username, config.Password),
		Host:   net.JoinHostPort(config.Host, config.Port),
		Path:   "/" + config.Database,
	}
	dsn := u.String()

	ctx, cancel := common.NewTimeoutContext(common.CONNECT_TIMEOUT)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return err
	}

	// Configure pool settings
	poolConfig.MaxConns = 10
	poolConfig.MinConns = 1
	poolConfig.MaxConnLifetime = time.Hour
	poolConfig.MaxConnIdleTime = time.Minute * 1
	poolConfig.ConnConfig.BuildContextWatcherHandler = cancelOnServer

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return err
	}

	// Acquiring the session connection also checks that the server is reachable.
	session, err := pool.Acquire(ctx)
	if err != nil {
		pool.Close()
		return err
	}

	p.Mu.Lock()
	p.pool = pool
	p.session = session
	p.sessionLock = make(chan struct{}, 1)
	p.Host = config.Host
	p.Port = config.Port
	p.Username = config.Username
	p.Database = config.Database
	p.Password = common.NewSecureString(config.Password)
	p.Mu.Unlock()
	return nil
}

func (p *Postgres) Close() error {
	p.Mu.Lock()
	pool, lock := p.pool, p.sessionLock
	p.pool = nil
	p.ClearAllStateUnsafe() // Calling unsafe method since it is already in lock
	p.Mu.Unlock()

	if pool == nil {
		return nil
	}

	// Stop running statements, then wait for the session to be free. The
	// lock is never released, so statements still waiting for it give up.
	p.CancelAll()
	lock <- struct{}{}
	if p.session != nil {
		p.session.Release()
		p.session = nil
	}
	pool.Close()
	return nil
}

// sessionConn returns the session connection, replacing it if it dropped.
// Losing it mid-transaction is an error: the server rolled that work back.
func (p *Postgres) sessionConn(ctx context.Context, pool *pgxpool.Pool) (*pgxpool.Conn, error) {
	if p.session != nil {
		// The pool only checks idle connections, so a held one that the
		// server or network dropped (restart, idle timeout, sleep) would
		// otherwise fail the next statement.
		err := p.session.Ping(ctx)
		if err == nil {
			return p.session, nil
		}
		// A cancelled ping leaves the connection open, and it is still the session.
		if !p.session.Conn().IsClosed() {
			return nil, err
		}
		p.session.Release()
		p.session = nil
	}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to acquire connection: %w", err)
	}
	lostTx := p.sessionInTx
	p.session, p.sessionInTx = conn, false
	if lostTx {
		return nil, common.ErrSessionLost
	}
	return conn, nil
}

func (p *Postgres) Ping() error {
	p.Mu.RLock()
	pool := p.pool
	p.Mu.RUnlock()

	if pool == nil {
		return errors.New("no active connection pool found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return pool.Ping(ctx)
}

func (p *Postgres) RunQuery(queryID, queryType, sql string) (common.QueryResult, error) {
	if queryID == "" {
		queryID = uuid.NewString()
	}

	p.Mu.RLock()
	pool, lock := p.pool, p.sessionLock
	p.Mu.RUnlock()

	if pool == nil {
		return common.QueryResult{}, errors.New("no active connection pool found")
	}

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	if _, exists := p.ActiveQueries.LoadOrStore(queryID, cancel); exists {
		cancel()
		return common.QueryResult{}, fmt.Errorf("query with ID %s is already running", queryID)
	}
	defer func() {
		cancel()
		p.ActiveQueries.Delete(queryID)
	}()

	if err := common.LockSession(ctx, lock); err != nil {
		return common.QueryResult{}, err
	}
	defer func() { <-lock }()
	conn, err := p.sessionConn(ctx, pool)
	if err != nil {
		return common.QueryResult{}, err
	}
	defer func() { p.sessionInTx = conn.Conn().PgConn().TxStatus() != 'I' }()

	switch common.QueryType(queryType) {
	case common.QueryTypeCommand:
		return p.execute(ctx, conn.Conn(), sql)
	case common.QueryTypeRead:
		return p.query(ctx, conn.Conn(), sql, common.MaxEditorRows)
	default:
		return common.QueryResult{Type: common.QueryTypeUnknown}, fmt.Errorf("unsupported query type: %s", queryType)
	}
}

func (p *Postgres) execute(ctx context.Context, conn *pgx.Conn, sql string) (common.QueryResult, error) {
	_, err := conn.Exec(ctx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeCommand}, err
	}
	return common.QueryResult{Type: common.QueryTypeCommand}, nil
}

// ReadOnlyQuery runs sql in a read-only transaction.
func (p *Postgres) ReadOnlyQuery(ctx context.Context, sql string, maxRows int) (common.QueryResult, error) {
	p.Mu.RLock()
	pool := p.pool
	p.Mu.RUnlock()

	if pool == nil {
		return common.QueryResult{}, errors.New("no active connection pool found")
	}

	ctx, cancel := context.WithTimeout(ctx, common.QUERY_TIMEOUT)
	defer cancel()

	tx, err := pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer tx.Rollback(context.Background())
	// A cancel request may not reach the server, so it also stops the query.
	if _, err := tx.Exec(ctx, fmt.Sprintf("SET LOCAL statement_timeout = %d", common.QUERY_TIMEOUT.Milliseconds())); err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	rows, err := tx.Query(ctx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()
	// Cancel before rows.Close so unread rows aren't drained.
	defer cancel()
	return scanRows(ctx, rows, maxRows)
}

func (p *Postgres) query(ctx context.Context, conn *pgx.Conn, sql string, maxRows int) (common.QueryResult, error) {
	rows, err := conn.Query(ctx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()
	return scanRows(ctx, rows, maxRows)
}

// scanRows reads up to maxRows rows, or all of them when maxRows is 0.
func scanRows(ctx context.Context, rows pgx.Rows, maxRows int) (common.QueryResult, error) {
	columns := make([]string, len(rows.FieldDescriptions()))
	for i, fd := range rows.FieldDescriptions() {
		columns[i] = fd.Name
	}
	columns = common.UniqueColumnNames(columns)

	var data []map[string]interface{}
	for (maxRows == 0 || len(data) < maxRows) && rows.Next() {
		select {
		case <-ctx.Done():
			return common.QueryResult{Type: common.QueryTypeRead}, ctx.Err()
		default:
		}

		values, err := rows.Values()
		if err != nil {
			return common.QueryResult{Type: common.QueryTypeRead}, err
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			if i < len(values) {
				row[col] = values[i]
			}
		}
		data = append(data, row)
	}

	// Peek one row past the cap so a result of exactly maxRows isn't flagged.
	truncated := maxRows > 0 && len(data) == maxRows && rows.Next()

	if err := rows.Err(); err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	return common.QueryResult{
		Type:      common.QueryTypeRead,
		Columns:   columns,
		Data:      data,
		Truncated: truncated,
	}, nil
}

func (p *Postgres) ListDatabases() (common.DatabaseInfo, error) {
	p.Mu.RLock()
	pool := p.pool
	database := p.Database
	p.Mu.RUnlock()

	if pool == nil {
		return common.DatabaseInfo{}, errors.New("no active connection pool found")
	}

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	// Acquire a connection from the pool
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return common.DatabaseInfo{}, fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer conn.Release()

	rows, err := conn.Query(ctx, "SELECT datname FROM pg_database WHERE datistemplate = false")
	if err != nil {
		return common.DatabaseInfo{}, fmt.Errorf("failed to list databases: %w", err)
	}
	defer rows.Close()

	var databases []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return common.DatabaseInfo{}, fmt.Errorf("failed to scan database name: %w", err)
		}
		databases = append(databases, name)
	}

	if err := rows.Err(); err != nil {
		return common.DatabaseInfo{}, fmt.Errorf("error iterating over rows: %w", err)
	}

	return common.DatabaseInfo{
		Databases:       databases,
		CurrentDatabase: database,
	}, nil
}

func (p *Postgres) ListTables() ([]string, error) {
	p.Mu.RLock()
	pool := p.pool
	p.Mu.RUnlock()

	if pool == nil {
		return nil, errors.New("no active connection pool found")
	}

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	// Acquire a connection from the pool
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer conn.Release()

	rows, err := conn.Query(ctx, "SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
	if err != nil {
		return nil, fmt.Errorf("failed to list tables: %w", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan table name: %w", err)
		}
		tables = append(tables, name)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over rows: %w", err)
	}

	return tables, nil
}

func (p *Postgres) GetConnectionInfo() (map[string]string, error) {
	p.Mu.RLock()
	defer p.Mu.RUnlock()

	if p.pool == nil {
		return nil, errors.New("no active connection pool found")
	}

	return map[string]string{
		"engine":   "postgres",
		"host":     p.Host,
		"port":     p.Port,
		"username": p.Username,
		"password": "", // Password not exposed for security
		"database": p.Database,
	}, nil
}

func (p *Postgres) GetTableData(table string, limit, offset int, orderBy, orderDir string) (common.QueryResult, error) {
	p.Mu.RLock()
	pool := p.pool
	p.Mu.RUnlock()

	if pool == nil {
		return common.QueryResult{}, errors.New("no active connection pool found")
	}

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	defer cancel()

	// Acquire a connection from the pool
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return common.QueryResult{}, fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer conn.Release()

	sql, err := common.TableDataSQL(table, orderBy, orderDir, limit, offset, common.QuoteDoubleQuote)
	if err != nil {
		return common.QueryResult{}, err
	}
	return p.query(ctx, conn.Conn(), sql, 0)
}

func (p *Postgres) GetTableSchema(table string) (common.QueryResult, error) {
	p.Mu.RLock()
	pool := p.pool
	p.Mu.RUnlock()

	if pool == nil {
		return common.QueryResult{}, errors.New("no active connection pool found")
	}

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	// Acquire a connection from the pool
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return common.QueryResult{}, fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer conn.Release()

	// Query information_schema.columns for table schema
	sql := `
		SELECT 
			*
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = $1
		ORDER BY ordinal_position
	`

	rows, err := conn.Conn().Query(ctx, sql, table)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()
	return scanRows(ctx, rows, 0)
}

func (p *Postgres) GetDDL(table string) (string, error) {
	p.Mu.RLock()
	pool := p.pool
	p.Mu.RUnlock()

	if pool == nil {
		return "", errors.New("no active connection pool found")
	}

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer conn.Release()

	// Use pg_get_tabledef function or construct DDL manually
	// Since pg_get_tabledef is not standard, we'll use a query that constructs the DDL
	sql := `
		SELECT 
			'CREATE TABLE ' || quote_ident(c.table_name) || ' (' || 
			string_agg(
				quote_ident(c.column_name) || ' ' || c.data_type || 
				CASE WHEN c.character_maximum_length IS NOT NULL 
					THEN '(' || c.character_maximum_length || ')' 
					ELSE '' 
				END ||
				CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
				', ' ORDER BY c.ordinal_position
			) || ');' as ddl
		FROM information_schema.columns c
		WHERE c.table_schema = 'public' AND c.table_name = $1
		GROUP BY c.table_name
	`

	var ddl string
	err = conn.Conn().QueryRow(ctx, sql, table).Scan(&ddl)
	if err != nil {
		return "", err
	}

	return ddl, nil
}
