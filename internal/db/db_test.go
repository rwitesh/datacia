package db

import (
	"os"
	"testing"
)

func TestQueryHistory(t *testing.T) {
	// Use a temporary file for the database
	tmpFile, err := os.CreateTemp("", "test_db_*.db")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Initialize store with temp file
	store, err := OpenFile(tmpFile.Name(), []byte("test-key"))
	if err != nil {
		t.Fatalf("Failed to open db: %v", err)
	}
	defer store.Close()

	// Test SaveQueryHistory
	query := "SELECT * FROM users"
	err = store.SaveQueryHistory(query, 100, "success", 10, "")
	if err != nil {
		t.Fatalf("Failed to save query history: %v", err)
	}

	// Test GetQueryHistory
	history, err := store.GetQueryHistory(10)
	if err != nil {
		t.Fatalf("Failed to get query history: %v", err)
	}

	if len(history) != 1 {
		t.Errorf("Expected 1 history item, got %d", len(history))
	}

	if history[0].Query != query {
		t.Errorf("Expected query %s, got %s", query, history[0].Query)
	}

	if history[0].Status != "success" {
		t.Errorf("Expected status success, got %s", history[0].Status)
	}
}
