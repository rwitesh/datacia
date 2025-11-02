package main

import (
	"embed"
	"layerbits/internal/app"
	"log"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	appManager := app.NewApp()
	
	err := appManager.Initialize(assets)
	if err != nil {
		log.Fatal(err)
	}
	
	err = appManager.Run()
	if err != nil {
		log.Fatal(err)
	}
}
