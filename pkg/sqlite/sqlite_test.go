package sqlite

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"datacia/pkg/common"
)

// connectNew connects to a new, empty database file.
func connectNew(t *testing.T) *SQLite {
	t.Helper()
	path := filepath.Join(t.TempDir(), "t.db")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	s := New()
	if err := s.Connect("", "", "", "", path, common.TLSSettings{}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestMissingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing.db")
	if err := New().Connect("", "", "", "", path, common.TLSSettings{}); err == nil {
		t.Fatal("connected to a file that doesn't exist")
	}
	if _, err := os.Stat(path); err == nil {
		t.Fatal("connecting created the file")
	}
}

func TestReadOnlyQuery(t *testing.T) {
	s := connectNew(t)
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
	s := connectNew(t)

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

func TestSessionKeepsTransaction(t *testing.T) {
	s := connectNew(t)
	run := func(sql string) {
		t.Helper()
		if _, err := s.RunQuery("", string(common.QueryTypeCommand), sql); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}
	count := func() int {
		t.Helper()
		res, err := s.RunQuery("", string(common.QueryTypeRead), "SELECT n FROM t")
		if err != nil {
			t.Fatal(err)
		}
		return len(res.Data)
	}

	run("CREATE TEMP TABLE t (n INTEGER)") // visible only on the same connection
	run("BEGIN")
	run("INSERT INTO t VALUES (1)")
	if got := count(); got != 1 {
		t.Fatalf("inside the transaction: %d rows, want 1", got)
	}
	run("ROLLBACK")
	if got := count(); got != 0 {
		t.Fatalf("after rollback: %d rows, want 0", got)
	}
}

func TestTableMetadata(t *testing.T) {
	s := connectNew(t)
	if _, err := s.RunQuery("", string(common.QueryTypeCommand), "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL DEFAULT 'x'); INSERT INTO items (name) VALUES ('a'), ('b'), ('c')"); err != nil {
		t.Fatal(err)
	}

	tables, err := s.ListTables()
	if err != nil || !slices.Equal(tables, []string{"items"}) {
		t.Fatalf("tables %v, err %v", tables, err)
	}

	schema, err := s.GetTableSchema("items")
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(schema.Columns, []string{"cid", "name", "type", "notnull", "dflt_value", "pk"}) || len(schema.Data) != 2 {
		t.Fatalf("schema %v %v", schema.Columns, schema.Data)
	}
	if schema.Data[1]["name"] != "name" || schema.Data[1]["dflt_value"] != "'x'" {
		t.Errorf("second column %v", schema.Data[1])
	}

	page, err := s.GetTableData("items", 2, 1, "name", "desc")
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Data) != 2 || page.Data[0]["name"] != "b" || page.Data[1]["name"] != "a" {
		t.Errorf("page %v", page.Data)
	}
}
