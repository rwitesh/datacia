package ai

import (
	"bytes"
	"datacia/internal/constants"
	"datacia/internal/license"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func (s *Service) sendInbuilt(engine, context, message string) (string, error) {
	body, err := json.Marshal(request{
		Engine:    engine,
		Context:   context,
		Message:   message,
		LicenseID: license.GetLicenseID(),
	})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/ai", constants.SERVER_URL), bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	var result response
	if err := json.Unmarshal(respBody, &result); err != nil {
		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("%s", http.StatusText(resp.StatusCode))
		}
		return string(respBody), nil
	}

	if resp.StatusCode != http.StatusOK {
		if result.Error != "" {
			return "", fmt.Errorf("%s", result.Error)
		}
		return "", fmt.Errorf("%s", http.StatusText(resp.StatusCode))
	}

	return result.Message, nil
}
