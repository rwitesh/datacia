package ssh

import (
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/crypto/ssh"
)

// Tunnel represents an SSH tunnel connection
type Tunnel struct {
	client     *ssh.Client
	localAddr  string
	remoteAddr string
	listener   net.Listener

	wg        sync.WaitGroup
	done      chan struct{}
	closeOnce sync.Once
	lostErr   atomic.Pointer[error]
}

// keepaliveInterval and keepaliveTimeout bound how long a silently dead
// connection (sleep, network change, NAT timeout) goes unnoticed.
var (
	keepaliveInterval = 15 * time.Second
	keepaliveTimeout  = 10 * time.Second
)

// ErrTunnelLost is returned once the SSH connection has gone away.
var ErrTunnelLost = errors.New("SSH tunnel lost")

// Config holds SSH connection configuration
type Config struct {
	Host     string
	Port     string
	Username string
	Password string
	KeyPath  string

	// KnownHostsPath is the trusted host key file. Confirm is asked about
	// hosts not in it yet; without it unknown hosts are refused.
	KnownHostsPath string
	Confirm        ConfirmHostKey
}

// NewTunnel creates a new SSH tunnel to forward local connections to a remote address
// Returns the local address that should be used to connect to the remote service
func NewTunnel(sshConfig Config, remoteHost, remotePort string) (*Tunnel, error) {
	// Build SSH client config
	config := &ssh.ClientConfig{
		User:            sshConfig.Username,
		HostKeyCallback: hostKeyCallback(sshConfig.KnownHostsPath, sshConfig.Confirm),
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
		return nil, fmt.Errorf("failed to dial SSH server: %w", err)
	}

	// Create local listener on a random port
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to create local listener: %w", err)
	}

	localAddr := listener.Addr().String()
	remoteAddr := net.JoinHostPort(remoteHost, remotePort)

	tunnel := &Tunnel{
		client:     client,
		localAddr:  localAddr,
		remoteAddr: remoteAddr,
		listener:   listener,
		done:       make(chan struct{}),
	}

	tunnel.wg.Add(2)
	go tunnel.forward()
	go tunnel.keepAlive()

	return tunnel, nil
}

// LocalAddr returns the local address that should be used to connect through the tunnel
func (t *Tunnel) LocalAddr() string {
	return t.localAddr
}

// Err returns ErrTunnelLost once the SSH connection died, nil while healthy.
func (t *Tunnel) Err() error {
	if p := t.lostErr.Load(); p != nil {
		return *p
	}
	return nil
}

// keepAlive probes the server periodically; a failed probe closes the
// client so every forwarded connection ends instead of hanging.
func (t *Tunnel) keepAlive() {
	defer t.wg.Done()
	ticker := time.NewTicker(keepaliveInterval)
	defer ticker.Stop()
	for {
		select {
		case <-t.done:
			return
		case <-ticker.C:
		}
		probe := make(chan error, 1)
		go func() {
			_, _, err := t.client.SendRequest("keepalive@openssh.com", true, nil)
			probe <- err
		}()
		var err error
		select {
		case <-t.done:
			return
		case err = <-probe:
		case <-time.After(keepaliveTimeout):
			err = errors.New("keepalive timed out")
		}
		if err != nil {
			lost := fmt.Errorf("%w: %v", ErrTunnelLost, err)
			t.lostErr.Store(&lost)
			t.client.Close()
			return
		}
	}
}

// forward handles forwarding connections from local listener to remote address
func (t *Tunnel) forward() {
	defer t.wg.Done()
	for {
		localConn, err := t.listener.Accept()
		if err != nil {
			// Listener closed, exit
			return
		}

		t.wg.Add(1)
		go func() {
			defer t.wg.Done()
			defer localConn.Close()

			// Dial remote address through SSH connection
			remoteConn, err := t.client.Dial("tcp", t.remoteAddr)
			if err != nil {
				return
			}
			defer remoteConn.Close()

			// Copy data bidirectionally
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
			// Closing both ends (the defers) unblocks the other copy, which
			// Close then doesn't have to wait for.
			remoteConn.Close()
			localConn.Close()
			<-done
		}()
	}
}

// Close closes the SSH tunnel and waits for its goroutines to finish.
func (t *Tunnel) Close() error {
	var errs []error
	t.closeOnce.Do(func() {
		close(t.done)
		if err := t.listener.Close(); err != nil {
			errs = append(errs, err)
		}
		// An already-dead client reports an error we don't care about.
		_ = t.client.Close()
		t.wg.Wait()
	})
	if len(errs) > 0 {
		return fmt.Errorf("errors closing tunnel: %v", errs)
	}
	return nil
}
