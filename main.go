package main

import (
	"embed"
	_ "embed"
	"layerbit/pkg"
	"layerbit/pkg/clickhouse"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := application.New(application.Options{
		Name:        "LayerBit",
		Description: "A demo of using raw HTML & CSS",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	myApp := pkg.NewApp()
	app.RegisterService(application.NewService(myApp))

	chService := clickhouse.New(app)
	app.RegisterService(application.NewService(chService))

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "LayerBit",
		URL:   "/",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		Width:            1024,
		Height:           768,
	})

	go func() {
		for {
			now := time.Now().Format(time.RFC1123)
			app.Event.Emit("time", now)
			time.Sleep(time.Second)
		}
	}()

	err := app.Run()

	if err != nil {
		log.Fatal(err)
	}
}
