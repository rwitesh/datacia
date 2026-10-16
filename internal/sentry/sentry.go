// Package sentry initializes the Sentry SDK with structured logging support.
package sentry

import (
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

const dsn = "https://d0d8b92c5e3d1601f6ede2c3b0f6c832@o4510567778287616.ingest.us.sentry.io/4510567794671616"

var stopFlush chan struct{}

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
		Debug:            os.Getenv("SENTRY_DEBUG") == "true",
	}); err != nil {
		return err
	}
	return nil
}

func Flush() {
	sentry.Flush(2 * time.Second)
}

// StartPeriodicFlush spawns a goroutine that flushes buffered events every 30s.
// Call StopPeriodicFlush before final Flush to cleanly shut down.
func StartPeriodicFlush() {
	stopFlush = make(chan struct{})
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				sentry.Flush(2 * time.Second)
			case <-stopFlush:
				return
			}
		}
	}()
}

func StopPeriodicFlush() {
	if stopFlush != nil {
		close(stopFlush)
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
