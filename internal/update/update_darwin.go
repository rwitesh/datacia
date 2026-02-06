//go:build darwin

package update

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func NewUpdater(version, releaseURL string) (*Updater, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("cannot resolve executable path: %w", err)
	}

	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return nil, fmt.Errorf("cannot resolve executable path: %w", err)
	}

	// Executable lives in: <MyApp.app>/Contents/MacOS/MyApp
	appRoot := exe
	for i := 0; i < 3; i++ {
		appRoot = filepath.Dir(appRoot)
	}

	if filepath.Ext(appRoot) != ".app" {
		return nil, fmt.Errorf("invalid bundle: expected .app root at %s", appRoot)
	}

	return &Updater{
		ReleaseURL:     releaseURL,
		CurrentVersion: strings.TrimSpace(version),
		AppPath:        appRoot,
	}, nil
}

func (u *Updater) Update() error {
	metadata, err := u.IsUpdateAvailable()
	if err != nil {
		return err
	}

	if metadata == nil {
		return errors.New("no update available")
	}

	dmgPath, err := u.downloadFile(metadata.URL)
	if err != nil {
		return fmt.Errorf("failed to download newer version: %w", err)
	}
	defer os.Remove(dmgPath)

	mountPoint, err := u.mountDMG(dmgPath)
	if err != nil {
		return fmt.Errorf("mount dmg: %w", err)
	}
	defer u.unmountDMG(mountPoint)

	if err := u.copyAppFromDMG(mountPoint, u.AppPath); err != nil {
		return fmt.Errorf("copy new app: %w", err)
	}

	return nil
}

func (u *Updater) Restart() error {
	cmd := exec.Command("open", "-n", "-a", u.AppPath)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to restart app: %w", err)
	}
	os.Exit(0)
	return nil
}

func (u *Updater) mountDMG(path string) (string, error) {
	mountRoot := filepath.Join(os.TempDir(), "autoupdater-mount")
	os.MkdirAll(mountRoot, 0755)

	cmd := exec.Command("hdiutil", "attach", "-nobrowse", path, "-mountroot", mountRoot)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("attach failed: %v (%s)", err, out)
	}

	entries, _ := os.ReadDir(mountRoot)
	if len(entries) == 0 {
		return "", errors.New("no mount point found")
	}

	return filepath.Join(mountRoot, entries[0].Name()), nil
}

func (u *Updater) unmountDMG(mount string) {
	exec.Command("hdiutil", "detach", "-force", mount).Run()
}

func (u *Updater) copyAppFromDMG(mountPoint, targetAppPath string) error {
	apps, err := filepath.Glob(filepath.Join(mountPoint, "*.app"))
	if err != nil || len(apps) == 0 {
		return errors.New("no .app found inside dmg")
	}

	srcApp := apps[0]
	appName := filepath.Base(targetAppPath)
	parentDir := filepath.Dir(targetAppPath)

	tempDir, err := os.MkdirTemp(parentDir, "update-staging-")
	if err != nil {
		return fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	stagingApp := filepath.Join(tempDir, appName)

	cmd := exec.Command("rsync", "-a", srcApp+"/", stagingApp+"/")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("rsync to staging failed: %v (%s)", err, out)
	}

	backupPath := targetAppPath + ".old"

	os.RemoveAll(backupPath)

	if err := os.Rename(targetAppPath, backupPath); err != nil {
		return fmt.Errorf("backup existing app: %w", err)
	}

	if err := os.Rename(stagingApp, targetAppPath); err != nil {
		if rbErr := os.Rename(backupPath, targetAppPath); rbErr != nil {
			return fmt.Errorf("swap failed: %v, rollback also failed: %v", err, rbErr)
		}
		return fmt.Errorf("swap failed (rolled back): %w", err)
	}

	os.RemoveAll(backupPath)

	exec.Command("touch", targetAppPath).Run()

	return nil
}
