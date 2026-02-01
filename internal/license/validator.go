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
	ErrSignatureMismatch = errors.New("Invalid license")
	ErrClockRollback     = errors.New("Invalid license")
	ErrGracePeriodOver   = errors.New("Failed to validate license")
	ErrMachineMismatch   = errors.New("Invalid license")
	ErrLicenseExpired    = errors.New("License has expired")
)

const (
	GracePeriod = 7 * 24 * time.Hour // 7 days grace period after last successful check
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
	// Allow use for up to 7 days without a successful server check; expiry still checked above.
	timeSinceLastCheck := time.Since(l.LastCheck)
	if timeSinceLastCheck > GracePeriod {
		return ErrGracePeriodOver
	}

	return nil
}
