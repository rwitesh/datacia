package ai

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"
)

const callbackPage = `<!doctype html><meta charset="utf-8"><title>DataCia</title>` +
	`<body style="font:15px system-ui;padding:3rem;text-align:center">` +
	`<h2>Return to DataCia</h2><p>You can close this tab.</p>`

// openRouterSignIn runs OpenRouter's OAuth PKCE flow and returns a user-owned API key.
// https://openrouter.ai/docs/use-cases/oauth-pkce
func openRouterSignIn(ctx context.Context, baseURL string, open func(url string) error) (string, error) {
	verifier := rand.Text() + rand.Text()
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", fmt.Errorf("Couldn't start sign-in: %w", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	// A secret callback path stops other local processes from injecting a code.
	callbackPath := "/callback/" + rand.Text()
	codes := make(chan string, 1)
	srv := &http.Server{
		ReadHeaderTimeout: 10 * time.Second,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			code := r.URL.Query().Get("code")
			if r.URL.Path != callbackPath || code == "" {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprint(w, callbackPage)
			select {
			case codes <- code:
			default:
			}
		}),
	}
	defer srv.Close()
	go func() { _ = srv.Serve(ln) }()
	// Browsers may resolve localhost to ::1 first.
	if ln6, err := net.Listen("tcp", fmt.Sprintf("[::1]:%d", port)); err == nil {
		go func() { _ = srv.Serve(ln6) }()
	}

	q := url.Values{
		"callback_url":          {fmt.Sprintf("http://localhost:%d%s", port, callbackPath)},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
	}
	if err := open("https://openrouter.ai/auth?" + q.Encode()); err != nil {
		return "", fmt.Errorf("Couldn't open the browser: %w", err)
	}

	var code string
	select {
	case code = <-codes:
	case <-ctx.Done():
		return "", ctx.Err()
	}

	body, _ := json.Marshal(map[string]string{"code": code, "code_verifier": verifier, "code_challenge_method": "S256"})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/auth/keys", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", errors.New("Couldn't reach OpenRouter.")
	}
	defer resp.Body.Close()
	var out struct {
		Key string `json:"key"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&out) != nil || out.Key == "" {
		return "", fmt.Errorf("OpenRouter sign-in failed (HTTP %d).", resp.StatusCode)
	}
	return out.Key, nil
}
