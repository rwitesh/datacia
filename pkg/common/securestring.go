package common

import (
	"runtime"
	"sync"
)

// SecureString holds a secret, such as a password, in a byte slice that is
// zeroed when cleared or garbage collected, to shorten the time it stays in
// memory in plaintext.
type SecureString struct {
	mu   sync.RWMutex
	data []byte
}

// NewSecureString copies s. The string s itself stays in memory until it is
// garbage collected; only the copy can be zeroed.
func NewSecureString(s string) *SecureString {
	ss := &SecureString{
		data: []byte(s),
	}
	runtime.SetFinalizer(ss, (*SecureString).finalize)
	return ss
}

// String returns a copy of the secret, which cannot be zeroed.
func (ss *SecureString) String() string {
	if ss == nil {
		return ""
	}
	ss.mu.RLock()
	defer ss.mu.RUnlock()
	if ss.data == nil {
		return ""
	}
	return string(ss.data)
}

// Clear zeros the secret as soon as it is no longer needed.
func (ss *SecureString) Clear() {
	if ss == nil {
		return
	}
	ss.mu.Lock()
	defer ss.mu.Unlock()
	clear(ss.data)
	ss.data = nil
	runtime.SetFinalizer(ss, nil)
}

func (ss *SecureString) finalize() {
	ss.Clear()
}
