package ai

import (
	"cmp"
	"fmt"
	"strings"

	"datacia/pkg/common"
)

const maxHistory = 20

// ChatContext is the editor as it was when the message was sent. The model
// reads it through the get_editor tool, not the prompt.
type ChatContext struct {
	Engine string `json:"engine"`
	SQL    string `json:"sql"`
	Error  string `json:"error"` // from the query's last run
}

// systemPrompt varies only with the engine, so providers can cache it with
// the tool definitions across a chat's steps and messages.
func systemPrompt(engine string) string {
	return fmt.Sprintf(`You are a %[1]s expert in DataCia, a desktop SQL client, working with the user's connected %[1]s database.

Use the tools instead of guessing:
- get_editor when the user refers to their query or an error.
- list_tables and describe_table before writing SQL against tables you haven't seen.
- run_query to look at real data, check assumptions and answer questions about the data.

The database may be large and in use, so keep every query cheap:
- Before aggregating a table, find out how big it is from the database's own catalog or system tables (row estimates, partitions, sizes), not by counting rows.
- Get counts, sizes and date ranges from that metadata when you can.
- On large tables, filter on partition, sort or indexed columns (often a recent time range), select only the columns you need and use LIMIT. Never scan a whole large table.
- Queries stop after %[2]d seconds. If one times out, don't retry it or anything as broad; narrow it or use metadata.

Work in short steps: say in a sentence what you are about to check, then what it showed. Stop researching once you can answer.

You can only read. When the user wants to change data or schema, write the statement for them to run.
End with a clear, brief answer from what you found. Put SQL meant for the user in sql fenced code blocks, valid for %[1]s.`, cmp.Or(engine, "SQL"), int(common.QUERY_TIMEOUT.Seconds()))
}

// normalizeHistory drops empty turns, merges consecutive turns from the same
// role and keeps the latest messages, starting with a user turn.
func normalizeHistory(in []Message) []Message {
	out := make([]Message, 0, len(in))
	for _, m := range in {
		content := strings.TrimSpace(m.Content)
		if content == "" || (m.Role != "user" && m.Role != "assistant") {
			continue
		}
		if n := len(out); n > 0 && out[n-1].Role == m.Role {
			out[n-1].Content += "\n\n" + content
			continue
		}
		out = append(out, Message{Role: m.Role, Content: content})
	}
	if len(out) > maxHistory {
		out = out[len(out)-maxHistory:]
	}
	for len(out) > 0 && out[0].Role != "user" {
		out = out[1:]
	}
	return out
}
