// Package sentry initializes the Sentry SDK with structured logging support.
package sentry

import (
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

const dsn = "https://d0d8b92c5e3d1601f6ede2c3b0f6c832@o4510567778287616.ingest.us.sentry.io/4510567794671616"

func Init(release string) error {
	releaseTag := "datacia@" + release
	if release == "" {
		releaseTag = "datacia@unknown"
	}

	if err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Release:          releaseTag,
		Environment:      envOrDefault("SENTRY_ENVIRONMENT", "production"),
		AttachStacktrace: true,
		EnableLogs:       true,
		Debug:            true,
	}); err != nil {
		return err
	}
	return nil
}

func Flush() {
	sentry.Flush(2 * time.Second)
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
