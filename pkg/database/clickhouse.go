package database

import (
	"context"
	"fmt"
	"layerbit-go/pkg/utils"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type ClickHouseClient interface {
	Connect(host string, port uint16, username, password, database string) error
	Close() error
	ExecuteQuery(ctx context.Context, query string) ([]map[string]interface{}, error)
	FetchTables(ctx context.Context) ([]string, error)
	FetchDatabases(ctx context.Context) ([]string, error)
	ChangeDatabase(ctx context.Context, database string) error
}

type ClickHouse struct {
	conn     driver.Conn
	host     string
	port     uint16
	username string
	password string
	database string
}

func New() *ClickHouse {
	return &ClickHouse{}
}

func (ch *ClickHouse) Connect(host string, port uint16, username, password, database string) error {
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
		DialTimeout:     10 * time.Second,
		MaxOpenConns:    1,
		MaxIdleConns:    1,
		ConnMaxLifetime: 1 * time.Minute,
	})
	if err != nil {
		return fmt.Errorf("unable to open ClickHouse connection: %w", err)
	}

	if err := connection.Ping(context.Background()); err != nil {
		return fmt.Errorf("unable to ping ClickHouse: %w", err)
	}

	ch.conn = connection
	ch.host = host
	ch.port = port
	ch.username = username
	ch.password = password
	ch.database = database
	return nil
}

func (ch *ClickHouse) Close() error {
	if ch.conn != nil {
		return ch.conn.Close()
	}
	return nil
}

func (ch *ClickHouse) RunQuery(rawQuery string) ([]map[string]interface{}, error) {
	queryType := utils.DetectQueryType(rawQuery)
	if queryType == utils.QueryTypeCommand {
		err := ch.conn.Exec(context.Background(), rawQuery)
		if err != nil {
			return nil, err
		}
		return []map[string]interface{}{}, nil
	}

	if queryType == utils.QueryTypeRead {
		rows, err := ch.conn.Query(context.Background(), rawQuery)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		return utils.ScanDynamicColumns(rows)
	}

	return nil, fmt.Errorf("unsupported or unknown query type")
}

func (ch *ClickHouse) FetchTables() ([]string, error) {
	rows, err := ch.conn.Query(context.Background(), fmt.Sprintf("SHOW TABLES FROM %s", ch.database))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}
	return tables, rows.Err()
}

func (ch *ClickHouse) FetchDatabases() ([]string, error) {
	rows, err := ch.conn.Query(context.Background(), "SHOW DATABASES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	databases := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		databases = append(databases, name)
	}
	return databases, rows.Err()
}

func (ch *ClickHouse) ChangeDatabase(database string) error {
	if ch.conn == nil {
		return fmt.Errorf("connection is not established")
	}

	if err := ch.Connect(ch.host, ch.port, ch.username, ch.password, database); err != nil {
		return fmt.Errorf("failed to change database: %w", err)
	}
	ch.database = database
	return nil
}
