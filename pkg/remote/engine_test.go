package remote

import (
	"path/filepath"
	"testing"
)

func TestConnectionLifecycle(t *testing.T) {
	dir := t.TempDir()
	first, second := filepath.Join(dir, "first.db"), filepath.Join(dir, "second.db")
	e := &Engine{}

	if err := e.CreateNewConnection("sqlite", "", "", "", "", first, false); err != nil {
		t.Fatal(err)
	}
	active, _ := e.client()
	if _, err := active.RunQuery("11111111-1111-1111-1111-111111111111", "command", "create table t (x int)"); err != nil {
		t.Fatal(err)
	}

	// The connection window can test a connection while the editor is open.
	if err := e.CreateNewConnection("sqlite", "", "", "", "", second, true); err != nil {
		t.Fatal(err)
	}
	if client, _ := e.client(); client != active {
		t.Fatal("test connection replaced the active connection")
	}
	if tables, err := e.ListTables(); err != nil || len(tables) != 1 {
		t.Fatalf("after test connection: tables %v, err %v", tables, err)
	}

	if err := e.ChangeDatabaseByName(second); err != nil {
		t.Fatal(err)
	}
	if tables, err := e.ListTables(); err != nil || len(tables) != 0 {
		t.Fatalf("after changing database: tables %v, err %v", tables, err)
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
