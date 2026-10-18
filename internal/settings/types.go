package settings

import "sync"

type ThemeConfig string

const (
	ThemeSystem ThemeConfig = "system"
	ThemeLight  ThemeConfig = "light"
	ThemeDark   ThemeConfig = "dark"
)

type TokenColors struct {
	Keyword  string `json:"keyword"`
	String   string `json:"string"`
	Number   string `json:"number"`
	Comment  string `json:"comment"`
	Function string `json:"function"`
	Variable string `json:"variable"`
	Type     string `json:"type"`
	Operator string `json:"operator"`
}

// EditorConfig holds token colors per theme: editor.light and editor.dark in JSON.
type EditorConfig struct {
	Light TokenColors `json:"light"`
	Dark  TokenColors `json:"dark"`
}

type FontConfig struct {
	UIFontFamily     string `json:"uiFontFamily"`
	UIFontSize       int    `json:"uiFontSize"`
	EditorFontFamily string `json:"editorFontFamily"`
	EditorFontSize   int    `json:"editorFontSize"`
}

type AIProviderConfig struct {
	BaseURL string `json:"baseUrl"` // empty: the provider's default
}

type AIConfig struct {
	Providers map[string]AIProviderConfig `json:"providers"` // keyed by provider ID
	// The chat's model: chosen in the chat, never sent with the settings or
	// changed by saving them.
	DefaultProvider string `json:"defaultProvider,omitempty"`
	DefaultModel    string `json:"defaultModel,omitempty"`
	// Keys are encrypted and never sent to the frontend.
	Keys map[string]string `json:"keys,omitempty"`
}

// PrivacyConfig is stored as an opt-out so settings saved before it existed
// keep error reports on.
type PrivacyConfig struct {
	DisableErrorReports bool `json:"disableErrorReports"`
}

type Settings struct {
	Theme   ThemeConfig   `json:"theme"`
	Editor  EditorConfig  `json:"editor"`
	Font    FontConfig    `json:"font"`
	AI      AIConfig      `json:"ai"`
	Privacy PrivacyConfig `json:"privacy"`
}

// Info is the app/settings info returned to the frontend: OS, version, the
// current settings and the defaults the settings window resets to.
type Info struct {
	OS         string   `json:"os"`
	OSVersion  string   `json:"os_version"`
	OSArch     string   `json:"os_arch"`
	AppVersion string   `json:"app_version"`
	Settings   Settings `json:"settings"`
	Defaults   Settings `json:"defaults"`
	mu         sync.RWMutex
}
