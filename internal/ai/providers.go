package ai

import (
	"context"
	"fmt"
	"os"

	"github.com/zendev-sh/goai"
	"github.com/zendev-sh/goai/provider"
	"github.com/zendev-sh/goai/provider/anthropic"
	"github.com/zendev-sh/goai/provider/compat"
	"github.com/zendev-sh/goai/provider/google"
	"github.com/zendev-sh/goai/provider/openai"
	"github.com/zendev-sh/goai/provider/openrouter"
)

type Provider struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	DefaultBaseURL string `json:"defaultBaseUrl"`
	CustomURL      bool   `json:"customUrl"`
	KeyURL         string `json:"keyUrl"`
	KeyOptional    bool   `json:"keyOptional"`
	SignIn         bool   `json:"signIn"`

	chat    chatFunc
	list    modelLister
	signIn  signInFunc
	options []goai.Option
}

type (
	chatFunc   func(model, key, baseURL string) provider.LanguageModel
	signInFunc func(ctx context.Context, baseURL string, open func(url string) error) (string, error)
)

// GoAI reads these as fallbacks; settings must be the only source.
var providerEnv = []string{
	"ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL",
	"OPENAI_API_KEY", "OPENAI_BASE_URL",
	"OPENROUTER_API_KEY", "OPENROUTER_BASE_URL",
	"GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_BASE_URL",
}

func clearProviderEnv() {
	for _, v := range providerEnv {
		os.Unsetenv(v)
	}
}

var providers = []Provider{
	{
		ID:             "anthropic",
		Name:           "Anthropic",
		DefaultBaseURL: "https://api.anthropic.com",
		KeyURL:         "https://platform.claude.com/settings/keys",
		chat: func(model, key, baseURL string) provider.LanguageModel {
			return anthropic.Chat(model, anthropic.WithAPIKey(key), anthropic.WithBaseURL(baseURL))
		},
		list: listAnthropic,
		// Marks the system prompt (and the tools before it) for caching. The
		// other providers cache automatically and warn on this option.
		options: []goai.Option{goai.WithPromptCaching(true)},
	},
	{
		ID:             "openai",
		Name:           "OpenAI",
		DefaultBaseURL: "https://api.openai.com/v1",
		KeyURL:         "https://platform.openai.com/api-keys",
		chat: func(model, key, baseURL string) provider.LanguageModel {
			return openai.Chat(model, openai.WithAPIKey(key), openai.WithBaseURL(baseURL))
		},
		list: listCompat("", isOpenAIChat),
		// Don't keep conversations on OpenAI's servers.
		options: []goai.Option{goai.WithProviderOptions(map[string]any{"store": false})},
	},
	{
		ID:             "gemini",
		Name:           "Gemini",
		DefaultBaseURL: "https://generativelanguage.googleapis.com",
		KeyURL:         "https://aistudio.google.com/apikey",
		chat: func(model, key, baseURL string) provider.LanguageModel {
			return google.Chat(model, google.WithAPIKey(key), google.WithBaseURL(baseURL))
		},
		list: listGemini,
	},
	{
		ID:             "openrouter",
		Name:           "OpenRouter",
		DefaultBaseURL: "https://openrouter.ai/api/v1",
		KeyURL:         "https://openrouter.ai/settings/keys",
		chat: func(model, key, baseURL string) provider.LanguageModel {
			return openrouter.Chat(model, openrouter.WithAPIKey(key), openrouter.WithBaseURL(baseURL),
				openrouter.WithHeaders(map[string]string{"HTTP-Referer": "https://github.com/rwitesh/datacia", "X-Title": "DataCia"}))
		},
		list:   listOpenRouter,
		signIn: openRouterSignIn,
	},
	{
		ID:             "opencode",
		Name:           "OpenCode",
		DefaultBaseURL: "https://opencode.ai/inference/openai/v1",
		KeyURL:         "https://opencode.ai/console",
		chat:           compatChat("opencode"),
		list:           listCompat("https://opencode.ai/inference/v1/models", isOpenCodeChat),
	},
	{
		ID:             "local",
		Name:           "Local",
		DefaultBaseURL: "http://localhost:11434/v1",
		CustomURL:      true,
		KeyOptional:    true,
		chat:           compatChat("local"),
		list:           listCompat("", nil),
	},
}

func init() {
	for i := range providers {
		providers[i].SignIn = providers[i].signIn != nil
	}
}

func compatChat(id string) chatFunc {
	return func(model, key, baseURL string) provider.LanguageModel {
		opts := []compat.Option{compat.WithProviderID(id), compat.WithBaseURL(baseURL)}
		if key != "" {
			opts = append(opts, compat.WithAPIKey(key))
		}
		return compat.Chat(model, opts...)
	}
}

func findProvider(id string) (Provider, error) {
	for _, p := range providers {
		if p.ID == id {
			return p, nil
		}
	}
	return Provider{}, fmt.Errorf("unknown provider %q", id)
}
