# Thin wrappers around the Wails Taskfiles (see Taskfile.yml and build/).
# Release builds take the version from the git tag on HEAD, or from VERSION=x.y.z
# (e.g. `make dmg VERSION=2.0.0`); anything else builds as "dev".
export VERSION

.PHONY: dev build test package-darwin package-darwin-universal dmg release-darwin \
	package-windows package-windows-amd64 package-windows-arm64 clean

dev:
	wails3 dev

build:
	wails3 build

test:
	wails3 task test

# macOS: bin/DataCia.app for the host architecture
package-darwin:
	wails3 task darwin:package

# macOS: universal (arm64 + amd64) bin/DataCia.app
package-darwin-universal:
	wails3 task darwin:package:universal

# macOS: universal app wrapped in a styled bin/DataCia.dmg
dmg:
	wails3 task darwin:package:dmg

# macOS release assets: bin/DataCia.dmg plus bin/DataCia.zip for the in-app updater
# (ARCH=universal | arm64 | amd64; default universal)
release-darwin:
	wails3 task darwin:package:release ARCH=$(or $(ARCH),universal)

# Windows: per-user NSIS installer with amd64 + arm64 binaries
package-windows:
	wails3 task windows:package ARCH=universal

package-windows-amd64:
	wails3 task windows:package ARCH=amd64

package-windows-arm64:
	wails3 task windows:package ARCH=arm64

clean:
	rm -rf bin frontend/dist
