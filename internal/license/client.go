package license

import (
	"bytes"
	"datacia/internal/appinfo"
	"datacia/internal/constants"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func LicenseActivate(licenseKey, machineID string) (*License, error) {
	ctx := appinfo.Get()
	reqBody, err := json.Marshal(LicenseData{
		LicenseKey: licenseKey,
		MachineID:  machineID,
		OS:         ctx.OS,
		OSArch:     ctx.OSArch,
		OSVersion:  ctx.OSVersion,
		AppVersion: ctx.AppVersion,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	var l License
	if err := executeRequest("activate", reqBody, &l); err != nil {
		return nil, err
	}
	return &l, nil
}

func LicenseDeactivate(signature []byte, machineID string) error {
	reqBody, err := json.Marshal(SignatureRequest{
		Signature: string(signature),
		MachineID: machineID,
	})
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	return executeRequest("deactivate", reqBody, nil)
}

func LicenseValidate(signature []byte, machineID string) (*License, error) {
	reqBody, err := json.Marshal(SignatureRequest{
		Signature: string(signature),
		MachineID: machineID,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	var l License
	if err := executeRequest("validate", reqBody, &l); err != nil {
		return nil, err
	}
	return &l, nil
}

func executeRequest(endpoint string, body []byte, target interface{}) error {
	req, err := http.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s/%s", constants.SERVER_URL, endpoint),
		bytes.NewReader(body),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("server error: %s - %s", resp.Status, string(respBody))
	}

	if target != nil {
		if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
			return fmt.Errorf("invalid server response: %w", err)
		}
	}

	return nil
}
