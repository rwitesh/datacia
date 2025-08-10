package clickhouse

import (
	"context"
	"log"
	"reflect"
	"regexp"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

const (
	CONNECT_TIMEOUT   = 5 * time.Second
	META_TIMEOUT      = 5 * time.Second
	CHANGE_DB_TIMEOUT = 3 * time.Second
	QUERY_TIMEOUT     = 30 * time.Second
)

type QueryType string

const (
	QueryTypeRead    QueryType = "read"
	QueryTypeCommand QueryType = "command"
	QueryTypeUnknown QueryType = "unknown"
)

var (
	readRegex    = regexp.MustCompile(`(?i)^(select|show|describe|explain|with|watch)\b`)
	commandRegex = regexp.MustCompile(`(?i)^(insert|create|alter|drop|truncate|optimize|grant|revoke|set|attach|detach|rename|use|system|kill)\b`)
)

func NewTimeoutContext(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}

func DetectQueryType(query string) QueryType {
	query = strings.TrimSpace(query)
	if idx := strings.Index(query, "--"); idx != -1 {
		query = query[:idx]
	}
	query = strings.TrimSpace(query)

	switch {
	case readRegex.MatchString(query):
		return QueryTypeRead
	case commandRegex.MatchString(query):
		return QueryTypeCommand
	default:
		return QueryTypeUnknown
	}
}

func ScanDynamicColumns(rows driver.Rows) ([]map[string]interface{}, error) {
	var response []map[string]interface{}
	columns := rows.Columns()
	colTypes := rows.ColumnTypes()

	var count = 0
	for rows.Next() {
		scanTargets, err := prepareScanTargets(colTypes)
		if err != nil {
			return nil, err
		}

		if err := rows.Scan(scanTargets...); err != nil {
			return nil, err
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
		count++
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	log.Println(count)
	return response, nil
}

func prepareScanTargets(columnTypes []driver.ColumnType) ([]interface{}, error) {
	scanTargets := make([]interface{}, len(columnTypes))
	for i, ct := range columnTypes {
		scanType := ct.ScanType()
		scanTargets[i] = reflect.New(scanType).Interface()
	}
	return scanTargets, nil
}
