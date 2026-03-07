package remote

import (
	"datacia/internal/logger"
	"errors"
)

func (e *Engine) CheckForUpdates() (bool, error) {
	metadata, err := e.updater.IsUpdateAvailable()
	if err != nil {
		logger.Error("Failed to check for updates", "error", err.Error())
		return false, errors.New("Failed to check for updates")
	}
	return metadata != nil, nil
}

func (e *Engine) Update() error {
	err := e.updater.Update()
	if err != nil {
		logger.Error("Failed to update app", "error", err.Error())
		return err
	}
	return nil
}

func (e *Engine) RestartApp() error {
	err := e.updater.Restart()
	if err != nil {
		logger.Error("Failed to restart app", "error", err.Error())
		return errors.New("Failed to restart app")
	}
	return nil
}
