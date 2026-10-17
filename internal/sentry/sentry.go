// Package sentry sets up error and log reporting to Sentry for release builds.
// Development builds report nothing.
package sentry

import (
	"os"
	"sync/atomic"
	"time"

	"github.com/getsentry/sentry-go"
)

// dsn identifies the DataCia Sentry project. It only allows sending events;
// abuse is handled with rate limits in Sentry.
const dsn = "https://0aad2d7d7d7ba5d339d215573ce6ddbc@o4510567778287616.ingest.us.sentry.io/4512270085914624"

// devVersion is the version of builds made without a release tag.
const devVersion = "dev"

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

// Init configures the SDK for release builds. It returns false without
// initialising anything for development builds.
func Init(release string) (bool, error) {
	if release == devVersion {
		return false, nil
	}
	releaseTag := "datacia@" + release

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
