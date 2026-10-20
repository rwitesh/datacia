package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"datacia/internal/db"
	"datacia/internal/logger"
	"datacia/internal/settings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/zendev-sh/goai"
	"github.com/zendev-sh/goai/provider"
)

const (
	DeltaEvent    = "ai:delta"
	ToolEvent     = "ai:tool"
	chatTimeout   = 10 * time.Minute
	signInTimeout = 5 * time.Minute
)

// ChatDelta is a piece of a streamed reply, tagged with the ChatRequest ID.
type ChatDelta struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

// ChatTool reports a tool call made while answering the ChatRequest ID: once
// as it starts and again, with the same Tool.ID, when it ends.
type ChatTool struct {
	ID   string  `json:"id"`
	Tool ToolUse `json:"tool"`
}

// MessagePart is a piece of a message, in order: text or a tool call.
type MessagePart struct {
	Text string   `json:"text,omitempty"`
	Tool *ToolUse `json:"tool,omitempty"`
}

// ChatReply is a finished reply.
type ChatReply struct {
	Parts []MessagePart `json:"parts"`
	Usage Usage         `json:"usage"`
}

// Usage is a reply's token use over all its model calls. Prompt tokens
// include the cached ones.
type Usage struct {
	Context   int `json:"context"` // prompt tokens of the last call: how full the context is
	Prompt    int `json:"prompt"`
	CacheRead int `json:"cacheRead"`
	Output    int `json:"output"`
}

func (u *Usage) add(step provider.Usage) {
	// goai reports cache reads and writes apart from the other input tokens.
	prompt := step.InputTokens + step.CacheReadTokens + step.CacheWriteTokens
	u.Context = prompt
	u.Prompt += prompt
	u.CacheRead += step.CacheReadTokens
	u.Output += step.OutputTokens
}

// replyParts builds a reply's parts as text streams in and tools run, which
// happen on different goroutines. emit runs under the lock so the chat gets
// the changes in the same order.
type replyParts struct {
	mu    sync.Mutex
	parts []MessagePart
}

func (r *replyParts) addText(text string, emit func()) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if n := len(r.parts); n > 0 && r.parts[n-1].Tool == nil {
		r.parts[n-1].Text += text
	} else {
		r.parts = append(r.parts, MessagePart{Text: text})
	}
	emit()
}

// setTool adds a tool call, or replaces the one with the same ID as it ends.
func (r *replyParts) setTool(t ToolUse, emit func()) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i, p := range r.parts {
		if p.Tool != nil && p.Tool.ID == t.ID {
			r.parts[i].Tool = &t
			emit()
			return
		}
	}
	r.parts = append(r.parts, MessagePart{Tool: &t})
	emit()
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
	store  *db.Store
	models modelCache
}

func NewService(app *application.App, database Database, store *db.Store) *Service {
	clearProviderEnv()
	return &Service{app: app, db: database, store: store}
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

// Chat streams the reply as DeltaEvent and ToolEvent events and returns it.
// Cancelling the call from the frontend stops the request.
func (s *Service) Chat(ctx context.Context, req ChatRequest) (ChatReply, error) {
	history := normalizeHistory(req.Messages)
	if len(history) == 0 || history[len(history)-1].Role != "user" {
		return ChatReply{}, errors.New("Nothing to send.")
	}
	ref := s.DefaultModel()
	if ref.Model == "" {
		return ChatReply{}, errors.New("Choose a model.")
	}
	p, err := findProvider(ref.Provider)
	if err != nil {
		return ChatReply{}, err
	}
	key, err := apiKey(p)
	if err != nil {
		return ChatReply{}, err
	}
	if !isReady(p, key != "") {
		return ChatReply{}, fmt.Errorf("Set up %s in Settings.", p.Name)
	}
	m := p.chat(ref.Model, key, savedBaseURL(p))
	logger.Info("ai_chat", "provider", p.ID, "model", ref.Model, "engine", req.Context.Engine)

	var reply replyParts
	tools := chatTools(s.db, req.Context, func(t ToolUse) {
		reply.setTool(t, func() { s.app.Event.Emit(ToolEvent, ChatTool{ID: req.ID, Tool: t}) })
	})
	var usage Usage
	opts := append([]goai.Option{
		goai.WithTools(tools...),
		goai.WithMaxSteps(maxToolSteps),
		goai.WithOnStepFinish(func(step goai.StepResult) { usage.add(step.Usage) }),
	}, p.options...)

	ctx, cancel := context.WithTimeout(ctx, chatTimeout)
	defer cancel()
	text, err := streamReply(ctx, m, systemPrompt, withEngine(history, req.Context.Engine), func(text string) {
		reply.addText(text, func() { s.app.Event.Emit(DeltaEvent, ChatDelta{ID: req.ID, Text: text}) })
	}, opts...)
	if err != nil {
		return ChatReply{}, reportChatError(p, ref.Model, err)
	}
	if strings.TrimSpace(text) == "" {
		return ChatReply{}, fmt.Errorf("%s returned an empty reply.", p.Name)
	}
	return ChatReply{Parts: reply.parts, Usage: usage}, nil
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
	// A cache breakpoint after the history lets each tool step reuse it, on
	// top of the system prompt and tools. Only Anthropic reads it.
	if n := len(msgs); n > 0 && len(msgs[n-1].Content) > 0 {
		msgs[n-1].Content[0].CacheControl = "ephemeral"
	}
	opts = append([]goai.Option{goai.WithSystem(system)}, opts...)
	var reply strings.Builder
	res, err := streamStep(ctx, m, msgs, &reply, onText, opts...)
	if err == nil && res.StepsExhausted {
		// The loop ran out of steps after a tool call, so the model hasn't
		// answered yet. goai can't turn tools off for a step, so replay the
		// transcript once with tool choice "none"; the tools stay declared so
		// the cached prompt prefix still matches.
		msgs = append(msgs, res.ResponseMessages...)
		_, err = streamStep(ctx, m, msgs, &reply, onText, append(opts, goai.WithToolChoice("none"), goai.WithMaxSteps(1))...)
	}
	if err != nil {
		return reply.String(), err
	}
	// A cancelled stream ends without an error.
	return reply.String(), ctx.Err()
}

// streamStep streams one model call, with its tool loop, into reply.
func streamStep(ctx context.Context, m provider.LanguageModel, msgs []provider.Message, reply *strings.Builder, onText func(string), opts ...goai.Option) (*goai.TextResult, error) {
	stream, err := goai.StreamText(ctx, m, append(opts, goai.WithMessages(msgs...))...)
	if err != nil {
		return nil, err
	}
	for chunk := range stream.Stream() {
		if chunk.Type == provider.ChunkText && chunk.Text != "" {
			reply.WriteString(chunk.Text)
			onText(chunk.Text)
		}
	}
	return stream.Result(), stream.Err()
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
