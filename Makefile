# Thin wrappers around the Wails Taskfiles (see Taskfile.yml and build/).
APP_NAME = DataCia
VERSION := $(shell sed -n 's/^  version: "\([^"]*\)".*/\1/p' build/config.yml)

.PHONY: dev build test package-darwin package-darwin-universal dmg \
	package-windows package-windows-amd64 package-windows-arm64 \
	update-build-assets version clean

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

# Windows: per-user NSIS installer with amd64 + arm64 binaries
package-windows:
	wails3 task windows:package ARCH=universal

package-windows-amd64:
	wails3 task windows:package ARCH=amd64

package-windows-arm64:
	wails3 task windows:package ARCH=arm64

# Regenerate Info.plist, NSIS metadata, etc. after editing build/config.yml
update-build-assets:
	wails3 task common:update:build-assets

version:
	@echo "$(VERSION)"

clean:
	rm -rf bin frontend/dist
