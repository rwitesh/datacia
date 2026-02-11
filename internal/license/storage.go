package license

import (
	"datacia/internal/paths"
	"datacia/internal/security"
	"encoding/json"
	"fmt"
	"os"
)

type storedLicense struct {
	ID    string `json:"id"`
	Key   string `json:"key"`
	Email string `json:"email"`
	Token string `json:"token"`
}

func SaveLicense(l *License) error {
	path, err := paths.GetLicensePath()
	if err != nil {
		return err
	}

	data := storedLicense{
		ID:    l.ID,
		Key:   l.Key,
		Email: l.Email,
		Token: l.Token,
	}

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}

	encrypted, err := security.EncryptString(string(jsonBytes))
	if err != nil {
		return err
	}

	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, []byte(encrypted), 0600); err != nil {
		return err
	}

	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return err
	}
	return nil
}

func LoadLicense() (*License, error) {
	path, err := paths.GetLicensePath()
	if err != nil {
		return nil, err
	}

	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	decrypted, err := security.DecryptString(string(raw))
	if err != nil {
		return nil, fmt.Errorf("license data corrupted: %w", err)
	}

	var data storedLicense
	if err := json.Unmarshal([]byte(decrypted), &data); err != nil {
		return nil, fmt.Errorf("invalid license data: %w", err)
	}

	return &License{
		ID:    data.ID,
		Key:   data.Key,
		Email: data.Email,
		Token: data.Token,
	}, nil
}

func RemoveLicense() error {
	path, err := paths.GetLicensePath()
	if err != nil {
		return err
	}

	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
