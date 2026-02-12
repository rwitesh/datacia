package license

import (
	"datacia/internal/security"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type LicenseService struct {
	app        *application.App
	mu         sync.RWMutex
	license    *License
	validation *Response
}

type Response struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

var instance *LicenseService

func NewLicenseService(app *application.App) *LicenseService {
	s := &LicenseService{app: app}

	loaded, err := loadLicense()
	if err != nil {
		s.validation = &Response{Success: false, Message: err.Error()}
	} else if loaded != nil {
		s.license = loaded
	}

	instance = s
	return s
}

func (s *LicenseService) Activate(licenseKey string) Response {
	hashedMachineID, err := security.GetMachineID()
	if err != nil {
		return Response{Success: false, Error: "Device identification failed"}
	}

	l, err := licenseActivate(licenseKey, hashedMachineID)
	if err != nil {
		return Response{Success: false, Error: err.Error()}
	}

	verifier := newVerifier()
	if err := verifier.verifyToken(l); err != nil {
		return Response{Success: false, Error: err.Error()}
	}

	if err := saveLicense(l); err != nil {
		return Response{Success: false, Error: "Failed to save license"}
	}

	s.mu.Lock()
	s.license = l
	s.validation = &Response{Success: true, Message: "License activated successfully"}
	result := *s.validation
	s.mu.Unlock()

	s.emitChanged()
	return result
}

func (s *LicenseService) Deactivate() Response {
	s.mu.RLock()
	if s.license == nil {
		s.mu.RUnlock()
		return Response{Success: false, Message: "No license found"}
	}
	token := s.license.Token
	s.mu.RUnlock()

	hashedMachineID, err := security.GetMachineID()
	if err != nil {
		return Response{Success: false, Error: "Failed to identify machine."}
	}

	if err := licenseDeactivate(token, hashedMachineID); err != nil {
		return Response{Success: false, Error: err.Error()}
	}

	_ = removeLicense()

	s.mu.Lock()
	s.license = nil
	s.validation = &Response{Success: true, Message: "License deactivated"}
	result := *s.validation
	s.mu.Unlock()

	s.emitChanged()
	return result
}

func (s *LicenseService) Validate() Response {
	s.mu.RLock()
	license := s.license
	s.mu.RUnlock()

	if license == nil {
		return s.setResult(Response{Success: false, Message: "No license found"})
	}

	hashedMachineID, err := security.GetMachineID()
	if err != nil {
		return s.setResult(Response{Success: false, Error: err.Error()})
	}

	var l *License
	var error error
	const maxRetries = 2

	for i := 0; i < maxRetries; i++ {
		l, error = licenseValidate(license.Token, hashedMachineID)
		if error == nil {
			// Validation successful, update local license
			if err := saveLicense(l); err != nil {
				return s.setResult(Response{Success: false, Error: err.Error()})
			}

			s.mu.Lock()
			s.license = l
			s.mu.Unlock()

			return s.setResult(Response{Success: true, Message: "License valid"})
		}

		// Only retry on NetworkError
		if _, isNetErr := error.(*NetworkError); !isNetErr {
			break
		}

		if i < maxRetries-1 {
			time.Sleep(2 * time.Second) // Reduced retry wait
		}
	}

	if error != nil {
		// If it's a network error, try offline validation (grace period)
		if _, isNetErr := error.(*NetworkError); isNetErr {
			verifier := newVerifier()
			if err := verifier.isLicenseValid(license); err == nil {
				// Valid offline
				return s.setResult(Response{Success: true, Message: "License valid (offline)"})
			}
			// If offline check fails (e.g. grace period over), we return that error
		}

		// Return the actual validation error
		return s.setResult(Response{Success: false, Error: error.Error()})
	}

	return s.setResult(Response{Success: true, Message: "License valid"})

}

func (s *LicenseService) ValidateOnStart() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.license == nil {
		s.validation = nil
		return nil
	}

	if err := newVerifier().isLicenseValid(s.license); err != nil {
		s.validation = &Response{Success: false, Error: err.Error()}
		return nil
	}

	s.validation = &Response{Success: true, Message: "License valid"}
	go s.Validate()

	return nil
}

func (s *LicenseService) GetStatus() map[string]interface{} {
	status := map[string]interface{}{"valid": false}

	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.license != nil {
		if s.validation != nil {
			status["valid"] = s.validation.Success
			if s.validation.Error != "" {
				status["error"] = s.validation.Error
			}
		}

		status["license_key"] = s.license.Key
		status["email"] = s.license.Email

		if !s.license.ExpiresAt.IsZero() {
			status["expires_at"] = s.license.ExpiresAt.Format(time.RFC3339)
		}
	}

	return status
}

func (s *LicenseService) setResult(r Response) Response {
	s.mu.Lock()
	s.validation = &r
	s.mu.Unlock()

	s.emitChanged()
	return r
}

func (s *LicenseService) emitChanged() {
	if s.app != nil {
		s.app.Event.Emit("license-changed", nil)
	}
}

func GetLicenseID() string {
	if instance == nil {
		return ""
	}

	instance.mu.RLock()
	defer instance.mu.RUnlock()

	if instance.license == nil {
		return ""
	}
	return instance.license.ID
}
