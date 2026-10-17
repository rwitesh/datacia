// Package sentry sets up error and log reporting to Sentry. The DSN is not
// part of the source: release builds receive it at build time, and builds
// without one (development, forks) report nothing.
package sentry

import (
	"os"
	"sync/atomic"
	"time"

	"github.com/getsentry/sentry-go"
)

// enabled is the user's "Send anonymous error reports" setting; events and
// logs are dropped while it is off.
var enabled atomic.Bool

var stopFlush chan struct{}

func init() {
	enabled.Store(true)
}

// SetEnabled turns reporting on or off at runtime.
func SetEnabled(on bool) {
	enabled.Store(on)
}

// Init configures the SDK. It returns false without initialising anything when
// dsn is empty.
func Init(dsn, release string) (bool, error) {
	if dsn == "" {
		return false, nil
	}
	releaseTag := "datacia@" + release
	if release == "" {
		releaseTag = "datacia@unknown"
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Release:          releaseTag,
		Environment:      envOrDefault("SENTRY_ENVIRONMENT", "production"),
		AttachStacktrace: true,
		Debug:            os.Getenv("SENTRY_DEBUG") == "true",
		// Report a fixed name instead of the machine's hostname.
		ServerName: "datacia",
		BeforeSend: func(event *sentry.Event, _ *sentry.EventHint) *sentry.Event {
			if !enabled.Load() {
				return nil
			}
			return event
		},
		BeforeSendLog: func(log *sentry.Log) *sentry.Log {
			if !enabled.Load() {
				return nil
			}
			return log
		},
	})
	if err != nil {
		return false, err
	}
	return true, nil
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
