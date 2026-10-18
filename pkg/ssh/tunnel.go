package ssh

import (
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
)

const (
	defaultKeepAliveInterval = 30 * time.Second
	keepAliveTimeout         = 15 * time.Second
)

// ErrTunnelLost is returned by Tunnel.Err once the SSH connection is gone.
var ErrTunnelLost = errors.New("SSH tunnel lost; connect again")

// Tunnel represents an SSH tunnel connection
type Tunnel struct {
	client     *ssh.Client
	localAddr  string
	remoteAddr string
	listener   net.Listener
	// background counts the accept loop, the watcher and the connections
	// being forwarded, so Close can wait for them.
	background sync.WaitGroup
	// lost is closed when the SSH connection ends, for any reason.
	lost chan struct{}
}

// Config holds SSH connection configuration
type Config struct {
	Host     string
	Port     string
	Username string
	Password string
	KeyPath  string
	// KnownHostsPath is the known_hosts file the server key is checked against.
	KnownHostsPath string
	// AcceptedFingerprint is the SHA256 fingerprint the user confirmed for an
	// unknown host key; the live key must match it to be trusted.
	AcceptedFingerprint string
	// KeepAliveInterval defaults to 30 seconds.
	KeepAliveInterval time.Duration
}

// NewTunnel creates a new SSH tunnel to forward local connections to a remote address
// Returns the local address that should be used to connect to the remote service
func NewTunnel(sshConfig Config, remoteHost, remotePort string) (*Tunnel, error) {
	config := &ssh.ClientConfig{
		User:            sshConfig.Username,
		HostKeyCallback: hostKeyCallback(sshConfig.KnownHostsPath, sshConfig.AcceptedFingerprint),
		Timeout:         10 * time.Second,
	}

	// Use key-based auth if key path is provided, otherwise use password
	if sshConfig.KeyPath != "" {
		key, err := readPrivateKey(sshConfig.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read private key: %w", err)
		}
		config.Auth = []ssh.AuthMethod{ssh.PublicKeys(key)}
	} else if sshConfig.Password != "" {
		config.Auth = []ssh.AuthMethod{ssh.Password(sshConfig.Password)}
	} else {
		return nil, fmt.Errorf("either SSH key path or password must be provided")
	}

	// Connect to SSH server
	sshAddr := net.JoinHostPort(sshConfig.Host, sshConfig.Port)
	client, err := ssh.Dial("tcp", sshAddr, config)
	if err != nil {
		// The UI recognizes this error by its fields, so it can't be wrapped.
		var unknown *HostKeyUnknownError
		if errors.As(err, &unknown) {
			return nil, unknown
		}
		return nil, fmt.Errorf("failed to dial SSH server: %w", err)
	}

	// Create local listener on a random port
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to create local listener: %w", err)
	}

	tunnel := &Tunnel{
		client:     client,
		localAddr:  listener.Addr().String(),
		remoteAddr: net.JoinHostPort(remoteHost, remotePort),
		listener:   listener,
		lost:       make(chan struct{}),
	}

	interval := sshConfig.KeepAliveInterval
	if interval == 0 {
		interval = defaultKeepAliveInterval
	}
	tunnel.background.Add(2)
	go tunnel.forward()
	go tunnel.watch(interval)

	return tunnel, nil
}

// LocalAddr returns the local address that should be used to connect through the tunnel
func (t *Tunnel) LocalAddr() string {
	return t.localAddr
}

// Err returns ErrTunnelLost once the SSH connection has ended, else nil.
func (t *Tunnel) Err() error {
	select {
	case <-t.lost:
		return ErrTunnelLost
	default:
		return nil
	}
}

// watch records the end of the SSH connection. client.Wait only returns when
// the OS notices a dropped connection, so keepalive requests close the client
// when the server stops answering, e.g. after a network change or sleep.
func (t *Tunnel) watch(interval time.Duration) {
	defer t.background.Done()

	waited := make(chan struct{})
	go func() {
		_ = t.client.Wait()
		close(waited)
	}()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-waited:
			close(t.lost)
			// Stops new database connections from being accepted and then failing.
			_ = t.listener.Close()
			return
		case <-ticker.C:
			if !t.serverAnswers() {
				_ = t.client.Close()
			}
		}
	}
}

func (t *Tunnel) serverAnswers() bool {
	answered := make(chan error, 1)
	go func() {
		_, _, err := t.client.SendRequest("keepalive@openssh.com", true, nil)
		answered <- err
	}()
	select {
	case err := <-answered:
		return err == nil
	case <-time.After(keepAliveTimeout):
		return false
	}
}

// forward handles forwarding connections from local listener to remote address
func (t *Tunnel) forward() {
	defer t.background.Done()
	for {
		localConn, err := t.listener.Accept()
		if err != nil {
			// Listener closed, exit
			return
		}

		t.background.Add(1)
		go func() {
			defer t.background.Done()
			defer localConn.Close()

			// Dial remote address through SSH connection
			remoteConn, err := t.client.Dial("tcp", t.remoteAddr)
			if err != nil {
				return
			}
			defer remoteConn.Close()

			// Copy data bidirectionally; the first direction to end ends both.
			done := make(chan struct{}, 2)
			go func() {
				_, _ = io.Copy(remoteConn, localConn)
				done <- struct{}{}
			}()
			go func() {
				_, _ = io.Copy(localConn, remoteConn)
				done <- struct{}{}
			}()
			<-done
			localConn.Close()
			remoteConn.Close()
			<-done
		}()
	}
}

// Close closes the SSH tunnel and waits for its goroutines to end.
func (t *Tunnel) Close() error {
	var errs []error
	// The listener is already closed if the tunnel was lost.
	if err := t.listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		errs = append(errs, err)
	}
	if err := t.client.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		errs = append(errs, err)
	}
	t.background.Wait()
	if len(errs) > 0 {
		return fmt.Errorf("errors closing tunnel: %v", errs)
	}
	return nil
}
