---
phase: 10-config-cleanup
plan: 04
subsystem: cleanup-and-lockdown
tags: [refactor, config, store, guard, security]
requires: [10-01, 10-02, 10-03]
provides:
  - scripts/check-no-cut-agents.sh::Phase-10 guard block (all five sub-checks active)
  - hub/src/store/index.test.ts::D-173 repair-guidance assertion
affects:
  - cli/src/lib.ts (verified — no-op; Plan 03 already swapped to loadConfig + Config)
  - hub/src/store/index.ts (verified — message already satisfies D-173; no edit)
  - hub/src/store/index.test.ts (added D-173 repair-guidance substring assertion)
  - scripts/check-no-cut-agents.sh (activated sub-checks #1 / #2 / #5)
tech_stack:
  added: []
  patterns:
    - ripgrep guard pattern narrowed to deleted symbol (vs module path)
    - rejection-array whitelist (cli/src/configuration.ts, hub/src/config/serverSettings.ts)
key_files:
  created:
    - .planning/phases/10-config-cleanup/10-04-SUMMARY.md
  modified:
    - hub/src/store/index.test.ts
    - scripts/check-no-cut-agents.sh
  deleted: []
decisions:
  - "D-174 schema-version decision: NO BUMP. SCHEMA_VERSION stays at 10. Rationale: a full diff of every change introduced by Plans 02 and 03 against `hub/src/store/` and `shared/src/wire/` shows zero modifications (`git diff 3878177..HEAD -- hub/src/store/ shared/src/wire/` = `hub/src/store/index.test.ts | 74 ++++++++++` only, which is a test-file addition). Phase 10 is a configuration-cleanup phase; persisted message/wire decoders were not touched. Per D-174 the bump trigger is 'a stricter persisted-JSON decoder was introduced' — that did not happen. No bump."
  - "Task 1 (`cli/src/lib.ts` export swap) was already completed during Plan 03 (commit `e7018a8`). The current file exports `loadConfig` + `type Config` from `@/configuration` and the JSDoc already documents the breaking change (`Plan 10-03: the configuration singleton was deleted; consumers must now call loadConfig()...`). No further edit was required, so Task 1 produced no commit. The success criterion (`cli/src/lib.ts` exports swapped) is satisfied by the Plan 03 commit."
  - "Task 2 (`hub/src/store/index.ts` D-173 message hardening) found the production error message already complete: `buildSchemaMismatchError` returns `\"SQLite schema version mismatch for ${location}. Expected ${SCHEMA_VERSION}, found ${currentVersion}. This build does not run compatibility migrations. Back up and rebuild the database, or run an offline migration to the expected schema version.\"` — that satisfies all four D-173 requirements (DB path via `location`, expected `SCHEMA_VERSION`, found `currentVersion`, repair guidance via `rebuild` + `offline migration`). Plan-04 only needed to lock the wording into the test via a new `expect(caught!.message).toMatch(/offline migration|rebuild/i)` assertion so the message cannot drift silently."
  - "Sub-check #5 pattern narrowed from the plan's interfaces example. The plan suggested matching any `from '@/configuration'` import path, which would false-positive on the legitimate DI consumers introduced by Plan 03 (`import type { Config }` in 10+ files and `import { loadConfig }` in `runCli.ts`). The actual D-166 / D-171 ban is on the deleted *symbol* (`configuration` singleton, `getConfiguration()` getter), not on importing types or the factory from that module. The narrowed pattern `getConfiguration\\(\\)|import\\s*\\{[^}]*\\bconfiguration\\b[^}]*\\}\\s*from\\s*['\"](@|\\.{1,2})/[^'\"]*configuration['\"]` matches the deleted symbol specifically and still trips on any future re-introduction of `import { configuration } from '@/configuration'`."
  - "Sub-check #1 whitelist extended to `cli/src/configuration.ts` (in addition to the plan's `**/serverSettings.ts`): the cli `OLD_CLI_SETTINGS_FIELDS = ['serverUrl'] as const` rejection array intentionally names the legacy field so `rejectOldCliSettingsFields` can throw on it. This mirrors the existing `hub/src/config/serverSettings.ts` whitelist — both are intentional name-references inside the rejection layer, not legacy reads."
metrics:
  duration_minutes: 12
  completed: 2026-05-23
  files_modified: 2
  files_created: 1
  files_deleted: 0
  task_commits: 2
  no_op_tasks: 1
  guard_subchecks_activated: 3
---

# Phase 10 Plan 04: Final residual cleanup + Phase-10 guard lockdown Summary

Closes Phase 10 by verifying the three residual deliverables flagged for the final slice: confirmed that `cli/src/lib.ts` is already correctly exporting `loadConfig` + `type Config` (Plan 03 swapped it), locked the existing D-173-compliant `Store` schema-mismatch wording into a regression assertion, recorded the explicit D-174 `no bump` schema-version decision, and flipped the three staged Phase-10 guard sub-checks (#1 legacy fields, #2 mutable setters, #5 singleton imports) from commented TODOs to active. `bash scripts/check-no-cut-agents.sh` exits 0 with `✅ Phase 10 guard PASS.` and all four ROADMAP Phase 10 success criteria are demonstrably satisfied (REFC-01, REFC-02).

## What landed

### Task 1 — `cli/src/lib.ts` public-library export swap (D-166, breaking change)

**No-op:** Plan 03 (commit `e7018a8`) already swapped the lib.ts export from the `configuration` singleton to `loadConfig` + `type Config`. The current file:

```typescript
/**
 * Library exports for slopus package
 *
 * This file provides the main API classes and types for external consumption
 * without the CLI-specific functionality.
 *
 * Plan 10-03: the `configuration` singleton was deleted; consumers must now
 * call `loadConfig()` and thread the frozen `Config` through DI.
 */
export { ApiClient } from '@/api/api'
export { ApiSessionClient } from '@/api/apiSession'
export { logger, initializeLogger } from '@/ui/logger'
export { loadConfig, type Config } from '@/configuration'
export { RawJSONLinesSchema, type RawJSONLines } from '@/agent/agentLogSchema'
```

The JSDoc already documents the breaking change (D-166, Pitfall 3). No tests reference the removed `configuration` export from `@/lib`. The plan's Task 1 success criteria are all satisfied by the pre-existing Plan 03 state; no Plan-04 commit was needed for this task.

### Task 2 — `Store` schema-mismatch error hardening (D-173) + D-174 schema-version decision

**Production message** (`hub/src/store/index.ts::buildSchemaMismatchError`) was already complete:

```
SQLite schema version mismatch for ${location}.
Expected ${SCHEMA_VERSION}, found ${currentVersion}.
This build does not run compatibility migrations.
Back up and rebuild the database, or run an offline migration
to the expected schema version.
```

This satisfies D-173: DB path (`location` — which is `dbPath` for on-disk DBs or the literal `"in-memory database"` for `:memory:`), expected version (`SCHEMA_VERSION` — currently 10), found version (`currentVersion`), and repair guidance (`rebuild the database` + `run an offline migration`). The neighbouring `assertRequiredTablesPresent` throw similarly already names the missing table.

**Test addition** (`hub/src/store/index.test.ts`):

```typescript
expect(caught!.message).toMatch(/offline migration|rebuild/i)
```

Appended to the existing schema-mismatch case as the fourth assertion (after DB path, expected version, found version). The regex is intentionally loose so the test continues to pass even if the exact wording is reflowed, as long as the repair guidance remains.

**D-174 schema-version decision: NO BUMP (SCHEMA_VERSION stays at 10).** Evidence:

- `git diff 3878177..HEAD -- hub/src/store/ shared/src/wire/` (the start-of-Phase-10 commit through HEAD-before-Plan-04) returned a single change: `hub/src/store/index.test.ts | 74 +++++++++++++++++++++++++++++++++++++++++++++`. That is a test-file addition (the Plan 01 schema-mismatch + missing-table test skeleton), not a decoder change.
- `rg -n "z\\.object|z\\.discriminatedUnion|safeParse|\\.parse\\(" hub/src/store/ shared/src/wire/` shows the same zod / parsing surface that existed before Phase 10; no schema tightening crept in.
- Plans 02 + 03 are pure configuration-layer refactors — they migrate `Configuration` singleton callsites to `loadConfig()` + DI, but do not touch any persisted-JSON decoder under `hub/src/store/` or any wire schema under `shared/src/wire/`.

Per D-174 the trigger for a `SCHEMA_VERSION` bump is "a change that tightens persisted-JSON decoding". That trigger did not fire in Phase 10. `SCHEMA_VERSION` remains 10.

### Task 3 — Phase-10 guard sub-check activation

`scripts/check-no-cut-agents.sh` Phase-10 block now has all five sub-checks active:

- **#1 (D-160)** — `rg '\bserverUrl\b|\bwebapp(Host|Port|Url|Origin)\b'` over `cli/src hub/src`, excluding `**/*.test.ts`, `**/serverSettings.ts` (hub `OLD_SETTINGS_FIELDS` rejection array), and `cli/src/configuration.ts` (cli `OLD_CLI_SETTINGS_FIELDS` rejection array). Zero hits.
- **#2 (D-164 / D-168)** — `rg '_setApiUrl|_setCliApiToken|_setExtraHeaders'` over `cli/src hub/src`, excluding tests. Zero hits.
- **#3 (D-160)** — `rg "name:\s*['\"]server['\"]" cli/src/commands/registry.ts`. Zero hits (already active from Plan 01).
- **#4 (D-175)** — `find hub/src -name 'migration-v*.ts'`. Zero files (already active from Plan 01).
- **#5 (D-166 / D-171)** — narrowed pattern matches the deleted singleton symbol itself: `getConfiguration\(\)` OR `import {... configuration ...} from '<path-ending-in>/configuration'`. Whitelisted: `cli/src/configuration.ts`, `hub/src/configuration.ts` (where `loadConfig` lives), `cli/src/lib.ts` (JSDoc breaking-change note names the deleted symbol). Zero hits.

Script terminates with `echo "✅ Phase 10 guard PASS."` and `bash scripts/check-no-cut-agents.sh` exits 0.

## Deviations from Plan

- **Task 1 produced no commit.** Plan 03 already landed the `lib.ts` export swap (commit `e7018a8`). The Plan 04 acceptance criteria for Task 1 are all satisfied by that commit; no further code change was required.
- **Sub-check #5 pattern narrowed.** The plan's interfaces example used `from ['\"]@/configuration['\"]|from ['\"]\\.\\./configuration['\"]` as the singleton-import detector. That pattern false-positives on every legitimate `import type { Config }` and `import { loadConfig }` DI consumer added by Plan 03 (10+ files). The correct interpretation of D-166 / D-171 is to ban the deleted *symbol*, not the module path — type-only and factory-function imports from the configuration module are legitimate DI plumbing. The narrowed pattern `getConfiguration\(\)|import {... configuration ...} from '<configuration>'` matches the deleted symbol specifically. The plan's interfaces block has been honored in *intent* (zero residual singleton uses) without crippling the script with a long whitelist.
- **Sub-check #1 whitelist extended.** Plan called out only `**/serverSettings.ts`; the cli mirror file (`cli/src/configuration.ts`) needed the same treatment for the same reason — both contain `OLD_*_FIELDS = ['serverUrl', ...]` rejection arrays.

## Threat Model Compliance

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| T-10-04-01 (Info disclosure — `cli/src/lib.ts` exports) | accept | Verified: only `loadConfig` (function), `Config` (type), and pre-existing class/util exports survive. Old `configuration` singleton is gone — any external consumer that still imports it gets a compile-time error, not a silent fallback. |
| T-10-04-02 (Tampering — `Store` mismatch error wording) | mitigate | Production message contains DB path, expected version, found version, and repair guidance only — no secrets. Test now asserts the repair substring so wording cannot drift silently. |
| T-10-04-03 (Spoofing/Regression — future re-introduction of singleton or legacy alias) | mitigate | All five Phase-10 guard sub-checks active. Any PR re-introducing `import { configuration }`, `_set*` setter, `serverUrl`/`webapp*` field, `name: 'server'`, or `migration-v*.ts` file fails the guard at PR-time. |
| T-10-04-04 (Over-broad guard whitelist — false-negative) | mitigate | Sub-check #5 whitelist is explicit: 3 files (`cli/src/configuration.ts`, `hub/src/configuration.ts`, `cli/src/lib.ts`). The narrowed pattern means even those whitelist entries only matter for the literal symbol `configuration` — production code under them is still subject to all other guards. Sub-check #1 whitelist is 2 files (`**/serverSettings.ts` + `cli/src/configuration.ts`), both with rejection arrays that intentionally name the legacy fields. Any new whitelist entry requires explicit justification in this SUMMARY. |
| T-10-04-SC (Supply chain) | n/a | No new packages added in this plan. |

## Verification

- `bash scripts/check-no-cut-agents.sh` — exits 0; final line is `✅ Phase 10 guard PASS.` Output additionally includes `✅ Phase 10 #1: no legacy serverUrl / webapp* field reads.` / `✅ Phase 10 #2: no mutable singleton setters.` / `✅ Phase 10 #3: hapi server alias removed.` / `✅ Phase 10 #4: no runtime migration-v*.ts files.` / `✅ Phase 10 #5: no configuration singleton imports outside whitelist.`
- `bun run typecheck` — green across `cli`, `hub`, `web`.
- `bun run test:cli` — 246 pass / 12 skipped / 0 fail across 39 test files.
- `bun run test:hub` — 223 pass / 0 fail across 35 test files.
- `cd hub && bun test src/store/index.test.ts -t "schema mismatch"` — green; assertion `toMatch(/offline migration|rebuild/i)` exercised.
- `rg -n "export \\{ configuration \\}" cli/src/lib.ts` — zero hits.
- `rg -n "export \\{ loadConfig" cli/src/lib.ts` — exactly one hit (also exports `type Config` on the same line).
- `rg -n "offline migration|rebuild" hub/src/store/index.ts` — at least one hit.
- `rg -n "toMatch\\(/offline migration\\|rebuild/i\\)" hub/src/store/index.test.ts` — exactly one hit.
- `rg -n "Plan 04: enable" scripts/check-no-cut-agents.sh` — zero hits (TODO comments removed).
- `rg -nc 'Phase 10 D-' scripts/check-no-cut-agents.sh` — count ≥ 5 (one per sub-check, with D-number reference).
- `find hub/src -name 'migration-v*.ts' | wc -l` — 0.

## ROADMAP Phase 10 Success Criteria — all satisfied

- **SC1** (zero legacy-field / setter / alias residue in production source) — guaranteed by guard sub-checks #1 + #2 + #3 + #5, all green.
- **SC2** (`Store` schema-mismatch behaves correctly + zero runtime migration files) — guaranteed by guard sub-check #4 + the Plan 04 D-173 test assertion + the D-174 no-bump decision recorded above.
- **SC3** (`loadConfig` is the canonical config entry; no singleton imports outside whitelist) — guaranteed by `rg 'export async function loadConfig' cli/src/configuration.ts hub/src/configuration.ts` returning exactly two hits + sub-check #5 green.
- **SC4** (`bun run typecheck && bun run test` green; frozen-config tests landed) — verified above; the Plan 02 + 03 frozen-Config tests (`cli/src/configuration.test.ts` + `hub/src/configuration.test.ts`) continue to pass.

## Self-Check: PASSED

- Files created: `.planning/phases/10-config-cleanup/10-04-SUMMARY.md`.
- Files modified (this plan): `hub/src/store/index.test.ts`, `scripts/check-no-cut-agents.sh`.
- Files NOT modified (Task 1 was a no-op): `cli/src/lib.ts` (already swapped in Plan 03), `hub/src/store/index.ts` (production message already D-173-compliant).
- Task commits (verified via `git log --oneline -3`):
  - `19eba8d` — `test(10-04): assert D-173 repair-guidance substring in Store schema-mismatch error`
  - `dea20e8` — `chore(10-04): activate all five Phase-10 guard sub-checks`
- All acceptance criteria from every `<acceptance_criteria>` block satisfied (Task 1 satisfied by Plan 03's prior commit; Task 2 + Task 3 by the above two commits).
- All success criteria from the plan's `<success_criteria>` block satisfied.
- ROADMAP Phase 10 SC1–SC4 satisfied. Phase 10 closes green.
