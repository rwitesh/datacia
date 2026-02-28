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
		logger.Warn("settings.loadSettings", err, "Failed to resolve settings path")
		return
	}
	data, err := os.ReadFile(settingsPath)
	if err != nil {
		logger.Warn("settings.loadSettings", err, "Failed to read settings file, using defaults")
		if err := os.MkdirAll(filepath.Dir(settingsPath), 0755); err != nil {
			logger.Warn("settings.loadSettings", err, "Failed to create settings directory")
			return
		}
		def := defaultSettings()
		globalInfo.mu.Lock()
		globalInfo.Settings = def
		globalInfo.mu.Unlock()
		if err := saveSettings(); err != nil {
			logger.Warn("settings.loadSettings", err, "Failed to save default settings")
		}
		return
	}
	var s Settings
	if err := json.Unmarshal(data, &s); err != nil {
		logger.Warn("settings.loadSettings", err, "Failed to parse settings file, resetting to defaults")
		def := defaultSettings()
		globalInfo.mu.Lock()
		globalInfo.Settings = def
		globalInfo.mu.Unlock()
		_ = os.MkdirAll(filepath.Dir(settingsPath), 0755)
		if err := saveSettings(); err != nil {
			logger.Warn("settings.loadSettings", err, "Failed to save reset settings")
		}
		return
	}
	s.Editor.Light = fillTokenColorsDefaults(s.Editor.Light, defaultTokenColorsLight())
	s.Editor.Dark = fillTokenColorsDefaults(s.Editor.Dark, defaultTokenColorsDark())
	fillAIDefaults(&s)
	globalInfo.mu.Lock()
	globalInfo.Settings = s
	globalInfo.mu.Unlock()
	if err := saveSettings(); err != nil {
		logger.Warn("settings.loadSettings", err, "Failed to persist settings")
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
