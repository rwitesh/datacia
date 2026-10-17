package security

import (
	"fmt"
	"sync"

	deviceid "github.com/microsoft/go-deviceid"
)

// SecurityContext holds machine-specific encryption keys and identifiers
// that are computed once at startup and reused throughout the application.
// Both fields are set once by InitSecurityContext and only read afterwards.
type SecurityContext struct {
	machineID     string // SHA-256 hash of device ID (used as machine identity everywhere)
	encryptionKey []byte // Derived encryption key (machine ID + app salt)
}

var (
	globalContext     *SecurityContext
	globalContextOnce sync.Once
	initError         error
)

// initializes the global security context once at application startup.
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

		ctx.machineID = Sha256Hex(id)

		ctx.encryptionKey = deriveEncryptionKey(ctx.machineID)

		globalContext = ctx
	})

	return initError
}

// returns the global security context.
func GetSecurityContext() (*SecurityContext, error) {
	if globalContext == nil {
		return nil, fmt.Errorf("security context not initialized - call InitSecurityContext first")
	}
	return globalContext, nil
}

// returns the SHA-256 hash of the machine ID.
func (c *SecurityContext) GetMachineID() string {
	return c.machineID
}

// returns a copy of the encryption key.
// The caller should call Wipe() on the returned slice when done.
func (c *SecurityContext) GetEncryptionKey() []byte {
	// Return a copy to prevent accidental modification
	keyCopy := make([]byte, len(c.encryptionKey))
	copy(keyCopy, c.encryptionKey)
	return keyCopy
}
