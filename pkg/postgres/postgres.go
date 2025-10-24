package postgres

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type PostgresClient interface {
	Connect(host, port, username, password, database string, test bool) (map[string]interface{}, error)
	Close() error
	Ping() error
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

func (p *Postgres) Connect(host, port, username, password, database string, test bool) (map[string]interface{}, error) {
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s",
		username, password, host, port, database,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return nil, err
	}

	// Test connection
	if err := conn.Ping(ctx); err != nil {
		_ = conn.Close(ctx)
		return nil, err
	}

	meta := map[string]interface{}{}
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

		meta = map[string]interface{}{
			"host":     host,
			"port":     port,
			"username": username,
			"database": database,
			"password": password,
		}
	} else {
		// if test=true → close right away (don’t keep state)
		_ = conn.Close(ctx)
	}

	return meta, nil
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
