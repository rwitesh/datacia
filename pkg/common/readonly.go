package common

import (
	"errors"
	"regexp"
	"slices"
	"strings"
	"unicode"
)

var (
	readStatements = []string{"select", "with", "show", "describe", "desc", "explain"}
	fileWrite      = regexp.MustCompile(`(?i)\b(outfile|dumpfile)\b`)
)

// CheckReadOnly accepts a single read statement. It checks the raw text and
// fails closed, because dialects disagree on quoting and comments (MySQL runs
// /*! */ comments, SQLite quotes with []): a leading comment, a ';' or
// OUTFILE anywhere, even inside a string, is rejected.
func CheckReadOnly(sql string) error {
	sql = strings.TrimRight(strings.TrimSpace(sql), "; \t\r\n")
	if !slices.Contains(readStatements, strings.ToLower(leadingWord(sql))) {
		return errors.New("Only read-only statements can run: SELECT, WITH, SHOW, DESCRIBE or EXPLAIN.")
	}
	if strings.Contains(sql, ";") {
		return errors.New("Run one statement, with no ';' in it.")
	}
	if fileWrite.MatchString(sql) {
		return errors.New("Queries can't write files.")
	}
	return nil
}

func leadingWord(sql string) string {
	sql = strings.TrimLeft(sql, "( \t\r\n")
	if end := strings.IndexFunc(sql, func(r rune) bool { return !unicode.IsLetter(r) }); end >= 0 {
		return sql[:end]
	}
	return sql
}
