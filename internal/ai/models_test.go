package ai

import (
	"context"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"
)

func ids(models []Model) []string {
	out := make([]string, len(models))
	for i, m := range models {
		out[i] = m.ID
	}
	return out
}

func TestListModels(t *testing.T) {
	cases := []struct {
		provider string
		routes   map[string]string
		header   [2]string
		want     []string
	}{
		{
			provider: "anthropic",
			routes: map[string]string{"/v1/models": `{"data":[
				{"id":"claude-old","display_name":"Old","created_at":"2025-01-01T00:00:00Z"},
				{"id":"claude-new","display_name":"New","created_at":"2026-09-01T00:00:00Z"}]}`},
			header: [2]string{"x-api-key", "k"},
			want:   []string{"claude-new", "claude-old"},
		},
		{
			provider: "openai",
			routes: map[string]string{"/v1/models": `{"data":[
				{"id":"gpt-a","created":1},{"id":"text-embedding-3","created":9},
				{"id":"gpt-b","created":5},{"id":"whisper-1","created":9}]}`},
			header: [2]string{"Authorization", "Bearer k"},
			want:   []string{"gpt-b", "gpt-a"},
		},
		{
			provider: "gemini",
			routes: map[string]string{"/v1beta/models": `{"models":[
				{"name":"models/gemini-a","supportedGenerationMethods":["generateContent"]},
				{"name":"models/text-embedding-004","supportedGenerationMethods":["embedContent"]},
				{"name":"models/gemini-b","supportedGenerationMethods":["generateContent","countTokens"]}]}`},
			header: [2]string{"x-goog-api-key", "k"},
			want:   []string{"gemini-b", "gemini-a"},
		},
		{
			provider: "openrouter",
			routes: map[string]string{
				"/api/v1/key": `{"data":{}}`,
				"/api/v1/models": `{"data":[
					{"id":"a/text","created":1,"architecture":{"output_modalities":["text"]}},
					{"id":"b/image","created":2,"architecture":{"output_modalities":["image"]}}]}`,
			},
			want: []string{"a/text"},
		},
		{
			provider: "local",
			routes:   map[string]string{"/v1/models": `{"data":[{"id":"llama"},{"id":"qwen"}]}`},
			want:     []string{"llama", "qwen"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.provider, func(t *testing.T) {
			bad := make(chan string, 4)
			srv := fakeServer(t, func(w http.ResponseWriter, r *http.Request) {
				body, ok := tc.routes[r.URL.Path]
				if !ok {
					bad <- "unexpected path " + r.URL.Path
					http.NotFound(w, r)
					return
				}
				if h := tc.header; h[0] != "" && r.Header.Get(h[0]) != h[1] {
					bad <- "missing " + h[0]
				}
				fmt.Fprint(w, body)
			})
			p := mustProvider(t, tc.provider)
			models, err := p.list(context.Background(), "k", fakeBase(srv, p))
			close(bad)
			for msg := range bad {
				t.Error(msg)
			}
			if err != nil {
				t.Fatal(err)
			}
			if got := ids(sortModels(models)); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestListModelsErrors(t *testing.T) {
	srv := fakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprint(w, `{"error":{"message":"bad key"}}`)
	})
	p := mustProvider(t, "local")
	_, err := p.list(context.Background(), "k", srv.URL)
	if got := userError(p, err).Error(); !strings.Contains(got, "rejected the API key") {
		t.Fatalf("got %q", got)
	}
}

func TestOpenCodeFilter(t *testing.T) {
	for id, want := range map[string]bool{"qwen3-max": true, "glm-5.3": true, "claude-sonnet-5-5": false, "gpt-6": false, "gemini-3": false} {
		if isOpenCodeChat(id) != want {
			t.Errorf("%s: want %v", id, want)
		}
	}
}

func TestBaseURLOnlyForCustomProviders(t *testing.T) {
	if got := baseURL(mustProvider(t, "openai"), "http://elsewhere"); got != "https://api.openai.com/v1" {
		t.Errorf("openai used %q", got)
	}
	if got := baseURL(mustProvider(t, "local"), "http://box:1234/v1/"); got != "http://box:1234/v1" {
		t.Errorf("local used %q", got)
	}
}

func TestModelCache(t *testing.T) {
	calls := 0
	srv := fakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		fmt.Fprint(w, `{"data":[{"id":"llama"}]}`)
	})
	var c modelCache
	p := mustProvider(t, "local")
	for _, key := range []string{"a", "a", "b"} {
		if _, err := c.list(context.Background(), p, srv.URL+"/v1", key); err != nil {
			t.Fatal(err)
		}
	}
	if calls != 2 {
		t.Fatalf("listed %d times, want 2: once, then again for the new key", calls)
	}
}
