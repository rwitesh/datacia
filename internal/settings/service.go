package settings

import (
	"runtime"
	"sync"

	"datacia/internal/logger"
	"datacia/internal/paths"
	"datacia/internal/security"

	"github.com/getsentry/sentry-go/attribute"
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
	machineId, _ := security.GetMachineID()
	globalInfoOnce.Do(func() {
		globalInfo = &Info{
			OS:         app.Env.Info().OS,
			OSArch:     app.Env.Info().Arch,
			OSVersion:  app.Env.Info().OSInfo.Version,
			MachineId:  machineId,
			AppVersion: "unknown",
			Settings:   defaultSettings(),
		}
		loadSettings()
		applyLoggerContext(globalInfo)
	})
}

func SetAppVersion(version string) {
	if globalInfo == nil {
		return
	}
	globalInfo.mu.Lock()
	globalInfo.AppVersion = version
	info := &Info{
		OS:         globalInfo.OS,
		OSArch:     globalInfo.OSArch,
		OSVersion:  globalInfo.OSVersion,
		AppVersion: globalInfo.AppVersion,
		MachineId:  globalInfo.MachineId,
	}
	globalInfo.mu.Unlock()
	applyLoggerContext(info)
}

func applyLoggerContext(info *Info) {
	if info == nil {
		return
	}
	logger.SetGlobalAttrs(
		attribute.String("os", info.OS),
		attribute.String("arch", info.OSArch),
		attribute.String("os_version", info.OSVersion),
		attribute.String("app_version", info.AppVersion),
		attribute.String("hardware", info.MachineId),
	)
}

func Get() *Info {
	machineId, _ := security.GetMachineID()
	if globalInfo == nil {
		return &Info{
			OS:         runtime.GOOS,
			OSArch:     runtime.GOARCH,
			AppVersion: "",
			Settings:   Settings{Theme: ThemeSystem},
			MachineId:  machineId,
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
		MachineId:               globalInfo.MachineId,
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
	logger.Info("app_launch")

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
			logger.Warn("Failed to encrypt AI API key, keeping previous", "error", err.Error())
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
