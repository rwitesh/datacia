package paths

import (
	"fmt"
	"path/filepath"

	"datacia/internal/constants"

	"github.com/adrg/xdg"
)

// returns the base data directory for the application (e.g. ~/.local/share/DataCia)
func GetDataDir() (string, error) {
	return xdg.DataFile(constants.APP_NAME)
}

// returns the path to the main database file (data.db)
func GetDBPath() (string, error) {
	return xdg.DataFile(filepath.Join(constants.APP_NAME, "data.db"))
}

// returns the directory where saved queries are stored
func GetQueriesDir() (string, error) {
	_, err := xdg.DataFile(filepath.Join(constants.APP_NAME, "queries"))
	if err != nil {
		return "", fmt.Errorf("failed to resolve queries path: %w", err)
	}

	return filepath.Join(xdg.DataHome, constants.APP_NAME, "queries"), nil
}

type LicenseShardPaths struct {
	Identity string // id, key, machine_id, created_at
	Temporal string // expires_at, last_check
	Auth     string // customer_name, customer_email, signature
}

func GetLicenseShardPaths() (*LicenseShardPaths, error) {
	identity, err := xdg.DataFile(filepath.Join(constants.APP_NAME, ".dci_meta"))
	if err != nil {
		return nil, fmt.Errorf("failed to resolve identity shard path: %w", err)
	}

	temporal, err := xdg.StateFile(filepath.Join(constants.APP_NAME, ".dci_state"))
	if err != nil {
		return nil, fmt.Errorf("failed to resolve temporal shard path: %w", err)
	}

	auth, err := xdg.ConfigFile(filepath.Join(constants.APP_NAME, ".dci_auth"))
	if err != nil {
		return nil, fmt.Errorf("failed to resolve auth shard path: %w", err)
	}

	return &LicenseShardPaths{
		Identity: identity,
		Temporal: temporal,
		Auth:     auth,
	}, nil
}

// returns the configuration directory
func GetConfigDir() (string, error) {
	path, err := xdg.ConfigFile(constants.APP_NAME)
	if err != nil {
		return "", fmt.Errorf("failed to resolve config path: %w", err)
	}
	return path, nil
}

// returns the path to the settings file
func GetSettingsPath() (string, error) {
	return xdg.ConfigFile(filepath.Join(constants.APP_NAME, "settings.json"))
}
