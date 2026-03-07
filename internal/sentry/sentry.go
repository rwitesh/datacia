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
		Debug:            true,
	}); err != nil {
		return err
	}

	client := sentry.CurrentHub().Client()
	if client != nil && logger.Logger != nil {
		eventHook := sentrylogrus.NewEventHookFromClient(
			[]logrus.Level{logrus.InfoLevel, logrus.ErrorLevel, logrus.FatalLevel, logrus.PanicLevel},
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
