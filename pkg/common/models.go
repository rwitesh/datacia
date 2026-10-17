package common

import (
	"context"
	"fmt"
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

// CancelQuery cancels a running query started with its ID. ClickHouse
// overrides it to also kill the query on the server.
func (cs *ConnectionState) CancelQuery(queryID string) error {
	if cancelFunc, exists := cs.ActiveQueries.Load(queryID); exists {
		if cancel, ok := cancelFunc.(context.CancelFunc); ok {
			cancel()
			cs.ActiveQueries.Delete(queryID)
			return nil
		}
	}
	return fmt.Errorf("query with ID %s not found or already completed", queryID)
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

const (
	META_TIMEOUT  = 10 * time.Second
	QUERY_TIMEOUT = 30 * time.Second
)

func NewTimeoutContext(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}
