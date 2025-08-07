package utils

import (
	"regexp"
	"strings"
	"reflect"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
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


func DetectQueryType(query string) QueryType {
	// Strip leading/trailing spaces and inline comments
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
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
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
