package ai

import (
	"bytes"
	"path/filepath"
	"testing"

	"datacia/internal/db"

	"github.com/google/uuid"
)

// A saved chat must reopen with the access it started with, since the UI
// locks it then and sends it with every message.
func TestSaveChatKeepsAccess(t *testing.T) {
	store, err := db.OpenFile(filepath.Join(t.TempDir(), "data.db"), bytes.Repeat([]byte{1}, 32))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	s := &Service{store: store}

	for _, access := range []Access{AccessNone, AccessSchema, AccessData} {
		id := uuid.NewString()
		if err := s.SaveChat(Chat{ID: id, Title: "t", Access: access}); err != nil {
			t.Fatal(err)
		}
		chat, err := s.LoadChat(id)
		if err != nil || chat.Access != access {
			t.Errorf("saved %q, loaded %q, err %v", access, chat.Access, err)
		}
	}
	for _, access := range []Access{"", "rows"} {
		if err := s.SaveChat(Chat{ID: uuid.NewString(), Access: access}); err == nil {
			t.Errorf("saved a chat with access %q", access)
		}
	}
}
