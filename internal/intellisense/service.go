package intellisense

import (
	"datacia/internal/db"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type Service struct {
	app   *application.App
	store *db.Store
}

func NewService(app *application.App, store *db.Store) *Service {
	return &Service{
		app:   app,
		store: store,
	}
}

// GetSuggestion returns a ghost text suggestion for the given SQL input.
// Parameters:
//   - currentInput: The SQL text the user has typed so far
//   - engine: Filter history by this engine (e.g. "postgres", "clickhouse"); "" means all
func (s *Service) GetSuggestion(currentInput string, engine string) string {
	if currentInput == "" || s.store == nil {
		return ""
	}

	// Fetch history from database (limit to recent 100 for performance); engine from connection info
	historyItems, err := s.store.GetQueryHistory(100, "", "", "", "success", engine)
	if err != nil {
		return ""
	}

	// Use all successful queries; ranking by frequency surfaces the best suggestions
	var history []string
	for _, item := range historyItems {
		if strings.TrimSpace(item.Query) != "" {
			history = append(history, item.Query)
		}
	}

	if len(history) == 0 {
		return ""
	}

	// Find the best matching suggestion
	return FindHistoryMatch(currentInput, history)
}
