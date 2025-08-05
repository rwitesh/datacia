package utils

import (
	"reflect"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

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
