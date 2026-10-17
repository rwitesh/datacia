package sqlite

import (
	"context"
	"path/filepath"
	"testing"

	"datacia/pkg/common"
)

func TestReadOnlyQuery(t *testing.T) {
	s := New()
	if err := s.Connect("", "", "", "", filepath.Join(t.TempDir(), "t.db"), false); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	run := func(sql string) error {
		_, err := s.RunQuery("", string(common.QueryTypeCommand), sql)
		return err
	}
	if err := run("CREATE TABLE t (n INTEGER); INSERT INTO t VALUES (1), (2), (3)"); err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	res, err := s.ReadOnlyQuery(ctx, "SELECT n FROM t ORDER BY n", 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Data) != 2 {
		t.Fatalf("got %d rows, want 2", len(res.Data))
	}
	for _, sql := range []string{
		"DELETE FROM t",
		"SELECT 1; PRAGMA query_only = OFF; DELETE FROM t; SELECT 1",
	} {
		s.ReadOnlyQuery(ctx, sql, 10)
	}
	res, err = s.RunQuery("", string(common.QueryTypeRead), "SELECT n FROM t")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Data) != 3 {
		t.Fatalf("read-only queries changed the table: %d rows left", len(res.Data))
	}
	if err := run("INSERT INTO t VALUES (4)"); err != nil {
		t.Fatalf("write after read-only query: %v", err)
	}
}
