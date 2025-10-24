package main

import (
	"embed"
	"layerbits/internal/constants"
	"layerbits/internal/db"
	"layerbits/pkg/clickhouse"
	"layerbits/pkg/postgres"
	"layerbits/pkg/remote"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {

	app := application.New(application.Options{
		Name:        "LayerBits",
		Description: "",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})

	db := db.Open("layerbits")

	chService := clickhouse.New()
	postgresService := postgres.New()

	e, err := remote.New(app, db, chService, postgresService)
	if err != nil {
		log.Fatal(err)
	}

	app.RegisterService(application.NewService(e))
	app.RegisterService(application.NewService(chService))

	e.App.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:  "connection",
		Title: "LayerBits",
		URL:   "/",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour:    application.NewRGB(27, 38, 54),
		Width:               constants.CONNECTION_WINDOW_WIDTH,
		Height:              constants.CONNECTION_WINDOW_HEIGHT,
		DisableResize:       true,
		MaximiseButtonState: application.ButtonHidden,
	})

	e.App.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:  "editor",
		Title: "LayerBits",
		URL:   "#/editor",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		Width:            constants.EDITOR_WINDOW_WIDTH,
		Height:           constants.EDITOR_WINDOW_HEIGHT,
		Hidden:           true,
	})

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
