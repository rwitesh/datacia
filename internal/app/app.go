package app

import (
	"context"
	"datacia/internal/ai"
	"datacia/internal/clipboard"
	"datacia/internal/constants"
	"datacia/internal/db"
	"datacia/internal/files"
	"datacia/internal/intellisense"
	"datacia/internal/logger"
	"datacia/internal/queries"
	"datacia/internal/security"
	"datacia/internal/sentry"
	"datacia/internal/settings"
	"datacia/internal/update"
	"datacia/pkg/remote"
	"embed"
	"fmt"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	clip "golang.design/x/clipboard"
)

// SettingsTabEvent asks the open settings window to switch to the tab named in its data.
const SettingsTabEvent = "settings:show-tab"

func init() {
	application.RegisterEvent[string](SettingsTabEvent)
}

type App struct {
	instance *application.App
	engine   *remote.Engine
	version  string

	// windowMutex guards the window fields and closingIntentional. Close()
	// only queues WindowClosing, so the hooks run later on another goroutine:
	// a window the app closes itself is cleared from its field first, and
	// the hooks ignore any window that is no longer current.
	windowMutex      sync.Mutex
	connectionWindow *application.WebviewWindow
	editorWindow     *application.WebviewWindow
	settingsWindow   *application.WebviewWindow
	// closingIntentional is set while quitting into an update so the hooks
	// don't treat that shutdown as the user closing a window.
	closingIntentional bool
}

func NewApp(assets embed.FS, version string) *App {
	a := &App{version: version}
	a.instance = application.New(application.Options{
		Name:        constants.APP_NAME,
		Description: "",
		Assets: application.AssetOptions{
			Handler:        application.AssetFileServerFS(assets),
			DisableLogging: true,
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
		// A second launch would open the same data.db and settings.json.
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               constants.APP_IDENTIFIER,
			OnSecondInstanceLaunch: func(application.SecondInstanceData) { a.showCurrentWindow() },
		},
		PanicHandler: logPanic,
	})

	return a
}

// showCurrentWindow brings the editor, or else the connection window, to the front.
func (a *App) showCurrentWindow() {
	a.windowMutex.Lock()
	defer a.windowMutex.Unlock()

	window := a.editorWindow
	if window == nil {
		window = a.connectionWindow
	}
	if window != nil {
		window.Show()
		window.Focus()
	}
}

// logPanic reports a recovered panic by its type and stack only. The panic
// value is left out because errors from bound calls can quote query text.
func logPanic(details *application.PanicDetails) {
	logger.Error("panic", "type", fmt.Sprintf("%T", details.Error), "stack", details.StackTrace)
	sentry.Flush()
}

func (a *App) Initialize() error {
	if err := security.InitSecurityContext(); err != nil {
		logger.Error("Failed to initialize security context", "error", err.Error())
		return err
	}

	settings.Init(a.instance, a.version)

	if err := clip.Init(); err != nil {
		// Only image copy needs it, so the app still starts without.
		logger.Error("Failed to initialize clipboard", "error", err.Error())
	}

	store, err := db.Open()
	if err != nil {
		logger.Error("Failed to open the local database", "error", err.Error())
		return err
	}
	a.engine = remote.New(a.instance, a, store)

	// Services exposed to the UI.
	a.instance.RegisterService(application.NewService(a.engine))
	a.instance.RegisterService(application.NewService(files.NewFileService(a.instance)))
	a.instance.RegisterService(application.NewService(clipboard.NewClipboardService()))
	a.instance.RegisterService(application.NewService(queries.NewQueriesService()))
	a.instance.RegisterService(application.NewService(settings.NewService()))
	a.instance.RegisterService(application.NewService(intellisense.NewService(store)))
	a.instance.RegisterService(application.NewService(ai.NewService(a.instance, a.engine)))
	return nil
}

func (a *App) createConnectionWindow() error {
	window := a.instance.Window.NewWithOptions(application.WebviewWindowOptions{
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

	if window == nil {
		logger.Error("Failed to create connection window")
		return fmt.Errorf("failed to create connection window")
	}

	a.connectionWindow = window
	window.Center()
	window.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		a.windowMutex.Lock()
		closedByUser := a.connectionWindow == window && !a.closingIntentional
		if closedByUser {
			a.connectionWindow = nil
		}
		quit := closedByUser && a.editorWindow == nil
		a.windowMutex.Unlock()

		// Closing the last window quits; with the editor open it just closes.
		if quit {
			a.instance.Quit()
		}
	})

	return nil
}

func (a *App) createEditorWindow() error {
	window := a.instance.Window.NewWithOptions(application.WebviewWindowOptions{
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

	if window == nil {
		logger.Error("Failed to create editor window")
		return fmt.Errorf("failed to create editor window")
	}

	a.editorWindow = window
	window.Center()
	window.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		a.windowMutex.Lock()
		if a.editorWindow != window || a.closingIntentional {
			a.windowMutex.Unlock()
			return
		}
		// The user closed the editor: disconnect and go back to the
		// connection window.
		a.editorWindow = nil
		var err error
		if a.connectionWindow != nil {
			a.connectionWindow.Show()
			a.connectionWindow.Focus()
		} else {
			err = a.createConnectionWindow()
		}
		a.windowMutex.Unlock()

		if a.engine != nil {
			_ = a.engine.CloseCurrentConnection(false)
		}
		if err != nil {
			logger.Error("Failed to create connection window after editor close", "error", err.Error())
			a.instance.Quit()
		}
	})

	return nil
}

// OpenEditor shows the editor and closes the connection window. The new window
// exists before the old one closes, so a failure never leaves the app without
// a window.
func (a *App) OpenEditor() {
	a.windowMutex.Lock()
	defer a.windowMutex.Unlock()

	if a.editorWindow != nil {
		a.editorWindow.Show()
		a.editorWindow.Focus()
	} else if err := a.createEditorWindow(); err != nil {
		logger.Error("Failed to open editor window", "error", err.Error())
		return
	}
	if a.connectionWindow != nil {
		a.connectionWindow.Close()
		a.connectionWindow = nil
	}
}

// CloseEditor is OpenEditor in reverse.
func (a *App) CloseEditor() {
	a.windowMutex.Lock()
	defer a.windowMutex.Unlock()

	if a.connectionWindow != nil {
		a.connectionWindow.Show()
		a.connectionWindow.Focus()
	} else if err := a.createConnectionWindow(); err != nil {
		logger.Error("Failed to open connection window", "error", err.Error())
		return
	}
	if a.editorWindow != nil {
		a.editorWindow.Close()
		a.editorWindow = nil
	}
}

func (a *App) OpenConnectionWindow() {
	a.windowMutex.Lock()
	defer a.windowMutex.Unlock()

	if a.connectionWindow != nil {
		a.connectionWindow.Show()
		a.connectionWindow.Focus()
		return
	}

	if err := a.createConnectionWindow(); err != nil {
		logger.Error("Failed to open connection window", "error", err.Error())
	}
}

// RestartForUpdate hands over to the staged update: the updater spawns its
// helper and quits the app. closingIntentional stops the WindowClosing hooks
// from treating that shutdown as the user closing a window. The lock isn't
// held across Restart, since the hooks it triggers take it.
func (a *App) RestartForUpdate() error {
	a.windowMutex.Lock()
	a.closingIntentional = true
	a.windowMutex.Unlock()

	if err := a.instance.Updater.Restart(context.Background()); err != nil {
		a.windowMutex.Lock()
		a.closingIntentional = false
		a.windowMutex.Unlock()
		return err
	}
	return nil
}

func (a *App) createSettingsWindow(tab string) error {
	url := "/#/settings"
	if tab == "ai" {
		url = "/#/settings?tab=ai"
	}
	window := a.instance.Window.NewWithOptions(application.WebviewWindowOptions{
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

	if window == nil {
		logger.Error("Failed to create settings window")
		return fmt.Errorf("failed to create settings window")
	}

	a.settingsWindow = window
	window.Center()
	window.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		a.windowMutex.Lock()
		if a.settingsWindow == window {
			a.settingsWindow = nil
		}
		a.windowMutex.Unlock()
	})

	return nil
}

func (a *App) OpenSettingsWindow(tab string) {
	a.windowMutex.Lock()
	defer a.windowMutex.Unlock()

	if a.settingsWindow != nil {
		// The open window keeps its unsaved edits, so switch its tab rather
		// than reloading it with the new URL.
		if tab != "" {
			a.instance.Event.Emit(SettingsTabEvent, tab)
		}
		a.settingsWindow.Show()
		a.settingsWindow.Focus()
		return
	}

	if err := a.createSettingsWindow(tab); err != nil {
		logger.Error("Failed to open settings window", "error", err.Error())
		return
	}
}

func (a *App) Run() error {
	if err := a.createConnectionWindow(); err != nil {
		logger.Error("Failed to create connection window", "error", err.Error())
		return err
	}
	logger.Info("app_launch")

	if enabled, err := update.Setup(a.instance, a.version); err != nil {
		logger.Error("Failed to configure auto-update", "error", err.Error())
	} else if enabled {
		update.CheckInBackground(a.instance, 5*time.Second)
	}

	err := a.instance.Run()
	if err != nil {
		logger.Error("Application run failed", "error", err.Error())
	}
	return err
}
