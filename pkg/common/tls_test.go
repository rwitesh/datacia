package common

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNewTLSSettings(t *testing.T) {
	tests := []struct {
		name, mode, host string
		want             string
		wantErr          bool
	}{
		{"empty remote requires TLS", "", "db.example.com", SSLModeRequire, false},
		{"empty localhost", "", "localhost", SSLModeDisable, false},
		{"empty localhost mixed case", "", "LocalHost.", SSLModeDisable, false},
		{"empty loopback v4", "", "127.0.0.1", SSLModeDisable, false},
		{"empty loopback v6", "", "::1", SSLModeDisable, false},
		{"empty unix socket", "", "/var/run/pg", SSLModeDisable, false},
		{"empty private ip is remote", "", "10.0.0.5", SSLModeRequire, false},
		{"explicit wins on localhost", SSLModeVerifyFull, "localhost", SSLModeVerifyFull, false},
		{"explicit disable remote", SSLModeDisable, "db.example.com", SSLModeDisable, false},
		{"unknown", "prefer", "db", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewTLSSettings(tt.mode, "", tt.host)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err %v, wantErr %v", err, tt.wantErr)
			}
			if got.Mode != tt.want {
				t.Errorf("mode %q, want %q", got.Mode, tt.want)
			}
		})
	}
}

func writeTestCA(t *testing.T) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "test ca"},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
		IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(path, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestTLSConfig(t *testing.T) {
	ca := writeTestCA(t)
	notPEM := filepath.Join(t.TempDir(), "bad.pem")
	if err := os.WriteFile(notPEM, []byte("nope"), 0o600); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name         string
		settings     TLSSettings
		wantNil      bool
		wantInsecure bool
		wantRootCAs  bool
		wantErr      bool
	}{
		{"disable", TLSSettings{Mode: SSLModeDisable}, true, false, false, false},
		{"require skips verification", TLSSettings{Mode: SSLModeRequire, ServerName: "db"}, false, true, false, false},
		{"require ignores CA", TLSSettings{Mode: SSLModeRequire, CAPath: "/missing"}, false, true, false, false},
		{"verify-full system roots", TLSSettings{Mode: SSLModeVerifyFull, ServerName: "db"}, false, false, false, false},
		{"verify-full custom CA", TLSSettings{Mode: SSLModeVerifyFull, ServerName: "db", CAPath: ca}, false, false, true, false},
		{"zero value is an error", TLSSettings{}, true, false, false, true},
		{"verify-full missing CA", TLSSettings{Mode: SSLModeVerifyFull, CAPath: "/missing"}, true, false, false, true},
		{"verify-full invalid CA", TLSSettings{Mode: SSLModeVerifyFull, CAPath: notPEM}, true, false, false, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg, err := tt.settings.Config()
			if (err != nil) != tt.wantErr {
				t.Fatalf("err %v, wantErr %v", err, tt.wantErr)
			}
			if (cfg == nil) != tt.wantNil {
				t.Fatalf("config %v, wantNil %v", cfg, tt.wantNil)
			}
			if cfg == nil {
				return
			}
			if cfg.InsecureSkipVerify != tt.wantInsecure {
				t.Errorf("InsecureSkipVerify %v, want %v", cfg.InsecureSkipVerify, tt.wantInsecure)
			}
			if (cfg.RootCAs != nil) != tt.wantRootCAs {
				t.Errorf("RootCAs set %v, want %v", cfg.RootCAs != nil, tt.wantRootCAs)
			}
			if cfg.ServerName != tt.settings.ServerName {
				t.Errorf("ServerName %q, want %q", cfg.ServerName, tt.settings.ServerName)
			}
		})
	}
}
