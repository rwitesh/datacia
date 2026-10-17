package sqlite

import (
	"context"
	"path/filepath"
	"slices"
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

func TestDuplicateColumnNames(t *testing.T) {
	s := New()
	if err := s.Connect("", "", "", "", filepath.Join(t.TempDir(), "t.db"), false); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })

	res, err := s.RunQuery("", string(common.QueryTypeRead), "SELECT 1 AS id, 2 AS id")
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"id", "id_2"}; !slices.Equal(res.Columns, want) {
		t.Fatalf("columns = %q, want %q", res.Columns, want)
	}
	if row := res.Data[0]; row["id"] != int64(1) || row["id_2"] != int64(2) {
		t.Fatalf("row = %v, want id=1 id_2=2", row)
	}
}
