package db

import (
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"datacia/internal/logger"
	"datacia/internal/paths"
	"datacia/internal/security"
	"datacia/pkg/common"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// ErrUnreadableSecret is returned with a loaded connection whose saved
// password can't be decrypted, for example after the device ID changed. The
// connection is still returned, with that password empty.
var ErrUnreadableSecret = errors.New("saved password can't be decrypted")

type Store struct {
	db            *sql.DB
	encryptionKey []byte
}

// Open opens the app's store at $XDG_DATA_HOME/<appName>/data.db, encrypting
// secrets with the device-bound key.
func Open() (*Store, error) {
	ctx, err := security.GetSecurityContext()
	if err != nil {
		return nil, err
	}
	dbPath, err := paths.GetDBPath()
	if err != nil {
		return nil, fmt.Errorf("failed to resolve db path: %w", err)
	}
	return OpenFile(dbPath, ctx.GetEncryptionKey())
}

// OpenFile initializes SQLite at the given path and returns a Store
func OpenFile(dbPath string, encryptionKey []byte) (*Store, error) {
	// Ensure the parent directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}
	// The directory mode protects data.db and its WAL files. MkdirAll keeps an
	// older install's looser mode, so tighten it; best effort, as it may not be ours.
	_ = os.Chmod(dir, 0700)

	db, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("failed to open db: %w", err)
	}

	if err = db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping db: %w", err)
	}

	s := &Store{db: db, encryptionKey: encryptionKey}

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
			ssl_mode TEXT NOT NULL DEFAULT 'automatic',
			ssl_ca_path TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_connections_name ON connections(name)`,
		`CREATE TABLE IF NOT EXISTS query_history (
			id TEXT PRIMARY KEY,
			engine TEXT NOT NULL,
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

	if err := s.addMissingColumns("connections", map[string]string{
		"ssl_mode":    "TEXT NOT NULL DEFAULT 'automatic'",
		"ssl_ca_path": "TEXT NOT NULL DEFAULT ''",
	}); err != nil {
		return err
	}

	cutoff := time.Now().UTC().Add(-365 * 24 * time.Hour).Format(time.RFC3339)
	if _, err := s.db.Exec(`DELETE FROM query_history WHERE timestamp < ?`, cutoff); err != nil {
		logger.Error("Failed to prune query history", "error", err.Error())
	}

	return nil
}

// addMissingColumns adds the columns, with their type and default, that a
// table created by an older version lacks. CREATE TABLE IF NOT EXISTS leaves
// such a table as it was.
func (s *Store) addMissingColumns(table string, columns map[string]string) error {
	rows, err := s.db.Query(`SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		return fmt.Errorf("failed to read %s columns: %w", table, err)
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		delete(columns, name)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rows.Close()

	for name, definition := range columns {
		if _, err := s.db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, name, definition)); err != nil {
			return fmt.Errorf("failed to add %s.%s: %w", table, name, err)
		}
	}
	return nil
}

func (s *Store) encryptField(value string) (string, error) {
	if value == "" {
		return "", nil
	}
	encrypted, err := security.Encrypt(s.encryptionKey, []byte(value))
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
	decrypted, err := security.Decrypt(s.encryptionKey, decoded)
	if err != nil {
		return "", err
	}
	return string(decrypted), nil
}

// connectionColumns returns a saved connection's column values, from engine
// to ssl_ca_path, in table order, with the passwords encrypted. use_ssh_key
// only mirrors whether a key path is set; loading doesn't read it.
func (s *Store) connectionColumns(config common.ConnectionConfig) ([]any, error) {
	encPassword, err := s.encryptField(config.Password)
	if err != nil {
		return nil, err
	}
	encSSHPassword, err := s.encryptField(config.SSH.Password)
	if err != nil {
		return nil, err
	}
	return []any{
		config.Engine, config.Host, config.Port, config.Username, encPassword, config.Database,
		config.SSH.Enabled, config.SSH.Host, config.SSH.Port, config.SSH.Username, encSSHPassword,
		config.SSH.KeyPath != "", config.SSH.KeyPath, config.SSLMode, config.SSLCAPath,
	}, nil
}

// SaveConnection stores config as a new connection named config.Name; its ID
// is ignored.
func (s *Store) SaveConnection(config common.ConnectionConfig) error {
	columns, err := s.connectionColumns(config)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`
		INSERT INTO connections (
			id, name, engine, host, port, username, password, database,
			use_ssh, ssh_host, ssh_port, ssh_username, ssh_password,
			use_ssh_key, ssh_key_path, ssl_mode, ssl_ca_path, created_at, updated_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, append([]any{uuid.New().String(), config.Name}, columns...)...)
	if err != nil {
		logger.Error("Failed to save connection", "error", err.Error())
	}
	return err
}

// UpdateConnection overwrites the connection with config.ID.
func (s *Store) UpdateConnection(config common.ConnectionConfig) error {
	columns, err := s.connectionColumns(config)
	if err != nil {
		return err
	}
	args := append([]any{config.Name}, columns...)
	_, err = s.db.Exec(`
		UPDATE connections
		SET name = ?,
			engine = ?, host = ?, port = ?, username = ?, password = ?, database = ?,
			use_ssh = ?, ssh_host = ?, ssh_port = ?, ssh_username = ?, ssh_password = ?,
			use_ssh_key = ?, ssh_key_path = ?, ssl_mode = ?, ssl_ca_path = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, append(args, config.ID)...)
	if err != nil {
		logger.Error("Failed to update connection", "error", err.Error())
	}
	return err
}

func (s *Store) LoadConnection(id string) (common.ConnectionConfig, error) {
	query := `
		SELECT
			name, engine, host, port, username, password, database,
			use_ssh, ssh_host, ssh_port, ssh_username, ssh_password, ssh_key_path,
			ssl_mode, ssl_ca_path
		FROM connections WHERE id = ?
	`
	config := common.ConnectionConfig{ID: id}
	var encPassword, encSSHPassword string

	if err := s.db.QueryRow(query, id).Scan(
		&config.Name, &config.Engine, &config.Host, &config.Port, &config.Username, &encPassword, &config.Database,
		&config.SSH.Enabled, &config.SSH.Host, &config.SSH.Port, &config.SSH.Username, &encSSHPassword, &config.SSH.KeyPath,
		&config.SSLMode, &config.SSLCAPath,
	); err != nil {
		if err == sql.ErrNoRows {
			return common.ConnectionConfig{}, errors.New("connection not found")
		}
		return common.ConnectionConfig{}, err
	}

	var secretErr error
	var err error
	config.Password, err = s.decryptField(encPassword)
	if err != nil {
		logger.Warn("Failed to decrypt password", "error", err.Error())
		secretErr = ErrUnreadableSecret
	}
	config.SSH.Password, err = s.decryptField(encSSHPassword)
	if err != nil {
		logger.Warn("Failed to decrypt SSH password", "error", err.Error())
		secretErr = ErrUnreadableSecret
	}
	return config, secretErr
}

func (s *Store) ListConnections() (map[string]common.ConnectionInfo, error) {
	rows, err := s.db.Query(`SELECT id, name, engine FROM connections ORDER BY updated_at DESC`)
	if err != nil {
		logger.Error("Failed to list connections", "error", err.Error())
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
		logger.Error("Failed to delete connection", "error", err.Error())
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

func (s *Store) SaveQueryHistory(engine string, query string, durationMs int64, status string, errorMessage string) error {
	id := uuid.New().String()
	_, err := s.db.Exec(`
		INSERT INTO query_history (id, engine, query, duration_ms, status, error_message, timestamp)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, engine, query, durationMs, status, errorMessage, time.Now().UTC().Format(time.RFC3339))
	return err
}

func (s *Store) GetQueryHistory(limit int, search string, dateFrom string, dateTo string, status string, engine string) ([]QueryHistoryItem, error) {
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

	if engine != "" {
		conditions = append(conditions, "engine = ?")
		args = append(args, engine)
	}

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

	// Add status filter if provided
	if status != "" {
		conditions = append(conditions, "status = ?")
		args = append(args, status)
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
