package main

import (
	"datacia/internal/app"
	"datacia/internal/logger"
	"datacia/internal/sentry"
	"embed"
	"fmt"

	"gopkg.in/yaml.v3"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/config.yml
var config []byte

// buildConfig is used only to read version for Sentry release.
type buildConfig struct {
	Info struct {
		Version string `yaml:"version"`
	} `yaml:"info"`
}

func main() {
	defer recoverAndReport()

	// Initialize logger (false = development mode, true = production mode)
	if err := logger.Init(false); err != nil {
		panic(err)
	}

	// Parse version for Sentry release
	var cfg buildConfig
	_ = yaml.Unmarshal(config, &cfg)
	version := cfg.Info.Version

	if err := sentry.Init(version); err != nil {
		logger.Logger.WithError(err).Error("Sentry init failed")
	}
	defer sentry.Flush()

	logger.Logger.Info("Application starting")

	appManager, err := app.NewApp(assets, config)
	if err != nil {
		logger.Logger.WithError(err).Fatal("Failed to create app")
	}

	err = appManager.Initialize()
	if err != nil {
		logger.Logger.WithError(err).Fatal("Failed to initialize app")
	}

	err = appManager.Run()
	if err != nil {
		logger.Logger.WithError(err).Fatal("Failed to run app")
	}
}

// recoverAndReport logs the panic (Sentry hook captures it), flushes, then re-panics.
func recoverAndReport() {
	if r := recover(); r != nil {
		logger.Logger.WithField("panic", true).Error("panic: " + fmtString(r))
		sentry.Flush()
		panic(r)
	}
}

func fmtString(r interface{}) string {
	switch v := r.(type) {
	case string:
		return v
	case error:
		return v.Error()
	default:
		return fmt.Sprintf("%v", r)
	}
}
