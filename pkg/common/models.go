package common

import (
	"context"
	"sync"
	"time"
)

type QueryType string

const (
	QueryTypeRead    QueryType = "read"
	QueryTypeCommand QueryType = "command"
	QueryTypeUnknown QueryType = "unknown"
)

type QueryResult struct {
	Type    QueryType                `json:"type"`
	Columns []string                 `json:"columns"`
	Data    []map[string]interface{} `json:"data"`
}

type DatabaseInfo struct {
	Databases       []string `json:"databases"`
	CurrentDatabase string   `json:"currentDatabase"`
}

// ConnectionInfo represents a connection list item with name and engine
type ConnectionInfo struct {
	Name   string `json:"name"`
	Engine string `json:"engine"`
}

// ConnectionState holds common connection state for database clients
type ConnectionState struct {
	Host          string
	Port          string
	Username      string
	Password      string
	Database      string
	ActiveQueries sync.Map
	Mu            sync.RWMutex
}

// DatabaseClient defines the common interface for all database implementations
type DatabaseClient interface {
	Connect(host, port, username, password, database string, test bool) error
	Close() error
	Ping() error
	RunQuery(queryId, queryType, sql string) (QueryResult, error)
	CancelQuery(queryId string) error
	ListTables() ([]string, error)
	ListDatabases() (DatabaseInfo, error)
	GetConnectionInfo() (map[string]string, error)
}

const (
	CONNECT_TIMEOUT   = 10 * time.Second
	META_TIMEOUT      = 10 * time.Second
	CHANGE_DB_TIMEOUT = 5 * time.Second
	QUERY_TIMEOUT     = 300 * time.Second
)

func NewTimeoutContext(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}
