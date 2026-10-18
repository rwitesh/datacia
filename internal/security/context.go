package security

import (
	"fmt"
	"sync"

	deviceid "github.com/microsoft/go-deviceid"
)

// SecurityContext holds the machine-bound encryption key and the anonymous
// device ID, computed once at startup and only read afterwards.
type SecurityContext struct {
	encryptionKey []byte // derived from the machine ID and the app salt
	deviceID      string // for error reports; can't be used to derive the key
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

		machineID := Sha256Hex(id)
		ctx.encryptionKey = deriveEncryptionKey(machineID)
		ctx.deviceID = anonymousDeviceID(machineID)

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

// DeviceID returns the anonymous device ID sent with error reports.
func (c *SecurityContext) DeviceID() string {
	return c.deviceID
}

// returns a copy of the encryption key.
// The caller should call Wipe() on the returned slice when done.
func (c *SecurityContext) GetEncryptionKey() []byte {
	// Return a copy to prevent accidental modification
	keyCopy := make([]byte, len(c.encryptionKey))
	copy(keyCopy, c.encryptionKey)
	return keyCopy
}
