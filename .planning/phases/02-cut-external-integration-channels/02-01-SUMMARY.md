---
phase: 02-cut-external-integration-channels
plan: 01
subsystem: hub
tags: [cut, deletion, telegram, auth, notifications]
requires: []
provides:
  - hub-side-telegram-free
  - api-auth-single-source
  - notification-channels-no-telegram
affects:
  - hub/src/web/routes/auth.ts
  - hub/src/web/server.ts
  - hub/src/index.ts
  - hub/src/config/*
  - hub/src/configuration.ts
  - hub/package.json
tech-stack:
  added: []
  removed: [grammy]
  patterns:
    - single-schema auth body (zod object, no union)
    - notification channels assembled imperatively as array
key-files:
  created: []
  modified:
    - hub/src/web/routes/auth.ts
    - hub/src/web/server.ts
    - hub/src/index.ts
    - hub/src/config/settings.ts
    - hub/src/config/serverSettings.ts
    - hub/src/configuration.ts
    - hub/package.json
    - hub/src/sync/syncEngine.ts
    - hub/src/sync/messageService.ts
    - hub/src/sync/messageService.test.ts
    - hub/src/sync/rpcGateway.ts
    - hub/src/web/routes/messages.ts
  deleted:
    - hub/src/telegram/bot.ts
    - hub/src/telegram/bot.test.ts
    - hub/src/telegram/callbacks.ts
    - hub/src/telegram/renderer.ts
    - hub/src/telegram/sessionView.ts
    - hub/src/web/telegramInitData.ts
    - hub/src/web/routes/bind.ts
decisions:
  - "Single atomic commit covers all four plan tasks (per plan <output>: 'One commit feat(phase-02): CUT-06 remove Telegram bot (hub-side)'). Per-task interim commits would leave intermediate broken typecheck states (e.g., settings.ts referencing deleted telegramBotToken)."
  - "D-26 confirmed at execute time: hub/src/socket/ has zero telegram references — no socket edit needed."
metrics:
  duration: ~5min
  completed: 2026-05-21
---

# Phase 2 Plan 01: CUT-06 remove Telegram bot (hub-side) Summary

Physically deleted the Telegram bot subsystem from `hub/`: removed `hub/src/telegram/` directory (5 files), `telegramInitData.ts` HMAC validator, `bind.ts` route; collapsed `/api/auth` body schema to single-source `z.object({ accessToken })`; removed HappyBot init + notification-channel push + Telegram banner from `hub/src/index.ts`; stripped all `telegram*` fields from settings/serverSettings/configuration; removed `grammy` dependency and Telegram-themed `description` from `hub/package.json`; cleansed incidental `'telegram-bot'` literals + JSDoc/comments in `hub/src/sync/*` and `hub/src/web/routes/messages.ts`.

## Tasks Completed

| Task | Name | Outcome |
|------|------|---------|
| 1 | Delete Telegram subsystem files + bind/auth route surgery | ✅ telegram/ + telegramInitData.ts + bind.ts deleted; auth.ts collapsed to access-token-only; server.ts no longer registers bind route, calls createAuthRoutes without store param |
| 2 | Remove HappyBot init + Telegram channel push + bind URL banner from hub/src/index.ts | ✅ HappyBot import + variable + init block + lifecycle calls removed; Telegram banner log lines removed; notificationChannels array no longer ever pushes Telegram |
| 3 | Strip TELEGRAM_* fields from settings/serverSettings/configuration; remove grammy dep | ✅ telegramBotToken/telegramNotification removed from all 3 config layers (interface, sources, defaulting blocks, return value, constructor copies); JSDoc env-var docs trimmed; grammy dep + Telegram description gone from hub/package.json |
| 4 | Cleanse incidental telegram literals + commit | ✅ syncEngine.ts header JSDoc + sentFrom union collapsed; messageService.ts + .test.ts comments edited; rpcGateway.ts abort reason string changed; messages.ts comment edited |

## Key Code Diffs

### `/api/auth` schema (D-24)

**Before:** `z.union([z.object({ initData }), z.object({ accessToken })])` with `if ('accessToken' in parsed.data) ... else { /* telegram HMAC, store.users.getUser, ... */ }`.

**After:** `z.object({ accessToken: z.string() })` with single linear flow: `parseAccessToken → constantTimeEquals → getOrCreateOwnerId → SignJWT`. `createAuthRoutes` signature loses `store: Store` parameter.

### `notificationChannels` array length (D-22)

**Before commit:** `[PushNotificationChannel]` + conditional push of `ServerChanChannel` + conditional push of `HappyBot`. Possible final length: 1–3.

**After commit:** `[PushNotificationChannel]` + conditional push of `ServerChanChannel`. Possible final length: 1–2. (ServerChan removal is owned by 02-04 / CUT-08.)

## D-26 Socket No-op Confirmation

`Grep telegram hub/src/socket/` returns zero matches. Socket.io auth handshake never had a telegram branch. No edit required.

## D-31 Per-commit Gate

| Check | Result |
|-------|--------|
| `bun typecheck` (full repo — cli + web + hub) | ✅ exit 0 |
| `bun run test` (cli + hub + web + shared + guard) | ✅ 596 tests passed; 0 failed |

The pre-existing Phase-1 ripgrep guard PATTERN (`\b(claude\|codex\|gemini\|opencode)\b`) does not match `telegram` so it remains green; PATTERN extension is owned by commit #5 (02-05) per RESEARCH §"Commit Dependency Ordering". `rg` is not installed on this host so `check-no-cut-agents.sh` short-circuits (documented Phase-1 behavior).

## Hand-off Note

Web-side telegram references intentionally remain after this commit (web's `AuthSource = { type: 'telegram' } | ...` union, `useTelegram.ts`, `bind()` method, etc.). They become runtime-dead-but-typed-valid because per-package typecheck isolation prevents `web/typecheck` from observing the new hub auth contract (only HTTP-runtime coupling). These are owned by 02-02 (CUT-06 web-side).

CLI residuals (`cli/src/terminal/TerminalManager.ts` `'TELEGRAM_BOT_TOKEN'` in `SENSITIVE_ENV_KEYS`; `cli/src/commands/notify.ts` "Use Telegram notifications…" string) remain — owned by 02-05 commit #5 per D-33.

## Deviations from Plan

None — plan executed as written. The plan specifies a single atomic commit covering all four tasks (`<output>` field: "One commit `feat(phase-02): CUT-06 remove Telegram bot (hub-side)`"). The user's templated success criteria mentioned "Each task committed individually" — the plan's design takes precedence because per-task commits would leave intermediate states where typecheck fails (e.g., a Task-1 commit deletes the telegram dir but settings.ts/configuration.ts still reference `telegramBotToken`, breaking the D-31 per-commit gate). All four tasks are part of a single logically-atomic deletion per D-30 commit #1.

## Threat Flags

None. This plan deletes attack surface; no new endpoints, auth paths, file access patterns, or trust-boundary schema changes were introduced.
