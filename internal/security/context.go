package security

import (
	"bytes"
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

// InitSecurityContext derives the global security context. It must run at
// startup, before anything encrypts or decrypts.
func InitSecurityContext() error {
	globalContextOnce.Do(func() {
		id, err := deviceid.Get()
		if err != nil {
			initError = fmt.Errorf("failed to retrieve machine ID: %w. This may be due to insufficient permissions or unsupported platform", err)
			return
		}
		if id == "" {
			initError = fmt.Errorf("machine ID is empty - hardware identification unavailable")
			return
		}

		machineID := sha256Hex(id)
		globalContext = &SecurityContext{
			encryptionKey: deriveEncryptionKey(machineID),
			deviceID:      anonymousDeviceID(machineID),
		}
	})

	return initError
}

// GetSecurityContext returns the context set up by InitSecurityContext.
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

// GetEncryptionKey returns a copy of the encryption key, which the caller may
// Wipe when done.
func (c *SecurityContext) GetEncryptionKey() []byte {
	return bytes.Clone(c.encryptionKey)
}
