package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"

	"datacia/pkg/common"

	"github.com/google/uuid"
	"github.com/zendev-sh/goai"
)

const (
	maxToolSteps     = 25
	defaultQueryRows = 20
	maxQueryRows     = 200
	maxCellChars     = 200
	maxToolOutput    = 16 << 10 // bytes per tool result
	maxListedTables  = 500
)

// Database is the active connection, as the tools use it.
type Database interface {
	ListTables() ([]string, error)
	GetDDL(table string) (string, error)
	ReadOnlyQuery(ctx context.Context, sql string, maxRows int) (common.QueryResult, error)
}

// ToolUse tells the chat what a tool read, so the user sees what was shared.
type ToolUse struct {
	ID     string        `json:"id"`
	Label  string        `json:"label"`
	SQL    string        `json:"sql,omitempty"` // the query run_query ran
	Done   bool          `json:"done"`
	Error  string        `json:"error,omitempty"`
	Result *QueryPreview `json:"result,omitempty"` // run_query's rows
}

// QueryPreview is run_query's result exactly as the model sees it, so the
// chat can show and keep the same capped rows.
type QueryPreview struct {
	Columns  []string `json:"columns"`
	Rows     [][]any  `json:"rows"`
	MoreRows bool     `json:"more_rows"`
	Ms       int64    `json:"ms"`
}

type (
	editorInput struct{}

	listTablesInput struct {
		Filter string `json:"filter" jsonschema:"description=Case-insensitive part of the table name. Empty lists every table."`
	}

	describeTableInput struct {
		Table string `json:"table" jsonschema:"description=Table name as list_tables returns it."`
	}

	runQueryInput struct {
		SQL   string `json:"sql" jsonschema:"description=One read-only statement: SELECT / WITH / SHOW / DESCRIBE / EXPLAIN."`
		Limit int    `json:"limit" jsonschema:"description=Most rows to return, at most 200. Ask for the fewest that answer the question, usually 10-20."`
	}
)

// chatTools returns the tools for one chat request: the user's editor and
// read-only access to the connected database, so the model can answer from
// real data instead of guessing. editor is the editor as it was when the
// message was sent; report is called as each tool starts and ends.
func chatTools(db Database, editor ChatContext, report func(ToolUse)) []goai.Tool {
	step := func(t ToolUse, run func(*ToolUse) (string, error)) (string, error) {
		t.ID = uuid.NewString()
		report(t)
		out, err := run(&t)
		t.Done = true
		if err != nil {
			t.Error = err.Error()
		}
		report(t)
		return out, err
	}
	return []goai.Tool{
		goai.NewTool("get_editor",
			"Returns the SQL in the user's editor and the error from its last run. Call it when the user mentions their query or an error.",
			func(ctx context.Context, _ editorInput) (string, error) {
				return step(ToolUse{Label: "Read the editor"}, func(*ToolUse) (string, error) {
					return readEditor(editor), nil
				})
			}),
		goai.NewTool("list_tables",
			"Lists the tables in the connected database.",
			func(ctx context.Context, in listTablesInput) (string, error) {
				return step(ToolUse{Label: "Listed tables"}, func(*ToolUse) (string, error) {
					return listTables(db, in.Filter)
				})
			}),
		goai.NewTool("describe_table",
			"Returns a table's CREATE statement with its columns and types. Call it before writing SQL against a table whose columns you haven't seen.",
			func(ctx context.Context, in describeTableInput) (string, error) {
				return step(ToolUse{Label: "Read the schema of " + in.Table}, func(*ToolUse) (string, error) {
					return describeTable(db, in.Table)
				})
			}),
		goai.NewTool("run_query",
			"Runs one read-only query on the user's database and returns its rows. Writes are blocked.",
			func(ctx context.Context, in runQueryInput) (string, error) {
				return step(ToolUse{Label: "Ran a query", SQL: in.SQL}, func(t *ToolUse) (string, error) {
					res, err := runQuery(ctx, db, in.SQL, in.Limit)
					if err != nil {
						return "", err
					}
					t.Result = &res
					return toJSON(res), nil
				})
			}),
	}
}

func readEditor(c ChatContext) string {
	sql, lastErr := strings.TrimSpace(c.SQL), strings.TrimSpace(c.Error)
	if sql == "" && lastErr == "" {
		return "The editor is empty."
	}
	return toJSON(map[string]string{
		"sql": truncate(sql, maxToolOutput/2),
		// The editor may have changed since this run.
		"last_run_error": truncate(lastErr, maxToolOutput/4),
	})
}

func listTables(db Database, filter string) (string, error) {
	tables, err := db.ListTables()
	if err != nil {
		return "", err
	}
	if filter = strings.ToLower(strings.TrimSpace(filter)); filter != "" {
		tables = slices.DeleteFunc(slices.Clone(tables), func(t string) bool {
			return !strings.Contains(strings.ToLower(t), filter)
		})
	}
	slices.Sort(tables)
	out := map[string]any{"tables": tables}
	if n := len(tables); n > maxListedTables {
		out["tables"] = tables[:maxListedTables]
		out["more"] = fmt.Sprintf("%d more; narrow the list with filter", n-maxListedTables)
	}
	return toJSON(out), nil
}

func describeTable(db Database, table string) (string, error) {
	ddl, err := db.GetDDL(strings.TrimSpace(table))
	if err != nil {
		return "", err
	}
	return truncate(ddl, maxToolOutput), nil
}

func runQuery(ctx context.Context, db Database, sql string, limit int) (QueryPreview, error) {
	if limit < 1 {
		limit = defaultQueryRows
	}
	limit = min(limit, maxQueryRows)
	// One extra row tells whether there are more.
	res, err := db.ReadOnlyQuery(ctx, sql, limit+1)
	if err != nil {
		return QueryPreview{}, err
	}
	return previewRows(res, limit), nil
}

// previewRows keeps up to limit rows that fit in maxToolOutput as JSON, in
// column order, with long values cut.
func previewRows(res common.QueryResult, limit int) QueryPreview {
	p := QueryPreview{
		Columns:  res.Columns,
		Rows:     make([][]any, 0, min(len(res.Data), limit)),
		MoreRows: len(res.Data) > limit,
		Ms:       res.TimeElapsed,
	}
	size := 0
	for _, r := range res.Data[:min(len(res.Data), limit)] {
		row := make([]any, len(res.Columns))
		for i, col := range res.Columns {
			row[i] = cell(r[col])
		}
		b, err := json.Marshal(row)
		if err != nil {
			row, b = []any{"unreadable row"}, []byte(`["unreadable row"]`)
		}
		if size += len(b); size > maxToolOutput {
			p.MoreRows = true
			break
		}
		p.Rows = append(p.Rows, row)
	}
	return p
}

// cell makes a value short and JSON-friendly.
func cell(v any) any {
	switch v := v.(type) {
	case nil, bool, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		return v
	case string:
		return truncate(v, maxCellChars)
	case []byte:
		return truncate(string(v), maxCellChars)
	case time.Time:
		return v.Format(time.RFC3339Nano)
	case fmt.Stringer:
		return truncate(v.String(), maxCellChars)
	default:
		return truncate(fmt.Sprint(v), maxCellChars)
	}
}

func toJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf(`{"error":%q}`, err.Error())
	}
	return string(b)
}
