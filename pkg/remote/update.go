package remote

import (
	"datacia/internal/logger"
	"errors"
)

func (e *Engine) CheckForUpdates() (bool, error) {
	metadata, err := e.updater.IsUpdateAvailable()
	if err != nil {
		logger.Error("remote.CheckForUpdates", err, "Failed to check for updates")
		return false, errors.New("Failed to check for updates")
	}
	return metadata != nil, nil
}

func (e *Engine) Update() error {
	err := e.updater.Update()
	if err != nil {
		logger.Error("remote.Update", err, "Failed to update app")
		return err
	}
	return nil
}

func (e *Engine) RestartApp() error {
	err := e.updater.Restart()
	if err != nil {
		logger.Error("remote.RestartApp", err, "Failed to restart app")
		return errors.New("Failed to restart app")
	}
	return nil
}
