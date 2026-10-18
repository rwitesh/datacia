package paths

import (
	"os"
	"path/filepath"
)

// WriteFileAtomic replaces path with data so a crash leaves either the old or
// the new file, never a partial one. The temp file is hidden so directory
// listings (e.g. saved queries) skip it.
func WriteFileAtomic(path string, data []byte, perm os.FileMode) error {
	f, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	tmp := f.Name()
	// A unique name keeps concurrent saves of one file from interleaving.
	err = f.Chmod(perm)
	if err == nil {
		_, err = f.Write(data)
	}
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
