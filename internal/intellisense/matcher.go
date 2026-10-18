// Package intellisense suggests SQL completions from query history (keyword-boundary breaks, frequency ranking).
package intellisense

import (
	"regexp"
	"strings"
	"unicode"
)

// SQL keywords that should terminate a suggestion.
// only break at major clause boundaries to give more complete suggestions.
var sqlBreakKeywords = []string{
	// Major filtering/grouping clauses (new logical section)
	"WHERE", "ORDER BY", "GROUP BY", "HAVING", "LIMIT",
	// Set operations (start new query context)
	"UNION", "UNION ALL", "EXCEPT", "INTERSECT",
	// DML statements (start new statement)
	"INSERT", "UPDATE", "DELETE",
	// DDL statements (start new statement)
	"CREATE", "DROP", "ALTER",
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
// A keyword that leads the text (only whitespace before it) is not a break,
// so a continuation like " WHERE id = 1" is suggested rather than dropped.
// Returns -1 if no keyword is found.
func findNextKeywordPosition(text string, startFrom int) int {
	upper := strings.ToUpper(text)
	earliest := -1

	// Skip leading whitespace plus one character so a leading keyword can't match.
	contentStart := len(text) - len(strings.TrimLeftFunc(text[startFrom:], unicode.IsSpace))

	for _, keyword := range sqlBreakKeywords {
		searchPos := contentStart + 1

		for searchPos < len(text) {
			idx := strings.Index(upper[searchPos:], keyword)
			if idx == -1 {
				break
			}

			absolutePos := searchPos + idx
			if isKeywordBoundary(text, absolutePos, len(keyword)) {
				// Found a valid keyword boundary
				breakPos := absolutePos - 1 // Exclude the space before keyword

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

	// Keyed by normalized text, so the same continuation counts once per query.
	suggestions := make(map[string]*suggestion)
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

		truncated := breakAtNextKeyword(query[matchEndIndex:])
		if strings.TrimSpace(truncated) == "" {
			continue
		}

		key := normalizeSQL(truncated)
		if sug, ok := suggestions[key]; ok {
			sug.frequency++
		} else {
			// History is newest first, so this is the most recent occurrence.
			suggestions[key] = &suggestion{text: truncated, frequency: 1, historyIndex: historyIdx}
		}
	}

	var best *suggestion
	for _, sug := range suggestions {
		if best == nil || sug.frequency > best.frequency ||
			(sug.frequency == best.frequency && sug.historyIndex < best.historyIndex) {
			best = sug
		}
	}
	if best == nil {
		return ""
	}
	return best.text
}
