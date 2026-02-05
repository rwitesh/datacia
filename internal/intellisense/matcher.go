// Package intellisense suggests SQL completions from query history (keyword-boundary breaks, frequency ranking).
package intellisense

import (
	"regexp"
	"sort"
	"strings"
	"unicode"
)

// SQL keywords that should terminate a suggestion.
var sqlBreakKeywords = []string{
	// Clauses
	"WITH", "SELECT", "FROM", "WHERE", "AND", "OR", "ORDER BY", "GROUP BY", "HAVING", "LIMIT", "OFFSET",
	// Joins
	"JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "CROSS JOIN", "FULL JOIN", "ON",
	// Set operations
	"UNION", "UNION ALL", "EXCEPT", "INTERSECT",
	// DML
	"INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
	// DDL
	"CREATE", "DROP", "ALTER", "INDEX", "TABLE", "DATABASE", "VIEW",
	// Conditionals
	"CASE", "WHEN", "THEN", "ELSE", "END",
	// Operators & modifiers
	"AS", "BETWEEN", "IN", "LIKE", "ILIKE", "IS", "NOT", "NULL", "EXISTS", "DISTINCT", "ASC", "DESC", "RETURNING",
}

var whitespaceRegex = regexp.MustCompile(`\s+`)

// normalizeSQL converts SQL to lowercase and collapses whitespace.
func normalizeSQL(sql string) string {
	s := strings.ToLower(sql)
	s = whitespaceRegex.ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

// isKeywordBoundary checks if a keyword at the given position is surrounded by proper boundaries.
func isKeywordBoundary(text string, startIdx int, keywordLength int) bool {
	runes := []rune(text)

	// Check character before keyword
	if startIdx > 0 && !unicode.IsSpace(runes[startIdx-1]) {
		return false
	}

	// Check character after keyword
	endIdx := startIdx + keywordLength
	if endIdx < len(runes) {
		next := runes[endIdx]
		if !unicode.IsSpace(next) && next != '(' && next != ',' && next != ';' {
			return false
		}
	}

	return true
}

// finds the position of the first keyword boundary after startFrom.
// Returns -1 if no keyword is found.
func findNextKeywordPosition(text string, startFrom int) int {
	upper := strings.ToUpper(text)
	earliest := -1

	for _, keyword := range sqlBreakKeywords {
		searchPos := startFrom

		for searchPos < len(text) {
			idx := strings.Index(upper[searchPos:], keyword)
			if idx == -1 {
				break
			}

			absolutePos := searchPos + idx
			if isKeywordBoundary(text, absolutePos, len(keyword)) {
				// Found a valid keyword boundary
				breakPos := absolutePos
				if absolutePos > startFrom {
					breakPos = absolutePos - 1 // Include space before keyword
				}

				if earliest == -1 || breakPos < earliest {
					earliest = breakPos
				}
				break
			}

			searchPos = absolutePos + 1
		}
	}

	return earliest
}

// breakAtNextKeyword truncates the suggestion at the next SQL keyword.
func breakAtNextKeyword(suggestion string) string {
	if suggestion == "" {
		return ""
	}

	pos := findNextKeywordPosition(suggestion, 0)
	if pos < 0 {
		// No keyword found, return entire suggestion
		return suggestion
	}
	if pos == 0 {
		// Keyword at start, return empty
		return ""
	}

	return strings.TrimRight(suggestion[:pos], " \t\n\r")
}

// findMatchEndIndex returns the byte offset in query where input ends (after normalizing whitespace).
// Returns -1 if query doesn't start with input.
func findMatchEndIndex(input string, query string) int {
	// First check normalized versions match
	if !strings.HasPrefix(normalizeSQL(query), normalizeSQL(input)) {
		return -1
	}

	inputRunes := []rune(strings.ToLower(input))
	queryRunes := []rune(strings.ToLower(query))

	inputIdx := 0
	queryIdx := 0

	for inputIdx < len(inputRunes) && queryIdx < len(queryRunes) {
		// Skip whitespace in input
		for inputIdx < len(inputRunes) && unicode.IsSpace(inputRunes[inputIdx]) {
			inputIdx++
		}

		// Skip whitespace in query
		for queryIdx < len(queryRunes) && unicode.IsSpace(queryRunes[queryIdx]) {
			queryIdx++
		}

		// Check if we've consumed all of input
		if inputIdx >= len(inputRunes) {
			break
		}

		// Characters must match
		if queryIdx >= len(queryRunes) || inputRunes[inputIdx] != queryRunes[queryIdx] {
			return -1
		}

		inputIdx++
		queryIdx++
	}

	// Return the byte position in the original query
	return len(string(queryRunes[:queryIdx]))
}

type suggestion struct {
	text         string
	frequency    int
	historyIndex int // for recency tie-breaking
}

// returns the best continuation for currentInput from history.
// Suggestions are ranked by frequency (higher is better), then recency (lower index is more recent).
// Returns empty string if no match found.
func FindHistoryMatch(currentInput string, history []string) string {
	if currentInput == "" {
		return ""
	}

	normalizedInput := normalizeSQL(currentInput)
	if normalizedInput == "" {
		return ""
	}

	// Build frequency map and collect unique suggestions
	frequencyMap := make(map[string]int)
	suggestionMap := make(map[string]suggestion)

	for historyIdx, query := range history {
		normalizedQuery := normalizeSQL(query)

		// Skip if query doesn't start with input or is too short
		if !strings.HasPrefix(normalizedQuery, normalizedInput) {
			continue
		}
		if len(normalizedQuery) <= len(normalizedInput) {
			continue
		}

		// Find where the match ends in the original query
		matchEndIndex := findMatchEndIndex(currentInput, query)
		if matchEndIndex == -1 || matchEndIndex >= len(query) {
			continue
		}

		// Extract and truncate the suggestion
		continuation := query[matchEndIndex:]
		truncated := breakAtNextKeyword(continuation)

		if strings.TrimSpace(truncated) == "" {
			continue
		}

		// Use normalized version as key for deduplication
		key := normalizeSQL(truncated)
		frequencyMap[key]++

		// Keep the first occurrence (most recent) for each unique suggestion
		if _, exists := suggestionMap[key]; !exists {
			suggestionMap[key] = suggestion{
				text:         truncated,
				frequency:    0, // Will be set later
				historyIndex: historyIdx,
			}
		}
	}

	if len(suggestionMap) == 0 {
		return ""
	}

	// Convert to slice and set frequencies
	suggestions := make([]suggestion, 0, len(suggestionMap))
	for key, sug := range suggestionMap {
		sug.frequency = frequencyMap[key]
		suggestions = append(suggestions, sug)
	}

	// Sort by frequency (descending), then by recency (ascending index)
	sort.Slice(suggestions, func(i, j int) bool {
		if suggestions[i].frequency != suggestions[j].frequency {
			return suggestions[i].frequency > suggestions[j].frequency
		}
		return suggestions[i].historyIndex < suggestions[j].historyIndex
	})

	return suggestions[0].text
}
