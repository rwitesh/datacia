// gen-app-salt generates a cryptographically secure 32-byte salt for PBKDF2.
// Run: go run scripts/gen-app-salt.go
// Use the output as constants.AppSalt. Keep the salt secret and do not change it
// after release, or existing derived keys/encrypted data may become invalid.
package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
)

func main() {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		fmt.Fprintf(os.Stderr, "failed to generate random salt: %v\n", err)
		os.Exit(1)
	}
	fmt.Print(base64.StdEncoding.EncodeToString(b))
}
