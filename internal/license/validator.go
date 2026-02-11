package license

import (
	"crypto/rsa"
	"errors"
	"time"

	"datacia/internal/security"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidToken    = errors.New("Invalid license")
	ErrClockRollback   = errors.New("Invalid license")
	ErrGracePeriodOver = errors.New("Failed to validate license")
	ErrMachineMismatch = errors.New("Invalid license")
	ErrLicenseExpired  = errors.New("License has expired")
)

const (
	GracePeriod = 7 * 24 * time.Hour
)

type LicenseClaims struct {
	LicenseID string `json:"lid"`
	MachineID string `json:"mid"`
	jwt.RegisteredClaims
}

type Verifier struct {
	publicKey *rsa.PublicKey
}

func NewVerifier() *Verifier {
	return &Verifier{
		publicKey: security.GetRSAPublicKey(),
	}
}

func (v *Verifier) ParseClaims(token string) (*LicenseClaims, error) {
	parsed, err := jwt.ParseWithClaims(token, &LicenseClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, ErrInvalidToken
		}
		return v.publicKey, nil
	}, jwt.WithIssuer("datacia"))

	if err != nil {
		return nil, ErrInvalidToken
	}

	claims, ok := parsed.Claims.(*LicenseClaims)
	if !ok || !parsed.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

func (v *Verifier) VerifyToken(l *License) error {
	claims, err := v.ParseClaims(l.Token)
	if err != nil {
		return err
	}

	currentMachineId, err := security.GetMachineID()
	if err != nil {
		return err
	}

	if claims.MachineID != currentMachineId {
		return ErrMachineMismatch
	}

	return nil
}

func (v *Verifier) IsLicenseValid(l *License) error {
	if l == nil {
		return errors.New("no license provided")
	}

	claims, err := v.ParseClaims(l.Token)
	if err != nil {
		return err
	}

	currentMachineHash, err := security.GetMachineID()
	if err != nil {
		return err
	}
	if claims.MachineID != currentMachineHash {
		return ErrMachineMismatch
	}

	// Use JWT iat (issued at) as the last successful server check time.
	// This is tamper-proof — modifying iat invalidates the RSA signature.
	issuedAt := claims.IssuedAt.Time

	now := time.Now()
	if now.Add(5 * time.Minute).Before(issuedAt) {
		return ErrClockRollback
	}

	timeSinceLastCheck := now.Sub(issuedAt)

	// Expiry check with grace period
	if claims.ExpiresAt != nil && now.After(claims.ExpiresAt.Time) {
		if timeSinceLastCheck > GracePeriod {
			return ErrLicenseExpired
		}
	}

	// Offline grace period
	if timeSinceLastCheck > GracePeriod {
		return ErrGracePeriodOver
	}

	return nil
}
