package license

import (
	"datacia/internal/paths"
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

func saveLicense(l *License) error {
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

	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, jsonBytes, 0600); err != nil {
		return err
	}

	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return err
	}
	return nil
}

func loadLicense() (*License, error) {
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

	var data storedLicense
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, fmt.Errorf("invalid license data: %w", err)
	}

	return &License{
		ID:    data.ID,
		Key:   data.Key,
		Email: data.Email,
		Token: data.Token,
	}, nil
}

func removeLicense() error {
	path, err := paths.GetLicensePath()
	if err != nil {
		return err
	}

	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
