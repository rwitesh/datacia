package appinfo

import (
	"runtime"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type Info struct {
	OS         string `json:"os"`
	OSVersion  string `json:"os_version"`
	Arch       string `json:"arch"`
	Appearance string `json:"appearance"`
	Version    string `json:"version"`
	mu         sync.RWMutex
}

var (
	globalInfo     *Info
	globalInfoOnce sync.Once
)

func Init(app *application.App) {
	var env = app.Env
	var appearance string
	if env.IsDarkMode() {
		appearance = "dark"
	} else {
		appearance = "light"
	}

	globalInfoOnce.Do(func() {
		info := &Info{
			OS:         env.Info().OS,
			Arch:       env.Info().Arch,
			Appearance: appearance,
			Version:    "unknown",
			OSVersion:  env.Info().OSInfo.Version,
		}
		globalInfo = info
	})
}

func SetVersion(version string) {
	if globalInfo == nil {
		return
	}
	globalInfo.mu.Lock()
	defer globalInfo.mu.Unlock()
	globalInfo.Version = version
}

func Get() *Info {
	if globalInfo == nil {
		return &Info{
			OS:         runtime.GOOS,
			Arch:       runtime.GOARCH,
			Appearance: "system",
			Version:    "unknown",
		}
	}
	globalInfo.mu.RLock()
	defer globalInfo.mu.RUnlock()
	return globalInfo
}

type Service struct {
	app *application.App
}

func NewService(app *application.App) *Service {
	return &Service{app: app}
}

func (s *Service) GetAppInfo() *Info {
	return Get()
}
