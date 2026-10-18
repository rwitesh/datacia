# Developing DataCia

DataCia is a [Wails v3](https://v3.wails.io) app: a Go backend and a React + Vite frontend in
`frontend/`. Code layout and conventions are in [AGENTS.md](AGENTS.md).

## Prerequisites

- Go (version in `go.mod`) and Node.js 24
- Wails CLI matching `go.mod`, with `$(go env GOPATH)/bin` on your `PATH`:

  ```bash
  go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-beta.30
  ```

- macOS: Xcode command-line tools (`xcode-select --install`)
- Windows installers: [NSIS](https://nsis.sourceforge.io) (`brew install nsis` / `apt install nsis`)

`make` wraps the Wails Taskfiles; the [Makefile](Makefile) shows the `wails3` command behind each
target (useful on Windows without `make`).

## Run

```bash
make dev
```

Installs frontend dependencies, builds a dev binary (regenerating bindings), starts Vite on port
9245 (`WAILS_VITE_PORT` to change it) and launches the app. Frontend edits hot-reload; Go edits
rebuild and restart the app.

## Test

```bash
make test       # go test ./internal/... ./pkg/..., then frontend typecheck and lint
```

Other checks:

```bash
cd frontend && npm run build                  # production bundle
gofmt -l $(git ls-files '*.go')               # must print nothing
wails3 generate bindings -ts -clean=true      # after changing a service method or model
```

`go build`, `go vet` and `go test ./...` on the root package embed `frontend/dist`. Build the
frontend first, or stub it: `mkdir -p frontend/dist && touch frontend/dist/.keep`.

Postgres and MySQL tests skip without a server. To run them against throwaway containers:

```bash
docker run -d --rm --name datacia-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:17-alpine
docker run -d --rm --name datacia-mysql -e MYSQL_ROOT_PASSWORD=test -e MYSQL_DATABASE=test -p 127.0.0.1:53306:3306 mysql:8.0
DATACIA_TEST_POSTGRES=postgres://postgres:test@127.0.0.1:55432/postgres \
DATACIA_TEST_MYSQL=mysql://root:test@127.0.0.1:53306/test go test ./pkg/postgres ./pkg/mysql
```

[CI](.github/workflows/ci.yml) runs on pushes to `main` and on pull requests: frontend typecheck,
lint and build; `gofmt`, `go vet`, `go test` and a Windows cross-compile; and a check that
`frontend/bindings` matches a fresh generation.

## Build

| Command | Output |
| --- | --- |
| `make build` | `bin/DataCia` (`.exe` on Windows) for the host OS |
| `make package-darwin` | `bin/DataCia.app` for the host architecture |
| `make package-darwin-universal` | Universal (arm64 + amd64) `bin/DataCia.app` |
| `make dmg` | Universal app in a styled `bin/DataCia.dmg` |
| `make release-darwin` | `bin/DataCia.dmg` plus `bin/DataCia.zip` (for in-app updates) |
| `make package-windows` | `bin/DataCia-amd64_arm64-installer.exe`, `bin/DataCia-amd64.exe`, `bin/DataCia-arm64.exe` |
| `make package-windows-amd64` / `-arm64` | Single-architecture Windows installer |

Windows builds are pure Go (SQLite via `modernc.org/sqlite`) and cross-compile from any OS.
Windows installs per user into `%LOCALAPPDATA%\DataCia`, which the updater relies on.

**Version.** Taken from `VERSION=x.y.z` if passed, else a `vX.Y.Z` tag on `HEAD`, else `dev`. It
is injected with `-ldflags -X main.version=…`, and the platform metadata (Info.plist, Windows
version info, NSIS) is generated from it at build time and not committed. `dev` builds never
auto-update and never send error reports.

**Error reporting.** Release builds send crashes, errors and logs to Sentry (DSN in
`internal/sentry/sentry.go`; send-only, rate-limited). Users can turn it off in
**Settings → Privacy**. `dev` builds log to stderr.

## Release

Releases are GitHub Releases on [rwitesh/datacia](https://github.com/rwitesh/datacia/releases);
the in-app updater reads the latest one, so the repository must stay public.

1. Run `make test` and merge to `main`.
2. Tag a version higher than the latest release and push it:

   ```bash
   git tag v2.0.0 && git push origin v2.0.0
   ```

The [Release workflow](.github/workflows/release.yml) builds macOS assets on macOS and Windows
assets on Linux, writes `SHA256SUMS` and publishes the release. Tags with a suffix
(`v2.1.0-rc.1`) become pre-releases and never "latest".

| Asset (`<v>` = tag without `v`) | Used for |
| --- | --- |
| `DataCia-<v>-darwin-universal.dmg` | First install on macOS |
| `DataCia-<v>-windows-universal-installer.exe` | First install on Windows |
| `DataCia-<v>-darwin-universal.zip` | macOS update: replaces `DataCia.app` |
| `DataCia-<v>-windows-amd64.exe`, `-arm64.exe` | Windows update: replaces `DataCia.exe` |
| `SHA256SUMS` | Checked by the updater; a file missing from it is never installed |

Release builds check for updates about 5 seconds after launch, download in the background and
show a **Restart** prompt in the status bar. On macOS, updates are skipped when the app runs from
a read-only location such as the mounted DMG.

To publish by hand (needs a Mac for the macOS assets):

```bash
make release-darwin package-windows VERSION=2.0.0
mkdir -p release
mv bin/DataCia.dmg release/DataCia-2.0.0-darwin-universal.dmg
mv bin/DataCia.zip release/DataCia-2.0.0-darwin-universal.zip
mv bin/DataCia-amd64_arm64-installer.exe release/DataCia-2.0.0-windows-universal-installer.exe
mv bin/DataCia-amd64.exe release/DataCia-2.0.0-windows-amd64.exe
mv bin/DataCia-arm64.exe release/DataCia-2.0.0-windows-arm64.exe
(cd release && shasum -a 256 -- * > SHA256SUMS)
gh release create v2.0.0 release/* --title "DataCia v2.0.0" --generate-notes   # add --prerelease for rc tags
```

macOS builds are ad-hoc signed, so the first launch needs System Settings → Privacy & Security →
Open Anyway. Developer ID signing and notarization: `wails3 setup`, then
`wails3 task darwin:sign:notarize`.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `wails3: command not found` | Add `$(go env GOPATH)/bin` to `PATH` |
| `Port 9245 is in use` | Stop the other dev server or set `WAILS_VITE_PORT` |
| `pattern all:frontend/dist: no matching files found` | Build the frontend or stub `frontend/dist` (see [Test](#test)) |
| npm `EACCES` on the cache | Fix ownership of `~/.npm`, or set `npm_config_cache` |
| `makensis` "Bad text encoding" or `bad_alloc` on macOS | Use a UTF-8 locale: `export LANG=en_US.UTF-8` |
| `make dmg` asks to control Finder | Allow it under System Settings → Privacy & Security → Automation |
