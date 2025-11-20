dev:
	wails3 dev

package:
	wails3 package

package-mac-arm64:
	wails3 task darwin:package ARCH=arm64

package-mac-amd64:
	wails3 task darwin:package ARCH=amd64

package-mac-universal:
	wails3 task darwin:package:universal