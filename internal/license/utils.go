package license

import (
	"datacia/internal/constants"
	"encoding/gob"
	"fmt"
	"os"
	"path/filepath"

	"github.com/adrg/xdg"
)

func SaveLicense(license *License) error {
	licensePath, err := xdg.DataFile(filepath.Join(constants.APP_NAME, "license.bin"))
	if err != nil {
		return fmt.Errorf("failed to resolve license path: %w", err)
	}

	dir := filepath.Dir(licensePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create license directory: %w", err)
	}

	file, err := os.Create(licensePath)
	if err != nil {
		return fmt.Errorf("failed to create license file: %w", err)
	}
	defer file.Close()

	encoder := gob.NewEncoder(file)
	if err := encoder.Encode(license); err != nil {
		return fmt.Errorf("failed to encode license: %w", err)
	}

	return nil
}

func LoadLicense() error {
	licensePath, err := xdg.DataFile(
		filepath.Join(constants.APP_NAME, "license.bin"),
	)
	if err != nil {
		return fmt.Errorf("failed to resolve license path: %w", err)
	}

	file, err := os.Open(licensePath)
	if err != nil {
		if os.IsNotExist(err) {
			// License file doesn't exist, which is fine
			return nil
		}
		return fmt.Errorf("failed to open license file: %w", err)
	}
	defer file.Close()

	var lic License
	if err := gob.NewDecoder(file).Decode(&lic); err != nil {
		return fmt.Errorf("corrupted license file: %w", err)
	}

	license = &lic

	return nil
}
