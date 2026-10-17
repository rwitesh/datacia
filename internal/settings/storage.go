package settings

import (
	"encoding/json"
	"os"
	"path/filepath"

	"datacia/internal/logger"
	"datacia/internal/paths"
)

func loadSettings() {
	if configDir == "" {
		return
	}
	settingsPath, err := paths.GetSettingsPath()
	if err != nil {
		logger.Warn("Failed to resolve settings path", "error", err.Error())
		return
	}
	data, err := os.ReadFile(settingsPath)
	if err != nil {
		logger.Warn("Failed to read settings file, using defaults", "error", err.Error())
		if err := os.MkdirAll(filepath.Dir(settingsPath), 0755); err != nil {
			logger.Warn("Failed to create settings directory", "error", err.Error())
			return
		}
		def := defaultSettings()
		globalInfo.mu.Lock()
		globalInfo.Settings = def
		globalInfo.mu.Unlock()
		if err := saveSettings(); err != nil {
			logger.Warn("Failed to save default settings", "error", err.Error())
		}
		return
	}
	var s Settings
	if err := json.Unmarshal(data, &s); err != nil {
		logger.Warn("Failed to parse settings file, resetting to defaults", "error", err.Error())
		def := defaultSettings()
		globalInfo.mu.Lock()
		globalInfo.Settings = def
		globalInfo.mu.Unlock()
		_ = os.MkdirAll(filepath.Dir(settingsPath), 0755)
		if err := saveSettings(); err != nil {
			logger.Warn("Failed to save reset settings", "error", err.Error())
		}
		return
	}
	s.Editor.Light = fillTokenColorsDefaults(s.Editor.Light, defaultTokenColorsLight())
	s.Editor.Dark = fillTokenColorsDefaults(s.Editor.Dark, defaultTokenColorsDark())
	fillAIDefaults(&s)
	applyPrivacy(s)
	globalInfo.mu.Lock()
	globalInfo.Settings = s
	globalInfo.mu.Unlock()
	if err := saveSettings(); err != nil {
		logger.Warn("Failed to persist settings", "error", err.Error())
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
	s := globalInfo.Settings
	globalInfo.mu.RUnlock()
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(settingsPath, data, 0644)
}

// ErrorReportsEnabled reads only the privacy setting from disk, for use before
// the settings service starts. Reports stay on if the file is missing or
// unreadable.
func ErrorReportsEnabled() bool {
	settingsPath, err := paths.GetSettingsPath()
	if err != nil {
		return true
	}
	data, err := os.ReadFile(settingsPath)
	if err != nil {
		return true
	}
	var s struct {
		Privacy PrivacyConfig `json:"privacy"`
	}
	if err := json.Unmarshal(data, &s); err != nil {
		return true
	}
	return !s.Privacy.DisableErrorReports
}
