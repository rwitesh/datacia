package license

import (
	"datacia/internal/logger"
	"datacia/internal/security"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"go.uber.org/zap"
)

type LicenseService struct {
	app       *application.App
	loadError error
}

// cached validation status
var lastValidationResult *Response

func NewLicenseService(app *application.App) *LicenseService {
	// Try to load license on startup
	loaded, err := LoadLicense()

	service := &LicenseService{app: app}

	if err == nil && loaded != nil {
		license = loaded
		logger.Logger.Info("License loaded from disk")
	} else if err != nil {
		logger.Logger.Error("Failed to load license", zap.Error(err))
		// Capture the load error (tampering, etc)
		service.loadError = err
		// We set lastValidationResult to show this error immediately if requested
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
	logger.Logger.Info("Activating license", zap.String("key", MaskLicenseKey(licenseKey)))

	hashedMachineID, err := security.GetMachineID()
	if err != nil {
		logger.Logger.Error("Failed to get machine ID", zap.Error(err))
		return Response{Success: false, Error: "Device identification failed"}
	}

	response, err := LicenseActivate(licenseKey, hashedMachineID)
	if err != nil {
		logger.Logger.Error("Activation failed", zap.Error(err))
		return Response{Success: false, Error: err.Error()}
	}

	verifier := NewVerifier()
	if err := verifier.VerifySignature(response); err != nil {
		logger.Logger.Error("Signature verification failed during activation", zap.Error(err))
		return Response{Success: false, Error: err.Error()}
	}

	if err := SaveLicense(response); err != nil {
		logger.Logger.Error("Failed to save license", zap.Error(err))
		return Response{Success: false, Error: "Failed to save license"}
	}

	license = response
	logger.Logger.Info("License activated and verified successfully")

	// Trigger background validation
	go s.ValidateOnStart()

	return Response{
		Success: true,
		Message: "License activated successfully",
	}
}

func (s *LicenseService) Deactivate() Response {
	logger.Logger.Info("Deactivating license")

	if license == nil {
		return Response{Success: false, Message: "No license found"}
	}

	hashedMachineID, err := security.GetMachineID()
	if err != nil {
		logger.Logger.Error("Failed to get machine ID for deactivation", zap.Error(err))
		return Response{Success: false, Error: "Failed to identify machine."}
	}

	if err := LicenseDeactivate(license.Signature, hashedMachineID); err != nil {
		logger.Logger.Error("Server deactivation failed", zap.Error(err))
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
		logger.Logger.Error("Failed to get machine ID", zap.Error(err))
		return Response{Success: false, Error: err.Error()}
	}

	response, err := LicenseValidate(license.Signature, hashedMachineID)
	if err != nil {
		logger.Logger.Error("Validation failed", zap.Error(err))
		return Response{Success: false, Error: err.Error()}
	}

	verifier := NewVerifier()
	if err := verifier.VerifySignature(response); err != nil {
		logger.Logger.Error("Signature verification failed during validation", zap.Error(err))
		return Response{Success: false, Error: "License signature verification failed"}
	}

	if err := SaveLicense(response); err != nil {
		logger.Logger.Error("Failed to save license", zap.Error(err))
		return Response{Success: false, Error: err.Error()}
	}

	license = response
	logger.Logger.Info("License validated and updated successfully")

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
		logger.Logger.Error("License validation failed during start", zap.Error(err))

		lastValidationResult = &Response{Success: false, Error: err.Error()}

		return nil
	}

	// Skip server validation if already validated within last 24h (at least once per day).
	if time.Since(license.LastCheck) < 24*time.Hour {
		lastValidationResult = &Response{Success: true, Message: "License valid"}
		return nil
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
		// Use cached validation result
		if lastValidationResult != nil {
			status["valid"] = lastValidationResult.Success
			if lastValidationResult.Error != "" {
				status["error"] = lastValidationResult.Error
			}
		}

		status["license_key"] = MaskLicenseKey(license.Key)
		if !license.ExpiresAt.IsZero() {
			status["expires_at"] = license.ExpiresAt.Format(time.RFC3339)
		}

		if license.Email != "" {
			status["email"] = license.Email
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
