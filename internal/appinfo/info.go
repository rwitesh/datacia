package appinfo

import (
	"encoding/json"
	"os"
	"runtime"
	"sync"

	"datacia/internal/paths"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type ThemeConfig string

const (
	ThemeSystem ThemeConfig = "system"
	ThemeLight  ThemeConfig = "light"
	ThemeDark   ThemeConfig = "dark"
)

type TokenColors struct {
	Keyword  string `json:"keyword"`
	String   string `json:"string"`
	Number   string `json:"number"`
	Comment  string `json:"comment"`
	Function string `json:"function"`
	Variable string `json:"variable"`
	Type     string `json:"type"`
	Operator string `json:"operator"`
}

type EditorConfig struct {
	TokenColorsLight TokenColors `json:"tokenColorsLight"`
	TokenColorsDark  TokenColors `json:"tokenColorsDark"`
}

type FontConfig struct {
	UIFontFamily     string `json:"uiFontFamily"`
	UIFontSize       int    `json:"uiFontSize"`
	EditorFontFamily string `json:"editorFontFamily"`
	EditorFontSize   int    `json:"editorFontSize"`
}

type Settings struct {
	Theme  ThemeConfig  `json:"theme"`
	Editor EditorConfig `json:"editor"`
	Font   FontConfig   `json:"font"`
}

type Info struct {
	OS                string      `json:"os"`
	OSVersion         string      `json:"os_version"`
	Arch              string      `json:"arch"`
	Appearance        string      `json:"appearance"`
	Version           string      `json:"version"`
	Settings          Settings    `json:"settings"`
	ActiveTokenColors TokenColors `json:"activeTokenColors"`
	mu                sync.RWMutex
}

var (
	globalInfo     *Info
	globalInfoOnce sync.Once
	configDir      string
	appInstance    *application.App
)

func Init(app *application.App) {
	appInstance = app // Keep a reference
	var env = app.Env

	// Determine config directory
	if cd, err := paths.GetConfigDir(); err == nil {
		configDir = cd
	}

	globalInfoOnce.Do(func() {
		info := &Info{
			OS:        env.Info().OS,
			Arch:      env.Info().Arch,
			Version:   "unknown",
			OSVersion: env.Info().OSInfo.Version,
			Settings: Settings{
				Theme: ThemeSystem,
				Editor: EditorConfig{
					TokenColorsLight: TokenColors{},
					TokenColorsDark:  TokenColors{},
				},
				Font: FontConfig{
					UIFontFamily:     "Inter",
					UIFontSize:       14,
					EditorFontFamily: "JetBrains Mono",
					EditorFontSize:   14,
				},
			},
		}
		globalInfo = info
		loadSettings()
	})
}

func loadSettings() {
	if configDir == "" {
		return
	}
	settingsPath, err := paths.GetSettingsPath()
	if err != nil {
		return
	}
	data, err := os.ReadFile(settingsPath)
	if err == nil {
		var settings Settings
		if err := json.Unmarshal(data, &settings); err == nil {
			globalInfo.Settings = settings
		}
	}
}

func saveSettings() error {
	if configDir == "" {
		return nil
	}
	settingsPath, err := paths.GetSettingsPath()
	if err != nil {
		return err
	}

	globalInfo.mu.RLock()
	settings := globalInfo.Settings
	globalInfo.mu.RUnlock()

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(settingsPath, data, 0644)
}

func SetVersion(version string) {
	if globalInfo == nil {
		return
	}
	globalInfo.mu.Lock()
	defer globalInfo.mu.Unlock()
	globalInfo.Version = version
}

func Get() *Info {
	if globalInfo == nil {
		return &Info{
			OS:      runtime.GOOS,
			Arch:    runtime.GOARCH,
			Version: "unknown",
			Settings: Settings{
				Theme: ThemeSystem,
			},
		}
	}
	globalInfo.mu.RLock()
	defer globalInfo.mu.RUnlock()
	return globalInfo
}

type Service struct {
	app *application.App
}

func NewService(app *application.App) *Service {
	return &Service{app: app}
}

func (s *Service) GetAppInfo() *Info {
	return Get()
}

func (s *Service) UpdateSettings(settings Settings) *Info {
	if globalInfo == nil {
		return nil
	}
	globalInfo.mu.Lock()
	globalInfo.Settings = settings
	globalInfo.mu.Unlock()

	saveSettings()

	if appInstance != nil {
		appInstance.Event.Emit("app:settings-changed", settings)
	}

	return Get()
}
