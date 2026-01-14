package license

import (
	"bytes"
	"datacia/internal/constants"
	"datacia/internal/security"
	"encoding/gob"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/adrg/xdg"
)

func Validate() bool {
	if license == nil {
		return false
	}

	machineID, err := security.GetMachineID()
	if err != nil {
		return false
	}

	if license.MachineId != security.Sha256Hex(machineID) {
		return false
	}

	// Check if we have the required fields for server validation
	if license.Key == "" || license.ID == "" {
		return false
	}

	key, err := security.DecryptString(license.Key)
	if err != nil {
		return false
	}

	instance, err := security.DecryptString(license.ID)
	if err != nil {
		return false
	}

	reqBody := map[string]string{
		"key":      key,
		"instance": instance,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return false
	}

	req, err := http.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s/license?action=validate", constants.LICENSE_SERVER_URL),
		bytes.NewReader(jsonBody),
	)
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false
	}

	var result struct {
		Valid bool `json:"valid"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false
	}

	if !result.Valid {
		return false
	}

	return true
}

// LoadLicense loads the license from disk if the file exists.
// Returns nil if the license file doesn't exist (not an error).
// Returns an error only if the file exists but is corrupted.
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

	// Cache the loaded license
	license = &lic

	return nil
}
