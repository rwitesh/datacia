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
	} {
		if got := CheckReadOnly(sql) == nil; got != ok {
			t.Errorf("%q: allowed %v, want %v", sql, got, ok)
		}
	}
}
