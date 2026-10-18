package remote

import (
	"context"

	"datacia/pkg/common"
)

// DatabaseClient is one connection to a database server, implemented by each engine.
type DatabaseClient interface {
	Connect(config common.ConnectionConfig) error
	Close() error
	Ping() error
	GetConnectionInfo() (map[string]string, error)
	ListDatabases() (common.DatabaseInfo, error)
	ListTables() ([]string, error)
	RunQuery(queryId, queryType, sql string) (common.QueryResult, error)
	CancelQuery(queryId string) error
	GetTableData(table string, limit, offset int, orderBy, orderDir string) (common.QueryResult, error)
	GetTableSchema(table string) (common.QueryResult, error)
	GetDDL(table string) (string, error)
	// GetPassword and GetSSL let ChangeDatabaseByName reconnect, since
	// GetConnectionInfo leaves them out.
	GetPassword() string
	GetSSL() (mode, caPath, serverName string)
	// ReadOnlyQuery runs sql, which must pass common.CheckReadOnly, with writes
	// blocked by the database, returning at most maxRows rows.
	ReadOnlyQuery(ctx context.Context, sql string, maxRows int) (common.QueryResult, error)
}
