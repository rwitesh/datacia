package remote

import (
	"context"
	"datacia/internal/db"
	"datacia/internal/logger"
	"datacia/internal/paths"
	"datacia/internal/update"
	"datacia/pkg/clickhouse"
	"datacia/pkg/common"
	"datacia/pkg/mysql"
	"datacia/pkg/postgres"
	"datacia/pkg/sqlite"
	"datacia/pkg/ssh"
	"errors"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ConnectionChangedEvent fires, without data, when the active connection is replaced.
const ConnectionChangedEvent = "connection-changed"

func init() {
	application.RegisterEvent[application.Void](ConnectionChangedEvent)
}

type UIController interface {
	OpenEditor()
	CloseEditor()
	OpenConnectionWindow()
	OpenSettingsWindow(tab string)
	RestartForUpdate() error
}

type Engine struct {
	store        *db.Store
	uiController UIController
	wailsApp     *application.App

	// mu guards activeClient and sshTunnel: Wails runs bound methods
	// concurrently (queries, health checks, AI tools, connect and close).
	mu           sync.Mutex
	activeClient DatabaseClient
	sshTunnel    *ssh.Tunnel
}

func New(wailsApp *application.App, uiController UIController, store *db.Store) *Engine {
	return &Engine{
		store:        store,
		uiController: uiController,
		wailsApp:     wailsApp,
	}
}

// ServiceShutdown runs when the app quits and releases the connection, its SSH
// tunnel and the local store. It is a Wails lifecycle hook, so the UI can't call it.
func (e *Engine) ServiceShutdown() error {
	e.mu.Lock()
	client, tunnel := e.activeClient, e.sshTunnel
	e.activeClient, e.sshTunnel = nil, nil
	e.mu.Unlock()

	if client != nil {
		_ = client.Close()
	}
	if tunnel != nil {
		tunnel.Close()
	}
	return e.store.Close()
}

// PendingUpdateVersion returns the version of the update downloaded in the
// background and waiting for a restart, or "" if there is none.
func (e *Engine) PendingUpdateVersion() string {
	return update.ReadyVersion()
}

// RestartApp quits into the update staged by the background updater and
// relaunches the new version.
func (e *Engine) RestartApp() error {
	if err := e.uiController.RestartForUpdate(); err != nil {
		logger.Error("Failed to restart app", "error", err.Error())
		return errors.New("Failed to restart app")
	}
	return nil
}

// getDBClient creates a new database client instance based on the engine type
func getDBClient(engineType string) (DatabaseClient, error) {
	switch engineType {
	case "clickhouse":
		return clickhouse.New(), nil
	case "postgres":
		return postgres.New(), nil
	case "mysql":
		return mysql.New(), nil
	case "sqlite":
		return sqlite.New(), nil
	default:
		return nil, fmt.Errorf("unsupported engine type: %s", engineType)
	}
}

// Connect connects to a database, optionally through an SSH tunnel, makes it
// the active connection and opens the editor.
func (e *Engine) Connect(config common.ConnectionConfig) error {
	return e.connect(config, false)
}

// TestConnection connects like Connect and closes the connection straight
// away. It never touches the active connection, since the connection window
// can test while an editor is open.
func (e *Engine) TestConnection(config common.ConnectionConfig) error {
	return e.connect(config, true)
}

func (e *Engine) connect(config common.ConnectionConfig, test bool) error {
	logger.Info("db_connection_attempt",
		"engine", config.Engine,
		"ssh", fmt.Sprint(config.SSH.Enabled),
		"test", fmt.Sprint(test),
	)

	var tunnel *ssh.Tunnel
	if config.SSH.Enabled {
		// Without this check a missing SSH host would connect directly.
		if config.SSH.Host == "" {
			return errors.New("SSH host is required")
		}
		knownHostsPath, err := paths.GetKnownHostsPath()
		if err != nil {
			return fmt.Errorf("failed to resolve known hosts path: %w", err)
		}
		sshConfig := ssh.Config{
			Host:                config.SSH.Host,
			Port:                config.SSH.Port,
			Username:            config.SSH.Username,
			Password:            config.SSH.Password,
			KeyPath:             config.SSH.KeyPath,
			KnownHostsPath:      knownHostsPath,
			AcceptedFingerprint: config.SSH.AcceptedFingerprint,
		}
		if sshConfig.Port == "" {
			sshConfig.Port = "22"
		}

		tunnel, err = ssh.NewTunnel(sshConfig, config.Host, config.Port)
		if err != nil {
			// The UI recognizes this one by its fields, so it can't be wrapped.
			var unknown *ssh.HostKeyUnknownError
			if errors.As(err, &unknown) {
				return unknown
			}
			return fmt.Errorf("failed to establish SSH tunnel: %w", err)
		}
		config.Host = "127.0.0.1"
		if _, config.Port, err = net.SplitHostPort(tunnel.LocalAddr()); err != nil {
			tunnel.Close()
			return fmt.Errorf("failed to parse local tunnel address: %w", err)
		}
	}

	dbClient, err := connectClient(config)
	if test && err == nil {
		err = dbClient.Close()
	}
	if test || err != nil {
		if tunnel != nil {
			tunnel.Close()
		}
		return err
	}

	e.replaceConnection(dbClient, tunnel)
	e.openEditor()
	return nil
}

// connectErrorKind describes a connect error for logs without its text, which
// driver errors fill with the host, user and database.
func connectErrorKind(err error) string {
	var netErr net.Error
	switch {
	case errors.Is(err, context.Canceled):
		return "canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.As(err, &netErr):
		return "network"
	}
	return "other"
}

func connectClient(config common.ConnectionConfig) (DatabaseClient, error) {
	dbClient, err := getDBClient(config.Engine)
	if err != nil {
		logger.Warn("db_connection_client_create_failed", "engine", config.Engine, "error", err.Error())
		return nil, err
	}
	if err := dbClient.Connect(config); err != nil {
		logger.Warn("db_connection_failed", "engine", config.Engine, "kind", connectErrorKind(err))
		return nil, err
	}
	logger.Info("db_connection_success", "engine", config.Engine)
	return dbClient, nil
}

// replaceConnection makes client (and its tunnel) active, then closes the
// previous ones. The new connection is set up first so a failed connect
// leaves the current one working.
func (e *Engine) replaceConnection(client DatabaseClient, tunnel *ssh.Tunnel) {
	e.mu.Lock()
	oldClient, oldTunnel := e.activeClient, e.sshTunnel
	e.activeClient, e.sshTunnel = client, tunnel
	e.mu.Unlock()

	if oldClient != nil {
		_ = oldClient.Close()
	}
	if oldTunnel != nil {
		oldTunnel.Close()
	}
}

// client returns the active connection. Callers use the returned value rather
// than reading e.activeClient again, which another call may swap or clear.
func (e *Engine) client() (DatabaseClient, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.activeClient == nil {
		return nil, errors.New("no active database connection found")
	}
	// Otherwise queries on a dead tunnel fail with an opaque EOF.
	if e.sshTunnel != nil {
		if err := e.sshTunnel.Err(); err != nil {
			return nil, err
		}
	}
	return e.activeClient, nil
}

func (e *Engine) openEditor() {
	if e.uiController == nil {
		return
	}
	e.uiController.OpenEditor()
	e.wailsApp.Event.Emit(ConnectionChangedEvent, nil)
}

func (e *Engine) OpenConnectionWindow() {
	if e.uiController != nil {
		e.uiController.OpenConnectionWindow()
	}
}

func (e *Engine) OpenSettingsWindow(tab string) {
	if e.uiController != nil {
		e.uiController.OpenSettingsWindow(tab)
	}
}

// UpdateConnection saves config over the saved connection with config.ID.
func (e *Engine) UpdateConnection(config common.ConnectionConfig) error {
	return e.store.UpdateConnection(config)
}

// EstablishConnection connects with the saved connection id. acceptedFingerprint
// is the SSH host key fingerprint the user confirmed after an unknown-host error.
func (e *Engine) EstablishConnection(id, acceptedFingerprint string) error {
	config, err := e.store.LoadConnection(id)
	if errors.Is(err, db.ErrUnreadableSecret) {
		return errors.New("the saved password can't be decrypted on this device; edit the connection and enter it again")
	}
	if err != nil {
		return err
	}
	config.SSH.AcceptedFingerprint = acceptedFingerprint
	return e.Connect(config)
}

func (e *Engine) GetCurrentConnectionInfo() (map[string]string, error) {
	client, err := e.client()
	if err != nil {
		return nil, err
	}
	return client.GetConnectionInfo()
}

// ChangeDatabaseByName reconnects to another database on the same server. It
// reuses the active SSH tunnel: the client's host and port point at the
// tunnel's local end, and the tunnel's own credentials aren't kept.
func (e *Engine) ChangeDatabaseByName(database string) error {
	current, err := e.client()
	if err != nil {
		return err
	}

	connInfo, err := current.GetConnectionInfo()
	if err != nil {
		return err
	}
	// A SQLite connection is a file: its only database is "main", and the
	// name would otherwise be opened as a new file.
	if connInfo["engine"] == "sqlite" {
		return errors.New("a SQLite connection has only one database")
	}
	if database == connInfo["database"] {
		return nil
	}
	// GetConnectionInfo doesn't expose the password, so take it from the client.
	dbClient, err := connectClient(common.ConnectionConfig{
		Engine:   connInfo["engine"],
		Host:     connInfo["host"],
		Port:     connInfo["port"],
		Username: connInfo["username"],
		Password: current.GetPassword(),
		Database: database,
	})
	if err != nil {
		return err
	}

	// Install it only if nothing closed or replaced the connection meanwhile,
	// which would also have closed the tunnel it goes through.
	e.mu.Lock()
	if e.activeClient != current {
		e.mu.Unlock()
		_ = dbClient.Close()
		return errors.New("the connection changed while switching database")
	}
	e.activeClient = dbClient
	e.mu.Unlock()

	_ = current.Close()
	e.openEditor()
	return nil
}

func (e *Engine) CloseCurrentConnection(closeEditor bool) error {
	e.mu.Lock()
	client, tunnel := e.activeClient, e.sshTunnel
	e.activeClient, e.sshTunnel = nil, nil
	e.mu.Unlock()

	if client == nil {
		return errors.New("no active database connection found")
	}
	err := client.Close()
	if tunnel != nil {
		tunnel.Close()
	}

	if closeEditor && e.uiController != nil {
		e.uiController.CloseEditor()
	}

	return err
}

// SaveConnection saves config as a new connection named config.Name.
func (e *Engine) SaveConnection(config common.ConnectionConfig) error {
	return e.store.SaveConnection(config)
}

// LoadConnection returns a saved connection for editing. A password that
// can't be decrypted comes back empty so the user can enter it again.
func (e *Engine) LoadConnection(id string) (common.ConnectionConfig, error) {
	config, err := e.store.LoadConnection(id)
	if errors.Is(err, db.ErrUnreadableSecret) {
		return config, nil
	}
	return config, err
}

func (e *Engine) ListConnections() (map[string]common.ConnectionInfo, error) {
	return e.store.ListConnections()
}

func (e *Engine) DeleteConnection(id string) (bool, error) {
	return e.store.DeleteConnection(id)
}

func (e *Engine) ListDatabases() (common.DatabaseInfo, error) {
	client, err := e.client()
	if err != nil {
		return common.DatabaseInfo{}, err
	}
	return client.ListDatabases()
}

func (e *Engine) RunQuery(queryId, queryType, sql string) (common.QueryResult, error) {
	client, err := e.client()
	if err != nil {
		return common.QueryResult{}, err
	}

	start := time.Now()
	result, err := client.RunQuery(queryId, queryType, sql)
	duration := time.Since(start).Milliseconds()
	result.TimeElapsed = duration

	status := "success"
	var errorMessage string
	if err != nil {
		status = "error"
		errorMessage = err.Error()
	}

	engine := ""
	if connInfo, connErr := client.GetConnectionInfo(); connErr == nil {
		engine = connInfo["engine"]
	}

	// Save to history asynchronously ("" engine is stored so filter can skip when engine == "")
	go func(engine, sql string, duration int64, status string, errorMessage string) {
		saveErr := e.store.SaveQueryHistory(engine, sql, duration, status, errorMessage)
		if saveErr != nil {
			logger.Error("Failed to save query history", "error", saveErr.Error())
		}
	}(engine, sql, duration, status, errorMessage)

	return result, err
}

// ReadOnlyQuery runs a single read statement with writes blocked by the
// database. Unlike RunQuery it isn't saved to the history.
func (e *Engine) ReadOnlyQuery(ctx context.Context, sql string, maxRows int) (common.QueryResult, error) {
	client, err := e.client()
	if err != nil {
		return common.QueryResult{}, err
	}
	if err := common.CheckReadOnly(sql); err != nil {
		return common.QueryResult{}, err
	}
	start := time.Now()
	result, err := client.ReadOnlyQuery(ctx, sql, maxRows)
	result.TimeElapsed = time.Since(start).Milliseconds()
	return result, err
}

func (e *Engine) GetQueryHistory(limit int, search string, dateFrom string, dateTo string, status string, engine string) ([]db.QueryHistoryItem, error) {
	return e.store.GetQueryHistory(limit, search, dateFrom, dateTo, status, engine)
}

func (e *Engine) CancelQuery(queryId string) error {
	client, err := e.client()
	if err != nil {
		return err
	}
	return client.CancelQuery(queryId)
}

func (e *Engine) ListTables() ([]string, error) {
	client, err := e.client()
	if err != nil {
		return nil, err
	}
	return client.ListTables()
}

func (e *Engine) GetTableData(table string, limit, offset int, orderBy, orderDir string) (common.QueryResult, error) {
	client, err := e.client()
	if err != nil {
		return common.QueryResult{}, err
	}
	return client.GetTableData(table, limit, offset, orderBy, orderDir)
}

func (e *Engine) GetTableSchema(table string) (common.QueryResult, error) {
	client, err := e.client()
	if err != nil {
		return common.QueryResult{}, err
	}
	return client.GetTableSchema(table)
}

func (e *Engine) GetDDL(table string) (string, error) {
	client, err := e.client()
	if err != nil {
		return "", err
	}
	return client.GetDDL(table)
}

// checks the health of the current database connection by pinging the database and measuring latency
func (e *Engine) CheckConnectionHealth() (*float64, error) {
	client, err := e.client()
	if err != nil {
		return nil, err
	}

	start := time.Now()
	err = client.Ping()
	duration := time.Since(start)

	if err != nil {
		return nil, err
	}

	// Convert to float64 and divide by time.Millisecond (1,000,000)
	// This gives you the precise ms value as a decimal
	latencyMS := float64(duration) / float64(time.Millisecond)

	return &latencyMS, nil
}

// SelectSSHKeyFile opens a file dialog to select an SSH private key file
// Returns the selected file path, or an error if cancelled or failed
func (e *Engine) SelectSSHKeyFile() (string, error) {
	if e.wailsApp == nil {
		return "", errors.New("application instance not available")
	}

	dialog := e.wailsApp.Dialog.OpenFile()
	dialog.SetTitle("Select SSH Private Key")

	path, err := dialog.PromptForSingleSelection()
	if err != nil {
		return "", err
	}

	return path, nil
}

// SelectSQLiteFile opens a file dialog to select a SQLite database file
// Returns the selected file path, or an error if cancelled or failed
func (e *Engine) SelectSQLiteFile() (string, error) {
	if e.wailsApp == nil {
		return "", errors.New("application instance not available")
	}

	dialog := e.wailsApp.Dialog.OpenFile()
	dialog.SetTitle("Select SQLite Database File")
	dialog.AddFilter("SQLite Database", "*.sqlite;*.db;*.sqlite3")
	dialog.AddFilter("All Files", "*.*")

	path, err := dialog.PromptForSingleSelection()
	if err != nil {
		return "", err
	}

	return path, nil
}
