package clipboard

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	clip "golang.design/x/clipboard"
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
func (s *ClipboardService) SetContent(content []byte, contentType string) error {
	if contentType == "image" {
		clip.Write(clip.FmtImage, content)
	} else {
		clip.Write(clip.FmtText, content)
	}
	return nil
}
