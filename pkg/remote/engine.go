package remote

import (
	"layerbits/internal/db"
	"layerbits/pkg/clickhouse"
	"layerbits/pkg/postgres"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type Engine struct {
	App        *application.App
	store      *db.Store
	ClickHouse *clickhouse.ClickHouse
	Postgres   *postgres.Postgres
}

func New(instance *application.App, db *db.Store, ch *clickhouse.ClickHouse, pg *postgres.Postgres) (*Engine, error) {
	return &Engine{App: instance, store: db, ClickHouse: ch, Postgres: pg}, nil
}

func (e *Engine) OpenEditor() {
	editor, ok := e.App.Window.GetByName("editor")
	if ok {
		editor.Show()
	}
	win, exists := e.App.Window.GetByName("connection")
	if exists {
		win.Hide()
	}
	// e.App.Window.Current().SetURL("#/editor").SetSize(1024, 768).Center()
}

func (e *Engine) CloseEditor() {
	editor, ok := e.App.Window.GetByName("editor")
	if ok {
		editor.Hide()
	}
	win, exists := e.App.Window.GetByName("connection")
	if exists {
		win.Show()
	}
	// e.App.Window.Current().SetURL("/").SetSize(650, 450).Center()
}

func (e *Engine) CreateNewConnection(engine, host, port, username, password, database string, test bool, openEditor bool) error {
	var eventName = "database:connected"
	if engine == "clickhouse" {
		metadata, err := e.ClickHouse.Connect(host, port, username, password, database, test)
		if err != nil {
			return err
		}
		if openEditor {
			e.OpenEditor()
		}
		e.App.Event.Emit(eventName, metadata)
		return nil
	} else if engine == "postgres" {
		metadata, err := e.Postgres.Connect(host, port, username, password, database, test)
		if err != nil {
			return err
		}
		if openEditor {
			e.OpenEditor()
		}
		e.App.Event.Emit(eventName, metadata)
		return nil
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
		true,
	)
	if err != nil {
		return err
	}
	return nil
}

func (e *Engine) ChangeDatabase(engine, host, port, username, password, database string) error {
	return e.CreateNewConnection(engine, host, port, username, password, database, false, false)
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
	e.CloseEditor()
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
