package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"

	"datacia/internal/constants"

	deviceid "github.com/microsoft/go-deviceid"
	"golang.org/x/crypto/pbkdf2"
)

// Wipe zeros out sensitive data in memory to reduce exposure.
// This is a best-effort security measure - the Go runtime may
// move or copy memory, so this doesn't guarantee complete erasure.
func Wipe(data []byte) {
	if data == nil {
		return
	}
	// Zero out the slice
	for i := range data {
		data[i] = 0
	}
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
		// Fall back to deriving key on-the-fly if context not initialized
		key, err := DeriveHardwareEncryptionKey()
		if err != nil {
			return "", fmt.Errorf("failed to derive encryption key: %w", err)
		}
		defer Wipe(key)

		plaintextBytes := []byte(plaintext)
		ciphertext, err := Encrypt(key, plaintextBytes)
		if err != nil {
			return "", fmt.Errorf("failed to encrypt data: %w", err)
		}
		return base64.StdEncoding.EncodeToString(ciphertext), nil
	}

	key := ctx.GetEncryptionKey()
	defer Wipe(key)

	plaintextBytes := []byte(plaintext)
	ciphertext, err := Encrypt(key, plaintextBytes)
	if err != nil {
		return "", fmt.Errorf("failed to encrypt data: %w", err)
	}

	// Return base64-encoded ciphertext
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptString decrypts a base64-encoded ciphertext string using machine-bound encryption
// and returns the plaintext string.
func DecryptString(ciphertext string) (string, error) {
	ctx, err := GetSecurityContext()
	if err != nil {
		// Fall back to deriving key on-the-fly if context not initialized
		key, err := DeriveHardwareEncryptionKey()
		if err != nil {
			return "", fmt.Errorf("failed to derive encryption key: %w", err)
		}
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

	key := ctx.GetEncryptionKey()
	defer Wipe(key)

	// Decode base64
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

// GetMachineID retrieves the machine identifier (SHA-256 hash of device ID).
// If SecurityContext is initialized, it returns the cached value.
// Otherwise, it computes it on-the-fly.
func GetMachineID() (string, error) {
	ctx, err := GetSecurityContext()
	if err == nil {
		return ctx.GetMachineID(), nil
	}

	id, err := deviceid.Get()
	if err != nil {
		return "", fmt.Errorf("failed to retrieve machine ID: %w", err)
	}
	if id == "" {
		return "", fmt.Errorf("machine ID is empty - hardware identification unavailable")
	}
	return Sha256Hex(id), nil
}

// DeriveHardwareEncryptionKey derives a 32-byte AES-256 key from the machine's hardware ID
// using PBKDF2. The key is deterministically derived each time, making it
// machine-bound. Data encrypted on one machine cannot be decrypted on another.
func DeriveHardwareEncryptionKey() ([]byte, error) {
	machineID, err := GetMachineID()
	if err != nil {
		return nil, fmt.Errorf("failed to get machine ID for key derivation: %w", err)
	}

	key := pbkdf2.Key(
		[]byte(machineID),
		[]byte(constants.AppSalt),
		4096,
		32,
		sha256.New,
	)

	return key, nil
}
