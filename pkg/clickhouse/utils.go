package clickhouse

import (
	"context"
	"reflect"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

const (
	CONNECT_TIMEOUT   = 10 * time.Second
	META_TIMEOUT      = 10 * time.Second
	CHANGE_DB_TIMEOUT = 5 * time.Second
	QUERY_TIMEOUT     = 300 * time.Second
)

type QueryType string

const (
	QueryTypeRead    QueryType = "read"
	QueryTypeCommand QueryType = "command"
	QueryTypeUnknown QueryType = "unknown"
)

type QueryResult struct {
	Type    QueryType
	Columns []string
	Data    []map[string]interface{}
}

func NewTimeoutContext(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}

func ScanDynamicColumns(ctx context.Context, rows driver.Rows) ([]string, []map[string]interface{}, error) {
	var response []map[string]interface{}
	columns := rows.Columns()
	colTypes := rows.ColumnTypes()

	for rows.Next() {
		select {
		case <-ctx.Done():
			return nil, nil, ctx.Err()
		default:
		}

		scanTargets, err := prepareScanTargets(colTypes)
		if err != nil {
			return nil, nil, err
		}

		if err := rows.Scan(scanTargets...); err != nil {
			return nil, nil, err
		}

		rowsEntry := make(map[string]interface{})
		for i, col := range columns {
			val := scanTargets[i]
			rv := reflect.ValueOf(val)
			if rv.Kind() == reflect.Ptr && !rv.IsNil() {
				rowsEntry[col] = rv.Elem().Interface()
			} else {
				rowsEntry[col] = nil
			}
		}

		response = append(response, rowsEntry)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	return columns, response, nil
}

func prepareScanTargets(columnTypes []driver.ColumnType) ([]interface{}, error) {
	scanTargets := make([]interface{}, len(columnTypes))
	for i, ct := range columnTypes {
		scanType := ct.ScanType()
		scanTargets[i] = reflect.New(scanType).Interface()
	}
	return scanTargets, nil
}
