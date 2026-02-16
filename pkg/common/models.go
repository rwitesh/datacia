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

type QueryLogs struct {
	RowsReturned *uint64 `json:"rowsReturned,omitempty"`
	RowsRead     *uint64 `json:"rowsRead,omitempty"`
	BytesRead    *uint64 `json:"bytesRead,omitempty"`
}

type QueryResult struct {
	Type        QueryType                `json:"type"`
	Columns     []string                 `json:"columns"`
	Data        []map[string]interface{} `json:"data"`
	TimeElapsed int64                    `json:"timeElapsed"`
	Logs        QueryLogs                `json:"logs"`
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
	Password      *SecureString
	Database      string
	ActiveQueries sync.Map
	Mu            sync.RWMutex
}

// SetPassword securely stores a password in the ConnectionState.
func (cs *ConnectionState) SetPassword(password string) {
	cs.Mu.Lock()
	defer cs.Mu.Unlock()
	// Clear existing password if any
	if cs.Password != nil {
		cs.Password.Clear()
	}
	cs.Password = NewSecureString(password)
}

// GetPassword returns a copy of the password as a string.
// Returns empty string if password is not set.
func (cs *ConnectionState) GetPassword() string {
	cs.Mu.RLock()
	defer cs.Mu.RUnlock()
	if cs.Password == nil {
		return ""
	}
	return cs.Password.String()
}

// ClearPassword zeros the password from memory.
func (cs *ConnectionState) ClearPassword() {
	cs.Mu.Lock()
	defer cs.Mu.Unlock()
	if cs.Password != nil {
		cs.Password.Clear()
		cs.Password = nil
	}
}

// ClearAllState clears all connection state fields.
func (cs *ConnectionState) ClearAllState() {
	cs.Mu.Lock()
	defer cs.Mu.Unlock()
	cs.ClearAllStateUnsafe()
}

// ClearAllStateUnsafe clears all connection state fields without locking.
// Caller must hold the lock (cs.Mu.Lock()).
func (cs *ConnectionState) ClearAllStateUnsafe() {
	cs.Host = ""
	cs.Port = ""
	cs.Username = ""
	cs.Database = ""
	if cs.Password != nil {
		cs.Password.Clear()
		cs.Password = nil
	}
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
	GetTableData(table string, limit, offset int, orderBy, orderDir string) (QueryResult, error)
	GetTableSchema(table string) (QueryResult, error)
	GetDDL(table string) (string, error) // Returns CREATE TABLE statement
	GetPassword() string                 // Returns password for reconnection purposes (internal use)
}

const (
	CONNECT_TIMEOUT   = 10 * time.Second
	META_TIMEOUT      = 10 * time.Second
	CHANGE_DB_TIMEOUT = 10 * time.Second
	QUERY_TIMEOUT     = 30 * time.Second
)

func NewTimeoutContext(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}
