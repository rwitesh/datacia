// Package sentry initializes the Sentry SDK and attaches a logrus hook so that
// Error, Fatal, and Panic logs are sent to Sentry automatically. Use logrus only;
// no manual CaptureError/CaptureMessage calls needed.
package sentry

import (
	"os"
	"time"

	"datacia/internal/logger"

	"github.com/getsentry/sentry-go"
	sentrylogrus "github.com/getsentry/sentry-go/logrus"
	"github.com/sirupsen/logrus"
)

// dsn is set at build time via ldflags:
//
//	-ldflags "-X datacia/internal/sentry.dsn=<your-dsn>"
//
// Can be overridden at runtime with SENTRY_DSN env var.
var dsn string

func Init(release string) error {
	if v := os.Getenv("SENTRY_DSN"); v != "" {
		dsn = v
	}
	if dsn == "" {
		return nil
	}

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

	client := sentry.CurrentHub().Client()
	if client != nil && logger.Logger != nil {
		eventHook := sentrylogrus.NewEventHookFromClient(
			[]logrus.Level{logrus.ErrorLevel, logrus.FatalLevel, logrus.PanicLevel},
			client,
		)
		logger.Logger.AddHook(eventHook)
		logrus.RegisterExitHandler(func() {
			eventHook.Flush(2 * time.Second)
		})
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
