package ssh

import (
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"io"
	"net"
	"path/filepath"
	"testing"
	"time"

	"golang.org/x/crypto/ssh"
)

// testServer is an in-process SSH server that accepts any password, answers
// keepalives and forwards direct-tcpip channels to a local echo listener.
type testServer struct {
	addr    string
	fp      string
	closeFn func()
}

func startTestServer(t *testing.T, echoAddr string) *testServer {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := ssh.NewSignerFromKey(priv)
	if err != nil {
		t.Fatal(err)
	}
	cfg := &ssh.ServerConfig{PasswordCallback: func(ssh.ConnMetadata, []byte) (*ssh.Permissions, error) { return nil, nil }}
	cfg.AddHostKey(signer)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	conns := make(chan net.Conn, 4)
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			conns <- c
			go serveConn(c, cfg, echoAddr)
		}
	}()
	return &testServer{
		addr: ln.Addr().String(),
		fp:   ssh.FingerprintSHA256(signer.PublicKey()),
		// Closing the TCP connection is how a dropped tunnel looks to the client.
		closeFn: func() {
			ln.Close()
			for {
				select {
				case c := <-conns:
					c.Close()
				default:
					return
				}
			}
		},
	}
}

func serveConn(c net.Conn, cfg *ssh.ServerConfig, echoAddr string) {
	_, chans, reqs, err := ssh.NewServerConn(c, cfg)
	if err != nil {
		return
	}
	go func() {
		for r := range reqs {
			if r.WantReply {
				_ = r.Reply(true, nil)
			}
		}
	}()
	for nc := range chans {
		ch, chReqs, err := nc.Accept()
		if err != nil {
			continue
		}
		go ssh.DiscardRequests(chReqs)
		backend, err := net.Dial("tcp", echoAddr)
		if err != nil {
			ch.Close()
			continue
		}
		go func() {
			defer ch.Close()
			defer backend.Close()
			done := make(chan struct{}, 2)
			go func() { _, _ = io.Copy(backend, ch); done <- struct{}{} }()
			go func() { _, _ = io.Copy(ch, backend); done <- struct{}{} }()
			<-done
		}()
	}
}

func startEcho(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go func() {
				defer c.Close()
				buf := make([]byte, 1024)
				for {
					n, err := c.Read(buf)
					if err != nil {
						return
					}
					c.Write(buf[:n])
				}
			}()
		}
	}()
	return ln.Addr().String()
}

func dialTunnel(t *testing.T, srv *testServer, accepted string) (*Tunnel, error) {
	t.Helper()
	host, port, _ := net.SplitHostPort(srv.addr)
	return NewTunnel(Config{
		Host: host, Port: port, Username: "u", Password: "p",
		KnownHostsPath:      filepath.Join(t.TempDir(), "known_hosts"),
		AcceptedFingerprint: accepted,
		KeepAliveInterval:   50 * time.Millisecond,
	}, "echo.invalid", "0")
}

func TestTunnelRequiresAcceptedHostKey(t *testing.T) {
	srv := startTestServer(t, startEcho(t))
	defer srv.closeFn()

	_, err := dialTunnel(t, srv, "")
	var unknown *HostKeyUnknownError
	if !errors.As(err, &unknown) || unknown.Fingerprint != srv.fp {
		t.Fatalf("got %v, want unknown host key with %s", err, srv.fp)
	}
}

func TestTunnelForwardsAndClosesCleanly(t *testing.T) {
	echo := startEcho(t)
	srv := startTestServer(t, echo)
	defer srv.closeFn()

	tunnel, err := dialTunnel(t, srv, srv.fp)
	if err != nil {
		t.Fatal(err)
	}

	conn, err := net.Dial("tcp", tunnel.LocalAddr())
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(5 * time.Second))
	if _, err := conn.Write([]byte("ping")); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 4)
	if _, err := conn.Read(buf); err != nil || string(buf) != "ping" {
		t.Fatalf("echo = %q, %v", buf, err)
	}

	// Close must return even though a forwarded connection is still open.
	closed := make(chan struct{})
	go func() { tunnel.Close(); close(closed) }()
	select {
	case <-closed:
	case <-time.After(5 * time.Second):
		t.Fatal("Close did not wait for forwarding to end")
	}
}

func TestTunnelDetectsLoss(t *testing.T) {
	srv := startTestServer(t, startEcho(t))
	tunnel, err := dialTunnel(t, srv, srv.fp)
	if err != nil {
		t.Fatal(err)
	}
	defer tunnel.Close()
	if err := tunnel.Err(); err != nil {
		t.Fatalf("healthy tunnel reports %v", err)
	}

	srv.closeFn()

	deadline := time.Now().Add(5 * time.Second)
	for tunnel.Err() == nil {
		if time.Now().After(deadline) {
			t.Fatal("tunnel loss was not detected")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !errors.Is(tunnel.Err(), ErrTunnelLost) {
		t.Fatalf("got %v, want ErrTunnelLost", tunnel.Err())
	}
}
