package common

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"os"
	"strings"
)

const (
	SSLModeDisable    = "disable"
	SSLModeRequire    = "require"
	SSLModeVerifyFull = "verify-full"
)

// TLSSettings is how a network engine secures its connection. Mode is always
// one of the SSLMode constants once it comes from NewTLSSettings.
type TLSSettings struct {
	Mode   string
	CAPath string
	// ServerName is the host to verify the certificate against. It is the
	// database host the user typed even when an SSH tunnel makes the client
	// dial 127.0.0.1.
	ServerName string
}

// NewTLSSettings validates mode and fills in the default when it is empty,
// which is the case for connections saved before the setting existed: TLS
// is required unless host is this machine, where a server rarely has a
// certificate. require encrypts without checking the certificate, so it
// only protects against passive eavesdropping.
func NewTLSSettings(mode, caPath, host string) (TLSSettings, error) {
	mode = strings.TrimSpace(mode)
	switch mode {
	case "":
		mode = SSLModeRequire
		if isLocalHost(host) {
			mode = SSLModeDisable
		}
	case SSLModeDisable, SSLModeRequire, SSLModeVerifyFull:
	default:
		return TLSSettings{}, fmt.Errorf("unknown SSL mode %q", mode)
	}
	return TLSSettings{Mode: mode, CAPath: strings.TrimSpace(caPath), ServerName: host}, nil
}

func isLocalHost(host string) bool {
	if host == "" || host == "localhost" || strings.HasPrefix(host, "/") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// Config returns the client TLS configuration, or nil when TLS is disabled.
func (t TLSSettings) Config() (*tls.Config, error) {
	switch t.Mode {
	case SSLModeRequire:
		return &tls.Config{MinVersion: tls.VersionTLS12, ServerName: t.ServerName, InsecureSkipVerify: true}, nil
	case SSLModeVerifyFull:
		cfg := &tls.Config{MinVersion: tls.VersionTLS12, ServerName: t.ServerName}
		if t.CAPath != "" {
			pem, err := os.ReadFile(t.CAPath)
			if err != nil {
				return nil, fmt.Errorf("cannot read CA certificate: %w", err)
			}
			pool := x509.NewCertPool()
			if !pool.AppendCertsFromPEM(pem) {
				return nil, fmt.Errorf("no certificate found in %s", t.CAPath)
			}
			cfg.RootCAs = pool
		}
		return cfg, nil
	default:
		return nil, nil
	}
}
