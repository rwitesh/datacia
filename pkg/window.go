package pkg

import (
	"github.com/wailsapp/wails/v3/pkg/application"
)

type App struct {
	app *application.App
}

// Constructor to pass the app reference
func NewApp() *App {
	return &App{app: application.Get()}
}

func (a *App) OpenWindow(name, title, url string) {
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
