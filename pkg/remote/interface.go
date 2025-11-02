package remote

import (
	"layerbits/pkg/common"
)

// DatabaseEngine defines the interface for database connection management
// and query operations with compile-time type checking
type DatabaseEngine interface {
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
	ListConnections() (map[string]string, error)
	UpdateConnection(id, name string, config map[string]string) error
	DeleteConnection(id string) (bool, error)

	// Database Operations
	ListDatabases() (interface{}, error)
	ListTables() ([]string, error)

	// Query Operations
	RunQuery(queryId, queryType, sql string) (common.QueryResult, error)
	CancelQuery(queryId string) error
}

// Compile-time check to ensure Engine implements DatabaseEngine interface
var _ DatabaseEngine = (*Engine)(nil)