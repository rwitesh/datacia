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
	return fmt.Sprintf(`You are a %[1]s expert in DataCia, a desktop SQL client, connected to the user's %[1]s database. You can only read it.

Look things up with the tools rather than guessing. Read the editor when the user mentions their query or an error, and describe a table before querying columns you haven't seen.

Treat the database as large and busy:
- Check a table's size from the database's catalog or system tables before aggregating it.
- Filter large tables on partition, sort or indexed columns, often a recent time range. Never scan a whole large table.
- Select only the columns you need and ask for as few rows as answer the question, usually 10-20. If they don't, change the filter or range rather than asking for many more rows.
- Queries stop after %[2]d seconds. After a timeout, narrow the query instead of retrying it.

Say in a sentence what you are checking before each query, and stop once you can answer. End with a short, clear answer. Write any SQL for the user to run, including changes, in sql code blocks valid for %[1]s.`, cmp.Or(engine, "SQL"), int(common.QUERY_TIMEOUT.Seconds()))
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
