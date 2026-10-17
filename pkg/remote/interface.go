package remote

import (
	"context"

	"datacia/pkg/common"
)

// DatabaseClient defines the common interface that individual database engines must implement
type DatabaseClient interface {
	Connect(host, port, username, password, database string, test bool) error
	Close() error
	Ping() error
	GetConnectionInfo() (map[string]string, error)
	ListDatabases() (common.DatabaseInfo, error)
	ListTables() ([]string, error)
	RunQuery(queryId, queryType, sql string) (common.QueryResult, error)
	CancelQuery(queryId string) error
	GetTableData(table string, limit, offset int, orderBy, orderDir string) (common.QueryResult, error)
	GetTableSchema(table string) (common.QueryResult, error)
	GetDDL(table string) (string, error) // Returns CREATE TABLE statement
	GetPassword() string                 // Returns password for reconnection purposes (internal use)
	// ReadOnlyQuery runs sql, which must pass common.CheckReadOnly, with writes
	// blocked by the database, returning at most maxRows rows.
	ReadOnlyQuery(ctx context.Context, sql string, maxRows int) (common.QueryResult, error)
}
