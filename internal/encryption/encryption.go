package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"os"
	"path/filepath"

	"layerbits/internal/constants"

	"github.com/adrg/xdg"
)

const DefaultEncryptionKey = "5&j7ZLkjdff4cDTLs*T4TaQqu#ZMQ&ng"

// makeAESKey ensures the master key is exactly 32 bytes (AES-256)
func makeAESKey(s string) []byte {
	b := []byte(s)

	if len(b) < 32 {
		panic("DefaultEncryptionKey must be at least 32 bytes")
	}
	if len(b) > 32 {
		return b[:32]
	}
	return b
}

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

func GetOrCreateEncryptionKey() ([]byte, error) {
    keyPath, err := xdg.ConfigFile(filepath.Join(constants.APP_NAME, "encryption.key"))
    if err != nil {
        return nil, fmt.Errorf("failed to resolve config path: %w", err)
    }

    masterKey := makeAESKey(DefaultEncryptionKey)
    var cipherData []byte

	//
	// FAST PATH: if the key file exists, decrypt and return it
	//
    if st, statErr := os.Stat(keyPath); statErr == nil && !st.IsDir() {
        cipherData, err = os.ReadFile(keyPath)
        if err != nil {
            return nil, fmt.Errorf("failed to read existing encryption key: %w", err)
        }

        var raw []byte
        raw, err = Decrypt(masterKey, cipherData)
        if err != nil {
            return nil, fmt.Errorf("failed to decrypt existing encryption key: %w", err)
        }

		if len(raw) != 32 {
			return nil, fmt.Errorf("corrupted encryption key: expected 32 bytes, got %d", len(raw))
		}

		return raw, nil
	}

	//
	// SLOW PATH: file does not exist → generate new raw key
	//

    // Ensure directory exists
    err = os.MkdirAll(filepath.Dir(keyPath), 0700)
    if err != nil {
        return nil, fmt.Errorf("failed to create key directory: %w", err)
    }

    // Generate new random 32-byte key
    raw := make([]byte, 32)
    _, err = rand.Read(raw)
    if err != nil {
        return nil, fmt.Errorf("failed to generate encryption key: %w", err)
    }

    // Encrypt the key
    cipherData, err = Encrypt(masterKey, raw)
    if err != nil {
        return nil, fmt.Errorf("failed to encrypt new key: %w", err)
    }

    // Write to temp file
    tmpPath := keyPath + ".tmp"
    err = os.WriteFile(tmpPath, cipherData, 0600)
    if err != nil {
        return nil, fmt.Errorf("failed to write temp key file: %w", err)
    }

	// remove first if exists
	_ = os.Remove(keyPath)

    // Atomic replace
    err = os.Rename(tmpPath, keyPath)
    if err != nil {
        return nil, fmt.Errorf("failed to finalize key file: %w", err)
    }

	return raw, nil
}
