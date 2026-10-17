package update

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/unix"
)

// canReplaceAppBundle reports whether the updater can swap the running app:
// the executable must live at <Name>.app/Contents/MacOS/<exe> and the folder
// holding the .app must be writable. That rules out bare binaries and apps
// run from the mounted DMG or a translocated (read-only) location.
func canReplaceAppBundle() (bool, error) {
	exe, err := os.Executable()
	if err != nil {
		return false, fmt.Errorf("cannot resolve executable path: %w", err)
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return false, fmt.Errorf("cannot resolve executable path: %w", err)
	}
	appRoot := filepath.Dir(filepath.Dir(filepath.Dir(exe)))
	if filepath.Ext(appRoot) != ".app" {
		return false, nil
	}
	return unix.Access(filepath.Dir(appRoot), unix.W_OK) == nil, nil
}
