//go:build windows

package update

import (
	"datacia/internal/constants"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

var pendingInstaller string

func NewUpdater(version string) (*Updater, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("cannot resolve executable path: %w", err)
	}

	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return nil, fmt.Errorf("cannot resolve executable path: %w", err)
	}
	releaseURL := strings.TrimSuffix(constants.SERVER_URL, "/") + "/download"
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

	pendingInstaller = installerPath
	return nil
}

func (u *Updater) Restart() error {
	if pendingInstaller == "" {
		return errors.New("no pending update to install")
	}

	installDir := filepath.Join(os.Getenv("LOCALAPPDATA"), "DataCia")

	switch strings.ToLower(filepath.Ext(pendingInstaller)) {
	case ".exe":
		cmd := exec.Command(pendingInstaller, "/S", "/D="+installDir)
		cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x00000008} // DETACHED_PROCESS
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("failed to start installer: %w", err)
		}
	case ".msi":
		cmd := exec.Command("msiexec", "/i", pendingInstaller, "/passive", "/norestart",
			"ALLUSERS=0", "INSTALLDIR="+installDir)
		cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x00000008}
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("failed to start msi installer: %w", err)
		}
	default:
		os.Remove(pendingInstaller)
		return fmt.Errorf("unsupported installer format: %s", filepath.Ext(pendingInstaller))
	}

	os.Exit(0)
	return nil
}
