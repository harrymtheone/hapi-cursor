# hapi hub

`hapi-hub` — HTTP + Socket.IO + SSE server with SQLite persistence. Brokers state between CLI runners on the dev machine and the web PWA clients that drive sessions. Single-process, single-user, single-tenant.

## Install / Run

From the repo root:

```bash
bun install
```

Run the hub in watch-reload mode:

```bash
cd hub && bun run dev          # bun --watch run src/index.ts
```

Or production mode (no watcher):

```bash
cd hub && bun run start        # bun run src/index.ts
```

### Environment variables

Loaded by `hub/src/configuration.ts` with priority `env > settings.json > default`. Values read from env are persisted to `~/.hapi/settings.json` on first run.

| Variable             | Default                      | Role                                                    |
| -------------------- | ---------------------------- | ------------------------------------------------------- |
| `HAPI_LISTEN_HOST`   | `127.0.0.1`                  | Bind host for the HTTP service.                         |
| `HAPI_LISTEN_PORT`   | `3006`                       | Bind port for the HTTP service.                         |
| `HAPI_PUBLIC_URL`    | derived from host/port       | Public URL the web PWA fetches against.                 |
| `CORS_ORIGINS`       | (none)                       | Comma-separated CORS origins.                           |
| `CLI_API_TOKEN`      | auto-generated on first run  | Shared secret for CLI ↔ hub authentication.             |
| `VAPID_SUBJECT`      | `mailto:admin@hapi.run`      | Contact for Web Push.                                   |
| `HAPI_HOME`          | `~/.hapi`                    | Data directory (DB, settings, VAPID keys).              |
| `DB_PATH`            | `${HAPI_HOME}/hapi.db`       | SQLite database path.                                   |

## `bun run` scripts

Sourced verbatim from `hub/package.json`.

| Script                            | Command                                              | Purpose                                          |
| --------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `start`                           | `bun run src/index.ts`                               | Run the hub process.                             |
| `dev`                             | `bun --watch run src/index.ts`                       | Watch-reload dev mode.                           |
| `test`                            | `bun test`                                           | Run the `bun:test` suite.                        |
| `typecheck`                       | `tsc --noEmit`                                       | Strict TS check of `hub/src/`.                   |
| `build`                           | `bun build src/index.ts --outdir dist --target bun`  | Compile hub bundle to `dist/`.                   |
| `generate:embedded-web-assets`    | `bun run scripts/generate-embedded-web-assets.ts`    | Embed the built web bundle into the single-exe.  |

## Key modules

| Path                         | Role                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `src/index.ts`               | Process entry — wires config, store, sync engine, socket + web servers.          |
| `src/configuration.ts`       | Frozen `Config` loader (env > settings.json > defaults).                         |
| `src/web/`                   | Hono HTTP app: `server.ts` composes routes; `routes/` holds one file per resource.|
| `src/socket/`                | Socket.IO server + namespaces; CLI handlers under `handlers/cli/`.                |
| `src/sync/`                  | Stateful core — `syncEngine.ts` façade, `sessionCache`, `messageService`, RPC.    |
| `src/sse/`                   | Server-Sent Events manager (`sseManager.ts`).                                     |
| `src/store/`                 | SQLite persistence (better-sqlite3); `index.ts` facade + per-resource sub-stores. |
| `src/notifications/`         | Notification channel facade.                                                      |
| `src/push/`                  | Web Push (VAPID) notification channel.                                            |
| `src/config/`                | Persisted secret/setting storage (CLI API token, JWT secret, VAPID keys).         |

## Tests

```bash
cd hub && bun run test
```

Runs `bun:test` (NOT Vitest — `hub/` and `shared/` are bun-test-only by repo
convention; mixing runners is guarded by `scripts/check-no-cut-agents.sh`).
Co-located `*.test.ts` per repo convention.

## Health / smoke

```bash
curl http://127.0.0.1:3006/health
# => {"status":"ok","protocolVersion":"<n>"}
```

Defined at `hub/src/web/server.ts` and returns the running protocol version
from `@hapi/protocol`.

## Database

Hub uses SQLite at `${DB_PATH}` (default `${HAPI_HOME}/hapi.db`). The schema
version is stored in `PRAGMA user_version`.

### Current schema version: 12

Version 12 adds the `tool_calls` table for durable, session-scoped tool call
projections. There is **no runtime migration** — Hub fails fast with a
mismatch error if the on-disk schema version differs from the expected version.

### Upgrading an existing install to version 12

If you have an existing `hapi.db` at schema version 11 (or any earlier version),
Hub will refuse to start and print:

```
SQLite schema version mismatch for <DB_PATH>. Expected 12, found 11.
This build does not run compatibility migrations.
Back up and rebuild the database, or run an offline migration to the expected schema version.
```

**Steps to rebuild:**

1. Stop the Hub process.
2. Back up the existing database if you want to preserve session history:
   ```bash
   cp "${HAPI_HOME}/hapi.db" "${HAPI_HOME}/hapi.db.v11.bak"
   ```
3. Remove the old database file (and WAL/SHM sidecar files if present):
   ```bash
   rm "${HAPI_HOME}/hapi.db" "${HAPI_HOME}/hapi.db-wal" "${HAPI_HOME}/hapi.db-shm" 2>/dev/null || true
   ```
4. Restart Hub. `createSchema` runs automatically on an empty database and
   creates the version 12 schema including `tool_calls`.

After restart, `reconcileSessionToolCalls` will backfill projections from any
existing messages on the first `getMessagesPage` call for each session, so
tool activity cards will populate without requiring new CLI activity.

### Schema policy

- **No silent `ALTER TABLE` migrations** in `initSchema`. The project has no
  install base to preserve — delete and rebuild is the supported upgrade path
  (per `AGENTS.md` no-backward-compat policy).
- If you need to migrate data from an old DB, write a one-off offline script
  that reads the old file and re-inserts rows into a fresh version 12 DB.
