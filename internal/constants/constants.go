package constants

const (
	APP_TITLE                = "DataCia"
	APP_NAME                 = "DataCia"
	CONNECTION_WINDOW_WIDTH  = 720
	CONNECTION_WINDOW_HEIGHT = 600
	EDITOR_WINDOW_WIDTH      = 1024
	EDITOR_WINDOW_HEIGHT     = 768
	LICENSE_WINDOW_WIDTH     = 450
	LICENSE_WINDOW_HEIGHT    = 500
	SETTINGS_WINDOW_WIDTH    = 400
	SETTINGS_WINDOW_HEIGHT   = 768
	CONNECTION_WINDOW_NAME   = "datacia-connection"
	EDITOR_WINDOW_NAME       = "datacia-editor"
	LICENSE_WINDOW_NAME      = "datacia-license"
	SETTINGS_WINDOW_NAME     = "datacia-settings"
)

const (
	// AppSalt is a hardcoded salt used in PBKDF2 key derivation.
	// This should be a random 32-byte string
	AppSalt = "DataCiaAppSalt2026!SecureRandomBytes32"
)

const (
	LICENSE_SERVER_URL = "https://api.datacia.app"
)
