package ssh

import (
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"net"
	"path/filepath"
	"testing"
	"time"

	"golang.org/x/crypto/ssh"
)

// startServer runs an SSH server that accepts any password and answers
// requests. The returned function drops every connection.
func startServer(t *testing.T) (addr string, drop func()) {
	t.Helper()
	_, priv, _ := ed25519.GenerateKey(rand.Reader)
	signer, _ := ssh.NewSignerFromKey(priv)
	cfg := &ssh.ServerConfig{PasswordCallback: func(ssh.ConnMetadata, []byte) (*ssh.Permissions, error) { return nil, nil }}
	cfg.AddHostKey(signer)
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	conns := make(chan net.Conn, 4)
	go func() {
		for {
			c, err := l.Accept()
			if err != nil {
				return
			}
			conns <- c
			go func() {
				sc, chans, reqs, err := ssh.NewServerConn(c, cfg)
				if err != nil {
					return
				}
				defer sc.Close()
				go func() {
					for r := range reqs {
						if r.WantReply {
							r.Reply(false, nil)
						}
					}
				}()
				for ch := range chans {
					ch.Reject(ssh.Prohibited, "no")
				}
			}()
		}
	}()
	t.Cleanup(func() { l.Close() })
	return l.Addr().String(), func() {
		l.Close()
		for len(conns) > 0 {
			(<-conns).Close()
		}
	}
}

func newTestTunnel(t *testing.T, addr string) *Tunnel {
	t.Helper()
	host, port, _ := net.SplitHostPort(addr)
	tun, err := NewTunnel(Config{
		Host: host, Port: port, Username: "u", Password: "p",
		KnownHostsPath: filepath.Join(t.TempDir(), "known_hosts"),
		Confirm:        func(string, string) bool { return true },
	}, "127.0.0.1", "1")
	if err != nil {
		t.Fatal(err)
	}
	return tun
}

func TestTunnelDetectsLoss(t *testing.T) {
	keepaliveInterval, keepaliveTimeout = 20*time.Millisecond, time.Second
	addr, drop := startServer(t)
	tun := newTestTunnel(t, addr)

	if err := tun.Err(); err != nil {
		t.Fatalf("healthy tunnel reports %v", err)
	}
	drop()
	deadline := time.Now().Add(3 * time.Second)
	for tun.Err() == nil && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if err := tun.Err(); !errors.Is(err, ErrTunnelLost) {
		t.Fatalf("Err() = %v, want ErrTunnelLost", err)
	}
	if err := tun.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestTunnelCloseWaitsAndIsIdempotent(t *testing.T) {
	addr, _ := startServer(t)
	tun := newTestTunnel(t, addr)
	// An in-flight forwarded connection must not outlive Close.
	c, err := net.Dial("tcp", tun.LocalAddr())
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	finished := make(chan struct{})
	go func() { tun.Close(); tun.Close(); close(finished) }()
	select {
	case <-finished:
	case <-time.After(3 * time.Second):
		t.Fatal("Close did not return")
	}
}
