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
	ErrGracePeriodOver   = errors.New("internet connection required to validate license")
	ErrMachineMismatch   = errors.New("hardware mismatch")
	ErrLicenseExpired    = errors.New("license has expired")
)

const (
	MaxOfflineDuration = 24 * time.Hour
	GracePeriod        = 7 * 24 * time.Hour // 7 days grace period after last update
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
	// If it's been more than 24h + 7 days grace period since last check, require internet validation
	timeSinceLastCheck := time.Since(l.LastCheck)
	if timeSinceLastCheck > MaxOfflineDuration+GracePeriod {
		return ErrGracePeriodOver
	}

	return nil
}
