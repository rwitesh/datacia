package app

import (
	"datacia/internal/constants"
	"datacia/internal/db"
	"datacia/pkg/remote"
	"embed"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type AppManager interface {
	Initialize() error
	GetApplication() *application.App
	GetStore() *db.Store
	Run() error
}

type App struct {
	instance *application.App
	window   *application.WebviewWindow
	engine   *remote.Engine
}

func NewApp(assets embed.FS) (*App, error) {
	app := application.New(application.Options{
		Name:        constants.APP_NAME,
		Description: "",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	return &App{instance: app}, nil
}

func (a *App) Initialize() error {
	engine, err := remote.New(a)
	if err != nil {
		return err
	}

	a.engine = engine
	engine.SetApplication(a.instance)
	a.instance.RegisterService(application.NewService(engine))
	return nil
}

func (a *App) CreateMainWindow() error {
	a.window = a.instance.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:  constants.APP_NAME,
		Title: constants.APP_TITLE,
		URL:   "/",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		Width:            constants.CONNECTION_WINDOW_WIDTH,
		Height:           constants.CONNECTION_WINDOW_HEIGHT,
	})

	if a.window == nil {
		return log.New(log.Writer(), "", log.LstdFlags).Output(1, "failed to create window")
	}

	return nil
}

func (a *App) GetApplication() *application.App {
	return a.instance
}

func (a *App) GetWindow() *application.WebviewWindow {
	return a.window
}

func (a *App) OpenEditor() {
	if a.window != nil {
		a.window.SetSize(constants.EDITOR_WINDOW_WIDTH, constants.EDITOR_WINDOW_HEIGHT)
		a.window.Center()
		a.window.SetResizable(true)
		a.window.SetMaximiseButtonState(0)
	}
}

func (a *App) CloseEditor() {
	if a.window != nil {
		a.window.SetSize(constants.CONNECTION_WINDOW_WIDTH, constants.CONNECTION_WINDOW_HEIGHT)
		a.window.Center()
		a.window.SetResizable(false)
		a.window.SetMaximiseButtonState(1)
	}
}

func (a *App) Run() error {
	if err := a.CreateMainWindow(); err != nil {
		return err
	}

	go func() {
		for {
			now := time.Now().Format(time.RFC1123)
			a.instance.Event.Emit("time", now)
			time.Sleep(time.Second)
		}
	}()

	return a.instance.Run()
}

func (a *App) GetStore() *db.Store {
	if a.engine == nil {
		return nil
	}
	return a.engine.GetStore()
}
