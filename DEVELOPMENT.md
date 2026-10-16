# Developing DataCia

DataCia is a [Wails v3](https://v3.wails.io) app: a Go backend with a React + Vite frontend.

## Prerequisites

- Go (the version in `go.mod`)
- Node.js 24 and npm
- Wails 3 CLI, the same version as in `go.mod`. Make sure `$(go env GOPATH)/bin` is on your `PATH`:

  ```bash
  go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-beta.30
  wails3 version   # v3.0.0-beta.30
  ```

- macOS: Xcode command-line tools (`xcode-select --install`) for `lipo`, `codesign` and `hdiutil`
- Windows installers only: [NSIS](https://nsis.sourceforge.io) (`brew install nsis` / `apt install nsis`)

`make` is a thin wrapper around the Wails Taskfiles; every target below can also be run as the
`wails3 …` command shown in the [Makefile](Makefile) (useful on Windows without `make`).

## Running in development

```bash
make dev        # = wails3 dev
```

The first run installs frontend dependencies (`npm ci`), then:

1. builds a development binary with `wails3 build DEV=true` (frontend bindings are regenerated),
2. starts the Vite dev server on port 9245 (override with `WAILS_VITE_PORT`),
3. launches the app (on macOS as `bin/DataCia.dev.app`).

Frontend edits hot-reload in the running window. Go edits rebuild and restart the app.
Stop with `Ctrl+C`.

To run a production build instead:

```bash
make package-darwin && open bin/DataCia.app      # macOS app bundle
make build                                        # bare binary: bin/DataCia (bin/DataCia.exe on Windows)
```

## Testing

```bash
make test       # = wails3 task test
```

This runs, stopping at the first failure:

- `go test ./internal/... ./pkg/...` – Go unit tests
- `npm run typecheck` – `tsc -b` over `frontend/src` and the generated bindings
- `npm run lint` – ESLint (React Compiler rules from `eslint-plugin-react-hooks` included)

Individual checks:

```bash
go test ./internal/update/            # one Go package
cd frontend && npm run typecheck      # frontend types only
cd frontend && npm run build          # production frontend bundle
```

[CI](.github/workflows/ci.yml) runs on every push to `main` and every pull request:

- frontend: `npm ci`, `typecheck`, `lint`, `build`
- Go (macOS runner): `go vet ./...`, `go test ./...`, and a Windows cross-compile
- bindings: fails if `frontend/bindings` differs from a fresh `wails3 generate bindings -ts -clean=true`
  (run that command and commit the result after changing any service method or model)

## Building and packaging

| Command | Output |
| --- | --- |
| `make build` | Production binary `bin/DataCia` for the host OS (`wails3 build DEV=true` for a debug build) |
| `make package-darwin` | `bin/DataCia.app` for the host architecture |
| `make package-darwin-universal` | Universal (arm64 + amd64) `bin/DataCia.app` |
| `make dmg` | Universal app in a styled `bin/DataCia.dmg` |
| `make package-windows` | `bin/DataCia-amd64_arm64-installer.exe` (cross-compiles from any OS) |
| `make package-windows-amd64` / `-arm64` | Single-architecture Windows installer |

The Windows build is pure Go (SQLite via `modernc.org/sqlite`), so it can be cross-compiled
from macOS or Linux without Docker. Windows installs per user into `%LOCALAPPDATA%\DataCia`,
which the auto-updater relies on.

### Versioning

The version comes from the git tag; it is not written anywhere in the code. Every build
resolves `VERSION` in this order:

1. `VERSION=x.y.z` passed to the build (`make dmg VERSION=2.0.0`); the release workflow passes the tag,
2. a `vX.Y.Z` tag on the checked-out commit,
3. otherwise `dev`.

It is injected into the Go binary (`-ldflags -X main.version=…`), and `Info.plist`, the Windows
version info and the NSIS metadata are generated from it and from `info` in `build/config.yml`
at build time (`common:generate:assets`; these files are not committed). `dev` builds never
auto-update.

## Releasing (uploading a new version)

Releases are GitHub Releases on [rwitesh/datacia](https://github.com/rwitesh/datacia/releases).
Installed apps poll `https://api.github.com/repos/rwitesh/datacia/releases/latest`, download the
asset ending in `.dmg` (macOS) or `-installer.exe` (Windows), and install it once the user restarts.
The repository must be public for that endpoint to work.

1. Run `make test`, then merge to `main`.
2. Tag the commit with the new version (higher than the latest release) and push the tag:

   ```bash
   git tag v2.0.0
   git push origin v2.0.0
   ```

3. The [Release workflow](.github/workflows/release.yml) reads the version from the tag, builds
   `DataCia-<version>-darwin-universal.dmg` on macOS and
   `DataCia-<version>-windows-universal-installer.exe` on Linux, writes a `SHA256SUMS` file,
   and publishes all three to a new GitHub Release with generated notes. Follow it under the
   repository's **Actions** tab.

The updater refuses to install a download whose SHA-256 does not match the release's
`SHA256SUMS`, so a release without that file cannot be installed automatically.

To upload a build by hand instead (for example, if the workflow is unavailable), keep the same
asset names and include the checksums:

```bash
make dmg package-windows VERSION=2.0.0
mkdir -p release
mv bin/DataCia.dmg release/DataCia-2.0.0-darwin-universal.dmg
mv bin/DataCia-amd64_arm64-installer.exe release/DataCia-2.0.0-windows-universal-installer.exe
(cd release && shasum -a 256 -- * > SHA256SUMS)
gh release create v2.0.0 release/* --title "DataCia v2.0.0" --generate-notes
```

macOS builds are ad-hoc signed only, so Gatekeeper blocks the first launch; allow it under
System Settings → Privacy & Security → Open Anyway. Developer ID
signing and notarization can be added with `wails3 setup` and `wails3 task darwin:sign:notarize`.

## Troubleshooting

- `wails3: command not found`: add `$(go env GOPATH)/bin` to `PATH`.
- `Port 9245 is in use`: another dev server is running; stop it or set `WAILS_VITE_PORT`.
- `pattern all:frontend/dist: no matching files found` from `go build`/`go vet`: build the
  frontend first (`cd frontend && npm run build`) or use `make build`.
- npm `EACCES` errors on the cache: fix ownership of `~/.npm` as npm suggests, or set
  `npm_config_cache` to a writable directory.
- `makensis` fails with "Bad text encoding" or crashes with `bad_alloc` on macOS: run it with a
  UTF-8 locale, e.g. `export LANG=en_US.UTF-8`.
- `make dmg` arranges the DMG window through Finder; the first run asks to let your terminal
  control Finder. Allow it (System Settings → Privacy & Security → Automation).

## Project layout

- `main.go`, `internal/` – application wiring, services exposed to the UI, settings,
  auto-updater
- `pkg/` – database engines (PostgreSQL, MySQL, SQLite, ClickHouse) and SSH tunnelling
- `frontend/` – React + Vite UI; `frontend/bindings/` is generated by `wails3 generate bindings`
- `build/` – Wails Taskfiles and platform packaging assets
