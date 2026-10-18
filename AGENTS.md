# AGENTS.md

Instructions for AI coding agents working in this repository. Read this before changing code.
User-facing docs are in [README.md](README.md); build, test and release details are in
[DEVELOPMENT.md](DEVELOPMENT.md).

## What this is

DataCia is a desktop SQL client (PostgreSQL, MySQL, SQLite, ClickHouse) built with **Wails v3
(beta.30)**: a Go backend (`go.mod`, module `datacia`) and a React 19 + Vite + TypeScript frontend
in `frontend/`. The frontend calls Go through generated bindings and listens to Go events. There
is no HTTP API and no server.

## Layout

| Path | What lives there |
| --- | --- |
| `main.go` | Entry point: updater helper mode, Sentry, logger, then `internal/app` |
| `internal/app/app.go` | Window management (connection, editor, settings windows) and service registration. Every service exposed to the UI is registered in `Initialize()` |
| `pkg/remote/` | `Engine`: the main UI-facing service (connections, queries, history, file pickers, window/update actions). `interface.go` defines `DatabaseClient`, which each engine implements |
| `pkg/postgres`, `pkg/mysql`, `pkg/sqlite`, `pkg/clickhouse` | One `DatabaseClient` per database. Engine selection is `getDBClient` in `pkg/remote/engine.go` |
| `pkg/common/` | Shared types (`QueryResult`, `ConnectionInfo`, `ConnectionState`), `QUERY_TIMEOUT`, identifier quoting (`identifier.go`), read-only SQL check (`readonly.go`), `SecureString` |
| `pkg/ssh/` | SSH tunnels (password or key) |
| `internal/db/` | Local SQLite store: saved connections (passwords encrypted) and query history. Schema is in `initSchema` |
| `internal/security/` | Machine-bound key derivation and AES encryption (`EncryptString`/`DecryptString`) |
| `internal/settings/` | `settings.json` load/save, defaults, encrypted AI keys, `app:settings-changed` event |
| `internal/ai/` | AI chat on `github.com/zendev-sh/goai`: providers, model lists, streaming, read-only DB tools, chat persistence |
| `internal/queries/` | Saved-query files on disk (tree, rename, move); `resolvePath` keeps paths inside the queries dir |
| `internal/intellisense/` | Ghost-text suggestions from query history |
| `internal/files`, `internal/clipboard` | Export to file, clipboard |
| `internal/update/` | Wails updater setup (GitHub releases, `SHA256SUMS` required) |
| `internal/sentry`, `internal/logger` | Error reporting and structured logging (stderr in `dev`) |
| `internal/paths`, `internal/constants` | XDG data/config paths; app and window constants |
| `frontend/bindings/` | **Generated** by `wails3 generate bindings -ts -clean=true`. Never edit by hand |
| `frontend/src/services/bindings/` | The only place that imports generated bindings; wraps them with small adapters (e.g. `RunQuery` adds query type and ID) |
| `frontend/src/services/*.ts` | TanStack Query hooks (`useQuery`/`useMutation`) and event subscriptions over the bindings |
| `frontend/src/context/` | `app` (connection state) and `editor` (tabs, running queries) React contexts |
| `frontend/src/windows/` | One folder per window/route: `connection/`, `editor/`, `settings/` (routes in `src/App.tsx`, `HashRouter`) |
| `frontend/src/shared/` | UI shared across windows (navigation bar, status bar, `shared/utils/engines.ts` engine metadata) |
| `frontend/src/components/ui/` | Vendored shadcn/ui components (`components.json`). Change sparingly |
| `frontend/src/lib/utils.ts` | `cn()` and `errorMessage()` |
| `build/`, `Taskfile.yml`, `Makefile` | Wails Taskfiles and packaging. `make` wraps `wails3` |
| `.github/workflows/` | `ci.yml` (checks) and `release.yml` (tag-driven releases) |

## Where to look first

- **New or changed backend call used by the UI:** the Go service method (`pkg/remote/engine.go`
  or the relevant `internal/<service>`), then regenerate bindings, then the wrapper in
  `frontend/src/services/bindings/`, then the hook in `frontend/src/services/`.
- **Engine-specific behavior:** `pkg/<engine>/<engine>.go`. A change to `DatabaseClient` must be
  made in all four engines.
- **Something that differs per engine in the UI** (port, icon, formatter, dialect):
  `frontend/src/shared/utils/engines.ts`.
- **Settings:** `internal/settings/types.go` (shape), `defaults.go`, `service.go`; UI in
  `frontend/src/windows/settings/` and `frontend/src/services/settings.ts`.
- **AI chat:** `internal/ai/` (backend), `frontend/src/services/ai.ts`,
  `frontend/src/windows/editor/DataView/ai/`.
- **Results grid:** `frontend/src/windows/editor/QueryResult/DataTable/` (hooks, utils, components
  are already split there; extend them rather than adding parallel ones).
- **Go → UI events:** `connection-changed` (`pkg/remote`), `app:settings-changed`
  (`internal/settings`), `ai:delta` / `ai:tool` (`internal/ai`, registered with
  `application.RegisterEvent`). Grep both sides before renaming one.

## Reuse before writing

- SQL identifiers: `common.QuoteIdentifier` / `ValidateIdentifier`. Never build identifiers by
  string concatenation.
- Read-only SQL (AI tools): `common.CheckReadOnly` plus each engine's `ReadOnlyQuery`, which also
  enforces read-only at the database. Both layers are intentional.
- Timeouts: `common.QUERY_TIMEOUT`, `common.NewTimeoutContext`.
- Encryption: `internal/security` (`EncryptString`/`DecryptString`, or the store's
  `encryptField`/`decryptField`). Do not add another scheme. The key comes only from
  `deriveEncryptionKey`, pinned by a test.
- File locations: `internal/paths` (and `xdg` as used there). Do not hard-code paths.
- Logging: `internal/logger` (`logger.Error("message", "key", value, ...)`).
- Frontend: `cn()` for class names, `errorMessage()` for unknown errors, `sonner` `toast` for user
  feedback, TanStack Query for any backend data, existing shadcn components in
  `components/ui/` before adding new ones, `lucide-react` for icons.
- Frontend `detectQueryType` (`services/bindings/utils.ts`) only routes a query to the read or
  command path. It is not a safety check; don't merge it with `CheckReadOnly`.
- Mutations shared across tabs or rows (one `useMutation` used for many calls): use
  `mutateAsync` per call. TanStack Query only runs the `onSuccess`/`onError` passed to the latest
  `mutate()`, so earlier calls' callbacks are silently dropped. Editor table loads go through
  `loadTableData` in the editor context.
- Editor statements (`RunQuery`) run one at a time on each engine's session connection, so
  `BEGIN`, `USE`, `SET` and temp tables carry over between runs (not ClickHouse, which has no
  pinned connection). Metadata, table data and AI queries use the pool and don't see the
  session's uncommitted work.
- Query cancellation: `common.ConnectionState.CancelQuery` (promoted into each engine). Each
  engine stops the statement on the server and keeps the session: Postgres sends a cancel request
  (`cancelOnServer`), MySQL and ClickHouse run `KILL QUERY`, SQLite interrupts.

## Coding principles

1. **Simplicity over abstraction.** Write the simplest code that is correct. No new layers,
   wrappers, interfaces, hooks, contexts or config unless they remove real duplication or
   complexity. An interface with one implementation needs a reason (tests, or a real boundary
   like `DatabaseClient`).
2. **Clear names.** Names say what a thing is or does. No vague names (`data2`, `handleStuff`,
   `utils2`), no unexplained abbreviations, no redundant prefixes/suffixes. Use the language's
   conventions: Go `MixedCaps` (exported) / `mixedCaps`; TypeScript `camelCase` values, `PascalCase`
   components and types, `useX` hooks. Never kebab-case identifiers. Filenames: follow the folder
   you are in (PascalCase component files, camelCase hook/util files; kebab-case only in the
   shadcn `components/ui/` folder; lowercase Go files).
3. **Sensible function boundaries.** Extract a function when it names a real concept, removes
   duplication, isolates something tricky, or makes it testable. Don't shred straightforward
   logic into tiny helpers, and don't let a function grow past what one reader can follow.
4. **Few, useful comments.** Explain why: constraints, edge cases, security reasons, trade-offs
   (see `pkg/common/readonly.go` for the intended tone). Don't narrate code, don't add banners or
   section headers. Go doc comments start with the identifier name. Use `//` for single lines and
   `/* ... */` for longer TS blocks where it reads better.
5. **No unnecessary code.** Check for an existing implementation first. Remove dead code, unused
   imports, stale compatibility branches and redundant state you touch. No new dependency when
   the standard library, an existing dependency, or a few lines of code will do.
6. **Consistency.** Follow the patterns above. Keep data flowing UI → `services/` hooks →
   `services/bindings/` → Go service → `pkg/<engine>`. No hidden side effects, no circular
   imports, keep state as local as possible (component state before context).
7. **Correctness before cleanup.** Preserve behavior unless the change is the point. Check
   references (Go *and* generated bindings *and* frontend call sites) before removing or renaming
   anything. Don't rewrite working code just because it is unfamiliar.
8. **Current APIs, no churn.** Use APIs of the installed versions (React 19, TanStack Query 5,
   react-router 8, Tailwind 4, Wails v3 beta.30, Go per `go.mod`). Don't upgrade packages or
   migrate libraries unless that is the task.
9. **Verify honestly.** Run the checks below. Never claim a check passed unless you ran it.

## Areas that need extra care

- **Generated bindings.** After changing any exported method or model of a registered service
  (anything reachable from `RegisterService` in `internal/app/app.go`), run
  `wails3 generate bindings -ts -clean=true` and commit `frontend/bindings/`. CI fails if they
  are stale. Renaming or removing an exported Go method is a breaking change to the UI.
- **Encryption and stored data.** Saved connection passwords and AI keys are encrypted with a key
  derived from the device ID and `constants.AppSalt`. Changing the salt, KDF or cipher makes every
  existing user's saved credentials unreadable. The local `data.db` schema has no migration
  system (`CREATE TABLE IF NOT EXISTS` only): adding or changing a column needs explicit
  `ALTER TABLE` handling for existing databases. `settings.json` and `chat.json` must keep loading
  older files (see `fillAIDefaults`).
- **Secrets and privacy.** Never log or report passwords, API keys, query text or results; Sentry
  must never receive them. What the AI provider receives is documented in README "Privacy": keep
  that section accurate when changing `internal/ai` (the `run_query` tool sends rows of the
  read-only queries it runs, capped by the constants in `internal/ai/tools.go`).
- **SQL safety.** Keep identifier quoting and the read-only path (check + read-only transaction or
  engine setting) intact in all four engines.
- **Window lifecycle and concurrency.** In Wails, `Close()` only queues `WindowClosing`; the
  hooks run later on another goroutine. So `internal/app/app.go` clears a window's field (under
  `windowMutex`) before closing it itself, and each hook ignores a window that is no longer
  current. `closingIntentional` is only for quitting into an update. Wails also runs bound
  methods concurrently: `remote.Engine` guards `activeClient`/`sshTunnel` with `mu` (read them
  through `client()`), connects a new client before closing the old one, and never lets a test
  connection touch the active one. Engines guard their own state with mutexes. Keep these
  patterns.
- **Auto-update and versioning.** The version comes from the git tag (`main.version`, ldflags).
  The updater depends on release asset names and `SHA256SUMS` (`internal/update`,
  `.github/workflows/release.yml`). Windows installs per user in `%LOCALAPPDATA%\DataCia`.
- **Cross-platform.** CI cross-compiles for Windows with `CGO_ENABLED=0`; don't add cgo-only
  dependencies. Platform code uses build tags (`internal/update/bundle_*.go`).
- **Vendored UI.** `frontend/src/components/ui/` is shadcn output; prefer composing over editing.

## Checks

From the repo root:

```bash
make test                               # go test ./internal/... ./pkg/... + frontend typecheck + lint
go vet ./...                            # needs frontend/dist to exist (see below)
cd frontend && npm run typecheck        # tsc -b over src and bindings
cd frontend && npm run lint             # ESLint incl. React Compiler rules
cd frontend && npm run build            # production bundle
wails3 generate bindings -ts -clean=true  # after any service signature/model change
```

- `go build`/`go vet`/`go test ./...` on the root package need `frontend/dist` (embedded). Build
  the frontend first, or for checks only: `mkdir -p frontend/dist && touch frontend/dist/.keep`
  (what CI does).
- Format Go with `gofmt`. There is no frontend formatter configured: match the surrounding file's
  style (2-space indent and double quotes are the most common).
- Go tests are plain `testing`, mostly table-driven, next to the code (`*_test.go`). Add one when
  you change logic in `pkg/common`, `internal/ai`, `internal/settings`, `internal/update`,
  `internal/intellisense` or engine query handling. There is no frontend test runner; verify UI
  changes with typecheck, lint and, when possible, by running the app (`make dev`).

## Workflow for AI sessions

1. Read this file (and any closer `AGENTS.md`) before modifying code.
2. Read the relevant implementation and its callers on both sides of the bindings.
3. Understand the problem and the existing behavior before proposing a fix.
4. Make small, focused changes; no drive-by rewrites or unrelated reformatting.
5. Reuse or simplify existing code before adding new code.
6. Run the relevant checks above; regenerate bindings if a service changed.
7. Review your own diff for unnecessary complexity, unrelated changes, leftover debug code and
   regressions.
8. Report what changed, why, which checks ran (with results), and what is still unverified.

Commit messages in this repo are short imperative sentences describing the user-visible change
(e.g. "Let the AI chat query data through read-only tools").
