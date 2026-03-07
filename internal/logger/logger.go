package logger

import (
	"context"

	"github.com/getsentry/sentry-go"
)

var Logger sentry.Logger

func Init(production bool) {
	if production {
		Logger = sentry.NewLogger(context.Background())
	}
}
