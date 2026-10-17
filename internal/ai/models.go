package ai

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/zendev-sh/goai"
)

type Model struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type listedModel struct {
	Model
	created int64
}

type modelLister func(ctx context.Context, key, baseURL string) ([]listedModel, error)

var httpClient = &http.Client{Timeout: 20 * time.Second}

// getJSON fetches url into out. Non-2xx responses become *goai.APIError so
// userError maps them like chat errors.
func getJSON(ctx context.Context, url string, headers map[string]string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return &goai.APIError{StatusCode: resp.StatusCode, Message: errorMessage(body, resp.Status)}
	}
	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("unexpected model list: %w", err)
	}
	return nil
}

func errorMessage(body []byte, fallback string) string {
	var v struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
		Message string `json:"message"`
	}
	_ = json.Unmarshal(body, &v)
	return cmp.Or(v.Error.Message, v.Message, fallback)
}

func bearer(key string) map[string]string {
	if key == "" {
		return nil
	}
	return map[string]string{"Authorization": "Bearer " + key}
}

// listCompat reads an OpenAI-style model list from url (default baseURL/models),
// keeping IDs that pass keep.
func listCompat(url string, keep func(id string) bool) modelLister {
	return func(ctx context.Context, key, baseURL string) ([]listedModel, error) {
		u := url
		if u == "" {
			u = baseURL + "/models"
		}
		var out struct {
			Data []struct {
				ID      string `json:"id"`
				Name    string `json:"name"`
				Created int64  `json:"created"`
			} `json:"data"`
		}
		if err := getJSON(ctx, u, bearer(key), &out); err != nil {
			return nil, err
		}
		var models []listedModel
		for _, m := range out.Data {
			if keep == nil || keep(m.ID) {
				models = append(models, listedModel{Model{m.ID, cmp.Or(m.Name, m.ID)}, m.Created})
			}
		}
		return models, nil
	}
}

var (
	nonChatOpenAI = []string{"embedding", "tts", "whisper", "dall-e", "moderation", "image", "audio",
		"realtime", "transcribe", "search", "davinci", "babbage", "codex", "computer-use", "sora"}
	nonChatGemini = []string{"embedding", "imagen", "image", "tts", "aqa", "robotics"}
)

func containsAny(id string, parts []string) bool {
	return slices.ContainsFunc(parts, func(s string) bool { return strings.Contains(id, s) })
}

func isOpenAIChat(id string) bool {
	return !containsAny(id, nonChatOpenAI)
}

// OpenCode's Claude, GPT and Gemini models don't use Chat Completions.
func isOpenCodeChat(id string) bool {
	return !strings.HasPrefix(id, "claude") && !strings.HasPrefix(id, "gpt") && !strings.HasPrefix(id, "gemini")
}

func listAnthropic(ctx context.Context, key, baseURL string) ([]listedModel, error) {
	var out struct {
		Data []struct {
			ID          string    `json:"id"`
			DisplayName string    `json:"display_name"`
			CreatedAt   time.Time `json:"created_at"`
		} `json:"data"`
	}
	headers := map[string]string{"x-api-key": key, "anthropic-version": "2023-06-01"}
	if err := getJSON(ctx, baseURL+"/v1/models?limit=1000", headers, &out); err != nil {
		return nil, err
	}
	models := make([]listedModel, 0, len(out.Data))
	for _, m := range out.Data {
		models = append(models, listedModel{Model{m.ID, cmp.Or(m.DisplayName, m.ID)}, m.CreatedAt.Unix()})
	}
	return models, nil
}

func listGemini(ctx context.Context, key, baseURL string) ([]listedModel, error) {
	var out struct {
		Models []struct {
			Name        string   `json:"name"`
			DisplayName string   `json:"displayName"`
			Methods     []string `json:"supportedGenerationMethods"`
		} `json:"models"`
	}
	headers := map[string]string{"x-goog-api-key": key}
	if err := getJSON(ctx, baseURL+"/v1beta/models?pageSize=1000", headers, &out); err != nil {
		return nil, err
	}
	var models []listedModel
	for i, m := range out.Models {
		id := strings.TrimPrefix(m.Name, "models/")
		if !slices.Contains(m.Methods, "generateContent") || containsAny(id, nonChatGemini) {
			continue
		}
		// No dates in the list; later entries are newer.
		models = append(models, listedModel{Model{id, cmp.Or(m.DisplayName, id)}, int64(i)})
	}
	return models, nil
}

func listOpenRouter(ctx context.Context, key, baseURL string) ([]listedModel, error) {
	// The model list is public, so check the key on its own.
	var keyInfo struct{}
	if err := getJSON(ctx, baseURL+"/key", bearer(key), &keyInfo); err != nil {
		return nil, err
	}
	var out struct {
		Data []struct {
			ID           string `json:"id"`
			Name         string `json:"name"`
			Created      int64  `json:"created"`
			Architecture struct {
				Output []string `json:"output_modalities"`
			} `json:"architecture"`
		} `json:"data"`
	}
	if err := getJSON(ctx, baseURL+"/models", nil, &out); err != nil {
		return nil, err
	}
	var models []listedModel
	for _, m := range out.Data {
		if len(m.Architecture.Output) == 0 || slices.Contains(m.Architecture.Output, "text") {
			models = append(models, listedModel{Model{m.ID, cmp.Or(m.Name, m.ID)}, m.Created})
		}
	}
	return models, nil
}

// sortModels puts the newest models first, then sorts by ID.
func sortModels(in []listedModel) []Model {
	slices.SortStableFunc(in, func(a, b listedModel) int {
		return cmp.Or(cmp.Compare(b.created, a.created), strings.Compare(a.ID, b.ID))
	})
	out := make([]Model, len(in))
	for i, m := range in {
		out[i] = m.Model
	}
	return out
}
