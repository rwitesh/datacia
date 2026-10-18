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
		"select updated_at, created_by from t":                             true,
	} {
		if got := CheckReadOnly(sql) == nil; got != ok {
			t.Errorf("%q: allowed %v, want %v", sql, got, ok)
		}
	}
}
