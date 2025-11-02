package remote

import (
	"errors"
	"fmt"
	"layerbits/internal/db"
	"layerbits/pkg/clickhouse"
	"layerbits/pkg/common"
	"layerbits/pkg/postgres"
)

type UIController interface {
	OpenEditor()
	CloseEditor()
}

type Engine struct {
	store        *db.Store
	activeClient DatabaseClient
	uiController UIController
}

func New(uiController UIController) (*Engine, error) {
	store := db.Open("layerbits")

	return &Engine{
		store:        store,
		uiController: uiController,
	}, nil
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
	dbClient, err := getDBClient(engine)
	if err != nil {
		return err
	}

	if err := dbClient.Connect(host, port, username, password, database, test); err != nil {
		return err
	}

	e.activeClient = dbClient

	if e.uiController != nil {
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
	err = e.CreateNewConnection(
		config["engine"],
		config["host"],
		config["port"],
		config["username"],
		config["password"],
		config["database"],
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

func (e *Engine) ListConnections() (map[string]string, error) {
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
