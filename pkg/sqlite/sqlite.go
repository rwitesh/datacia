package sqlite

import (
	"context"
	"database/sql"
	"datacia/pkg/common"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

type SQLiteClient interface {
	Close() error
	Ping() error
	RunQuery(queryId, queryType, sql string) (common.QueryResult, error)
	CancelQuery(queryId string) error
	ListDatabases() (common.DatabaseInfo, error)
	ListTables() ([]string, error)
	GetConnectionInfo() (map[string]string, error)
}

var _ SQLiteClient = (*SQLite)(nil)

type SQLite struct {
	db   *sql.DB
	roDB *sql.DB // the same file opened read-only, for ReadOnlyQuery
	*common.ConnectionState
}

func New() *SQLite {
	return &SQLite{
		ConnectionState: &common.ConnectionState{},
	}
}

func (s *SQLite) Connect(host, port, username, password, database string, test bool) error {
	// For SQLite, 'database' is the file path. Host, port, username, password are ignored.
	if database == "" {
		return errors.New("database file path is required")
	}

	db, err := sql.Open("sqlite", database+"?_busy_timeout=5000")
	if err != nil {
		return err
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return err
	}

	if test {
		return db.Close()
	}

	roDB, err := sql.Open("sqlite", readOnlyDSN(database))
	if err != nil {
		db.Close()
		return err
	}

	s.Mu.Lock()
	if s.db != nil {
		s.db.Close()
		s.roDB.Close()
	}
	s.db = db
	s.roDB = roDB
	s.Host = database
	s.Mu.Unlock()

	return nil
}

func (s *SQLite) Close() error {
	s.ActiveQueries = sync.Map{} // reset

	s.Mu.Lock()
	db, roDB := s.db, s.roDB
	s.db, s.roDB = nil, nil
	s.ClearAllStateUnsafe() // Calling unsafe method since it is already in lock
	s.Mu.Unlock()

	if db == nil {
		return nil
	}

	roDB.Close()
	return db.Close()
}

func (s *SQLite) Ping() error {
	s.Mu.RLock()
	db := s.db
	s.Mu.RUnlock()

	if db == nil {
		return errors.New("no active connection found")
	}

	return db.Ping()
}

func (s *SQLite) RunQuery(queryID, queryType, querySql string) (common.QueryResult, error) {
	if queryID == "" {
		queryID = uuid.NewString()
	}

	s.Mu.RLock()
	db := s.db
	s.Mu.RUnlock()

	if db == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	if _, exists := s.ActiveQueries.Load(queryID); exists {
		return common.QueryResult{}, fmt.Errorf("query with ID %s is already running", queryID)
	}

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	s.ActiveQueries.Store(queryID, cancel)
	defer func() {
		cancel()
		s.ActiveQueries.Delete(queryID)
	}()

	switch common.QueryType(queryType) {
	case common.QueryTypeCommand:
		return s.execute(ctx, db, querySql)
	case common.QueryTypeRead:
		return s.query(ctx, db, querySql)
	default:
		return common.QueryResult{Type: common.QueryTypeUnknown}, fmt.Errorf("unsupported query type: %s", queryType)
	}
}

func (s *SQLite) execute(ctx context.Context, db *sql.DB, sql string) (common.QueryResult, error) {
	_, err := db.ExecContext(ctx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeCommand}, err
	}
	return common.QueryResult{Type: common.QueryTypeCommand}, nil
}

// ReadOnlyQuery runs querySql on the read-only handle.
func (s *SQLite) ReadOnlyQuery(ctx context.Context, querySql string, maxRows int) (common.QueryResult, error) {
	s.Mu.RLock()
	roDB := s.roDB
	s.Mu.RUnlock()

	if roDB == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(ctx, common.QUERY_TIMEOUT)
	defer cancel()

	rows, err := roDB.QueryContext(ctx, querySql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()
	return scanRows(ctx, rows, maxRows)
}

// readOnlyDSN opens path with mode=ro, which, unlike PRAGMA query_only, no
// statement can turn off.
func readOnlyDSN(path string) string {
	p := filepath.ToSlash(path)
	if filepath.VolumeName(path) != "" {
		p = "/" + p // file:/C:/... on Windows
	}
	return "file:" + (&url.URL{Path: p}).EscapedPath() + "?mode=ro&_busy_timeout=5000"
}

func (s *SQLite) query(ctx context.Context, db *sql.DB, sql string) (common.QueryResult, error) {
	rows, err := db.QueryContext(ctx, sql)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()
	return scanRows(ctx, rows, 0)
}

// scanRows reads up to maxRows rows, or all of them when maxRows is 0.
func scanRows(ctx context.Context, rows *sql.Rows, maxRows int) (common.QueryResult, error) {
	columns, err := rows.Columns()
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}

	var data []map[string]interface{}
	for (maxRows == 0 || len(data) < maxRows) && rows.Next() {
		select {
		case <-ctx.Done():
			return common.QueryResult{Type: common.QueryTypeRead}, ctx.Err()
		default:
		}

		// Create a slice of interface{} to hold the values
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return common.QueryResult{Type: common.QueryTypeRead}, err
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			var v interface{}
			val := values[i]
			b, ok := val.([]byte)
			if ok {
				v = string(b)
			} else {
				v = val
			}
			row[col] = v
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

func (s *SQLite) CancelQuery(queryID string) error {
	if cancelFunc, exists := s.ActiveQueries.Load(queryID); exists {
		if cancel, ok := cancelFunc.(context.CancelFunc); ok {
			cancel()
			s.ActiveQueries.Delete(queryID)
			return nil
		}
	}
	return fmt.Errorf("query with ID %s not found or already completed", queryID)
}

func (s *SQLite) ListDatabases() (common.DatabaseInfo, error) {
	// SQLite only has one database (the file), but we can return "main" or the filename
	s.Mu.RLock()
	defer s.Mu.RUnlock()
	return common.DatabaseInfo{
		Databases:       []string{"main"},
		CurrentDatabase: "main",
	}, nil
}

func (s *SQLite) ListTables() ([]string, error) {
	s.Mu.RLock()
	db := s.db
	s.Mu.RUnlock()

	if db == nil {
		return nil, errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
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

	return tables, nil
}

func (s *SQLite) GetConnectionInfo() (map[string]string, error) {
	s.Mu.RLock()
	defer s.Mu.RUnlock()

	if s.db == nil {
		return nil, errors.New("no active connection found")
	}

	return map[string]string{
		"engine": "sqlite",
		"host":   s.Host,
	}, nil
}

func (s *SQLite) GetPassword() string {
	// SQLite doesn't use passwords, but we implement the interface
	return s.ConnectionState.GetPassword()
}

func (s *SQLite) GetTableData(table string, limit, offset int, orderBy, orderDir string) (common.QueryResult, error) {
	s.Mu.RLock()
	db := s.db
	s.Mu.RUnlock()

	if db == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(common.QUERY_TIMEOUT)
	defer cancel()

	quotedTable, err := common.QuoteIdentifier(table, common.QuoteDoubleQuote)
	if err != nil {
		return common.QueryResult{}, err
	}

	sqlStr := fmt.Sprintf(`SELECT * FROM %s`, quotedTable)
	if orderBy != "" {
		quotedCol, err := common.QuoteIdentifier(orderBy, common.QuoteDoubleQuote)
		if err != nil {
			return common.QueryResult{}, err
		}
		dir := "ASC"
		if orderDir == "desc" {
			dir = "DESC"
		}
		sqlStr += fmt.Sprintf(` ORDER BY %s %s`, quotedCol, dir)
	}
	sqlStr += fmt.Sprintf(` LIMIT %d OFFSET %d`, limit, offset)
	return s.query(ctx, db, sqlStr)
}

func (s *SQLite) GetTableSchema(table string) (common.QueryResult, error) {
	s.Mu.RLock()
	db := s.db
	s.Mu.RUnlock()

	if db == nil {
		return common.QueryResult{}, errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	// Validate table name before using in PRAGMA
	if err := common.ValidateIdentifier(table); err != nil {
		return common.QueryResult{}, err
	}

	// Use PRAGMA table_info for SQLite schema
	// Note: PRAGMA doesn't support parameterized queries, but we've validated the identifier
	pragmaSQL := fmt.Sprintf("PRAGMA table_info('%s')", strings.ReplaceAll(table, "'", "''"))

	rows, err := db.QueryContext(ctx, pragmaSQL)
	if err != nil {
		return common.QueryResult{Type: common.QueryTypeRead}, err
	}
	defer rows.Close()

	// PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
	columns := []string{"cid", "name", "type", "notnull", "dflt_value", "pk"}

	var data []map[string]interface{}
	for rows.Next() {
		var cid int
		var name, typeStr string
		var notnull int
		var dfltValue interface{}
		var pk int

		if err := rows.Scan(&cid, &name, &typeStr, &notnull, &dfltValue, &pk); err != nil {
			return common.QueryResult{Type: common.QueryTypeRead}, err
		}

		row := map[string]interface{}{
			"cid":        cid,
			"name":       name,
			"type":       typeStr,
			"notnull":    notnull,
			"dflt_value": dfltValue,
			"pk":         pk,
		}
		data = append(data, row)
	}

	return common.QueryResult{
		Type:    common.QueryTypeRead,
		Columns: columns,
		Data:    data,
	}, nil
}

func (s *SQLite) GetDDL(table string) (string, error) {
	s.Mu.RLock()
	db := s.db
	s.Mu.RUnlock()

	if db == nil {
		return "", errors.New("no active connection found")
	}

	ctx, cancel := common.NewTimeoutContext(common.META_TIMEOUT)
	defer cancel()

	// Query sqlite_master for the CREATE statement
	sqlStr := "SELECT sql FROM sqlite_master WHERE type='table' AND name=?"
	var ddl string
	err := db.QueryRowContext(ctx, sqlStr, table).Scan(&ddl)
	if err != nil {
		return "", err
	}

	return ddl, nil
}
