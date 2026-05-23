# hapi CLI

`hapi` — Cursor Agent wrapper, background runner, and hub launcher for HAPI Cursor Edition. Starts Cursor Agent sessions, registers them with the hub, and exposes a long-running daemon for multi-session and remote workflows.

## Install / Build

From the repo root:

```bash
bun install                                # installs the workspace
bun run --cwd cli build:exe                # bun-compiled single-platform executable
bun run --cwd cli build:exe:allinone       # single exe with embedded hub + web assets
```

The `bin/hapi.cjs` shim is the Node entry point published to npm; the bun-compiled
executable produced by `build:exe*` is the deployable artifact.

During development, run the CLI straight from source:

```bash
cd cli
bun run dev                                # equivalent to `bun src/index.ts`
bun run dev cursor                         # start a Cursor session
bun run dev hub --host 0.0.0.0 --port 3006 # launch the hub in-process
bun run dev runner                         # background runner daemon
```

## Commands

`cli/src/commands/registry.ts` registers the following subcommands. Running
`hapi` with no subcommand falls through to `cursor`.

| Command          | Source                                  | Role                                                            |
| ---------------- | --------------------------------------- | --------------------------------------------------------------- |
| `hapi auth`      | `cli/src/commands/auth.ts`              | Login / logout / device-pair against a hub.                      |
| `hapi connect`   | `cli/src/commands/connect.ts`           | Pair this machine with a hub using a one-time code.              |
| `hapi cursor`    | `cli/src/commands/cursor.ts`            | Start a Cursor Agent session (default when no subcommand).       |
| `hapi hub`       | `cli/src/commands/hub.ts`               | Launch the hub in-process (passes `--host` / `--port` to env).   |
| `hapi runner`    | `cli/src/commands/runner.ts`            | Start / stop / inspect the background runner daemon.             |
| `hapi resume`    | `cli/src/commands/resume.ts`            | Resume a previous session by id.                                 |
| `hapi doctor`    | `cli/src/commands/doctor.ts`            | Print environment diagnostics.                                   |
| `hapi notify`    | `cli/src/commands/notify.ts`            | Send a push notification through the hub.                        |

`hapi -v` / `--version` prints the CLI version.

## `bun run` scripts

Sourced verbatim from `cli/package.json`.

| Script                     | Command                                                      | Purpose                                              |
| -------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| `postinstall`              | `node -e "...chmodSync('bin/hapi.cjs', 0o755)..."`           | Make the published bin shim executable.              |
| `typecheck`                | `tsc --noEmit`                                               | Strict TS check of `cli/src/`.                       |
| `build:exe`                | `bun run scripts/build-executable.ts`                        | Bun-compiled single-platform executable.             |
| `build:exe:all`            | `bun run scripts/build-executable.ts --all`                  | Cross-platform executables (all targets).            |
| `build:exe:allinone`       | `bun run scripts/build-executable.ts --with-web-assets`      | Single exe with embedded hub + web assets.           |
| `build:exe:allinone:all`   | `bun run scripts/build-executable.ts --with-web-assets --all`| Cross-platform all-in-one executables.               |
| `prepare-npm-packages`     | `bun run scripts/prepare-npm-packages.ts`                    | Stage per-platform npm artifacts under `cli/npm/`.   |
| `prepack`                  | `bun run prepare-npm-packages`                               | Pre-publish hook.                                    |
| `tools:unpack`             | `bun run scripts/unpack-tools.ts`                            | Unpack vendored tool binaries (ripgrep) for tests.   |
| `update-homebrew-formula`  | `bun run scripts/update-homebrew-formula.ts`                 | Bump the Homebrew tap formula.                       |
| `test`                     | `bun run tools:unpack && vitest run`                         | Run the Vitest suite (after unpacking tools).        |
| `test:win`                 | `vitest run`                                                 | Windows test entry (skips `tools:unpack`).           |
| `dev`                      | `bun src/index.ts`                                           | Run the CLI directly from source.                    |
| `dev:local-server`         | `bun --env-file .env.dev-local-server src/index.ts`          | Dev run against a locally-running hub.               |
| `dev:integration-test-env` | `bun --env-file .env.integration-test src/index.ts`          | Dev run with the integration-test env file.          |
| `release-all`              | `bun run scripts/release-all.ts`                             | Cut a coordinated release across npm artifacts.      |

## Key modules

| Path                        | Role                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `src/index.ts`              | Bin entry — calls `runCli()`.                                        |
| `src/commands/`             | One file per subcommand + `registry.ts` (dispatch table).            |
| `src/commands/runCli.ts`    | Argv parsing, auth bootstrap, config load, command dispatch.         |
| `src/configuration.ts`      | Frozen `Config` loader (env > settings.json > defaults).             |
| `src/agent/`                | Cross-cursor base classes — `sessionBase`, `loopBase`, mode matrix.  |
| `src/cursor/`               | Cursor-specific launcher, loop, session, mode adapter.               |
| `src/runner/`               | Background daemon — `run.ts`, `controlServer.ts`, `controlClient.ts`.|
| `src/api/`                  | Socket.IO + REST client against the hub.                             |
| `src/ui/`                   | Ink terminal UI + diagnostics (`doctor.ts`, `logger.ts`).            |

## Tests

```bash
cd cli && bun run test
```

Runs Vitest after unpacking vendored tool binaries (ripgrep, difftastic).
Co-located `*.test.ts` per repo convention. Cross-runner rule: `cli/` is
Vitest-only — do not import from `bun:test` here.
