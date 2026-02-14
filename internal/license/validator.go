package license

import (
	"crypto/rsa"
	"errors"
	"time"

	"datacia/internal/security"

	"github.com/golang-jwt/jwt/v5"
)

var (
	errInvalidToken    = errors.New("invalid license token")
	errClockRollback   = errors.New("clock rollback detected")
	errGracePeriodOver = errors.New("revalidate license")
	errMachineMismatch = errors.New("hardware mismatch")
	errLicenseExpired  = errors.New("license expired")
)

const (
	gracePeriod = 7 * 24 * time.Hour
)

type licenseClaims struct {
	LicenseID string `json:"lid"`
	MachineID string `json:"mid"`
	jwt.RegisteredClaims
}

type verifier struct {
	publicKey *rsa.PublicKey
}

func newVerifier() *verifier {
	return &verifier{
		publicKey: security.GetRSAPublicKey(),
	}
}

func (v *verifier) parseClaims(token string) (*licenseClaims, error) {
	parsed, err := jwt.ParseWithClaims(token, &licenseClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, errInvalidToken
		}
		return v.publicKey, nil
	}, jwt.WithIssuer("datacia"))

	if err != nil {
		return nil, errInvalidToken
	}

	claims, ok := parsed.Claims.(*licenseClaims)
	if !ok || !parsed.Valid {
		return nil, errInvalidToken
	}

	return claims, nil
}

func (v *verifier) verifyToken(l *License) error {
	claims, err := v.parseClaims(l.Token)
	if err != nil {
		return err
	}

	currentMachineId, err := security.GetMachineID()
	if err != nil {
		return err
	}

	if claims.MachineID != currentMachineId {
		return errMachineMismatch
	}

	return nil
}

func (v *verifier) isLicenseValid(l *License) error {
	if l == nil {
		return errors.New("no license provided")
	}

	claims, err := v.parseClaims(l.Token)
	if err != nil {
		return err
	}

	currentMachineHash, err := security.GetMachineID()
	if err != nil {
		return err
	}
	// Machine ID check
	if claims.MachineID != currentMachineHash {
		return errMachineMismatch
	}

	issuedAt := claims.IssuedAt.Time
	now := time.Now()

	// Clock rollback check
	if now.Add(5 * time.Minute).Before(issuedAt) {
		return errClockRollback
	}

	timeSinceLastCheck := now.Sub(issuedAt)

	if claims.ExpiresAt != nil && now.After(claims.ExpiresAt.Time) {
		if timeSinceLastCheck > gracePeriod {
			return errLicenseExpired
		}
	}

	if timeSinceLastCheck > gracePeriod {
		return errGracePeriodOver
	}

	return nil
}
