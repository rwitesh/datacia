package license

import "time"

type License struct {
	ID        string    `json:"id"`
	Key       string    `json:"key"`
	Email     string    `json:"email"`
	ExpiresAt time.Time `json:"expires_at"`
	Token     string    `json:"token"`
}

type LicenseData struct {
	LicenseKey string `json:"license_key"`
	OS         string `json:"os"`
	OSArch     string `json:"os_arch"`
	OSVersion  string `json:"os_version"`
	AppVersion string `json:"app_version"`
	MachineID  string `json:"machine_id"`
}

type TokenRequest struct {
	Token     string `json:"token"`
	MachineID string `json:"machine_id"`
}
