package update

import (
	"context"
	"crypto/sha256"
	"io"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/updater"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/github"
)

// releaseAssets mirrors what .github/workflows/release.yml publishes.
var releaseAssets = []github.ReleaseAsset{
	{Name: "DataCia-1.4.0-darwin-universal.dmg"},
	{Name: "DataCia-1.4.0-windows-universal-installer.exe"},
	{Name: "DataCia-1.4.0-darwin-universal.zip"},
	{Name: "DataCia-1.4.0-windows-amd64.exe"},
	{Name: "DataCia-1.4.0-windows-arm64.exe"},
	{Name: "SHA256SUMS"},
}

func TestMatchAsset(t *testing.T) {
	tests := []struct {
		platform, arch string
		want           string
	}{
		{"darwin", "amd64", "DataCia-1.4.0-darwin-universal.zip"},
		{"darwin", "arm64", "DataCia-1.4.0-darwin-universal.zip"},
		{"windows", "amd64", "DataCia-1.4.0-windows-amd64.exe"},
		{"windows", "arm64", "DataCia-1.4.0-windows-arm64.exe"},
	}
	for _, tt := range tests {
		t.Run(tt.platform+"/"+tt.arch, func(t *testing.T) {
			idx := matchAsset(updater.CheckRequest{Platform: tt.platform, Arch: tt.arch}, releaseAssets)
			if idx < 0 {
				t.Fatalf("no asset matched, want %s", tt.want)
			}
			if got := releaseAssets[idx].Name; got != tt.want {
				t.Fatalf("matched %s, want %s", got, tt.want)
			}
		})
	}
}

func TestMatchAssetWithoutPlatformAsset(t *testing.T) {
	assets := []github.ReleaseAsset{
		{Name: "DataCia-1.4.0-darwin-universal.dmg"},
		{Name: "DataCia-1.4.0-windows-universal-installer.exe"},
		{Name: "SHA256SUMS"},
	}
	for _, platform := range []string{"darwin", "windows"} {
		if idx := matchAsset(updater.CheckRequest{Platform: platform, Arch: "arm64"}, assets); idx != -1 {
			t.Errorf("%s: matched %s, want none", platform, assets[idx].Name)
		}
	}
}

// fakeProvider returns a fixed release from Check.
type fakeProvider struct {
	release *updater.Release
}

func (p fakeProvider) Name() string { return "fake" }

func (p fakeProvider) Check(context.Context, updater.CheckRequest) (*updater.Release, error) {
	return p.release, nil
}

func (p fakeProvider) Download(context.Context, *updater.Release, io.Writer, func(written, total int64)) error {
	return nil
}

func TestChecksumRequired(t *testing.T) {
	digest := sha256.Sum256([]byte("DataCia"))
	tests := []struct {
		name         string
		verification *updater.Verification
		wantErr      bool
	}{
		{"no verification", nil, true},
		{"empty digest", &updater.Verification{DigestAlgo: "sha256"}, true},
		{"sha256 digest", &updater.Verification{DigestAlgo: "sha256", Digest: digest[:]}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			release := &updater.Release{
				Version:      "1.4.0",
				Artifact:     updater.Artifact{Filename: "DataCia-1.4.0-windows-amd64.exe"},
				Verification: tt.verification,
			}
			p := checksumRequired{fakeProvider{release: release}}
			got, err := p.Check(context.Background(), updater.CheckRequest{})
			if tt.wantErr {
				if err == nil || got != nil {
					t.Fatalf("Check() = %v, %v; want an error", got, err)
				}
				return
			}
			if err != nil || got != release {
				t.Fatalf("Check() = %v, %v; want the release", got, err)
			}
		})
	}
}

func TestChecksumRequiredUpToDate(t *testing.T) {
	p := checksumRequired{fakeProvider{}}
	got, err := p.Check(context.Background(), updater.CheckRequest{})
	if got != nil || err != nil {
		t.Fatalf("Check() = %v, %v; want nil, nil", got, err)
	}
	if p.Name() != "fake" {
		t.Fatalf("Name() = %q, want the wrapped provider's name", p.Name())
	}
}

func TestSetupSkipsDevBuilds(t *testing.T) {
	// A nil app would panic if Setup tried to configure the updater.
	enabled, err := Setup(nil, "dev")
	if enabled || err != nil {
		t.Fatalf("Setup(dev) = %v, %v; want false, nil", enabled, err)
	}
}
