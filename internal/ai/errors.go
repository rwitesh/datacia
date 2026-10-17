package ai

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"

	"datacia/internal/logger"

	"github.com/zendev-sh/goai"
)

// userError turns a provider error into a short message for the chat. It
// never includes request URLs, which some providers put credentials in.
func userError(p Provider, err error) error {
	if errors.Is(err, context.Canceled) {
		return err
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("%s took too long to respond.", p.Name)
	}
	var overflow *goai.ContextOverflowError
	if errors.As(err, &overflow) {
		return errors.New("This chat is too long for the model. Start a new chat.")
	}
	var apiErr *goai.APIError
	if errors.As(err, &apiErr) {
		msg := clip(apiErr.Message)
		switch code := apiErr.StatusCode; {
		case code == 401 || code == 403:
			return fmt.Errorf("%s rejected the API key.", p.Name)
		case code == 402:
			return fmt.Errorf("Your %s account is out of credits.", p.Name)
		case code == 404:
			return fmt.Errorf("%s doesn't recognize this model.", p.Name)
		case code == 429:
			return fmt.Errorf("%s rate limit reached. Try again shortly.", p.Name)
		case code >= 500:
			return fmt.Errorf("%s is unavailable (HTTP %d). Try again shortly.", p.Name, code)
		default:
			return fmt.Errorf("%s: %s", p.Name, msg)
		}
	}
	if isNetwork(err) {
		return fmt.Errorf("Couldn't reach %s.", p.Name)
	}
	return fmt.Errorf("%s: %s", p.Name, clip(err.Error()))
}

// errorKind describes an error for logs without provider-controlled text,
// which can echo parts of the API key.
func errorKind(err error) string {
	var apiErr *goai.APIError
	switch {
	case errors.Is(err, context.Canceled):
		return "canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.As(err, &apiErr):
		return fmt.Sprintf("http_%d", apiErr.StatusCode)
	}
	var overflow *goai.ContextOverflowError
	if errors.As(err, &overflow) {
		return "context_overflow"
	}
	if isNetwork(err) {
		return "network"
	}
	return "other"
}

func isNetwork(err error) bool {
	var urlErr *url.Error
	var netErr net.Error
	return errors.As(err, &urlErr) || errors.As(err, &netErr)
}

func clip(s string) string {
	return truncate(strings.TrimSpace(s), 300)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return strings.ToValidUTF8(s[:n], "") + "…"
}

// reportChatError logs err without its text and returns the message for the user.
func reportChatError(p Provider, model string, err error) error {
	if !errors.Is(err, context.Canceled) {
		logger.Warn("ai_chat_failed", "provider", p.ID, "model", model, "kind", errorKind(err))
	}
	return userError(p, err)
}
