package files

import (
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type FileService struct {
	app *application.App
}

func NewFileService(app *application.App) *FileService {
	return &FileService{
		app: app,
	}
}

// SaveFile prompts the user to choose a location and saves the content to that file.
func (s *FileService) SaveFile(filename string, content string) (string, error) {
	// TODO: Find correct methods for setting Title and DefaultFilename in this Wails 3 version.
	path, err := application.SaveFileDialog().SetFilename(filename).PromptForSingleSelection()

	if err != nil {
		return "", err
	}

	// If path is empty, user might have cancelled (though usually err handles it or empty path)
	if path == "" {
		return "", nil
	}

	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return "", err
	}

	return path, nil
}
