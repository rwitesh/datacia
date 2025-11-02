package remote

import (
	"errors"
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
	ClickHouse   *clickhouse.ClickHouse
	Postgres     *postgres.Postgres
	uiController UIController
}

func New(uiController UIController) (*Engine, error) {
	store := db.Open("layerbits")
	chService := clickhouse.New()
	postgresService := postgres.New()

	return &Engine{
		store:        store,
		ClickHouse:   chService,
		Postgres:     postgresService,
		uiController: uiController,
	}, nil
}

func (e *Engine) CreateNewConnection(engine, host, port, username, password, database string, test bool) error {
	switch engine {
	case "clickhouse":
		err := e.ClickHouse.Connect(host, port, username, password, database, test)
		if err != nil {
			return err
		}

		if e.uiController != nil {
			e.uiController.OpenEditor()
		}
		return nil
	case "postgres":
		err := e.Postgres.Connect(host, port, username, password, database, test)
		if err != nil {
			return err
		}

		if e.uiController != nil {
			e.uiController.OpenEditor()
		}
		return nil
	default:
		return nil
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
	if e.ClickHouse != nil {
		if info, err := e.ClickHouse.GetConnectionInfo(); err == nil {
			return info, nil
		}
	}

	if e.Postgres != nil {
		if info, err := e.Postgres.GetConnectionInfo(); err == nil {
			return info, nil
		}
	}

	return nil, errors.New("no active connection found")
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
	err := e.ClickHouse.Close()
	if err != nil {
		return err
	}
	err = e.Postgres.Close()
	if err != nil {
		return err
	}
	// Trigger UI to close editor when connection is closed
	if e.uiController != nil {
		e.uiController.CloseEditor()
	}
	return nil
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
	if e.ClickHouse != nil {
		if info, err := e.ClickHouse.GetConnectionInfo(); err == nil && info["engine"] == "clickhouse" {
			return e.ClickHouse.ListDatabases()
		}
	}

	if e.Postgres != nil {
		if info, err := e.Postgres.GetConnectionInfo(); err == nil && info["engine"] == "postgres" {
			return e.Postgres.ListDatabases()
		}
	}

	return nil, errors.New("no active database connection found")
}

func (e *Engine) RunQuery(queryId, queryType, sql string) (common.QueryResult, error) {
	if e.ClickHouse != nil {
		if info, err := e.ClickHouse.GetConnectionInfo(); err == nil && info["engine"] == "clickhouse" {
			return e.ClickHouse.RunQuery(queryId, queryType, sql)
		}
	}

	if e.Postgres != nil {
		if info, err := e.Postgres.GetConnectionInfo(); err == nil && info["engine"] == "postgres" {
			return e.Postgres.RunQuery(queryId, queryType, sql)
		}
	}

	return common.QueryResult{}, errors.New("no active database connection found")
}

func (e *Engine) CancelQuery(queryId string) error {
	if e.ClickHouse != nil {
		if info, err := e.ClickHouse.GetConnectionInfo(); err == nil && info["engine"] == "clickhouse" {
			return e.ClickHouse.CancelQuery(queryId)
		}
	}

	if e.Postgres != nil {
		if info, err := e.Postgres.GetConnectionInfo(); err == nil && info["engine"] == "postgres" {
			return e.Postgres.CancelQuery(queryId)
		}
	}

	return errors.New("no active database connection found")
}

func (e *Engine) ListTables() ([]string, error) {
	if e.ClickHouse != nil {
		if info, err := e.ClickHouse.GetConnectionInfo(); err == nil && info["engine"] == "clickhouse" {
			return e.ClickHouse.ListTables()
		}
	}

	if e.Postgres != nil {
		if info, err := e.Postgres.GetConnectionInfo(); err == nil && info["engine"] == "postgres" {
			return e.Postgres.ListTables()
		}
	}

	return nil, errors.New("no active database connection found")
}
