package logger

import (
	"context"
	"log/slog"

	"github.com/getsentry/sentry-go"
)

func Error(msg string, attrs ...string) {
	emit("error", msg, attrs...)
}

func Warn(msg string, attrs ...string) {
	emit("warn", msg, attrs...)
}

func Info(msg string, attrs ...string) {
	emit("info", msg, attrs...)
}

func emit(level, msg string, attrs ...string) {
	if Logger == nil {
		args := make([]any, 0, len(attrs))
		for _, a := range attrs {
			args = append(args, a)
		}
		slog.Log(context.Background(), slogLevel(level), msg, args...)
		return
	}
	var e = logEntry(level)
	for i := 0; i+1 < len(attrs); i += 2 {
		e = e.String(attrs[i], attrs[i+1])
	}
	e.Emit(msg)
}

func logEntry(level string) sentry.LogEntry {
	switch level {
	case "error":
		return Logger.Error()
	case "warn":
		return Logger.Warn()
	default:
		return Logger.Info()
	}
}

func slogLevel(level string) slog.Level {
	switch level {
	case "error":
		return slog.LevelError
	case "warn":
		return slog.LevelWarn
	default:
		return slog.LevelInfo
	}
}
