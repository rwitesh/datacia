package clipboard

import (
	"github.com/wailsapp/wails/v3/pkg/application"
)

type ClipboardService struct {
	app *application.App
}

func NewClipboardService(app *application.App) *ClipboardService {
	return &ClipboardService{
		app: app,
	}
}

// SetText sets the system clipboard content to the given text.
func (s *ClipboardService) SetText(text string) error {
	s.app.Clipboard.SetText(text)
	return nil
}
