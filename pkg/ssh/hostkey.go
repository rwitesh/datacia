package ssh

import (
	"errors"
	"fmt"
	"net"
	"os"
	"sync"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

// ConfirmHostKey asks the user whether to trust an SSH server seen for the
// first time. fingerprint is the SHA256 form that `ssh-keygen -lf` prints.
type ConfirmHostKey func(host, fingerprint string) bool

// hostKeyMu serializes reads and appends so two concurrent first connections
// to the same host can't both prompt or corrupt the file.
var hostKeyMu sync.Mutex

// hostKeyCallback implements trust on first use over an OpenSSH known_hosts
// file: a known key must match, an unknown host is trusted only if confirm
// says so (and is then remembered), and a changed key always fails, since
// that is exactly what a man-in-the-middle looks like.
func hostKeyCallback(knownHostsPath string, confirm ConfirmHostKey) ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		hostKeyMu.Lock()
		defer hostKeyMu.Unlock()

		// knownhosts.New needs the file to exist.
		if f, err := os.OpenFile(knownHostsPath, os.O_CREATE|os.O_RDONLY, 0o600); err != nil {
			return fmt.Errorf("failed to open known hosts file: %w", err)
		} else {
			f.Close()
		}
		check, err := knownhosts.New(knownHostsPath)
		if err != nil {
			return fmt.Errorf("failed to read known hosts file: %w", err)
		}

		err = check(hostname, remote, key)
		var keyErr *knownhosts.KeyError
		if err == nil || !errors.As(err, &keyErr) {
			return err
		}
		fingerprint := ssh.FingerprintSHA256(key)
		if len(keyErr.Want) > 0 {
			return fmt.Errorf("SSH host key for %s has changed (now %s). "+
				"This could be a man-in-the-middle attack, so the connection was refused. "+
				"If the server was reinstalled, remove its line from %s and connect again",
				hostname, fingerprint, knownHostsPath)
		}

		if confirm == nil || !confirm(hostname, fingerprint) {
			return fmt.Errorf("SSH host key for %s was not trusted", hostname)
		}
		f, err := os.OpenFile(knownHostsPath, os.O_APPEND|os.O_WRONLY, 0o600)
		if err != nil {
			return fmt.Errorf("failed to save SSH host key: %w", err)
		}
		defer f.Close()
		_, err = fmt.Fprintln(f, knownhosts.Line([]string{hostname}, key))
		return err
	}
}
