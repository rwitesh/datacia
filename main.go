package main

import (
	"embed"
	"layerbit/pkg/clickhouse"
	"layerbit/pkg/runtime"
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

	rt, err := runtime.New()
	if err != nil {
		log.Fatal(err)
	}

	chService := clickhouse.New(app)

	app.RegisterService(application.NewService(rt))
	app.RegisterService(application.NewService(chService))

	rt.OpenWindow("main", "LayerBit", "/", 1024, 768)

	go func() {
		for {
			now := time.Now().Format(time.RFC1123)
			app.Event.Emit("time", now)
			time.Sleep(time.Second)
		}
	}()

	err = app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
