package main

import (
	"datacia/internal/app"
	"embed"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	appManager, err := app.NewApp(assets)
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
