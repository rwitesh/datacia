APP_NAME = DataCia
OUTPUT_DIR = output
APP_BUNDLE = bin/$(APP_NAME).app

VOLNAME = $(APP_NAME)

ensure-output:
	mkdir -p $(OUTPUT_DIR)

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

create-dmg:
	@if [ ! -d "$(APP_BUNDLE)" ]; then \
		echo "Error: $(APP_BUNDLE) missing. Packaging failed."; \
		exit 1; \
	fi
	hdiutil create -volname "$(VOLNAME)" \
		-srcfolder "$(APP_BUNDLE)" \
		-ov -format UDZO \
		"$(OUTPUT_DIR)/$(DMG_NAME)"
	@echo "DMG created at $(OUTPUT_DIR)/$(DMG_NAME)"

dmg: package ensure-output
	$(MAKE) create-dmg DMG_NAME=$(APP_NAME).dmg

dmg-arm64: package-mac-arm64 ensure-output
	$(MAKE) create-dmg DMG_NAME=$(APP_NAME)_arm64.dmg

dmg-amd64: package-mac-amd64 ensure-output
	$(MAKE) create-dmg DMG_NAME=$(APP_NAME)_amd64.dmg

dmg-universal: package-mac-universal ensure-output
	$(MAKE) create-dmg DMG_NAME=$(APP_NAME)_universal.dmg
