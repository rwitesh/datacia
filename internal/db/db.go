package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"datacia/internal/constants"
	"datacia/internal/security"
	"datacia/pkg/common"

	"github.com/adrg/xdg"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

type Store struct {
	db           *sql.DB
	encyptionKey []byte
}

// Open initializes SQLite at $XDG_DATA_HOME/<appName>/data.db and returns a Store
func Open(encryptionKey []byte) (*Store, error) {
	dbPath, err := xdg.DataFile(filepath.Join(constants.APP_NAME, "data.db"))
	if err != nil {
		return nil, fmt.Errorf("failed to resolve db path: %w", err)
	}
	return OpenFile(dbPath, encryptionKey)
}

// OpenFile initializes SQLite at the given path and returns a Store
func OpenFile(dbPath string, encryptionKey []byte) (*Store, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("failed to open db: %w", err)
	}

	if err = db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping db: %w", err)
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
		return nil, fmt.Errorf("failed to create connections table: %w", err)
	}

	// Schema: query_history
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS query_history (
			id TEXT PRIMARY KEY,
			query TEXT NOT NULL,
			timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			duration_ms INTEGER,
			status TEXT,
			error_message TEXT
		)
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to create query_history table: %w", err)
	}

	return &Store{db: db, encyptionKey: encryptionKey}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) SaveConnection(name string, config map[string]string) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}

	encrpytedData, err := security.Encrypt(s.encyptionKey, data)
	if err != nil {
		return fmt.Errorf("unable to encrypt credentials: %w", err)
	}

	id := uuid.New().String()

	_, err = s.db.Exec(`
		INSERT INTO connections (id, name, config, created_at, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, id, name, string(encrpytedData))
	return err
}

func (s *Store) UpdateConnection(id, name string, config map[string]string) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}

	encrpytedData, err := security.Encrypt(s.encyptionKey, data)
	if err != nil {
		return fmt.Errorf("unable to encrypt credentials: %w", err)
	}

	_, err = s.db.Exec(`
		UPDATE connections
		SET name = ?, config = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, name, string(encrpytedData), id)
	return err
}

func (s *Store) LoadConnection(id string) (map[string]string, error) {
	row := s.db.QueryRow(`SELECT name, config FROM connections WHERE id = ?`, id)

	var name string
	var encrypted string

	if err := row.Scan(&name, &encrypted); err != nil {
		if err == sql.ErrNoRows {
			return map[string]string{}, nil
		}
		return map[string]string{}, err
	}

	// Decrypt before parsing JSON
	plain, err := security.Decrypt(s.encyptionKey, []byte(encrypted))
	if err != nil {
		return map[string]string{}, fmt.Errorf("failed to decrypt config: %w", err)
	}

	var cfg map[string]string
	if err := json.Unmarshal(plain, &cfg); err != nil {
		return map[string]string{}, fmt.Errorf("failed to parse decrypted json: %w", err)
	}

	cfg["name"] = name
	return cfg, nil
}

func (s *Store) ListConnections() (map[string]common.ConnectionInfo, error) {
	rows, err := s.db.Query(`SELECT id, name, config FROM connections ORDER BY updated_at DESC`)
	if err != nil {
		return map[string]common.ConnectionInfo{}, err
	}
	defer rows.Close()

	connections := map[string]common.ConnectionInfo{}

	for rows.Next() {
		var id, name, encrypted string
		if err := rows.Scan(&id, &name, &encrypted); err != nil {
			return nil, err
		}

		// Decrypt
		plain, err := security.Decrypt(s.encyptionKey, []byte(encrypted))
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt config for id=%s: %w", id, err)
		}

		var cfg map[string]string
		if err := json.Unmarshal(plain, &cfg); err != nil {
			return nil, fmt.Errorf("failed to parse decrypted config for id=%s: %w", id, err)
		}

		engine := cfg["engine"]

		connections[id] = common.ConnectionInfo{
			Name:   name,
			Engine: engine,
		}
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

type QueryHistoryItem struct {
	ID           string `json:"id"`
	Query        string `json:"query"`
	Timestamp    string `json:"timestamp"`
	DurationMs   int64  `json:"duration_ms"`
	Status       string `json:"status"`
	ErrorMessage string `json:"error_message"`
	Count        int64  `json:"count"`
}

func (s *Store) SaveQueryHistory(query string, durationMs int64, status string, errorMessage string) error {
	id := uuid.New().String()
	_, err := s.db.Exec(`
		INSERT INTO query_history (id, query, duration_ms, status, error_message, timestamp)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, query, durationMs, status, errorMessage, time.Now().UTC().Format(time.RFC3339))
	return err
}

func (s *Store) GetQueryHistory(limit int, search string, dateFrom string, dateTo string) ([]QueryHistoryItem, error) {
	// Build dynamic query with optional filters
	query := `
		SELECT 
			id, 
			query, 
			MAX(timestamp) as timestamp, 
			duration_ms, 
			status, 
			error_message,
			COUNT(query) as count
		FROM query_history
	`
	args := []interface{}{}
	conditions := []string{}

	// Add search filter if provided
	if search != "" {
		conditions = append(conditions, "query LIKE ?")
		args = append(args, "%"+search+"%")
	}

	// Add date range filters if provided
	if dateFrom != "" {
		conditions = append(conditions, "timestamp >= ?")
		args = append(args, dateFrom)
	}
	if dateTo != "" {
		conditions = append(conditions, "timestamp <= ?")
		args = append(args, dateTo)
	}

	// Add WHERE clause only if there are conditions
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	query += `
		GROUP BY query
		ORDER BY timestamp DESC
		LIMIT ?
	`
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []QueryHistoryItem
	for rows.Next() {
		var item QueryHistoryItem
		var errorMessage sql.NullString
		if err := rows.Scan(&item.ID, &item.Query, &item.Timestamp, &item.DurationMs, &item.Status, &errorMessage, &item.Count); err != nil {
			return nil, err
		}
		if errorMessage.Valid {
			item.ErrorMessage = errorMessage.String
		}
		history = append(history, item)
	}
	return history, rows.Err()
}
