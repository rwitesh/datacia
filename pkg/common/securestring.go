package common

import (
	"runtime"
	"sync"
)

// SecureString is a wrapper around a string that zeros memory on garbage collection
// and provides thread-safe access. It's designed to minimize the time sensitive
// data (like passwords) spend in memory in plaintext form.
type SecureString struct {
	mu   sync.RWMutex
	data []byte
}

// NewSecureString creates a new SecureString from a plain string.
// The original string remains in memory until GC, but this provides
// a mechanism to zero the copy when done.
func NewSecureString(s string) *SecureString {
	ss := &SecureString{
		data: []byte(s),
	}
	// Set finalizer to zero memory when object is garbage collected
	runtime.SetFinalizer(ss, (*SecureString).finalize)
	return ss
}

// String returns a copy of the secure string as a regular string.
// This is safe to use but creates a new string in memory.
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

// Clear explicitly zeros the memory and removes the finalizer.
// This should be called when the password is no longer needed.
func (ss *SecureString) Clear() {
	if ss == nil {
		return
	}
	ss.mu.Lock()
	defer ss.mu.Unlock()
	if ss.data != nil {
		// Zero the memory
		for i := range ss.data {
			ss.data[i] = 0
		}
		ss.data = nil
	}
	// Remove finalizer since we've already cleared
	runtime.SetFinalizer(ss, nil)
}

// finalize is called by the garbage collector to zero memory before collection.
func (ss *SecureString) finalize() {
	ss.Clear()
}
