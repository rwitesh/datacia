package ai

import (
	"fmt"
	"slices"
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

// systemPrompt never varies, so providers can cache it; chat facts go in the messages.
var systemPrompt = fmt.Sprintf(`You are a SQL expert in DataCia, a desktop SQL client, connected to the user's database. The conversation starts by naming its engine; write SQL for that engine. You can only read the database.

Look things up with the tools rather than guessing. Read the editor when the user mentions their query or an error, and describe a table before querying columns you haven't seen.

Treat the database as large and busy:
- Check a table's size from the database's catalog or system tables before aggregating it.
- Filter large tables on partition, sort or indexed columns, often a recent time range. Never scan a whole large table.
- Select only the columns you need and ask for as few rows as answer the question, usually 10-20. If they don't, change the filter or range rather than asking for many more rows.
- Queries stop after %d seconds. After a timeout, narrow the query instead of retrying it.

Say in a sentence what you are checking before each query, and stop once you can answer. End with a short, clear answer. Write any SQL for the user to run, including changes, in sql code blocks.`, int(common.QUERY_TIMEOUT.Seconds()))

// withEngine names the engine on the first message, keeping the system prompt fixed.
func withEngine(history []Message, engine string) []Message {
	if len(history) == 0 || engine == "" {
		return history
	}
	out := slices.Clone(history)
	out[0].Content = fmt.Sprintf("[Database engine: %s]\n\n%s", engine, out[0].Content)
	return out
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
