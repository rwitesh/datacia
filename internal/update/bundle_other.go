//go:build !darwin

package update

// canReplaceAppBundle is only consulted on macOS, where updates replace the
// enclosing .app bundle.
func canReplaceAppBundle() (bool, error) {
	return true, nil
}
