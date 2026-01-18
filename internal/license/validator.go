package license

import (
	"crypto/ed25519"
	"errors"
	"time"

	"datacia/internal/logger"
	"datacia/internal/security"

	"go.uber.org/zap"
)

var (
	ErrSignatureMismatch = errors.New("invalid license signature")
	ErrClockRollback     = errors.New("system clock rollback detected")
	ErrGracePeriodOver   = errors.New("offline grace period expired")
	ErrMachineMismatch   = errors.New("license machine ID mismatch")
	ErrLicenseExpired    = errors.New("license has expired")
)

const (
	MaxOfflineDuration = 24 * time.Hour
	GracePeriod        = 1 * time.Hour
)

type Verifier struct {
	// In-memory public key
	publicKey ed25519.PublicKey
}

func NewVerifier() *Verifier {
	return &Verifier{
		publicKey: security.GetPublicKey(),
	}
}

func (v *Verifier) VerifySignature(l *License) error {
	msg := []byte(l.CanonicalString())
	if !ed25519.Verify(v.publicKey, msg, l.Signature) {
		return ErrSignatureMismatch
	}
	return nil
}

// validates the system time against the last check time.
// Returns error if rollback detected.
func (v *Verifier) CheckClock(lastCheck time.Time) error {
	now := time.Now()
	// Allow for small clock skew (e.g. 5 minutes)
	if now.Add(5 * time.Minute).Before(lastCheck) {
		return ErrClockRollback
	}
	return nil
}

// IsLicenseValid performs a comprehensive check of the license
// logic:
// 1. Signature check (tamper detection)
// 2. Machine ID check
// 3. Expiry check
// 4. Clock rollback check
// 5. Offline grace period check
func (v *Verifier) IsLicenseValid(l *License) error {
	if l == nil {
		return errors.New("no license provided")
	}

	// 1. Signature Check (Tamper Detection)
	if err := v.VerifySignature(l); err != nil {
		logger.Logger.Error("Tamper detection triggered", zap.Error(err))
		return err
	}

	// 2. Machine ID Check
	// Note: We compare against hashed current machine ID
	// The License struct holds the hash.
	currentMachineHash, err := security.GetHashedMachineID()
	if err != nil {
		return err
	}
	if l.MachineId != currentMachineHash {
		return ErrMachineMismatch
	}

	// 3. Expiry Check
	if !l.ExpiresAt.IsZero() && time.Now().After(l.ExpiresAt) {
		return ErrLicenseExpired
	}

	// 4. Clock Rollback Check
	if err := v.CheckClock(l.LastCheck); err != nil {
		logger.Logger.Error("Clock rollback detected",
			zap.Time("last_check", l.LastCheck),
			zap.Time("current", time.Now()),
		)
		return err
	}

	// 5. Offline Grace Period Check
	// If it's been > 24h since last server check, we typically require validation.
	// But `IsLicenseValid` is often calling LOCALLY.
	// The Service layer calls API validate if needed.
	// Here we just check if we are beyond the "safe offline" window + grace period?
	// The requirement says:
	// > If > 24h, the client MUST successfully hit /validate
	// This implies `IsLicenseValid` should return error if > 24h, FORCING the caller to try network validation.

	timeSinceLastCheck := time.Since(l.LastCheck)
	if timeSinceLastCheck > MaxOfflineDuration {
		// If we are strictly offline, check if within grace period?
		// The prompt says: "Allow a configurable grace window (e.g. 1 hour) before locking UI".
		// This likely means: 24h is the soft limit, after that try validate. If validate fails (network),
		// allow another 1 hour.
		// So strict invalidation happens at 25h?

		if timeSinceLastCheck > MaxOfflineDuration+GracePeriod {
			return ErrGracePeriodOver
		}
		// If between 24h and 25h, it's technically "valid" for offline use but should trigger BG validation.
		// We will treat it as valid here, but Service layer should notice and try to validate.
	}

	return nil
}
