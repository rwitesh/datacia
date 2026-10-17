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

func fillAIDefaults(s *Settings) {
	if s.AI.Providers == nil {
		s.AI.Providers = map[string]AIProviderConfig{}
	}
	maps.DeleteFunc(s.AI.Providers, func(_ string, p AIProviderConfig) bool {
		return len(p.Models) == 0 && p.BaseURL == ""
	})
	for id, p := range s.AI.Providers {
		if p.Models == nil {
			p.Models = []string{}
			s.AI.Providers[id] = p
		}
	}
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
