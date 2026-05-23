---
phase: 10-config-cleanup
plan: 02
subsystem: hub/configuration
tags: [refactor, di, config, security]
requires: [10-01]
provides:
  - hub/src/configuration.ts::loadConfig
  - hub/src/configuration.ts::Config
  - hub/src/config/serverSettings.ts::rejectOldEnvVars
affects:
  - hub/src/index.ts::main (entry-point DI root)
  - hub/src/web/server.ts (options-bag DI)
  - hub/src/socket/server.ts (options-bag DI)
  - hub/src/web/routes/cli.ts (cliApiToken parameter)
  - hub/src/web/routes/auth.ts (cliApiToken + ownerId parameters)
  - hub/src/config/jwtSecret.ts (dataDir parameter)
  - hub/src/config/ownerId.ts (dataDir parameter; cache deleted)
tech_stack:
  added: []
  patterns:
    - deep-freeze helper (recursive Object.freeze)
    - options-bag DI (already idiomatic in hub/)
    - rejectOldXxx-style legacy-rejection helper (D-161)
key_files:
  created:
    - .planning/phases/10-config-cleanup/10-02-SUMMARY.md
  modified:
    - hub/src/configuration.ts
    - hub/src/configuration.test.ts
    - hub/src/config/serverSettings.ts
    - hub/src/config/serverSettings.test.ts
    - hub/src/config/jwtSecret.ts
    - hub/src/config/ownerId.ts
    - hub/src/web/server.ts
    - hub/src/socket/server.ts
    - hub/src/web/routes/cli.ts
    - hub/src/web/routes/cli.test.ts
    - hub/src/web/routes/auth.ts
    - hub/src/index.ts
decisions:
  - "Tasks 1 + 2 committed atomically (single coordinated wave) per the GitNexus HIGH-risk note — splitting per consumer would break typecheck between commits."
  - "auth.ts now accepts pre-resolved ownerId rather than calling getOrCreateOwnerId() per request. Owner-id resolution moves to main() startup. This removed the only production caller that benefited from the deleted module-level cachedOwnerId cache (D-170), with no behavior change since main() resolves once."
  - "rejectOldEnvVars lives in hub/src/config/serverSettings.ts (alongside rejectOldSettingsFields) so Plan 03 (CLI cutover) can re-import the same helper rather than duplicate the OLD_ENV_VARS table."
metrics:
  duration_minutes: 12
  completed: 2026-05-23
---

# Phase 10 Plan 02: Hub loadConfig() + DI cutover Summary

Replaced the Hub `Configuration` singleton with `loadConfig(): Promise<Config>` returning a deeply frozen `Config`, and threaded the config through every Hub consumer (7 consumers across 5 files) in a single coordinated commit.

## What landed

### `hub/src/configuration.ts` rewrite
- Deleted: `Configuration` class, `_setCliApiToken` setter, `_configuration` singleton, `createConfiguration()`, `getConfiguration()`.
- Added: `Config` type (`Readonly<{...}>`), private `deepFreeze<T>` helper, `export async function loadConfig(): Promise<Config>`.
- `loadConfig()` calls `rejectOldEnvVars()` first, then resolves `dataDir`/`dbPath`, calls existing `loadServerSettings(dataDir)` and `getOrCreateCliApiToken(dataDir)`, and returns `deepFreeze({...})` with `corsOrigins` and `sources` independently frozen via `Object.freeze`.
- The `mkdirSync(dataDir, { recursive: true })` startup side-effect is preserved (Pitfall 6 in 10-RESEARCH).

### `hub/src/config/serverSettings.ts` extension
- Added `OLD_ENV_VARS = { WEBAPP_HOST → HAPI_LISTEN_HOST, WEBAPP_PORT → HAPI_LISTEN_PORT, WEBAPP_URL → HAPI_PUBLIC_URL, SERVER_URL → HAPI_API_URL }` and exported helper `rejectOldEnvVars()` mirroring the structure of the existing `rejectOldSettingsFields`. Error message names both old and new var (D-161).

### Consumer DI cutover (single coordinated wave)
1. `getOrCreateJwtSecret(dataDir: string)` — `getConfiguration` import dropped.
2. `getOrCreateOwnerId(dataDir: string)` — `getConfiguration` import dropped; module-level `cachedOwnerId` cache deleted (D-170 — no mutable backdoor).
3. `createSocketServer(deps)` — `corsOrigins` and `cliApiToken` now required on `SocketServerDeps`; body no longer calls `getConfiguration()`. `constantTimeEquals(parsedToken, deps.cliApiToken)` preserved verbatim (T-10-02-01).
4. `startWebServer(options)` — `corsOrigins`, `cliApiToken`, `ownerId`, `listenHost`, `listenPort`, `publicUrl` now required; body no longer calls `getConfiguration()`.
5. `createCliRoutes(getSyncEngine, cliApiToken)` — explicit token parameter; `constantTimeEquals(parsedToken, cliApiToken)` preserved (T-10-02-01).
6. `createAuthRoutes(jwtSecret, cliApiToken, ownerId)` — explicit token + owner-id parameters; `constantTimeEquals(parsedToken, cliApiToken)` preserved (T-10-02-01). The per-request `getOrCreateOwnerId()` lookup is gone — owner ID is resolved once at startup and threaded down.
7. `hub/src/index.ts::main` — calls `await loadConfig()` exactly once near the top, then threads `config.dataDir` to `getOrCreateJwtSecret` / `getOrCreateOwnerId` / `getOrCreateVapidKeys`, and the rest of `config.*` (corsOrigins, cliApiToken, listenHost, listenPort, publicUrl) into the socket + web factories. Mirrors the existing `getOrCreateVapidKeys(config.dataDir)` shape.

### Test updates
- `hub/src/configuration.test.ts` — flipped from skipped Wave-0 skeletons to active suites: (1) deep-freeze assertion (top-level + `corsOrigins.push` + `sources` mutation all throw `TypeError`); (2) one test per legacy env var (`WEBAPP_HOST`/`WEBAPP_PORT`/`WEBAPP_URL`/`SERVER_URL`) confirming the error message names the replacement var. Tests use `mkdtempSync(tmpdir(), 'hapi-hub-config-test-')` for `HAPI_HOME` and restore env in `afterEach` to avoid bleed.
- `hub/src/config/serverSettings.test.ts` — added a per-field coverage loop iterating over the `OLD_SETTINGS_FIELDS` list and asserting each one independently triggers the rejection (Wave-0 gap from 10-VALIDATION.md).
- `hub/src/web/routes/cli.test.ts` — dropped the `createConfiguration()` + `_setCliApiToken('test-token', 'env', false)` `beforeAll` mock; the new fixture passes `cliApiToken` directly to `createCliRoutes` per D-170.

## Deviations from Plan

None. Plan executed exactly as written. The only design decision worth flagging (already noted in `decisions:`) is that pre-computing `ownerId` at startup is a natural consequence of removing the `cachedOwnerId` module cache — calling `getOrCreateOwnerId()` per `/auth` request would either reintroduce the cache or pay the disk-read cost on every login. Pre-resolution at startup matches the precedent set by `getOrCreateJwtSecret(config.dataDir)` and `getOrCreateVapidKeys(config.dataDir)`.

## Threat Model Compliance

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| T-10-02-01 (Spoofing — constantTimeEquals preserved) | mitigated | `rg constantTimeEquals` shows hits in `hub/src/web/routes/cli.ts`, `hub/src/web/routes/auth.ts`, `hub/src/socket/server.ts`. DI swapped only the SOURCE of `cliApiToken` (singleton → parameter); the comparison call is verbatim. |
| T-10-02-02 (Info disclosure — token in errors) | mitigated | `loadConfig()` calls `rejectOldEnvVars` then `loadServerSettings` (which only references field names + settings file path) BEFORE `getOrCreateCliApiToken`, so a malformed-settings error cannot ever interpolate the token value. |
| T-10-02-03 (Tampering — frozen Config) | mitigated | `deepFreeze` recursively freezes; `corsOrigins` and `sources` independently `Object.freeze`d. Asserted by `configuration.test.ts` mutation tests (3 throws verified). |
| T-10-02-04 (Spoofing — stale WEBAPP_*) | mitigated | `rejectOldEnvVars` throws on startup naming the new env var. Asserted by 4 active tests in `configuration.test.ts`. |

## Verification

- `cd hub && bun typecheck` — green.
- `cd hub && bun run test` — 223 pass / 0 fail / 641 expect() calls.
- `bun run typecheck` (full repo: cli + web + hub) — green.
- `bash scripts/check-no-cut-agents.sh` — `Phase 10 guard PASS.`
- `rg -n 'getConfiguration\(|configuration\._set' hub/src --glob '!**/*.test.ts' --glob '!hub/src/configuration.ts'` — zero hits.
- `rg -n 'cachedOwnerId' hub/src/config/ownerId.ts` — zero hits.
- `rg -n 'constantTimeEquals' hub/src/web/routes/cli.ts hub/src/web/routes/auth.ts hub/src/socket/server.ts` — at least one hit per file.

## Self-Check: PASSED

- Files created: `.planning/phases/10-config-cleanup/10-02-SUMMARY.md` ✓
- Commit `3862438`: `feat(10-02): replace Hub Configuration singleton with loadConfig() factory` — verified via `git log --oneline -1`.
- All acceptance criteria from `<acceptance_criteria>` blocks pass.
- All success criteria from the plan's `<success_criteria>` block pass.
