package db

import (
	"bytes"
	"errors"
	"path/filepath"
	"testing"
)

func TestLoadConnection(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.db")
	store, err := OpenFile(path, bytes.Repeat([]byte{1}, 32))
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveConnection("local", map[string]string{"engine": "postgres", "password": "secret"}); err != nil {
		t.Fatal(err)
	}
	conns, err := store.ListConnections()
	if err != nil || len(conns) != 1 {
		t.Fatalf("connections %v, err %v", conns, err)
	}
	var id string
	for id = range conns {
	}
	if config, err := store.LoadConnection(id); err != nil || config["password"] != "secret" {
		t.Fatalf("password %q, err %v", config["password"], err)
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
	if config["engine"] != "postgres" || config["password"] != "" {
		t.Fatalf("config %v, want the connection with an empty password", config)
	}
}
