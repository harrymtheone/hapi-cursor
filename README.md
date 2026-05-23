# HAPI Cursor Edition

Remote-control the Cursor coding agent from your phone or laptop over Tailscale.

## What this is / What this is not

**Is:** A single-user, self-hosted bridge between the [Cursor Agent CLI](https://docs.cursor.com/cli/overview) running on your dev machine and a React PWA you open from another device. You launch sessions, watch the timeline, approve tool calls, type messages, and tail terminals — all over your private Tailscale network.

**Is not:** A multi-agent platform, a hosted SaaS, or a public web app. There is no install base, no backward compatibility layer, and no support for other AI coding agents — Cursor is the only one wired in. Tailscale (or any other private network you control) is the only intended transport for non-localhost access.

## Repo layout

| Workspace  | Role                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| `cli/`     | `hapi` CLI — Cursor Agent wrapper, background runner, hub launcher.     |
| `hub/`     | Local server — HTTP + Socket.IO + SSE on top of SQLite persistence.     |
| `web/`     | React 19 PWA — phone/desktop client served by the hub.                  |
| `shared/`  | `@hapi/protocol` — types, Zod schemas, socket event names.              |

## Quickstart

Prerequisites: [Bun](https://bun.sh) ≥ 1.3, [Cursor Agent CLI](https://docs.cursor.com/cli/overview) (`cursor-agent`) on `PATH`, and [Tailscale](https://tailscale.com/) on both the dev machine and the phone/laptop you want to drive sessions from.

```bash
bun install
```

Run the hub + web dev servers together (hub on `127.0.0.1:3006`, Vite on `127.0.0.1:5173`):

```bash
bun run dev
```

Start a Cursor session against the running hub (in a second terminal, from the repo root or anywhere on `PATH` once installed):

```bash
cd cli && bun run dev cursor       # interactive Cursor session
cd cli && bun run dev runner       # background runner (multi-session daemon)
cd cli && bun run dev hub          # standalone hub (alternative to `bun run dev:hub`)
```

The hub prints its listen URL on startup. On your phone, open `http://<tailscale-machine-name>:3006/` (or whatever `HAPI_LISTEN_HOST` / `HAPI_LISTEN_PORT` resolves to on your tailnet) and pair using the token shown in the hub logs. The web bundle is served straight from the hub in single-exe builds, so the PWA installs from that same URL.

For a packaged single binary (hub + web + CLI in one executable):

```bash
bun run build:single-exe
```

The built binary lands in `cli/dist/`; copy it to any machine on the tailnet and run `hapi hub` to start serving.

## Development

```bash
bun run typecheck      # tsc --noEmit across cli, hub, web
bun run test           # vitest (cli, web) + bun:test (hub) + repo guard
```

Per-package quickstarts live in [`cli/README.md`](cli/README.md), [`hub/README.md`](hub/README.md), and [`web/README.md`](web/README.md). AI coding agents working in this repo should read [`AGENTS.md`](AGENTS.md) for navigation cues and [`.cursor/rules/`](.cursor/rules/) for Cursor-IDE-specific guidance.

## License

[AGPL-3.0-only](LICENSE). See [`SECURITY.md`](SECURITY.md) for the disclosure policy.
