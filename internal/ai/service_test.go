package ai

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/zendev-sh/goai"
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

func TestStreamReplyPerProtocol(t *testing.T) {
	cases := []struct {
		provider string
		path     string
		events   []string
		check    func(r *http.Request) error
	}{
		{
			provider: "anthropic",
			path:     "/v1/messages",
			events: []string{
				`event: message_start` + "\n" + `data: {"type":"message_start","message":{"id":"m","type":"message","role":"assistant","content":[],"model":"x","usage":{"input_tokens":1,"output_tokens":0}}}`,
				`event: content_block_start` + "\n" + `data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
				`event: content_block_delta` + "\n" + `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"SELECT "}}`,
				`event: content_block_delta` + "\n" + `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"1"}}`,
				`event: content_block_stop` + "\n" + `data: {"type":"content_block_stop","index":0}`,
				`event: message_delta` + "\n" + `data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}`,
				`event: message_stop` + "\n" + `data: {"type":"message_stop"}`,
			},
			check: func(r *http.Request) error {
				if r.Header.Get("x-api-key") != "k" {
					return errors.New("missing x-api-key")
				}
				return nil
			},
		},
		{
			provider: "openai",
			path:     "/v1/responses",
			events: []string{
				`event: response.created` + "\n" + `data: {"type":"response.created","response":{"id":"r","status":"in_progress","output":[]}}`,
				`event: response.output_text.delta` + "\n" + `data: {"type":"response.output_text.delta","item_id":"i","output_index":0,"content_index":0,"delta":"SELECT "}`,
				`event: response.output_text.delta` + "\n" + `data: {"type":"response.output_text.delta","item_id":"i","output_index":0,"content_index":0,"delta":"1"}`,
				`event: response.completed` + "\n" + `data: {"type":"response.completed","response":{"id":"r","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":2}}}`,
			},
			check: func(r *http.Request) error {
				if r.Header.Get("Authorization") != "Bearer k" {
					return errors.New("missing bearer token")
				}
				return nil
			},
		},
		{
			provider: "openrouter",
			path:     "/api/v1/chat/completions",
			events: []string{
				`: OPENROUTER PROCESSING`,
				`data: {"id":"c","choices":[{"index":0,"delta":{"role":"assistant","content":"SELECT "}}]}`,
				`data: {"id":"c","choices":[{"index":0,"delta":{"content":"1"},"finish_reason":"stop"}]}`,
				`data: [DONE]`,
			},
			check: func(r *http.Request) error {
				if r.Header.Get("Authorization") != "Bearer k" {
					return errors.New("missing bearer token")
				}
				return nil
			},
		},
		{
			provider: "local",
			path:     "/v1/chat/completions",
			events: []string{
				`data: {"id":"c","choices":[{"index":0,"delta":{"content":"SELECT "}}]}`,
				`data: {"id":"c","choices":[{"index":0,"delta":{"content":"1"},"finish_reason":"stop"}]}`,
				`data: [DONE]`,
			},
		},
		{
			provider: "gemini",
			path:     "/v1beta/models/m:streamGenerateContent",
			events: []string{
				`data: {"candidates":[{"content":{"role":"model","parts":[{"text":"SELECT "}]}}]}`,
				`data: {"candidates":[{"content":{"role":"model","parts":[{"text":"1"}]},"finishReason":"STOP"}]}`,
			},
			check: func(r *http.Request) error {
				if r.Header.Get("x-goog-api-key") != "k" || strings.Contains(r.URL.RawQuery, "key=") {
					return errors.New("key must be sent in the header only")
				}
				return nil
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.provider, func(t *testing.T) {
			reqErr := make(chan error, 1)
			srv := fakeServer(t, func(w http.ResponseWriter, r *http.Request) {
				err := error(nil)
				if r.URL.Path != tc.path {
					err = fmt.Errorf("path %q, want %q", r.URL.Path, tc.path)
				} else if tc.check != nil {
					err = tc.check(r)
				}
				reqErr <- err
				sse(w, tc.events...)
			})
			p := mustProvider(t, tc.provider)
			var deltas []string
			reply, err := streamReply(context.Background(), p.chat("m", "k", fakeBase(srv, p)), "sys", history, func(s string) {
				deltas = append(deltas, s)
			}, p.options...)
			if err != nil {
				t.Fatal(err)
			}
			if err := <-reqErr; err != nil {
				t.Fatal(err)
			}
			if reply != "SELECT 1" || strings.Join(deltas, "") != "SELECT 1" {
				t.Fatalf("reply %q, deltas %q", reply, deltas)
			}
		})
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
