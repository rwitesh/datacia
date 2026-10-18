package postgres

import (
	"encoding/binary"
	"io"
	"net"
	"strings"
	"sync/atomic"
	"testing"

	"datacia/pkg/common"
)

// refuseTLS starts a server that answers an SSL request with "N", as a
// Postgres server without TLS does, and reports whether the client then sent
// a plaintext startup message.
func refuseTLS(t *testing.T) (port string, sentPlaintext func() bool) {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { l.Close() })
	var plaintext atomic.Bool
	go func() {
		for {
			c, err := l.Accept()
			if err != nil {
				return
			}
			go func() {
				defer c.Close()
				request := make([]byte, 8)
				if _, err := io.ReadFull(c, request); err != nil {
					return
				}
				// 80877103 is the SSL request code; anything else is a startup message.
				if binary.BigEndian.Uint32(request[4:]) != 80877103 {
					plaintext.Store(true)
					return
				}
				_, _ = c.Write([]byte("N"))
				if _, err := io.ReadFull(c, make([]byte, 8)); err == nil {
					plaintext.Store(true)
				}
			}()
		}
	}()
	_, port, _ = net.SplitHostPort(l.Addr().String())
	return port, plaintext.Load
}

func TestConnectNeverFallsBackToPlaintext(t *testing.T) {
	tests := []struct {
		mode          string
		wantPlaintext bool
	}{
		{common.SSLModeAutomatic, true},
		{common.SSLModeDisable, true},
		{common.SSLModeRequire, false},
		{common.SSLModeVerifyFull, false},
	}
	for _, tt := range tests {
		t.Run(tt.mode, func(t *testing.T) {
			port, sentPlaintext := refuseTLS(t)
			err := New().Connect(common.ConnectionConfig{
				Host: "127.0.0.1", Port: port, Username: "u", Database: "d", SSLMode: tt.mode,
			})
			if err == nil {
				t.Fatal("connected to a server that isn't Postgres")
			}
			if !tt.wantPlaintext && !strings.Contains(err.Error(), "TLS") {
				t.Errorf("err %v, want a TLS refusal", err)
			}
			if got := sentPlaintext(); got != tt.wantPlaintext {
				t.Errorf("plaintext startup sent = %v, want %v", got, tt.wantPlaintext)
			}
		})
	}
}
