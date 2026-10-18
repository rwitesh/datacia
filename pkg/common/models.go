package common

import (
	"context"
	"errors"
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
	// Truncated is set when the result holds only the first rows of a larger one.
	Truncated bool `json:"truncated,omitempty"`
}

type DatabaseInfo struct {
	Databases       []string `json:"databases"`
	CurrentDatabase string   `json:"currentDatabase"`
}

// SSHConfig is the optional SSH tunnel a connection goes through. A key file,
// when set, is used instead of the password.
type SSHConfig struct {
	Enabled  bool   `json:"enabled"`
	Host     string `json:"host"`
	Port     string `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	KeyPath  string `json:"keyPath"`
}

// ConnectionConfig is everything needed to connect to a database. ID and Name
// are set only for saved connections. For SQLite, Database is the file path.
type ConnectionConfig struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Engine   string    `json:"engine"`
	Host     string    `json:"host"`
	Port     string    `json:"port"`
	Username string    `json:"username"`
	Password string    `json:"password"`
	Database string    `json:"database"`
	SSH      SSHConfig `json:"ssh"`
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

// CancelQuery cancels the context of a running query started with its ID.
// ClickHouse overrides it to also run KILL QUERY, since it has no pinned
// connection whose cancellation would stop the statement.
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

// CancelAll cancels every running query, so closing a connection doesn't
// wait for them to finish or time out.
func (cs *ConnectionState) CancelAll() {
	cs.ActiveQueries.Range(func(_, cancel any) bool {
		if cancel, ok := cancel.(context.CancelFunc); ok {
			cancel()
		}
		return true
	})
}

// ErrSessionLost is returned when the editor's session connection dropped
// after statements that may have left a transaction or session settings,
// which the server has discarded.
var ErrSessionLost = errors.New("the connection to the server was lost, so any open transaction was rolled back and session settings were reset; run those statements again")

// LockSession takes lock, a one-slot semaphore that lets one editor
// statement at a time use the session connection. Unlike a mutex, waiting
// for it stops when ctx is cancelled.
func LockSession(ctx context.Context, lock chan struct{}) error {
	select {
	case lock <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
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
	// CONNECT_TIMEOUT bounds opening a connection and checking it with a ping.
	CONNECT_TIMEOUT = 10 * time.Second
	META_TIMEOUT    = 10 * time.Second
	QUERY_TIMEOUT   = 30 * time.Second

	// MaxEditorRows caps the rows one editor query returns. Every row becomes a
	// map and crosses the Wails bridge as JSON, so an unbounded SELECT * would
	// exhaust memory or freeze the UI.
	MaxEditorRows = 10000
)

func NewTimeoutContext(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}
