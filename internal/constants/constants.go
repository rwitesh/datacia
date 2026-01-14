package constants

const (
	APP_TITLE                = "DataCia"
	APP_NAME                 = "DataCia"
	CONNECTION_WINDOW_WIDTH  = 720
	CONNECTION_WINDOW_HEIGHT = 600
	EDITOR_WINDOW_WIDTH      = 1024
	EDITOR_WINDOW_HEIGHT     = 768
)

const (
	// AppSalt is a hardcoded salt used in PBKDF2 key derivation.
	// This should be a random 32-byte string
	AppSalt = "DataCiaAppSalt2026!SecureRandomBytes32"
)

const (
	LICENSE_SERVER_URL = "http://localhost:8787"
)
