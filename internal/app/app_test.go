package app

import (
	"bytes"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestLogPanicOmitsPanicValue(t *testing.T) {
	var buf bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	logPanic(&application.PanicDetails{
		Error:      errors.New("SELECT * FROM users WHERE password = 'hunter2'"),
		StackTrace: "main.run /app/main.go:10",
	})

	out := buf.String()
	if strings.Contains(out, "hunter2") || strings.Contains(out, "SELECT") {
		t.Errorf("panic value leaked into the log: %s", out)
	}
	if !strings.Contains(out, "main.run") {
		t.Errorf("stack trace missing from the log: %s", out)
	}
}
