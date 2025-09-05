package remote

import (
	"layerbit/internal/db"
	"layerbit/pkg/clickhouse"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type Engine struct {
	App        *application.App
	store      *db.Store
	Connection *clickhouse.ClickHouse
}

func New(instance *application.App, db *db.Store, ch *clickhouse.ClickHouse) (*Engine, error) {
	return &Engine{App: instance, store: db, Connection: ch}, nil
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

func (e *Engine) Sync(activeTabId string, data string) {
	e.store.StoreTab(activeTabId, data)
}

func (e *Engine) GetTabs() (string, string, error) {
	return e.store.GetTabs()
}

func (e *Engine) CreateNewConnection(host, port, username, password, database string, test bool, openEditor bool) error {
	metadata, err := e.Connection.Connect(host, port, username, password, database, test)
	if err != nil {
		return err
	}
	if openEditor {
		e.OpenEditor()
	}
	e.App.Event.Emit("clickhouse:connected", metadata)
	return nil
}

func (e *Engine) EstablishConnection(name string) error {
	config, err := e.store.LoadConnection(name)
	if err != nil {
		return err
	}
	err = e.CreateNewConnection(
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

func (e *Engine) ChangeDatabase(host, port, username, password, database string) error {
	return e.CreateNewConnection(host, port, username, password, database, false, false)
}

func (e *Engine) CloseCurrentConnection() error {
	err := e.Connection.Close()
	if err != nil {
		return err
	}
	e.CloseEditor()
	return nil
}

func (e *Engine) SaveConnection(name string, config map[string]string) error {
	return e.store.SaveConnection(name, config)
}

func (e *Engine) LoadConnection(name string) (map[string]string, error) {
	return e.store.LoadConnection(name)
}

func (e *Engine) ListConnections() ([]string, error) {
	return e.store.ListConnections()
}

func (e *Engine) DeleteConnection(name string) (bool, error) {
	return e.store.DeleteConnection(name)
}
