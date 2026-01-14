package security

import (
	"crypto/sha256"
	"datacia/internal/constants"
	"fmt"
	"sync"

	deviceid "github.com/microsoft/go-deviceid"
	"golang.org/x/crypto/pbkdf2"
)

// SecurityContext holds machine-specific encryption keys and identifiers
// that are computed once at startup and reused throughout the application.
type SecurityContext struct {
	machineID     string // Raw machine ID
	hashedID      string // SHA-256 hash of machine ID (for license validation)
	encryptionKey []byte // Derived encryption key (machine ID + app salt)
	mu            sync.RWMutex
}

var (
	globalContext     *SecurityContext
	globalContextOnce sync.Once
	initError         error
)

// InitSecurityContext initializes the global security context once at application startup.
// This should be called early in the application lifecycle.
func InitSecurityContext() error {
	globalContextOnce.Do(func() {
		ctx := &SecurityContext{}

		// Get machine ID
		id, err := deviceid.Get()
		if err != nil {
			initError = fmt.Errorf("failed to retrieve machine ID: %w. This may be due to insufficient permissions or unsupported platform", err)
			return
		}
		if id == "" {
			initError = fmt.Errorf("machine ID is empty - hardware identification unavailable")
			return
		}
		ctx.machineID = id

		// Compute hashed ID for license validation
		ctx.hashedID = Sha256Hex(id)

		// Derive encryption key using PBKDF2
		// This key is used for encrypting license data and database credentials
		ctx.encryptionKey = pbkdf2.Key(
			[]byte(id),
			[]byte(constants.AppSalt),
			4096,
			32,
			sha256.New,
		)

		globalContext = ctx
	})

	return initError
}

// GetSecurityContext returns the global security context.
// Returns an error if InitSecurityContext has not been called or failed.
func GetSecurityContext() (*SecurityContext, error) {
	if globalContext == nil {
		return nil, fmt.Errorf("security context not initialized - call InitSecurityContext first")
	}
	return globalContext, nil
}

// GetMachineID returns the raw machine ID.
func (c *SecurityContext) GetMachineID() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.machineID
}

// GetHashedMachineID returns the SHA-256 hash of the machine ID.
func (c *SecurityContext) GetHashedMachineID() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.hashedID
}

// GetEncryptionKey returns a copy of the encryption key.
// The caller should call Wipe() on the returned slice when done.
func (c *SecurityContext) GetEncryptionKey() []byte {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Return a copy to prevent accidental modification
	keyCopy := make([]byte, len(c.encryptionKey))
	copy(keyCopy, c.encryptionKey)
	return keyCopy
}

// Cleanup wipes sensitive data from memory.
// This should be called when the application is shutting down.
func (c *SecurityContext) Cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()

	Wipe(c.encryptionKey)
	c.machineID = ""
	c.hashedID = ""
}
