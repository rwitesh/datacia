package common

import (
	"context"
	"time"
)

type QueryType string

const (
	QueryTypeRead    QueryType = "read"
	QueryTypeCommand QueryType = "command"
	QueryTypeUnknown QueryType = "unknown"
)

type QueryResult struct {
	Type    QueryType                `json:"type"`
	Columns []string                 `json:"columns"`
	Data    []map[string]interface{} `json:"data"`
}

func NewTimeoutContext(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}