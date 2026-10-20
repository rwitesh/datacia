package common

import "testing"

func TestCheckReadOnly(t *testing.T) {
	for sql, ok := range map[string]bool{
		"SELECT 1":                               true,
		"  (select 1);":                          true,
		"with t as (select 1) select * from t":   true,
		"EXPLAIN SELECT 1":                       true,
		"show tables":                            true,
		"delete from users":                      false,
		"-- note\nselect 1":                      false,
		"/* select */ drop table users":          false,
		"":                                       false,
		"selectx 1":                              false,
		"select 1; delete from users":            false,
		"select ';' as s":                        false,
		"SELECT 1 AS [']; ATTACH 'x' AS w; --']": false,
		"SELECT $$'$$; COMMIT; DROP TABLE t":     false,
		"select * into outfile '/tmp/x' from t":  false,
		"SELECT 1 /*!INTO OUTFILE '/tmp/x' */":   false,
		"SELECT 1 INTO DUMPFILE '/tmp/x'":        false,
		"select 1\n-- c\n; drop table t":         false,
		"/*!50000 select 1 */":                   false,
		"/**/select 1":                           false,
		"((select 1))":                           true,
		"(delete from users)":                    false,
		"(select 1); (delete from users)":        false,
		"WITH d AS (DELETE FROM users RETURNING *) SELECT * FROM d":        false,
		"with d as (insert into t values (1) returning *) select * from d": false,
		"WITH d AS (UPDATE t SET a = 1 RETURNING *) SELECT * FROM d":       false,
		"EXPLAIN ANALYZE DELETE FROM users":                                false,
		"SELECT * INTO newtable FROM t":                                    false,
		"SHOW CREATE TABLE users":                                          true,
		"select * from t where a = 'delete'":                               false,
		"select updated_at, created_by from t":                             true,
		"SELECT pg_advisory_lock(42)":                                      false,
		"select pg_terminate_backend(pid) from pg_stat_activity":           false,
		"SELECT * FROM dblink_exec('host=x', 'q')":                         false,
		"SELECT pg_read_file('/etc/passwd')":                               false,
		"SELECT pg_create_physical_replication_slot('s')":                  false,
		"SELECT GET_LOCK('m', 0)":                                          false,
		"SELECT LOAD_FILE('/etc/passwd')":                                  false,
		"SELECT /*+ MAX_EXECUTION_TIME(0) */ * FROM t":                     false,
		"SELECT * FROM url('http://example.com/x', LineAsString)":          false,
		"SELECT * FROM remote('127.0.0.1:9000', system.one)":               false,
		"SELECT * FROM file ('secret.txt', LineAsString)":                  false,
		"select url, file_name, domain(url) from t":                        true,
		"select lo_value, http_status from t":                              true,
		`SELECT "pg_advisory_lock"(42)`:                                    false,
		"SELECT pg_advisory_lock/**/(42)":                                  false,
		"SELECT pg_advisory_lock--x\n(42)":                                 false,
		`SELECT U&"pg_advisory\005flock"(42)`:                              false,
		"SELECT `file`('x', LineAsString)":                                 false,
		"SELECT * FROM pg_get_replication_slots()":                         true,
	} {
		if got := CheckReadOnly(sql) == nil; got != ok {
			t.Errorf("%q: allowed %v, want %v", sql, got, ok)
		}
	}
}
