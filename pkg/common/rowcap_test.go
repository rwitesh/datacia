package common

import (
	"context"
	"errors"
	"testing"
)

type fakeRows struct{ left int }

func (f *fakeRows) Next() bool {
	if f.left == 0 {
		return false
	}
	f.left--
	return true
}

func TestScanCapped(t *testing.T) {
	tests := []struct {
		name          string
		total, max    int
		wantRead      int
		wantTruncated bool
	}{
		{"no cap", 5, 0, 5, false},
		{"under cap", 3, 5, 3, false},
		{"exactly cap", 5, 5, 5, false},
		{"over cap", 6, 5, 5, true},
		{"empty", 0, 5, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			read := 0
			truncated, err := ScanCapped(context.Background(), &fakeRows{tt.total}, tt.max, func() error { read++; return nil })
			if err != nil || read != tt.wantRead || truncated != tt.wantTruncated {
				t.Errorf("got read=%d truncated=%v err=%v", read, truncated, err)
			}
		})
	}
}

func TestScanCappedErrors(t *testing.T) {
	boom := errors.New("boom")
	if _, err := ScanCapped(context.Background(), &fakeRows{3}, 0, func() error { return boom }); err != boom {
		t.Errorf("scan error = %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := ScanCapped(ctx, &fakeRows{3}, 0, func() error { return nil }); err == nil {
		t.Error("expected context error")
	}
}
