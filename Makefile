APP_NAME = DataCia
BASE_OUTPUT = output
APP_BUNDLE = bin/$(APP_NAME).app

VOLNAME = $(APP_NAME)

ensure-output:
	mkdir -p $(OUTPUT_DIR)

.PHONY: build
build:
	wails3 task common:update:build-assets
	wails3 build

dev:
	wails3 dev

package:
	wails3 task common:update:build-assets
	wails3 package

package-darwin-arm64:
	wails3 task common:update:build-assets
	wails3 task darwin:package ARCH=arm64

package-darwin-amd64:
	wails3 task common:update:build-assets
	wails3 task darwin:package ARCH=amd64

package-darwin-universal:
	wails3 task common:update:build-assets
	wails3 task darwin:package:universal

create-dmg:
	@if [ ! -d "$(APP_BUNDLE)" ]; then \
		echo "Error: $(APP_BUNDLE) missing. Packaging failed."; \
		exit 1; \
	fi
	mkdir -p "$(OUTPUT_DIR)"
	hdiutil create -volname "$(VOLNAME)" \
		-srcfolder "$(APP_BUNDLE)" \
		-ov -format UDZO \
		"$(OUTPUT_DIR)/$(DMG_NAME)"
	@echo "DMG created at $(OUTPUT_DIR)/$(DMG_NAME)"
	open "$(OUTPUT_DIR)"

dmg-darwin-arm64: OUTPUT_DIR = $(BASE_OUTPUT)/darwin/arm64
dmg-darwin-arm64: DMG_NAME = $(APP_NAME)_darwin_arm64.dmg
dmg-darwin-arm64: package-darwin-arm64 ensure-output
	$(MAKE) create-dmg OUTPUT_DIR=$(OUTPUT_DIR) DMG_NAME=$(DMG_NAME)

dmg-darwin-amd64: OUTPUT_DIR = $(BASE_OUTPUT)/darwin/amd64
dmg-darwin-amd64: DMG_NAME = $(APP_NAME)_darwin_amd64.dmg
dmg-darwin-amd64: package-darwin-amd64 ensure-output
	$(MAKE) create-dmg OUTPUT_DIR=$(OUTPUT_DIR) DMG_NAME=$(DMG_NAME)

dmg-darwin-universal: OUTPUT_DIR = $(BASE_OUTPUT)/darwin/universal
dmg-darwin-universal: DMG_NAME = $(APP_NAME)_darwin_universal.dmg
dmg-darwin-universal: package-darwin-universal ensure-output
	$(MAKE) create-dmg OUTPUT_DIR=$(OUTPUT_DIR) DMG_NAME=$(DMG_NAME)
