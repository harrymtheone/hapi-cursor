---
phase: 11-test-gap-fill
verified: 2026-05-23T13:10:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
disclosures:
  - "SC#4 coverage non-regression: 2/5 SUT scopes measured directly (hub/src/web/routes/auth.ts 18.18% → 100.00% ✅; hub/src/sse/sseManager.ts 79.82% → 79.82% ✅). The other 3 scopes (cli/src/cursor/, cli/src/agent/, web/src/hooks/useSSE.ts) carry a 'declared-baseline rider': @vitest/coverage-v8 is not a dev-dep on main, so both Phase 10 baseline and Phase 11 post-fix numbers are `unavailable` per RESEARCH Open Question #3 fallback (documented in 11-DISCUSSION-LOG.md, 11-01-SUMMARY.md, and 11-05-SUMMARY.md). Per orchestrator/user disclosure: this is acknowledged, not a gap."
---

# Phase 11: test-gap-fill Verification Report

**Phase Goal:** Cursor permission contract, SSE reconnect invariants, and auth route negative cases are covered by automated tests.
**Verified:** 2026-05-23T13:10:00Z
**Status:** ✓ passed
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths (mapped to ROADMAP Success Criteria)

| #   | Truth (SC) | Status     | Evidence       |
| --- | ---------- | ---------- | -------------- |
| 1 (SC#1) | A single Cursor permission contract matrix test asserts every PermissionMode → Cursor CLI flag row; adding a new mode without a matrix row fails the test | ✓ VERIFIED | `cli/src/agent/permissionMatrix.test.ts` defines `MATRIX … as const satisfies Record<PermissionMode, ExpectedSpec>` (compile-time exhaustiveness) plus runtime key-set cross-checks vs both `CURSOR_PERMISSION_MODES` (shared/src/modes.ts) and `FLAVOR_CAPS.cursor.permissionModes` (shared/src/flavors.ts), plus per-row strict `toEqual` against `permissionModeToCursorArgs`. `cd cli && bun run vitest run src/agent/permissionMatrix.test.ts` → 7 passing tests. Plan 11-02 SUMMARY records a manual mutation: renaming the `yolo` key to `yolo2` causes `bun typecheck` to fail with TS2561 — confirms "adding a new mode without a matrix row fails the test" (and the symmetric removal direction). |
| 2 (SC#2) | A new SSE reconnect / patch-loss invariant test simulates dropped events plus reconnection; the front-end query cache converges to the authoritative server state within a bounded retry budget | ✓ VERIFIED | `web/src/hooks/useSSE.test.tsx` ships a dedicated `describe('useSSE reconnect convergence (REFT-02)', …)` block (3 tests). Test 1 pins the bounded reconnect window (`MockEventSource.instances.length` goes 1 → 2 after `vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS + RECONNECT_JITTER_MS + 1)`, and asserts `BASE + JITTER ≤ RECONNECT_MAX_DELAY_MS`); constants are imported from `./useSSE` (no local duplicates) — the five backoff consts were minimally exported in Plan 11-04 Task 1 (D-190 carve-out, no value changes). Test 2 seeds `{ sessions: [A] }`, opens MockEventSource, dispatches `session-added(B)`, fires `emitError()`, advances timers, opens a second instance, dispatches one authoritative `session-updated(A, updatedAt=9999)`, then asserts the final TanStack `queryClient.getQueryData(queryKeys.sessions)` equals `[A(9999), B(3000)]` — convergence after dropped intermediate events. Test 3 is a reconnect-resilience smoke. Fake timers are scoped only to the REFT-02 describe (`beforeEach: vi.useFakeTimers()` / `afterEach: vi.useRealTimers()`). `cd web && bun run vitest run src/hooks/useSSE.test.tsx` → 13/13 passing (10 pre-existing + 3 new). |
| 3 (SC#3) | Auth route negative-case tests cover bad token, expired JWT, replayed JWT, and empty body — every case returns the expected 4xx status without leaking secrets in the response body or logs | ✓ VERIFIED | Coverage split across two files per D-185. `hub/src/web/routes/auth.test.ts` (6 tests) covers: non-JSON body → 400 `Invalid body`; `{}` body → 400; non-string `accessToken` → 400; empty-string `accessToken` → 401 `Invalid access token` (pinned per orchestrator override — `parseAccessToken('')` trims to null); wrong `accessToken` → 401; correct → 200 with HS256-decodable JWT whose `payload.uid === ownerId`. `hub/src/web/middleware/auth.test.ts` (10 tests) covers: `/api/auth` short-circuit pinned; missing header → 401 `Missing authorization token`; `Bearer ` (empty) → 401 same; tampered signature → 401 `Invalid token`; expired JWT (replayed-after-expiry) → 401; wrong-alg (HS512) → 401; forged `alg:'none'` → 401; valid HS256 without `uid` → 401 `Invalid token payload` (replaces dropped `uid != ownerId` case per orchestrator override); `/api/events?token=garbage` fallback → 401; positive control through to `next()`. Every failure-path test wraps the request in `captureConsole()` and calls the shared `assertNoSecretLeak(text, cap.logs, SECRETS)` helper (`hub/src/web/test-utils/assertNoSecretLeak.ts`, imports `expect` from `bun:test` only), where `SECRETS` includes both the cliApiToken and the decoded jwtSecret (route) or the jwtSecret alone (middleware). `cd hub && bun test src/web/routes/auth.test.ts src/web/middleware/auth.test.ts` → 16/16 passing, 54 expect() calls. |
| 4 (SC#4) | `bun run test` is green; coverage for `cli/src/cursor/`, `hub/src/web/routes/auth.ts`, `hub/src/sse/`, and `web/src/hooks/useSSE.ts` does not regress versus Phase 10 | ✓ VERIFIED (with disclosed declared-baseline rider for 3 of 5 scopes) | Plan 11-05 SUMMARY records `bun run test` (repo root) exit 0, `cd cli|hub|web && bun typecheck` all exit 0, `bash scripts/check-no-cut-agents.sh` exit 0 — verified re-run by verifier (guard script PASS Phase 1–11). Coverage non-regression: `hub/src/web/routes/auth.ts` 18.18% → 100.00% lines ✅ (+81.82pp); `hub/src/sse/sseManager.ts` 79.82% → 79.82% ✅ (exact match). The other three scopes (`cli/src/cursor/`, `cli/src/agent/`, `web/src/hooks/useSSE.ts`) are recorded as `unavailable` for BOTH Phase 10 baseline and Phase 11 post-fix because `@vitest/coverage-v8` is not declared as a dev-dep on `main` — per RESEARCH § Open Question #3 fallback (orchestrator override 2026-05-23), Phase 11 numbers become the declared baseline for those scopes; this is recorded in 11-DISCUSSION-LOG.md `## Phase 10 Coverage Baseline` + `## Phase 11 Coverage After` + verdict `GREEN with declared-baseline rider`. User explicitly disclosed this as a caveat (not a gap) in the verification request. |

**Score:** 4/4 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `cli/src/agent/permissionMatrix.test.ts` | REFT-01 matrix file (type-exhaustive + key cross-check + per-row toEqual + undefined carve-out) | ✓ VERIFIED | 65 lines, 7 passing tests; `satisfies Record<PermissionMode, ExpectedSpec>` present; imports `vitest` (correct runner for cli/) — no `bun:test`; imports `CURSOR_PERMISSION_MODES` and `FLAVOR_CAPS` from `@hapi/protocol/*` (no hardcoded literal array). |
| `cli/src/agent/modeConfig.ts` + `cli/src/agent/modeConfig.test.ts` | Unchanged (D-178 isolation) | ✓ VERIFIED | Plan 11-02 SUMMARY records `git diff HEAD~1 HEAD` clean for both files; verifier spot-confirmed `permissionMatrix.test.ts` is a new file, not an edit to `modeConfig.test.ts`. |
| `hub/src/web/test-utils/assertNoSecretLeak.ts` | Shared no-leak helper, `bun:test` only, no `.test` suffix | ✓ VERIFIED | 32 lines; exports `function assertNoSecretLeak(responseBody, capturedLogs, secrets)`; imports only `expect` from `bun:test`; falsy-secret skip guard present; JSDoc anchors REFT-03 + D-186. |
| `hub/src/web/routes/auth.test.ts` | REFT-03 route-layer coverage via Hono `app.request()` | ✓ VERIFIED | 145 lines, 6 tests, every failure path wraps `captureConsole()` + `assertNoSecretLeak(text, cap.logs, [cliApiToken, decoded jwtSecret])` (6 invocations). Success path verifies HS256 JWT via `jose.jwtVerify`. |
| `hub/src/web/middleware/auth.test.ts` | REFT-03 middleware coverage + D-187 `make*` factories + orchestrator-override case substitution | ✓ VERIFIED | 265 lines, 10 tests; `makeValidJwt / makeExpiredJwt / makeTamperedJwt / makeWrongAlgJwt (HS512) / makeAlgNoneJwt / makePayloadWithoutUidJwt` all present; dropped `uid != ownerId` case absent (`grep -c "uid\s*!=\s*ownerId\|ownerId\s*!=\s*uid"` → 0); short-circuit on `/api/auth` and `/api/events ?token=` fallback both pinned. |
| `web/src/hooks/useSSE.ts` | Five backoff constants exported as-is (D-190 carve-out) | ✓ VERIFIED | All five `export const HEARTBEAT_STALE_MS / HEARTBEAT_WATCHDOG_INTERVAL_MS / RECONNECT_BASE_DELAY_MS / RECONNECT_MAX_DELAY_MS / RECONNECT_JITTER_MS` present at top of file; no value/identifier/order change (per Plan 11-04 SUMMARY diff stat: +6 / −5). |
| `web/src/hooks/useSSE.test.tsx` | REFT-02 describe block + `MockEventSource.emitOpen` / `emitError` | ✓ VERIFIED | `describe('useSSE reconnect convergence (REFT-02)', …)` block at end of file (sibling, not nested); `vi.useFakeTimers()` scoped to its `beforeEach` only; `emitOpen` / `emitError` defined on `MockEventSource`; constants imported from `./useSSE`. No `MAX_RETRIES` reference anywhere (orchestrator override). |
| `scripts/check-no-cut-agents.sh` | Phase 11 guard block appended before final Phase 10 PASS echo | ✓ VERIFIED | `# ===== Phase 11 — REFT guards =====` block present at lines 582–630; sub-check #1 (`PHASE11_BRANCH_PATTERN='permissionMode\s*===\s*['"]'`, glob-whitelisted `!cli/src/{agent,cursor}/**` + `!**/*.test.ts(x)`) and sub-check #2 (cross-runner imports) both active; `bash scripts/check-no-cut-agents.sh` → exit 0 with all Phase 1–11 PASS lines printed (re-run by verifier). |
| `.planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md` | Phase 10 Coverage Baseline + Phase 11 Coverage After + Gate Results sections | ✓ VERIFIED (per SUMMARYs) | Per Plan 11-01 and 11-05 SUMMARYs; both headings written; non-regression verdict `GREEN with declared-baseline rider`. |

### Key Link Verification

| From | To  | Via | Status |
| ---- | --- | --- | ------ |
| `cli/src/agent/permissionMatrix.test.ts` | `permissionModeToCursorArgs` | direct import + per-row `expect(...).toEqual(...)` | ✓ WIRED |
| `cli/src/agent/permissionMatrix.test.ts` | `CURSOR_PERMISSION_MODES` (shared/src/modes.ts) | `import { CURSOR_PERMISSION_MODES } from '@hapi/protocol/modes'` | ✓ WIRED |
| `cli/src/agent/permissionMatrix.test.ts` | `FLAVOR_CAPS.cursor.permissionModes` | `import { FLAVOR_CAPS } from '@hapi/protocol/flavors'` (`./flavors` subpath added in Plan 11-02 Rule 3 deviation) | ✓ WIRED |
| `hub/src/web/routes/auth.test.ts` | `createAuthRoutes` | `app.route('/api', createAuthRoutes(jwtSecret, cliApiToken, ownerId))` + `app.request('/api/auth', ...)` | ✓ WIRED |
| `hub/src/web/middleware/auth.test.ts` | `createAuthMiddleware` | `app.use('/api/*', createAuthMiddleware(jwtSecret))` on throwaway `Hono<WebAppEnv>` | ✓ WIRED |
| Both auth tests | `assertNoSecretLeak` | relative import `../test-utils/assertNoSecretLeak` | ✓ WIRED (15 total invocations across the two files) |
| `useSSE.test.tsx` (REFT-02) | `useSSE.ts` backoff constants | named import `{ RECONNECT_BASE_DELAY_MS, RECONNECT_JITTER_MS, RECONNECT_MAX_DELAY_MS }` | ✓ WIRED |
| `useSSE.test.tsx` (REFT-02) | `MockEventSource` instances | existing `globalThis.EventSource = MockEventSource` monkey-patch in REFT-02 `beforeEach` | ✓ WIRED |
| Guard block sub-check #1 | `cli/src/agent/**` + `cli/src/cursor/**` whitelist | ripgrep `--glob '!cli/src/agent/**' --glob '!cli/src/cursor/**'` | ✓ WIRED (guard exits 0 with both legitimate homes excluded) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Permission matrix test green | `cd cli && bun run vitest run src/agent/permissionMatrix.test.ts` | 7 passed in 80ms | ✓ PASS |
| Auth route + middleware tests green | `cd hub && bun test src/web/routes/auth.test.ts src/web/middleware/auth.test.ts` | 16 pass, 54 expect() calls, 0 fail | ✓ PASS |
| useSSE tests (incl. REFT-02 block) green | `cd web && bun run vitest run src/hooks/useSSE.test.tsx` | 13 passed (10 pre-existing + 3 new REFT-02) | ✓ PASS |
| Full guard script green (Phase 1–11) | `bash scripts/check-no-cut-agents.sh` | exit 0; final lines: `✅ Phase 11 #1`, `✅ Phase 11 #2`, `✅ Phase 11 guard PASS (REFT-01..03).`, `✅ Phase 10 guard PASS.` | ✓ PASS |

### Probe Execution

n/a — Phase 11 is a tests-only / guards-only phase; no project-specific runtime probes (`scripts/*/tests/probe-*.sh`) are declared by PLAN or SUMMARY artifacts. The guard script `scripts/check-no-cut-agents.sh` is effectively the phase probe and is exercised under Behavioral Spot-Checks above.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| REFT-01 | 11-02, 11-05 | Cursor permission contract matrix test; adding a new mode without a matrix row fails | ✓ SATISFIED | `cli/src/agent/permissionMatrix.test.ts` (7 passing); typecheck-failure mutation manually confirmed in Plan 11-02 SUMMARY; guard sub-check #1 enforces matrix as single source of truth (no `permissionMode === '<literal>'` outside the two legitimate homes). REQUIREMENTS.md row 133 already marked `Complete`. |
| REFT-02 | 11-04, 11-05 | SSE reconnect / patch-loss invariant test with cache convergence to authoritative state within bounded retry budget | ✓ SATISFIED | `useSSE.test.tsx` REFT-02 describe block (3 passing); bounded-window assertion `BASE + JITTER ≤ MAX` plus cache-convergence test asserting on `queryClient.getQueryData()` equality (D-181 / D-183 compliant — survives Phase 7 useSSE rewrite). REQUIREMENTS.md row 134 marked `Complete`. |
| REFT-03 | 11-03, 11-05 | Auth route negative cases: bad token, expired JWT, replayed JWT, empty body — expected 4xx without secret leak | ✓ SATISFIED | 16 tests across `routes/auth.test.ts` + `middleware/auth.test.ts`; all four named cases covered (empty body → 400 `{}`, bad token → 401, expired = replayed-after-expiry → 401 per D-184 single-user Tailscale posture, plus orchestrator-override cases for empty-string accessToken and missing-uid payload); every 4xx body + console.{log,warn,error} line asserted free of cliApiToken + jwtSecret via `assertNoSecretLeak`. REQUIREMENTS.md row 135 marked `Complete`. |

No orphaned requirements: REQUIREMENTS.md maps exactly REFT-01/02/03 to Phase 11, and all three are claimed by plan frontmatter (11-02 → REFT-01; 11-03 → REFT-03; 11-04 → REFT-02; 11-01 + 11-05 → all three for baseline/close).

### Anti-Patterns Found

None blocking. Spot-scan of files modified in this phase (`cli/src/agent/permissionMatrix.test.ts`, `hub/src/web/test-utils/assertNoSecretLeak.ts`, `hub/src/web/routes/auth.test.ts`, `hub/src/web/middleware/auth.test.ts`, `web/src/hooks/useSSE.ts`, `web/src/hooks/useSSE.test.tsx`, `scripts/check-no-cut-agents.sh`, `shared/package.json`) found:

- No unreferenced `TBD` / `FIXME` / `XXX` debt markers introduced.
- The `TODO` / `HACK` / `PLACEHOLDER` patterns appear only inside D-183 documentation comments referring to upstream Phase 7 plans (no actionable debt added by Phase 11).
- The empty-array / empty-object grep matches in the test files are JWT fixtures and assertion payloads (e.g. `expectedArgs: {}` for the `default` PermissionMode, `assertNoSecretLeak(text, cap.logs, SECRETS)` where SECRETS is module-local) — all populated with real production-equivalent values, not user-facing hollow stubs.
- All new test files import the correct runner per package boundary (Vitest for cli/ + web/, `bun:test` for hub/), enforced now by guard sub-check #2.

### Human Verification Required

None. Phase 11 deliverables are all testable programmatically — automated test execution, guard script execution, and grep-level structural checks are sufficient. There is no UI, no real-time behavior, and no external service integration introduced by this phase.

### Disclosed Caveats (per user verification request — NOT gaps)

1. **SC#4 declared-baseline rider for 3/5 SUT scopes.** `cli/src/cursor/`, `cli/src/agent/`, and `web/src/hooks/useSSE.ts` could not have their Phase 10 baseline numbers captured because `@vitest/coverage-v8` is not declared as a dev-dep on `main`. Per RESEARCH § Open Question #3 fallback and orchestrator override 2026-05-23, both baseline and Phase 11 numbers for those scopes are recorded as `unavailable`, and Phase 11 is declared the new baseline. The two measurable scopes (`hub/src/web/routes/auth.ts` 18.18% → 100.00%, `hub/src/sse/sseManager.ts` 79.82% → 79.82%) both show non-regression. Phase 12 verification can decide whether to install the missing dev-dep and capture real numbers.

### Gaps Summary

None. All four observable truths are VERIFIED with codebase evidence:

- REFT-01 matrix test exists, is type-exhaustive, runtime cross-checks both `CURSOR_PERMISSION_MODES` and `FLAVOR_CAPS`, per-row strict `toEqual`, and the typecheck-failure mutation has been demonstrated.
- REFT-02 reconnect convergence is pinned by a dedicated test block with scoped fake timers, asserts only final TanStack cache state (D-183), and uses the SUT's own exported backoff constants (no local duplicates).
- REFT-03 covers every named auth negative case across route + middleware layers with a shared no-leak invariant helper.
- SC#4 gate (`bun run test`, typecheck, guard script) is green; coverage non-regression is GREEN for the two measurable scopes, with a disclosed declared-baseline rider for the three scopes blocked by the missing `@vitest/coverage-v8` dev-dep.

The Phase 11 guard block was independently verified disjoint from prior Phase 5/6/10 patterns and exits 0 against the current tree; sub-check #1 enforces the matrix-as-source-of-truth contract, and sub-check #2 enforces the TESTING.md cross-runner import boundary.

---

_Verified: 2026-05-23T13:10:00Z_
_Verifier: Claude (gsd-verifier)_
