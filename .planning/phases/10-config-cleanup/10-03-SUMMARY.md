---
phase: 10-config-cleanup
plan: 03
subsystem: cli/configuration
tags: [refactor, di, config, security, test]
requires: [10-01, 10-02]
provides:
  - cli/src/configuration.ts::loadConfig
  - cli/src/configuration.ts::Config
  - cli/src/ui/tokenInit.ts::bootstrapToken
  - cli/src/__fixtures__/config.ts::makeConfig
affects:
  - cli/src/commands/runCli.ts (entry-point DI root; bootstrap-then-freeze)
  - cli/src/commands/types.ts (CommandContext.config)
  - cli/src/commands/{auth,cursor,resume,runner,doctor}.ts (run() threads config)
  - cli/src/api/{api,apiSession,apiMachine,auth,hubExtraHeaders}.ts (constructor / function DI)
  - cli/src/runner/{run,controlClient}.ts (RunnerConfig / ControlClientConfig DI)
  - cli/src/agent/sessionFactory.ts (SessionFactoryConfig DI)
  - cli/src/cursor/runCursor.ts (config parameter)
  - cli/src/ui/{logger,doctor,auth}.ts (initializeLogger / DoctorConfig / Pick<Config>)
  - cli/src/utils/autoStartServer.ts (AutoStartConfig DI)
  - cli/src/projectPath.ts (happyHomeDir parameter)
  - cli/src/runtime/assets.ts (happyHomeDir via Pick<Config>)
  - cli/src/modules/common/hooks/generateHookSettings.ts (happyHomeDir parameter)
  - cli/src/modules/{ripgrep,difftastic}/index.ts (happyHomeDirFromEnv local helper)
  - cli/src/persistence.ts (settingsFile parameterized; D-167 fail-fast)
  - cli/src/lib.ts (exports initializeLogger + type Config; drops `configuration`)
  - cli/src/ui/apiUrlInit.ts (deleted)
tech_stack:
  added: []
  patterns:
    - deep-freeze helper (recursive Object.freeze)
    - bootstrap-then-freeze (D-169)
    - narrowest Pick<Config, ...> per consumer
    - shared rejectOldEnvVars helper (re-used from Plan 02 hub)
    - test config factory (makeConfig) replacing vi.mock of the singleton
key_files:
  created:
    - .planning/phases/10-config-cleanup/10-03-SUMMARY.md
    - cli/src/__fixtures__/config.ts
  modified:
    - cli/src/configuration.ts
    - cli/src/configuration.test.ts
    - cli/src/persistence.ts
    - cli/src/ui/tokenInit.ts
    - cli/src/commands/runCli.ts
    - cli/src/commands/types.ts
    - cli/src/commands/registry.ts
    - cli/src/commands/auth.ts
    - cli/src/commands/cursor.ts
    - cli/src/commands/resume.ts
    - cli/src/commands/runner.ts
    - cli/src/commands/doctor.ts
    - cli/src/api/api.ts
    - cli/src/api/apiSession.ts
    - cli/src/api/apiMachine.ts
    - cli/src/api/auth.ts
    - cli/src/api/hubExtraHeaders.ts
    - cli/src/ui/logger.ts
    - cli/src/ui/doctor.ts
    - cli/src/ui/auth.ts
    - cli/src/runner/run.ts
    - cli/src/runner/controlClient.ts
    - cli/src/runner/runner.integration.test.ts
    - cli/src/agent/sessionFactory.ts
    - cli/src/agent/sessionFactory.test.ts
    - cli/src/cursor/runCursor.ts
    - cli/src/utils/autoStartServer.ts
    - cli/src/projectPath.ts
    - cli/src/runtime/assets.ts
    - cli/src/modules/common/hooks/generateHookSettings.ts
    - cli/src/modules/ripgrep/index.ts
    - cli/src/modules/difftastic/index.ts
    - cli/src/lib.ts
    - cli/src/api/api.extraHeaders.test.ts
    - cli/src/api/hubExtraHeaders.test.ts
    - cli/src/commands/auth.test.ts
    - cli/src/commands/resume.test.ts
    - cli/src/ui/doctor.test.ts
    - cli/src/ui/logger.test.ts
  deleted:
    - cli/src/ui/apiUrlInit.ts
decisions:
  - "Tasks 1 + 2 committed as a single coordinated commit (mirror of Plan 02's Hub cutover cadence). Splitting per consumer would leave `bun typecheck` red between commits because the singleton export is deleted in Task 1."
  - "RPC-side binary helpers (`cli/src/modules/{ripgrep,difftastic}/index.ts`) derive `happyHomeDir` from `process.env.HAPI_HOME` via a tiny local `happyHomeDirFromEnv()` helper rather than threading `Config` through the entire RPC dispatcher. This keeps deep RPC handlers decoupled from the Config object while honoring the exact precedence used by `loadConfig` — and avoids a 5+ file DI chain through code paths that have no other config dependency."
  - "`logger` remains a mutable singleton export but is fed via `initializeLogger(config)` after `loadConfig` resolves; `makeFallbackLogger()` covers the bootstrap window (any error before `loadConfig` returns). This preserves the deeply-ingrained `import { logger }` convention without re-introducing a Configuration singleton (D-170 is about the *config* singleton, not all module-level state)."
  - "`bootstrapToken(settingsFile)` writes to `~/.hapi/settings.json` BEFORE `loadConfig` is called, so the token persistence happens through `updateSettings(settingsFile, ...)` and the resulting Config picks up the freshly-written value during its `readSettings` pass. This is the D-169 bootstrap-then-freeze flow."
  - "`runCli` derives `provisionalSettingsFile` from `HAPI_HOME` / `homedir()` with the same precedence as `loadConfig` so the path passed to `bootstrapToken` matches the path used by `loadConfig`'s later `readSettings`."
metrics:
  duration_minutes: 35
  completed: 2026-05-23
  files_modified: 38
  files_created: 2
  files_deleted: 1
  cli_singleton_callsites_converted: "30+ across 18 files"
---

# Phase 10 Plan 03: CLI loadConfig() + DI cutover Summary

Replaced the CLI `Configuration` singleton with `loadConfig(): Promise<Config>` returning a deeply frozen `Config`, refactored `tokenInit` into a pre-freeze `bootstrapToken` step, threaded the loaded `Config` from `runCli` through every CLI consumer (30+ callsites across 18 files), rewrote the four singleton-mocking tests to use a `makeConfig` factory fixture, and added the `hapi hub --host/--port` integration regression test required by `10-VALIDATION.md` (REFC-01).

## What landed

### Task 1 — `loadConfig()` + `bootstrapToken()` + parameterized `persistence.ts`

`cli/src/configuration.ts` rewrite:
- Deleted: `Configuration` class, `_setApiUrl` / `_setCliApiToken` / `_setExtraHeaders` setters, singleton `configuration` export.
- Added: `Config` type (frozen `Readonly<{...}>` matching the interfaces block of the plan), private `deepFreeze<T>` helper, private `rejectOldCliSettingsFields(parsed, settingsFile)` (rejects legacy `serverUrl` naming `serverUrl` + `apiUrl` + the settings file path — D-160), and `export async function loadConfig(): Promise<Config>`.
- `loadConfig` calls the shared `rejectOldEnvVars()` from `hub/src/config/serverSettings.ts` (added in Plan 02) so legacy `WEBAPP_*` / `SERVER_URL` produce the canonical error.
- Precedence: `process.env.HAPI_API_URL` > `settings.apiUrl` > `'http://localhost:3006'`; `process.env.CLI_API_TOKEN` > `settings.cliApiToken` > empty string; `extraHeaders` via `parseExtraHeaders(process.env.HAPI_EXTRA_HEADERS_JSON)`.
- `extraHeaders` is `Object.freeze({...parsed})` and the outer object is `deepFreeze({...})` — top-level + nested mutation both throw `TypeError`.
- `mkdirSync(happyHomeDir, { recursive: true })` and `mkdirSync(logsDir, { recursive: true })` execute inside `loadConfig` (Pitfall 6 — not at module top-level).

`cli/src/persistence.ts`:
- `readSettings(settingsFile)`, `writeSettings(settingsFile, settings)`, `updateSettings(settingsFile, updater)` all take the path as the first parameter; `import { configuration }` dropped.
- Legacy `serverUrl?: string` field deleted from `Settings`.
- Silent `catch { return defaults }` replaced with a throw whose message names the settings file path (D-167).

`cli/src/ui/tokenInit.ts`:
- Renamed `initializeToken` → `bootstrapToken(settingsFile)`.
- Two `configuration._setCliApiToken(...)` callsites removed; token is persisted via `updateSettings(settingsFile, ...)` and re-read by `loadConfig` during the subsequent freeze pass.

`cli/src/configuration.test.ts`:
- Flipped from `describe.skip` to active. Four cases cover deeply-frozen Config (D-164), legacy `serverUrl` rejection (D-160), `WEBAPP_HOST` env rejection (D-161), and malformed `settings.json` rejection (D-167). Each test isolates `HAPI_HOME` via `mkdtempSync` + restores the surrounding env in `afterEach`. Per threat T-10-03-02, no test asserts on `cliApiToken` values inside any error message.

### Task 2 — entry-point DI + cutover of all 30+ CLI singleton callsites

`cli/src/commands/runCli.ts` — bootstrap-then-freeze:
```
resolveCommand(args)                      // may throw on retired commands (Plan 01)
if (command.requiresAuth)
  await bootstrapToken(provisionalSettingsFile())
const config = await loadConfig()         // frozen from here on
initializeLogger(config)
await ensureRuntimeAssets(config)
await command.run({ ...context, config })
```

`provisionalSettingsFile` is derived from `HAPI_HOME` / `homedir()` with the exact same precedence as `loadConfig`'s own resolution, so the path written by `bootstrapToken` is the same path read by `loadConfig`.

`CommandContext` (in `cli/src/commands/types.ts`) gains `config: Config`. Every command's `run()` destructures `context.config` and threads the narrowest `Pick<Config, ...>` slice down to its dependencies:

- **API layer** — `ApiClient.create(config: Pick<Config, 'apiUrl'|'cliApiToken'|'extraHeaders'>)`; `new ApiSessionClient(token, session, config: Pick<Config, 'apiUrl'|'extraHeaders'>)`; `new ApiMachineClient(token, machine, config: Pick<Config, 'apiUrl'|'extraHeaders'>, ...)`; `getAuthToken(config: Pick<Config, 'cliApiToken'>)`; `buildHubRequestHeaders(extraHeaders, base)`; `buildSocketIoExtraHeaderOptions(extraHeaders)`.
- **Runner layer** — `startRunner(config: RunnerConfig, opts)` and every `controlClient` helper (`runnerPost`, `notifyRunnerSessionStarted`, `listRunnerSessions`, `stopRunnerSession`, `spawnRunnerSession`, `stopRunnerHttp`, `checkIfRunnerRunningAndCleanupStaleState`, `isRunnerRunningCurrentlyInstalledHappyVersion`, `cleanupRunnerState`, `stopRunner`) takes the slice it needs (e.g. `runnerStateFile`, `runnerLockFile`, `cliApiToken`, `apiUrl`).
- **Agent + cursor** — `buildMachineMetadata`, `buildSessionMetadata`, `bootstrapSession`, `bootstrapExistingSession`, and `runCursor` accept a `SessionFactoryConfig` slice.
- **UI** — `logger` is initialised via `initializeLogger(config)` (with a `makeFallbackLogger()` covering the bootstrap window); `listRunnerLogFiles(logsDir, runnerStateFile)` and `getLatestRunnerLog(logsDir, runnerStateFile)` take explicit paths; `authAndSetupMachineIfNeeded(config: Pick<Config, 'cliApiToken'|'settingsFile'>)`; `getEnvironmentInfo` / `runDoctorRunner` / `runDoctorCommand` take a `DoctorConfig` slice.
- **Utils + paths** — `maybeAutoStartServer(config: AutoStartConfig)`; `runtimePath(happyHomeDir)`; `generateHookSettingsFile(happyHomeDir, port, token, options)`.
- **Runtime assets** — `ensureRuntimeAssets(config: Pick<Config, 'happyHomeDir'>)`.

`cli/src/ui/apiUrlInit.ts` is **deleted** — its silent `serverUrl` migration branch is replaced by `loadConfig`'s explicit `rejectOldCliSettingsFields([serverUrl])`.

`cli/src/lib.ts` drops the `configuration` re-export and instead exports `initializeLogger` and `type Config`.

### Task 3 — `makeConfig` factory fixture + `hapi hub --host/--port` regression test

`cli/src/__fixtures__/config.ts` (new): `makeConfig(overrides?: Partial<Config>): Config` returns a deeply-frozen Config literal with safe test defaults (`apiUrl: 'http://localhost:3006'`, `cliApiToken: 'test-token'`, frozen empty `extraHeaders`, `/tmp/.hapi-test/*` paths, `currentCliVersion: '0.0.0-test'`). Both the outer object and the nested `extraHeaders` are `Object.freeze`d so the fixture matches the production Config invariant.

Four singleton-mocking tests rewritten:
- `cli/src/api/api.extraHeaders.test.ts` — `ApiClient.create(makeConfig({extraHeaders: {...}}))` + `new ApiSessionClient('token', session, makeConfig(...))`.
- `cli/src/api/hubExtraHeaders.test.ts` — `extraHeaders` passed explicitly to `buildHubRequestHeaders` / `buildSocketIoExtraHeaderOptions`; no module-level mocks remain.
- `cli/src/commands/auth.test.ts` — `handleAuthCommand(makeConfig({apiUrl, settingsFile}), args)`.
- `cli/src/commands/resume.test.ts` — `createContext` builds a `Config` via `makeConfig()`; `runCursor` expectations updated for the new `config` parameter.

`cli/src/runner/runner.integration.test.ts` gains a new `describe('hapi hub --host/--port env routing (REFC-01 regression)')` block that:
1. Statically asserts `cli/src/commands/hub.ts` writes to `process.env.HAPI_LISTEN_HOST` / `HAPI_LISTEN_PORT` and **does NOT mention** `WEBAPP_HOST` / `WEBAPP_PORT` — locks the Plan 01 env rename in source.
2. Mirrors the inline `parseHubArgs` shape (`--host 127.0.0.1 --port 4006`) and asserts the resulting `process.env.HAPI_LISTEN_HOST === '127.0.0.1'` / `HAPI_LISTEN_PORT === '4006'`.
3. Snapshots and restores all four env vars in `beforeEach` / `afterEach` so no global state leaks across tests.

## Deviations from Plan

- **Logger remains a singleton export.** The plan listed `cli/src/ui/logger.ts` in the consumer cutover. I refactored `Logger` to accept `logFilePath` + `logsDir` via its constructor and added `initializeLogger(config)` for runtime configuration, but kept `export let logger: Logger = makeFallbackLogger()` because the codebase has hundreds of `import { logger }` callsites and replacing all of them with DI through every function call chain would balloon the diff well past the plan's intent. This is consistent with D-170's focus on the *config* singleton, not all module-level state, and the fallback logger correctly handles the pre-bootstrap window.
- **RPC binary helpers use an env helper.** `cli/src/modules/{ripgrep,difftastic}/index.ts::getBinaryPath` derive `happyHomeDir` from `process.env.HAPI_HOME` via a local `happyHomeDirFromEnv()` helper instead of receiving `Config` via the RPC dispatcher. This was flagged as a planner-discretion call in the plan's `<behavior>` block ("planner's choice"); threading Config through the RPC layer would have required modifying ~5 unrelated files. The helper uses the same precedence as `loadConfig`, so behavior is identical.
- **Three additional test files updated** (`cli/src/agent/sessionFactory.test.ts`, `cli/src/ui/doctor.test.ts`, `cli/src/ui/logger.test.ts`) beyond the four singleton-mock tests called out in Task 3. These updates were mechanical consequences of the Task 2 DI cutover (callers now require explicit `Config` arguments) and were bundled into the Task 1+2 commit so `bun typecheck` and `bun run test:cli` stayed green between commits.

## Threat Model Compliance

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| T-10-03-01 (Spoofing — legacy `serverUrl`) | mitigated | `rejectOldCliSettingsFields(['serverUrl'])` throws with `serverUrl`, `apiUrl`, and the settings file path in the message. Asserted by `cli/src/configuration.test.ts` test #2. |
| T-10-03-02 (Info disclosure — token in errors) | mitigated | All `throw new Error(...)` in `loadConfig` and `persistence.readSettings` reference field/env names + the settings file path only. The `cliApiToken` value is resolved AFTER `rejectOldEnvVars` + `rejectOldCliSettingsFields` + JSON parsing, so it cannot appear in any thrown message. No test asserts on token values inside error strings. |
| T-10-03-03 (Tampering — frozen Config) | mitigated | `deepFreeze` recursively freezes; `extraHeaders` independently `Object.freeze`d. Asserted by `configuration.test.ts` test #1 (top-level + nested mutation both throw `TypeError`). |
| T-10-03-04 (Tampering — malformed settings.json) | mitigated | D-167. Both `loadConfig` and `persistence.readSettings` throw on unreadable / invalid-JSON settings naming the file path. Asserted by `configuration.test.ts` test #4. |
| T-10-03-05 (Spoofing — stale `WEBAPP_*` env vars) | mitigated | `rejectOldEnvVars` (re-used from Plan 02 hub) throws naming the new env var. Asserted by `configuration.test.ts` test #3 (`WEBAPP_HOST` → message contains `HAPI_LISTEN_HOST`). |
| T-10-03-06 (Test fixture defaults) | accepted | `cli/src/__fixtures__/config.ts` lives under `__fixtures__/` (clearly non-production) and uses literal `'test-token'` + `/tmp/.hapi-test/*` paths. |
| T-10-03-SC (Supply chain) | n/a | No new packages added in this plan. |

## Verification

- `cd cli && bun run typecheck` — green.
- `bun run test:cli` — 246 pass / 12 skipped / 0 fail across 39 test files.
- `bun run test:hub` — 223 pass / 0 fail (untouched by this plan; sanity check).
- `bash scripts/check-no-cut-agents.sh` — ends with `Phase 10 guard PASS`.
- `rg -n "from ['\"]@/configuration['\"]" cli/src --glob '!**/*.test.ts' --glob '!cli/src/configuration.ts' --glob '!cli/src/commands/types.ts'` — only `import type { Config }` references survive (no singleton imports).
- `rg -n 'class Configuration|export const configuration|_setApiUrl|_setCliApiToken|_setExtraHeaders' cli/src/configuration.ts` — zero hits.
- `rg -n 'export async function loadConfig' cli/src/configuration.ts` — exactly one hit.
- `rg -n 'export (async )?function bootstrapToken' cli/src/ui/tokenInit.ts` — exactly one hit.
- `rg -n '\bserverUrl\b' cli/src/persistence.ts` — zero hits.
- `test ! -e cli/src/ui/apiUrlInit.ts` — succeeds.
- `rg -n 'initializeApiUrl' cli/src` — zero hits.
- `rg -n "vi\.mock\(['\"]@/configuration['\"]" cli/src` — zero hits (only a comment reference in `__fixtures__/config.ts` itself).
- `rg -n 'HAPI_LISTEN_HOST' cli/src/runner/runner.integration.test.ts` — at least one hit.
- `rg -n 'await loadConfig\(' cli/src/commands/runCli.ts` — exactly one hit (loaded exactly once at entry per Pitfall 2).

## Self-Check: PASSED

- Files created: `.planning/phases/10-config-cleanup/10-03-SUMMARY.md` and `cli/src/__fixtures__/config.ts`.
- Files deleted: `cli/src/ui/apiUrlInit.ts`.
- Commits (verified via `git log --oneline -3`):
  - `e7018a8` — `refactor(10-03): replace CLI Configuration singleton with loadConfig() factory + DI cutover` (Tasks 1+2 coordinated)
  - `255867d` — `test(10-03): replace vi.mock('@/configuration') with makeConfig() factory + hub --host/--port regression` (Task 3)
- All acceptance criteria from every `<acceptance_criteria>` block satisfied.
- All success criteria from the plan's `<success_criteria>` block satisfied.
