package remote

import (
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
}

// RemoteEngine defines the interface for the high-level remote engine that manages
// database connections and provides additional functionality like connection storage
type RemoteEngine interface {
	// Connection Management
	CreateNewConnection(engine, host, port, username, password, database string, test bool) error
	EstablishConnection(id string) error
	ChangeDatabase(engine, host, port, username, password, database string) error
	ChangeDatabaseByName(database string) error
	CloseCurrentConnection(closeEditor bool) error
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
	GetTableData(table string, limit, offset int, orderBy, orderDir string) (common.QueryResult, error)
	GetTableSchema(table string) (common.QueryResult, error)
	GetDDL(table string) (string, error)

	// Connection Health
	CheckConnectionHealth() (*float64, error)
}

// Compile-time check to ensure Engine implements RemoteEngine interface
var _ RemoteEngine = (*Engine)(nil)
