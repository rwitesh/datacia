package settings

import (
	"encoding/json"
	"os"
	"path/filepath"

	"datacia/internal/paths"
)

func loadSettings() {
	if configDir == "" {
		return
	}
	settingsPath, err := paths.GetSettingsPath()
	if err != nil {
		return
	}
	data, err := os.ReadFile(settingsPath)
	if err != nil {
		if err := os.MkdirAll(filepath.Dir(settingsPath), 0755); err != nil {
			return
		}
		def := defaultSettings()
		globalInfo.mu.Lock()
		globalInfo.Settings = def
		globalInfo.mu.Unlock()
		_ = saveSettings()
		return
	}
	var s Settings
	if err := json.Unmarshal(data, &s); err != nil {
		def := defaultSettings()
		globalInfo.mu.Lock()
		globalInfo.Settings = def
		globalInfo.mu.Unlock()
		_ = os.MkdirAll(filepath.Dir(settingsPath), 0755)
		_ = saveSettings()
		return
	}
	s.Editor.Light = fillTokenColorsDefaults(s.Editor.Light, defaultTokenColorsLight())
	s.Editor.Dark = fillTokenColorsDefaults(s.Editor.Dark, defaultTokenColorsDark())
	fillAIDefaults(&s)
	globalInfo.mu.Lock()
	globalInfo.Settings = s
	globalInfo.mu.Unlock()
	_ = saveSettings()
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
