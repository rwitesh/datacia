package license

import (
	"bytes"
	"datacia/internal/constants"
	"datacia/internal/logger"
	"datacia/internal/security"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/adrg/xdg"
	"github.com/wailsapp/wails/v3/pkg/application"
	"go.uber.org/zap"
)

// LicenseService provides license management functionality for the UI
type LicenseService struct {
	app *application.App
}

// cached validation status for use in GetStatus
var (
	lastValidationResult ValidateResponse
	hasValidationResult  bool
)

// NewLicenseService creates a new license service instance
func NewLicenseService(app *application.App) *LicenseService {
	return &LicenseService{app: app}
}

// ActivateResponse represents the response from license activation
type ActivateResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

// Activate activates a license key and stores it locally
func (s *LicenseService) Activate(licenseKey string) ActivateResponse {
	logger.Logger.Info("Activating license", zap.String("key", licenseKey[:min(8, len(licenseKey))]+"..."))

	hashedMachineID, err := security.GetHashedMachineID()
	if err != nil {
		logger.Logger.Error("Failed to get machine ID", zap.Error(err))
		return ActivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}

	reqBody, err := json.Marshal(map[string]string{
		"key":      licenseKey,
		"instance": hashedMachineID,
	})
	if err != nil {
		logger.Logger.Error("Failed to marshal request", zap.Error(err))
		return ActivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}

	req, err := http.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s?action=activate", constants.LICENSE_SERVER_URL),
		bytes.NewReader(reqBody),
	)
	if err != nil {
		logger.Logger.Error("Failed to create request", zap.Error(err))
		return ActivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logger.Logger.Error("Failed to send request", zap.Error(err))
		return ActivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errorResp struct {
			Error string `json:"error"`
		}
		serverError := fmt.Sprintf("HTTP %d: %s", resp.StatusCode, resp.Status)
		if err := json.NewDecoder(resp.Body).Decode(&errorResp); err == nil && errorResp.Error != "" {
			serverError = errorResp.Error
		}
		logger.Logger.Error("License activation failed", zap.String("error", serverError))
		return ActivateResponse{
			Success: false,
			Error:   serverError,
		}
	}

	var response struct {
		ID            string `json:"id"`
		CreatedAt     string `json:"created_at"`
		ExpiresAt     string `json:"expires_at"`
		CustomerName  string `json:"customer_name"`
		CustomerEmail string `json:"customer_email"`
		VariantName   string `json:"variant_name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		logger.Logger.Error("Failed to decode response", zap.Error(err))
		return ActivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}

	encryptedID, err := security.EncryptString(response.ID)
	if err != nil {
		logger.Logger.Error("Failed to encrypt instance ID", zap.Error(err))
		return ActivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}

	encryptedLicenseKey, err := security.EncryptString(licenseKey)
	if err != nil {
		logger.Logger.Error("Failed to encrypt license key", zap.Error(err))
		return ActivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}

	// Parse timestamps
	var createdAt, expiresAt time.Time
	if response.CreatedAt != "" {
		createdAt, _ = time.Parse(time.RFC3339, response.CreatedAt)
	}
	if response.ExpiresAt != "" {
		expiresAt, _ = time.Parse(time.RFC3339, response.ExpiresAt)
	}

	lic := &License{
		ID:            encryptedID,
		Key:           encryptedLicenseKey,
		MachineId:     hashedMachineID,
		CreatedAt:     createdAt,
		ExpiresAt:     expiresAt,
		CustomerName:  response.CustomerName,
		CustomerEmail: response.CustomerEmail,
		VariantName:   response.VariantName,
	}

	if err := SaveLicense(lic); err != nil {
		logger.Logger.Error("Failed to save license", zap.Error(err))
		return ActivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}

	license = lic

	logger.Logger.Info("License activated successfully")
	return ActivateResponse{
		Success: true,
		Message: "License activated successfully",
	}
}

// DeactivateResponse represents the response from license deactivation
type DeactivateResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

// Deactivate deactivates the current license
func (s *LicenseService) Deactivate() DeactivateResponse {
	logger.Logger.Info("Deactivating license")

	if license == nil {
		logger.Logger.Warn("No license found to deactivate")
		return DeactivateResponse{
			Success: false,
			Error:   "No license found",
		}
	}

	key, err := security.DecryptString(license.Key)
	if err != nil {
		logger.Logger.Error("Failed to decrypt license key", zap.Error(err))
		return DeactivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}

	instance, err := security.DecryptString(license.ID)
	if err != nil {
		logger.Logger.Error("Failed to decrypt license instance", zap.Error(err))
		return DeactivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}

	reqBody := map[string]string{
		"key":      key,
		"instance": instance,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		logger.Logger.Error("Failed to marshal request", zap.Error(err))
		return DeactivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}

	req, err := http.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s?action=deactivate", constants.LICENSE_SERVER_URL),
		bytes.NewReader(jsonBody),
	)
	if err != nil {
		logger.Logger.Error("Failed to create request", zap.Error(err))
		return DeactivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logger.Logger.Error("Failed to send request", zap.Error(err))
		return DeactivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errorResp struct {
			Error string `json:"error"`
		}
		serverError := fmt.Sprintf("HTTP %d: %s", resp.StatusCode, resp.Status)
		if err := json.NewDecoder(resp.Body).Decode(&errorResp); err == nil && errorResp.Error != "" {
			serverError = errorResp.Error
		}
		logger.Logger.Error("License deactivation failed", zap.String("error", serverError))
		return DeactivateResponse{
			Success: false,
			Error:   serverError,
		}
	}

	license = nil

	licensePath, err := xdg.DataFile(filepath.Join(constants.APP_NAME, "license.bin"))
	if err != nil {
		logger.Logger.Error("Failed to resolve license path", zap.Error(err))
		return DeactivateResponse{
			Success: false,
			Error:   err.Error(),
		}
	}

	if err := os.Remove(licensePath); err != nil {
		if !os.IsNotExist(err) {
			logger.Logger.Error("Failed to delete license file", zap.Error(err))
			return DeactivateResponse{
				Success: false,
				Error:   err.Error(),
			}
		}
		// File doesn't exist, which is fine
	}

	logger.Logger.Info("License deactivated successfully")
	return DeactivateResponse{
		Success: true,
		Message: "License deactivated successfully",
	}
}

// ValidateResponse represents the response from license validation
type ValidateResponse struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

// Validate validates the current license with the server
func (s *LicenseService) Validate() ValidateResponse {
	logger.Logger.Info("Validating license")

	if license == nil {
		logger.Logger.Warn("No license found")
		return ValidateResponse{
			Valid:   false,
			Message: "No license found",
		}
	}

	hashedMachineID, err := security.GetHashedMachineID()
	if err != nil {
		logger.Logger.Error("Failed to get machine ID", zap.Error(err))
		return ValidateResponse{
			Valid: false,
			Error: err.Error(),
		}
	}

	if license.MachineId != hashedMachineID {
		logger.Logger.Warn("Machine ID mismatch")
		return ValidateResponse{
			Valid:   false,
			Message: "License not valid for this machine",
		}
	}

	if license.Key == "" || license.ID == "" {
		logger.Logger.Warn("License missing required fields")
		return ValidateResponse{
			Valid:   false,
			Message: "License is incomplete",
		}
	}

	key, err := security.DecryptString(license.Key)
	if err != nil {
		logger.Logger.Error("Failed to decrypt license key", zap.Error(err))
		return ValidateResponse{
			Valid: false,
			Error: err.Error(),
		}
	}

	instance, err := security.DecryptString(license.ID)
	if err != nil {
		logger.Logger.Error("Failed to decrypt license instance", zap.Error(err))
		return ValidateResponse{
			Valid: false,
			Error: err.Error(),
		}
	}

	reqBody := map[string]string{
		"key":      key,
		"instance": instance,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		logger.Logger.Error("Failed to marshal request", zap.Error(err))
		return ValidateResponse{
			Valid: false,
			Error: err.Error(),
		}
	}

	req, err := http.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s?action=validate", constants.LICENSE_SERVER_URL),
		bytes.NewReader(jsonBody),
	)
	if err != nil {
		logger.Logger.Error("Failed to create request", zap.Error(err))
		return ValidateResponse{
			Valid: false,
			Error: err.Error(),
		}
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logger.Logger.Error("Failed to send request", zap.Error(err))
		return ValidateResponse{
			Valid: false,
			Error: err.Error(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errorResp struct {
			Error string `json:"error"`
		}
		serverError := fmt.Sprintf("HTTP %d: %s", resp.StatusCode, resp.Status)
		if err := json.NewDecoder(resp.Body).Decode(&errorResp); err == nil && errorResp.Error != "" {
			serverError = errorResp.Error
		}
		logger.Logger.Error("License validation failed", zap.String("error", serverError))
		return ValidateResponse{
			Valid: false,
			Error: serverError,
		}
	}

	var result struct {
		Valid bool `json:"valid"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		logger.Logger.Error("Failed to decode response", zap.Error(err))
		return ValidateResponse{
			Valid: false,
			Error: err.Error(),
		}
	}

	if !result.Valid {
		logger.Logger.Warn("License validation returned invalid")
		return ValidateResponse{
			Valid:   false,
			Message: "License is not valid",
		}
	}

	logger.Logger.Info("License validated successfully")
	return ValidateResponse{
		Valid:   true,
		Message: "License is valid",
	}
}

// ValidateOnStart validates the license on app startup (non-blocking).
// It uses the same Validate API but runs in the background and caches the result.
func (s *LicenseService) ValidateOnStart() error {
	if license == nil {
		// No license to validate
		hasValidationResult = false
		return nil
	}

	// Validate in background - don't block app startup
	go func() {
		result := s.Validate()
		lastValidationResult = result
		hasValidationResult = true

		if !result.Valid {
			logger.Logger.Warn(
				"License validation failed on startup",
				zap.String("error", result.Error),
				zap.String("message", result.Message),
			)
		} else {
			logger.Logger.Info("License validated successfully on startup")
		}
	}()

	return nil
}

// maskLicenseKey masks a license key showing only first 4 and last 4 characters.
func maskLicenseKey(key string) string {
	if len(key) <= 8 {
		return "xxxx-xxxx"
	}

	first := key[:4]
	last := key[len(key)-4:]
	return fmt.Sprintf("%s-xxxx-xxxx-%s", first, last)
}

// GetStatus returns the current license status with only essential information:
// expires_at, license_key (masked), and valid (true/false).
func (s *LicenseService) GetStatus() map[string]interface{} {
	status := map[string]interface{}{
		"valid": false,
	}

	// If no license exists, return valid: false
	if license == nil {
		return status
	}

	// Check if license key exists and can be decrypted
	if license.Key == "" {
		return status
	}

	key, err := security.DecryptString(license.Key)
	if err != nil || key == "" {
		return status
	}
	status["license_key"] = maskLicenseKey(key)

	// Check machine ID match
	hashedMachineID, err := security.GetHashedMachineID()
	if err != nil || license.MachineId != hashedMachineID {
		return status
	}

	// Use cached validation result if available, otherwise valid remains false
	if hasValidationResult {
		status["valid"] = lastValidationResult.Valid
	}

	// Add expiry date if available
	if !license.ExpiresAt.IsZero() {
		status["expires_at"] = license.ExpiresAt.Format(time.RFC3339)
	}

	// Add customer information if available
	if license.CustomerName != "" {
		status["customer_name"] = license.CustomerName
	}
	if license.CustomerEmail != "" {
		status["customer_email"] = license.CustomerEmail
	}
	if license.VariantName != "" {
		status["variant_name"] = license.VariantName
	}

	return status
}
