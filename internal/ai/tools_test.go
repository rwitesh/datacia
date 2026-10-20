package ai

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"slices"
	"strings"
	"testing"

	"datacia/pkg/common"
)

type fakeDB struct {
	tables  []string
	result  common.QueryResult
	maxRows int
}

func (f *fakeDB) ListTables() ([]string, error) { return f.tables, nil }

func (f *fakeDB) GetDDL(table string) (string, error) {
	if table != "users" {
		return "", errors.New("no such table")
	}
	return "CREATE TABLE users (id int)", nil
}

func (f *fakeDB) ReadOnlyQuery(_ context.Context, _ string, maxRows int) (common.QueryResult, error) {
	f.maxRows = maxRows
	res := f.result
	res.Data = res.Data[:min(len(res.Data), maxRows)]
	return res, nil
}

func TestRunQuery(t *testing.T) {
	long := strings.Repeat("x", maxCellChars+50)
	db := &fakeDB{result: common.QueryResult{
		Columns: []string{"name", "id"},
		Data: []map[string]any{
			{"id": 1, "name": long},
			{"id": 2, "name": "b"},
			{"id": 3, "name": "c"},
		},
	}}
	res, err := runQuery(context.Background(), db, "select id, name from users", 2)
	if err != nil {
		t.Fatal(err)
	}
	// What the model reads, which the chat also shows.
	out := toJSON(res)
	if db.maxRows != 3 {
		t.Errorf("asked for %d rows, want limit+1", db.maxRows)
	}
	var got struct {
		Columns  []string `json:"columns"`
		Rows     [][]any  `json:"rows"`
		MoreRows bool     `json:"more_rows"`
	}
	if err := json.Unmarshal([]byte(out), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Rows) != 2 || !got.MoreRows {
		t.Fatalf("got %d rows, more %v", len(got.Rows), got.MoreRows)
	}
	if got.Rows[0][1] != float64(1) {
		t.Errorf("rows not in column order: %v", got.Rows[0])
	}
	if s := got.Rows[0][0].(string); len(s) > maxCellChars+len("…") {
		t.Errorf("long value not cut: %d chars", len(s))
	}
}

func TestCellNonFinite(t *testing.T) {
	// JSON can't encode these; the rest of the row must survive.
	row := []any{cell(math.NaN()), cell(math.Inf(1)), cell(1.5)}
	if _, err := json.Marshal(row); err != nil {
		t.Fatal(err)
	}
}

func TestChatToolsByAccess(t *testing.T) {
	// Schema access must never reach rows.
	want := map[Access][]string{
		AccessNone:   {"get_editor"},
		AccessSchema: {"get_editor", "list_tables", "describe_table"},
		AccessData:   {"get_editor", "list_tables", "describe_table", "run_query"},
	}
	for access, names := range want {
		var got []string
		for _, tool := range chatTools(&fakeDB{}, access, ChatContext{}, func(ToolUse) {}) {
			got = append(got, tool.Name)
		}
		if !slices.Equal(got, names) {
			t.Errorf("%s: tools %v, want %v", access, got, names)
		}
		if systemPrompts[access] == "" {
			t.Errorf("%s: no system prompt", access)
		}
	}
}
