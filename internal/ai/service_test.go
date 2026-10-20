package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/zendev-sh/goai"
	"github.com/zendev-sh/goai/provider"
)

func sse(w http.ResponseWriter, events ...string) {
	w.Header().Set("Content-Type", "text/event-stream")
	for _, e := range events {
		fmt.Fprint(w, e+"\n\n")
		w.(http.Flusher).Flush()
	}
}

func fakeServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return srv
}

func mustProvider(t *testing.T, id string) Provider {
	t.Helper()
	p, err := findProvider(id)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

// fakeBase mirrors p's default base URL path on srv.
func fakeBase(srv *httptest.Server, p Provider) string {
	u, _ := url.Parse(p.DefaultBaseURL)
	return srv.URL + u.Path
}

var history = []Message{{Role: "user", Content: "count users"}}

// The request is what we own: the path each protocol is sent to and where the
// API key goes. Gemini's key must stay out of the URL, which lands in logs.
func TestStreamReplyRequests(t *testing.T) {
	cases := []struct{ provider, path, header, value string }{
		{"anthropic", "/v1/messages", "x-api-key", "k"},
		{"openai", "/v1/responses", "Authorization", "Bearer k"},
		{"openrouter", "/api/v1/chat/completions", "Authorization", "Bearer k"},
		{"gemini", "/v1beta/models/m:streamGenerateContent", "x-goog-api-key", "k"},
	}
	for _, tc := range cases {
		t.Run(tc.provider, func(t *testing.T) {
			var got *http.Request
			srv := fakeServer(t, func(w http.ResponseWriter, r *http.Request) {
				got = r
				w.WriteHeader(http.StatusUnauthorized)
			})
			p := mustProvider(t, tc.provider)
			_, _ = streamReply(context.Background(), p.chat("m", "k", fakeBase(srv, p)), "sys", history, func(string) {}, goai.WithMaxRetries(0))
			if got == nil || got.URL.Path != tc.path || got.Header.Get(tc.header) != tc.value || strings.Contains(got.URL.RawQuery, "key=") {
				t.Fatalf("unexpected request %v", got)
			}
		})
	}
}

func TestStreamReplyStreamsDeltas(t *testing.T) {
	srv := fakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		sse(w,
			`data: {"id":"c","choices":[{"index":0,"delta":{"content":"SELECT "}}]}`,
			`data: {"id":"c","choices":[{"index":0,"delta":{"content":"1"},"finish_reason":"stop"}]}`,
			`data: [DONE]`)
	})
	var deltas []string
	reply, err := streamReply(context.Background(), mustProvider(t, "local").chat("m", "", srv.URL), "sys", history, func(s string) {
		deltas = append(deltas, s)
	})
	if err != nil {
		t.Fatal(err)
	}
	if reply != "SELECT 1" || strings.Join(deltas, "") != "SELECT 1" {
		t.Fatalf("reply %q, deltas %q", reply, deltas)
	}
}

func TestStreamReplyErrors(t *testing.T) {
	cases := []struct {
		status int
		want   string
	}{
		{http.StatusUnauthorized, "rejected the API key"},
		{http.StatusNotFound, "doesn't recognize this model"},
		{http.StatusTooManyRequests, "rate limit"},
	}
	for _, tc := range cases {
		srv := fakeServer(t, func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(tc.status)
			fmt.Fprint(w, `{"error":{"message":"nope"}}`)
		})
		p := mustProvider(t, "openai")
		_, err := streamReply(context.Background(), p.chat("m", "k", srv.URL), "sys", history, func(string) {}, goai.WithMaxRetries(0))
		if err == nil {
			t.Fatalf("HTTP %d: no error", tc.status)
		}
		if got := userError(p, err).Error(); !strings.Contains(got, tc.want) {
			t.Fatalf("HTTP %d: %q", tc.status, got)
		}
	}
}

func TestStreamReplyCancel(t *testing.T) {
	srv := fakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		sse(w, `data: {"id":"c","choices":[{"index":0,"delta":{"content":"SELECT"}}]}`)
		<-r.Context().Done()
	})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		_, err := streamReply(ctx, mustProvider(t, "local").chat("m", "", srv.URL), "sys", history, func(string) { cancel() })
		done <- err
	}()
	select {
	case err := <-done:
		if !errors.Is(userError(mustProvider(t, "local"), err), context.Canceled) {
			t.Fatalf("want context.Canceled, got %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("stream didn't stop after cancel")
	}
}

func TestUserErrorNetwork(t *testing.T) {
	p := mustProvider(t, "local")
	_, err := streamReply(context.Background(), p.chat("m", "", "http://127.0.0.1:1"), "sys", history, func(string) {}, goai.WithMaxRetries(0))
	if got := userError(p, err).Error(); !strings.Contains(got, "Couldn't reach") {
		t.Fatalf("got %q", got)
	}
	if !strings.Contains(userError(p, &goai.ContextOverflowError{}).Error(), "too long") {
		t.Fatal("overflow not mapped")
	}
}

func TestNormalizeHistory(t *testing.T) {
	in := []Message{
		{Role: "assistant", Content: "hi"},
		{Role: "user", Content: "a"},
		{Role: "user", Content: " b "},
		{Role: "assistant", Content: ""},
		{Role: "system", Content: "x"},
		{Role: "assistant", Content: "c"},
		{Role: "user", Content: "d"},
	}
	want := []Message{{"user", "a\n\nb"}, {"assistant", "c"}, {"user", "d"}}
	if got := normalizeHistory(in); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v", got)
	}

	long := make([]Message, 0, 50)
	for i := range 50 {
		role := "user"
		if i%2 == 1 {
			role = "assistant"
		}
		long = append(long, Message{Role: role, Content: fmt.Sprint(i)})
	}
	got := normalizeHistory(long)
	if len(got) > maxHistory || got[0].Role != "user" {
		t.Fatalf("len %d, first %v", len(got), got[0])
	}
}

func TestReplyPartsKeepOrder(t *testing.T) {
	var r replyParts
	emitted := 0
	emit := func() { emitted++ }
	r.addText("Checking ", emit)
	r.addText("sizes.", emit)
	r.setTool(ToolUse{ID: "q", Label: "Ran a query"}, emit)
	r.addText("Done.", emit)
	r.setTool(ToolUse{ID: "q", Label: "Ran a query", Done: true}, emit)

	if len(r.parts) != 3 || r.parts[0].Text != "Checking sizes." || r.parts[2].Text != "Done." {
		t.Fatalf("parts %+v", r.parts)
	}
	// The finished tool replaces the running one in place.
	if tool := r.parts[1].Tool; tool == nil || !tool.Done {
		t.Fatalf("tool part %+v", r.parts[1])
	}
	if emitted != 5 {
		t.Errorf("emitted %d changes, want 5", emitted)
	}
}

func TestStreamReplyAnswersAfterLastStep(t *testing.T) {
	var choices []any
	srv := fakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var req struct {
			ToolChoice any `json:"tool_choice"`
		}
		_ = json.Unmarshal(body, &req)
		choices = append(choices, req.ToolChoice)
		if len(choices) == 3 && !strings.Contains(string(body), `"role":"tool"`) {
			t.Error("the answer request is missing the tool results")
		}
		if len(choices) <= 2 {
			sse(w,
				`data: {"id":"c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"t1","type":"function","function":{"name":"ping","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}`,
				`data: [DONE]`)
			return
		}
		sse(w,
			`data: {"id":"c","choices":[{"index":0,"delta":{"content":"pong"},"finish_reason":"stop"}]}`,
			`data: [DONE]`)
	})
	ping := goai.NewTool("ping", "Pings.", func(context.Context, struct{}) (string, error) { return "ok", nil })

	reply, err := streamReply(context.Background(), mustProvider(t, "local").chat("m", "", srv.URL), "sys", history, func(string) {},
		goai.WithTools(ping), goai.WithMaxSteps(2))
	if err != nil {
		t.Fatal(err)
	}
	// The step budget ran out on a tool call, so one more request, with
	// tools off, gets the answer.
	if reply != "pong" || len(choices) != 3 || choices[2] != "none" {
		t.Fatalf("reply %q, tool choices %v", reply, choices)
	}
}

func TestUsageAdd(t *testing.T) {
	var u Usage
	u.add(provider.Usage{InputTokens: 100, CacheWriteTokens: 900, OutputTokens: 20})
	u.add(provider.Usage{InputTokens: 50, CacheReadTokens: 950, OutputTokens: 30})
	// Context is the last call's prompt; cached tokens count as prompt tokens.
	want := Usage{Context: 1000, Prompt: 2000, CacheRead: 950, Output: 50}
	if u != want {
		t.Fatalf("usage %+v, want %+v", u, want)
	}
}

// An unknown access level has no system prompt, so Chat must refuse it.
func TestChatRejectsInvalidAccess(t *testing.T) {
	s := &Service{}
	for _, access := range []Access{"", "rows", "Data"} {
		_, err := s.Chat(context.Background(), ChatRequest{Messages: history, Access: access})
		if err == nil || !strings.Contains(err.Error(), "access") {
			t.Errorf("access %q: err %v, want an access error", access, err)
		}
	}
}
