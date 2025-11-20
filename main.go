package main

import (
	"datacia/internal/app"
	"embed"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/config.yml
var config []byte

func main() {
	appManager, err := app.NewApp(assets, config)
	if err != nil {
		panic(err)
	}

	err = appManager.Initialize()
	if err != nil {
		panic(err)
	}

	err = appManager.Run()
	if err != nil {
		panic(err)
	}
}
