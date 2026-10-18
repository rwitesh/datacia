package clipboard

import (
	"context"
	"encoding/base64"

	clip "golang.design/x/clipboard"
)

type ClipboardService struct{}

func NewClipboardService() *ClipboardService {
	return &ClipboardService{}
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
		_, err = clip.Write(context.Background(), clip.FmtImage, decoded)
		return err
	}
	// For text, convert string directly to bytes
	_, err := clip.Write(context.Background(), clip.FmtText, []byte(content))
	return err
}
