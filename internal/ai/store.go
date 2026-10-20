package ai

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"datacia/internal/db"
)

const (
	maxStoredMessages = 200
	maxTitleChars     = 80
)

type StoredMessage struct {
	ID    string        `json:"id"`
	Role  string        `json:"role"`
	Parts []MessagePart `json:"parts"`
	Error string        `json:"error,omitempty"`
	Usage *Usage        `json:"usage,omitempty"` // a reply's tokens
}

// Chat is one conversation, saved in data.db.
type Chat struct {
	ID       string          `json:"id"`
	Title    string          `json:"title"`
	Messages []StoredMessage `json:"messages"`
}

// ListChats returns the saved chats, most recently updated first.
func (s *Service) ListChats() ([]db.ChatSummary, error) {
	return s.store.ListChats()
}

func (s *Service) LoadChat(id string) (Chat, error) {
	title, data, err := s.store.LoadChat(id)
	if err != nil {
		return Chat{}, err
	}
	chat := Chat{ID: id, Title: title}
	if err := json.Unmarshal([]byte(data), &chat.Messages); err != nil {
		return Chat{}, fmt.Errorf("This chat can't be read: %w", err)
	}
	if chat.Messages == nil {
		chat.Messages = []StoredMessage{}
	}
	return chat, nil
}

// SaveChat creates or replaces the chat, keeping its latest messages.
func (s *Service) SaveChat(chat Chat) error {
	if chat.ID == "" {
		return errors.New("The chat has no ID.")
	}
	if n := len(chat.Messages); n > maxStoredMessages {
		chat.Messages = chat.Messages[n-maxStoredMessages:]
	}
	data, err := json.Marshal(chat.Messages)
	if err != nil {
		return err
	}
	return s.store.SaveChat(chat.ID, truncate(strings.TrimSpace(chat.Title), maxTitleChars), string(data))
}

func (s *Service) DeleteChat(id string) error {
	return s.store.DeleteChat(id)
}
