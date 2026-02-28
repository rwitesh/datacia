package update

import (
	"datacia/internal/logger"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
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
		logger.Error("update.IsUpdateAvailable", err, "Failed to check for updates")
		return nil, errors.New("Failed to check for updates")
	}
	if u.IsNewerVersion(metadata) {
		return metadata, nil
	}
	return nil, nil
}

func (u *Updater) downloadFile(fileURL string) (string, error) {
	name := "update.bin"
	if parsed, err := url.Parse(fileURL); err == nil && parsed.Path != "" {
		if base := filepath.Base(parsed.Path); base != "" && base != "." {
			name = base
		}
	}
	tmp := filepath.Join(os.TempDir(), name)
	out, err := os.Create(tmp)
	if err != nil {
		return "", err
	}
	defer out.Close()

	response, err := http.Get(fileURL)
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
