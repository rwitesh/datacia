package license

import (
	"fmt"
	"time"
)

type License struct {
	ID            string    `json:"id"`
	Key           string    `json:"key"`
	MachineId     string    `json:"machine_id"`
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"`
	CustomerName  string    `json:"customer_name,omitempty"`
	CustomerEmail string    `json:"customer_email,omitempty"`
	Signature     []byte    `json:"signature"`
	LastCheck     time.Time `json:"last_check"`
}

type LicenseData struct {
	LicenseKey string `json:"license_key"`
	OS         string `json:"os"`
	OSArch     string `json:"os_arch"`
	OSVersion  string `json:"os_version"`
	AppVersion string `json:"app_version"`
	MachineID  string `json:"machine_id"`
}

var license *License

// CanonicalString generates the deterministic string for signing/verification:
// Format: license_key:machine_id:expiry_timestamp:last_check_timestamp
// Timestamps are Unix seconds. 0 for empty/nil timestamps if verified (though we expect them).
func (l *License) CanonicalString() string {
	expiry := int64(0)
	if !l.ExpiresAt.IsZero() {
		expiry = l.ExpiresAt.Unix()
	}

	lastCheck := int64(0)
	if !l.LastCheck.IsZero() {
		lastCheck = l.LastCheck.Unix()
	}

	return fmt.Sprintf("%s:%s:%d:%d",
		l.Key,
		l.MachineId,
		expiry,
		lastCheck,
	)
}
