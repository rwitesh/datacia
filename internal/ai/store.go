package ai

import (
	"encoding/json"
	"errors"
	"os"
	"sync"

	"datacia/internal/logger"
	"datacia/internal/paths"
)

const maxStoredMessages = 200

type StoredMessage struct {
	ID      string    `json:"id"`
	Role    string    `json:"role"`
	Content string    `json:"content"`
	Error   string    `json:"error,omitempty"`
	Tools   []ToolUse `json:"tools,omitempty"`
}

// Chat is the AI panel's conversation, kept between launches.
type Chat struct {
	Messages []StoredMessage `json:"messages"`
}

type chatStore struct {
	mu sync.Mutex
}

func (s *chatStore) load() (Chat, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	empty := Chat{Messages: []StoredMessage{}}
	path, err := paths.GetChatPath()
	if err != nil {
		return empty, err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return empty, nil
	}
	if err != nil {
		return empty, err
	}
	var chat Chat
	if err := json.Unmarshal(data, &chat); err != nil {
		logger.Warn("Unreadable AI chat file, starting fresh", "error", err.Error())
		return empty, nil
	}
	if chat.Messages == nil {
		chat.Messages = []StoredMessage{}
	}
	return chat, nil
}

func (s *chatStore) save(chat Chat) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if n := len(chat.Messages); n > maxStoredMessages {
		chat.Messages = chat.Messages[n-maxStoredMessages:]
	}
	path, err := paths.GetChatPath()
	if err != nil {
		return err
	}
	data, err := json.Marshal(chat)
	if err != nil {
		return err
	}
	return paths.WriteFileAtomic(path, data, 0600)
}
