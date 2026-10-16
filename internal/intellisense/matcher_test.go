package intellisense

import (
	"testing"
)

func TestNormalizeSQL(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "lowercase conversion",
			input:    "SELECT * FROM Users",
			expected: "select * from users",
		},
		{
			name:     "whitespace normalization",
			input:    "SELECT   *   FROM   users",
			expected: "select * from users",
		},
		{
			name:     "trim whitespace",
			input:    "  SELECT * FROM users  ",
			expected: "select * from users",
		},
		{
			name:     "tabs and newlines",
			input:    "SELECT\t*\nFROM\r\nusers",
			expected: "select * from users",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeSQL(tt.input)
			if result != tt.expected {
				t.Errorf("normalizeSQL(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestFindHistoryMatch(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		history  []string
		expected string
	}{
		{
			name:  "basic match",
			input: "SELECT * FROM",
			history: []string{
				"SELECT * FROM users WHERE id = 1",
				"SELECT * FROM orders",
			},
			expected: " users",
		},
		{
			name:  "no match",
			input: "DELETE FROM",
			history: []string{
				"SELECT * FROM users",
				"SELECT * FROM orders",
			},
			expected: "",
		},
		{
			name:     "empty input",
			input:    "",
			history:  []string{"SELECT * FROM users"},
			expected: "",
		},
		{
			name:     "empty history",
			input:    "SELECT",
			history:  []string{},
			expected: "",
		},
		{
			name:  "frequency ranking",
			input: "SELECT * FROM",
			history: []string{
				"SELECT * FROM users WHERE id = 1",
				"SELECT * FROM orders",
				"SELECT * FROM orders",
				"SELECT * FROM orders",
			},
			expected: " orders",
		},
		{
			name:  "keyword breaking at WHERE",
			input: "SELECT * FROM users",
			history: []string{
				"SELECT * FROM users WHERE id = 1 AND name = 'test'",
			},
			expected: " WHERE id = 1 AND name = 'test'",
		},
		{
			name:  "leading keyword kept, break at next clause",
			input: "SELECT * FROM users",
			history: []string{
				"SELECT * FROM users WHERE id = 1 ORDER BY name",
			},
			expected: " WHERE id = 1",
		},
		{
			name:  "whitespace normalization",
			input: "SELECT  *  FROM",
			history: []string{
				"SELECT * FROM users WHERE id = 1",
			},
			expected: " users",
		},
		{
			name:  "short input SEL ranked by frequency",
			input: "SEL",
			history: []string{
				"SELECT id, name FROM users",
				"SELECT * FROM orders",
				"SELECT * FROM orders",
			},
			expected: "ECT * FROM orders",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FindHistoryMatch(tt.input, tt.history)
			if result != tt.expected {
				t.Errorf("FindHistoryMatch(%q, %v) = %q, want %q", tt.input, tt.history, result, tt.expected)
			}
		})
	}
}

func TestBreakAtNextKeyword(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "break at ORDER BY",
			input:    "abc ORDER BY id",
			expected: "abc",
		},
		{
			name:     "break at WHERE",
			input:    " users WHERE id = 1",
			expected: " users",
		},
		{
			name:     "no keyword",
			input:    " users",
			expected: " users",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "keyword at start - no break",
			input:    "WHERE id = 1",
			expected: "WHERE id = 1",
		},
		{
			name:     "keyword after leading space - no break",
			input:    " WHERE id = 1 LIMIT 10",
			expected: " WHERE id = 1",
		},
		{
			name:     "no break at JOIN",
			input:    " users JOIN orders ON users.id = orders.user_id",
			expected: " users JOIN orders ON users.id = orders.user_id",
		},
		{
			name:     "keyword too close to start - no break",
			input:    " * FROM users",
			expected: " * FROM users",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := breakAtNextKeyword(tt.input)
			if result != tt.expected {
				t.Errorf("breakAtNextKeyword(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestFindMatchEndIndex(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		query    string
		expected int
	}{
		{
			name:     "exact prefix match",
			input:    "SELECT * FROM",
			query:    "SELECT * FROM users",
			expected: 13,
		},
		{
			name:     "whitespace normalization",
			input:    "SELECT  *  FROM",
			query:    "SELECT * FROM users",
			expected: 13,
		},
		{
			name:     "no match",
			input:    "DELETE FROM",
			query:    "SELECT * FROM users",
			expected: -1,
		},
		{
			name:     "case insensitive",
			input:    "select * from",
			query:    "SELECT * FROM users",
			expected: 13,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := findMatchEndIndex(tt.input, tt.query)
			if result != tt.expected {
				t.Errorf("findMatchEndIndex(%q, %q) = %d, want %d", tt.input, tt.query, result, tt.expected)
			}
		})
	}
}
