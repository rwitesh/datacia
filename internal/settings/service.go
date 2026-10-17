package settings

import (
	"errors"
	"maps"
	"runtime"
	"sync"

	"datacia/internal/logger"
	"datacia/internal/paths"
	"datacia/internal/security"
	"datacia/internal/sentry"

	"github.com/getsentry/sentry-go/attribute"
	"github.com/wailsapp/wails/v3/pkg/application"
)

var (
	commitMu       sync.Mutex
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

// getSanitized returns the settings for the frontend, without API keys.
// The caller must hold globalInfo.mu.
func getSanitized() *Info {
	s := globalInfo.Settings
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
			Theme:   s.Theme,
			Editor:  s.Editor,
			Font:    s.Font,
			AI:      AIConfig{Providers: maps.Clone(s.AI.Providers)},
			Privacy: s.Privacy,
		},
	}
}

// AIKey returns the encrypted API key stored for a provider, or "".
func AIKey(provider string) string {
	if globalInfo == nil {
		return ""
	}
	globalInfo.mu.RLock()
	defer globalInfo.mu.RUnlock()
	return globalInfo.Settings.AI.Keys[provider]
}

// SetAIKey stores the encrypted API key for a provider; "" removes it.
func SetAIKey(provider, encrypted string) error {
	if globalInfo == nil {
		return errors.New("settings are not loaded")
	}
	_, err := commit(func(s *Settings) {
		keys := maps.Clone(s.AI.Keys)
		if keys == nil {
			keys = map[string]string{}
		}
		if encrypted == "" {
			delete(keys, provider)
		} else {
			keys[provider] = encrypted
		}
		s.AI.Keys = keys
	})
	return err
}

// commit applies change to the settings, saves them and notifies every window.
func commit(change func(*Settings)) (*Info, error) {
	commitMu.Lock()
	defer commitMu.Unlock()

	globalInfo.mu.Lock()
	change(&globalInfo.Settings)
	next := globalInfo.Settings
	info := getSanitized()
	globalInfo.mu.Unlock()

	applyPrivacy(next)
	err := saveSettings()
	if err != nil {
		logger.Error("Failed to save settings", "error", err.Error())
	}
	if appInstance != nil {
		// Send the sanitized settings: the event reaches every window.
		appInstance.Event.Emit("app:settings-changed", info.Settings)
	}
	return info, err
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

// UpdateSettings replaces the settings. API keys are kept as they are.
func (s *Service) UpdateSettings(settings Settings) *Info {
	if globalInfo == nil {
		return nil
	}
	next := settings
	next.Editor.Light = fillTokenColorsDefaults(next.Editor.Light, defaultTokenColorsLight())
	next.Editor.Dark = fillTokenColorsDefaults(next.Editor.Dark, defaultTokenColorsDark())
	fillAIDefaults(&next)
	info, _ := commit(func(cur *Settings) {
		next.AI.Keys = cur.AI.Keys
		*cur = next
	})
	return info
}

// applyPrivacy applies the error-report setting to the reporter.
func applyPrivacy(s Settings) {
	sentry.SetEnabled(!s.Privacy.DisableErrorReports)
}
