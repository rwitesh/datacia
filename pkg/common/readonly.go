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
	// writeKeyword catches writes a read statement can carry: Postgres and
	// MySQL run WITH ... DELETE, EXPLAIN ANALYZE executes its statement, and
	// SELECT INTO creates a table. Like the other checks it ignores quoting,
	// so a string containing one of these words is rejected too.
	writeKeyword = regexp.MustCompile(`(?i)\b(insert|update|delete|merge|into|truncate|drop|alter|create)\b`)
	// sideEffect catches calls a read-only transaction doesn't stop: locks that
	// outlive it, ending sessions, server files and network access (dblink's
	// own connection can even write), and MySQL /*+ hints that lift the time limit.
	// Quotes, comments and Unicode-escaped names (U&"...") can't hide the call.
	sideEffect = regexp.MustCompile(`(?is)/\*\+|u&"|\b(pg_(try_)?advisory\w*|pg_(terminate|cancel)_backend|dblink\w*|lo_(import|export)|pg_read_(binary_)?file|pg_ls_\w+|pg_stat_file|pg_(create|drop|copy)_\w*replication_slot|pg_replication_slot_advance|pg_reload_conf|pg_stat_reset\w*|pg_rotate_logfile|pg_switch_wal|http_\w+|net\.\w+|get_lock|load_file|url|remote\w*|file|s3\w*|hdfs|mysql|postgresql|odbc|jdbc|executable)(?:["\x60\]]|\s|/\*.*?\*/|--[^\n]*\n)*\(`)
)

// CheckReadOnly accepts a single read statement. It checks the raw text and
// fails closed, because dialects disagree on quoting and comments (MySQL runs
// /*! */ comments, SQLite quotes with []): a leading comment, a ';' or
// OUTFILE or write keyword anywhere, even inside a string, is rejected.
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
	if sideEffect.MatchString(sql) {
		return errors.New("Queries can't use functions that lock, end sessions, or reach files or the network.")
	}
	// SHOW only lists things, and SHOW CREATE TABLE is common.
	if !strings.EqualFold(leadingWord(sql), "show") && writeKeyword.MatchString(sql) {
		return errors.New("Queries can't change data or schema.")
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
