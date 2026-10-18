package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"

	"datacia/internal/constants"

	"golang.org/x/crypto/pbkdf2"
)

// Wipe zeroes sensitive data. It is best effort: the Go runtime may already
// have copied it elsewhere in memory.
func Wipe(data []byte) {
	clear(data)
}

// Encrypt encrypts plaintext using the provided master key and returns the ciphertext.
func Encrypt(masterKey, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

// Decrypt decrypts ciphertext using the provided master key and returns the plaintext.
func Decrypt(masterKey, ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce := ciphertext[:nonceSize]
	body := ciphertext[nonceSize:]

	plain, err := gcm.Open(nil, nonce, body, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plain, nil
}

// EncryptString encrypts a plaintext string using machine-bound encryption and returns
// the result as a base64-encoded string.
func EncryptString(plaintext string) (string, error) {
	ctx, err := GetSecurityContext()
	if err != nil {
		return "", err
	}
	key := ctx.GetEncryptionKey()
	defer Wipe(key)

	ciphertext, err := Encrypt(key, []byte(plaintext))
	if err != nil {
		return "", fmt.Errorf("failed to encrypt data: %w", err)
	}
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptString decrypts a base64-encoded ciphertext string using machine-bound encryption
// and returns the plaintext string.
func DecryptString(ciphertext string) (string, error) {
	ctx, err := GetSecurityContext()
	if err != nil {
		return "", err
	}
	key := ctx.GetEncryptionKey()
	defer Wipe(key)

	ciphertextBytes, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 ciphertext: %w", err)
	}
	plaintext, err := Decrypt(key, ciphertextBytes)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt data: %w", err)
	}
	defer Wipe(plaintext)
	return string(plaintext), nil
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

// anonymousDeviceID identifies a device in error reports. The machine ID is
// the only secret input to deriveEncryptionKey (the salt is public), so it
// must never leave the machine; this one-way hash of it can.
func anonymousDeviceID(machineID string) string {
	return sha256Hex("datacia-device-id:" + machineID)
}

// deriveEncryptionKey derives the 32-byte AES-256 key from the hashed machine
// ID. Changing the salt, iteration count or hash makes every saved password
// and API key unreadable.
func deriveEncryptionKey(machineID string) []byte {
	return pbkdf2.Key([]byte(machineID), []byte(constants.AppSalt), 4096, 32, sha256.New)
}
