package clipboard

import (
	"encoding/base64"

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

// SetContent sets the system clipboard content to the given text or image.
// For images, content should be base64-encoded image data.
// For text, content is the plain text string.
func (s *ClipboardService) SetContent(content string, contentType string) error {
	if contentType == "image" {
		// For images, decode base64
		decoded, err := base64.StdEncoding.DecodeString(content)
		if err != nil {
			return err
		}
		clip.Write(clip.FmtImage, decoded)
	} else {
		// For text, convert string directly to bytes
		clip.Write(clip.FmtText, []byte(content))
	}
	return nil
}
