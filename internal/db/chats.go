package db

import (
	"database/sql"
	"errors"
	"time"
)

// chatTimeLayout is fixed-width so timestamps sort as text.
const chatTimeLayout = "2006-01-02T15:04:05.000Z"

// ErrChatNotFound is returned when loading a chat that was deleted.
var ErrChatNotFound = errors.New("This chat no longer exists.")

// ChatSummary is a saved AI chat without its messages.
type ChatSummary struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	UpdatedAt string `json:"updatedAt"`
}

// SaveChat creates or replaces a chat. messages is JSON the ai package owns.
func (s *Store) SaveChat(id, title, messages string) error {
	now := time.Now().UTC().Format(chatTimeLayout)
	_, err := s.db.Exec(`
		INSERT INTO ai_chats (id, title, messages, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title = excluded.title, messages = excluded.messages, updated_at = excluded.updated_at
	`, id, title, messages, now, now)
	return err
}

// LoadChat returns a chat's title and messages JSON.
func (s *Store) LoadChat(id string) (title, messages string, err error) {
	err = s.db.QueryRow(`SELECT title, messages FROM ai_chats WHERE id = ?`, id).Scan(&title, &messages)
	if errors.Is(err, sql.ErrNoRows) {
		err = ErrChatNotFound
	}
	return title, messages, err
}

// ListChats returns every chat, most recently updated first.
func (s *Store) ListChats() ([]ChatSummary, error) {
	rows, err := s.db.Query(`SELECT id, title, updated_at FROM ai_chats ORDER BY updated_at DESC, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	chats := []ChatSummary{}
	for rows.Next() {
		var c ChatSummary
		if err := rows.Scan(&c.ID, &c.Title, &c.UpdatedAt); err != nil {
			return nil, err
		}
		chats = append(chats, c)
	}
	return chats, rows.Err()
}

func (s *Store) DeleteChat(id string) error {
	_, err := s.db.Exec(`DELETE FROM ai_chats WHERE id = ?`, id)
	return err
}
