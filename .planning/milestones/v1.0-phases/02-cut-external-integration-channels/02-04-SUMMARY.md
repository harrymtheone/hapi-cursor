---
phase: 02-cut-external-integration-channels
plan: 04
subsystem: hub
tags: [cut, deletion, serverchan, notification-channel]
requires: [elevenlabs-voice-free]
provides:
  - serverchan-free
  - notification-channels-push-only
affects:
  - hub/src/serverchan/
  - hub/src/index.ts
  - hub/src/config/settings.ts
  - hub/src/config/serverSettings.ts
  - hub/src/configuration.ts
tech-stack:
  added: []
  removed: []
  patterns:
    - notificationChannels initializer is now a single-element array (PushNotificationChannel)
    - hub config no longer reads SERVERCHAN_SENDKEY / SERVERCHAN_NOTIFICATION env vars
key-files:
  created: []
  deleted:
    - hub/src/serverchan/channel.ts
    - hub/src/serverchan/channel.test.ts
  modified:
    - hub/src/index.ts
    - hub/src/config/settings.ts
    - hub/src/config/serverSettings.ts
    - hub/src/configuration.ts
decisions:
  - "Single atomic commit (`feat(phase-02): CUT-08 remove ServerChan channel`) covers both tasks per plan <output>. Splitting Task 1 (delete dir + index.ts) from Task 2 (config strip) would leave `Configuration.serverChanSendKey` pointing at a deleted constructor between commits and break the D-31 per-commit gate."
  - "ServerChan startup banner block (`[Hub] ServerChan: enabled/disabled ...`) removed alongside the channel registration — banner has no purpose once the channel is gone (mirror of the Telegram bind-URL banner cleanup in commit #1)."
  - "No `.passthrough()` added to settings parsing per D-32. Stale `serverChanSendKey` / `serverChanNotification` keys in existing user `settings.json` files are simply ignored (no schema = no rejection); the value just stops being read."
metrics:
  duration: ~5min
  completed: 2026-05-21
  commit: 4f3cce9
---

# Phase 2 Plan 04: CUT-08 remove ServerChan channel Summary

Physically deleted the ServerChan push channel end-to-end (D-22 / D-23). Removed `hub/src/serverchan/` directory (channel.ts + channel.test.ts, 188 LOC); removed `ServerChanChannel` import + the `if (config.serverChanSendKey && config.serverChanNotification) { notificationChannels.push(...) }` block + the `[Hub] ServerChan: ...` startup banner from `hub/src/index.ts`; stripped `serverChanSendKey?: string` and `serverChanNotification?: boolean` from the `Settings` interface in `hub/src/config/settings.ts`; stripped the same two fields plus their source-tracking keys, env-reading + defaulting blocks, and return-value keys from `hub/src/config/serverSettings.ts`; removed JSDoc env-var docs (`SERVERCHAN_SENDKEY` + `SERVERCHAN_NOTIFICATION`), `ConfigSources` keys, `Configuration` class fields, and constructor copies from `hub/src/configuration.ts`. Net: `notificationChannels` initializer is now exactly `[ new PushNotificationChannel(pushService, sseManager, visibilityTracker, config.publicUrl) ]` — length 1 (D-22 confirmed).

## Tasks Completed

| Task | Name | Outcome |
|------|------|---------|
| 1 | Delete hub/src/serverchan/ + remove ServerChan registration in hub/src/index.ts | ✅ Directory deleted (`channel.ts` + `channel.test.ts` gone); import + `notificationChannels.push(...)` + startup banner removed; channel array reduced to PushNotificationChannel only |
| 2 | Strip serverChan* fields from settings.ts / serverSettings.ts / configuration.ts | ✅ All three config files cleansed; `Settings` interface, `ServerSettings` interface, `ServerSettingsResult.sources`, `loadServerSettings()` env/file/default blocks, `ConfigSources`, `Configuration` class fields + constructor copies, and JSDoc env-var docs all removed |

## notificationChannels array length

| | Before (after 02-03) | After this commit |
|---|---|---|
| `notificationChannels` initializer constructors | 1 (PushNotificationChannel) + 1 conditional push (ServerChanChannel) → 1–2 at runtime | 1 (PushNotificationChannel) |
| ServerChan constructor reachable? | Yes (via env-driven `serverChanSendKey + serverChanNotification`) | No (D-22 confirmed) |

Plan `<objective>` predicted "2 → 1". The pre-commit state was actually "1 + 1 conditional → 1 unconditional"; semantically equivalent — the conditional ServerChan push is gone.

## Settings fields removed (D-32 inventory, ServerChan subset)

| File | Removed |
|------|---------|
| `hub/src/config/settings.ts` | `serverChanSendKey?: string`, `serverChanNotification?: boolean` (Settings interface) |
| `hub/src/config/serverSettings.ts` | `serverChanSendKey: string \| null`, `serverChanNotification: boolean` (ServerSettings); `serverChanSendKey: 'env'\|'file'\|'default'`, `serverChanNotification: 'env'\|'file'\|'default'` (sources); env-reading blocks for `SERVERCHAN_SENDKEY` + `SERVERCHAN_NOTIFICATION`; return-value keys |
| `hub/src/configuration.ts` | JSDoc lines for `SERVERCHAN_SENDKEY` + `SERVERCHAN_NOTIFICATION`; `ConfigSources` keys `serverChanSendKey` + `serverChanNotification`; `Configuration` class fields `serverChanSendKey` + `serverChanNotification`; constructor copies `this.serverChanSendKey = ...` + `this.serverChanNotification = ...` |

No `.passthrough()` added (D-32). No Zod schema in `settings.ts` — only a TypeScript interface — so no schema strip needed there.

## D-31 Per-commit Gate

| Check | Result |
|-------|--------|
| `bun typecheck` (cli + web + hub) | ✅ exit 0 |
| `bun run test` (cli + hub + web + shared + guard) | ✅ 596 tests passed; 0 failed |
| `grep -rni 'serverchan' hub/src/` | ✅ 0 matches |
| `grep -rn 'SERVERCHAN_SENDKEY\|SERVERCHAN_NOTIFICATION' hub/src/` | ✅ 0 matches (SC#4 serverchan-side) |
| `test -e hub/src/serverchan` | ✅ absent |
| Commit subject `feat(phase-02): CUT-08 remove ServerChan channel` | ✅ `4f3cce9` |

The Phase-1 ripgrep guard PATTERN does not yet match `serverchan`; PATTERN extension is owned by 02-05 commit #5 per D-29. `rg` is not installed on this host so `check-no-cut-agents.sh` short-circuits (documented Phase-1 behavior).

## Hand-off Note

CUT-08 is now closed. ServerChan is fully gone from hub config + index + filesystem. Phase 2 SC#1 (serverchan-side), SC#3 (channel array contains no ServerChan ref), and SC#4 (SERVERCHAN_* env-var reads gone) are met for the ServerChan keyword.

Remaining work owned by **02-05 commit #5**:
- Extend the Phase-1 ripgrep guard PATTERN to include `serverchan` (and the other CUT keywords) per D-29.
- Regenerate `bun.lock` to drop residual lockfile entries (D-30 commit ordering).
- CLI residual cleanup is **Telegram-only** in 02-05; RESEARCH confirmed zero `serverchan` references in `cli/src/`, so no CLI side-effect from this commit.

CLI Crosscut Inventory check (per RESEARCH): `grep -rni 'serverchan' cli/src/` returns 0 matches — verified before this commit. User-set `SERVERCHAN_SENDKEY` / `SERVERCHAN_NOTIFICATION` env vars become inert. Stale `serverChanSendKey` / `serverChanNotification` keys in `~/.hapi/settings.json` are silently ignored per D-32 (no `.passthrough()`, no schema rejection).

## Deviations from Plan

None of consequence — plan executed as written. Two notes on Discretion calls:

1. **Single atomic commit covers both tasks.** Per plan `<output>`: "One commit `feat(phase-02): CUT-08 remove ServerChan channel`." Splitting Task 1 from Task 2 would leave `Configuration.serverChanSendKey` referenced by a deleted `index.ts` site mid-stream and break the D-31 per-commit gate. Both tasks land in commit `4f3cce9`.
2. **Startup banner block removed in Task 1.** Plan Action step 2 mentioned "any startup banner output that prints ServerChan-related status (mirror of the Telegram bind-URL banner cleanup in commit #1)" — the `[Hub] ServerChan: enabled/disabled (...)` block at index.ts L142-149 was deleted accordingly. This is in-scope per the plan, not a deviation.

## Self-Check: PASSED

- ✅ `hub/src/serverchan/channel.ts` absent
- ✅ `hub/src/serverchan/channel.test.ts` absent
- ✅ `hub/src/serverchan/` directory absent
- ✅ Commit `4f3cce9` exists on `main` (`git log --oneline | grep 4f3cce9` → present)
- ✅ `bun typecheck` exit 0
- ✅ `bun run test` exit 0 (596 / 596)
- ✅ `grep -rni 'serverchan' hub/src/` returns 0 matches
- ✅ `grep -rn 'SERVERCHAN_SENDKEY\|SERVERCHAN_NOTIFICATION' hub/src/` returns 0 matches
- ✅ `notificationChannels` initializer in `hub/src/index.ts` references exactly one constructor: `PushNotificationChannel`

## Threat Flags

None. This plan deletes attack surface (an outbound HTTPS POST to `sctapi.ftqq.com` with a user secret in the URL path) and removes two env-var reads; no new endpoints, auth paths, file access patterns, or trust-boundary schema changes were introduced. T-02-04-1 (stale `SERVERCHAN_SENDKEY` env-var) is documented in PLAN.md as `mitigate (medium)` — code stops reading the secret; commit #5 (02-05) extends the ripgrep guard PATTERN to catch any reintroduction.
