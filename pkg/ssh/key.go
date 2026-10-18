package ssh

import (
	"os"

	"golang.org/x/crypto/ssh"
)

// readPrivateKey reads and parses a private key from a file path.
// Only unencrypted keys are supported; passphrase-protected keys fail here.
func readPrivateKey(keyPath string) (ssh.Signer, error) {
	keyBytes, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, err
	}
	return ssh.ParsePrivateKey(keyBytes)
}
