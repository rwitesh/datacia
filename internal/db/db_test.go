package db

import (
	"bytes"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"datacia/pkg/common"
)

func TestLoadConnection(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.db")
	store, err := OpenFile(path, bytes.Repeat([]byte{1}, 32))
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveConnection(common.ConnectionConfig{Name: "local", Engine: "postgres", Password: "secret"}); err != nil {
		t.Fatal(err)
	}
	conns, err := store.ListConnections()
	if err != nil || len(conns) != 1 {
		t.Fatalf("connections %v, err %v", conns, err)
	}
	var id string
	for id = range conns {
	}
	if config, err := store.LoadConnection(id); err != nil || config.Password != "secret" {
		t.Fatalf("password %q, err %v", config.Password, err)
	}
	if _, err := store.LoadConnection("missing"); err == nil {
		t.Error("loading a missing connection didn't fail")
	}
	store.Close()

	// A different key, as after the device ID changes.
	store, err = OpenFile(path, bytes.Repeat([]byte{2}, 32))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	config, err := store.LoadConnection(id)
	if !errors.Is(err, ErrUnreadableSecret) {
		t.Fatalf("err %v, want ErrUnreadableSecret", err)
	}
	if config.Engine != "postgres" || config.Password != "" {
		t.Fatalf("config %+v, want the connection with an empty password", config)
	}
}

func TestSaveAndUpdateConnection(t *testing.T) {
	store, err := OpenFile(filepath.Join(t.TempDir(), "data.db"), bytes.Repeat([]byte{1}, 32))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	config := common.ConnectionConfig{
		Name: "first", Engine: "mysql", Host: "db", Port: "3306", Username: "root", Password: "pw", Database: "app",
		SSLMode: common.SSLModeVerifyFull, SSLCAPath: "/certs/ca.pem",
		SSH: common.SSHConfig{Enabled: true, Host: "bastion", Port: "22", Username: "ops", Password: "sshpw"},
	}
	if err := store.SaveConnection(config); err != nil {
		t.Fatal(err)
	}
	conns, err := store.ListConnections()
	if err != nil || len(conns) != 1 {
		t.Fatalf("connections %v, err %v", conns, err)
	}
	var id string
	for id = range conns {
	}
	config.ID = id

	got, err := store.LoadConnection(id)
	if err != nil {
		t.Fatal(err)
	}
	if got != config {
		t.Fatalf("loaded %+v, want %+v", got, config)
	}

	config.Name, config.Host = "renamed", "db2"
	config.SSH = common.SSHConfig{Host: "bastion", Port: "2222", Username: "ops", KeyPath: "/keys/id"}
	if err := store.UpdateConnection(config); err != nil {
		t.Fatal(err)
	}
	got, err = store.LoadConnection(id)
	if err != nil {
		t.Fatal(err)
	}
	if got != config {
		t.Fatalf("updated %+v, want %+v", got, config)
	}
}

// TestOpenOldDatabase opens a data.db whose connections table predates the
// SSL columns: the saved connection must keep loading, as automatic.
func TestOpenOldDatabase(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.db")
	old, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	_, err = old.Exec(`
		CREATE TABLE connections (
			id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, engine TEXT NOT NULL,
			host TEXT, port TEXT, username TEXT, password TEXT, database TEXT,
			use_ssh INTEGER DEFAULT 0, ssh_host TEXT, ssh_port TEXT, ssh_username TEXT, ssh_password TEXT,
			use_ssh_key INTEGER DEFAULT 0, ssh_key_path TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		INSERT INTO connections (id, name, engine, host, port, username, password, database, ssh_host, ssh_port, ssh_username, ssh_password, ssh_key_path)
		VALUES ('old', 'legacy', 'mysql', 'db', '3306', 'root', '', 'app', '', '', '', '', '')`)
	if err != nil {
		t.Fatal(err)
	}
	old.Close()

	// Opening twice also checks that the columns are only added once.
	for i := range 2 {
		store, err := OpenFile(path, bytes.Repeat([]byte{1}, 32))
		if err != nil {
			t.Fatal(err)
		}
		config, err := store.LoadConnection("old")
		if err != nil {
			t.Fatal(err)
		}
		want := common.SSLModeAutomatic
		if i == 1 {
			want = common.SSLModeRequire // saved on the first pass
		}
		if config.Host != "db" || config.SSLMode != want {
			t.Fatalf("pass %d loaded %+v, want the old connection with SSL mode %q", i, config, want)
		}
		if i == 0 {
			config.SSLMode = common.SSLModeRequire
			if err := store.UpdateConnection(config); err != nil {
				t.Fatal(err)
			}
		}
		store.Close()
	}
}

func TestChats(t *testing.T) {
	store, err := OpenFile(filepath.Join(t.TempDir(), "data.db"), bytes.Repeat([]byte{1}, 32))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	for _, c := range []struct{ id, title string }{{"a", "first"}, {"b", "second"}, {"a", "first, renamed"}} {
		if err := store.SaveChat(c.id, c.title, `[]`); err != nil {
			t.Fatal(err)
		}
		time.Sleep(2 * time.Millisecond) // updated_at has millisecond precision
	}
	chats, err := store.ListChats()
	if err != nil {
		t.Fatal(err)
	}
	// Saving "a" again replaces it and moves it to the top.
	if len(chats) != 2 || chats[0].ID != "a" || chats[0].Title != "first, renamed" || chats[1].ID != "b" {
		t.Fatalf("chats %+v", chats)
	}

	if err := store.DeleteChat("a"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := store.LoadChat("a"); !errors.Is(err, ErrChatNotFound) {
		t.Errorf("loading a deleted chat: %v", err)
	}
	if title, _, err := store.LoadChat("b"); err != nil || title != "second" {
		t.Errorf("title %q, err %v", title, err)
	}
}
