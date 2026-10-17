package queries

import (
	"os"
	"path/filepath"
	"testing"
)

func newTestService(t *testing.T) *QueriesService {
	t.Helper()
	return &QueriesService{rootDir: t.TempDir()}
}

func TestResolvePath(t *testing.T) {
	s := newTestService(t)
	tests := []struct {
		path    string
		wantErr bool
	}{
		{"", false},
		{"a.sql", false},
		{"dir/a.sql", false},
		{"..notes.sql", false},
		{"dir/../a.sql", false},
		{"..", true},
		{"../a.sql", true},
		{"dir/../../a.sql", true},
		{"../" + filepath.Base(s.rootDir) + "-x/a.sql", true},
	}
	for _, tt := range tests {
		_, err := s.resolvePath(tt.path)
		if (err != nil) != tt.wantErr {
			t.Errorf("resolvePath(%q) error = %v, wantErr %v", tt.path, err, tt.wantErr)
		}
	}
}

func TestEntryOperationsRejectRoot(t *testing.T) {
	s := newTestService(t)
	if err := s.Delete(""); err == nil {
		t.Error("Delete(\"\") should fail")
	}
	if err := s.Delete("."); err == nil {
		t.Error("Delete(\".\") should fail")
	}
	if err := s.Rename("", "x"); err == nil {
		t.Error("Rename(\"\") should fail")
	}
	if _, err := os.Stat(s.rootDir); err != nil {
		t.Fatalf("root dir removed: %v", err)
	}
}

func TestCreateAndRenameDoNotOverwrite(t *testing.T) {
	s := newTestService(t)
	if err := s.WriteFile("a.sql", "select 1"); err != nil {
		t.Fatal(err)
	}
	if err := s.WriteFile("b.sql", "select 2"); err != nil {
		t.Fatal(err)
	}

	if err := s.CreateQueryFile("a"); err == nil {
		t.Error("CreateQueryFile over an existing file should fail")
	}
	if err := s.Rename("a.sql", "b.sql"); err == nil {
		t.Error("Rename onto an existing file should fail")
	}
	if err := s.Move("a.sql", "b.sql"); err == nil {
		t.Error("Move onto an existing file should fail")
	}
	if err := s.Rename("a.sql", "../escape.sql"); err == nil {
		t.Error("Rename with a path separator should fail")
	}

	for name, want := range map[string]string{"a.sql": "select 1", "b.sql": "select 2"} {
		got, err := s.ReadFile(name)
		if err != nil || got != want {
			t.Errorf("%s = %q, %v; want %q", name, got, err, want)
		}
	}

	if err := s.Rename("a.sql", "c.sql"); err != nil {
		t.Errorf("Rename to a free name: %v", err)
	}
	if err := s.CreateQueryFile("d"); err != nil {
		t.Errorf("CreateQueryFile new file: %v", err)
	}
}
