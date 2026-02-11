package paths

import (
	"fmt"
	"path/filepath"

	"datacia/internal/constants"

	"github.com/adrg/xdg"
)

func GetDataDir() (string, error) {
	return xdg.DataFile(constants.APP_NAME)
}

func GetDBPath() (string, error) {
	return xdg.DataFile(filepath.Join(constants.APP_NAME, "data.db"))
}

func GetQueriesDir() (string, error) {
	_, err := xdg.DataFile(filepath.Join(constants.APP_NAME, "queries"))
	if err != nil {
		return "", fmt.Errorf("failed to resolve queries path: %w", err)
	}

	return filepath.Join(xdg.DataHome, constants.APP_NAME, "queries"), nil
}

func GetLicensePath() (string, error) {
	return xdg.DataFile(filepath.Join(constants.APP_NAME, ".dci_license"))
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
