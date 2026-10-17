package logger

import (
	"context"

	"github.com/getsentry/sentry-go"
	"github.com/getsentry/sentry-go/attribute"
)

// Logger sends structured logs to Sentry. It is nil when reporting is not
// configured, in which case logs are written to stderr instead.
var Logger sentry.Logger

func Init(reporting bool) {
	if reporting {
		Logger = sentry.NewLogger(context.Background())
	}
}

func SetGlobalAttrs(attrs ...attribute.Builder) {
	if Logger == nil {
		return
	}
	Logger.SetAttributes(attrs...)
}
