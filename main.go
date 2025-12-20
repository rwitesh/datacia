package main

import (
	"datacia/internal/app"
	"datacia/internal/logger"
	"embed"

	"go.uber.org/zap"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/config.yml
var config []byte

func main() {
	// Initialize logger (false = development mode, true = production mode)
	if err := logger.Init(false); err != nil {
		panic(err)
	}
	defer logger.Sync()

	logger.Logger.Info("Application starting")

	appManager, err := app.NewApp(assets, config)
	if err != nil {
		logger.Logger.Fatal("Failed to create app", zap.Error(err))
	}

	err = appManager.Initialize()
	if err != nil {
		logger.Logger.Fatal("Failed to initialize app", zap.Error(err))
	}

	err = appManager.Run()
	if err != nil {
		logger.Logger.Fatal("Failed to run app", zap.Error(err))
	}
}
