package main

import (
	"datacia/internal/app"
	"datacia/internal/logger"
	"datacia/internal/sentry"
	"datacia/internal/settings"
	"embed"
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/updater"
)

//go:embed all:frontend/dist
var assets embed.FS

// version is the release version, injected at build time from the git tag
// (-ldflags "-X main.version=<version>"). Builds without it report "dev" and
// never auto-update.
var version = "dev"

// sentryDSN is injected at build time from the SENTRY_DSN secret
// (-ldflags "-X main.sentryDSN=<dsn>"). Without it nothing is reported and
// logs go to stderr.
var sentryDSN string

func main() {
	// When relaunched as the updater's helper (to swap in a downloaded update),
	// do the swap and exit before any app initialisation. application.New also
	// calls this, but running it first keeps Sentry and logging out of the helper.
	updater.HandleHelperMode()

	defer recoverAndReport()

	sentry.SetEnabled(settings.ErrorReportsEnabled())
	reporting, err := sentry.Init(sentryDSN, version)
	logger.Init(reporting)
	if err != nil {
		logger.Error("Sentry init failed", "error", err.Error())
	}
	if reporting {
		sentry.StartPeriodicFlush()
		defer func() {
			sentry.StopPeriodicFlush()
			sentry.Flush()
		}()
	}

	appManager, err := app.NewApp(assets, version)
	if err != nil {
		logger.Error("Failed to create app", "error", err.Error())
		panic(err)
	}

	err = appManager.Initialize()
	if err != nil {
		logger.Error("Failed to initialize app", "error", err.Error())
		panic(err)
	}

	err = appManager.Run()
	if err != nil {
		logger.Error("Failed to run app", "error", err.Error())
		panic(err)
	}
}

// recoverAndReport logs the panic, flushes Sentry, then re-panics.
func recoverAndReport() {
	if r := recover(); r != nil {
		logger.Error("panic: " + fmtString(r))
		sentry.Flush()
		panic(r)
	}
}

func fmtString(r interface{}) string {
	switch v := r.(type) {
	case string:
		return v
	case error:
		return v.Error()
	default:
		return fmt.Sprintf("%v", r)
	}
}
