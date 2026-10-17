package ai

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"datacia/internal/constants"
	"datacia/internal/logger"

	"github.com/adrg/xdg"
)

const maxStoredMessages = 200

type StoredMessage struct {
	ID      string `json:"id"`
	Role    string `json:"role"`
	Content string `json:"content"`
	Error   string `json:"error,omitempty"`
}

// Chat is the AI panel's conversation, kept between launches.
type Chat struct {
	Provider string          `json:"provider"`
	Model    string          `json:"model"`
	Messages []StoredMessage `json:"messages"`
}

type chatStore struct {
	mu sync.Mutex
}

func chatPath() (string, error) {
	return xdg.DataFile(filepath.Join(constants.APP_NAME, "chat.json"))
}

func (s *chatStore) load() (Chat, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	empty := Chat{Messages: []StoredMessage{}}
	path, err := chatPath()
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
	path, err := chatPath()
	if err != nil {
		return err
	}
	data, err := json.Marshal(chat)
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
