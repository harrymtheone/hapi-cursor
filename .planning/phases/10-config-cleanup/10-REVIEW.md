---
phase: 10-config-cleanup
status: issues_found
depth: standard
files_reviewed: 57
diff_base: 3878177
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
reviewer: gsd-code-review (subagent dispatch)
completed: 2026-05-23
---

# Phase 10 Code Review — config-cleanup

Scope: source files touched by Phase 10 plan commits (`3878177..HEAD`, paths under
`cli/src/`, `hub/src/`, `shared/src/`, `scripts/`). Planning artifacts excluded.

## Summary

- **0 Critical** — No security regressions in the singleton → factory cutover.
  `constantTimeEquals` callsites are preserved verbatim in `hub/src/web/routes/{cli,auth}.ts`
  and `hub/src/socket/server.ts`. Token / `jwtSecret` / `ownerId` flow through DI without
  ever being interpolated into error messages or logs. `loadConfig()` returns a deeply
  frozen `Config` (verified by both `cli/src/configuration.test.ts` and
  `hub/src/configuration.test.ts`).
- **2 Warning** — Test-coverage weaknesses around the REFC-01 regression guard and
  cross-package source coupling.
- **5 Info** — Sequencing nit in `runCli` bootstrap, redundant re-resolution in the
  runner version check, intentional-but-fragile duplication of `happyHomeDir`
  precedence in RPC helpers, hub-side malformed-settings coverage gap, and a logger
  bootstrap window observation.

`bash scripts/check-no-cut-agents.sh` exits 0 with `Phase 10 guard PASS.`
ROADMAP success criteria SC1–SC4 are satisfied. Documented deviations in the
10-03 and 10-04 SUMMARYs are sound.

## Issues

### WR-01 — REFC-01 regression test does not exercise the real `parseHubArgs`

- **File:** `cli/src/runner/runner.integration.test.ts:496-573`
- **Severity:** Warning
- **Category:** Test coverage gap (ROADMAP SC for REFC-01)

The `hapi hub --host/--port env routing (REFC-01 regression)` block is the only test
the 10-03 SUMMARY cites for the REFC-01 / SC1 ROADMAP success criterion. It does two
things:

1. Reads `cli/src/commands/hub.ts` as a string and asserts substring presence of
   `process.env.HAPI_LISTEN_HOST = host` and absence of `WEBAPP_HOST`/`WEBAPP_PORT`.
2. Inlines a private mirror of `parseHubArgs`, runs the mirror on
   `['--host','127.0.0.1','--port','4006']`, and asserts the resulting `process.env`
   writes.

The real `parseHubArgs` (`cli/src/commands/hub.ts:4-21`) is never invoked. A bug
introduced into the production parser (e.g. accidentally swapping `host`/`port`,
losing the `=` form, off-by-one on `args[++i]`) would not trip this test — the
mirror would still pass. The static substring check catches only the env-name
rename, not parser behavior.

```482:573:cli/src/runner/runner.integration.test.ts
 * Plan 10-03 regression guard for Plan 01 Task 2 — VALIDATION.md REFC-01.
 ...
    // Manually replicate parseHubArgs (kept private in hub.ts) — this
    // mirror is the contract we are guarding. If hub.ts changes its
    // parser shape, this test breaks loudly.
    const parsed: { host?: string; port?: string } = {};
    for (let i = 0; i < argvFragment.length; i++) { ... }
```

**Recommendation:** Export `parseHubArgs` from `cli/src/commands/hub.ts` (or invoke
`hubCommand.run({ commandArgs, ... })` against a stubbed dynamic `import` of
`hub/src/index`) and assert env writes from the real function. Keep the static
substring assertions as the env-rename anchor; add a behavioral assertion that
calls the actual code path.

---

### WR-02 — `cli/src/configuration.ts` reaches across packages into `hub/src/`

- **File:** `cli/src/configuration.ts:23`
- **Severity:** Warning
- **Category:** Module boundary / supply-chain coupling

```23:23:cli/src/configuration.ts
import { rejectOldEnvVars } from '../../hub/src/config/serverSettings'
```

The 10-02 SUMMARY decision block explicitly justifies this as "Plan 03 (CLI cutover)
can re-import the same helper rather than duplicate the `OLD_ENV_VARS` table". The
helper is pure (string-keyed env check, no runtime hub deps), so it works.

Risks:

1. **Independent buildability gone.** Any CLI build now transitively pulls
   `hub/src/config/serverSettings.ts`'s import graph. Today `serverSettings.ts`
   imports from `./settings` (which transitively pulls `hub/src/config/settings.ts`).
   If a hub-only dependency creeps into that chain (e.g. a bun-only API), the CLI
   build breaks silently.
2. **Out-of-tree consumers** (the `slopus` package that consumes `cli/src/lib.ts`)
   now ship `hub/src/config/*` transitively.
3. **No guard.** `scripts/check-no-cut-agents.sh` does not enforce the absence of
   `cli/src` → `hub/src/` imports, so this can grow unchecked.

**Recommendation:** Either (a) move `OLD_ENV_VARS` + `rejectOldEnvVars` to a
neutral location (e.g. `shared/src/config/legacyEnvRejection.ts`) and import from
both sides, or (b) accept the coupling but add a Phase-10 guard sub-check (#6)
asserting at most this one `cli/src → hub/src` edge exists.

---

### IN-01 — `bootstrapToken` runs before `rejectOldEnvVars`

- **File:** `cli/src/commands/runCli.ts:36-40`
- **Severity:** Info
- **Category:** Bootstrap sequencing / UX

```36:40:cli/src/commands/runCli.ts
    if (command.requiresAuth) {
        await bootstrapToken(provisionalSettingsFile())
    }

    const config = await loadConfig({ argv: args })
```

If the user has stale `WEBAPP_HOST` / `SERVER_URL` env vars set, `bootstrapToken`
may prompt interactively (or write to `settings.json` via `updateSettings`) before
`loadConfig`'s `rejectOldEnvVars` aborts the run. The user sees a token prompt
they fill in, only to be greeted by a hard env-var rejection on the next line.

Not a security issue (the token is written to a file the user owns; no data
exfiltration), but a confusing UX. Move `rejectOldEnvVars()` to the top of
`runCli` (or have `bootstrapToken` call it first) so the legacy-env error
surfaces before any prompt.

---

### IN-02 — `isRunnerRunningCurrentlyInstalledHappyVersion` re-resolves env > settings > config

- **File:** `cli/src/runner/controlClient.ts:187-194`
- **Severity:** Info
- **Category:** Dead code / TOCTOU

```187:194:cli/src/runner/controlClient.ts
  const settings = await readSettings(config.settingsFile);
  const currentApiUrl = process.env.HAPI_API_URL
    || settings.apiUrl
    || config.apiUrl;
  const currentCliApiToken = process.env.CLI_API_TOKEN
    || settings.cliApiToken
    || config.cliApiToken;
```

`config` already encodes `process.env.HAPI_API_URL > settings.apiUrl > 'http://localhost:3006'`
(see `cli/src/configuration.ts:142-143`). The triple chain here always resolves to
the same value `config.apiUrl` / `config.cliApiToken` would have produced — unless
`settings.json` is mutated between `loadConfig` and this call (which is precisely
the TOCTOU the frozen `Config` model is meant to prevent).

Either drop the `readSettings` + chain (just use `config.apiUrl` /
`config.cliApiToken`) or document why this function intentionally re-reads.
The pre-Phase-10 implementation read the live singleton; the post-Phase-10
intent should be "trust the frozen Config".

---

### IN-03 — `ripgrep` / `difftastic` `happyHomeDir` derivation duplicates `loadConfig` precedence

- **Files:** `cli/src/modules/ripgrep/index.ts:13-17`, `cli/src/modules/difftastic/index.ts` (same pattern)
- **Severity:** Info
- **Category:** Cross-module invariant drift risk

SUMMARY-disclosed deviation. The local `happyHomeDirFromEnv()` mirrors
`loadConfig`'s `process.env.HAPI_HOME ? ... : join(homedir(), '.hapi')` precedence.

```13:17:cli/src/modules/ripgrep/index.ts
function happyHomeDirFromEnv(): string {
    return process.env.HAPI_HOME
        ? process.env.HAPI_HOME.replace(/^~/, homedir())
        : join(homedir(), '.hapi');
}
```

If Phase-11+ extends `loadConfig`'s precedence (e.g. honoring a
`settings.json::happyHomeDir`, or a different env-var name), these helpers will
silently diverge. The threat is invisible — RPC handlers won't error, they'll
just look in the wrong directory for `tools/unpacked/rg`.

**Recommendation:** Extract a shared `resolveHappyHomeDirFromEnv()` helper
(e.g. in `cli/src/configuration.ts` next to `loadConfig`) and import it from
both `loadConfig` and the RPC modules. A future change then updates one place.

---

### IN-04 — Hub `configuration.test.ts` lacks a malformed-`settings.json` coverage case

- **File:** `hub/src/configuration.test.ts`
- **Severity:** Info
- **Category:** Test parity

`cli/src/configuration.test.ts` covers D-167 (malformed `settings.json` → throw
naming path). The hub-side `loadConfig` delegates to `loadServerSettings` →
`readSettings`, which returns `null` on malformed JSON and is then converted to
`throw new Error('Cannot read ${settingsFile}. ...')` in
`hub/src/config/serverSettings.ts:135-139`. That path is unit-tested in
`hub/src/config/serverSettings.test.ts` (per Plan 02 SUMMARY), but
`configuration.test.ts` does not assert the integration — i.e. a malformed
file caught by `loadConfig` end-to-end. The CLI side does.

Low risk (the underlying behavior is tested), but adding one
`loadConfig`-level malformed-file case in `hub/src/configuration.test.ts`
would close the parity gap with the CLI test suite.

---

### IN-05 — Logger fallback writes errors from `loadConfig` itself to the pre-init path

- **File:** `cli/src/ui/logger.ts:192-210`, `cli/src/commands/runCli.ts:40-41`
- **Severity:** Info
- **Category:** Observability

The logger singleton is constructed at module import via `makeFallbackLogger()`,
then replaced via `initializeLogger(config)` *after* `loadConfig()` returns. An
error thrown by `loadConfig` (rejection of `WEBAPP_*`, malformed
`settings.json`, mkdir failure, etc.) is therefore logged to the
`HAPI_HOME`-or-`~/.hapi/logs` fallback path, not the path that
`config.logsDir` would later resolve to.

In normal operation these are the same directory. In edge cases (custom
`HAPI_HOME`, run-as-different-user, etc.) the operator may look in the
"production" logsDir and not find the bootstrap error. This is the
SUMMARY-disclosed deviation ("logger remains a mutable singleton") and is
acceptable per D-170 scope. Documenting it here so it does not surprise
future operators.

---

## Documented deviations — soundness check

| Deviation (SUMMARY) | Verdict | Note |
|---------------------|---------|------|
| 10-03: `logger` kept as mutable module-level singleton, fed via `initializeLogger(config)` | **Sound** | D-170 ban is on the *config* singleton; logger is fed from the frozen Config, fallback covers bootstrap window. See IN-05. |
| 10-03: RPC binary helpers (`ripgrep`, `difftastic`) use `process.env.HAPI_HOME` locally | **Sound, with reservation** | Behavior is identical to `loadConfig`. Future drift risk — see IN-03. |
| 10-04: guard sub-check #5 narrowed to symbol pattern (`getConfiguration()` / `import { configuration }`) | **Sound** | The plan's broader module-path pattern would false-positive on every legitimate `import type { Config }` and `import { loadConfig }`. The narrowed pattern hits the deleted symbol exactly. Verified: `bash scripts/check-no-cut-agents.sh` exits 0. |
| 10-04: sub-check #1 whitelist extended to `cli/src/configuration.ts` (in addition to `**/serverSettings.ts`) | **Sound** | The CLI mirror file has its own `OLD_CLI_SETTINGS_FIELDS = ['serverUrl'] as const` rejection array — same intent as the hub's `OLD_SETTINGS_FIELDS`. |
| 10-02: `cachedOwnerId` cache deleted; `getOrCreateOwnerId` called once in `main()` | **Sound** | Verified: exactly one production caller (`hub/src/index.ts:144`). |
| 10-04: Task 1 (`cli/src/lib.ts`) no-op because Plan 03 already swapped the export | **Sound** | Verified — `cli/src/lib.ts` exports `loadConfig`, `type Config`, `initializeLogger` and does NOT export the deleted `configuration` singleton. |
| 10-04: D-174 NO BUMP for `SCHEMA_VERSION` | **Sound** | Verified by `git diff 3878177..HEAD -- hub/src/store/ shared/src/wire/` — only test-file additions. No persisted-decoder tightening. |

## ROADMAP success criteria — verification

- **SC1** (no legacy-field / setter / alias residue) — guard sub-checks #1–#3, #5 all green.
- **SC2** (`Store` schema-mismatch error completeness + no runtime migration-v*.ts) —
  guard sub-check #4 green; `hub/src/store/index.test.ts:53` asserts
  `toMatch(/offline migration|rebuild/i)` in addition to DB path / expected /
  found assertions. **WR-01 caveat does not apply to SC2.**
- **SC3** (`loadConfig` is canonical entry; no singleton imports outside whitelist) —
  guard sub-check #5 green.
- **SC4** (`bun run typecheck && bun run test` green; frozen-Config tests landed) —
  `cli/src/configuration.test.ts` and `hub/src/configuration.test.ts` both active,
  covering deep-freeze + legacy-env-var rejection. (See WR-01 for the REFC-01 sub-criterion
  coverage caveat.)

## Files reviewed (57)

All paths under `cli/src/`, `hub/src/`, `scripts/check-no-cut-agents.sh` modified
between `3878177` and HEAD. Includes:

- Hub: `configuration.ts` + `.test.ts`, `config/{serverSettings,jwtSecret,ownerId}.ts`,
  `index.ts`, `socket/server.ts`, `web/server.ts`, `web/routes/{auth,cli}.ts`,
  `store/index.test.ts`.
- CLI: `configuration.ts` + `.test.ts`, `persistence.ts`, `commands/{runCli,hub,registry,auth,cursor,resume,runner,doctor,types}.ts`,
  `api/{api,apiSession,apiMachine,auth,hubExtraHeaders}.ts` + tests,
  `runner/{run,controlClient,runner.integration.test}.ts`,
  `agent/sessionFactory.ts` + test, `cursor/runCursor.ts`,
  `ui/{logger,doctor,auth,tokenInit}.ts` + tests, `lib.ts`, `projectPath.ts`,
  `runtime/assets.ts`, `utils/autoStartServer.ts`,
  `modules/{ripgrep,difftastic}/index.ts`,
  `modules/common/hooks/generateHookSettings.ts`,
  `__fixtures__/config.ts` (new).
- Scripts: `scripts/check-no-cut-agents.sh`.

`cli/src/ui/apiUrlInit.ts` deletion verified (file absent on disk).
