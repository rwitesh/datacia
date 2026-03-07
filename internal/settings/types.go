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

// KeyMask is returned to frontend when a key is stored (key never visible).
const KeyMask = "***"

type AIProviderConfig struct {
	Enabled bool     `json:"enabled"`
	Key     string   `json:"key"`
	Models  []string `json:"models"`
}

type AIConfig struct {
	Gemini AIProviderConfig `json:"gemini"`
}

type Settings struct {
	Theme  ThemeConfig  `json:"theme"`
	Editor EditorConfig `json:"editor"`
	Font   FontConfig   `json:"font"`
	AI     AIConfig     `json:"ai"`
}

// Info is the app/settings info returned to the frontend (OS, version, settings, defaults).
type Info struct {
	OS                      string      `json:"os"`
	OSVersion               string      `json:"os_version"`
	OSArch                  string      `json:"os_arch"`
	AppVersion              string      `json:"app_version"`
	MachineId               string      `json:"machineId"`
	Settings                Settings    `json:"settings"`
	Appearance              string      `json:"appearance"`
	ActiveTokenColors       TokenColors `json:"activeTokenColors"`
	DefaultTokenColorsLight TokenColors `json:"defaultTokenColorsLight"`
	DefaultTokenColorsDark  TokenColors `json:"defaultTokenColorsDark"`
	mu                      sync.RWMutex
}
