package runtime

import (
	"errors"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type App struct {
	app *application.App
}

// Constructor to pass the app reference
func New() (*App, error) {
	instance := application.Get()
	if instance == nil {
		return nil, errors.New("failed to get application instance")
	}
	return &App{app: instance}, nil
}

func (a *App) OpenWindow(name, title, url string, width, height int) {
	a.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:  name,
		Title: title,
		URL:   url,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		Width:            width,
		Height:           height,
	})
}

func (a *App) CloseWindow(name string) {
	if name == "connect" {
		a.app.Event.Emit("navigate", "/editor")
	}
	win, exists := a.app.Window.GetByName(name)
	if exists {
		win.Close()
	}
}
