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

	// Parse version for Sentry release
	var cfg buildConfig
	_ = yaml.Unmarshal(config, &cfg)
	version := cfg.Info.Version

	if err := sentry.Init(version); err != nil {
		logger.Error("Sentry init failed", "error", err.Error())
	}
	defer sentry.Flush()

	// Initialize logger (false = development mode, true = production mode)
	logger.Init(true)

	appManager, err := app.NewApp(assets, config)
	if err != nil {
		logger.Error("Failed to create app", "error", err.Error())
		panic(err)
	}

	err = appManager.Initialize()
	if err != nil {
		logger.Error("Failed to initialize app", "error", err.Error())
		panic(err)
	}

	err = appManager.Run()
	if err != nil {
		logger.Error("Failed to run app", "error", err.Error())
		panic(err)
	}
}

// recoverAndReport logs the panic, flushes Sentry, then re-panics.
func recoverAndReport() {
	if r := recover(); r != nil {
		logger.Error("panic: " + fmtString(r))
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
