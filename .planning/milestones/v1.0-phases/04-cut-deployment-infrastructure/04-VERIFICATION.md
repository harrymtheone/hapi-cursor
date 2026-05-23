---
phase: 04-cut-deployment-infrastructure
verified: 2026-05-21T09:59:43Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
---

# Phase 04: Cut Deployment Infrastructure Verification Report

**Phase Goal:** Hub no longer ships a built-in WireGuard/TLS tunnel binary or an upstream remote-log upload channel.
**Verified:** 2026-05-21T09:59:43Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Hub startup cannot start, wait for, log, or stop a built-in relay tunnel. | VERIFIED | `hub/src/tunnel/` is absent. `hub/src/index.ts` imports only local hub subsystems and contains no `TunnelManager`, `waitForTunnelTlsReady`, `resolveRelayFlag`, relay CLI args, QR rendering, direct-access URL, or tunnel shutdown path. |
| 2 | Hub startup still prints local and `HAPI_PUBLIC_URL` text for Tailscale users. | VERIFIED | `hub/src/index.ts` logs `HAPI_PUBLIC_URL`, local URL, and public URL from `config.publicUrl`; `hub/src/config/serverSettings.ts` preserves env/file/default `publicUrl` with `sources.publicUrl = 'env'` when env-sourced. |
| 3 | The web server serves hub-local embedded/static PWA assets, not a hosted relay entry. | VERIFIED | `hub/src/web/server.ts` routes API/CLI locally, serves embedded assets in compiled mode, falls back to `web/dist`, and has no `relayMode`, `officialWebUrl`, `app.hapi.run`, or hosted-web early return branch. |
| 4 | Hub configuration no longer reads or reports `HAPI_RELAY_*` values. | VERIFIED | `hub/src/configuration.ts`, `hub/src/config/settings.ts`, and `hub/src/config/serverSettings.ts` contain no `HAPI_RELAY_` env reads or relay config output; legacy relay settings keys are used only in `OLD_SETTINGS_FIELDS` rejection. |
| 5 | Old relay settings fail explicitly when represented in settings validation. | VERIFIED | `hub/src/config/serverSettings.ts` rejects `relayApi`, `relayAuth`, `relayForceTcp`, and `relayEnabled`; focused `hub/src/config/serverSettings.test.ts` passed with 6 tests. |
| 6 | CLI logger writes locally and never uploads logs to `HAPI_API_URL`. | VERIFIED | `cli/src/ui/logger.ts` writes through `appendFileSync` and has no `fetch(`, `sendToRemoteServer`, remote URL field, or dangerous env gate. `cli/src/ui/logger.test.ts` proves fetch is not called with legacy env plus `HAPI_API_URL`. |
| 7 | The dangerous remote-log env flag no longer changes runtime behavior. | VERIFIED | The removed env name is constructed only in tests to prove no effect; production logger and doctor code do not read it. |
| 8 | Doctor output no longer surfaces the remote-log toggle. | VERIFIED | `cli/src/ui/doctor.ts` reports normal environment/config diagnostics and no dangerous remote-log toggle; `cli/src/ui/doctor.test.ts` verifies absence even when the legacy env is set. |
| 9 | Legitimate direct-connect `HAPI_API_URL` usage remains outside the removed logger upload path. | VERIFIED | `cli/src/ui/doctor.ts` still reports `HAPI_API_URL`, `cli/src/ui/apiUrlInit.ts` still initializes direct-connect API URL, and logger has no network upload path. |
| 10 | Single-exe build no longer downloads, extracts, chmods, embeds, or references tunwg. | VERIFIED | `hub/scripts/download-tunwg.ts` and `hub/tools/tunwg/` are absent. Root `build:single-exe` scripts run web build, embedded web asset generation, and CLI compile only. Verifier-run `bun run build:single-exe` passed, and build output scan found no tunwg/download-tunwg/hub-tools-tunwg references. |
| 11 | QR-only hub runtime dependencies are removed after QR runtime deletion. | VERIFIED | `hub/package.json` has no `qrcode` or `@types/qrcode`; `hub/src/index.ts` has no QR import/rendering. `bun pm why qrcode` shows the remaining lockfile `qrcode` entry is a VitePress docs optional peer via `@vueuse/integrations`, not a hub runtime dependency. |
| 12 | Existing runtime asset pipeline still handles ripgrep and difftastic. | VERIFIED | `cli/src/runtime/assets.ts` unpacks `difftastic-${platformDir}.tar.gz` and `ripgrep-${platformDir}.tar.gz`; `cli/src/runtime/embeddedAssets.bun.ts` embeds only difftastic/ripgrep archives and licenses; `cli/src/commands/runCli.ts` still calls `ensureRuntimeAssets()` when commands require assets. |
| 13 | Phase 04 forbidden keywords are blocked by a fail-closed guard and explicit scans. | VERIFIED | `scripts/check-no-cut-agents.sh` defines Phase 04 hard/sweep patterns with a tight whitelist. Verifier-run `bash scripts/check-no-cut-agents.sh` passed. Direct `rg` scans found hard/sweep hits only in planning artifacts and the guard itself. |
| 14 | The full phase gate passes. | VERIFIED | Verifier-run `bun typecheck && bun run test && bun run build:single-exe` exited 0. `bun run test` includes `test:guard`, and a separate guard spot-check also passed. |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hub/src/tunnel/` | Deleted tunnel implementation directory | VERIFIED | Directory absent. |
| `hub/src/index.ts` | Hub startup without tunnel lifecycle, relay args/env, QR, token-bearing hosted URL | VERIFIED | Substantive startup wiring remains; no relay/tunnel/QR runtime symbols found. |
| `hub/src/web/server.ts` | Local embedded/static web server without hosted relay options | VERIFIED | API routes, CORS, embedded assets, and dist fallback remain; hosted relay branch absent. |
| `web/src/lib/relay-mode*` | Deleted hosted relay-mode helpers | VERIFIED | No matching files under `web/src/lib`. |
| `hub/src/config/serverSettings.ts` | Relay-free settings loader with `HAPI_PUBLIC_URL` preserved | VERIFIED | No relay env reads; public URL source tracking retained; old relay settings rejected. |
| `hub/src/config/settings.ts` | Settings shape without relay fields | VERIFIED | `Settings` includes local/public URL fields only; no relay fields. |
| `hub/src/configuration.ts` | Configuration facade without relay settings output | VERIFIED | Optional env comment and runtime config expose `HAPI_PUBLIC_URL`, not relay envs. |
| `hub/src/config/serverSettings.test.ts` | Regression coverage for legacy relay settings/env behavior | VERIFIED | Tests cover old relay settings rejection and no-effect legacy env vars. |
| `cli/src/ui/logger.ts` | Local-only CLI logger | VERIFIED | File logging via `appendFileSync`; no network upload implementation. |
| `cli/src/ui/logger.test.ts` | Regression test for no fetch with legacy env plus `HAPI_API_URL` | VERIFIED | Focused verifier-run test passed. |
| `cli/src/ui/doctor.ts` | Doctor diagnostics without remote-log toggle | VERIFIED | Direct-connect diagnostics preserved; dangerous toggle absent. |
| `cli/src/ui/doctor.test.ts` | Regression test for doctor output | VERIFIED | Focused verifier-run test passed. |
| `package.json` | Single-exe scripts without `download:tunwg` | VERIFIED | `build:single-exe` and `build:single-exe:all` contain no tunwg step. |
| `hub/package.json` | Hub dependencies without direct QR packages | VERIFIED | No `qrcode` or `@types/qrcode` direct dependency. |
| `bun.lock` | Lockfile aligned with direct package removals | VERIFIED | Direct hub QR packages removed; residual `qrcode` is docs tooling optional peer, not hub runtime. |
| `hub/scripts/download-tunwg.ts` | Deleted tunwg download script | VERIFIED | File absent. |
| `hub/tools/tunwg/` | Deleted tracked tunwg runtime asset directory | VERIFIED | Directory absent. |
| `cli/src/runtime/assets.ts` | Runtime assets without tunwg helpers | VERIFIED | Handles ripgrep/difftastic archives only. |
| `cli/src/runtime/embeddedAssets.bun.ts` | Embedded manifest without tunwg assets | VERIFIED | Imports and returns difftastic/ripgrep archives and licenses only. |
| `cli/src/types/assetImports.d.ts` | Asset declarations without tunwg-specific modules | VERIFIED | Generic asset declarations only. |
| `scripts/check-no-cut-agents.sh` | Fail-closed Phase 04 residue guard | VERIFIED | Guard passed and includes Phase 04 hard/sweep patterns. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `hub/src/index.ts` | `hub/src/web/server.ts` | `startWebServer` options | VERIFIED | `hub/src/index.ts` imports and calls `startWebServer` with local hub dependencies only; no hosted relay options. |
| `hub/src/index.ts` | `HAPI_PUBLIC_URL` | `config.publicUrl` output | VERIFIED | Startup logs `HAPI_PUBLIC_URL`, local URL, and public URL from `config.publicUrl`. |
| `hub/src/config/serverSettings.ts` | `hub/src/configuration.ts` | `loadServerSettings` result | VERIFIED | `Configuration.create()` consumes `loadServerSettings()` and assigns `publicUrl`, `listenHost`, `listenPort`, and `corsOrigins`. |
| `hub/src/config/serverSettings.test.ts` | `hub/src/config/serverSettings.ts` | Old field rejection | VERIFIED | Tests assert legacy relay settings throw and legacy relay env vars do not alter returned settings. |
| `cli/src/ui/logger.ts` | Local log file | `appendFileSync` | VERIFIED | `Logger.logToFile()` writes to `this.logFilePath` via `appendFileSync`. |
| `cli/src/ui/doctor.ts` | Configuration | Diagnostic output | VERIFIED | Doctor reads `configuration.apiUrl`, `configuration.logsDir`, and `HAPI_API_URL` for direct-connect diagnostics only. |
| `cli/src/runtime/embeddedAssets.bun.ts` | `cli/src/runtime/assets.ts` | `loadEmbeddedAssets` and `ensureRuntimeAssets` | VERIFIED | `ensureRuntimeAssets()` imports `#embedded-assets`; Bun import mapping points to `embeddedAssets.bun.ts`. |
| `package.json` | `scripts/check-no-cut-agents.sh` | `test:guard` | VERIFIED | Root `test` script includes `test:guard`, which runs the Phase 04 guard. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `hub/src/index.ts` | `config.publicUrl` | `createConfiguration()` -> `loadServerSettings()` -> env/file/default `publicUrl` | Yes | FLOWING |
| `hub/src/web/server.ts` | `embeddedAssetMap` | `isBunCompiled()` -> `loadEmbeddedAssetMap()` | Yes | FLOWING |
| `cli/src/ui/logger.ts` | `logFilePath` | `configuration.logsDir` or test-provided path | Yes | FLOWING |
| `cli/src/runtime/assets.ts` | `embeddedAssets` | Dynamic import `#embedded-assets` -> `loadEmbeddedAssets()` | Yes | FLOWING |
| `scripts/check-no-cut-agents.sh` | Phase 04 patterns | Hardcoded guard patterns plus tight whitelist | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full typecheck passes | `bun typecheck` | Exit 0 | PASS |
| Full test suite and guard pass | `bun run test` | Exit 0; includes `test:guard` | PASS |
| Single-exe build succeeds without tunwg output | `bun run build:single-exe` | Exit 0; output scan found no tunwg/download-tunwg/hub-tools-tunwg references | PASS |
| Phase 04 guard passes standalone | `bash scripts/check-no-cut-agents.sh` | Exit 0; printed Phase 04 success line | PASS |
| Legacy relay config behavior covered | `cd hub && bun test src/config/serverSettings.test.ts` | 6 pass, 0 fail | PASS |
| Logger/doctor cleanup covered | `cd cli && bun run test src/ui/logger.test.ts src/ui/doctor.test.ts` | 3 pass, 0 fail | PASS |
| QR dependency residue explained | `bun pm why qrcode` | Remaining `qrcode` is VitePress docs optional peer via `@vueuse/integrations` | PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Conventional phase probes | `scripts/**/tests/probe-*.sh` discovery | No probe files found | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CUT-10 | `04-01-PLAN.md`, `04-02-PLAN.md`, `04-04-PLAN.md` | Delete Cloudflare-style tunnel binary + TLS gate: `hub/src/tunnel/`, `hub/tools/tunwg/`, `hub/scripts/download-tunwg.ts`, all `HAPI_RELAY_*`, and `web/src/lib/relay-mode` related code. | SATISFIED | Deletion targets absent; runtime/config/web/build source has no relay/tunnel path; guard and full gate passed. |
| CUT-11 | `04-03-PLAN.md`, `04-04-PLAN.md` | Delete dangerous remote-log upload stream from `cli/src/ui/logger.ts` and doctor toggle. | SATISFIED | Logger has no fetch/upload path; doctor omits toggle; focused tests and guard passed. |

No orphaned Phase 04 requirements were found in `REQUIREMENTS.md`: Phase 04 maps only CUT-10 and CUT-11, and both are declared in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `hub/src/config/serverSettings.ts` | 73 | `return []` | Info | Benign empty CORS fallback for invalid public URL; not a stub. |
| `cli/src/ui/logger.ts` | 210, 251 | `return []` | Info | Benign empty log-list fallback when no files/errors; not user-visible incomplete behavior. |
| `cli/src/ui/doctor.ts` | 51, 64 | `return []` | Info | Benign empty log-list fallback; not a stub. |
| `hub/src/config/settings.ts` | 31, 39 | `return {}` / `return null` | Info | Existing settings-file parse/existence control flow; not a Phase 04 stub. |
| `hub/src/index.ts` | 165 | `await new Promise(() => {})` | Info | Existing long-running hub process pattern; not an empty implementation. |

No `TBD`, `FIXME`, or `XXX` debt markers were found in modified phase source scope.

### Human Verification Required

None.

### Gaps Summary

No blocking gaps found. The Phase 04 goal is achieved in the codebase: built-in tunnel/runtime relay paths, relay config surface, remote log upload path, tunwg build/runtime assets, direct QR runtime dependency/imports, and runtime relay residue are removed; neutral `HAPI_PUBLIC_URL`, local logging, direct-connect diagnostics, and ripgrep/difftastic runtime assets remain.

---

_Verified: 2026-05-21T09:59:43Z_
_Verifier: Claude (gsd-verifier)_
