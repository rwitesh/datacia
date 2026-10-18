package remote

import (
	"bytes"
	"datacia/internal/db"
	"os"
	"path/filepath"
	"testing"
)

func TestConnectionLifecycle(t *testing.T) {
	first, second := newSQLiteFile(t), newSQLiteFile(t)
	e := &Engine{}

	if err := connectSQLite(e, first, false); err != nil {
		t.Fatal(err)
	}
	active, _ := e.client()
	if _, err := active.RunQuery("11111111-1111-1111-1111-111111111111", "command", "create table t (x int)"); err != nil {
		t.Fatal(err)
	}

	// The connection window can test a connection while the editor is open.
	if err := connectSQLite(e, second, true); err != nil {
		t.Fatal(err)
	}
	if client, _ := e.client(); client != active {
		t.Fatal("test connection replaced the active connection")
	}
	if tables, err := e.ListTables(); err != nil || len(tables) != 1 {
		t.Fatalf("after test connection: tables %v, err %v", tables, err)
	}

	if err := connectSQLite(e, second, false); err != nil {
		t.Fatal(err)
	}
	if tables, err := e.ListTables(); err != nil || len(tables) != 0 {
		t.Fatalf("after replacing the connection: tables %v, err %v", tables, err)
	}
	if err := active.Ping(); err == nil {
		t.Error("previous connection was not closed")
	}

	if err := e.CloseCurrentConnection(false); err != nil {
		t.Fatal(err)
	}
	if _, err := e.ListTables(); err == nil {
		t.Error("expected no active connection after close")
	}
}

func TestChangeDatabaseKeepsSQLiteFile(t *testing.T) {
	t.Chdir(t.TempDir())
	path := newSQLiteFile(t)
	e := &Engine{}
	if err := connectSQLite(e, path, false); err != nil {
		t.Fatal(err)
	}
	active, _ := e.client()

	// The database menu lists SQLite's only database as "main".
	if err := e.ChangeDatabaseByName("main"); err == nil {
		t.Error("switching a SQLite connection to \"main\" didn't fail")
	}
	if client, _ := e.client(); client != active {
		t.Fatal("switching to \"main\" replaced the SQLite connection")
	}
	if _, err := os.Stat("main"); err == nil {
		t.Fatal("switching to \"main\" created a database file named main")
	}
}

func TestSQLiteMissingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "typo.db")
	e := &Engine{}
	if err := connectSQLite(e, path, true); err == nil {
		t.Fatal("connected to a SQLite file that doesn't exist")
	}
	if _, err := os.Stat(path); err == nil {
		t.Fatal("testing the connection created the file")
	}
}

func TestSSHWithoutHost(t *testing.T) {
	e := &Engine{}
	err := e.CreateNewConnectionWithSSH("sqlite", "", "", "", "", newSQLiteFile(t), "true", "", "", "", "", "", true)
	if err == nil {
		t.Fatal("connected without the SSH tunnel that was asked for")
	}
}

// newSQLiteFile creates an empty database file.
func newSQLiteFile(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func connectSQLite(e *Engine, path string, test bool) error {
	return e.CreateNewConnectionWithSSH("sqlite", "", "", "", "", path, "", "", "", "", "", "", test)
}

func TestServiceShutdownReleasesEverything(t *testing.T) {
	store, err := db.OpenFile(filepath.Join(t.TempDir(), "data.db"), bytes.Repeat([]byte{1}, 32))
	if err != nil {
		t.Fatal(err)
	}
	e := &Engine{store: store}
	if err := connectSQLite(e, newSQLiteFile(t), false); err != nil {
		t.Fatal(err)
	}
	active, _ := e.client()

	if err := e.ServiceShutdown(); err != nil {
		t.Fatal(err)
	}
	if err := active.Ping(); err == nil {
		t.Error("connection was not closed")
	}
	if _, err := e.client(); err == nil {
		t.Error("expected no active connection after shutdown")
	}
	if _, err := store.ListConnections(); err == nil {
		t.Error("store was not closed")
	}
}
