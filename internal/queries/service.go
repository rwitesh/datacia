package queries

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"datacia/internal/constants"
	"datacia/internal/logger"

	"github.com/adrg/xdg"
	"github.com/wailsapp/wails/v3/pkg/application"
	"go.uber.org/zap"
)

type FileType string

const (
	FileTypeFile   FileType = "file"
	FileTypeFolder FileType = "folder"
)

type FileNode struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"` // Relative path from root
	Type     FileType   `json:"type"`
	Children []FileNode `json:"children,omitempty"`
}

type QueriesService struct {
	app     *application.App
	rootDir string
}

func NewQueriesService(app *application.App) *QueriesService {
	// Use XDG data home for queries
	// xdg.DataHome gives us the base data directory (e.g. ~/.local/share)
	// We want ~/.local/share/datacia/queries
	rootDir := filepath.Join(xdg.DataHome, constants.APP_NAME, "queries")

	if err := os.MkdirAll(rootDir, 0755); err != nil {
		logger.Logger.Error("Error creating queries root dir", zap.Error(err), zap.String("rootDir", rootDir))
	}

	return &QueriesService{
		app:     app,
		rootDir: rootDir,
	}
}

// resolvePath resolves a relative path to an absolute path within the rootDir.
// It ensures the resulting path is contained within rootDir.
func (s *QueriesService) resolvePath(relPath string) (string, error) {
	// Clean the relative path to remove . and ..
	relPath = filepath.Clean(relPath)

	// Prevent navigation above root with leading ".." or "/" if accidentally passed
	if strings.HasPrefix(relPath, "..") || strings.HasPrefix(relPath, "/") {
		// Just trim leading separators/dots to be safe or error out?
		// Better to error if it looks malicious, but we can just treat it as relative to root.
		// For stricter security:
		if strings.HasPrefix(relPath, "..") {
			return "", fmt.Errorf("invalid path: attempts to traverse up")
		}
	}

	// Join with root
	fullPath := filepath.Join(s.rootDir, relPath)

	// Final check to make sure it is still under rootDir (handles tricky cases)
	if !strings.HasPrefix(fullPath, s.rootDir) {
		return "", fmt.Errorf("invalid path: escapes root directory")
	}

	return fullPath, nil
}

func (s *QueriesService) ListTree() ([]FileNode, error) {
	return s.readDirRecursive("")
}

func (s *QueriesService) readDirRecursive(relPath string) ([]FileNode, error) {
	absPath, err := s.resolvePath(relPath)
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(absPath)
	if err != nil {
		return nil, err
	}

	var nodes []FileNode
	for _, entry := range entries {
		// skip hidden files if necessary, or system files
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		childRelPath := filepath.Join(relPath, entry.Name())
		node := FileNode{
			Name: entry.Name(),
			Path: childRelPath,
		}

		if entry.IsDir() {
			node.Type = FileTypeFolder
			children, err := s.readDirRecursive(childRelPath)
			if err == nil {
				node.Children = children
			} else {
				node.Children = []FileNode{}
			}
		} else {
			node.Type = FileTypeFile
		}
		nodes = append(nodes, node)
	}

	// Sort folders first, then files
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].Type == nodes[j].Type {
			return strings.ToLower(nodes[i].Name) < strings.ToLower(nodes[j].Name)
		}
		return nodes[i].Type == FileTypeFolder
	})

	return nodes, nil
}

func (s *QueriesService) CreateFolder(relPath string) error {
	absPath, err := s.resolvePath(relPath)
	if err != nil {
		return err
	}
	return os.MkdirAll(absPath, 0755)
}

func (s *QueriesService) CreateQueryFile(relPath string) error {
	if !strings.HasSuffix(relPath, ".sql") {
		relPath += ".sql"
	}
	absPath, err := s.resolvePath(relPath)
	if err != nil {
		return err
	}

	// Create parent dirs if they don't exist? The user might expect this.
	// But usually "Create File" implies the parent folder exists or is selected.
	// We'll enforce parent existence or auto-create?
	// Standard behavior: create file. returns error if dir doesn't exist.

	f, err := os.Create(absPath)
	if err != nil {
		return err
	}
	defer f.Close()
	return nil
}

func (s *QueriesService) Rename(relPath string, newName string) error {
	absPath, err := s.resolvePath(relPath)
	if err != nil {
		return err
	}

	dir := filepath.Dir(absPath)
	newAbsPath := filepath.Join(dir, newName)

	// Verify new path is also valid
	if !strings.HasPrefix(newAbsPath, s.rootDir) {
		return fmt.Errorf("invalid new name: escapes root directory")
	}

	return os.Rename(absPath, newAbsPath)
}

func (s *QueriesService) Move(relSourcePath string, relDestPath string) error {
	absSourcePath, err := s.resolvePath(relSourcePath)
	if err != nil {
		return err
	}

	absDestPath, err := s.resolvePath(relDestPath)
	if err != nil {
		return err
	}

	// Create parent dir for destination if it doesn't exist?
	// os.Rename fails if parent dir doesn't exist.
	// Frontend should ensure valid path, but good to ensure dir exists.
	// But usually Move implies the folder structure exists.

	return os.Rename(absSourcePath, absDestPath)
}

func (s *QueriesService) Delete(relPath string) error {
	absPath, err := s.resolvePath(relPath)
	if err != nil {
		return err
	}
	return os.RemoveAll(absPath)
}

func (s *QueriesService) ReadFile(relPath string) (string, error) {
	absPath, err := s.resolvePath(relPath)
	if err != nil {
		return "", err
	}

	content, err := os.ReadFile(absPath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func (s *QueriesService) WriteFile(relPath string, content string) error {
	absPath, err := s.resolvePath(relPath)
	if err != nil {
		return err
	}
	return os.WriteFile(absPath, []byte(content), 0644)
}
