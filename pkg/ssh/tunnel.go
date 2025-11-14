package ssh

import (
	"fmt"
	"io"
	"log"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
)

// Tunnel represents an SSH tunnel connection
type Tunnel struct {
	client     *ssh.Client
	localAddr  string
	remoteAddr string
	listener   net.Listener
}

// Config holds SSH connection configuration
type Config struct {
	Host     string
	Port     string
	Username string
	Password string
	KeyPath  string
}

// NewTunnel creates a new SSH tunnel to forward local connections to a remote address
// Returns the local address that should be used to connect to the remote service
func NewTunnel(sshConfig Config, remoteHost, remotePort string) (*Tunnel, error) {
	log.Println("NewTunnel", sshConfig, remoteHost, remotePort)
	// Build SSH client config
	config := &ssh.ClientConfig{
		User:            sshConfig.Username,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // For production, use proper host key verification
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
	}

	// Start forwarding connections
	go tunnel.forward()

	return tunnel, nil
}

// LocalAddr returns the local address that should be used to connect through the tunnel
func (t *Tunnel) LocalAddr() string {
	return t.localAddr
}

// forward handles forwarding connections from local listener to remote address
func (t *Tunnel) forward() {
	for {
		localConn, err := t.listener.Accept()
		if err != nil {
			// Listener closed, exit
			return
		}

		go func() {
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
		}()
	}
}

// Close closes the SSH tunnel and cleans up resources
func (t *Tunnel) Close() error {
	var errs []error
	if t.listener != nil {
		if err := t.listener.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if t.client != nil {
		if err := t.client.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("errors closing tunnel: %v", errs)
	}
	return nil
}
