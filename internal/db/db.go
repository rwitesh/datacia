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
	// Installs from before 0700 have looser modes. Best effort: the database
	// works either way, and Windows ignores these bits.
	_ = os.Chmod(dir, 0700)
	if f, err := os.OpenFile(dbPath, os.O_RDWR|os.O_CREATE, 0600); err == nil {
		_ = f.Chmod(0600)
		f.Close()
	}

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

	// Columns added after the first release; the table has no migrations.
	for _, column := range []string{"ssl_mode", "ssl_ca_path"} {
		if err := s.ensureConnectionColumn(column); err != nil {
			return err
		}
	}

	cutoff := time.Now().UTC().Add(-365 * 24 * time.Hour).Format(time.RFC3339)
	if _, err := s.db.Exec(`DELETE FROM query_history WHERE timestamp < ?`, cutoff); err != nil {
		logger.Error("Failed to prune query history", "error", err.Error())
	}

	return nil
}

func (s *Store) ensureConnectionColumn(name string) error {
	rows, err := s.db.Query(`SELECT name FROM pragma_table_info('connections')`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var existing string
		if err := rows.Scan(&existing); err != nil {
			return err
		}
		if existing == name {
			return nil
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rows.Close()
	// An empty ssl_mode means "not chosen", which connects with the default.
	_, err = s.db.Exec(`ALTER TABLE connections ADD COLUMN ` + name + ` TEXT NOT NULL DEFAULT ''`)
	return err
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
// to ssl_ca_path, in table order, with the passwords encrypted.
func (s *Store) connectionColumns(config map[string]string) ([]any, error) {
	encPassword, err := s.encryptField(config["password"])
	if err != nil {
		return nil, err
	}
	encSSHPassword, err := s.encryptField(config["sshPassword"])
	if err != nil {
		return nil, err
	}
	return []any{
		config["engine"], config["host"], config["port"], config["username"], encPassword, config["database"],
		config["useSSH"] == "true", config["sshHost"], config["sshPort"], config["sshUsername"], encSSHPassword,
		config["useSSHKey"] == "true", config["sshKeyPath"], config["sslMode"], config["sslCAPath"],
	}, nil
}

func (s *Store) SaveConnection(name string, config map[string]string) error {
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
	`, append([]any{uuid.New().String(), name}, columns...)...)
	if err != nil {
		logger.Error("Failed to save connection", "error", err.Error())
	}
	return err
}

func (s *Store) UpdateConnection(id, name string, config map[string]string) error {
	columns, err := s.connectionColumns(config)
	if err != nil {
		return err
	}
	args := append([]any{name}, columns...)
	_, err = s.db.Exec(`
		UPDATE connections
		SET name = ?,
			engine = ?, host = ?, port = ?, username = ?, password = ?, database = ?,
			use_ssh = ?, ssh_host = ?, ssh_port = ?, ssh_username = ?, ssh_password = ?,
			use_ssh_key = ?, ssh_key_path = ?, ssl_mode = ?, ssl_ca_path = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, append(args, id)...)
	if err != nil {
		logger.Error("Failed to update connection", "error", err.Error())
	}
	return err
}

func (s *Store) LoadConnection(id string) (map[string]string, error) {
	query := `
		SELECT 
			name, engine, host, port, username, password, database,
			use_ssh, ssh_host, ssh_port, ssh_username, ssh_password,
			use_ssh_key, ssh_key_path, ssl_mode, ssl_ca_path
		FROM connections WHERE id = ?
	`
	row := s.db.QueryRow(query, id)

	var name, engine, host, port, username, encPassword, database string
	var useSSH int
	var sshHost, sshPort, sshUsername, encSSHPassword string
	var useSSHKey int
	var sshKeyPath, sslMode, sslCAPath string

	if err := row.Scan(
		&name, &engine, &host, &port, &username, &encPassword, &database,
		&useSSH, &sshHost, &sshPort, &sshUsername, &encSSHPassword,
		&useSSHKey, &sshKeyPath, &sslMode, &sslCAPath,
	); err != nil {
		if err == sql.ErrNoRows {
			return map[string]string{}, errors.New("connection not found")
		}
		return map[string]string{}, err
	}

	var secretErr error
	password, err := s.decryptField(encPassword)
	if err != nil {
		logger.Warn("Failed to decrypt password", "error", err.Error())
		secretErr = ErrUnreadableSecret
	}
	sshPassword, err := s.decryptField(encSSHPassword)
	if err != nil {
		logger.Warn("Failed to decrypt SSH password", "error", err.Error())
		secretErr = ErrUnreadableSecret
	}

	config := map[string]string{
		"id":          id,
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
		"sslMode":     sslMode,
		"sslCAPath":   sslCAPath,
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
