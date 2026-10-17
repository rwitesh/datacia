package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"datacia/internal/logger"
	"datacia/internal/settings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/zendev-sh/goai"
	"github.com/zendev-sh/goai/provider"
)

const (
	DeltaEvent    = "ai:delta"
	ToolEvent     = "ai:tool"
	chatTimeout   = 5 * time.Minute
	signInTimeout = 5 * time.Minute
)

// ChatDelta is a piece of a streamed reply, tagged with the ChatRequest ID.
type ChatDelta struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

// ChatTool reports a tool call made while answering the ChatRequest ID.
type ChatTool struct {
	ID   string  `json:"id"`
	Tool ToolUse `json:"tool"`
}

func init() {
	application.RegisterEvent[ChatDelta](DeltaEvent)
	application.RegisterEvent[ChatTool](ToolEvent)
}

type Message struct {
	Role    string `json:"role"` // "user" or "assistant"
	Content string `json:"content"`
}

// ChatRequest is sent to the default model.
type ChatRequest struct {
	ID       string      `json:"id"`
	Messages []Message   `json:"messages"`
	Context  ChatContext `json:"context"`
}

// ModelRef names a provider's model.
type ModelRef struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

type ProviderStatus struct {
	Provider Provider `json:"provider"`
	HasKey   bool     `json:"hasKey"`
	KeyError string   `json:"keyError"`
	Ready    bool     `json:"ready"` // its models can be listed and used
}

type Service struct {
	app    *application.App
	db     Database
	store  chatStore
	models modelCache
}

func NewService(app *application.App, db Database) *Service {
	clearProviderEnv()
	return &Service{app: app, db: db}
}

// Providers returns every provider with the user's configuration.
func (s *Service) Providers() []ProviderStatus {
	out := make([]ProviderStatus, 0, len(providers))
	for _, p := range providers {
		st := ProviderStatus{Provider: p}
		key, err := savedKey(p)
		if err != nil {
			st.KeyError = err.Error()
		}
		st.HasKey = key != ""
		st.Ready = isReady(p, st.HasKey)
		out = append(out, st)
	}
	return out
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
		return errors.New("Sign-in timed out.")
	}
	if err != nil {
		return err
	}
	return settings.SetAIKey(p.ID, key)
}

// ListModels returns the provider's chat models, newest first. Lists are
// cached for an hour, or until the key or server URL changes.
func (s *Service) ListModels(ctx context.Context, providerID string) ([]Model, error) {
	p, err := findProvider(providerID)
	if err != nil {
		return nil, err
	}
	key, err := apiKey(p)
	if err != nil {
		return nil, err
	}
	return s.models.list(ctx, p, savedBaseURL(p), key)
}

// DefaultModel returns the model chats are sent to; empty if none is chosen.
func (s *Service) DefaultModel() ModelRef {
	ai := settings.GetSettingsRaw().AI
	return ModelRef{Provider: ai.DefaultProvider, Model: ai.DefaultModel}
}

func (s *Service) SetDefaultModel(m ModelRef) error {
	if _, err := findProvider(m.Provider); err != nil {
		return err
	}
	model := strings.TrimSpace(m.Model)
	if model == "" {
		return errors.New("Choose a model.")
	}
	return settings.SetAIModel(m.Provider, model)
}

// Chat streams the reply as DeltaEvent events and returns the full text.
// Cancelling the call from the frontend stops the request.
func (s *Service) Chat(ctx context.Context, req ChatRequest) (string, error) {
	history := normalizeHistory(req.Messages)
	if len(history) == 0 || history[len(history)-1].Role != "user" {
		return "", errors.New("Nothing to send.")
	}
	ref := s.DefaultModel()
	if ref.Model == "" {
		return "", errors.New("Choose a model.")
	}
	p, err := findProvider(ref.Provider)
	if err != nil {
		return "", err
	}
	key, err := apiKey(p)
	if err != nil {
		return "", err
	}
	if !isReady(p, key != "") {
		return "", fmt.Errorf("Set up %s in Settings.", p.Name)
	}
	m := p.chat(ref.Model, key, savedBaseURL(p))
	logger.Info("ai_chat", "provider", p.ID, "model", ref.Model, "engine", req.Context.Engine)

	tools := chatTools(s.db, req.Context, func(t ToolUse) {
		s.app.Event.Emit(ToolEvent, ChatTool{ID: req.ID, Tool: t})
	})
	opts := append([]goai.Option{goai.WithTools(tools...), goai.WithMaxSteps(maxToolSteps)}, p.options...)

	ctx, cancel := context.WithTimeout(ctx, chatTimeout)
	defer cancel()
	reply, err := streamReply(ctx, m, systemPrompt(req.Context.Engine), history, func(text string) {
		s.app.Event.Emit(DeltaEvent, ChatDelta{ID: req.ID, Text: text})
	}, opts...)
	if err != nil {
		return reply, reportChatError(p, ref.Model, err)
	}
	if strings.TrimSpace(reply) == "" {
		return "", fmt.Errorf("%s returned an empty reply.", p.Name)
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
	newStep := false
	for chunk := range stream.Stream() {
		switch {
		case chunk.Type == provider.ChunkStepFinish:
			newStep = reply.Len() > 0
		case chunk.Type == provider.ChunkText && chunk.Text != "":
			text := chunk.Text
			if newStep {
				// Text after a tool call starts a new paragraph.
				text, newStep = "\n\n"+text, false
			}
			reply.WriteString(text)
			onText(text)
		}
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

// apiKey returns the provider's key, or an error if it's required and missing.
func apiKey(p Provider) (string, error) {
	key, err := savedKey(p)
	if err == nil && key == "" && !p.KeyOptional {
		err = fmt.Errorf("Add a %s API key in Settings.", p.Name)
	}
	return key, err
}

func savedKey(p Provider) (string, error) {
	key, err := settings.AIKey(p.ID)
	if err != nil {
		return "", fmt.Errorf("The saved %s key can't be read. Enter it again.", p.Name)
	}
	return key, nil
}

// isReady reports whether p's models can be listed and used. A keyless
// provider is set up once its server URL is saved.
func isReady(p Provider, hasKey bool) bool {
	return hasKey || (p.KeyOptional && settings.GetSettingsRaw().AI.Providers[p.ID].BaseURL != "")
}

func savedBaseURL(p Provider) string {
	return baseURL(p, settings.GetSettingsRaw().AI.Providers[p.ID].BaseURL)
}

func baseURL(p Provider, url string) string {
	if url = strings.TrimRight(strings.TrimSpace(url), "/"); p.CustomURL && url != "" {
		return url
	}
	return p.DefaultBaseURL
}
