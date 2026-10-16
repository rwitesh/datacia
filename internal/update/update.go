package update

import (
	"bufio"
	"crypto/sha256"
	"datacia/internal/constants"
	"datacia/internal/logger"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
)

var ErrNoUpdate = errors.New("no update available")

type ReleaseMetadata struct {
	Version string `json:"version"`
	URL     string `json:"url"`
	// AssetName is the file name of the platform asset in the release.
	AssetName string `json:"asset_name"`
	// ChecksumsURL points at the release's SHA256SUMS file, used to verify the download.
	ChecksumsURL string `json:"checksums_url"`
}

type Updater struct {
	ReleaseURL     string
	CurrentVersion string
	AppPath        string
	// AssetSuffix selects the release asset for this platform (e.g. ".dmg").
	AssetSuffix string
}

// checksumsAssetName is published by .github/workflows/release.yml next to the installers.
const checksumsAssetName = "SHA256SUMS"

var (
	apiClient      = &http.Client{Timeout: 15 * time.Second}
	downloadClient = &http.Client{Timeout: 10 * time.Minute}
)

// githubRelease is the subset of the GitHub "latest release" API response we use.
type githubRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

func latestReleaseURL() string {
	return fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", constants.GITHUB_OWNER, constants.GITHUB_REPO)
}

func (u *Updater) fetchReleaseMetadata() (*ReleaseMetadata, error) {
	req, err := http.NewRequest(http.MethodGet, u.ReleaseURL, nil)
	if err != nil {
		return nil, fmt.Errorf("invalid release URL: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	response, err := apiClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid status: %s", response.Status)
	}

	var release githubRelease
	if err := json.NewDecoder(response.Body).Decode(&release); err != nil {
		return nil, err
	}

	meta := &ReleaseMetadata{Version: release.TagName}
	for _, asset := range release.Assets {
		if asset.Name == checksumsAssetName {
			meta.ChecksumsURL = asset.BrowserDownloadURL
			continue
		}
		name := strings.ToLower(asset.Name)
		if meta.URL != "" || !strings.HasSuffix(name, u.AssetSuffix) {
			continue
		}
		// Only accept a build for this architecture or a universal build.
		if strings.Contains(name, runtime.GOARCH) || strings.Contains(name, "universal") {
			meta.URL = asset.BrowserDownloadURL
			meta.AssetName = asset.Name
		}
	}
	if meta.URL == "" {
		return nil, fmt.Errorf("no %s asset for %s in release %s", u.AssetSuffix, runtime.GOARCH, release.TagName)
	}

	return meta, nil
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
	if u.AssetSuffix == "" {
		// No release artifact for this platform.
		return nil, nil
	}
	metadata, err := u.fetchReleaseMetadata()
	if err != nil {
		logger.Error("Failed to check for updates", "error", err.Error())
		return nil, fmt.Errorf("failed to check for updates: %w", err)
	}
	if u.IsNewerVersion(metadata) {
		return metadata, nil
	}
	return nil, nil
}

// expectedChecksum returns the SHA-256 listed for assetName in the release's SHA256SUMS
// file (the `sha256sum` format: "<hex>  <name>").
func expectedChecksum(meta *ReleaseMetadata) (string, error) {
	if meta.ChecksumsURL == "" {
		return "", fmt.Errorf("release %s has no %s file", meta.Version, checksumsAssetName)
	}
	response, err := apiClient.Get(meta.ChecksumsURL)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("invalid status for %s: %s", checksumsAssetName, response.Status)
	}

	scanner := bufio.NewScanner(io.LimitReader(response.Body, 1<<20))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) == 2 && strings.TrimPrefix(fields[1], "*") == meta.AssetName {
			return strings.ToLower(fields[0]), nil
		}
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	return "", fmt.Errorf("%s has no entry for %s", checksumsAssetName, meta.AssetName)
}

// download fetches the release asset into the temp directory and verifies it against
// the release's SHA256SUMS before returning its path.
func (u *Updater) download(meta *ReleaseMetadata) (string, error) {
	want, err := expectedChecksum(meta)
	if err != nil {
		return "", err
	}

	name := filepath.Base(meta.AssetName)
	if name == "" || name == "." || name == string(filepath.Separator) {
		name = "update.bin"
	}
	tmp := filepath.Join(os.TempDir(), name)
	out, err := os.Create(tmp)
	if err != nil {
		return "", err
	}

	response, err := downloadClient.Get(meta.URL)
	if err != nil {
		out.Close()
		os.Remove(tmp)
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		out.Close()
		os.Remove(tmp)
		return "", fmt.Errorf("invalid status: %s", response.Status)
	}

	hash := sha256.New()
	_, copyErr := io.Copy(io.MultiWriter(out, hash), response.Body)
	closeErr := out.Close()
	if err := errors.Join(copyErr, closeErr); err != nil {
		os.Remove(tmp)
		return "", err
	}

	if got := hex.EncodeToString(hash.Sum(nil)); got != want {
		os.Remove(tmp)
		return "", fmt.Errorf("checksum mismatch for %s: got %s, want %s", meta.AssetName, got, want)
	}
	return tmp, nil
}
