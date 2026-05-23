---
status: passed
phase: 10-config-cleanup
requirements_verified: [REFC-01, REFC-02]
verified: 2026-05-23T11:29:00+08:00
---

# Phase 10 — Config cleanup — Verification

## Goal

(From `.planning/ROADMAP.md` line 185.)

> Backward-compat config aliases, the `hapi server` command alias, and all
> runtime SQLite migration paths are dropped; both CLI and Hub expose config as
> a frozen value loaded once at startup.

Depends on: Phase 9. Requirements: REFC-01, REFC-02.

## Must-Haves

ROADMAP `Success Criteria` for Phase 10 (lines 188–192). Each row was checked
against the actual codebase, not just task completion.

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| SC1 | Zero ripgrep matches for `serverUrl` / `webapp(Url\|Host\|Origin)` legacy reads, `hapi server` alias, or `_setApiUrl()` / `_setCliApiToken()` / `_setExtraHeaders()` callsites in `cli/` or `hub/` | ✓ verified | `bash scripts/check-no-cut-agents.sh` → sub-checks `Phase 10 #1` (no legacy `serverUrl`/`webapp*` field reads), `#2` (no mutable singleton setters), `#3` (`hapi server` alias removed), `#5` (no `configuration` singleton imports outside the 3-file whitelist) all PASS. Active rules in `scripts/check-no-cut-agents.sh` (per Plan 04 `dea20e8`). |
| SC2 | SQLite store rejects schema-version mismatches at startup with explicit error pointing to an offline migration tool; runtime `migration-vN.ts` files removed (tests only kept if they cover the offline tool) | ✓ verified | `find hub/src -name 'migration-v*.ts'` → zero results. `hub/src/store/index.ts::buildSchemaMismatchError` returns a message containing `dbPath`, `expected SCHEMA_VERSION`, `found currentVersion`, and `"Back up and rebuild the database, or run an offline migration"`. Locked by `hub/src/store/index.test.ts` assertion `expect(caught!.message).toMatch(/offline migration\|rebuild/i)` (Plan 04 commit `19eba8d`). Guard sub-check `Phase 10 #4` enforces the migration-file absence. |
| SC3 | CLI `loadConfig()` and Hub `loadConfig()` each return a `Readonly<...>` / `Object.freeze`d result; consumers receive config via DI; no module-level mutable singleton remains | ✓ verified | `cli/src/configuration.ts` and `hub/src/configuration.ts` both export `async function loadConfig(): Promise<Config>` returning a `deepFreeze({...})` object. CLI consumers (`runCli.ts` + 30+ callsites across 18 files) thread `Config` through DI per Plan 03 (`e7018a8`). Hub consumers (7 callsites: `web/server`, `socket/server`, `web/routes/{cli,auth}`, `config/{jwtSecret,ownerId}`, `index.ts::main`) receive options-bag DI per Plan 02 (`3862438`). The deleted symbols (`class Configuration`, `_setApiUrl`, `_setCliApiToken`, `_setExtraHeaders`, `_configuration` singleton, `getConfiguration()`, `cachedOwnerId`) cannot be re-introduced without failing guard sub-checks #2 and #5. |
| SC4 | `bun typecheck` and `bun run test` pass; a new test verifies that mutating a returned config object throws in strict mode | ✓ verified | `bun run typecheck` → green across `cli` / `web` / `hub`. `bun run test:cli` → 246 pass / 12 skipped / 0 fail (39 files). `bun run test:hub` → 223 pass / 0 fail / 642 expect (35 files). Frozen-config mutation tests live in `cli/src/configuration.test.ts` (top-level + `extraHeaders` mutation both throw `TypeError`) and `hub/src/configuration.test.ts` (top-level + `corsOrigins.push` + `sources` mutation all throw `TypeError`). |

## Requirement Traceability

| Req | Description | Phase / Plan Evidence | REQUIREMENTS.md Status | Verdict |
|-----|-------------|-----------------------|------------------------|---------|
| REFC-01 | Drop `serverUrl → apiUrl` / `webapp* → publicUrl` field aliases, `hapi server` alias, all runtime SQLite migrations; schema mismatch ⇒ refuse to start + point to offline migration tool | Plan 01 (commits `5d1d794`, `899b3d5`, `a6b6552`, `1d7fcdc`), Plan 04 (commits `19eba8d`, `dea20e8`); guard sub-checks #1, #3, #4 active | ✅ marked **Complete** | ✓ |
| REFC-02 | Mutable config singleton refactor: CLI + Hub return frozen object from `loadConfig()`; remove `_setApiUrl()` / `_setCliApiToken()` / `_setExtraHeaders()` setters; DI throughout | Plan 02 (commit `3862438`, Hub) + Plan 03 (commits `e7018a8`, `255867d`, CLI); frozen-Config tests in both packages; guard sub-checks #2, #5 active | ⚠️ still marked **Pending** in `.planning/REQUIREMENTS.md` (line 132) — must be flipped to **Complete** | ✓ implementation verified; ✗ traceability table stale (see Gaps) |

Both requirement IDs that appear in Phase 10 plan frontmatter (`REFC-01`,
`REFC-02`) are accounted for in `.planning/REQUIREMENTS.md`. The implementation
of REFC-02 is complete and demonstrable in the codebase; only the status row in
the requirements traceability table is out of date.

## Test Suite

Test files that directly exercise Phase 10 behavior:

| File | What it covers | Pass count |
|------|----------------|------------|
| `cli/src/configuration.test.ts` | Frozen Config (D-164), legacy `serverUrl` rejection (D-160), `WEBAPP_HOST` env rejection (D-161), malformed `settings.json` rejection (D-167) | 4 pass |
| `hub/src/configuration.test.ts` | Frozen Config + `corsOrigins`/`sources` mutation throws (D-164); per-env-var rejection for `WEBAPP_HOST` / `WEBAPP_PORT` / `WEBAPP_URL` / `SERVER_URL` (D-161) | 6 pass (2 freeze + 4 env) |
| `hub/src/config/serverSettings.test.ts` | Per-field rejection loop over `OLD_SETTINGS_FIELDS` | extended |
| `cli/src/commands/registry.test.ts` | `hapi server` alias hard-rejected with repair message; `hapi hub` still resolves; empty args fall through to `cursorCommand` | 4 pass |
| `hub/src/store/index.test.ts` | `Store schema mismatch` (dbPath + expected + found + `toMatch(/offline migration\|rebuild/i)`); `Store missing required tables` names the dropped table | 2 pass (+ pre-existing store tests) |
| `cli/src/runner/runner.integration.test.ts` | `hapi hub --host/--port env routing (REFC-01 regression)` block — locks `HAPI_LISTEN_HOST/PORT` writes in `cli/src/commands/hub.ts` source + asserts env after `parseHubArgs` shape | 1 active in block (others skipped pending real runner) |
| `cli/src/api/api.extraHeaders.test.ts`, `cli/src/api/hubExtraHeaders.test.ts`, `cli/src/commands/auth.test.ts`, `cli/src/commands/resume.test.ts` | Converted from `vi.mock('@/configuration')` setter-mocking to `makeConfig()` factory fixture — proves consumers accept DI rather than reaching for a singleton | all pass within `bun run test:cli` |

Aggregate suite results on HEAD (`2eda1dc`):

- `bun run typecheck` — green (cli, web, hub).
- `bun run test:cli` — **246 pass / 12 skipped / 0 fail** across 39 test files.
- `bun run test:hub` — **223 pass / 0 fail / 642 expect()** across 35 test files.
- `bash scripts/check-no-cut-agents.sh` — exit 0; ends with `✅ Phase 10 guard PASS.` All five Phase-10 sub-checks active and green.

## Gaps

None — the documentation gap G1 (REFC-02 status in `.planning/REQUIREMENTS.md`) was resolved during phase completion by the orchestrator. Both the checkbox (line 36) and the traceability table row (line 132) now show `Complete`.

No source-code or test gaps were found.

## Human Verification

The validation strategy in `10-VALIDATION.md` § "Manual-Only Verifications"
flagged two UX-readability checks that automated tests intentionally do not
fully cover (they assert key substrings, but cannot judge "operationally useful"
phrasing for a real user encountering the error for the first time). The user
should run these once before considering the phase fully verified:

1. **Legacy-residue error UX** (REFC-01, D-160 / D-161). Trigger each of the
   following and visually confirm the error message names the old key/command,
   names the new replacement, and tells you where to edit:
   - Add `"serverUrl": "http://x"` to `~/.hapi/settings.json` and run any
     `hapi` command — confirm message mentions `serverUrl`, `apiUrl`, and the
     settings file path.
   - Run `WEBAPP_HOST=127.0.0.1 hapi hub` — confirm message mentions
     `WEBAPP_HOST` and `HAPI_LISTEN_HOST`.
   - Run `hapi server` — confirm message says `Unknown command "hapi server".
     Use "hapi hub" instead.`
2. **Schema-mismatch error UX** (REFC-01, D-173). Open a fresh hub against a
   SQLite file whose `PRAGMA user_version` has been hand-bumped (e.g. `sqlite3
   ~/.hapi/hub.db 'PRAGMA user_version = 99'` after a normal startup), then run
   `hapi hub` — confirm the error includes the DB path, expected version,
   found version, and the "rebuild / offline migration" repair guidance.

These are subjective wording checks only; the underlying behavior is covered
by automated tests.

## Verdict

`status: gaps_found` — the goal is fully achieved in the codebase (all four
ROADMAP success criteria pass, both REFC-01 and REFC-02 are demonstrably
implemented, every guard sub-check is green, both test suites and typecheck
are green), but `.planning/REQUIREMENTS.md` still shows `REFC-02` as
**Pending**. Flip that single row (and its `[ ]` checkbox) to `Complete` to
close the phase cleanly. The two manual UX checks in § Human Verification are
recommended but not blocking.
