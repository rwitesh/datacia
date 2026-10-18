package common

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"strings"
)

const (
	// SSLModeAutomatic keeps each driver's default: pgx tries TLS unverified
	// and falls back to plaintext, which an attacker can force; MySQL and
	// ClickHouse use plaintext.
	SSLModeAutomatic = "automatic"
	// SSLModeDisable never uses TLS.
	SSLModeDisable = "disable"
	// SSLModeRequire uses TLS without checking the certificate, so it stops
	// eavesdropping but not impersonation.
	SSLModeRequire = "require"
	// SSLModeVerifyFull uses TLS and checks the certificate chain and host name.
	SSLModeVerifyFull = "verify-full"
)

// TLSSettings is how an engine should secure a connection. Config is set only
// for require and verify-full; Automatic and Disable leave it nil.
type TLSSettings struct {
	Mode   string
	Config *tls.Config
}

// TLSSettings resolves the connection's SSL mode. An empty mode (saved before
// the setting existed) is Automatic.
func (c ConnectionConfig) TLSSettings() (TLSSettings, error) {
	mode := strings.TrimSpace(c.SSLMode)
	if mode == "" {
		mode = SSLModeAutomatic
	}
	switch mode {
	case SSLModeAutomatic, SSLModeDisable:
		return TLSSettings{Mode: mode}, nil
	case SSLModeRequire:
		// The point of this mode is to skip verification.
		return TLSSettings{Mode: mode, Config: &tls.Config{MinVersion: tls.VersionTLS12, InsecureSkipVerify: true}}, nil
	case SSLModeVerifyFull:
		cfg := &tls.Config{MinVersion: tls.VersionTLS12, ServerName: c.tlsServerName()}
		if caPath := strings.TrimSpace(c.SSLCAPath); caPath != "" {
			pem, err := os.ReadFile(caPath)
			if err != nil {
				return TLSSettings{}, fmt.Errorf("cannot read CA certificate: %w", err)
			}
			pool := x509.NewCertPool()
			if !pool.AppendCertsFromPEM(pem) {
				return TLSSettings{}, fmt.Errorf("no certificate found in %s", caPath)
			}
			cfg.RootCAs = pool
		}
		return TLSSettings{Mode: mode, Config: cfg}, nil
	default:
		return TLSSettings{}, fmt.Errorf("unknown SSL mode %q", mode)
	}
}

// tlsServerName is the host the certificate must name. An SSH tunnel makes
// Host the local end, but the certificate belongs to the host the user typed.
func (c ConnectionConfig) tlsServerName() string {
	if c.TLSServerName != "" {
		return c.TLSServerName
	}
	return c.Host
}
