package paths

import (
	"fmt"
	"path/filepath"

	"datacia/internal/constants"

	"github.com/adrg/xdg"
)

func GetDBPath() (string, error) {
	return xdg.DataFile(filepath.Join(constants.APP_NAME, "data.db"))
}

func GetChatPath() (string, error) {
	return xdg.DataFile(filepath.Join(constants.APP_NAME, "chat.json"))
}

func GetQueriesDir() (string, error) {
	_, err := xdg.DataFile(filepath.Join(constants.APP_NAME, "queries"))
	if err != nil {
		return "", fmt.Errorf("failed to resolve queries path: %w", err)
	}

	return filepath.Join(xdg.DataHome, constants.APP_NAME, "queries"), nil
}

func GetConfigDir() (string, error) {
	path, err := xdg.ConfigFile(constants.APP_NAME)
	if err != nil {
		return "", fmt.Errorf("failed to resolve config path: %w", err)
	}
	return path, nil
}

func GetSettingsPath() (string, error) {
	return xdg.ConfigFile(filepath.Join(constants.APP_NAME, "settings.json"))
}

// GetKnownHostsPath is the OpenSSH known_hosts file of trusted SSH tunnel hosts.
func GetKnownHostsPath() (string, error) {
	return xdg.DataFile(filepath.Join(constants.APP_NAME, "known_hosts"))
}
