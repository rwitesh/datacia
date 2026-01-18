package license

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"datacia/internal/constants"

	"github.com/adrg/xdg"
)

// SaveLicense saves the license to disk atomically.
func SaveLicense(l *License) error {
	path, err := getLicensePath()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(l, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal license: %w", err)
	}

	// Atomic write: write to temp file then rename
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write license file: %w", err)
	}

	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to save license file: %w", err)
	}

	return nil
}

func LoadLicense() (*License, error) {
	path, err := getLicensePath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // No license
		}
		return nil, fmt.Errorf("failed to read license file: %w", err)
	}

	var l License
	if err := json.Unmarshal(data, &l); err != nil {
		return nil, fmt.Errorf("failed to parse license file: %w", err)
	}
	return &l, nil
}

func RemoveLicense() error {
	path, err := getLicensePath()
	if err != nil {
		return err
	}
	return os.Remove(path)
}

func getLicensePath() (string, error) {
	return xdg.DataFile(filepath.Join(constants.APP_NAME, "license.bin"))
}
