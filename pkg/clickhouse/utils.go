package clickhouse

import (
	"context"
	"encoding"
	"fmt"
	"math"
	"reflect"

	"github.com/ClickHouse/clickhouse-go/v2/lib/chcol"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

// ScanDynamicColumns reads up to maxRows rows, or all of them when maxRows is 0.
func ScanDynamicColumns(ctx context.Context, rows driver.Rows, maxRows int) ([]string, []map[string]interface{}, error) {
	var response []map[string]interface{}
	columns := rows.Columns()
	colTypes := rows.ColumnTypes()

	for (maxRows == 0 || len(response) < maxRows) && rows.Next() {
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
				rowsEntry[col] = normalizeValue(rv.Elem().Interface())
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

// normalizeValue converts a scanned value into one encoding/json can marshal
// the way the UI expects.
func normalizeValue(v interface{}) interface{} {
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Pointer && rv.IsNil() {
		return nil
	}
	// Check before dereferencing: *big.Int (Int128/256) only marshals
	// through its pointer, and UUID ([16]byte) and IPv4/IPv6 (net.IP) would
	// otherwise become arrays of numbers below.
	if _, ok := v.(encoding.TextMarshaler); ok {
		return v
	}
	if rv.Kind() == reflect.Pointer {
		return normalizeValue(rv.Elem().Interface())
	}

	switch val := v.(type) {
	case float32:
		return normalizeFloat(float64(val))
	case float64:
		return normalizeFloat(val)
	case complex64, complex128:
		return fmt.Sprintf("%v", val)
	case chcol.JSON:
		value, err := val.Value()
		if err != nil {
			return nil
		}
		return normalizeValue(value)
	}

	switch rv.Kind() {
	case reflect.Map:
		m := make(map[string]interface{}, rv.Len())
		for _, key := range rv.MapKeys() {
			m[fmt.Sprintf("%v", key.Interface())] = normalizeValue(rv.MapIndex(key).Interface())
		}
		return m

	case reflect.Slice, reflect.Array:
		out := make([]interface{}, rv.Len())
		for i := 0; i < rv.Len(); i++ {
			out[i] = normalizeValue(rv.Index(i).Interface())
		}
		return out
	}

	return v
}

func normalizeFloat(f float64) interface{} {
	switch {
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, +1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	default:
		return f
	}
}
