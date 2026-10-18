package queries

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"datacia/internal/logger"
	"datacia/internal/paths"
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
	rootDir string
}

func NewQueriesService() *QueriesService {
	rootDir, err := paths.GetQueriesDir()
	if err != nil {
		logger.Error("Failed to resolve queries root dir", "error", err.Error())
	} else if err := os.MkdirAll(rootDir, 0755); err != nil {
		logger.Error("Failed to create queries root dir", "error", err.Error())
	}

	return &QueriesService{rootDir: rootDir}
}

// resolvePath resolves a path relative to rootDir and rejects any that
// would land outside it. An empty path resolves to rootDir itself.
func (s *QueriesService) resolvePath(relPath string) (string, error) {
	if s.rootDir == "" {
		return "", errors.New("queries directory is unavailable")
	}
	fullPath := filepath.Join(s.rootDir, relPath)
	rel, err := filepath.Rel(s.rootDir, fullPath)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("invalid path: escapes root directory")
	}
	return fullPath, nil
}

// resolveEntry is resolvePath for operations on a single file or folder,
// which must never act on the queries directory itself.
func (s *QueriesService) resolveEntry(relPath string) (string, error) {
	fullPath, err := s.resolvePath(relPath)
	if err != nil {
		return "", err
	}
	if fullPath == filepath.Clean(s.rootDir) {
		return "", errors.New("invalid path: no file or folder given")
	}
	return fullPath, nil
}

// renameNoReplace renames like os.Rename but fails instead of replacing an
// existing destination, which os.Rename does silently on macOS and Linux.
// A destination that is the source itself is allowed, so a case-only rename
// works on case-insensitive file systems.
func renameNoReplace(from, to string) error {
	toInfo, err := os.Lstat(to)
	if err == nil {
		fromInfo, fromErr := os.Lstat(from)
		if fromErr != nil || !os.SameFile(fromInfo, toInfo) {
			return fmt.Errorf("%q already exists", filepath.Base(to))
		}
	} else if !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return os.Rename(from, to)
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
	absPath, err := s.resolveEntry(relPath)
	if err != nil {
		return err
	}
	return os.MkdirAll(absPath, 0755)
}

func (s *QueriesService) CreateQueryFile(relPath string) error {
	if !strings.HasSuffix(relPath, ".sql") {
		relPath += ".sql"
	}
	absPath, err := s.resolveEntry(relPath)
	if err != nil {
		return err
	}

	f, err := os.OpenFile(absPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if errors.Is(err, fs.ErrExist) {
		return fmt.Errorf("%q already exists", filepath.Base(absPath))
	}
	if err != nil {
		return err
	}
	return f.Close()
}

func (s *QueriesService) Rename(relPath string, newName string) error {
	absPath, err := s.resolveEntry(relPath)
	if err != nil {
		return err
	}
	if newName == "" || newName == "." || newName == ".." || strings.ContainsAny(newName, `/\`) {
		return fmt.Errorf("invalid name %q", newName)
	}
	return renameNoReplace(absPath, filepath.Join(filepath.Dir(absPath), newName))
}

func (s *QueriesService) Move(relSourcePath string, relDestPath string) error {
	absSourcePath, err := s.resolveEntry(relSourcePath)
	if err != nil {
		return err
	}
	absDestPath, err := s.resolveEntry(relDestPath)
	if err != nil {
		return err
	}
	return renameNoReplace(absSourcePath, absDestPath)
}

func (s *QueriesService) Delete(relPath string) error {
	absPath, err := s.resolveEntry(relPath)
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
	absPath, err := s.resolveEntry(relPath)
	if err != nil {
		return err
	}
	return os.WriteFile(absPath, []byte(content), 0644)
}
