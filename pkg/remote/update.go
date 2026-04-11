package remote

import (
	"datacia/internal/logger"
	"datacia/internal/update"
	"errors"
	"fmt"
	"time"
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

func (e *Engine) StartBackgroundUpdate() {
	go func() {
		time.Sleep(5 * time.Second)

		retryDelay := 30 * time.Second
		maxRetries := 3

		for attempt := 0; attempt <= maxRetries; attempt++ {
			if attempt > 0 {
				time.Sleep(retryDelay)
				retryDelay *= 2
			}

			err := e.updater.Update()
			if err == nil {
				logger.Info("Background update downloaded successfully")
				if e.wailsApp != nil {
					e.wailsApp.Event.Emit("update:ready", nil)
				}
				return
			}

			if errors.Is(err, update.ErrNoUpdate) {
				return
			}

			logger.Error("Background update failed", "attempt", fmt.Sprint(attempt+1), "error", err.Error())
		}
	}()
}

func (e *Engine) RestartApp() error {
	err := e.updater.Restart()
	if err != nil {
		logger.Error("Failed to restart app", "error", err.Error())
		return errors.New("Failed to restart app")
	}
	return nil
}
