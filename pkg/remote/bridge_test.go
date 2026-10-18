package remote

import (
	"datacia/pkg/ssh"
	"encoding/json"
	"errors"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type bridgeService struct{}

func (*bridgeService) Unknown() error {
	return &ssh.HostKeyUnknownError{Code: ssh.HostKeyUnknownCode, Host: "h", Fingerprint: "SHA256:x"}
}

// The frontend reads HostKeyUnknownError from err.cause, which Wails builds
// from the error's JSON; this pins that shape against the Wails version in use.
func TestWailsBridgeSerializesHostKeyError(t *testing.T) {
	// Bindings.Add logs through the global app.
	application.New(application.Options{})
	bindings := application.NewBindings(nil, nil)
	if err := bindings.Add(application.NewService(&bridgeService{})); err != nil {
		t.Fatal(err)
	}
	call := func(method string) []byte {
		bound := bindings.Get(&application.CallOptions{MethodName: "datacia/pkg/remote.bridgeService." + method})
		if bound == nil {
			t.Fatalf("method %s not bound", method)
		}
		_, err := bound.Call(t.Context(), nil)
		var cerr *application.CallError
		if !errors.As(err, &cerr) {
			t.Fatalf("want CallError, got %v", err)
		}
		// This is what the HTTP transport sends to the JS runtime.
		data, jsonErr := json.Marshal(cerr)
		if jsonErr != nil {
			t.Fatal(jsonErr)
		}
		return data
	}

	var got struct {
		Kind    string
		Message string
		Cause   map[string]string
	}
	if err := json.Unmarshal(call("Unknown"), &got); err != nil {
		t.Fatal(err)
	}
	if got.Kind != "RuntimeError" || got.Cause["code"] != ssh.HostKeyUnknownCode || got.Cause["host"] != "h" || got.Cause["fingerprint"] != "SHA256:x" {
		t.Fatalf("unexpected payload %+v", got)
	}
}
