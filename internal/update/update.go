package update

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/Masterminds/semver/v3"
)

type ReleaseMetadata struct {
	Version string `json:"version"`
	URL     string `json:"url"`
}

type Updater struct {
	ReleaseURL     string
	CurrentVersion string
	AppPath        string
}

func NewUpdater(version, releaseURL string) (*Updater, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("cannot resolve executable path: %w", err)
	}

	// Resolve real bundle (following symlinks is safer)
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return nil, fmt.Errorf("cannot resolve executable path: %w", err)
	}

	// Executable lives in:
	// <MyApp.app>/Contents/MacOS/MyApp
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

	dmgPath, err := u.downloadDMG(metadata.URL)
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

func (u *Updater) fetchReleaseMetadata() (*ReleaseMetadata, error) {
	releaseURL, err := url.Parse(u.ReleaseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid release URL: %w", err)
	}

	query := releaseURL.Query()
	query.Set("os", runtime.GOOS)
	query.Set("arch", runtime.GOARCH)
	releaseURL.RawQuery = query.Encode()

	response, err := http.Get(releaseURL.String())
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		return nil, fmt.Errorf("invalid status: %s", response.Status)
	}

	var metadata ReleaseMetadata
	if err := json.NewDecoder(response.Body).Decode(&metadata); err != nil {
		return nil, err
	}
	return &metadata, nil
}

func (u *Updater) IsNewerVersion(meta *ReleaseMetadata) bool {
	cur := strings.TrimPrefix(u.CurrentVersion, "v")
	lat := strings.TrimPrefix(meta.Version, "v")

	current, err1 := semver.NewVersion(cur)
	latest, err2 := semver.NewVersion(lat)
	if err1 != nil || err2 != nil {
		return false
	}

	return latest.GreaterThan(current)
}

func (u *Updater) IsUpdateAvailable() (*ReleaseMetadata, error) {
	metadata, err := u.fetchReleaseMetadata()
	if err != nil {
		return nil, errors.New("failed to check for updates")
	}
	if u.IsNewerVersion(metadata) {
		return metadata, nil
	}
	return nil, nil
}

func (u *Updater) downloadDMG(url string) (string, error) {
	tmp := filepath.Join(os.TempDir(), filepath.Base(url))
	out, err := os.Create(tmp)
	if err != nil {
		return "", err
	}
	defer out.Close()

	response, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		return "", fmt.Errorf("invalid status: %s", response.Status)
	}

	_, err = io.Copy(out, response.Body)
	return tmp, err
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

	// Create a temp directory for the new app bundle
	tempDir, err := os.MkdirTemp(parentDir, "update-staging-")
	if err != nil {
		return fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir) // Cleanup staging on any exit

	stagingApp := filepath.Join(tempDir, appName)

	// Copy new app from DMG to staging directory using rsync
	cmd := exec.Command("rsync", "-a", srcApp+"/", stagingApp+"/")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("rsync to staging failed: %v (%s)", err, out)
	}

	// Define backup path for rollback
	backupPath := targetAppPath + ".old"

	// Remove any stale backup from a previous failed update
	os.RemoveAll(backupPath)

	// Rename existing app to backup (atomic on macOS for same filesystem)
	if err := os.Rename(targetAppPath, backupPath); err != nil {
		return fmt.Errorf("backup existing app: %w", err)
	}

	// Atomically move staging app to target location
	if err := os.Rename(stagingApp, targetAppPath); err != nil {
		// Rollback: restore from backup
		if rbErr := os.Rename(backupPath, targetAppPath); rbErr != nil {
			return fmt.Errorf("swap failed: %v, rollback also failed: %v", err, rbErr)
		}
		return fmt.Errorf("swap failed (rolled back): %w", err)
	}

	// Success: remove backup
	os.RemoveAll(backupPath)

	// Touch the app bundle to refresh Finder and LaunchServices metadata
	exec.Command("touch", targetAppPath).Run()

	return nil
}
