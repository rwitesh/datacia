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

type ActivateRequest struct {
	License   string `json:"license"`
	MachineId string `json:"machineId"`
}

func Activate(licenseKey string) (*License, error) {
	machineID, err := security.GetMachineID()
	if err != nil {
		return nil, err
	}
	hashedMachineID := security.Sha256Hex(machineID)

	reqBody, err := json.Marshal(ActivateRequest{
		License:   licenseKey,
		MachineId: hashedMachineID,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s/license?action=activate", constants.LICENSE_SERVER_URL),
		bytes.NewReader(reqBody),
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("license activation failed: %s", resp.Status)
	}

	var response struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	encryptedID, err := security.EncryptString(response.ID)
	if err != nil {
		return nil, err
	}

	encryptedLicenseKey, err := security.EncryptString(licenseKey)
	if err != nil {
		return nil, err
	}

	// Create license with only the required fields
	lic := &License{
		ID:        encryptedID,
		Key:       encryptedLicenseKey,
		MachineId: hashedMachineID,
	}

	if err := SaveLicense(lic); err != nil {
		return nil, err
	}

	// Cache the newly activated license
	license = lic

	return lic, nil
}

func Deactivate() error {
	if license == nil {
		return fmt.Errorf("license not found")
	}

	key, err := security.DecryptString(license.Key)
	if err != nil {
		return fmt.Errorf("failed to decrypt license key: %w", err)
	}

	instance, err := security.DecryptString(license.ID)
	if err != nil {
		return fmt.Errorf("failed to decrypt license instance: %w", err)
	}

	// Prepare deactivate request
	reqBody := map[string]string{
		"key":      key,
		"instance": instance,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s/license?action=deactivate", constants.LICENSE_SERVER_URL),
		bytes.NewReader(jsonBody),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Response 200 means ok or done
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("license deactivation failed: %s", resp.Status)
	}

	// Clear the license instance
	license = nil

	// Delete the local license file
	licensePath, err := xdg.DataFile(filepath.Join(constants.APP_NAME, "license.bin"))
	if err != nil {
		return fmt.Errorf("failed to resolve license path: %w", err)
	}

	if err := os.Remove(licensePath); err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("failed to delete license file: %w", err)
		}
		// File doesn't exist, which is fine
	}

	return nil
}

// SaveLicense saves the license to a binary file at $XDG_DATA_HOME/<appName>/license.bin
func SaveLicense(license *License) error {
	licensePath, err := xdg.DataFile(filepath.Join(constants.APP_NAME, "license.bin"))
	if err != nil {
		return fmt.Errorf("failed to resolve license path: %w", err)
	}

	// Ensure the directory exists
	dir := filepath.Dir(licensePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create license directory: %w", err)
	}

	// Create or truncate the file
	file, err := os.Create(licensePath)
	if err != nil {
		return fmt.Errorf("failed to create license file: %w", err)
	}
	defer file.Close()

	// Encode the license to binary format using gob
	encoder := gob.NewEncoder(file)
	if err := encoder.Encode(license); err != nil {
		return fmt.Errorf("failed to encode license: %w", err)
	}

	return nil
}
