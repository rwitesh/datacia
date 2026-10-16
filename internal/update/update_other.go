//go:build !darwin && !windows

package update

import "errors"

// NewUpdater returns an updater that never finds updates; self-update is only
// supported for the macOS and Windows release artifacts.
func NewUpdater(version string) (*Updater, error) {
	return &Updater{CurrentVersion: version}, nil
}

func (u *Updater) Update() error {
	return ErrNoUpdate
}

func (u *Updater) Restart() error {
	return errors.New("self-update is not supported on this platform")
}
