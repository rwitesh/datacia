package license

import (
	"datacia/internal/security"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type LicenseService struct {
	app       *application.App
	loadError error
}

var lastValidationResult *Response

func NewLicenseService(app *application.App) *LicenseService {
	loaded, err := LoadLicense()

	service := &LicenseService{app: app}

	if err == nil && loaded != nil {
		license = loaded
	} else if err != nil {
		service.loadError = err
		lastValidationResult = &Response{Success: false, Message: err.Error()}
	}

	return service
}

type Response struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

func (s *LicenseService) Activate(licenseKey string) Response {
	hashedMachineID, err := security.GetMachineID()
	if err != nil {
		return Response{Success: false, Error: "Device identification failed"}
	}

	response, err := LicenseActivate(licenseKey, hashedMachineID)
	if err != nil {
		return Response{Success: false, Error: err.Error()}
	}

	verifier := NewVerifier()
	if err := verifier.VerifyToken(response); err != nil {
		return Response{Success: false, Error: err.Error()}
	}

	if err := SaveLicense(response); err != nil {
		return Response{Success: false, Error: "Failed to save license"}
	}

	license = response

	go s.ValidateOnStart()

	return Response{
		Success: true,
		Message: "License activated successfully",
	}
}

func (s *LicenseService) Deactivate() Response {
	if license == nil {
		return Response{Success: false, Message: "No license found"}
	}

	hashedMachineID, err := security.GetMachineID()
	if err != nil {
		return Response{Success: false, Error: "Failed to identify machine."}
	}

	if err := LicenseDeactivate(license.Token, hashedMachineID); err != nil {
		return Response{Success: false, Error: err.Error()}
	}

	_ = RemoveLicense()

	license = nil
	return Response{Success: true, Message: "License deactivated"}
}

func (s *LicenseService) Validate() Response {
	if license == nil {
		return Response{Success: false, Message: "No license found"}
	}

	hashedMachineID, err := security.GetMachineID()
	if err != nil {
		return Response{Success: false, Error: err.Error()}
	}

	response, err := LicenseValidate(license.Token, hashedMachineID)
	if err != nil {
		return Response{Success: false, Error: err.Error()}
	}

	verifier := NewVerifier()
	if err := verifier.VerifyToken(response); err != nil {
		return Response{Success: false, Error: "License token verification failed"}
	}

	if err := SaveLicense(response); err != nil {
		return Response{Success: false, Error: err.Error()}
	}

	license = response

	return Response{Success: true, Message: "License valid"}
}

func (s *LicenseService) ValidateOnStart() error {
	if license == nil {
		lastValidationResult = nil
		return nil
	}

	verifier := NewVerifier()
	err := verifier.IsLicenseValid(license)

	if err != nil {
		lastValidationResult = &Response{Success: false, Error: err.Error()}
		return nil
	}

	// Use JWT iat to check if already validated today
	claims, err := verifier.ParseClaims(license.Token)
	if err == nil && claims.IssuedAt != nil {
		if isSameDay(claims.IssuedAt.Time, time.Now()) {
			lastValidationResult = &Response{
				Success: true,
				Message: "License valid",
			}
			return nil
		}
	}

	go func() {
		s.Validate()
	}()

	lastValidationResult = &Response{Success: true, Message: "License valid"}
	return nil
}

func (s *LicenseService) GetStatus() map[string]interface{} {
	status := map[string]interface{}{
		"valid": false,
	}

	if license != nil {
		if lastValidationResult != nil {
			status["valid"] = lastValidationResult.Success
			if lastValidationResult.Error != "" {
				status["error"] = lastValidationResult.Error
			}
		}

		status["license_key"] = license.Key
		status["email"] = license.Email

		// Extract expires_at from JWT claims
		verifier := NewVerifier()
		claims, err := verifier.ParseClaims(license.Token)
		if err == nil && claims.ExpiresAt != nil {
			status["expires_at"] = claims.ExpiresAt.Time.Format(time.RFC3339)
		}
	}

	return status
}

func GetLicenseID() string {
	if license == nil {
		return ""
	}
	return license.ID
}
