#!/usr/bin/env bash
# Create a DMG with a polished layout: app icon + Applications symlink,
# icon view with set positions and a "Drag to Applications" background.
#
# Usage: create-dmg-with-layout.sh <app_bundle> <output_dmg> <volname> <app_name> [background.png]

set -euo pipefail

APP_BUNDLE="$1"
OUTPUT_DMG="$2"
VOLNAME="$3"
APP_NAME="$4"
BACKGROUND_IMG="${5:-}"

if [ -z "$APP_BUNDLE" ] || [ -z "$OUTPUT_DMG" ] || [ -z "$VOLNAME" ] || [ -z "$APP_NAME" ]; then
	echo "Usage: $0 <app_bundle> <output_dmg> <volname> <app_name> [background.png]" >&2
	exit 1
fi

if [ ! -d "$APP_BUNDLE" ]; then
	echo "Error: App bundle not found: $APP_BUNDLE" >&2
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

DMG_TMP="${TMPDIR:-/tmp}/createdmg.$$.dmg"
DEVICE=""

cleanup() {
	if [ -n "$DEVICE" ]; then
		hdiutil detach "$DEVICE" -quiet 2>/dev/null || true
	fi
	rm -f "$DMG_TMP"
}
trap cleanup EXIT

# ── Eject any stale mounts with this volume name ──────────────────────────────
# If a previous run crashed, macOS keeps the volume mounted and appends " 1",
# " 2" etc. to the next mount — which causes read-only behaviour. Eject all.
echo "Ejecting any stale '$VOLNAME' mounts…"
while IFS= read -r stale; do
	echo "  Detaching stale: $stale"
	hdiutil detach "$stale" -quiet 2>/dev/null || true
done < <(hdiutil info | awk -v vol="$VOLNAME" '
	/image-path/ { dmg=$0 }
	/\/Volumes\// {
		path = $0
		gsub(/^[[:space:]]+/, "", path)
		# match /Volumes/VolName or /Volumes/VolName 1  /Volumes/VolName 2 etc.
		if (path ~ "^/Volumes/" vol "( [0-9]+)?$") {
			# get the /dev entry from the previous dev line
			print dev
		}
	}
	/\/dev\// { dev = $1 }
')

# ── Calculate required size ───────────────────────────────────────────────────
APP_SIZE_MB="$(du -sm "$APP_BUNDLE" | cut -f1)"
SIZE_MB=$((APP_SIZE_MB + 30))

# ── Create a BLANK writable HFS+ DMG ─────────────────────────────────────────
echo "Creating blank read-write DMG (${SIZE_MB} MB)…"
hdiutil create \
	-megabytes "$SIZE_MB" \
	-volname "$VOLNAME" \
	-fs HFS+ \
	"$DMG_TMP"

# ── Mount and capture exact mount point from hdiutil output ──────────────────
echo "Mounting DMG…"
HDIUTIL_OUT="$(hdiutil attach -readwrite -noverify -noautoopen "$DMG_TMP")"

# Device: the /dev/diskNsM line that has Apple_HFS
DEVICE="$(echo "$HDIUTIL_OUT" | awk '/Apple_HFS/{print $1}' | head -1)"
if [ -z "$DEVICE" ]; then
	DEVICE="$(echo "$HDIUTIL_OUT" | grep '^/dev/' | tail -1 | awk '{print $1}')"
fi

# Mount root: read the actual path from hdiutil (handles " 1" suffix gracefully)
MOUNT_ROOT="$(echo "$HDIUTIL_OUT" | awk '/Apple_HFS/{for(i=3;i<=NF;i++) printf "%s%s",$i,(i<NF?" ":""); print ""}' | sed 's/^[[:space:]]*//')"
if [ -z "$MOUNT_ROOT" ]; then
	MOUNT_ROOT="/Volumes/$VOLNAME"
fi

if [ -z "$DEVICE" ]; then
	echo "Error: could not determine mount device." >&2
	echo "$HDIUTIL_OUT" >&2
	exit 1
fi

echo "Mounted $DEVICE → $MOUNT_ROOT"
sleep 1

# Verify writable
if ! touch "$MOUNT_ROOT/.writable_test" 2>/dev/null; then
	echo "Error: volume is read-only at $MOUNT_ROOT" >&2
	echo "hdiutil output:" >&2
	echo "$HDIUTIL_OUT" >&2
	exit 1
fi
rm -f "$MOUNT_ROOT/.writable_test"

# ── Copy .app into the volume ─────────────────────────────────────────────────
echo "Copying $APP_NAME.app…"
cp -R "$APP_BUNDLE" "$MOUNT_ROOT/$APP_NAME.app"

# ── Applications symlink ──────────────────────────────────────────────────────
ln -sf /Applications "$MOUNT_ROOT/Applications"

# ── Background image ──────────────────────────────────────────────────────────
BG_FILENAME=""
if [ -n "$BACKGROUND_IMG" ] && [ -f "$BACKGROUND_IMG" ]; then
	BG_FILENAME="$(basename "$BACKGROUND_IMG")"
	mkdir -p "$MOUNT_ROOT/.background"
	BG_DEST="$MOUNT_ROOT/.background/$BG_FILENAME"
	cp "$BACKGROUND_IMG" "$BG_DEST"
	sips -s dpiWidth 72 -s dpiHeight 72 "$BG_DEST" > /dev/null 2>&1 || true
	echo "Background installed: $BG_FILENAME"
fi

# ── AppleScript layout — two passes to reliably commit .DS_Store ──────────────
BG_LINE=""
if [ -n "$BG_FILENAME" ]; then
	BG_LINE="set background picture of viewOptions to file \".background:$BG_FILENAME\""
fi

run_layout_pass() {
	local delay_secs="$1"
osascript <<APPLESCRIPT
tell application "Finder"
	tell disk "$VOLNAME"
		open
		set current view of container window to icon view
		set toolbar visible of container window to false
		set statusbar visible of container window to false
		set the bounds of container window to {400, 100, 940, 400}
		set viewOptions to the icon view options of container window
		set arrangement of viewOptions to not arranged
		set icon size of viewOptions to 128
		set text size of viewOptions to 12
		$BG_LINE
		set position of item "$APP_NAME.app" of container window to {120, 150}
		set position of item "Applications" of container window to {420, 150}
		update without registering applications
		delay $delay_secs
		close
	end tell
end tell
APPLESCRIPT
}

echo "Applying Finder layout (pass 1)…"
run_layout_pass 1
sleep 1

echo "Applying Finder layout (pass 2)…"
run_layout_pass 3

sync
sleep 1

SetFile -a V "$MOUNT_ROOT/.DS_Store" 2>/dev/null || true

echo "Unmounting…"
hdiutil detach "$DEVICE" -quiet
DEVICE=""

echo "Compressing…"
mkdir -p "$(dirname "$OUTPUT_DMG")"
rm -f "$OUTPUT_DMG"
hdiutil convert "$DMG_TMP" -format UDZO -imagekey zlib-level=9 -o "$OUTPUT_DMG"

echo ""
echo "✅  DMG created: $OUTPUT_DMG"