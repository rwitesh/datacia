package app

import (
	"datacia/internal/ai"
	"datacia/internal/clipboard"
	"datacia/internal/constants"
	"datacia/internal/db"
	"datacia/internal/files"
	"datacia/internal/intellisense"
	"datacia/internal/license"
	"datacia/internal/logger"
	"datacia/internal/queries"
	"datacia/internal/security"
	"datacia/internal/settings"
	"datacia/pkg/remote"
	"embed"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"go.uber.org/zap"
	clip "golang.design/x/clipboard"
	"gopkg.in/yaml.v3"
)

type AppManager interface {
	Initialize() error
	GetApplication() *application.App
	GetStore() *db.Store
	Run() error
}

type App struct {
	instance           *application.App
	connectionWindow   *application.WebviewWindow
	editorWindow       *application.WebviewWindow
	licenseWindow      *application.WebviewWindow
	settingsWindow     *application.WebviewWindow
	engine             *remote.Engine
	config             *Config
	windowMutex        sync.Mutex
	closingIntentional bool
}

type Config struct {
	Info struct {
		Version string `yaml:"version"`
	} `yaml:"info"`
}

func NewApp(assets embed.FS, config []byte) (*App, error) {
	var cfg *Config
	if err := yaml.Unmarshal(config, &cfg); err != nil {
		logger.Logger.Error("Failed to parse config.yml", zap.Error(err))
		return nil, fmt.Errorf("failed to parse config.yml: %w", err)
	}

	app := application.New(application.Options{
		Name:        constants.APP_NAME,
		Description: "",
		Assets: application.AssetOptions{
			Handler:        application.AssetFileServerFS(assets),
			DisableLogging: true,
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})

	return &App{instance: app, config: cfg}, nil
}

func (a *App) Initialize() error {
	version := a.config.Info.Version
	if version == "" {
		logger.Logger.Error("Version cannot be empty in config")
		return errors.New("version cannot be empty")
	}

	// Initialize security context once at startup
	if err := security.InitSecurityContext(); err != nil {
		logger.Logger.Error("Failed to initialize security context", zap.Error(err))
		return fmt.Errorf("failed to initialize security context: %w", err)
	}

	// Initialize settings
	settings.Init(a.instance)
	settings.SetAppVersion(version)

	// Init clipboard
	if err := clip.Init(); err != nil {
		logger.Logger.Error("Failed to initialize clipboard", zap.Error(err))
		return fmt.Errorf("failed to initialize clipboard: %w", err)
	}

	engine, err := remote.New(a, version)
	if err != nil {
		logger.Logger.Error("Failed to create remote engine", zap.Error(err), zap.String("version", version))
		return err
	}

	a.engine = engine

	// Services that should be exposed to UI
	engine.SetApplication(a.instance)
	a.instance.RegisterService(application.NewService(engine))

	// License management
	licenseService := license.NewLicenseService(a.instance)
	a.instance.RegisterService(application.NewService(licenseService))

	// Validate license on startup (non-blocking)
	if err := licenseService.ValidateOnStart(); err != nil {
		logger.Logger.Warn("Failed to start license validation", zap.Error(err))
	}

	// Saving files // exporting data
	fileService := files.NewFileService(a.instance)
	a.instance.RegisterService(application.NewService(fileService))

	// Copying to clipboard
	clipboardService := clipboard.NewClipboardService(a.instance)
	a.instance.RegisterService(application.NewService(clipboardService))

	// Storing, writing, reading, etc. queries
	queriesService := queries.NewQueriesService(a.instance)
	a.instance.RegisterService(application.NewService(queriesService))

	// Settings service (app info + settings)
	settingsService := settings.NewService(a.instance)
	a.instance.RegisterService(application.NewService(settingsService))

	// Intellisense (ghost text suggestions)
	intellisenseService := intellisense.NewService(a.instance, engine.GetStore())
	a.instance.RegisterService(application.NewService(intellisenseService))

	// AI chat service
	aiService := ai.NewService(a.instance)
	a.instance.RegisterService(application.NewService(aiService))

	return nil
}

func (a *App) createConnectionWindow() error {
	a.connectionWindow = a.instance.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:  constants.CONNECTION_WINDOW_NAME,
		Title: constants.APP_TITLE,
		URL:   "/",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHidden,
		},
		Windows: application.WindowsWindow{
			DisableFramelessWindowDecorations: true,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		Width:            constants.CONNECTION_WINDOW_WIDTH,
		Height:           constants.CONNECTION_WINDOW_HEIGHT,
	})

	if a.connectionWindow == nil {
		logger.Logger.Error("Failed to create connection window")
		return fmt.Errorf("failed to create connection window")
	}

	a.connectionWindow.Center()
	a.connectionWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		if a.closingIntentional {
			return
		}

		// If editor window is open, just close this window (default behavior) and return
		// Do not quit the application
		if a.editorWindow != nil {
			logger.Logger.Info("Connection window closing, editor remains open")
			return
		}

		logger.Logger.Info("Connection window closing, quitting application")
		a.instance.Quit()
	})

	return nil
}

func (a *App) createEditorWindow() error {
	a.editorWindow = a.instance.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:  constants.EDITOR_WINDOW_NAME,
		Title: constants.APP_TITLE,
		URL:   "/#/editor",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		Windows: application.WindowsWindow{
			DisableFramelessWindowDecorations: true,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		Width:            constants.EDITOR_WINDOW_WIDTH,
		Height:           constants.EDITOR_WINDOW_HEIGHT,
		MinWidth:         800,
		MinHeight:        600,
	})

	if a.editorWindow == nil {
		logger.Logger.Error("Failed to create editor window")
		return fmt.Errorf("failed to create editor window")
	}

	a.editorWindow.Center()
	a.editorWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		if a.closingIntentional {
			return
		}
		logger.Logger.Info("Editor window closing, treating as disconnect")
		if a.engine != nil {
			_ = a.engine.CloseCurrentConnection(false)
		}
		a.editorWindow = nil
		if err := a.createConnectionWindow(); err != nil {
			logger.Logger.Error("Failed to create connection window after editor close", zap.Error(err))
			a.instance.Quit()
		}
	})

	return nil
}

func (a *App) GetApplication() *application.App {
	return a.instance
}

func (a *App) GetWindow() *application.WebviewWindow {
	if a.editorWindow != nil {
		return a.editorWindow
	}
	return a.connectionWindow
}

func (a *App) OpenEditor() {
	a.windowMutex.Lock()
	defer a.windowMutex.Unlock()

	if a.editorWindow != nil {
		logger.Logger.Debug("Editor window already exists, skipping window transition")
		a.editorWindow.Show()
		a.editorWindow.Focus()
		// Even if editor exists, ensure connection window is closed
		if a.connectionWindow != nil {
			a.closingIntentional = true
			a.connectionWindow.Close()
			a.connectionWindow = nil
			a.closingIntentional = false
		}
		return
	}

	// Create new window FIRST
	if err := a.createEditorWindow(); err != nil {
		logger.Logger.Error("Failed to open editor window", zap.Error(err))
		// If failed, do NOT close the connection window so the app doesn't vanish
		return
	}

	// If successful, close the old window
	if a.connectionWindow != nil {
		a.closingIntentional = true
		a.connectionWindow.Close()
		a.connectionWindow = nil
		a.closingIntentional = false
	}
}

func (a *App) CloseEditor() {
	a.windowMutex.Lock()
	defer a.windowMutex.Unlock()

	if a.connectionWindow != nil {
		logger.Logger.Debug("Connection window already exists, skipping window transition")
		a.connectionWindow.Show()
		a.connectionWindow.Focus()
		// Ensure editor window is closed if it exists (though usually it shouldn't if we are in this state, but for safety)
		if a.editorWindow != nil {
			a.closingIntentional = true
			a.editorWindow.Close()
			a.editorWindow = nil
			a.closingIntentional = false
		}
		return
	}

	// Create new window FIRST
	if err := a.createConnectionWindow(); err != nil {
		logger.Logger.Error("Failed to open connection window", zap.Error(err))
		// If failed, do NOT close the editor window so the app doesn't vanish
		return
	}

	// If successful, close the old window
	if a.editorWindow != nil {
		a.closingIntentional = true
		a.editorWindow.Close()
		a.editorWindow = nil
		a.closingIntentional = false
	}
}

func (a *App) OpenConnectionWindow() {
	a.windowMutex.Lock()
	defer a.windowMutex.Unlock()

	if a.connectionWindow != nil {
		logger.Logger.Debug("Connection window already exists, focusing")
		a.connectionWindow.Show()
		a.connectionWindow.Focus()
		return
	}

	// Create new window
	if err := a.createConnectionWindow(); err != nil {
		logger.Logger.Error("Failed to open connection window", zap.Error(err))
		return
	}
}

func (a *App) createLicenseWindow() error {
	a.licenseWindow = a.instance.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:  constants.LICENSE_WINDOW_NAME,
		Title: "License Management",
		URL:   "/#/license",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHidden,
		},
		Windows: application.WindowsWindow{
			DisableFramelessWindowDecorations: true,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		Width:            constants.LICENSE_WINDOW_WIDTH,
		Height:           constants.LICENSE_WINDOW_HEIGHT,
	})

	if a.licenseWindow == nil {
		logger.Logger.Error("Failed to create license window")
		return fmt.Errorf("failed to create license window")
	}

	a.licenseWindow.Center()
	a.licenseWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		a.licenseWindow = nil
	})

	return nil
}

func (a *App) OpenLicenseWindow() {
	a.windowMutex.Lock()
	defer a.windowMutex.Unlock()

	if a.licenseWindow != nil {
		logger.Logger.Debug("License window already exists, focusing")
		a.licenseWindow.Show()
		a.licenseWindow.Focus()
		return
	}

	if err := a.createLicenseWindow(); err != nil {
		logger.Logger.Error("Failed to open license window", zap.Error(err))
		return
	}
}

func (a *App) createSettingsWindow(tab string) error {
	url := "/#/settings"
	if tab == "ai" {
		url = "/#/settings?tab=ai"
	}
	a.settingsWindow = a.instance.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:  constants.SETTINGS_WINDOW_NAME,
		Title: "Settings",
		URL:   url,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHidden,
		},
		Windows: application.WindowsWindow{
			DisableFramelessWindowDecorations: true,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		Width:            constants.SETTINGS_WINDOW_WIDTH,
		Height:           constants.SETTINGS_WINDOW_HEIGHT,
	})

	if a.settingsWindow == nil {
		logger.Logger.Error("Failed to create settings window")
		return fmt.Errorf("failed to create settings window")
	}

	a.settingsWindow.Center()
	a.settingsWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		a.settingsWindow = nil
	})

	return nil
}

func (a *App) OpenSettingsWindow(tab string) {
	a.windowMutex.Lock()
	defer a.windowMutex.Unlock()

	if a.settingsWindow != nil {
		logger.Logger.Debug("Settings window already exists, focusing")
		a.settingsWindow.Show()
		a.settingsWindow.Focus()
		return
	}

	if err := a.createSettingsWindow(tab); err != nil {
		logger.Logger.Error("Failed to open settings window", zap.Error(err))
		return
	}
}

func (a *App) Run() error {
	if err := a.createConnectionWindow(); err != nil {
		logger.Logger.Error("Failed to create connection window", zap.Error(err))
		return err
	}

	go func() {
		for {
			now := time.Now().Format(time.RFC1123)
			a.instance.Event.Emit("time", now)
			time.Sleep(time.Second)
		}
	}()

	err := a.instance.Run()
	if err != nil {
		logger.Logger.Error("Application run failed", zap.Error(err))
	}
	return err
}

func (a *App) GetStore() *db.Store {
	if a.engine == nil {
		return nil
	}
	return a.engine.GetStore()
}
