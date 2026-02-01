APP_NAME = DataCia
BASE_OUTPUT = output
APP_BUNDLE = bin/$(APP_NAME).app

# Extract version from build/config.yml (info.version field)
VERSION := $(shell grep '  version:' build/config.yml | sed 's/.*"\([^"]*\)".*/\1/')

# Versioned output paths
VERSIONED_OUTPUT = $(BASE_OUTPUT)/V$(VERSION)

VOLNAME = $(APP_NAME)

.PHONY: build
build:
	wails3 task common:update:build-assets
	wails3 build

dev:
	wails3 dev

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

# Clean output before release
clean-output:
	rm -rf $(BASE_OUTPUT)

# Release targets (always versioned, always clean first)
release-darwin-arm64: OUTPUT_DIR = $(VERSIONED_OUTPUT)/darwin/arm64
release-darwin-arm64: DMG_NAME = $(APP_NAME)_darwin_arm64.dmg
release-darwin-arm64: clean-output package-darwin-arm64
	mkdir -p $(OUTPUT_DIR)
	$(MAKE) create-dmg OUTPUT_DIR=$(OUTPUT_DIR) DMG_NAME=$(DMG_NAME)

release-darwin-amd64: OUTPUT_DIR = $(VERSIONED_OUTPUT)/darwin/amd64
release-darwin-amd64: DMG_NAME = $(APP_NAME)_darwin_amd64.dmg
release-darwin-amd64: clean-output package-darwin-amd64
	mkdir -p $(OUTPUT_DIR)
	$(MAKE) create-dmg OUTPUT_DIR=$(OUTPUT_DIR) DMG_NAME=$(DMG_NAME)

release-darwin-universal: OUTPUT_DIR = $(VERSIONED_OUTPUT)/darwin/universal
release-darwin-universal: DMG_NAME = $(APP_NAME)_darwin_universal.dmg
release-darwin-universal: clean-output package-darwin-universal
	mkdir -p $(OUTPUT_DIR)
	$(MAKE) create-dmg OUTPUT_DIR=$(OUTPUT_DIR) DMG_NAME=$(DMG_NAME)

# Build all release targets
release-all: clean-output
	$(MAKE) package-darwin-arm64
	$(MAKE) create-dmg OUTPUT_DIR=$(VERSIONED_OUTPUT)/darwin/arm64 DMG_NAME=$(APP_NAME)_darwin_arm64.dmg
	$(MAKE) package-darwin-amd64
	$(MAKE) create-dmg OUTPUT_DIR=$(VERSIONED_OUTPUT)/darwin/amd64 DMG_NAME=$(APP_NAME)_darwin_amd64.dmg
	$(MAKE) package-darwin-universal
	$(MAKE) create-dmg OUTPUT_DIR=$(VERSIONED_OUTPUT)/darwin/universal DMG_NAME=$(APP_NAME)_darwin_universal.dmg

# Upload to Supabase storage
upload-supabase:
	@./scripts/upload-supabase.sh "$(VERSIONED_OUTPUT)"

# Show current version
show-version:
	@echo "Version: $(VERSION)"
	@echo "Output path: $(VERSIONED_OUTPUT)"
