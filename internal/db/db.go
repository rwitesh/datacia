package db

import (
	"database/sql"
	"encoding/json"
	"log"
	"path/filepath"

	"github.com/adrg/xdg"
	_ "github.com/mattn/go-sqlite3"
)

type Store struct {
	db *sql.DB
}

// Open initializes SQLite at $XDG_DATA_HOME/<appName>/data.db and returns a Store
func Open(appName string) *Store {
	dbPath, err := xdg.DataFile(filepath.Join(appName, "data.db"))
	if err != nil {
		log.Fatalf("failed to resolve db path: %v", err)
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}

	if err := db.Ping(); err != nil {
		log.Fatalf("failed to ping db: %v", err)
	}

	// Schema: tabs
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS tabs (
			id TEXT PRIMARY KEY,
			content TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		log.Fatalf("failed to create tabs table: %v", err)
	}

	// Schema: connections
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS connections (
			name TEXT PRIMARY KEY,
			config TEXT NOT NULL,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		log.Fatalf("failed to create connections table: %v", err)
	}
	return &Store{db: db}
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) StoreTab(tabID string, content string) error {
	_, err := s.db.Exec(`
		INSERT INTO tabs (id, content, created_at, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO UPDATE SET
			content = excluded.content,
			updated_at = CURRENT_TIMESTAMP
	`, tabID, content)
	return err
}

func (s *Store) GetTabs() (string, string, error) {
	row := s.db.QueryRow(`
		SELECT id, content
		FROM tabs
		ORDER BY updated_at DESC
		LIMIT 1
	`)

	var id, content string
	if err := row.Scan(&id, &content); err != nil {
		if err == sql.ErrNoRows {
			return "", "", nil
		}
		return "", "", err
	}
	return id, content, nil
}

func (s *Store) SaveConnection(name string, config map[string]string) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`
		INSERT INTO connections (name, config, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(name) DO UPDATE SET
			config = excluded.config,
			updated_at = CURRENT_TIMESTAMP
	`, name, string(data))
	return err
}

func (s *Store) LoadConnection(name string) (map[string]string, error) {
	row := s.db.QueryRow(`SELECT config FROM connections WHERE name = ?`, name)
	var raw string
	if err := row.Scan(&raw); err != nil {
		if err == sql.ErrNoRows {
			return map[string]string{}, nil
		}
		return nil, err
	}

	var cfg map[string]string
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (s *Store) ListConnections() ([]string, error) {
	rows, err := s.db.Query(`SELECT name FROM connections ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

func (s *Store) DeleteConnection(name string) (bool, error) {
	result, err := s.db.Exec(`DELETE FROM connections WHERE name = ?`, name)
	if err != nil {
		return false, err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}

	return affected > 0, nil
}
