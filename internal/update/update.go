package update

import (
	"datacia/internal/constants"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
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

func NewUpdater() (*Updater, error) {
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
		ReleaseURL:     constants.RELEASE_URL,
		CurrentVersion: strings.TrimSpace(constants.VERSION),
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
	response, err := http.Get(u.ReleaseURL)
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

	cmd := exec.Command("rsync", "-a", "--delete", srcApp+"/", targetAppPath+"/")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("rsync failed: %v (%s)", err, out)
	}
	return nil
}
