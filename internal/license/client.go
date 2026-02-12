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

func licenseActivate(licenseKey, machineID string) (*License, error) {
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
		return nil, err
	}

	var l License
	if err := executeRequest("activate", reqBody, &l); err != nil {
		return nil, err
	}
	return &l, nil
}

func licenseDeactivate(token string, machineID string) error {
	reqBody, err := json.Marshal(TokenRequest{
		Token:     token,
		MachineID: machineID,
	})
	if err != nil {
		return err
	}

	return executeRequest("deactivate", reqBody, nil)
}

func licenseValidate(token string, machineID string) (*License, error) {
	reqBody, err := json.Marshal(TokenRequest{
		Token:     token,
		MachineID: machineID,
	})
	if err != nil {
		return nil, err
	}

	var l License
	if err := executeRequest("validate", reqBody, &l); err != nil {
		return nil, err
	}
	return &l, nil
}

type NetworkError struct {
	Msg string
}

func (e *NetworkError) Error() string {
	return e.Msg
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
		return &NetworkError{Msg: err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return &NetworkError{Msg: fmt.Sprintf("Server error: %s", http.StatusText(resp.StatusCode))}
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		var errResp struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Error != "" {
			return fmt.Errorf("%s", errResp.Error)
		}
		return fmt.Errorf("%s", http.StatusText(resp.StatusCode))
	}

	if target != nil {
		if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
			return err
		}
	}

	return nil
}
