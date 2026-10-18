package settings

import "maps"

func defaultTokenColorsLight() TokenColors {
	return TokenColors{
		Keyword:  "#d73a49",
		String:   "#032f62",
		Number:   "#005cc5",
		Comment:  "#6a737d",
		Function: "#6f42c1",
		Variable: "#24292e",
		Type:     "#e36209",
		Operator: "#24292e",
	}
}

func defaultTokenColorsDark() TokenColors {
	return TokenColors{
		Keyword:  "#ff7b72",
		String:   "#a5d6ff",
		Number:   "#79c0ff",
		Comment:  "#8b949e",
		Function: "#d2a8ff",
		Variable: "#c9d1d9",
		Type:     "#ffa657",
		Operator: "#c9d1d9",
	}
}

func defaultSettings() Settings {
	return Settings{
		Theme: ThemeSystem,
		Editor: EditorConfig{
			Light: defaultTokenColorsLight(),
			Dark:  defaultTokenColorsDark(),
		},
		Font: FontConfig{
			UIFontFamily:     "JetBrains Mono",
			UIFontSize:       12,
			EditorFontFamily: "JetBrains Mono",
			EditorFontSize:   12,
		},
		AI: AIConfig{Providers: map[string]AIProviderConfig{}},
	}
}

// Font sizes outside this range make the app unreadable; the UI offers 12-18.
const (
	minFontSize = 8
	maxFontSize = 32
)

// fillDefaults replaces missing or unusable values, from an older, partial or
// hand-edited file, with defaults. Zero values that are valid choices (privacy
// opt-out false, no default model) are kept.
func fillDefaults(s *Settings) {
	def := defaultSettings()
	switch s.Theme {
	case ThemeSystem, ThemeLight, ThemeDark:
	default:
		s.Theme = def.Theme
	}
	if s.Font.UIFontFamily == "" {
		s.Font.UIFontFamily = def.Font.UIFontFamily
	}
	if s.Font.EditorFontFamily == "" {
		s.Font.EditorFontFamily = def.Font.EditorFontFamily
	}
	if s.Font.UIFontSize < minFontSize || s.Font.UIFontSize > maxFontSize {
		s.Font.UIFontSize = def.Font.UIFontSize
	}
	if s.Font.EditorFontSize < minFontSize || s.Font.EditorFontSize > maxFontSize {
		s.Font.EditorFontSize = def.Font.EditorFontSize
	}
	s.Editor.Light = fillTokenColorsDefaults(s.Editor.Light, def.Editor.Light)
	s.Editor.Dark = fillTokenColorsDefaults(s.Editor.Dark, def.Editor.Dark)
	if s.AI.Providers == nil {
		s.AI.Providers = map[string]AIProviderConfig{}
	}
	maps.DeleteFunc(s.AI.Providers, func(_ string, p AIProviderConfig) bool {
		return p.BaseURL == ""
	})
}

// fillTokenColorsDefaults replaces empty string fields in dst with values from def.
func fillTokenColorsDefaults(dst, def TokenColors) TokenColors {
	out := dst
	if out.Keyword == "" {
		out.Keyword = def.Keyword
	}
	if out.String == "" {
		out.String = def.String
	}
	if out.Number == "" {
		out.Number = def.Number
	}
	if out.Comment == "" {
		out.Comment = def.Comment
	}
	if out.Function == "" {
		out.Function = def.Function
	}
	if out.Variable == "" {
		out.Variable = def.Variable
	}
	if out.Type == "" {
		out.Type = def.Type
	}
	if out.Operator == "" {
		out.Operator = def.Operator
	}
	return out
}
