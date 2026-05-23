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
