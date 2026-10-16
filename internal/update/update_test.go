package update

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func newReleaseServer(t *testing.T, body string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestFetchReleaseMetadataPicksPlatformAsset(t *testing.T) {
	srv := newReleaseServer(t, `{
		"tag_name": "v1.11.0",
		"assets": [
			{"name": "DataCia-1.11.0-windows-universal-installer.exe", "browser_download_url": "https://example.com/win.exe"},
			{"name": "DataCia-1.11.0-darwin-universal.dmg", "browser_download_url": "https://example.com/mac.dmg"},
			{"name": "SHA256SUMS", "browser_download_url": "https://example.com/SHA256SUMS"}
		]
	}`)

	u := &Updater{ReleaseURL: srv.URL, CurrentVersion: "1.10.80", AssetSuffix: ".dmg"}
	meta, err := u.IsUpdateAvailable()
	if err != nil {
		t.Fatalf("IsUpdateAvailable: %v", err)
	}
	if meta == nil || meta.URL != "https://example.com/mac.dmg" || meta.Version != "v1.11.0" ||
		meta.AssetName != "DataCia-1.11.0-darwin-universal.dmg" || meta.ChecksumsURL != "https://example.com/SHA256SUMS" {
		t.Fatalf("unexpected metadata: %+v", meta)
	}
}

func TestFetchReleaseMetadataPrefersMatchingArch(t *testing.T) {
	other := "arm64"
	if runtime.GOARCH == "arm64" {
		other = "amd64"
	}
	srv := newReleaseServer(t, fmt.Sprintf(`{
		"tag_name": "v2.0.0",
		"assets": [
			{"name": "DataCia-%s-installer.exe", "browser_download_url": "https://example.com/other.exe"},
			{"name": "DataCia-%s-installer.exe", "browser_download_url": "https://example.com/native.exe"}
		]
	}`, other, runtime.GOARCH))

	u := &Updater{ReleaseURL: srv.URL, CurrentVersion: "1.0.0", AssetSuffix: "-installer.exe"}
	meta, err := u.fetchReleaseMetadata()
	if err != nil {
		t.Fatalf("fetchReleaseMetadata: %v", err)
	}
	if meta.URL != "https://example.com/native.exe" {
		t.Fatalf("expected native-arch asset, got %s", meta.URL)
	}
}

func TestNoUpdateWhenCurrentIsLatest(t *testing.T) {
	srv := newReleaseServer(t, `{"tag_name": "v1.10.80", "assets": [{"name": "DataCia-1.10.80-darwin-universal.dmg", "browser_download_url": "https://example.com/mac.dmg"}]}`)

	u := &Updater{ReleaseURL: srv.URL, CurrentVersion: "1.10.80", AssetSuffix: ".dmg"}
	meta, err := u.IsUpdateAvailable()
	if err != nil || meta != nil {
		t.Fatalf("expected no update, got %+v, %v", meta, err)
	}
}

func TestNoUpdateForUnsupportedPlatform(t *testing.T) {
	u := &Updater{CurrentVersion: "1.0.0"}
	meta, err := u.IsUpdateAvailable()
	if err != nil || meta != nil {
		t.Fatalf("expected no update, got %+v, %v", meta, err)
	}
}

func TestFetchReleaseMetadataRejectsOtherArch(t *testing.T) {
	other := "arm64"
	if runtime.GOARCH == "arm64" {
		other = "amd64"
	}
	srv := newReleaseServer(t, fmt.Sprintf(`{
		"tag_name": "v2.0.0",
		"assets": [{"name": "DataCia-%s-installer.exe", "browser_download_url": "https://example.com/other.exe"}]
	}`, other))

	u := &Updater{ReleaseURL: srv.URL, CurrentVersion: "1.0.0", AssetSuffix: "-installer.exe"}
	if _, err := u.fetchReleaseMetadata(); err == nil {
		t.Fatal("expected an error when only another architecture's asset exists")
	}
}

// newAssetServer serves a release payload and a SHA256SUMS file listing sums.
func newAssetServer(t *testing.T, payload []byte, sums string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/DataCia-1.11.0-darwin-universal.dmg":
			w.Write(payload)
		case "/SHA256SUMS":
			fmt.Fprint(w, sums)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func checksumOf(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func TestDownloadVerifiesChecksum(t *testing.T) {
	payload := []byte("dmg bytes")
	srv := newAssetServer(t, payload, checksumOf(payload)+"  DataCia-1.11.0-darwin-universal.dmg\n")
	meta := &ReleaseMetadata{
		Version:      "v1.11.0",
		URL:          srv.URL + "/DataCia-1.11.0-darwin-universal.dmg",
		AssetName:    "DataCia-1.11.0-darwin-universal.dmg",
		ChecksumsURL: srv.URL + "/SHA256SUMS",
	}

	path, err := (&Updater{}).download(meta)
	if err != nil {
		t.Fatalf("download: %v", err)
	}
	defer os.Remove(path)
	got, err := os.ReadFile(path)
	if err != nil || string(got) != string(payload) {
		t.Fatalf("downloaded file = %q, %v", got, err)
	}
}

func TestDownloadRejectsChecksumMismatch(t *testing.T) {
	srv := newAssetServer(t, []byte("tampered"), checksumOf([]byte("original"))+"  DataCia-1.11.0-darwin-universal.dmg\n")
	meta := &ReleaseMetadata{
		Version:      "v1.11.0",
		URL:          srv.URL + "/DataCia-1.11.0-darwin-universal.dmg",
		AssetName:    "DataCia-1.11.0-darwin-universal.dmg",
		ChecksumsURL: srv.URL + "/SHA256SUMS",
	}

	if _, err := (&Updater{}).download(meta); err == nil {
		t.Fatal("expected checksum mismatch error")
	}
	if _, err := os.Stat(filepath.Join(os.TempDir(), meta.AssetName)); !os.IsNotExist(err) {
		t.Fatalf("mismatched download should be removed, stat err = %v", err)
	}
}

func TestDownloadRequiresChecksums(t *testing.T) {
	meta := &ReleaseMetadata{Version: "v1.11.0", URL: "https://example.com/x.dmg", AssetName: "x.dmg"}
	if _, err := (&Updater{}).download(meta); err == nil {
		t.Fatal("expected an error when the release has no SHA256SUMS")
	}
}
