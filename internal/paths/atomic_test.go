package paths

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteFileAtomic(t *testing.T) {
	path := filepath.Join(t.TempDir(), "q.sql")
	for _, content := range []string{"first", "second"} {
		if err := WriteFileAtomic(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		if got, _ := os.ReadFile(path); string(got) != content {
			t.Fatalf("got %q, want %q", got, content)
		}
	}
	entries, _ := os.ReadDir(filepath.Dir(path))
	if len(entries) != 1 {
		t.Errorf("temp file left behind: %v", entries)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0600 {
		t.Errorf("mode %v, want 0600", info.Mode().Perm())
	}
}
