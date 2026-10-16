package ai

import (
	"fmt"

	"datacia/internal/logger"
	"datacia/internal/settings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type Service struct {
	app *application.App
}

func NewService(app *application.App) *Service {
	return &Service{app: app}
}

func buildSystemPrompt(engine, context string) string {
	if context != "" {
		return fmt.Sprintf("You are a %s SQL expert assisting users in the Datacia. Provide %s-compatible SQL syntax only. Use ```sql code blocks for all queries—never include SQL outside these blocks. Be concise and actionable. Skip introductions, setup steps, and generic advice. Focus on solving the immediate task with working SQL. Current context:\n%s. When relevant, add a brief tip about query optimization, indexing, or GUI features.", engine, engine, context)
	}
	return fmt.Sprintf("You are a %s SQL expert assisting users in the Datacia. Provide %s-compatible SQL syntax only. Use ```sql code blocks for all queries—never include SQL outside these blocks. Be concise and actionable. Skip introductions, setup steps, and generic advice. Focus on solving the immediate task with working SQL. When relevant, add a brief tip about query optimization, indexing, or GUI features.", engine, engine)
}

func (s *Service) SendMessage(engine, context, message, model string) (string, error) {
	if engine == "" {
		return "", fmt.Errorf("engine is required")
	}
	if message == "" {
		return "", fmt.Errorf("message is required")
	}
	if model == "" {
		return "", fmt.Errorf("model is required")
	}

	provider, modelID, err := resolveProvider(model)
	if err != nil {
		return "", err
	}
	logger.Info("ai_tool_usage", "provider", provider, "model", modelID, "engine", engine)
	switch provider {
	case "gemini":
		out, sendErr := s.sendGemini(engine, context, message, modelID)
		if sendErr != nil {
			logger.Warn("ai_tool_usage_failed", "provider", provider, "model", modelID, "engine", engine, "error", sendErr.Error())
		}
		return out, sendErr
	default:
		return "", fmt.Errorf("unsupported model: %s", model)
	}
}

// resolveProvider returns provider name and model ID for a given model ID from settings.
func resolveProvider(modelID string) (provider string, id string, err error) {
	cfg := settings.GetSettingsRaw()
	g := cfg.AI.Gemini
	if g.Enabled {
		for _, m := range g.Models {
			if m == modelID {
				return "gemini", modelID, nil
			}
		}
	}
	return "", "", fmt.Errorf("unsupported model: %s", modelID)
}
