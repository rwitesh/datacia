package paths

import (
	"os"
	"path/filepath"
)

// WriteFileAtomic replaces path with data so a crash leaves either the old or
// the new file, never a partial one. The temp file is hidden so directory
// listings (e.g. saved queries) skip it.
func WriteFileAtomic(path string, data []byte, perm os.FileMode) error {
	tmp := filepath.Join(filepath.Dir(path), "."+filepath.Base(path)+".tmp")
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, perm)
	if err != nil {
		return err
	}
	_, err = f.Write(data)
	if err == nil {
		// Without it, a crash right after the rename can leave an empty file.
		err = f.Sync()
	}
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, path)
}
