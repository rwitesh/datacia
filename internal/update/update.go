// Package update wires DataCia's releases into the Wails v3 updater
// (app.Updater): GitHub Releases as the source, SHA256SUMS as the required
// integrity check, and a silent check shortly after startup.
package update

import (
	"context"
	"crypto/sha256"
	"datacia/internal/logger"
	"fmt"
	"runtime"
	"strings"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/updater"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/github"
)

const (
	// repository publishes the releases (see .github/workflows/release.yml).
	repository = "rwitesh/datacia"
	// checksumAsset is the `sha256sum` listing published next to the release assets.
	checksumAsset = "SHA256SUMS"
	// devVersion is what builds without -ldflags "-X main.version=..." report.
	devVersion = "dev"
	// checkAttempts bounds the background check; failures are retried with a
	// doubling delay starting at retryDelay.
	checkAttempts = 3
	retryDelay    = 30 * time.Second
)

// readyVersion holds the version of the update staged for the next restart,
// so windows opened after updater.EventUpdateReady can still offer it.
var readyVersion atomic.Value

// ReadyVersion returns the version of the downloaded update waiting for a
// restart, or "" if there is none.
func ReadyVersion() string {
	v, _ := readyVersion.Load().(string)
	return v
}

// Setup configures app.Updater for this build. It returns enabled=false
// without touching the updater when self-update cannot work: dev builds
// (the updater's semver treats "dev" as older than every release), platforms
// without an update artifact, and macOS apps the updater cannot replace
// (see canReplaceAppBundle).
func Setup(app *application.App, version string) (enabled bool, err error) {
	if version == devVersion {
		return false, nil
	}
	if runtime.GOOS != "darwin" && runtime.GOOS != "windows" {
		return false, nil
	}
	if runtime.GOOS == "darwin" {
		replaceable, err := canReplaceAppBundle()
		if err != nil || !replaceable {
			return false, err
		}
	}

	provider, err := github.New(github.Config{
		Repository:    repository,
		ChecksumAsset: checksumAsset,
		AssetMatcher:  matchAsset,
	})
	if err != nil {
		return false, err
	}

	err = app.Updater.Init(updater.Config{
		CurrentVersion: version,
		Providers:      []updater.Provider{checksumRequired{provider}},
		Window:         updater.WindowNone,
	})
	if err != nil {
		return false, err
	}

	app.Event.On(updater.EventUpdateReady, func(e *application.CustomEvent) {
		if release, ok := e.Data.(*updater.Release); ok && release != nil {
			readyVersion.Store(release.Version)
		}
	})
	return true, nil
}

// CheckInBackground runs a check-download-install pass after delay, retrying
// failures (e.g. no network) a few times. When an update is staged the updater
// emits updater.EventUpdateReady, which the frontend turns into a "Restart"
// prompt.
func CheckInBackground(app *application.App, delay time.Duration) {
	go func() {
		ctx := app.Context()
		wait := delay
		for attempt := 1; attempt <= checkAttempts; attempt++ {
			select {
			case <-ctx.Done():
				return
			case <-time.After(wait):
			}

			err := app.Updater.CheckAndInstall(ctx)
			if err == nil {
				if app.Updater.State() == updater.StateReady {
					logger.Info("Background update downloaded successfully")
				}
				return
			}
			logger.Error("Background update failed", "attempt", fmt.Sprint(attempt), "error", err.Error())
			if attempt == 1 {
				wait = retryDelay
			} else {
				wait *= 2
			}
		}
	}()
}

// matchAsset picks the release asset the updater downloads. macOS uses the
// zipped .app for this architecture, else the universal one (older releases
// have only that); everything else uses the per-architecture asset, which
// github.DefaultAssetMatcher finds while skipping installers and SHA256SUMS.
func matchAsset(req updater.CheckRequest, assets []github.ReleaseAsset) int {
	if req.Platform != "darwin" {
		return github.DefaultAssetMatcher(req, assets)
	}
	archZip := "-darwin-" + strings.ToLower(req.Arch) + ".zip"
	universal := -1
	for i, asset := range assets {
		name := strings.ToLower(asset.Name)
		if strings.HasSuffix(name, archZip) {
			return i
		}
		if strings.HasSuffix(name, "-darwin-universal.zip") {
			universal = i
		}
	}
	return universal
}

// checksumRequired fails closed when a release has no SHA-256 digest: the
// GitHub provider silently skips verification if SHA256SUMS is missing or
// has no entry for the picked asset.
type checksumRequired struct {
	updater.Provider
}

func (p checksumRequired) Check(ctx context.Context, req updater.CheckRequest) (*updater.Release, error) {
	release, err := p.Provider.Check(ctx, req)
	if err != nil || release == nil {
		return release, err
	}
	v := release.Verification
	if v == nil || v.DigestAlgo != "sha256" || len(v.Digest) != sha256.Size {
		return nil, fmt.Errorf("release %s has no %s entry for %s", release.Version, checksumAsset, release.Artifact.Filename)
	}
	return release, nil
}
