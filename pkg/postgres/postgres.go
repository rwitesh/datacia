package postgres

import (
	"context"
	"errors"
	"fmt"
	"layerbits/pkg/common"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type PostgresClient interface {
	Connect(host, port, username, password, database string, test bool) error
	Close() error
	Ping() error
	RunQuery(queryId, queryType, sql string) (common.QueryResult, error)
	CancelQuery(queryId string) error
	ListDatabases() (common.DatabaseInfo, error)
	ListTables() ([]string, error)
	GetConnectionInfo() (map[string]string, error)
}

var _ PostgresClient = (*Postgres)(nil)

type Postgres struct {
	conn          *pgx.Conn
	host          string
	port          string
	username      string
	password      string
	database      string
	activeQueries sync.Map
	mu            sync.RWMutex
}

func New() *Postgres {
	return &Postgres{}
}

func (p *Postgres) Connect(host, port, username, password, database string, test bool) error {
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s",
		username, password, host, port, database,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return err
	}

	// Test connection
	if err := conn.Ping(ctx); err != nil {
		_ = conn.Close(ctx)
		return err
	}

	if !test {
		p.mu.Lock()
		if p.conn != nil {
			_ = p.conn.Close(ctx)
		}
		p.conn = conn
		p.host = host
		p.port = port
		p.username = username
		p.password = password
		p.database = database
		p.mu.Unlock()
	} else {
		// if test=true → close right away (don't keep state)
		_ = conn.Close(ctx)
	}

	return nil
}

func (p *Postgres) Close() error {
	p.activeQueries = sync.Map{} // reset

	p.mu.Lock()
	defer p.mu.Unlock()

	if p.conn == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := p.conn.Close(ctx)
	if err != nil {
		return err
	}
	p.conn = nil
	return nil
}

func (p *Postgres) Ping() error {
	p.mu.RLock()
	conn := p.conn
	p.mu.RUnlock()

	if conn == nil {
		return errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return conn.Ping(ctx)
}

func (p *Postgres) RunQuery(queryID, queryType, sql string) (common.QueryResult, error) {
	if queryID == "" {
		queryID = uuid.NewString()
	}

	// Grab connection under read lock
	p.mu.RLock()
	conn := p.conn
	p.mu.RUnlock()

	if conn == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	if _, exists := p.activeQueries.Load(queryID); exists {
		return common.QueryResult{}, fmt.Errorf("query with ID %s is already running", queryID)
	}

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	p.activeQueries.Store(queryID, cancel)
	defer func() {
		cancel()
		p.activeQueries.Delete(queryID)
	}()

	switch common.QueryType(queryType) {
	case common.QueryTypeCommand:
		return p.execute(ctx, conn, sql)
	case common.QueryTypeRead:
		return p.query(ctx, conn, sql)
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

func (p *Postgres) query(ctx context.Context, conn *pgx.Conn, sql string) (common.QueryResult, error) {
	rows, err := conn.Query(ctx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()

	columns := make([]string, len(rows.FieldDescriptions()))
	for i, fd := range rows.FieldDescriptions() {
		columns[i] = fd.Name
	}

	var data []map[string]interface{}
	for rows.Next() {
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

	if err := rows.Err(); err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	return common.QueryResult{
		Type:    common.QueryTypeRead,
		Columns: columns,
		Data:    data,
	}, nil
}

func (p *Postgres) CancelQuery(queryID string) error {
	if cancelFunc, exists := p.activeQueries.Load(queryID); exists {
		if cancel, ok := cancelFunc.(context.CancelFunc); ok {
			cancel()
			p.activeQueries.Delete(queryID)
			return nil
		}
	}
	return fmt.Errorf("query with ID %s not found or already completed", queryID)
}

func (p *Postgres) ListDatabases() (common.DatabaseInfo, error) {
	p.mu.RLock()
	conn := p.conn
	p.mu.RUnlock()

	if conn == nil {
		return common.DatabaseInfo{}, errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := conn.Query(ctx, "SELECT datname FROM pg_database WHERE datistemplate = false")
	if err != nil {
		return common.DatabaseInfo{}, fmt.Errorf("failed to list databases: %w", err)
	}
	defer rows.Close()

	var databases []string
	for rows.Next() {
		var dbName string
		if err := rows.Scan(&dbName); err != nil {
			return common.DatabaseInfo{}, fmt.Errorf("failed to scan database name: %w", err)
		}
		databases = append(databases, dbName)
	}

	if err := rows.Err(); err != nil {
		return common.DatabaseInfo{}, fmt.Errorf("error iterating over rows: %w", err)
	}

	return common.DatabaseInfo{
		Databases:       databases,
		CurrentDatabase: p.database,
	}, nil
}

func (p *Postgres) ListTables() ([]string, error) {
	p.mu.RLock()
	conn := p.conn
	p.mu.RUnlock()

	if conn == nil {
		return nil, errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	rows, err := conn.Query(ctx, "SELECT tablename FROM pg_tables WHERE schemaname = 'public';")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var tablename string
		if err := rows.Scan(&tablename); err != nil {
			return nil, err
		}
		tables = append(tables, tablename)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return tables, nil
}

func (p *Postgres) GetConnectionInfo() (map[string]string, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if p.conn == nil {
		return nil, errors.New("no active connection found")
	}

	return map[string]string{
		"engine":   "postgres",
		"host":     p.host,
		"port":     p.port,
		"username": p.username,
		"password": p.password,
		"database": p.database,
	}, nil
}
