---
phase: 10
slug: config-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `10-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (`bun:test`) for `cli/`, `hub/`, `web/`; some legacy CLI tests use `vitest` mock helpers |
| **Config file** | `cli/package.json`, `hub/package.json`, `web/package.json` test scripts (no top-level test config) |
| **Quick run command** | `bun run test:cli` · `bun run test:hub` · `bun run test:web` |
| **Full suite command** | `bun run test` (runs all three packages + `test:guard`) |
| **Estimated runtime** | ~30s quick (per-package) · ~90s full |

---

## Sampling Rate

- **After every task commit:** Run `bun run test:<package>` for the package touched (cli/hub/web).
- **After every plan wave:** Run `bun run test` (all packages + guard).
- **Before `/gsd:verify-work`:** Full suite + `bun typecheck` must be green.
- **Max feedback latency:** ~30 seconds per-package quick run.

---

## Per-Task Verification Map

> Filled in per-plan during planning. The skeleton below maps each phase requirement to its primary test surface so the planner can derive task-level entries.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| REFC-01 | CLI `loadConfig()` throws on legacy `serverUrl` field | unit | `bun test cli/src/configuration.test.ts -t "serverUrl"` | ❌ W0 | ⬜ pending |
| REFC-01 | Hub `loadServerSettings` throws on `webapp*` fields | unit | `bun test hub/src/config/serverSettings.test.ts` | ✅ extend | ⬜ pending |
| REFC-01 | `loadConfig()` throws on `WEBAPP_*` env vars | unit | `bun test cli/src/configuration.test.ts -t "WEBAPP"` · `bun test hub/src/configuration.test.ts -t "WEBAPP"` | ❌ W0 | ⬜ pending |
| REFC-01 | `resolveCommand(['server'])` throws or falls through with repair msg | unit | `bun test cli/src/commands/registry.test.ts -t "server alias"` | ❌ W0 | ⬜ pending |
| REFC-01 | `Store` constructor throws on schema-version mismatch | unit | `bun test hub/src/store/index.test.ts -t "schema mismatch"` | ❓ verify / W0 | ⬜ pending |
| REFC-01 | `Store` constructor throws on missing required tables | unit | `bun test hub/src/store/index.test.ts -t "missing table"` | ❓ verify / W0 | ⬜ pending |
| REFC-01 | `hapi hub --host X --port Y` actually binds to X:Y (env-rename regression) | integration | `bun test cli/src/runner/runner.integration.test.ts -t "hub --host"` | ❌ W0 (or augment existing) | ⬜ pending |
| REFC-02 | `loadConfig()` returns a deeply frozen object | unit | `bun test cli/src/configuration.test.ts -t "frozen"` · `bun test hub/src/configuration.test.ts -t "frozen"` | ❌ W0 | ⬜ pending |
| REFC-02 | Mutating nested `extraHeaders` / `corsOrigins` throws in strict mode | unit | (same files, additional cases) | ❌ W0 | ⬜ pending |
| REFC-02 | Malformed `settings.json` → `loadConfig` throws with path | unit | `bun test cli/src/configuration.test.ts -t "malformed"` | ❌ W0 (Hub side may exist via `readSettingsOrThrow`) | ⬜ pending |
| REFC-02 | Ripgrep guard rejects `getConfiguration()` / `_setApiUrl()` / `_setCliApiToken()` / `_setExtraHeaders()` / runtime `migration-v*` in production source | guard | `bun run test:guard` | ✅ extend `scripts/check-no-cut-agents.sh` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `cli/src/configuration.test.ts` — new file; covers frozen object, legacy field/env rejection, malformed settings.
- [ ] `hub/src/configuration.test.ts` — new file; covers frozen object, env rejection.
- [ ] `cli/src/commands/registry.test.ts` — new file; covers `server` alias removal.
- [ ] `hub/src/store/index.test.ts` — verify exists; if not, add schema-mismatch + missing-table tests.
- [ ] Augment `cli/src/runner/runner.integration.test.ts` with `hapi hub --host/--port` regression coverage.
- [ ] Extend `scripts/check-no-cut-agents.sh` with the Phase-10 guard block (patterns in `10-RESEARCH.md` § Code Examples).
- [ ] Audit + rewrite singleton-mocking tests (factories, not setters): `cli/src/api/api.extraHeaders.test.ts`, `cli/src/api/hubExtraHeaders.test.ts`, `cli/src/commands/auth.test.ts`, `cli/src/commands/resume.test.ts`, `hub/src/web/routes/cli.test.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Legacy-residue error messages are operationally useful when a real user hits them | REFC-01 (D-160/D-162) | Subjective UX evaluation — automated tests only assert presence of key strings, not human readability | After Wave 1, run `hapi` (CLI) and `hapi hub` (Hub) with each of: `serverUrl` in settings.json, `WEBAPP_HOST` env, `hapi server` command; visually confirm the error names the old key/command, the new replacement, and the file/env to edit. |
| Schema-mismatch error tells a user what to do next | REFC-01 (D-173) | Same — readability | Run the hub against a SQLite file with a bumped `SCHEMA_VERSION`; confirm error includes DB path, expected/found versions, and points to the offline migration tool or rebuild. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
