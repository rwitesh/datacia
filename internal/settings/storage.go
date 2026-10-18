package settings

import (
	"encoding/json"
	"errors"
	"os"

	"datacia/internal/logger"
	"datacia/internal/paths"
)

// errNotLoaded blocks saving after settings.json existed but couldn't be read
// or backed up: saving would replace it, and the API keys in it, with defaults.
var errNotLoaded error

// loadSettings reads settings.json into globalInfo, which starts with the
// defaults. A missing file is created with them; a corrupt one is moved to
// settings.json.bak first so the API keys in it can still be recovered.
func loadSettings() {
	if configDir == "" {
		return
	}
	settingsPath, err := paths.GetSettingsPath()
	if err != nil {
		logger.Warn("Failed to resolve settings path", "error", err.Error())
		return
	}
	s := defaultSettings()
	data, err := os.ReadFile(settingsPath)
	switch {
	case errors.Is(err, os.ErrNotExist):
	case err != nil:
		logger.Warn("Failed to read settings file, using defaults for this session", "error", err.Error())
		errNotLoaded = errors.New("settings.json couldn't be read, so changes can't be saved until DataCia restarts")
		return
	default:
		var loaded Settings
		if err := json.Unmarshal(data, &loaded); err != nil {
			logger.Warn("Failed to parse settings file, resetting to defaults", "error", err.Error())
			if err := os.Rename(settingsPath, settingsPath+".bak"); err != nil {
				logger.Warn("Failed to back up settings file, using defaults for this session", "error", err.Error())
				errNotLoaded = errors.New("settings.json couldn't be backed up, so changes can't be saved until DataCia restarts")
				return
			}
		} else {
			s = loaded
			fillDefaults(&s)
		}
	}
	applyPrivacy(s)
	globalInfo.mu.Lock()
	globalInfo.Settings = s
	globalInfo.mu.Unlock()
	if err := saveSettings(s); err != nil {
		logger.Warn("Failed to persist settings", "error", err.Error())
	}
}

// saveSettings writes s to settings.json atomically, so a crash leaves either
// the old or the new file, never a partial one.
func saveSettings(s Settings) error {
	if configDir == "" {
		return nil
	}
	if errNotLoaded != nil {
		return errNotLoaded
	}
	settingsPath, err := paths.GetSettingsPath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	// 0600 because the file holds encrypted API keys.
	tmp := settingsPath + ".tmp"
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	_, err = f.Write(data)
	if err == nil {
		// Without it, a crash right after the rename can leave an empty file.
		err = f.Sync()
	}
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, settingsPath)
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
