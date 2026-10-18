package settings

import (
	"errors"
	"fmt"
	"maps"
	"runtime"
	"strings"
	"sync"

	"datacia/internal/logger"
	"datacia/internal/paths"
	"datacia/internal/security"
	"datacia/internal/sentry"

	"github.com/getsentry/sentry-go/attribute"
	"github.com/wailsapp/wails/v3/pkg/application"
)

var (
	commitMu    sync.Mutex
	globalInfo  *Info
	configDir   string
	appInstance *application.App
)

// Init loads the settings and tags every log with the app and device details.
func Init(app *application.App, version string) {
	appInstance = app
	if cd, err := paths.GetConfigDir(); err == nil {
		configDir = cd
	}
	env := app.Env.Info()
	globalInfo = &Info{
		OS:         env.OS,
		OSArch:     env.Arch,
		OSVersion:  env.OSInfo.Version,
		AppVersion: version,
		Settings:   defaultSettings(),
	}
	loadSettings()

	var deviceID string
	if ctx, err := security.GetSecurityContext(); err == nil {
		deviceID = ctx.DeviceID()
	}
	logger.SetGlobalAttrs(
		attribute.String("os", env.OS),
		attribute.String("arch", env.Arch),
		attribute.String("os_version", env.OSInfo.Version),
		attribute.String("app_version", version),
		attribute.String("hardware", deviceID),
	)
}

func Get() *Info {
	if globalInfo == nil {
		return &Info{
			OS:       runtime.GOOS,
			OSArch:   runtime.GOARCH,
			Settings: defaultSettings(),
			Defaults: defaultSettings(),
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
		OS:         globalInfo.OS,
		OSVersion:  globalInfo.OSVersion,
		OSArch:     globalInfo.OSArch,
		AppVersion: globalInfo.AppVersion,
		Defaults:   defaultSettings(),
		Settings: Settings{
			Theme:   s.Theme,
			Editor:  s.Editor,
			Font:    s.Font,
			AI:      AIConfig{Providers: maps.Clone(s.AI.Providers)},
			Privacy: s.Privacy,
		},
	}
}

// AIKey returns the decrypted API key stored for a provider, or "".
func AIKey(provider string) (string, error) {
	if globalInfo == nil {
		return "", nil
	}
	globalInfo.mu.RLock()
	enc := globalInfo.Settings.AI.Keys[provider]
	globalInfo.mu.RUnlock()
	if enc == "" {
		return "", nil
	}
	return security.DecryptString(enc)
}

// SetAIKey encrypts and stores a provider's API key; "" removes it.
func SetAIKey(provider, key string) error {
	if globalInfo == nil {
		return errors.New("settings are not loaded")
	}
	commitMu.Lock()
	defer commitMu.Unlock()
	keys, err := withKeys(GetSettingsRaw().AI.Keys, map[string]string{provider: key})
	if err != nil {
		return err
	}
	_, err = commit(func(s *Settings) { s.AI.Keys = keys })
	return err
}

// SetAIModel stores the chat's default model.
func SetAIModel(provider, model string) error {
	if globalInfo == nil {
		return errors.New("settings are not loaded")
	}
	commitMu.Lock()
	defer commitMu.Unlock()
	_, err := commit(func(s *Settings) { s.AI.DefaultProvider, s.AI.DefaultModel = provider, model })
	return err
}

// withKeys returns a copy of keys with changes applied: each value is a new
// plaintext key, or "" to remove the provider's key.
func withKeys(keys, changes map[string]string) (map[string]string, error) {
	out := maps.Clone(keys)
	if out == nil {
		out = map[string]string{}
	}
	for provider, key := range changes {
		if key == "" {
			delete(out, provider)
			continue
		}
		if key = strings.TrimSpace(key); key == "" {
			return nil, errors.New("An API key can't be blank.")
		}
		enc, err := security.EncryptString(key)
		if err != nil {
			logger.Error("Failed to encrypt API key", "provider", provider, "error", err.Error())
			return nil, errors.New("Couldn't store the API key securely.")
		}
		out[provider] = enc
	}
	return out, nil
}

// commit applies change to a copy of the settings, saves it and only then
// makes it current and notifies every window, so a failed save changes
// nothing. change must replace maps rather than modify them in place. The
// caller must hold commitMu.
func commit(change func(*Settings)) (*Info, error) {
	next := GetSettingsRaw()
	change(&next)
	if err := saveSettings(next); err != nil {
		logger.Error("Failed to save settings", "error", err.Error())
		return nil, fmt.Errorf("Couldn't save the settings: %w", err)
	}

	globalInfo.mu.Lock()
	globalInfo.Settings = next
	info := getSanitized()
	globalInfo.mu.Unlock()

	applyPrivacy(next)
	if appInstance != nil {
		// Send the sanitized settings: the event reaches every window.
		appInstance.Event.Emit("app:settings-changed", info.Settings)
	}
	return info, nil
}

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) GetAppInfo() *Info {
	return Get()
}

// UpdateSettings replaces the settings and applies API key changes in one
// save. keys maps a provider ID to its new key, or "" to remove it. The
// default model is kept.
func (s *Service) UpdateSettings(settings Settings, keys map[string]string) (*Info, error) {
	if globalInfo == nil {
		return nil, errors.New("settings are not loaded")
	}
	next := settings
	fillDefaults(&next)

	commitMu.Lock()
	defer commitMu.Unlock()
	cur := GetSettingsRaw().AI
	nextKeys, err := withKeys(cur.Keys, keys)
	if err != nil {
		return nil, err
	}
	next.AI.Keys = nextKeys
	next.AI.DefaultProvider, next.AI.DefaultModel = cur.DefaultProvider, cur.DefaultModel
	return commit(func(cur *Settings) { *cur = next })
}

// applyPrivacy applies the error-report setting to the reporter.
func applyPrivacy(s Settings) {
	sentry.SetEnabled(!s.Privacy.DisableErrorReports)
}
