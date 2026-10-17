package ssh

import (
	"io"
	"os"

	"golang.org/x/crypto/ssh"
)

// readPrivateKey reads and parses a private key from a file path
func readPrivateKey(keyPath string) (ssh.Signer, error) {
	file, err := os.Open(keyPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	keyBytes, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	// Only unencrypted keys are supported; passphrase-protected keys fail here.
	signer, err := ssh.ParsePrivateKey(keyBytes)
	if err != nil {
		return nil, err
	}

	return signer, nil
}
