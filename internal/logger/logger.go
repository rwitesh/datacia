package logger

import (
	"context"

	"github.com/getsentry/sentry-go"
	"github.com/getsentry/sentry-go/attribute"
)

var Logger sentry.Logger

func Init(production bool) {
	if production {
		Logger = sentry.NewLogger(context.Background())
	}
}

func SetGlobalAttrs(attrs ...attribute.Builder) {
	if Logger == nil {
		return
	}
	Logger.SetAttributes(attrs...)
}
