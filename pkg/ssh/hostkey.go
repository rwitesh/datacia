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

// HostKeyUnknownCode identifies HostKeyUnknownError in the JSON the frontend
// receives (as the error's cause) when a connect fails.
const HostKeyUnknownCode = "ssh-host-key-unknown"

// HostKeyUnknownError means the SSH server's key is not in known_hosts yet.
// The UI shows the fingerprint and, if the user trusts it, connects again
// with it as SSHConfig.AcceptedFingerprint. Callers must return it unwrapped
// so the bridge can serialize its fields.
type HostKeyUnknownError struct {
	Code        string `json:"code"`
	Host        string `json:"host"`
	Fingerprint string `json:"fingerprint"`
}

func (e *HostKeyUnknownError) Error() string {
	return fmt.Sprintf("the SSH host key of %s is not trusted yet (%s)", e.Host, e.Fingerprint)
}

// knownHostsMu serializes appends so concurrent connects can't interleave lines.
var knownHostsMu sync.Mutex

// hostKeyCallback verifies the server key against the known_hosts file. An
// unknown key is trusted, and recorded, only when its fingerprint equals
// accepted, which the user confirmed; a key that differs from the recorded
// one is always an error.
func hostKeyCallback(knownHostsPath, accepted string) ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		knownHostsMu.Lock()
		defer knownHostsMu.Unlock()
		return checkHostKey(knownHostsPath, accepted, hostname, remote, key)
	}
}

func checkHostKey(knownHostsPath, accepted, hostname string, remote net.Addr, key ssh.PublicKey) error {
	// knownhosts.New fails on a missing file, which is the normal first run.
	f, err := os.OpenFile(knownHostsPath, os.O_CREATE|os.O_RDONLY, 0o600)
	if err != nil {
		return fmt.Errorf("failed to open known hosts: %w", err)
	}
	f.Close()

	verify, err := knownhosts.New(knownHostsPath)
	if err != nil {
		return fmt.Errorf("failed to read known hosts: %w", err)
	}
	err = verify(hostname, remote, key)
	var keyErr *knownhosts.KeyError
	if err == nil || !errors.As(err, &keyErr) {
		return err
	}
	if len(keyErr.Want) > 0 {
		return fmt.Errorf("the SSH host key of %s has changed (now %s); this could be a man-in-the-middle attack. If the server was reinstalled, remove its line from %s",
			hostname, ssh.FingerprintSHA256(key), knownHostsPath)
	}

	fingerprint := ssh.FingerprintSHA256(key)
	if accepted != fingerprint {
		return &HostKeyUnknownError{Code: HostKeyUnknownCode, Host: knownhosts.Normalize(hostname), Fingerprint: fingerprint}
	}
	return appendKnownHost(knownHostsPath, hostname, key)
}

func appendKnownHost(path, hostname string, key ssh.PublicKey) error {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("failed to save the host key: %w", err)
	}
	defer f.Close()
	// A hand-edited file may lack a final newline, which would glue the new
	// line onto the last entry.
	line := knownhosts.Line([]string{hostname}, key) + "\n"
	if data, err := os.ReadFile(path); err == nil && len(data) > 0 && data[len(data)-1] != '\n' {
		line = "\n" + line
	}
	if _, err := f.WriteString(line); err != nil {
		return fmt.Errorf("failed to save the host key: %w", err)
	}
	return nil
}
