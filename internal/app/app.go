package app

import (
	"datacia/internal/clipboard"
	"datacia/internal/constants"
	"datacia/internal/db"
	"datacia/internal/files"
	"datacia/internal/queries"
	"datacia/pkg/remote"
	"embed"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gopkg.in/yaml.v3"
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
	config   *Config
}

type Config struct {
	Info struct {
		Version string `yaml:"version"`
	} `yaml:"info"`
	Other []struct {
		ReleaseURL string `yaml:"release_url"`
	} `yaml:"other"`
}

func NewApp(assets embed.FS, config []byte) (*App, error) {
	var cfg *Config
	if err := yaml.Unmarshal(config, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config.yml: %w", err)
	}

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
	return &App{instance: app, config: cfg}, nil
}

func (a *App) Initialize() error {
	version := a.config.Info.Version
	if version == "" {
		return errors.New("version cannot be empty")
	}

	var releaseURL string
	if len(a.config.Other) > 0 && a.config.Other[0].ReleaseURL != "" {
		releaseURL = a.config.Other[0].ReleaseURL
	}
	if releaseURL == "" {
		return errors.New("release url cannot be empty")
	}

	engine, err := remote.New(a, version, releaseURL)
	if err != nil {
		return err
	}

	a.engine = engine
	engine.SetApplication(a.instance)
	a.instance.RegisterService(application.NewService(engine))

	fileService := files.NewFileService(a.instance)
	a.instance.RegisterService(application.NewService(fileService))

	clipboardService := clipboard.NewClipboardService(a.instance)
	a.instance.RegisterService(application.NewService(clipboardService))

	queriesService := queries.NewQueriesService(a.instance)
	a.instance.RegisterService(application.NewService(queriesService))

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
