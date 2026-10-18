package ssh

import (
	"crypto/ed25519"
	"crypto/rand"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/crypto/ssh"
)

func newKey(t *testing.T) ssh.PublicKey {
	t.Helper()
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	key, err := ssh.NewPublicKey(pub)
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func TestHostKeyCallback(t *testing.T) {
	trusted, other := newKey(t), newKey(t)
	addr := &net.TCPAddr{IP: net.ParseIP("192.0.2.1"), Port: 22}
	const host = "example.com:22"

	tests := []struct {
		name        string
		first       ssh.PublicKey // connect once before the checked connect; nil to skip
		answer      bool
		key         ssh.PublicKey
		wantErr     string
		wantPrompts int
	}{
		{name: "first use trusted", answer: true, key: trusted, wantPrompts: 1},
		{name: "first use declined", answer: false, key: trusted, wantErr: "not trusted", wantPrompts: 1},
		{name: "known key matches without prompt", first: trusted, answer: true, key: trusted},
		{name: "changed key fails without prompt", first: trusted, answer: true, key: other, wantErr: "has changed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "known_hosts")
			prompts := 0
			confirm := func(h, fp string) bool {
				prompts++
				if h != host || !strings.HasPrefix(fp, "SHA256:") {
					t.Errorf("confirm(%q, %q)", h, fp)
				}
				return tt.answer
			}
			cb := hostKeyCallback(path, confirm)
			if tt.first != nil {
				if err := cb(host, addr, tt.first); err != nil {
					t.Fatal(err)
				}
				prompts = 0
			}

			err := cb(host, addr, tt.key)
			switch {
			case tt.wantErr == "" && err != nil:
				t.Fatalf("unexpected error: %v", err)
			case tt.wantErr != "" && (err == nil || !strings.Contains(err.Error(), tt.wantErr)):
				t.Fatalf("error = %v, want containing %q", err, tt.wantErr)
			}
			if prompts != tt.wantPrompts {
				t.Errorf("prompts = %d, want %d", prompts, tt.wantPrompts)
			}
		})
	}
}

func TestHostKeyRememberedAcrossCallbacks(t *testing.T) {
	path := filepath.Join(t.TempDir(), "known_hosts")
	key := newKey(t)
	addr := &net.TCPAddr{IP: net.ParseIP("192.0.2.1"), Port: 22}
	if err := hostKeyCallback(path, func(string, string) bool { return true })("h:22", addr, key); err != nil {
		t.Fatal(err)
	}
	if info, err := os.Stat(path); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("known hosts file: %v, %v", info, err)
	}
	// A fresh callback with no confirm still accepts the stored key.
	if err := hostKeyCallback(path, nil)("h:22", addr, key); err != nil {
		t.Fatalf("stored key rejected: %v", err)
	}
	if err := hostKeyCallback(path, nil)("h:22", addr, newKey(t)); err == nil {
		t.Fatal("changed key accepted")
	}
}
