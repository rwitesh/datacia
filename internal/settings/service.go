package settings

import (
	"runtime"
	"sync"

	"datacia/internal/paths"
	"datacia/internal/security"

	"github.com/wailsapp/wails/v3/pkg/application"
)

var (
	globalInfo     *Info
	globalInfoOnce sync.Once
	configDir      string
	appInstance    *application.App
)

func Init(app *application.App) {
	appInstance = app
	if cd, err := paths.GetConfigDir(); err == nil {
		configDir = cd
	}
	globalInfoOnce.Do(func() {
		globalInfo = &Info{
			OS:         app.Env.Info().OS,
			OSArch:     app.Env.Info().Arch,
			OSVersion:  app.Env.Info().OSInfo.Version,
			AppVersion: "unknown",
			Settings:   defaultSettings(),
		}
		loadSettings()
	})
}

func SetAppVersion(version string) {
	if globalInfo == nil {
		return
	}
	globalInfo.mu.Lock()
	defer globalInfo.mu.Unlock()
	globalInfo.AppVersion = version
}

func Get() *Info {
	if globalInfo == nil {
		return &Info{
			OS:         runtime.GOOS,
			OSArch:     runtime.GOARCH,
			AppVersion: "",
			Settings:   Settings{Theme: ThemeSystem},
		}
	}
	globalInfo.mu.RLock()
	defer globalInfo.mu.RUnlock()
	return getSanitized()
}

func GetSettingsRaw() Settings {
	if globalInfo == nil {
		return Settings{Theme: ThemeSystem}
	}
	globalInfo.mu.RLock()
	defer globalInfo.mu.RUnlock()
	return globalInfo.Settings
}

func getSanitized() *Info {
	s := globalInfo.Settings
	keyOut := ""
	if s.AI.Gemini.Key != "" {
		keyOut = KeyMask
	}
	return &Info{
		OS:                      globalInfo.OS,
		OSVersion:               globalInfo.OSVersion,
		OSArch:                  globalInfo.OSArch,
		AppVersion:              globalInfo.AppVersion,
		Appearance:              globalInfo.Appearance,
		ActiveTokenColors:       globalInfo.ActiveTokenColors,
		DefaultTokenColorsLight: defaultTokenColorsLight(),
		DefaultTokenColorsDark:  defaultTokenColorsDark(),
		Settings: Settings{
			Theme:  s.Theme,
			Editor: s.Editor,
			Font:   s.Font,
			AI: AIConfig{
				Gemini: AIProviderConfig{
					Enabled: s.AI.Gemini.Enabled,
					Key:     keyOut,
					Models:  s.AI.Gemini.Models,
				},
			},
		},
	}
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
	defer globalInfo.mu.Unlock()
	current := globalInfo.Settings
	next := settings
	if k := settings.AI.Gemini.Key; k != "" && k != KeyMask {
		enc, err := security.EncryptString(k)
		if err == nil {
			next.AI.Gemini.Key = enc
		} else {
			next.AI.Gemini.Key = current.AI.Gemini.Key
		}
	} else {
		next.AI.Gemini.Key = current.AI.Gemini.Key
	}
	next.Editor.Light = fillTokenColorsDefaults(next.Editor.Light, defaultTokenColorsLight())
	next.Editor.Dark = fillTokenColorsDefaults(next.Editor.Dark, defaultTokenColorsDark())
	fillAIDefaults(&next)
	globalInfo.Settings = next
	globalInfo.mu.Unlock()
	saveSettings()
	globalInfo.mu.Lock()
	if appInstance != nil {
		appInstance.Event.Emit("app:settings-changed", next)
	}
	return getSanitized()
}
