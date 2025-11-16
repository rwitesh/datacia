package app

import (
	"embed"
	"layerbits/internal/constants"
	"layerbits/internal/db"
	"layerbits/pkg/remote"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type AppManager interface {
	Initialize(assets embed.FS) error
	GetApplication() *application.App
	GetStore() *db.Store
	Run() error
}

type UIController interface {
	OpenEditor()
	CloseEditor()
}

type App struct {
	wailsApp *application.App
	window   *application.WebviewWindow
	engine   *remote.Engine
}

func NewApp() *App {
	return &App{}
}

func (a *App) Initialize(assets embed.FS) error {
	a.wailsApp = application.New(application.Options{
		Name:        constants.APP_NAME,
		Description: "",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	engine, err := remote.New(a)
	if err != nil {
		return err
	}

	a.engine = engine
	engine.SetApplication(a.wailsApp)

	a.wailsApp.RegisterService(application.NewService(engine))

	return nil
}

func (a *App) CreateMainWindow() error {
	a.window = a.wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
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
	return a.wailsApp
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
			a.wailsApp.Event.Emit("time", now)
			time.Sleep(time.Second)
		}
	}()

	return a.wailsApp.Run()
}
