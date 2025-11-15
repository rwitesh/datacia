package remote

import (
	"layerbits/pkg/common"
)

// DatabaseClient defines the common interface that individual database engines must implement
type DatabaseClient interface {
	Connect(host, port, username, password, database string, test bool) error
	Close() error
	GetConnectionInfo() (map[string]string, error)
	ListDatabases() (common.DatabaseInfo, error)
	ListTables() ([]string, error)
	RunQuery(queryId, queryType, sql string) (common.QueryResult, error)
	CancelQuery(queryId string) error
	GetTableData(table string, limit, offset int) (common.QueryResult, error)
	GetTableSchema(table string) (common.QueryResult, error)
}

// RemoteEngine defines the interface for the high-level remote engine that manages
// database connections and provides additional functionality like connection storage
type RemoteEngine interface {
	// Connection Management
	CreateNewConnection(engine, host, port, username, password, database string, test bool) error
	EstablishConnection(id string) error
	ChangeDatabase(engine, host, port, username, password, database string) error
	ChangeDatabaseByName(database string) error
	CloseCurrentConnection() error
	GetCurrentConnectionInfo() (map[string]string, error)

	// Connection Storage
	SaveConnection(name string, config map[string]string) error
	LoadConnection(id string) (map[string]string, error)
	ListConnections() (map[string]common.ConnectionInfo, error)
	UpdateConnection(id, name string, config map[string]string) error
	DeleteConnection(id string) (bool, error)

	// Database Operations
	ListDatabases() (interface{}, error)
	ListTables() ([]string, error)

	// Query Operations
	RunQuery(queryId, queryType, sql string) (common.QueryResult, error)
	CancelQuery(queryId string) error
	GetTableData(table string, limit, offset int) (common.QueryResult, error)
	GetTableSchema(table string) (common.QueryResult, error)
}

// Compile-time check to ensure Engine implements RemoteEngine interface
var _ RemoteEngine = (*Engine)(nil)
