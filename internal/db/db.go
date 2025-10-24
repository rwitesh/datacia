package db

import (
	"database/sql"
	"encoding/json"
	"log"
	"path/filepath"

	"github.com/adrg/xdg"
	"github.com/google/uuid"
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

	if err = db.Ping(); err != nil {
		log.Fatalf("failed to ping db: %v", err)
	}

	// Schema: connections
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS connections (
			id TEXT PRIMARY KEY, 
			name TEXT NOT NULL UNIQUE,
			config TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

func (s *Store) SaveConnection(name string, config map[string]string) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}

	id := uuid.New().String()

	_, err = s.db.Exec(`
		INSERT INTO connections (id, name, config, created_at, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, id, name, string(data))
	return err
}

func (s *Store) UpdateConnection(id, name string, config map[string]string) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`
		UPDATE connections
		SET name = ?, config = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, name, string(data), id)
	return err
}

func (s *Store) LoadConnection(id string) (map[string]string, error) {
	row := s.db.QueryRow(`SELECT name, config FROM connections WHERE id = ?`, id)

	var name, raw string
	if err := row.Scan(&name, &raw); err != nil {
		if err == sql.ErrNoRows {
			return map[string]string{}, nil
		}
		return map[string]string{}, err
	}

	var cfg map[string]string
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return map[string]string{}, err
	}
	cfg["name"] = name
	return cfg, nil
}

func (s *Store) ListConnections() (map[string]string, error) {
	rows, err := s.db.Query(`SELECT id, name FROM connections ORDER BY updated_at DESC`)
	if err != nil {
		return map[string]string{}, err
	}
	defer rows.Close()

	var connections = map[string]string{}
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			return map[string]string{}, err
		}
		connections[id] = name
	}
	return connections, rows.Err()
}

func (s *Store) DeleteConnection(id string) (bool, error) {
	result, err := s.db.Exec(`DELETE FROM connections WHERE id = ?`, id)
	if err != nil {
		return false, err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}
