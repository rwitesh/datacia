package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"datacia/internal/logger"
	"datacia/internal/security"
	"datacia/internal/settings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/zendev-sh/goai"
	"github.com/zendev-sh/goai/provider"
)

const (
	DeltaEvent    = "ai:delta"
	chatTimeout   = 5 * time.Minute
	signInTimeout = 5 * time.Minute
)

// ChatDelta is a piece of a streamed reply, tagged with the ChatRequest ID.
type ChatDelta struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

func init() {
	application.RegisterEvent[ChatDelta](DeltaEvent)
}

type Message struct {
	Role    string `json:"role"` // "user" or "assistant"
	Content string `json:"content"`
}

type ChatRequest struct {
	ID       string      `json:"id"`
	Provider string      `json:"provider"`
	Model    string      `json:"model"`
	Messages []Message   `json:"messages"`
	Context  ChatContext `json:"context"`
}

type ProviderStatus struct {
	Provider Provider `json:"provider"`
	BaseURL  string   `json:"baseUrl"`
	Models   []string `json:"models"`
	HasKey   bool     `json:"hasKey"`
	KeyError string   `json:"keyError"`
	Ready    bool     `json:"ready"`
}

type Service struct {
	app   *application.App
	store chatStore
}

func NewService(app *application.App) *Service {
	clearProviderEnv()
	return &Service{app: app}
}

// Providers returns every provider with the user's configuration.
func (s *Service) Providers() []ProviderStatus {
	cfgs := settings.GetSettingsRaw().AI.Providers
	out := make([]ProviderStatus, 0, len(providers))
	for _, p := range providers {
		cfg := cfgs[p.ID]
		st := ProviderStatus{Provider: p, BaseURL: baseURL(p, cfg.BaseURL), Models: cfg.Models}
		if st.Models == nil {
			st.Models = []string{}
		}
		key, err := savedKey(p)
		if err != nil {
			st.KeyError = err.Error()
		}
		st.HasKey = key != ""
		st.Ready = len(st.Models) > 0 && (st.HasKey || p.KeyOptional)
		out = append(out, st)
	}
	return out
}

func (s *Service) SetAPIKey(providerID, key string) error {
	if _, err := findProvider(providerID); err != nil {
		return err
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return errors.New("enter an API key")
	}
	enc, err := security.EncryptString(key)
	if err != nil {
		logger.Error("Failed to encrypt API key", "provider", providerID, "error", err.Error())
		return errors.New("couldn't store the key securely")
	}
	return settings.SetAIKey(providerID, enc)
}

func (s *Service) RemoveAPIKey(providerID string) error {
	if _, err := findProvider(providerID); err != nil {
		return err
	}
	return settings.SetAIKey(providerID, "")
}

// SignIn signs in through the browser and stores the resulting API key.
func (s *Service) SignIn(ctx context.Context, providerID string) error {
	p, err := findProvider(providerID)
	if err != nil {
		return err
	}
	if p.signIn == nil {
		return fmt.Errorf("%s doesn't support signing in", p.Name)
	}
	ctx, cancel := context.WithTimeout(ctx, signInTimeout)
	defer cancel()
	key, err := p.signIn(ctx, p.DefaultBaseURL, s.app.Browser.OpenURL)
	if errors.Is(err, context.DeadlineExceeded) {
		return errors.New("sign-in timed out. Try again")
	}
	if err != nil {
		return err
	}
	return s.SetAPIKey(p.ID, key)
}

// ListModels returns the provider's chat models for this key, newest first,
// which also checks the key. An empty url means the saved one.
func (s *Service) ListModels(ctx context.Context, providerID, url string) ([]Model, error) {
	p, err := findProvider(providerID)
	if err != nil {
		return nil, err
	}
	key, err := apiKey(p)
	if err != nil {
		return nil, err
	}
	if url == "" {
		url = settings.GetSettingsRaw().AI.Providers[p.ID].BaseURL
	}
	models, err := p.list(ctx, key, baseURL(p, url))
	if err != nil {
		return nil, userError(p, err)
	}
	return sortModels(models), nil
}

// Chat streams the reply as DeltaEvent events and returns the full text.
// Cancelling the call from the frontend stops the request.
func (s *Service) Chat(ctx context.Context, req ChatRequest) (string, error) {
	history := normalizeHistory(req.Messages)
	if len(history) == 0 || history[len(history)-1].Role != "user" {
		return "", errors.New("nothing to send")
	}
	p, err := findProvider(req.Provider)
	if err != nil {
		return "", err
	}
	m, err := chatModel(p, req.Model)
	if err != nil {
		return "", err
	}
	logger.Info("ai_chat", "provider", p.ID, "model", req.Model, "engine", req.Context.Engine)

	ctx, cancel := context.WithTimeout(ctx, chatTimeout)
	defer cancel()
	reply, err := streamReply(ctx, m, systemPrompt(req.Context), history, func(text string) {
		s.app.Event.Emit(DeltaEvent, ChatDelta{ID: req.ID, Text: text})
	}, p.options...)
	if err != nil {
		return reply, logChatError(p, req.Model, err)
	}
	if strings.TrimSpace(reply) == "" {
		return "", fmt.Errorf("%s returned an empty reply. Try again or pick another model", p.Name)
	}
	return reply, nil
}

func streamReply(ctx context.Context, m provider.LanguageModel, system string, history []Message, onText func(string), opts ...goai.Option) (string, error) {
	msgs := make([]provider.Message, len(history))
	for i, h := range history {
		if h.Role == "user" {
			msgs[i] = goai.UserMessage(h.Content)
		} else {
			msgs[i] = goai.AssistantMessage(h.Content)
		}
	}
	opts = append([]goai.Option{goai.WithSystem(system), goai.WithMessages(msgs...)}, opts...)
	stream, err := goai.StreamText(ctx, m, opts...)
	if err != nil {
		return "", err
	}
	var reply strings.Builder
	for text := range stream.TextStream() {
		reply.WriteString(text)
		onText(text)
	}
	if err := stream.Err(); err != nil {
		return reply.String(), err
	}
	// A cancelled stream ends without an error.
	return reply.String(), ctx.Err()
}

func (s *Service) LoadChat() (Chat, error) {
	return s.store.load()
}

func (s *Service) SaveChat(chat Chat) error {
	return s.store.save(chat)
}

func chatModel(p Provider, model string) (provider.LanguageModel, error) {
	model = strings.TrimSpace(model)
	if model == "" {
		return nil, errors.New("choose a model")
	}
	key, err := apiKey(p)
	if err != nil {
		return nil, err
	}
	url := settings.GetSettingsRaw().AI.Providers[p.ID].BaseURL
	return p.chat(model, key, baseURL(p, url)), nil
}

// apiKey returns the provider's key, or an error if it's required and missing.
func apiKey(p Provider) (string, error) {
	key, err := savedKey(p)
	if err == nil && key == "" && !p.KeyOptional {
		err = fmt.Errorf("add your %s API key in Settings → AI", p.Name)
	}
	return key, err
}

func savedKey(p Provider) (string, error) {
	enc := settings.AIKey(p.ID)
	if enc == "" {
		return "", nil
	}
	key, err := security.DecryptString(enc)
	if err != nil {
		return "", fmt.Errorf("the saved %s key can't be read on this computer. Enter it again", p.Name)
	}
	return key, nil
}

func baseURL(p Provider, url string) string {
	if url = strings.TrimRight(strings.TrimSpace(url), "/"); p.CustomURL && url != "" {
		return url
	}
	return p.DefaultBaseURL
}
