package common

import (
	"fmt"
	"regexp"
	"strings"
)

// Quote characters for QuoteIdentifier.
const (
	QuoteBacktick    = "`" // MySQL, ClickHouse
	QuoteDoubleQuote = `"` // PostgreSQL, SQLite
)

// identifierRegex allows letters, digits, '_', '.' and '-', starting with a
// letter or '_'.
var identifierRegex = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_.\-]*$`)

// QuoteIdentifier quotes a table or column name with quoteChar. Names with
// any other character are rejected rather than escaped; doubling quoteChar
// only guards against the pattern being loosened later.
func QuoteIdentifier(name string, quoteChar string) (string, error) {
	if name == "" {
		return "", fmt.Errorf("identifier cannot be empty")
	}
	if !identifierRegex.MatchString(name) {
		return "", fmt.Errorf("invalid identifier: %q contains unsafe characters", name)
	}
	escaped := strings.ReplaceAll(name, quoteChar, quoteChar+quoteChar)
	return quoteChar + escaped + quoteChar, nil
}

// TableDataSQL builds the query for one page of a table, optionally ordered
// by a column (orderDir "desc" sorts descending, anything else ascending).
func TableDataSQL(table, orderBy, orderDir string, limit, offset int, quoteChar string) (string, error) {
	quotedTable, err := QuoteIdentifier(table, quoteChar)
	if err != nil {
		return "", err
	}
	sql := "SELECT * FROM " + quotedTable
	if orderBy != "" {
		quotedCol, err := QuoteIdentifier(orderBy, quoteChar)
		if err != nil {
			return "", err
		}
		dir := "ASC"
		if orderDir == "desc" {
			dir = "DESC"
		}
		sql += fmt.Sprintf(" ORDER BY %s %s", quotedCol, dir)
	}
	return sql + fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset), nil
}
