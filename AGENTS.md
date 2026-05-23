# AGENTS.md

Telegraph style. Noun phrases ok. Drop grammar.

Short guide for AI coding agents working in this repo. Read root [README.md](README.md) first, then the package READMEs as needed.

## What this repo is

HAPI Cursor Edition. Single-user, self-hosted bridge that puts the Cursor Agent CLI behind a phone/desktop PWA over Tailscale. Not a multi-agent platform. No backward compatibility — there is no install base to preserve.

## Repo layout

| Path      | Role                                                                       |
| --------- | -------------------------------------------------------------------------- |
| `cli/`    | `hapi` CLI — Cursor Agent wrapper, background runner, hub launcher.        |
| `hub/`    | Local server — HTTP + Socket.IO + SSE + SQLite store.                      |
| `web/`    | React 19 PWA — phone/desktop client served by the hub.                     |
| `shared/` | `@hapi/protocol` — shared types, Zod schemas, socket event names.          |

## Architecture

```
CLI ──Socket.IO── Hub ──SSE/REST── Web (PWA)
```

## Commands

```bash
bun install
bun run typecheck                  # bun typecheck — tsc --noEmit across cli, hub, web
bun run test                       # vitest (cli/web) + bun:test (hub) + guard
bun run madge:check                # circular-import guard (12-03 — name reserved)
bash scripts/check-no-cut-agents.sh  # repo-wide ripgrep guard (run from root)
```

## Rules

- No backward compatibility. Single user, no install base — delete > deprecate.
- TypeScript strict. `@/*` path alias resolves to each package's `./src/*`.
- 4-space indentation. Co-located `*.test.ts` / `*.test.tsx` next to the file under test.
- Pragmatism > over-engineering. Smallest change that meets the spec.
- Cross-runner discipline: `cli/` + `web/` run under Vitest; `hub/` + `shared/` run under `bun:test`. Do not mix imports.
- Don't reintroduce: claude / codex / gemini / opencode / telegram / serverchan / elevenlabs / tunwg / namespace. These literals are guarded by `scripts/check-no-cut-agents.sh`; this file is whitelisted only for this reminder line.

## See also

- [`.cursor/rules/`](.cursor/rules/) — Cursor IDE-specific rules (gitnexus, gsd-workflow).
- [`.planning/`](.planning/) — GSD planning workspace. Do not edit unless running a GSD workflow.
- [`SECURITY.md`](SECURITY.md) — disclosure policy.
