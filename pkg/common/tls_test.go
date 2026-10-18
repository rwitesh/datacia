package common

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestTLSSettingsMode(t *testing.T) {
	tests := []struct {
		name, mode string
		want       string
		wantConfig bool
		wantErr    bool
	}{
		{"empty is automatic", "", SSLModeAutomatic, false, false},
		{"automatic", SSLModeAutomatic, SSLModeAutomatic, false, false},
		{"disable", SSLModeDisable, SSLModeDisable, false, false},
		{"require", SSLModeRequire, SSLModeRequire, true, false},
		{"verify-full", SSLModeVerifyFull, SSLModeVerifyFull, true, false},
		{"unknown", "prefer", "", false, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ConnectionConfig{Host: "db", SSLMode: tt.mode}.TLSSettings()
			if (err != nil) != tt.wantErr {
				t.Fatalf("err %v, wantErr %v", err, tt.wantErr)
			}
			if got.Mode != tt.want || (got.Config != nil) != tt.wantConfig {
				t.Errorf("got mode %q, config set %v; want %q, %v", got.Mode, got.Config != nil, tt.want, tt.wantConfig)
			}
		})
	}
}

func TestTLSSettingsRequireSkipsVerification(t *testing.T) {
	got, err := ConnectionConfig{SSLMode: SSLModeRequire}.TLSSettings()
	if err != nil || !got.Config.InsecureSkipVerify {
		t.Fatalf("require config %+v, err %v; want verification skipped", got.Config, err)
	}
	got, err = ConnectionConfig{SSLMode: SSLModeVerifyFull, Host: "db"}.TLSSettings()
	if err != nil || got.Config.InsecureSkipVerify {
		t.Fatalf("verify-full config %+v, err %v; want verification on", got.Config, err)
	}
}

func TestTLSSettingsServerName(t *testing.T) {
	tests := []struct {
		name string
		cfg  ConnectionConfig
		want string
	}{
		{"host", ConnectionConfig{Host: "db.example.com"}, "db.example.com"},
		{"tunnel keeps typed host", ConnectionConfig{Host: "127.0.0.1", TLSServerName: "db.example.com"}, "db.example.com"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.cfg.SSLMode = SSLModeVerifyFull
			got, err := tt.cfg.TLSSettings()
			if err != nil || got.Config.ServerName != tt.want {
				t.Fatalf("server name %q, err %v; want %q", got.Config.ServerName, err, tt.want)
			}
		})
	}
}

func TestTLSSettingsCAFile(t *testing.T) {
	caPath, _, _ := writeTestCerts(t, "db.example.com")
	dir := t.TempDir()
	notPEM := filepath.Join(dir, "empty.pem")
	if err := os.WriteFile(notPEM, []byte("nothing"), 0o600); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name, path string
		wantErr    bool
	}{
		{"system roots", "", false},
		{"valid CA", caPath, false},
		{"missing file", filepath.Join(dir, "missing.pem"), true},
		{"not a certificate", notPEM, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ConnectionConfig{Host: "db", SSLMode: SSLModeVerifyFull, SSLCAPath: tt.path}.TLSSettings()
			if (err != nil) != tt.wantErr {
				t.Fatalf("err %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
	// The CA is ignored unless verify-full uses it.
	if _, err := (ConnectionConfig{SSLMode: SSLModeRequire, SSLCAPath: "/missing"}).TLSSettings(); err != nil {
		t.Errorf("require read the CA file: %v", err)
	}
}

// TestVerifyFullHandshake runs real handshakes against a server whose
// certificate is for db.example.com, dialled by another address as through
// an SSH tunnel.
func TestVerifyFullHandshake(t *testing.T) {
	caPath, serverCert, otherCA := writeTestCerts(t, "db.example.com")
	tests := []struct {
		name string
		cfg  ConnectionConfig
		ok   bool
	}{
		{"typed host matches", ConnectionConfig{Host: "db.example.com", SSLCAPath: caPath}, true},
		{"tunnel with typed host", ConnectionConfig{Host: "127.0.0.1", TLSServerName: "db.example.com", SSLCAPath: caPath}, true},
		{"host differs from certificate", ConnectionConfig{Host: "other.example.com", SSLCAPath: caPath}, false},
		{"tunnel address is not the certificate host", ConnectionConfig{Host: "127.0.0.1", SSLCAPath: caPath}, false},
		{"untrusted CA", ConnectionConfig{Host: "db.example.com", SSLCAPath: otherCA}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.cfg.SSLMode = SSLModeVerifyFull
			settings, err := tt.cfg.TLSSettings()
			if err != nil {
				t.Fatal(err)
			}
			if err := handshake(serverCert, settings.Config); (err == nil) != tt.ok {
				t.Fatalf("handshake err %v, want ok=%v", err, tt.ok)
			}
		})
	}

	settings, err := ConnectionConfig{Host: "other.example.com", SSLMode: SSLModeRequire}.TLSSettings()
	if err != nil {
		t.Fatal(err)
	}
	if err := handshake(serverCert, settings.Config); err != nil {
		t.Errorf("require rejected an unverified certificate: %v", err)
	}
}

// handshake dials over loopback TCP, whose buffering lets a failed handshake
// return at once, unlike net.Pipe.
func handshake(serverCert tls.Certificate, client *tls.Config) error {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	defer l.Close()
	go func() {
		c, err := l.Accept()
		if err != nil {
			return
		}
		defer c.Close()
		_ = tls.Server(c, &tls.Config{Certificates: []tls.Certificate{serverCert}}).Handshake()
	}()
	c, err := net.Dial("tcp", l.Addr().String())
	if err != nil {
		return err
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(5 * time.Second))
	return tls.Client(c, client).Handshake()
}

// writeTestCerts writes a CA file and returns its path, a server certificate
// for host signed by it, and the path of an unrelated CA file.
func writeTestCerts(t *testing.T, host string) (caPath string, server tls.Certificate, otherCAPath string) {
	t.Helper()
	caPath, caCert, caKey := newCA(t, "test ca")
	otherCAPath, _, _ = newCA(t, "other ca")

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: host}, DNSNames: []string{host},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, caCert, &key.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	return caPath, tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}, otherCAPath
}

func newCA(t *testing.T, name string) (path string, cert *x509.Certificate, key *ecdsa.PrivateKey) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: name},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
		IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	cert, err = x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	path = filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(path, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
	return path, cert, key
}
