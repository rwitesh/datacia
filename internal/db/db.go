package db

import (
	"database/sql"
	"encoding/base64"
	"fmt"
	"os"
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
	// Ensure the parent directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	// Create the database file if it doesn't exist
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		file, err := os.Create(dbPath)
		if err != nil {
			return nil, fmt.Errorf("failed to create database file: %w", err)
		}
		file.Close()
	}

	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("failed to open db: %w", err)
	}

	if err = db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping db: %w", err)
	}

	s := &Store{db: db, encyptionKey: encryptionKey}

	if err := s.initSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) initSchema() error {
	schema := []string{
		`CREATE TABLE IF NOT EXISTS connections (
			id TEXT PRIMARY KEY, 
			name TEXT NOT NULL UNIQUE,
			engine TEXT NOT NULL,
			host TEXT,
			port TEXT,
			username TEXT,
			password TEXT,
			database TEXT,
			use_ssh INTEGER DEFAULT 0,
			ssh_host TEXT,
			ssh_port TEXT,
			ssh_username TEXT,
			ssh_password TEXT,
			use_ssh_key INTEGER DEFAULT 0,
			ssh_key_path TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_connections_name ON connections(name)`,
		`CREATE TABLE IF NOT EXISTS query_history (
			id TEXT PRIMARY KEY,
			query TEXT NOT NULL,
			timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			duration_ms INTEGER,
			status TEXT,
			error_message TEXT
		)`,
	}

	for _, stmt := range schema {
		if _, err := s.db.Exec(stmt); err != nil {
			return fmt.Errorf("failed to execute schema statement: %w", err)
		}
	}

	return nil
}

func (s *Store) encryptField(value string) (string, error) {
	if value == "" {
		return "", nil
	}
	encrypted, err := security.Encrypt(s.encyptionKey, []byte(value))
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(encrypted), nil
}

func (s *Store) decryptField(value string) (string, error) {
	if value == "" {
		return "", nil
	}
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	decrypted, err := security.Decrypt(s.encyptionKey, decoded)
	if err != nil {
		return "", err
	}
	return string(decrypted), nil
}

func (s *Store) SaveConnection(name string, config map[string]string) error {
	id := uuid.New().String()

	encPassword, err := s.encryptField(config["password"])
	if err != nil {
		return err
	}
	encSSHPassword, err := s.encryptField(config["sshPassword"])
	if err != nil {
		return err
	}

	useSSH := 0
	if config["useSSH"] == "true" {
		useSSH = 1
	}
	useSSHKey := 0
	if config["useSSHKey"] == "true" {
		useSSHKey = 1
	}

	query := `
		INSERT INTO connections (
			id, name, engine, host, port, username, password, database, 
			use_ssh, ssh_host, ssh_port, ssh_username, ssh_password, 
			use_ssh_key, ssh_key_path, created_at, updated_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`

	_, err = s.db.Exec(query,
		id, name, config["engine"], config["host"], config["port"], config["username"], encPassword, config["database"],
		useSSH, config["sshHost"], config["sshPort"], config["sshUsername"], encSSHPassword,
		useSSHKey, config["sshKeyPath"],
	)
	return err
}

func (s *Store) UpdateConnection(id, name string, config map[string]string) error {
	encPassword, err := s.encryptField(config["password"])
	if err != nil {
		return err
	}
	encSSHPassword, err := s.encryptField(config["sshPassword"])
	if err != nil {
		return err
	}

	useSSH := 0
	if config["useSSH"] == "true" {
		useSSH = 1
	}
	useSSHKey := 0
	if config["useSSHKey"] == "true" {
		useSSHKey = 1
	}

	// Update columns
	query := `
		UPDATE connections
		SET name = ?,
			engine = ?, host = ?, port = ?, username = ?, password = ?, database = ?,
			use_ssh = ?, ssh_host = ?, ssh_port = ?, ssh_username = ?, ssh_password = ?,
			use_ssh_key = ?, ssh_key_path = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`

	_, err = s.db.Exec(query,
		name,
		config["engine"], config["host"], config["port"], config["username"], encPassword, config["database"],
		useSSH, config["sshHost"], config["sshPort"], config["sshUsername"], encSSHPassword,
		useSSHKey, config["sshKeyPath"],
		id,
	)
	return err
}

func (s *Store) LoadConnection(id string) (map[string]string, error) {
	query := `
		SELECT 
			name, engine, host, port, username, password, database,
			use_ssh, ssh_host, ssh_port, ssh_username, ssh_password,
			use_ssh_key, ssh_key_path
		FROM connections WHERE id = ?
	`
	row := s.db.QueryRow(query, id)

	var name, engine, host, port, username, encPassword, database string
	var useSSH int
	var sshHost, sshPort, sshUsername, encSSHPassword string
	var useSSHKey int
	var sshKeyPath string

	if err := row.Scan(
		&name, &engine, &host, &port, &username, &encPassword, &database,
		&useSSH, &sshHost, &sshPort, &sshUsername, &encSSHPassword,
		&useSSHKey, &sshKeyPath,
	); err != nil {
		if err == sql.ErrNoRows {
			return map[string]string{}, nil
		}
		return map[string]string{}, err
	}

	password, err := s.decryptField(encPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt password: %w", err)
	}
	sshPassword, err := s.decryptField(encSSHPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt ssh password: %w", err)
	}

	config := map[string]string{
		"id":          id, // Include ID? The original didn't explicitly, but typically expected.
		"name":        name,
		"engine":      engine,
		"host":        host,
		"port":        port,
		"username":    username,
		"password":    password,
		"database":    database,
		"sshHost":     sshHost,
		"sshPort":     sshPort,
		"sshUsername": sshUsername,
		"sshPassword": sshPassword,
		"sshKeyPath":  sshKeyPath,
	}

	if useSSH == 1 {
		config["useSSH"] = "true"
	} else {
		config["useSSH"] = "false"
	}

	if useSSHKey == 1 {
		config["useSSHKey"] = "true"
	} else {
		config["useSSHKey"] = "false"
	}

	return config, nil
}

func (s *Store) ListConnections() (map[string]common.ConnectionInfo, error) {
	rows, err := s.db.Query(`SELECT id, name, engine FROM connections ORDER BY updated_at DESC`)
	if err != nil {
		return map[string]common.ConnectionInfo{}, err
	}
	defer rows.Close()

	connections := map[string]common.ConnectionInfo{}

	for rows.Next() {
		var id, name, engine string
		if err := rows.Scan(&id, &name, &engine); err != nil {
			return nil, err
		}
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
