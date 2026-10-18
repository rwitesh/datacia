package db

import (
	"bytes"
	"errors"
	"path/filepath"
	"testing"

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
