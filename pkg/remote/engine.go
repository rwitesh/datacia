package remote

import (
	"errors"
	"fmt"
	"layerbits/internal/db"
	"layerbits/pkg/clickhouse"
	"layerbits/pkg/common"
	"layerbits/pkg/postgres"
	"layerbits/pkg/ssh"
	"net"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type UIController interface {
	OpenEditor()
	CloseEditor()
}

type Engine struct {
	store        *db.Store
	activeClient DatabaseClient
	uiController UIController
	sshTunnel    *ssh.Tunnel
	wailsApp     *application.App
}

func New(uiController UIController) (*Engine, error) {
	store := db.Open("layerbits")

	return &Engine{
		store:        store,
		uiController: uiController,
	}, nil
}

// SetApplication sets the Wails application instance for file dialogs
func (e *Engine) SetApplication(app *application.App) {
	e.wailsApp = app
}

// getDBClient creates a new database client instance based on the engine type
func getDBClient(engineType string) (DatabaseClient, error) {
	switch engineType {
	case "clickhouse":
		return clickhouse.New(), nil
	case "postgres":
		return postgres.New(), nil
	default:
		return nil, fmt.Errorf("unsupported engine type: %s", engineType)
	}
}

func (e *Engine) CreateNewConnection(engine, host, port, username, password, database string, test bool) error {
	return e.CreateNewConnectionWithSSH(engine, host, port, username, password, database, "", "", "", "", "", "", test)
}

func (e *Engine) CreateNewConnectionWithSSH(engine, host, port, username, password, database string, useSSH, sshHost, sshPort, sshUsername, sshPassword, sshKeyPath string, test bool) error {
	// Close existing SSH tunnel if any
	if e.sshTunnel != nil {
		e.sshTunnel.Close()
		e.sshTunnel = nil
	}

	actualHost := host
	actualPort := port

	// Set up SSH tunnel if requested
	if useSSH == "true" && sshHost != "" {
		sshConfig := ssh.Config{
			Host:     sshHost,
			Port:     sshPort,
			Username: sshUsername,
			Password: sshPassword,
			KeyPath:  sshKeyPath,
		}

		// Default SSH port if not provided
		if sshConfig.Port == "" {
			sshConfig.Port = "22"
		}

		tunnel, err := ssh.NewTunnel(sshConfig, host, port)
		if err != nil {
			return fmt.Errorf("failed to establish SSH tunnel: %w", err)
		}

		e.sshTunnel = tunnel
		// Connect through the tunnel using local address
		actualHost = "127.0.0.1"
		localAddr := tunnel.LocalAddr()
		// Extract port from address (format: "127.0.0.1:port")
		if _, portStr, err := net.SplitHostPort(localAddr); err == nil {
			actualPort = portStr
		} else {
			return fmt.Errorf("failed to parse local tunnel address: %w", err)
		}
	}

	dbClient, err := getDBClient(engine)
	if err != nil {
		if e.sshTunnel != nil {
			e.sshTunnel.Close()
			e.sshTunnel = nil
		}
		return err
	}

	if err := dbClient.Connect(actualHost, actualPort, username, password, database, test); err != nil {
		if e.sshTunnel != nil {
			e.sshTunnel.Close()
			e.sshTunnel = nil
		}
		return err
	}

	e.activeClient = dbClient

	if !test && e.uiController != nil {
		e.uiController.OpenEditor()
	}

	return nil
}
func (e *Engine) UpdateConnection(id, name string, config map[string]string) error {
	return e.store.UpdateConnection(id, name, config)
}

func (e *Engine) EstablishConnection(id string) error {
	config, err := e.store.LoadConnection(id)
	if err != nil {
		return err
	}

	// Extract SSH parameters if present
	useSSH := config["useSSH"]
	sshHost := config["sshHost"]
	sshPort := config["sshPort"]
	sshUsername := config["sshUsername"]
	sshPassword := config["sshPassword"]
	sshKeyPath := config["sshKeyPath"]

	err = e.CreateNewConnectionWithSSH(
		config["engine"],
		config["host"],
		config["port"],
		config["username"],
		config["password"],
		config["database"],
		useSSH,
		sshHost,
		sshPort,
		sshUsername,
		sshPassword,
		sshKeyPath,
		false,
	)
	if err != nil {
		return err
	}
	return nil
}

func (e *Engine) ChangeDatabase(engine, host, port, username, password, database string) error {
	return e.CreateNewConnection(engine, host, port, username, password, database, false)
}

func (e *Engine) GetCurrentConnectionInfo() (map[string]string, error) {
	if e.activeClient == nil {
		return nil, errors.New("no active connection found")
	}
	return e.activeClient.GetConnectionInfo()
}

func (e *Engine) ChangeDatabaseByName(database string) error {
	connInfo, err := e.GetCurrentConnectionInfo()
	if err != nil {
		return err
	}

	return e.ChangeDatabase(
		connInfo["engine"],
		connInfo["host"],
		connInfo["port"],
		connInfo["username"],
		connInfo["password"],
		database,
	)
}

func (e *Engine) CloseCurrentConnection() error {
	if e.activeClient == nil {
		return errors.New("no active database connection found")
	}

	err := e.activeClient.Close()
	e.activeClient = nil

	// Close SSH tunnel if exists
	if e.sshTunnel != nil {
		e.sshTunnel.Close()
		e.sshTunnel = nil
	}

	if e.uiController != nil {
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

func (e *Engine) ListDatabases() (interface{}, error) {
	if e.activeClient == nil {
		return nil, errors.New("no active database connection found")
	}
	result, err := e.activeClient.ListDatabases()
	return result, err
}

func (e *Engine) RunQuery(queryId, queryType, sql string) (common.QueryResult, error) {
	if e.activeClient == nil {
		return common.QueryResult{}, errors.New("no active database connection found")
	}
	return e.activeClient.RunQuery(queryId, queryType, sql)
}

func (e *Engine) CancelQuery(queryId string) error {
	if e.activeClient == nil {
		return errors.New("no active database connection found")
	}
	return e.activeClient.CancelQuery(queryId)
}

func (e *Engine) ListTables() ([]string, error) {
	if e.activeClient == nil {
		return nil, errors.New("no active database connection found")
	}
	return e.activeClient.ListTables()
}

// SelectSSHKeyFile opens a file dialog to select an SSH private key file
// Returns the selected file path, or an error if cancelled or failed
func (e *Engine) SelectSSHKeyFile() (string, error) {
	if e.wailsApp == nil {
		return "", errors.New("application instance not available")
	}

	dialog := application.OpenFileDialog()
	dialog.SetTitle("Select SSH Private Key")

	path, err := dialog.PromptForSingleSelection()
	if err != nil {
		return "", err
	}

	return path, nil
}
