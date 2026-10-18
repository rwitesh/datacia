# AGENTS.md

Guide for AI agents changing this repository. User docs: [README.md](README.md). Build, test and
release: [DEVELOPMENT.md](DEVELOPMENT.md).

## What this is

DataCia is a desktop SQL client for PostgreSQL, MySQL, SQLite and ClickHouse, built with
**Wails v3 (beta.30)**: a Go backend (module `datacia`) and a React 19 + Vite + TypeScript
frontend in `frontend/`. The UI calls Go through generated bindings and listens to Go events.
There is no HTTP API.

Data flows UI → `frontend/src/services/` hooks → `services/bindings/` → Go service →
`pkg/<engine>`.

## Layout

| Path | Contents |
| --- | --- |
| `main.go` | Entry point: updater helper mode, Sentry, logger, then `internal/app` |
| `internal/app/app.go` | Windows (connection, editor, settings) and service registration in `Initialize()` |
| `pkg/remote/` | `Engine`, the main UI service (connections, queries, history, dialogs). `interface.go` defines `DatabaseClient`; engine choice is `getDBClient` |
| `pkg/postgres`, `mysql`, `sqlite`, `clickhouse` | One `DatabaseClient` each |
| `pkg/common/` | Shared types, timeouts, identifier quoting and `TableDataSQL`, `CheckReadOnly`, `SecureString` |
| `pkg/ssh/` | SSH tunnels |
| `internal/db/` | Local SQLite store: saved connections (encrypted passwords) and query history |
| `internal/security/` | Device-bound key derivation and AES encryption |
| `internal/settings/` | `settings.json`, defaults, encrypted AI keys |
| `internal/ai/` | AI chat on `zendev-sh/goai`: providers, streaming, read-only DB tools, `chat.json` |
| `internal/queries/` | Saved-query files on disk |
| `internal/intellisense/` | Ghost-text suggestions from history |
| `internal/files`, `clipboard`, `update`, `sentry`, `logger`, `paths`, `constants` | Export, clipboard, updater, error reporting, logging, XDG paths, constants |
| `frontend/bindings/` | **Generated.** Never edit |
| `frontend/src/services/bindings/` | The only importer of generated bindings; small adapters (e.g. `RunQuery` adds query type) |
| `frontend/src/services/*.ts` | TanStack Query hooks and event subscriptions |
| `frontend/src/context/` | `app` (connection) and `editor` (tabs, running queries) contexts |
| `frontend/src/windows/` | One folder per window: `connection/`, `editor/`, `settings/` |
| `frontend/src/shared/` | Cross-window UI; per-engine metadata in `shared/utils/engines.ts` |
| `frontend/src/components/ui/` | Vendored shadcn/ui; compose rather than edit |

Where to start:

- **New backend call for the UI:** Go method → regenerate bindings → `services/bindings/` → hook
  in `services/`.
- **`DatabaseClient` change:** all four engines.
- **Per-engine UI difference** (port, icon, dialect): `shared/utils/engines.ts`.
- **Results grid:** `windows/editor/QueryResult/DataTable/` (extend its hooks/utils/components).
- **Go → UI events:** `connection-changed`, `app:settings-changed`, `settings:show-tab`,
  `ai:delta`, `ai:tool`. Grep both sides before renaming one.

## Reuse before writing

- **SQL identifiers:** `common.QuoteIdentifier`; table pages: `common.TableDataSQL`. Never
  concatenate identifiers.
- **Read-only SQL** (AI tools): `common.CheckReadOnly` plus each engine's `ReadOnlyQuery`, which
  also enforces read-only on the server. Both layers are intentional. The frontend's
  `detectQueryType` only routes read vs. command; it is not a safety check.
- **Timeouts:** `common.QUERY_TIMEOUT`, `META_TIMEOUT`, `NewTimeoutContext`.
- **Encryption:** `internal/security` only. The key comes from `deriveEncryptionKey`, pinned by a
  test.
- **Paths:** `internal/paths`. **Logging:** `logger.Error("message", "key", value)`.
- **Frontend:** `cn()`, `errorMessage()`, `sonner` toasts, TanStack Query for backend data,
  existing `components/ui/`, `lucide-react` icons.
- **One mutation used for many calls:** use `mutateAsync` per call. `mutate()` only runs the
  callbacks of the latest call.

## How the backend behaves

- **Editor session.** `RunQuery` runs statements one at a time on a pinned session connection,
  so `BEGIN`, `USE`, `SET` and temp tables carry over (not ClickHouse, which has no pinned
  connection). Metadata, table data and AI queries use the pool and don't see uncommitted work.
- **Cancellation.** `ConnectionState.CancelQuery` stops the statement on the server and keeps the
  session: Postgres sends a cancel request, MySQL and ClickHouse `KILL QUERY`, SQLite interrupts.
- **Concurrency.** Wails runs bound methods concurrently. `remote.Engine` guards
  `activeClient`/`sshTunnel` with `mu` (read via `client()`), connects the new client before
  closing the old one, and never lets a test connection touch the active one. Engines guard
  their own state.
- **Windows.** `Close()` only queues `WindowClosing`; hooks run later on another goroutine. So
  `app.go` clears a window's field under `windowMutex` before closing it, and hooks ignore a
  window that is no longer current. `closingIntentional` is only for quitting into an update.

## Coding principles

1. **Simple over abstract.** No new layers, wrappers, interfaces, hooks, contexts or config unless
   they remove real duplication. An interface needs a real boundary (like `DatabaseClient`).
2. **Clear names** in each language's conventions (Go `MixedCaps`; TS `camelCase` values,
   `PascalCase` components/types, `useX` hooks). Filenames follow their folder.
3. **Functions** name a real concept, remove duplication or isolate something tricky. Don't
   shred simple logic into helpers.
4. **Comments explain why** (constraints, edge cases, security), not what. No banners or section
   headers. Go doc comments start with the identifier. See `pkg/common/readonly.go` for tone.
5. **No unnecessary code.** Look for an existing implementation first. Remove dead code, unused
   exports and redundant state you touch. Exported methods on a registered service are callable
   from the UI, so keep Go-only wiring out of them. No new dependency when a few lines will do.
6. **Correctness first.** Preserve behavior unless changing it is the point. Check Go, generated
   bindings and frontend call sites before removing or renaming anything.
7. **Installed APIs, no churn:** React 19, TanStack Query 5, react-router 8, Tailwind 4, Wails v3
   beta.30. React Compiler is only an ESLint rule set, not a build step, so `useMemo` and
   `useCallback` still do work.
8. **Verify honestly.** Never claim a check passed unless you ran it.

## Handle with care

- **Bindings.** After changing an exported method or model of a registered service, run
  `wails3 generate bindings -ts -clean=true` and commit `frontend/bindings/`. CI fails if stale.
  Renaming or removing a bound method breaks the UI.
- **Stored data.** Saved passwords and AI keys are encrypted with a key from the device ID and
  `constants.AppSalt`; changing the salt, KDF or cipher makes existing credentials unreadable.
  `data.db` has no migrations (`CREATE TABLE IF NOT EXISTS`), so a column change needs explicit
  `ALTER TABLE` handling. `settings.json` and `chat.json` must keep loading older files
  (`fillDefaults`).
- **Privacy.** Never log or report passwords, keys, query text or results. Keep README "Privacy"
  accurate when changing what `internal/ai` sends (row caps are in `internal/ai/tools.go`). The
  README is for users: plain language, no internals or exact limits.
- **SQL safety.** Keep identifier quoting and the read-only path intact in all four engines.
- **Releases.** The version comes from the git tag. The updater depends on release asset names
  and `SHA256SUMS` (`internal/update`, `.github/workflows/release.yml`).
- **Cross-platform.** Windows is cross-compiled with `CGO_ENABLED=0`: no cgo-only dependencies.
  Platform code uses build tags.

## Checks

```bash
make test                                 # Go tests + frontend typecheck and lint
cd frontend && npm run build              # production bundle
go vet ./...                              # needs frontend/dist (see DEVELOPMENT.md)
gofmt -l $(git ls-files '*.go')           # must print nothing
wails3 generate bindings -ts -clean=true  # after a service signature or model change
```

Go tests are mostly table-driven `*_test.go` files next to the code. Add one when changing logic
in `pkg/common`, an engine's query handling, `internal/ai`, `settings`, `update`, `intellisense`
or `db`. Postgres/MySQL tests need a server (see DEVELOPMENT.md). A test must earn its place:
it guards risky logic and runs fast and offline. No Docker suites, and no tests that restate the
implementation or exercise a library. There is no frontend test runner: use typecheck, lint and
`make dev`. No frontend formatter: match the file (2 spaces, double quotes).

## Workflow

1. Read the code and its callers on both sides of the bindings before changing it.
2. Make small, focused changes; no drive-by rewrites or reformatting.
3. Run the relevant checks; regenerate bindings if a service changed.
4. Review your diff for complexity, unrelated changes and leftover debug code.
5. Report what changed, why, which checks ran (with results) and what is unverified.

Commit messages are short imperative sentences about the user-visible change (e.g. "Let the AI
chat query data through read-only tools").
