package clickhouse

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type ClickHouseClient interface {
	Connect(host string, port uint16, username, password, database string) error
	Close() error
	ExecuteQuery(query string) ([]map[string]interface{}, error)
	FetchTables() ([]string, error)
	FetchDatabases() ([]string, error)
	ChangeDatabase(database string) error
	Cancel()
}

type ClickHouse struct {
	conn     driver.Conn
	host     string
	port     uint16
	username string
	password string
	mu       sync.Mutex
	cancel   context.CancelFunc
}

func New() *ClickHouse { return &ClickHouse{} }

func (ch *ClickHouse) Connect(host string, port uint16, username, password, database string) error {
	ctx, cancel := NewTimeoutContext(CONNECT_TIMEOUT)
	defer cancel()

	connection, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%d", host, port)},
		Auth: clickhouse.Auth{
			Database: database,
			Username: username,
			Password: password,
		},
		Settings: clickhouse.Settings{
			"max_execution_time": 60,
		},
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		},
		DialTimeout:     time.Duration(10) * time.Second,
		MaxOpenConns:    4,
		MaxIdleConns:    4,
		ConnMaxLifetime: 0,
	})
	if err != nil {
		return fmt.Errorf("open ClickHouse: %w", err)
	}

	pingCtx, pinCancel := context.WithTimeout(ctx, 5*time.Second)
	defer pinCancel()
	if err := connection.Ping(pingCtx); err != nil {
		return err
	}

	ch.conn = connection
	ch.host = host
	ch.port = port
	ch.username = username
	ch.password = password
	return nil
}

func (ch *ClickHouse) Close() error {
	ch.Cancel()
	if ch.conn == nil {
		return nil
	}
	return ch.conn.Close()
}

func (ch *ClickHouse) ExecuteQuery(sql string) ([]map[string]interface{}, error) {
	if ch.conn == nil {
		return nil, errors.New("no active connection found")
	}

	ctx, cancel := NewTimeoutContext(QUERY_TIMEOUT)

	ch.mu.Lock()
	if ch.cancel != nil {
		ch.mu.Unlock()
		cancel()
		return nil, errors.New("another query is already running")
	}
	ch.cancel = cancel
	ch.mu.Unlock()

	defer func() {
		cancel()
		ch.mu.Lock()
		ch.cancel = nil
		ch.mu.Unlock()
	}()

	switch DetectQueryType(sql) {
	case QueryTypeCommand:
		if err := ch.conn.Exec(ctx, sql); err != nil {
			return nil, err
		}
		return []map[string]interface{}{}, nil

	case QueryTypeRead:
		rows, err := ch.conn.Query(ctx, sql)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		return ScanDynamicColumns(ctx, rows)

	default:
		return nil, fmt.Errorf("unsupported or unknown query type")
	}
}

func (ch *ClickHouse) FetchTables(database string) ([]string, error) {
	if database == "" {
		return nil, errors.New("no active database found")
	}

	if ch.conn == nil {
		return nil, errors.New("no active connection found")
	}

	ctx, cancel := NewTimeoutContext(META_TIMEOUT)
	defer cancel()

	const sql = `
		SELECT name
		FROM system.tables
		WHERE database = {db:String}
		ORDER BY name
	`
	rows, err := ch.conn.Query(ctx, sql, clickhouse.Named("db", database))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

func (ch *ClickHouse) FetchDatabases() ([]string, error) {
	if ch.conn == nil {
		return nil, errors.New("no active connection found")
	}

	ctx, cancel := NewTimeoutContext(QUERY_TIMEOUT)
	defer cancel()

	const sql = `
		SELECT name
		FROM system.databases
		ORDER BY name
	`
	rows, err := ch.conn.Query(ctx, sql)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

func (ch *ClickHouse) ChangeDatabase(database string) error {
	if ch.conn == nil {
		return errors.New("no active connection found")
	}

	ctx, cancel := NewTimeoutContext(QUERY_TIMEOUT)
	defer cancel()

	sql := fmt.Sprintf("USE `%s`", database)
	if err := ch.conn.Exec(ctx, sql); err != nil {
		return fmt.Errorf("failed to open database: %q", database)
	}
	return nil
}

func (ch *ClickHouse) Cancel() {
	ch.mu.Lock()
	cf := ch.cancel
	ch.cancel = nil
	ch.mu.Unlock()

	if cf != nil {
		cf()
	}
}
