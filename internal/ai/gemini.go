package ai

import (
	"bytes"
	"datacia/internal/security"
	"datacia/internal/settings"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type geminiReq struct {
	Contents          []geminiContent `json:"contents"`
	SystemInstruction *geminiContent  `json:"systemInstruction,omitempty"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiResp struct {
	Candidates []struct {
		Content struct {
			Parts []geminiPart `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func (s *Service) sendGemini(engine, context, message, modelID string) (string, error) {
	cfg := settings.GetSettingsRaw()
	gemini := cfg.AI.Gemini
	if !gemini.Enabled || gemini.Key == "" {
		return "", fmt.Errorf("Gemini is not enabled or API key is not set. Configure it in Settings → AI")
	}
	apiKey, err := security.DecryptString(gemini.Key)
	if err != nil {
		return "", fmt.Errorf("failed to use Gemini API key: %w", err)
	}
	return callGemini(apiKey, modelID, buildSystemPrompt(engine, context), message)
}

func callGemini(apiKey, modelID, systemPrompt, userMessage string) (string, error) {
	sysPart := geminiContent{Parts: []geminiPart{{Text: systemPrompt}}}
	body, err := json.Marshal(geminiReq{
		Contents:          []geminiContent{{Parts: []geminiPart{{Text: userMessage}}}},
		SystemInstruction: &sysPart,
	})
	if err != nil {
		return "", fmt.Errorf("gemini marshal: %w", err)
	}
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", modelID, apiKey)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("gemini request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("gemini request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("gemini read response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini API: %s", string(respBody))
	}

	var result geminiResp
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("gemini parse: %w", err)
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("gemini empty response")
	}
	return result.Candidates[0].Content.Parts[0].Text, nil
}
