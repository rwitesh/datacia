package postgres

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type DatabaseInfo struct {
	Databases       []string `json:"databases"`
	CurrentDatabase string   `json:"currentDatabase"`
}

type PostgresClient interface {
	Connect(host, port, username, password, database string, test bool) error
	Close() error
	Ping() error
	ListDatabases() (DatabaseInfo, error)
	ListTables() ([]string, error)
	GetConnectionInfo() (map[string]string, error)
}

var _ PostgresClient = (*Postgres)(nil)

type Postgres struct {
	conn          *pgx.Conn
	host          string
	port          string
	username      string
	password      string
	database      string
	activeQueries sync.Map
	mu            sync.RWMutex
}

func New() *Postgres {
	return &Postgres{}
}

func (p *Postgres) Connect(host, port, username, password, database string, test bool) error {
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s",
		username, password, host, port, database,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return err
	}

	// Test connection
	if err := conn.Ping(ctx); err != nil {
		_ = conn.Close(ctx)
		return err
	}

	if !test {
		p.mu.Lock()
		if p.conn != nil {
			_ = p.conn.Close(ctx)
		}
		p.conn = conn
		p.host = host
		p.port = port
		p.username = username
		p.password = password
		p.database = database
		p.mu.Unlock()
	} else {
		// if test=true → close right away (don't keep state)
		_ = conn.Close(ctx)
	}

	return nil
}

func (p *Postgres) Close() error {
	p.activeQueries = sync.Map{} // reset

	p.mu.Lock()
	defer p.mu.Unlock()

	if p.conn == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := p.conn.Close(ctx)
	if err != nil {
		return err
	}
	p.conn = nil
	return nil
}

func (p *Postgres) Ping() error {
	p.mu.RLock()
	conn := p.conn
	p.mu.RUnlock()

	if conn == nil {
		return errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	return conn.Ping(ctx)
}

func (p *Postgres) ListDatabases() (DatabaseInfo, error) {
	p.mu.RLock()
	conn := p.conn
	currentDB := p.database
	p.mu.RUnlock()

	if conn == nil {
		return DatabaseInfo{}, errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	rows, err := conn.Query(ctx, "SELECT datname FROM pg_database WHERE datistemplate = false;")
	if err != nil {
		return DatabaseInfo{}, err
	}
	defer rows.Close()

	var databases []string
	for rows.Next() {
		var datname string
		if err := rows.Scan(&datname); err != nil {
			return DatabaseInfo{}, err
		}
		databases = append(databases, datname)
	}

	if err := rows.Err(); err != nil {
		return DatabaseInfo{}, err
	}

	return DatabaseInfo{
		Databases:       databases,
		CurrentDatabase: currentDB,
	}, nil
}

func (p *Postgres) ListTables() ([]string, error) {
	p.mu.RLock()
	conn := p.conn
	p.mu.RUnlock()

	if conn == nil {
		return nil, errors.New("no active connection found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	rows, err := conn.Query(ctx, "SELECT tablename FROM pg_tables WHERE schemaname = 'public';")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var tablename string
		if err := rows.Scan(&tablename); err != nil {
			return nil, err
		}
		tables = append(tables, tablename)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return tables, nil
}

func (p *Postgres) GetConnectionInfo() (map[string]string, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	if p.conn == nil {
		return nil, errors.New("no active connection found")
	}
	
	return map[string]string{
		"engine":   "postgres",
		"host":     p.host,
		"port":     p.port,
		"username": p.username,
		"password": p.password,
		"database": p.database,
	}, nil
}
