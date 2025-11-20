# DataCia

## Prerequisites

* Go installed and configured
* Wails 3 CLI installed (`wails3`)
* Xcode command-line tools installed (required for `hdiutil` and macOS app bundling)


## Usage

### Run the dev environment

```
make dev
```

This runs `wails3 dev`.

### Package the app (default architecture)

```
make package
```

Outputs the bundle to `bin/DataCia.app`.

### Package for macOS ARM64

```
make package-mac-arm64
```

### Package for macOS AMD64 (Intel)

```
make package-mac-amd64
```

### Package a universal binary

```
make package-mac-universal
```

---

## Creating DMG Installers

All DMG outputs are written to the `output/` directory.

### Default DMG

```
make dmg
```

Produces `DataCia.dmg`.

### ARM64 DMG

```
make dmg-arm64
```

Produces `DataCia_arm64.dmg`.

### AMD64 DMG

```
make dmg-amd64
```

Produces `DataCia_amd64.dmg`.

### Universal DMG

```
make dmg-universal
```

Produces `DataCia_universal.dmg`.

---

## Notes

* Each DMG target first ensures the app is packaged for the correct architecture.
* The Makefile prevents DMG creation if the app bundle doesn't exist.
* `hdiutil` is used to generate compressed DMG images (`UDZO` format).

---

## Troubleshooting

If the DMG task reports missing `.app` bundle, run the appropriate `package-*` command manually and try again.

If `hdiutil` fails, verify permissions and available disk space.
