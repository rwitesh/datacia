package remote

func (e *Engine) CheckForUpdates() (bool, error) {
	metadata, err := e.updater.IsUpdateAvailable()
	if err != nil {
		return false, err
	}
	return metadata != nil, nil
}

func (e *Engine) Update() error {
	return e.updater.Update()
}

func (e *Engine) RestartApp() error {
	return e.updater.Restart()
}
