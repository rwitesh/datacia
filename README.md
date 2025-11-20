## DataCia

### Prerequisites

Go must be installed and available in your shell.
Wails 3 CLI (`wails3`) must be installed and configured.
Xcode command-line tools are required for macOS bundling and `hdiutil`.

### Development

```
make dev
```

Starts the Wails development server and rebuild loop.

### Building

```
make build
```

Regenerates build assets and performs a non-packaged build.

### Packaging

```
make package
```

Generates `bin/DataCia.app` for the host architecture.

Packaging for specific macOS targets:

```
make package-mac-arm64
make package-mac-amd64
make package-mac-universal
```

These produce architecture-specific `.app` bundles using the corresponding Wails tasks.

### DMG Creation

All DMGs are written to `output/`.

DMG for host architecture:

```
make dmg
```

Architecture-specific DMGs:

```
make dmg-arm64
make dmg-amd64
make dmg-universal
```

These commands package the app for the correct architecture and then create a compressed (`UDZO`) DMG using `hdiutil`.

### Notes

Packaging targets update build assets before creating bundles.
DMG creation fails early if the expected `.app` bundle isn’t present.
`ensure-output` guarantees the output directory exists before writing images.

### Troubleshooting

If a DMG target exits with “missing bundle,” run the corresponding packaging command first and check that `bin/DataCia.app` exists.
If `hdiutil` errors out, confirm disk space, permissions, and that the output directory is writable.
