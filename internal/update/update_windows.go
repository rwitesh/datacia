//go:build windows

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

	return &Updater{
		ReleaseURL:     releaseURL,
		CurrentVersion: strings.TrimSpace(version),
		AppPath:        filepath.Dir(exe),
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

	installerPath, err := u.downloadFile(metadata.URL)
	if err != nil {
		return fmt.Errorf("failed to download newer version: %w", err)
	}
	defer os.Remove(installerPath)

	switch strings.ToLower(filepath.Ext(installerPath)) {
	case ".exe":
		err = u.installEXE(installerPath)
	case ".msi":
		err = u.installMSI(installerPath)
	default:
		return fmt.Errorf("unsupported installer format: %s", filepath.Ext(installerPath))
	}
	if err != nil {
		return fmt.Errorf("failed to install update: %w", err)
	}

	return nil
}

func (u *Updater) Restart() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to resolve executable path: %w", err)
	}

	cmd := exec.Command(exePath)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to restart app: %w", err)
	}
	os.Exit(0)
	return nil
}

func (u *Updater) installEXE(exePath string) error {
	cmd := exec.Command(exePath, "/S")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("installer failed: %v (%s)", err, out)
	}
	return nil
}

func (u *Updater) installMSI(msiPath string) error {
	cmd := exec.Command("msiexec", "/i", msiPath, "/passive", "/norestart")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("msiexec failed: %v (%s)", err, out)
	}
	return nil
}
