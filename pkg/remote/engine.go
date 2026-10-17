package remote

import (
	"context"
	"datacia/internal/db"
	"datacia/internal/logger"
	"datacia/internal/security"
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

func New(uiController UIController) (*Engine, error) {
	// Get encryption key from security context (cached at startup)
	ctx, err := security.GetSecurityContext()
	if err != nil {
		return nil, fmt.Errorf("failed to get security context: %w", err)
	}

	encryptionKey := ctx.GetEncryptionKey()
	store, err := db.Open(encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	return &Engine{
		store:        store,
		uiController: uiController,
	}, nil
}

// SetApplication sets the Wails application instance for file dialogs
func (e *Engine) SetApplication(app *application.App) {
	e.wailsApp = app
}

func (e *Engine) GetStore() *db.Store {
	return e.store
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

func (e *Engine) CreateNewConnection(engine, host, port, username, password, database string, test bool) error {
	return e.CreateNewConnectionWithSSH(engine, host, port, username, password, database, "", "", "", "", "", "", test)
}

// CreateNewConnectionWithSSH connects to a database, optionally through an
// SSH tunnel. A test connection is closed straight away and never touches the
// active connection, since the connection window can test while an editor is
// open.
func (e *Engine) CreateNewConnectionWithSSH(engine, host, port, username, password, database string, useSSH, sshHost, sshPort, sshUsername, sshPassword, sshKeyPath string, test bool) error {
	logger.Info("db_connection_attempt",
		"engine", engine,
		"database", database,
		"ssh", fmt.Sprint(useSSH == "true"),
	)

	var tunnel *ssh.Tunnel
	if useSSH == "true" && sshHost != "" {
		sshConfig := ssh.Config{
			Host:     sshHost,
			Port:     sshPort,
			Username: sshUsername,
			Password: sshPassword,
			KeyPath:  sshKeyPath,
		}
		if sshConfig.Port == "" {
			sshConfig.Port = "22"
		}

		var err error
		tunnel, err = ssh.NewTunnel(sshConfig, host, port)
		if err != nil {
			return fmt.Errorf("failed to establish SSH tunnel: %w", err)
		}
		host = "127.0.0.1"
		if _, port, err = net.SplitHostPort(tunnel.LocalAddr()); err != nil {
			tunnel.Close()
			return fmt.Errorf("failed to parse local tunnel address: %w", err)
		}
	}

	dbClient, err := connectClient(engine, host, port, username, password, database, test)
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

func connectClient(engine, host, port, username, password, database string, test bool) (DatabaseClient, error) {
	dbClient, err := getDBClient(engine)
	if err != nil {
		logger.Warn("db_connection_client_create_failed", "engine", engine, "error", err.Error())
		return nil, err
	}
	if err := dbClient.Connect(host, port, username, password, database, test); err != nil {
		logger.Warn("db_connection_failed", "engine", engine, "database", database, "error", err.Error())
		return nil, err
	}
	logger.Info("db_connection_success", "engine", engine, "database", database, "test_mode", fmt.Sprint(test))
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
	return e.activeClient, nil
}

func (e *Engine) openEditor() {
	if e.uiController == nil {
		return
	}
	e.uiController.OpenEditor()
	e.wailsApp.Event.Emit("connection-changed", nil)
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

func (e *Engine) UpdateConnection(id, name string, config map[string]string) error {
	return e.store.UpdateConnection(id, name, config)
}

func (e *Engine) EstablishConnection(id string) error {
	config, err := e.store.LoadConnection(id)
	if err != nil {
		return err
	}
	return e.CreateNewConnectionWithSSH(
		config["engine"],
		config["host"],
		config["port"],
		config["username"],
		config["password"],
		config["database"],
		config["useSSH"],
		config["sshHost"],
		config["sshPort"],
		config["sshUsername"],
		config["sshPassword"],
		config["sshKeyPath"],
		false,
	)
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
	// GetConnectionInfo doesn't expose the password, so take it from the client.
	dbClient, err := connectClient(connInfo["engine"], connInfo["host"], connInfo["port"], connInfo["username"], current.GetPassword(), database, false)
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

func (e *Engine) SaveConnection(name string, config map[string]string) error {
	return e.store.SaveConnection(name, config)
}

func (e *Engine) LoadConnection(id string) (map[string]string, error) {
	return e.store.LoadConnection(id)
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
