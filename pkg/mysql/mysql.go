package mysql

import (
	"context"
	"database/sql"
	"datacia/pkg/common"
	"errors"
	"fmt"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
)

type MySQLClient interface {
	Close() error
	Ping() error
	RunQuery(queryId, queryType, sql string) (common.QueryResult, error)
	CancelQuery(queryId string) error
	ListDatabases() (common.DatabaseInfo, error)
	ListTables() ([]string, error)
	GetConnectionInfo() (map[string]string, error)
	GetTableData(table string, limit, offset int, orderBy, orderDir string) (common.QueryResult, error)
	GetTableSchema(table string) (common.QueryResult, error)
}

var _ MySQLClient = (*MySQL)(nil)

type MySQL struct {
	db *sql.DB
	*common.ConnectionState
}

func New() *MySQL {
	return &MySQL{
		ConnectionState: &common.ConnectionState{},
	}
}

func (m *MySQL) Connect(host, port, username, password, database string, test bool) error {
	// DSN format: username:password@tcp(host:port)/database
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true", username, password, host, port, database)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return err
	}

	// Configure pool settings
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(time.Hour)
	db.SetConnMaxIdleTime(time.Minute * 30)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return err
	}

	if !test {
		m.Mu.Lock()
		if m.db != nil {
			m.db.Close()
		}
		m.db = db
		m.Host = host
		m.Port = port
		m.Username = username
		m.Password = password
		m.Database = database
		m.Mu.Unlock()
	} else {
		// if test=true → close right away
		db.Close()
	}

	return nil
}

func (m *MySQL) Close() error {
	m.ActiveQueries = sync.Map{} // reset

	m.Mu.Lock()
	defer m.Mu.Unlock()

	if m.db == nil {
		return nil
	}

	err := m.db.Close()
	m.db = nil
	return err
}

func (m *MySQL) Ping() error {
	m.Mu.RLock()
	db := m.db
	m.Mu.RUnlock()

	if db == nil {
		return errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return db.PingContext(ctx)
}

func (m *MySQL) RunQuery(queryID, queryType, sqlStr string) (common.QueryResult, error) {
	if queryID == "" {
		queryID = uuid.NewString()
	}

	m.Mu.RLock()
	db := m.db
	m.Mu.RUnlock()

	if db == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	if _, exists := m.ActiveQueries.Load(queryID); exists {
		return common.QueryResult{}, fmt.Errorf("query with ID %s is already running", queryID)
	}

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	m.ActiveQueries.Store(queryID, cancel)
	defer func() {
		cancel()
		m.ActiveQueries.Delete(queryID)
	}()

	switch common.QueryType(queryType) {
	case common.QueryTypeCommand:
		return m.execute(ctx, db, sqlStr)
	case common.QueryTypeRead:
		return m.query(ctx, db, sqlStr)
	default:
		return common.QueryResult{Type: common.QueryTypeUnknown}, fmt.Errorf("unsupported query type: %s", queryType)
	}
}

func (m *MySQL) execute(ctx context.Context, db *sql.DB, sqlStr string) (common.QueryResult, error) {
	_, err := db.ExecContext(ctx, sqlStr)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeCommand}, err
	}
	return common.QueryResult{Type: common.QueryTypeCommand}, nil
}

func (m *MySQL) query(ctx context.Context, db *sql.DB, sqlStr string) (common.QueryResult, error) {
	rows, err := db.QueryContext(ctx, sqlStr)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	var data []map[string]interface{}

	// Prepare values for scanning
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range columns {
		valuePtrs[i] = &values[i]
	}

	for rows.Next() {
		select {
		case <-ctx.Done():
			return common.QueryResult{Type: common.QueryTypeRead}, ctx.Err()
		default:
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return common.QueryResult{Type: common.QueryTypeRead}, err
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]

			// Handle []byte to string conversion for text/varchar columns if needed
			// MySQL driver returns []byte for text fields usually
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
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

func (m *MySQL) CancelQuery(queryID string) error {
	if cancelFunc, exists := m.ActiveQueries.Load(queryID); exists {
		if cancel, ok := cancelFunc.(context.CancelFunc); ok {
			cancel()
			m.ActiveQueries.Delete(queryID)
			return nil
		}
	}
	// Note: MySQL cancellation via context only works if the driver supports it and the query is actively running.
	// For true server-side cancellation, we might need a separate connection to run KILL QUERY,
	// but context cancellation is the standard Go way.
	return fmt.Errorf("query with ID %s not found or already completed", queryID)
}

func (m *MySQL) ListDatabases() (common.DatabaseInfo, error) {
	m.Mu.RLock()
	db := m.db
	m.Mu.RUnlock()

	if db == nil {
		return common.DatabaseInfo{}, errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx, "SHOW DATABASES")
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
		CurrentDatabase: m.Database,
	}, nil
}

func (m *MySQL) ListTables() ([]string, error) {
	m.Mu.RLock()
	db := m.db
	m.Mu.RUnlock()

	if db == nil {
		return nil, errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx, "SHOW TABLES")
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

func (m *MySQL) GetConnectionInfo() (map[string]string, error) {
	m.Mu.RLock()
	defer m.Mu.RUnlock()

	if m.db == nil {
		return nil, errors.New("no active connection found")
	}

	return map[string]string{
		"engine":   "mysql",
		"host":     m.Host,
		"port":     m.Port,
		"username": m.Username,
		"password": m.Password,
		"database": m.Database,
	}, nil
}

func (m *MySQL) GetTableData(table string, limit, offset int, orderBy, orderDir string) (common.QueryResult, error) {
	m.Mu.RLock()
	db := m.db
	m.Mu.RUnlock()

	if db == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	defer cancel()

	sqlStr := fmt.Sprintf("SELECT * FROM `%s`", table)
	if orderBy != "" {
		dir := "ASC"
		if orderDir == "desc" {
			dir = "DESC"
		}
		sqlStr += fmt.Sprintf(" ORDER BY `%s` %s", orderBy, dir)
	}
	sqlStr += fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)
	return m.query(ctx, db, sqlStr)
}

func (m *MySQL) GetTableSchema(table string) (common.QueryResult, error) {
	m.Mu.RLock()
	db := m.db
	m.Mu.RUnlock()

	if db == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	// Query information_schema.columns for table schema
	// Note: MySQL uses ? for placeholders
	sqlStr := `
		SELECT 
			*
		FROM information_schema.columns
		WHERE table_schema = ? AND table_name = ?
		ORDER BY ordinal_position
	`

	// We need to pass database name as table_schema
	rows, err := db.QueryContext(ctx, sqlStr, m.Database, table)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()

	// ... (Scanning logic similar to query method)
	columns, err := rows.Columns()
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	var data []map[string]interface{}
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range columns {
		valuePtrs[i] = &values[i]
	}

	for rows.Next() {
		if err := rows.Scan(valuePtrs...); err != nil {
			return common.QueryResult{Type: common.QueryTypeRead}, err
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}
		data = append(data, row)
	}

	return common.QueryResult{
		Type:    common.QueryTypeRead,
		Columns: columns,
		Data:    data,
	}, nil
}
