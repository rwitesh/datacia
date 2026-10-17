package ai

import (
	"fmt"
	"strings"
)

const (
	maxHistory       = 20
	maxContextSQL    = 8000
	maxContextError  = 2000
	maxContextTables = 200
)

// ChatContext is the editor state sent along with the conversation.
type ChatContext struct {
	Engine string   `json:"engine"`
	SQL    string   `json:"sql"`
	Error  string   `json:"error"`
	Tables []string `json:"tables"`
}

func systemPrompt(c ChatContext) string {
	engine := c.Engine
	if engine == "" {
		engine = "SQL"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "You are a %s expert helping a user of DataCia, a desktop SQL client. ", engine)
	fmt.Fprintf(&b, "Write SQL that is valid for %s. ", engine)
	b.WriteString("Put every query in a ```sql fenced code block. ")
	b.WriteString("Be concise: answer directly, skip introductions and generic advice. ")
	b.WriteString("Use the table names below when relevant; if you need columns you don't know, ask for that table's schema. ")
	b.WriteString("When useful, add one short tip about performance or indexing.")

	if len(c.Tables) > 0 {
		tables, more := c.Tables, ""
		if len(tables) > maxContextTables {
			more = fmt.Sprintf(" (and %d more)", len(tables)-maxContextTables)
			tables = tables[:maxContextTables]
		}
		fmt.Fprintf(&b, "\n\nTables in the current database: %s%s.", strings.Join(tables, ", "), more)
	}
	if sql := strings.TrimSpace(c.SQL); sql != "" {
		fmt.Fprintf(&b, "\n\nThe query in the user's editor:\n```sql\n%s\n```", truncate(sql, maxContextSQL))
	}
	if e := strings.TrimSpace(c.Error); e != "" {
		fmt.Fprintf(&b, "\n\nRunning it failed with:\n%s", truncate(e, maxContextError))
	}
	return b.String()
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
