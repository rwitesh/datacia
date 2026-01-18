package license

import "fmt"

// MaskLicenseKey masks a license key for display purposes.
func MaskLicenseKey(key string) string {
	if len(key) <= 8 {
		return "xxxx-xxxx"
	}
	return fmt.Sprintf("%s-xxxx-xxxx-%s", key[:4], key[len(key)-4:])
}
