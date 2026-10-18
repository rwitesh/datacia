package ssh

import (
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

func newPublicKey(t *testing.T) ssh.PublicKey {
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

func TestCheckHostKey(t *testing.T) {
	const host = "db.example.com:22"
	remote := &net.TCPAddr{IP: net.ParseIP("203.0.113.5"), Port: 22}
	known, other := newPublicKey(t), newPublicKey(t)

	tests := []struct {
		name string
		// recorded is the key in known_hosts, if any.
		recorded ssh.PublicKey
		accepted string
		presents ssh.PublicKey
		// wantUnknown is the fingerprint reported, "" for none.
		wantUnknown string
		wantChanged bool
		// wantTrusted is whether a later connect without acceptance succeeds.
		wantTrusted bool
	}{
		{name: "known key matches", recorded: known, presents: known, wantTrusted: true},
		{name: "unknown key", presents: known, wantUnknown: ssh.FingerprintSHA256(known)},
		{name: "unknown key accepted", presents: known, accepted: ssh.FingerprintSHA256(known), wantTrusted: true},
		{
			name: "accepted fingerprint differs from live key", presents: other,
			accepted: ssh.FingerprintSHA256(known), wantUnknown: ssh.FingerprintSHA256(other),
		},
		{name: "changed key", recorded: known, presents: other, wantChanged: true},
		{name: "changed key is not accepted", recorded: known, presents: other, accepted: ssh.FingerprintSHA256(other), wantChanged: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "known_hosts")
			if tt.recorded != nil {
				line := knownhosts.Line([]string{host}, tt.recorded) + "\n"
				if err := os.WriteFile(path, []byte(line), 0o600); err != nil {
					t.Fatal(err)
				}
			}

			err := hostKeyCallback(path, tt.accepted)(host, remote, tt.presents)

			var unknown *HostKeyUnknownError
			switch {
			case tt.wantUnknown != "":
				if !errors.As(err, &unknown) || unknown.Fingerprint != tt.wantUnknown || unknown.Code != HostKeyUnknownCode || unknown.Host != "db.example.com" {
					t.Fatalf("got %v, want unknown key error with %s", err, tt.wantUnknown)
				}
			case tt.wantChanged:
				if err == nil || errors.As(err, &unknown) || !strings.Contains(err.Error(), "has changed") {
					t.Fatalf("got %v, want a changed key error", err)
				}
			case err != nil:
				t.Fatalf("unexpected error: %v", err)
			}

			// The key is recorded only by an accepted connect.
			if trusted := hostKeyCallback(path, "")(host, remote, tt.presents) == nil; trusted != tt.wantTrusted {
				t.Fatalf("key trusted afterwards = %v, want %v", trusted, tt.wantTrusted)
			}
		})
	}
}

func TestAppendKnownHostKeepsExistingEntry(t *testing.T) {
	path := filepath.Join(t.TempDir(), "known_hosts")
	first, second := newPublicKey(t), newPublicKey(t)
	// No trailing newline, as after a hand edit.
	if err := os.WriteFile(path, []byte(knownhosts.Line([]string{"a.example.com:22"}, first)), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := appendKnownHost(path, "b.example.com:22", second); err != nil {
		t.Fatal(err)
	}
	remote := &net.TCPAddr{IP: net.ParseIP("203.0.113.5"), Port: 22}
	for host, key := range map[string]ssh.PublicKey{"a.example.com:22": first, "b.example.com:22": second} {
		if err := hostKeyCallback(path, "")(host, remote, key); err != nil {
			t.Errorf("%s not trusted: %v", host, err)
		}
	}
}
