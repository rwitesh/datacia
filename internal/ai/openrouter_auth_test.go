package ai

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"testing"
)

func TestOpenRouterSignIn(t *testing.T) {
	var challenge string
	exchange := fakeServer(t, func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		sum := sha256.Sum256([]byte(body["code_verifier"]))
		if r.URL.Path != "/auth/keys" || body["code"] != "the-code" || base64.RawURLEncoding.EncodeToString(sum[:]) != challenge {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"key": "sk-or-user"})
	})
	open := func(authURL string) error {
		u, err := url.Parse(authURL)
		if err != nil {
			return err
		}
		q := u.Query()
		challenge = q.Get("code_challenge")
		callback, err := url.Parse(q.Get("callback_url"))
		if err != nil {
			return err
		}
		callback.Host = "127.0.0.1:" + callback.Port()

		guess := *callback
		guess.Path = "/callback"
		guess.RawQuery = "code=injected"
		if resp, err := http.Get(guess.String()); err == nil {
			resp.Body.Close()
			if resp.StatusCode != http.StatusNotFound {
				t.Errorf("unguessed callback path answered %d", resp.StatusCode)
			}
		}

		callback.RawQuery = "code=the-code"
		go func() {
			if resp, err := http.Get(callback.String()); err == nil {
				resp.Body.Close()
			}
		}()
		return nil
	}

	key, err := openRouterSignIn(context.Background(), exchange.URL, open)
	if err != nil {
		t.Fatal(err)
	}
	if key != "sk-or-user" {
		t.Fatalf("key %q", key)
	}
}

func TestOpenRouterSignInCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	_, err := openRouterSignIn(ctx, "http://unused", func(string) error { cancel(); return nil })
	if err != context.Canceled {
		t.Fatalf("want context.Canceled, got %v", err)
	}
}
