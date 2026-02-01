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
var lastValidationResult *ValidateResponse

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
		lastValidationResult = &ValidateResponse{Valid: false, Error: err.Error()}
	}

	return service
}

type ActivateResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

func (s *LicenseService) Activate(licenseKey string) ActivateResponse {
	logger.Logger.Info("Activating license", zap.String("key", MaskLicenseKey(licenseKey)))

	hashedMachineID, err := security.GetHashedMachineID()
	if err != nil {
		logger.Logger.Error("Failed to get machine ID", zap.Error(err))
		return ActivateResponse{Success: false, Error: err.Error()}
	}

	response, err := LicenseActivate(licenseKey, hashedMachineID)
	if err != nil {
		logger.Logger.Error("Activation failed", zap.Error(err))
		return ActivateResponse{Success: false, Error: err.Error()}
	}

	verifier := NewVerifier()
	if err := verifier.VerifySignature(response); err != nil {
		logger.Logger.Error("Signature verification failed during activation", zap.Error(err))
		return ActivateResponse{Success: false, Error: "License signature verification failed"}
	}

	if err := SaveLicense(response); err != nil {
		logger.Logger.Error("Failed to save license", zap.Error(err))
		return ActivateResponse{Success: false, Error: err.Error()}
	}

	license = response
	logger.Logger.Info("License activated and verified successfully")

	// Trigger background validation
	go s.ValidateOnStart()

	return ActivateResponse{
		Success: true,
		Message: "License activated successfully",
	}
}

type DeactivateResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

func (s *LicenseService) Deactivate() DeactivateResponse {
	logger.Logger.Info("Deactivating license")

	if license == nil {
		return DeactivateResponse{Success: false, Error: "No license found"}
	}

	hashedMachineID, err := security.GetHashedMachineID()
	if err != nil {
		logger.Logger.Error("Failed to get machine ID for deactivation", zap.Error(err))
		return DeactivateResponse{Success: false, Error: "Failed to identy machine."}
	}

	if err := LicenseDeactivate(license.Key, hashedMachineID); err != nil {
		logger.Logger.Error("Server deactivation failed", zap.Error(err))
		return DeactivateResponse{Success: false, Error: "Server deactivation failed."}
	}

	_ = RemoveLicense()

	license = nil
	return DeactivateResponse{Success: true, Message: "License deactivated"}
}

type ValidateResponse struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

func (s *LicenseService) Validate() ValidateResponse {
	if license == nil {
		return ValidateResponse{Valid: false, Message: "No license found"}
	}

	hashedMachineID, err := security.GetHashedMachineID()
	if err != nil {
		logger.Logger.Error("Failed to get machine ID", zap.Error(err))
		return ValidateResponse{Valid: false, Error: err.Error()}
	}

	response, err := LicenseValidate(license.Key, hashedMachineID)
	if err != nil {
		logger.Logger.Error("Validation failed", zap.Error(err))
		return ValidateResponse{Valid: false, Error: err.Error()}
	}

	verifier := NewVerifier()
	if err := verifier.VerifySignature(response); err != nil {
		logger.Logger.Error("Signature verification failed during validation", zap.Error(err))
		return ValidateResponse{Valid: false, Error: "License signature verification failed"}
	}

	if err := SaveLicense(response); err != nil {
		logger.Logger.Error("Failed to save license", zap.Error(err))
		return ValidateResponse{Valid: false, Error: err.Error()}
	}

	license = response
	logger.Logger.Info("License validated and updated successfully")

	return ValidateResponse{Valid: true, Message: "License valid"}
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

		lastValidationResult = &ValidateResponse{Valid: false, Error: err.Error()}

		return nil
	}

	// Skip server validation if already validated within last 24h (at least once per day).
	if time.Since(license.LastCheck) < 24*time.Hour {
		lastValidationResult = &ValidateResponse{Valid: true, Message: "License valid"}
		return nil
	}

	go func() {
		s.Validate()
	}()

	lastValidationResult = &ValidateResponse{Valid: true, Message: "License valid"}
	return nil
}

func (s *LicenseService) GetStatus() map[string]interface{} {
	status := map[string]interface{}{
		"valid": false,
	}

	if license != nil {
		// Use cached validation result
		if lastValidationResult != nil {
			status["valid"] = lastValidationResult.Valid
			if lastValidationResult.Error != "" {
				status["error"] = lastValidationResult.Error
			}
		}

		status["license_key"] = MaskLicenseKey(license.Key)
		if !license.ExpiresAt.IsZero() {
			status["expires_at"] = license.ExpiresAt.Format(time.RFC3339)
		}

		if license.CustomerName != "" {
			status["customer_name"] = license.CustomerName
		}

		if license.CustomerEmail != "" {
			status["customer_email"] = license.CustomerEmail
		}
	}

	return status
}
