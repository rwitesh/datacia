package db

import (
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
)

// The sample database bundled with the app: a plain SQLite file, replaced
// wholesale whenever we want different sample data.
//
//go:embed sample.db
var sampleDB []byte

// SeedSampleData gives a first-time user something to explore: when no
// connection has ever been saved it copies the bundled sample.db into the
// app data folder and saves a connection to it. The copy is never touched
// again, so the user can replace it with their own database file at any
// time, and a connection the user deleted is not re-added.
func SeedSampleData(s *Store, samplePath string) error {
	connections, err := s.ListConnections()
	if err != nil {
		return fmt.Errorf("failed to list connections: %w", err)
	}
	if len(connections) > 0 {
		return nil
	}
	if _, err := os.Stat(samplePath); err == nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(samplePath), 0755); err != nil {
		return fmt.Errorf("failed to create the sample database directory: %w", err)
	}
	if err := os.WriteFile(samplePath, sampleDB, 0644); err != nil {
		return fmt.Errorf("failed to copy the sample database: %w", err)
	}
	return s.SaveConnection("Demo", map[string]string{
		"engine":   "sqlite",
		"database": samplePath,
	})
}
