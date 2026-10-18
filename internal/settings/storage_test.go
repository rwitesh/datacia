package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"datacia/internal/paths"

	"github.com/adrg/xdg"
)

// useTempConfig points settings.json at a temporary directory and returns its path.
func useTempConfig(t *testing.T) string {
	t.Cleanup(xdg.Reload) // runs after Setenv restores the environment
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	xdg.Reload()
	dir, err := paths.GetConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	configDir = dir
	globalInfo = &Info{Settings: defaultSettings()}
	t.Cleanup(func() { configDir, globalInfo, errNotLoaded = "", nil, nil })
	path, err := paths.GetSettingsPath()
	if err != nil {
		t.Fatal(err)
	}
	return path
}

func TestLoadSettings(t *testing.T) {
	withLight := func(change func(*Settings)) Settings {
		s := defaultSettings()
		change(&s)
		return s
	}
	tests := []struct {
		name   string
		file   *string // nil: no file
		want   Settings
		backup bool
	}{
		{name: "first run", want: defaultSettings()},
		{name: "empty file", file: ptr(""), want: defaultSettings(), backup: true},
		{name: "malformed", file: ptr("{"), want: defaultSettings(), backup: true},
		{name: "wrong type", file: ptr(`{"font":{"uiFontSize":"14"}}`), want: defaultSettings(), backup: true},
		{name: "null", file: ptr("null"), want: defaultSettings()},
		{
			name: "partial",
			file: ptr(`{"theme":"dark","privacy":{"disableErrorReports":true}}`),
			want: withLight(func(s *Settings) { s.Theme = ThemeDark; s.Privacy.DisableErrorReports = true }),
		},
		{
			name: "unusable values",
			file: ptr(`{"theme":"blue","font":{"uiFontFamily":"","uiFontSize":0,"editorFontFamily":"Fira Code","editorFontSize":500},
				"editor":{"light":{"keyword":"#111111"},"dark":null},"ai":{"providers":{"ollama":{"baseUrl":""}}}}`),
			want: withLight(func(s *Settings) {
				s.Font.EditorFontFamily = "Fira Code"
				s.Editor.Light.Keyword = "#111111"
			}),
		},
		{
			name: "valid values kept",
			file: ptr(`{"theme":"light","font":{"uiFontFamily":"Inter","uiFontSize":18,"editorFontFamily":"monospace","editorFontSize":8},
				"ai":{"providers":{"ollama":{"baseUrl":"http://box"}},"defaultModel":"m","keys":{"openai":"enc"}}}`),
			want: withLight(func(s *Settings) {
				s.Theme = ThemeLight
				s.Font = FontConfig{UIFontFamily: "Inter", UIFontSize: 18, EditorFontFamily: "monospace", EditorFontSize: 8}
				s.AI = AIConfig{
					Providers:    map[string]AIProviderConfig{"ollama": {BaseURL: "http://box"}},
					DefaultModel: "m",
					Keys:         map[string]string{"openai": "enc"},
				}
			}),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := useTempConfig(t)
			if tt.file != nil {
				if err := os.WriteFile(path, []byte(*tt.file), 0600); err != nil {
					t.Fatal(err)
				}
			}
			loadSettings()

			if got := GetSettingsRaw(); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("loaded %+v, want %+v", got, tt.want)
			}
			backup, err := os.ReadFile(path + ".bak")
			if tt.backup && (err != nil || string(backup) != *tt.file) {
				t.Fatalf("corrupt file not backed up: %q, %v", backup, err)
			}
			if !tt.backup && err == nil {
				t.Fatal("unexpected backup")
			}
			if got := readSettingsFile(t, path); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("saved %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestSaveSettingsPermissions(t *testing.T) {
	path := useTempConfig(t)
	loadSettings()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0600 {
		t.Fatalf("settings file mode %o, want 600", perm)
	}
	if _, err := os.Stat(path + ".tmp"); !os.IsNotExist(err) {
		t.Fatal("temporary file left behind")
	}
}

// A failed save must leave the current settings, the file and other windows unchanged.
func TestUpdateSettingsSaveFailure(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("root ignores directory permissions")
	}
	path := useTempConfig(t)
	loadSettings()
	dir := filepath.Dir(path)
	if err := os.Chmod(dir, 0500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0700) })

	next := defaultSettings()
	next.Theme = ThemeDark
	if _, err := (&Service{}).UpdateSettings(next, map[string]string{"openai": "sk-1"}); err == nil {
		t.Fatal("save into a read-only directory succeeded")
	}
	if s := GetSettingsRaw(); s.Theme != ThemeSystem || len(s.AI.Keys) != 0 {
		t.Fatalf("failed save changed the current settings: %+v", s)
	}
	if got := readSettingsFile(t, path); got.Theme != ThemeSystem {
		t.Fatal("failed save changed the file")
	}
}

// An unreadable settings.json must not be replaced by the defaults the
// session falls back to, or the user loses their saved API keys.
func TestUnreadableSettingsAreNotOverwritten(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("root ignores file permissions")
	}
	path := useTempConfig(t)
	const saved = `{"theme":"dark","ai":{"keys":{"openai":"enc"}}}`
	if err := os.WriteFile(path, []byte(saved), 0000); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(path, 0600) })
	loadSettings()

	if err := SetAIModel("openai", "gpt-x"); err == nil {
		t.Fatal("saved over an unreadable settings file")
	}
	if err := os.Chmod(path, 0600); err != nil {
		t.Fatal(err)
	}
	if data, _ := os.ReadFile(path); string(data) != saved {
		t.Fatalf("settings file changed: %s", data)
	}
}

func readSettingsFile(t *testing.T, path string) Settings {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var s Settings
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatal(err)
	}
	return s
}

func ptr(s string) *string { return &s }
