package logger

import "github.com/getsentry/sentry-go"

func Error(msg string, attrs ...string) {
	emit("error", msg, attrs...)
}

func Warn(msg string, attrs ...string) {
	emit("warn", msg, attrs...)
}

func Info(msg string, attrs ...string) {
	emit("info", msg, attrs...)
}

func Debug(msg string, attrs ...string) {
	emit("debug", msg, attrs...)
}

func emit(level, msg string, attrs ...string) {
	if Logger == nil {
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
	case "debug":
		return Logger.Debug()
	default:
		return Logger.Info()
	}
}
