package common

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

// Quote character constants for different databases
const (
	QuoteBacktick    = "`" // Used by MySQL, ClickHouse
	QuoteDoubleQuote = `"` // Used by PostgreSQL, SQLite
)

// identifierRegex validates SQL identifiers
// Allowed: must start with letter or underscore, followed by alphanumeric, underscore, period (for schema.table), or hyphen
var identifierRegex = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_.\-]*$`)

// ensures an identifier contains only safe characters
// Returns an error if the identifier is invalid or empty
func ValidateIdentifier(name string) error {
	if name == "" {
		return fmt.Errorf("identifier cannot be empty")
	}
	if !identifierRegex.MatchString(name) {
		return fmt.Errorf("invalid identifier: %q contains unsafe characters", name)
	}
	return nil
}

// QuoteIdentifier safely quotes a SQL identifier (table/column name)
// It validates the identifier and escapes the quote character by doubling it.
// Use QuoteBacktick for MySQL/ClickHouse, QuoteDoubleQuote for PostgreSQL/SQLite.
func QuoteIdentifier(name string, quoteChar string) (string, error) {
	if err := ValidateIdentifier(name); err != nil {
		return "", err
	}
	// Escape any quote characters by doubling them, then wrap in quotes
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

// ensures a string is a valid UUID format
// Returns an error if the string is not a valid UUID
func ValidateUUID(id string) error {
	if id == "" {
		return fmt.Errorf("UUID cannot be empty")
	}
	if _, err := uuid.Parse(id); err != nil {
		return fmt.Errorf("invalid UUID format: %q", id)
	}
	return nil
}
