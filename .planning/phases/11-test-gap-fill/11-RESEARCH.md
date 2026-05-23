# Phase 11: Test gap fill - Research

**Researched:** 2026-05-23
**Domain:** Test authoring (Vitest + bun:test), SSE reconnect invariants, JWT auth negative cases, ripgrep guard authoring
**Confidence:** HIGH (everything was read from this repo; no external library research needed beyond what's already in `.planning/codebase/TESTING.md`)

## Summary

Phase 11 is purely test-additive. All three SUTs (`cli/src/agent/modeConfig.ts`, `web/src/hooks/useSSE.ts`, `hub/src/web/routes/auth.ts` + `hub/src/web/middleware/auth.ts`) already exist and are stable. Every framework, factory, mock, and `:memory:` Store pattern needed is already in active use elsewhere in the repo — `useSSE.test.tsx` already monkey-patches `globalThis.EventSource`; `cli.test.ts` already shows the `app.request()` Hono pattern for hub routes; `modeConfig.test.ts` already covers the error path. No external libraries to add.

Three concrete facts the planner needs to lock in before writing tasks (verified against source, not guessed):

1. **`permissionModeToCursorArgs` returns a `CursorArgsFragment` object, not `string[]`.** CONTEXT.md "expectedArgs: string[]" is loose phrasing — the actual return shape is `{ mode?: 'plan' | 'ask'; yolo?: boolean }`. Matrix assertions must `toEqual()` that shape.
2. **`useSSE.ts` has no `MAX_RETRIES`.** It retries forever with capped exponential backoff (`1000ms * 2^attempt`, capped at `30_000ms`, + 0–500ms jitter). The "bounded retry budget" in REFT-02 must be redefined as "bounded wall-clock convergence under fake-timers", not as a max-attempt count. There is no "stop reconnecting + expose error state" code path to test — that bullet in CONTEXT.md's "REFT-02 必含用例" must be dropped or rewritten.
3. **`hub/src/web/middleware/auth.ts` does NOT compare `uid` to `ownerId`.** It accepts any HS256-signed JWT whose payload matches `{ uid: number }`. CONTEXT.md D-185 lists `'uid != ownerId → 401'` as a middleware test case — that case is **not implementable against the current middleware** and should be deferred or dropped.

**Primary recommendation:** Adopt the per-SUT seam strategy below verbatim. Add a 6-line constants `export` to `useSSE.ts` (allowed by D-190 as semantic-neutral). Surface the three contract corrections above to the planner so PLAN.md doesn't carry over CONTEXT.md guesses.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| `PermissionMode → CursorArgsFragment` matrix | CLI (cli/src/agent) | — | Pure mapping function; no I/O, no async, no DOM. Lives next to the SUT. |
| SSE reconnect convergence | Browser/Client (web/src/hooks) | — | `EventSource` is a browser API; `useSSE` consumes it inside React; jsdom test environment is correct. |
| Auth route negative cases | Frontend Server / API (hub/src/web/routes) | — | Hono route under `bun:test`, exercised via `app.request()`. No real server, no real socket. |
| Auth middleware negative cases | Frontend Server / API (hub/src/web/middleware) | — | Middleware is a `MiddlewareHandler<WebAppEnv>`; tested by mounting it on a throwaway `Hono` app and calling `app.request()`. |
| Guard for `permissionMode` hardcoded comparisons | Repo-root scripts | — | Same tier as existing Phase 5/6/9/10 guard blocks in `scripts/check-no-cut-agents.sh`. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-176** Double safety on the matrix: `satisfies Record<PermissionMode, ExpectedSpec>` (compile-time exhaustiveness) **plus** `expect(Object.keys(MATRIX).sort()).toEqual([...].sort())` (runtime key-set check).
- **D-177** Matrix-driven args assertion: for every row, `expect(permissionModeToCursorArgs(row.mode)).toEqual(row.expectedArgs)` — strict equality, no partial matching.
- **D-178** New file `cli/src/agent/permissionMatrix.test.ts`; keep `modeConfig.test.ts` focused on `UnknownPermissionModeError` and behavioral cases.
- **D-179** Append a Phase-11 guard block to `scripts/check-no-cut-agents.sh` that forbids hardcoded `permissionMode` branch comparisons outside `cli/src/cursor/` and `cli/src/agent/` (must not overlap Phase 5/6 patterns).
- **D-180** REFT-02: MockEventSource under jsdom + `vi.useFakeTimers`. No real hub.
- **D-181** REFT-02 invariant = eventual consistency of TanStack Query cache. Never assert intermediate patch shape.
- **D-182** Retry-budget constants come from researcher's read of `useSSE.ts` (this file — see § Standard Stack below).
- **D-183** Tests must remain green after Phase 7 rewrites useSSE — only assert final cache contents.
- **D-184** No JWT replay-detection (no blacklist / nonce / single-use). "Replayed JWT" = expired-JWT-resubmitted, already handled by `jose`'s `exp` check.
- **D-185** Two-layer split:
  - `hub/src/web/routes/auth.test.ts` (bun:test, `app.request()`): empty body → 400, missing `accessToken` field → 400, non-string `accessToken` → 400, bad token → 401, legal token → 200 + decodable JWT.
  - `hub/src/web/middleware/auth.test.ts` (bun:test): missing `Authorization` → 401, `Bearer ` empty → 401, expired JWT → 401, tampered signature → 401, wrong `alg` (`none` / `RS256`) → 401, `uid != ownerId` → 401. **⚠ See "Phase Requirements" §M3 — last case is not implementable against current middleware.**
- **D-186** Shared `assertNoSecretLeak(responseBody, capturedLogs, secrets)` helper covers every REFT-03 failure case (response-body and log spies).
- **D-187** JWT factories (`makeValidJwt`/`makeExpiredJwt`/`makeTamperedJwt`/`makeWrongAlgJwt`) are module-local in `middleware/auth.test.ts`, following the `make*` convention from TESTING.md.
- **D-188** Coverage: run `cd cli && bun run vitest run --coverage` at end of phase, record numbers in `11-DISCUSSION-LOG.md`. No CI gate this phase.
- **D-189** Slice cadence: REFT-01 → REFT-03 → REFT-02 → guard sweep + coverage snapshot. Each slice independently green (`bun typecheck` + `bun run test`).
- **D-190** No new production code. Sole exception: `useSSE.ts` may add a pure `export` of existing backoff constants for testability — value unchanged.

### Claude's Discretion

- Slice ordering inside cadence (default: REFT-01 → REFT-03 → REFT-02 → guard + coverage).
- `MockEventSource` injection seam: `globalThis.EventSource` monkey-patch vs. useSSE factory parameter. **Researcher recommendation:** keep the existing monkey-patch — see §Architecture Patterns.
- `assertNoSecretLeak` location: `hub/src/test-utils/` vs. `hub/src/web/test-utils/`. **Researcher recommendation:** `hub/src/web/test-utils/assertNoSecretLeak.ts` — see §Architecture Patterns.
- Phase-11 guard pattern: must not overlap Phase 5/6/10 blocks. **Researcher recommendation:** see §Code Examples.

### Deferred Ideas (OUT OF SCOPE)

- JWT replay-detection (blacklist / nonce / single-use).
- Real-hub + real-EventSource SSE integration test.
- CI coverage gate.
- Refactoring `useSSE.ts` beyond the D-190-allowed constant `export`.
- Promoting `assertNoSecretLeak` to `shared/test-utils/`.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFT-01 | Cursor permission contract matrix; new mode must fail | §M1 below — exact return values per mode extracted from `modeConfig.ts`; expected-set source is `CURSOR_PERMISSION_MODES` in `shared/src/modes.ts`. |
| REFT-02 | SSE reconnect / patch-loss invariant test | §M2 below — backoff constants extracted from `useSSE.ts`; MockEventSource seam already in `useSSE.test.tsx`. |
| REFT-03 | Auth negative cases (route + middleware), no secret leakage | §M3 below — exact 4xx + body shapes extracted from `auth.ts` route and `auth.ts` middleware. |

### M1 — REFT-01 ground truth (extracted from `cli/src/agent/modeConfig.ts`)

`permissionModeToCursorArgs(mode)` returns `CursorArgsFragment = { mode?: 'plan' | 'ask'; yolo?: boolean }`. Full row table the matrix must encode:

| `mode` input | Expected return (deep equal) | Source line |
|--------------|------------------------------|-------------|
| `undefined` | `{}` | modeConfig.ts:12 |
| `'default'` | `{}` | modeConfig.ts:12 |
| `'plan'` | `{ mode: 'plan' }` | modeConfig.ts:13 |
| `'ask'` | `{ mode: 'ask' }` | modeConfig.ts:14 |
| `'yolo'` | `{ yolo: true }` | modeConfig.ts:15 |

Expected key-set source for D-176 runtime cross-check: `CURSOR_PERMISSION_MODES = ['default', 'plan', 'ask', 'yolo']` in `shared/src/modes.ts:4` (re-exported via `shared/src/types.ts:42` as `CursorPermissionMode`, which `cli/src/cursor/modes.ts:12` re-aliases as `PermissionMode`). The matrix's runtime cross-check should compare `Object.keys(MATRIX).sort()` against `CURSOR_PERMISSION_MODES.slice().sort()` — **never** against a locally hardcoded array (otherwise the guard fails the same way it would in the SUT).

`undefined` is a fifth input but not a `PermissionMode` member — it should be exercised by a dedicated `it('returns {} for undefined')` rather than included in the `Record<PermissionMode, …>` literal (otherwise `satisfies` fails).

**⚠ Correction to CONTEXT.md wording:** CONTEXT §Specifics describes "`expectedArgs: string[]`". This is wrong — the return is an object literal, not a CLI argv array. `CursorArgsFragment` is consumed by `cli/src/cursor/cursorLocalLauncher.ts` / `cursorRemoteLauncher.ts` and translated into argv there (Phase 6 D-94). The matrix's `expectedArgs` field should be typed `CursorArgsFragment` (or inline `{ mode?: 'plan'|'ask'; yolo?: boolean }`).

### M2 — REFT-02 ground truth (extracted from `web/src/hooks/useSSE.ts`)

Backoff / heartbeat constants (lines 27–31, module-local, **not currently exported**):

```typescript
const HEARTBEAT_STALE_MS = 90_000
const HEARTBEAT_WATCHDOG_INTERVAL_MS = 10_000
const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const RECONNECT_JITTER_MS = 500
```

**There is no `MAX_RETRIES`.** Reconnect schedule (lines 151–163): `delay = min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2^attempt) + uniform(0, RECONNECT_JITTER_MS)`. `attempt` is incremented on each schedule and **reset to 0 only on successful `onopen`** (line 409). There is no termination condition — the hook retries indefinitely. There is no surfaced error state to assert on top of retry exhaustion.

**Reconnect triggers** the test can drive:
- `onerror` with `eventSource.readyState === EventSource.CLOSED` → `requestReconnect('closed')` (lines 414–418).
- Heartbeat watchdog (line 423–434): if `Date.now() - lastActivityAtRef >= HEARTBEAT_STALE_MS` and tab visible → `requestReconnect('heartbeat-timeout')`.
- Visibilitychange (lines 440–447): tab becomes visible after stale window → `requestReconnect('visibility-recovery')`.

**MockEventSource seam (D-180 recommendation):** the existing test (lines 160–177 of `useSSE.test.tsx`) already does `globalThis.EventSource = MockEventSource as unknown as typeof EventSource` in `beforeEach` and restores in `afterEach`. **Keep this seam**, do not add a factory parameter to `useSSE`. Reasons: (a) zero production-code change (honors D-190), (b) the existing reconnect path closes one `EventSource` and opens a new one — monkey-patch handles both transparently, (c) a factory-param seam would mean every `useSSE` caller across `web/src` either adopts it or stays on a default — pure scope creep.

**MockEventSource gaps for REFT-02:** the existing mock (`useSSE.test.tsx:18–48`) lacks an `onerror` dispatcher. To drive `requestReconnect('closed')` the mock needs:

```typescript
emitError() {
    this.readyState = MockEventSource.CLOSED
    this.onerror?.({} as Event)
}
emitOpen() {
    this.readyState = MockEventSource.OPEN
    this.onopen?.()
}
```

These are mock-only additions; they don't change `useSSE`'s contract.

**Bounded-budget assertion shape (replacing the dropped "MAX_RETRIES" case):** under `vi.useFakeTimers`, after dispatching `emitError()`, the test asserts that `await vi.advanceTimersByTimeAsync(RECONNECT_MAX_DELAY_MS + RECONNECT_JITTER_MS)` causes a new `MockEventSource` instance to appear in `MockEventSource.instances`. The "bounded budget" is the wall-clock budget per attempt, not a max-attempt count.

**D-190 minimal export (recommended).** Add to `useSSE.ts` (replacing five `const` lines with five `export const` lines — value unchanged):

```typescript
export const HEARTBEAT_STALE_MS = 90_000
export const HEARTBEAT_WATCHDOG_INTERVAL_MS = 10_000
export const RECONNECT_BASE_DELAY_MS = 1_000
export const RECONNECT_MAX_DELAY_MS = 30_000
export const RECONNECT_JITTER_MS = 500
```

This is the only way to make convergence-window assertions in REFT-02 truly drive off the implementation rather than test-local duplicates. CONTEXT D-190 explicitly permits this.

### M3 — REFT-03 ground truth (extracted from `hub/src/web/routes/auth.ts` + `hub/src/web/middleware/auth.ts`)

**Route layer (`createAuthRoutes(jwtSecret, cliApiToken, ownerId)` → `POST /auth`):**

| Test scenario | Actual code path | Expected status + body |
|----|----|----|
| Non-JSON body (e.g. `"not json"`) | `c.req.json().catch(() => null)` → `null` → schema fail | **400** `{ error: 'Invalid body' }` |
| Empty JSON `{}` | `authBodySchema.safeParse` fails (missing `accessToken`) | **400** `{ error: 'Invalid body' }` |
| `{ accessToken: 123 }` (non-string) | Schema fails (type mismatch) | **400** `{ error: 'Invalid body' }` |
| `{ accessToken: '' }` | Schema **passes** (empty string is a string); `parseAccessToken('')` returns `null` (line 3 of `accessToken.ts`); first half of `if (!parsedToken \|\| !constantTimeEquals(...))` is truthy | **401** `{ error: 'Invalid access token' }` |
| `{ accessToken: 'wrong' }` | Schema passes; `constantTimeEquals` false | **401** `{ error: 'Invalid access token' }` |
| `{ accessToken: '<correctTokenWithLeadingWhitespace>' }` | `parseAccessToken` trims → equals; **passes** | **200** + `{ token, user: {…} }` (JWT decodable via `jose.jwtVerify`) |
| Legal `{ accessToken: cliApiToken }` | Pass path | **200** + JWT with `exp ≈ now + 4h`, payload `{ uid: ownerId }`, header `alg: HS256` |

**⚠ Correction to CONTEXT.md D-185 / Specifics:** CONTEXT lists `{ accessToken: '' }` as **400**, but the schema accepts it (`z.string()` does not enforce non-empty). It is **401**. Either accept this as the answer or change the route to `z.string().min(1)` (= scope creep, forbidden by D-190).

**Middleware layer (`createAuthMiddleware(jwtSecret)`):**

| Test scenario | Actual code path | Expected status + body |
|----|----|----|
| Path is `/api/auth` | Early `await next()` (lines 22–26) | next() invoked, no 401 |
| Missing `Authorization` header on any other `/api/*` path | `token === undefined` | **401** `{ error: 'Missing authorization token' }` |
| `Authorization: Bearer ` (trailing space, empty token) | `tokenFromHeader === ''`, falsy → `token === undefined` | **401** `{ error: 'Missing authorization token' }` |
| `Authorization: Bearer <tampered>` | `jwtVerify` throws (signature mismatch) | **401** `{ error: 'Invalid token' }` |
| `Authorization: Bearer <expired>` | `jwtVerify` throws `JWTExpired` | **401** `{ error: 'Invalid token' }` |
| Token signed with `alg: 'RS256'` while secret is HS | `jwtVerify` rejects under `algorithms: ['HS256']` | **401** `{ error: 'Invalid token' }` |
| Forged `alg: 'none'` | `jose` rejects (`none` not in allowed algs, and not signed) | **401** `{ error: 'Invalid token' }` |
| Valid JWT but payload `{ foo: 'bar' }` (no `uid`) | `jwtPayloadSchema.safeParse` fails | **401** `{ error: 'Invalid token payload' }` |
| Valid JWT, `{ uid: 12345 }`, `12345 !== ownerId` | **No code path checks this** — middleware sets `userId` and calls `next()` | **HTTP 200 / next()-pass** (NOT 401) |
| `GET /api/events?token=<bad>` (no header) | Falls back to query param (lines 30–31), then jwtVerify rejects | **401** `{ error: 'Invalid token' }` |
| Path `/api/events` with valid query token | Same query fallback, then verifies | next() invoked |

**⚠ Correction to CONTEXT.md D-185 (sixth middleware case):** `uid != ownerId → 401` is not implementable against the current middleware. Three options for the planner:
1. **(recommended)** Drop the case in PLAN.md, note in `11-DISCUSSION-LOG.md` that the middleware accepts any HS256 JWT with `{uid:number}` and this is a deliberate Tailscale-single-user posture (consistent with D-184).
2. Replace the case with the implementable variant: `it('valid JWT with non-number uid → 401 Invalid token payload')` (asserts `jwtPayloadSchema` rejection).
3. Add an `ownerId` parameter to `createAuthMiddleware` and enforce `uid === ownerId`. **This is scope creep — forbidden by D-190.** Mention only to dismiss.

Path-dependent behavior also requires fresh test coverage. The "Path is `/api/auth`" early-return must be exercised explicitly so future refactors of `createAuthMiddleware` can't accidentally start 401'ing the login endpoint.

**`assertNoSecretLeak(responseBody, capturedLogs, secrets[])` (D-186) recommended location:** `hub/src/web/test-utils/assertNoSecretLeak.ts` (new directory). Rationale:
- `hub/src/test-utils/` does not exist (confirmed via `Glob hub/src/**/test-utils/**` — zero hits).
- The helper's only callers in Phase 11 live under `hub/src/web/` (route + middleware tests). Co-locating it in `hub/src/web/test-utils/` keeps it within the same Hono-aware boundary and lets it import `WebAppEnv` later without a long relative path.
- Promotion to `hub/src/test-utils/` or `shared/test-utils/` is explicitly Deferred (CONTEXT.md §Deferred).
- File and its directory must end up matched by `bun test` discovery (the helper itself is **not** a test file — name it `assertNoSecretLeak.ts`, no `.test`). Tests under `hub/src/web/routes/` and `hub/src/web/middleware/` import it via relative path `../test-utils/assertNoSecretLeak`.

**Helper sketch:**

```typescript
import { expect } from 'bun:test'

export function assertNoSecretLeak(
    responseBody: string,
    capturedLogs: string[],
    secrets: ReadonlyArray<string>,
): void {
    for (const secret of secrets) {
        if (!secret) continue
        expect(responseBody).not.toContain(secret)
        for (const line of capturedLogs) {
            expect(line).not.toContain(secret)
        }
    }
}
```

The log spy goes in each test (not the helper) since `spyOn` lifecycle is per-suite:

```typescript
import { spyOn } from 'bun:test'

function captureConsole() {
    const logs: string[] = []
    const spies = (['log', 'warn', 'error'] as const).map((m) =>
        spyOn(console, m).mockImplementation((...args: unknown[]) => {
            logs.push(args.map(String).join(' '))
        }),
    )
    return { logs, restore: () => spies.forEach((s) => s.mockRestore()) }
}
```

Per TESTING.md anti-pattern guidance: tests under `hub/` must only `import` from `bun:test`, never `vitest`.

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| `vitest` | `^4.0.16` | Test runner for `cli/` and `web/` | TESTING.md table; matches existing tests in both SUTs' packages |
| `@testing-library/react` | (installed in `web/`) | React hook + component testing | Already in use throughout `web/src/**/*.test.tsx` |
| `@tanstack/react-query` | (installed in `web/`) | Required to mount `useSSE` (it calls `useQueryClient`) | Already used in existing `useSSE.test.tsx` harness |
| `bun:test` | bundled with Bun 1.3.14 | Test runner for `hub/` | TESTING.md table; matches `cli.test.ts` / `machines.test.ts` |
| `jose` | (installed in `hub/`) | JWT signing for valid-token fixture + tampered/expired/wrong-alg fixtures | Already used in `hub/src/web/middleware/auth.ts:3` and `hub/src/web/routes/auth.ts:2` |
| `hono` | (installed in `hub/`) | Mount middleware/route under `app.request()` in tests | Already used in `cli.test.ts:2` |
| `zod` | (installed in `hub/`) | Validate JWT payload shape | Already in middleware; tests don't need to import directly |

### Supporting

| Library | Version | Purpose | When to use |
|---------|---------|---------|-------------|
| `vi.useFakeTimers` (Vitest built-in) | n/a | Advance reconnect backoff deterministically | REFT-02 only; remember `vi.useRealTimers()` in `afterEach` |
| `vi.spyOn(console, …)` | n/a | Verify `[useSSE]` malformed-event log shape | REFT-02 already uses it |
| `spyOn(console, …)` from `bun:test` | n/a | `assertNoSecretLeak` log capture | REFT-03 only |

**No new packages required.** Skip § Package Legitimacy Audit — this phase installs zero packages.

### Alternatives Considered (rejected)

| Instead of | Could Use | Rejected because |
|---|---|---|
| Monkey-patch `globalThis.EventSource` | Add factory param to `useSSE` | D-190 (no production change beyond constant export); existing tests already on monkey-patch pattern; broader call-site churn |
| Real `jose.SignJWT` to build tampered JWTs | Hand-craft base64 segments | Hand-crafting works for `alg:'none'` and signature-tamper cases, but `jose.SignJWT` is cleaner for valid + expired. Use both: `jose.SignJWT` for valid/expired/wrong-alg; manual base64 for `alg:'none'` (since `jose` won't sign `'none'`) and signature-tamper (concat then mutate last segment). |
| Real `EventSource` polyfill + jsdom | MockEventSource | TESTING.md "no E2E" + flaky network behavior; already established as project pattern. |
| `replayed-JWT` blacklist test | "Expired JWT is rejected after 4h" | CONTEXT D-184 + PROJECT.md single-user Tailscale posture. |

## Package Legitimacy Audit

Skipped — Phase 11 installs zero packages. All libraries listed above are pre-existing transitive deps of this monorepo (verified by reading existing test files that import them).

## Architecture Patterns

### System diagram (test-level view, not production)

```
                       ┌─────────────────────────────────────┐
                       │  REFT-01 (cli/, Vitest)              │
PermissionMode union ──┤  permissionMatrix.test.ts            │
(shared/src/modes.ts)  │     ↑ satisfies Record exhaustive    │
                       │     ↑ Object.keys runtime cross-check│
                       │     ↑ per-row toEqual                │
                       └─────────────────────────────────────┘
                                       │
                                       ▼
                       cli/src/agent/modeConfig.ts (SUT, unchanged)

                       ┌─────────────────────────────────────┐
                       │  REFT-02 (web/, Vitest + jsdom)      │
                       │  useSSE.test.tsx (extended)          │
                       │   ─ globalThis.EventSource = Mock    │
EventSource browser ◄──┤   ─ vi.useFakeTimers                 │
API contract           │   ─ dispatch / emitError / emitOpen  │
                       │   ─ assert QueryClient cache final   │
                       └─────────────────────────────────────┘
                                       │
                                       ▼
                       web/src/hooks/useSSE.ts (SUT, +export consts)

                       ┌─────────────────────────────────────┐
                       │  REFT-03 (hub/, bun:test)            │
HTTP request           │  auth.test.ts (route layer)          │
(synthetic via         │     ↑ Hono app.request()             │
Hono app.request) ────►│  middleware/auth.test.ts             │
                       │     ↑ mount middleware on tiny app   │
                       │     ↑ jose.SignJWT factories         │
                       │     ↑ assertNoSecretLeak helper      │
                       └─────────────────────────────────────┘
                                       │
                                       ▼
                       hub/src/web/routes/auth.ts (SUT, unchanged)
                       hub/src/web/middleware/auth.ts (SUT, unchanged)

                       ┌─────────────────────────────────────┐
                       │  Guard sweep                         │
                       │  scripts/check-no-cut-agents.sh      │
                       │     ↑ Phase-11 block (new, at tail)  │
                       └─────────────────────────────────────┘
```

### Recommended file layout

```
cli/src/agent/
├── modeConfig.ts                    (SUT — unchanged)
├── modeConfig.test.ts               (unchanged — error-path tests)
└── permissionMatrix.test.ts         (NEW — REFT-01)

web/src/hooks/
├── useSSE.ts                        (+ export 5 constants; D-190)
└── useSSE.test.tsx                  (extended — REFT-02 describe block)

hub/src/web/
├── routes/
│   ├── auth.ts                      (SUT — unchanged)
│   └── auth.test.ts                 (NEW — REFT-03 route layer)
├── middleware/
│   ├── auth.ts                      (SUT — unchanged)
│   └── auth.test.ts                 (NEW — REFT-03 middleware layer)
└── test-utils/
    └── assertNoSecretLeak.ts        (NEW — shared helper, hub-only)

scripts/check-no-cut-agents.sh       (+ Phase 11 block at tail; before final `echo "✅ Phase 10 guard PASS."`)
```

### Pattern 1: Type-exhaustive matrix with runtime cross-check

```typescript
// Source: cli/src/agent/permissionMatrix.test.ts (new file)
// Pattern verified against: cli/src/agent/modeConfig.ts (SUT),
//                           shared/src/modes.ts:4 (CURSOR_PERMISSION_MODES),
//                           shared/src/flavors.ts:40 (FLAVOR_CAPS.cursor.permissionModes)
import { describe, expect, it } from 'vitest'
import { permissionModeToCursorArgs, type CursorArgsFragment } from './modeConfig'
import type { PermissionMode } from '@/cursor/modes'
import { CURSOR_PERMISSION_MODES } from '@hapi/protocol/modes'
import { FLAVOR_CAPS } from '@hapi/protocol/flavors'

type ExpectedSpec = { expectedArgs: CursorArgsFragment }

const MATRIX = {
    default: { expectedArgs: {} },
    plan:    { expectedArgs: { mode: 'plan' } },
    ask:     { expectedArgs: { mode: 'ask' } },
    yolo:    { expectedArgs: { yolo: true } },
} as const satisfies Record<PermissionMode, ExpectedSpec>

describe('Cursor permission contract matrix (REFT-01)', () => {
    it('matrix keys equal CURSOR_PERMISSION_MODES (runtime cross-check, D-176)', () => {
        expect(Object.keys(MATRIX).sort()).toEqual([...CURSOR_PERMISSION_MODES].sort())
    })

    it('matrix keys equal FLAVOR_CAPS.cursor.permissionModes (capability table alignment)', () => {
        expect(Object.keys(MATRIX).sort()).toEqual([...FLAVOR_CAPS.cursor.permissionModes].sort())
    })

    for (const [mode, spec] of Object.entries(MATRIX) as Array<[PermissionMode, ExpectedSpec]>) {
        it(`mode '${mode}' produces ${JSON.stringify(spec.expectedArgs)} (D-177)`, () => {
            expect(permissionModeToCursorArgs(mode)).toEqual(spec.expectedArgs)
        })
    }
})
```

The dual `expect` against both `CURSOR_PERMISSION_MODES` and `FLAVOR_CAPS.cursor.permissionModes` is cheap insurance against the two sources drifting apart in the future.

### Pattern 2: SSE reconnect convergence under fake timers

```typescript
// Source: web/src/hooks/useSSE.test.tsx (extension; reuses existing harness lines 123–157)
import { vi, beforeEach, afterEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    RECONNECT_BASE_DELAY_MS,
    RECONNECT_JITTER_MS,
    RECONNECT_MAX_DELAY_MS,
} from './useSSE'

describe('useSSE reconnect convergence (REFT-02)', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('reconnects after onerror+CLOSED within bounded backoff window', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.sessions, { sessions: [] })
        mountUseSSE(wrapper)

        const first = activeSource()
        await act(async () => { first.emitOpen() })

        await act(async () => { first.emitError() })  // triggers requestReconnect('closed')
        expect(MockEventSource.instances.length).toBe(1)

        await act(async () => {
            await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS + RECONNECT_JITTER_MS)
        })

        expect(MockEventSource.instances.length).toBe(2)
        const second = activeSource()
        expect(second).not.toBe(first)
    })

    it('cache converges to authoritative snapshot after dropped events + reconnect', async () => {
        // 1. open → dispatch session-added(A) → cache holds [A]
        // 2. emitError → fake-timer advance → second instance opens
        // 3. dispatch session-added(B) on second instance (the "dropped intermediate event" is simply never dispatched on instance 1)
        // 4. dispatch session-updated(A with updatedAt=9999) on second instance — server-authoritative reconciliation
        // 5. assert cache === { sessions: [A_updated, B] sorted by sortSessionSummaries }
        // (Assert only final cache contents — never the patch shape; D-183.)
    })
})
```

The "dropped event" semantic in REFT-02 is **not** "MockEventSource buffers and silently drops one dispatch" — there's no real buffer. The semantic is: between `emitError` and the second instance opening, server-side events that never reached the client are *replaced* by the authoritative snapshot that comes after reconnect. The test models this by simply not dispatching the gap events on instance 1 and then dispatching the authoritative state on instance 2.

### Pattern 3: Hono route + middleware testing under `bun:test`

```typescript
// Source: hub/src/web/routes/auth.test.ts (new file)
// Pattern derived from: hub/src/web/routes/cli.test.ts (lines 1–17)
import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { jwtVerify } from 'jose'
import { createAuthRoutes } from './auth'
import { assertNoSecretLeak } from '../test-utils/assertNoSecretLeak'

const jwtSecret = new TextEncoder().encode('test-secret-with-enough-entropy-for-hs256')
const cliApiToken = 'cli-token-xyz'
const ownerId = 42

function makeApp() {
    const app = new Hono()
    app.route('/api', createAuthRoutes(jwtSecret, cliApiToken, ownerId))
    return app
}

describe('POST /api/auth (REFT-03 route)', () => {
    it('rejects empty JSON body with 400 Invalid body', async () => {
        const res = await makeApp().request('/api/auth', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
        })
        expect(res.status).toBe(400)
        const body = await res.text()
        expect(JSON.parse(body)).toEqual({ error: 'Invalid body' })
        assertNoSecretLeak(body, [], [cliApiToken])
    })

    it('accepts correct token, returns decodable HS256 JWT with uid=ownerId', async () => {
        const res = await makeApp().request('/api/auth', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accessToken: cliApiToken }),
        })
        expect(res.status).toBe(200)
        const { token } = await res.json()
        const { payload, protectedHeader } = await jwtVerify(token, jwtSecret, { algorithms: ['HS256'] })
        expect(protectedHeader.alg).toBe('HS256')
        expect(payload.uid).toBe(ownerId)
    })
})
```

```typescript
// Source: hub/src/web/middleware/auth.test.ts (new file)
import { describe, expect, it, spyOn } from 'bun:test'
import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { createAuthMiddleware, type WebAppEnv } from './auth'
import { assertNoSecretLeak } from '../test-utils/assertNoSecretLeak'

const jwtSecret = new TextEncoder().encode('test-secret-with-enough-entropy-for-hs256')

async function makeValidJwt(uid = 1, ttl = '4h'): Promise<string> {
    return await new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt().setExpirationTime(ttl).sign(jwtSecret)
}
async function makeExpiredJwt(uid = 1): Promise<string> {
    return await new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 24)  // 1 day ago
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)      // expired 1 min ago
        .sign(jwtSecret)
}
async function makeTamperedJwt(uid = 1): Promise<string> {
    const valid = await makeValidJwt(uid)
    const [h, p, s] = valid.split('.')
    return `${h}.${p}.${s.slice(0, -2)}AA`  // last 2 chars overwritten
}
function makeAlgNoneJwt(uid = 1): string {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ uid })).toString('base64url')
    return `${header}.${payload}.`
}

function mount() {
    const app = new Hono<WebAppEnv>()
    app.use('/api/*', createAuthMiddleware(jwtSecret))
    app.get('/api/ping', (c) => c.json({ ok: true }))
    return app
}

// ... it() per row in §M3 middleware table ...
```

### Anti-patterns to avoid

- **Importing `vi` / `vitest` inside `hub/`.** TESTING.md anti-pattern — `hub/` runs under `bun test`. Same in reverse: no `bun:test` in `cli/` or `web/`.
- **Asserting on patch shape inside REFT-02.** Violates D-183 — assertion must terminate on cache equality, not on `setQueryData` argument inspection.
- **Hardcoding `['default','plan','ask','yolo']` inside the matrix runtime cross-check.** Defeats the guard — must compare against `CURSOR_PERMISSION_MODES` import.
- **Catching the `jose` error and asserting the message string.** Couples tests to library wording; only assert HTTP status + sanitized body.
- **Including `undefined` as a key in `Record<PermissionMode, …>`.** `undefined` is not a `PermissionMode` member; it breaks `satisfies` exhaustiveness. Exercise it via a dedicated `it()`.
- **Real `setTimeout` waits inside REFT-02.** TESTING.md anti-pattern. Use `vi.useFakeTimers` + `vi.advanceTimersByTimeAsync`.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| JWT signing in tests | Concat header.payload.HMAC manually | `jose.SignJWT` | Already a hub dependency; same library SUT uses. Hand-rolled HMAC will diverge on canonicalization edge cases. |
| Expired-JWT fixture | Mock system clock | `setIssuedAt(<past>) + setExpirationTime(<past>)` | `jose` validates `exp` against real `Date.now()` — no clock mocking needed. |
| Test-only HTTP harness | Bun's `serve()` + ephemeral port | `app.request(url, init)` | Exact pattern in `cli.test.ts:27`; zero port management; no flake. |
| Tampered JWT | Re-implement HS256 with wrong key | Sign with correct key then mutate signature segment | Simpler and verifies the rejection path you actually care about (signature mismatch). |
| Wrong-alg JWT | Forge `alg:'none'` via `jose` (`jose` refuses) | Hand-construct `header.payload.` (empty sig) | `jose.SignJWT` deliberately won't sign `alg:'none'`; manual base64 is the only path. Keep it in a single 3-line helper. |
| Reconnect timing in tests | Real `setTimeout` + `sleep(31_000)` | `vi.useFakeTimers` + `vi.advanceTimersByTimeAsync(constant)` | TESTING.md anti-pattern. Tests must be < 1s wall time. |
| `MockEventSource` from scratch | Bring in `eventsource-polyfill` | Extend existing 30-line mock in `useSSE.test.tsx` | Mock already covers OPEN / CLOSED / `dispatch`. Only add `emitOpen` / `emitError`. |

**Key insight:** Phase 11 has zero "new tech" — every primitive is already in active use in either an adjacent test file, the SUT itself, or the existing guard script.

## Runtime State Inventory

Skipped — Phase 11 is purely test-additive. No renames, no migrations, no string sweeps that would leave runtime state stranded. Only side effects on disk: new `.test.ts(x)` files, one new `.ts` helper, and an additive block in `scripts/check-no-cut-agents.sh`.

## Common Pitfalls

### Pitfall 1 — `bun:test` vs `vitest` import drift
**What goes wrong:** Importing `vi` inside a `hub/*.test.ts` file silently fails (bun-test has no `vi`) — test passes when it shouldn't.
**Prevention:** When creating `auth.test.ts` (route or middleware), copy the import header from `cli.test.ts:1`. Never copy from `useSSE.test.tsx`. The `scripts/check-no-cut-agents.sh` Phase-11 block (see § Code Examples) includes a regex sweep enforcing this.

### Pitfall 2 — `assertNoSecretLeak` false-positive on UUID
**What goes wrong:** If `cliApiToken` happens to be a short random string that appears as a substring of the JWT (the JWT itself is base64-encoded and may incidentally contain the token's characters), `expect(body).not.toContain(token)` would fail on the **success** path even when no leak occurred.
**Prevention:** In test fixtures, use `cliApiToken = 'cli-token-xyz-do-not-leak-marker'` (long, unique, lower-case, non-base64-alphabet-suspicious) so accidental substring collisions are statistically impossible. Never reuse a real token.

### Pitfall 3 — Fake-timer leakage into other tests
**What goes wrong:** `vi.useFakeTimers()` in one `describe` leaks into subsequent `describe` blocks if `vi.useRealTimers()` isn't called in `afterEach`, breaking unrelated `await waitFor(...)` calls.
**Prevention:** Pair `vi.useFakeTimers()` with `vi.useRealTimers()` in `afterEach` **inside the REFT-02 describe block only**. Do not enable fake timers in the existing top-level `describe('useSSE handleSyncEvent', …)`.

### Pitfall 4 — Hono `c.req.json()` vs. `app.request()` body content-type
**What goes wrong:** `c.req.json()` returns `null` (caught) when `content-type` is missing or wrong, producing a 400. Some tests forget the `content-type: application/json` header and end up asserting the 400 path for the wrong reason.
**Prevention:** Always set `headers: { 'content-type': 'application/json' }` in `app.request()` calls that send JSON bodies. Asserting the empty-body 400 should use `body: '{}'` **with** the content-type header.

### Pitfall 5 — Test file picked up as production by the Phase-11 guard
**What goes wrong:** Phase-11 guard pattern (`permissionMode\s*===`) would match the new `permissionMatrix.test.ts` itself.
**Prevention:** Use `--glob '!**/*.test.ts'` in the new guard block (consistent with Phase 8 / Phase 10 patterns, e.g. `check-no-cut-agents.sh:310`). Scope source dirs to `cli/src hub/src web/src shared/src` and exclude both `cli/src/cursor/` and `cli/src/agent/` since those are the legitimate homes of the comparison.

### Pitfall 6 — `vi.useFakeTimers` interacting with `await waitFor`
**What goes wrong:** `waitFor` polls using real timers internally; under fake timers it appears to hang.
**Prevention:** Inside the REFT-02 describe, prefer `await act(async () => { await vi.advanceTimersByTimeAsync(N) })` followed by a synchronous `expect(...)`. Use `waitFor` only outside fake-timer regions.

## Code Examples

### Phase 11 guard block (append to `scripts/check-no-cut-agents.sh` BEFORE the final `echo "✅ Phase 10 guard PASS."`)

```bash
# ===== Phase 11 — REFT guards =====
# Zero-tolerance keywords closing REFT-01..REFT-03:
#   #1 hardcoded `permissionMode === '<literal>'` branches outside cli/src/cursor/
#      and cli/src/agent/ (REFT-01: matrix is the single source of truth).
#   #2 `bun:test` imported from cli/ or web/, or `vitest` imported from hub/ or
#      shared/ (TESTING.md cross-runner anti-pattern, REFT-01..REFT-03).
#   #3 `permissionModeToCursorArgs` must still live only in cli/src/agent/modeConfig.ts
#      (already enforced by Phase 6 (#3); Phase 11 leaves it alone — no duplicate
#      guard here.)
PHASE11_BRANCH_PATTERN='permissionMode\s*===\s*['\''"]'
PHASE11_SOURCE_DIRS=(cli/src hub/src web/src shared/src)

# (#1) Hardcoded permissionMode literal comparisons must not appear outside the
# two legitimate homes (cli/src/agent/, cli/src/cursor/) or test files.
PHASE11_BRANCH_HITS=$("$RG_BIN" -n "$PHASE11_BRANCH_PATTERN" \
  "${PHASE11_SOURCE_DIRS[@]}" \
  --glob '!**/*.test.ts' --glob '!**/*.test.tsx' \
  --glob '!cli/src/agent/**' --glob '!cli/src/cursor/**' \
  2>/dev/null || true)
if [ -n "$PHASE11_BRANCH_HITS" ]; then
  echo "$PHASE11_BRANCH_HITS"
  echo ""
  echo "❌ Phase 11 REFT-01: hardcoded permissionMode === '<literal>' outside cli/src/{agent,cursor}/."
  echo "   Route the decision through permissionModeToCursorArgs (cli/src/agent/modeConfig.ts)"
  echo "   or getCapability(...) so the matrix test in permissionMatrix.test.ts owns the contract."
  exit 1
fi
echo "✅ Phase 11 #1: no permissionMode === '<literal>' branches outside cli/src/{agent,cursor}/."

# (#2) Cross-runner import sanity. cli/ + web/ run under Vitest only; hub/ +
# shared/ run under bun:test only. Mixing breaks test discovery and produces
# silent green passes.
PHASE11_BAD_BUNTEST=$("$RG_BIN" -n "from\s+['\"]bun:test['\"]" cli/src web/src 2>/dev/null || true)
if [ -n "$PHASE11_BAD_BUNTEST" ]; then
  echo "$PHASE11_BAD_BUNTEST"
  echo ""
  echo "❌ Phase 11 #2: 'bun:test' imported in cli/ or web/ (must use Vitest)."
  exit 1
fi
PHASE11_BAD_VITEST=$("$RG_BIN" -n "from\s+['\"]vitest['\"]" hub/src shared/src 2>/dev/null || true)
if [ -n "$PHASE11_BAD_VITEST" ]; then
  echo "$PHASE11_BAD_VITEST"
  echo ""
  echo "❌ Phase 11 #2: 'vitest' imported in hub/ or shared/ (must use bun:test)."
  exit 1
fi
echo "✅ Phase 11 #2: test-runner imports respect package boundaries."

echo "✅ Phase 11 guard PASS (REFT-01..03)."
```

This pattern is **disjoint** from existing blocks:
- Phase 5 `PHASE5_BRANCH_PATTERN` matches `flavor\s*===\s*['"]` — different identifier.
- Phase 6 `PHASE6_DUPLICATE_HELPER` matches `permissionModeToAgentArgs` (the deleted name).
- Phase 6 `PHASE6_LAUNCHER_CAST_PATTERN` matches `permissionMode as string` (a `as` cast, not `===`).
- Phase 10 patterns are all about config field names — unrelated.

Verified disjointness by reading lines 32–37 (Phase 1/3/4/5 patterns), 160–163 (Phase 6), 215–217 (Phase 7), 295–326 (Phase 8), 397–401 (Phase 9), 529–574 (Phase 10) of `scripts/check-no-cut-agents.sh`.

### Coverage snapshot command (end-of-phase per D-188)

```bash
cd cli && bun run vitest run --coverage --reporter=text \
  --coverage.include='src/cursor/**' \
  --coverage.include='src/agent/**'
```

For `hub/` and `web/` there is no pre-configured coverage provider (TESTING.md §Coverage); fall back to:

```bash
cd hub && bun test --coverage 2>&1 | grep -E '(auth\.ts|sse/)'
cd web && bun run vitest run --coverage --reporter=text --coverage.include='src/hooks/useSSE.ts'
```

Record the three numbers — one per package — in `11-DISCUSSION-LOG.md` under a new `## Coverage Baseline (Phase 11 final)` heading. Phase 10 baseline is **not recorded** anywhere in `.planning/` (verified by `Grep coverage .planning/phases/10-config-cleanup/`); plan must capture the Phase 10 number as the *first* step of the coverage-snapshot slice (run on `main` or on the Phase-10 merge commit, record, then re-run on Phase 11 head). If capturing the historical baseline is impractical, record "no Phase 10 baseline available — Phase 11 numbers are the new baseline" in DISCUSSION-LOG.

## State of the Art

| Old approach | Current approach | Impact |
|---|---|---|
| Test-local hardcoded array of permission modes | `import { CURSOR_PERMISSION_MODES } from '@hapi/protocol/modes'` + `satisfies Record<PermissionMode, …>` | Adding a 5th mode requires updating exactly one production file (`shared/src/modes.ts`) and one test file (`permissionMatrix.test.ts`) — TS forces the second. |
| Real `EventSource` polyfill under jsdom | MockEventSource via `globalThis.EventSource` monkey-patch | Deterministic, fast, no network. Already established in `useSSE.test.tsx`. |
| Replay-detection (blacklist / nonce) | Rely on `jose` `exp` validation + single-user Tailscale posture | D-184: no replay infrastructure needed for this project's threat model. |

**Nothing deprecated** — every primitive used in this phase is current as of the existing test files (latest test in repo: `useSSE.test.tsx` extended in Phase 7 Slice 1, per CONTEXT.md §Reusable Assets).

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `jose.SignJWT` rejects signing with `alg: 'none'` | § Don't Hand-Roll, § Code Examples | LOW — verified behavior in the wider `jose` ecosystem, but not re-tested here. If wrong, the `makeAlgNoneJwt` helper still works (we hand-construct anyway). |
| A2 | `bun:test` `spyOn` log capture works for `console.log/warn/error` in the same way as `vitest` | § M3 helper sketch | LOW — verified in `hub/src/notifications/happyBot.test.ts` patterns referenced by TESTING.md. |
| A3 | Phase 10 line-coverage numbers are not stored anywhere in `.planning/` | § Code Examples (Coverage snapshot) | LOW — `Grep` returned zero numeric baselines in `10-VALIDATION.md` / `10-REVIEW.md`. Planner should re-verify by reading `10-VERIFICATION.md` if it exists. |
| A4 | `vi.advanceTimersByTimeAsync(N)` triggers the `setTimeout` callback that flips `reconnectNonce` and re-enters the `useEffect`, causing a new `EventSource` instance to be constructed | § Pattern 2 | MEDIUM — React 18+ scheduler can sometimes defer state updates past the timer flush. If the test is flaky, wrap the advance in `act(async () => …)` (already shown) and add an extra `await Promise.resolve()` cycle. |

All other claims in this document were extracted directly from source files read in this session.

## Open Questions

1. **`uid != ownerId` middleware case (D-185 sixth bullet) — drop or replace?**
   - What we know: middleware does not enforce ownerId match; CONTEXT.md asserts the test must exist.
   - What's unclear: whether the user wants Option 1 (drop), Option 2 (replace with `non-number uid` case), or Option 3 (production change, forbidden by D-190).
   - Recommendation: Planner picks Option 1 by default (drop) and surfaces in PLAN.md §Risks for user awareness, since Option 3 violates D-190 and Option 2 is a different test from what D-185 specified. Log in `11-DISCUSSION-LOG.md`.

2. **`{ accessToken: '' }` expected status — 400 or 401?**
   - What we know: code returns 401 (schema accepts empty string; parseAccessToken returns null after trim).
   - CONTEXT.md §Specifics asserts 401 already, but §D-185 is ambiguous ("`{ accessToken: '' }` → 401" — already matches reality). Just confirming alignment.
   - Recommendation: Use 401 as specified in §M3 above. No action needed.

3. **Phase 10 coverage baseline — recover or declare new?**
   - What we know: no recorded numeric baseline in `.planning/`.
   - Recommendation: Planner adds a "capture Phase 10 baseline" sub-step at the head of the coverage slice (checkout `main`, run coverage, record, return to phase branch). If branch-switching is awkward, declare Phase 11 numbers as the new baseline and note in DISCUSSION-LOG.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Bun runtime | `bun:test`, hub package | ✓ (project requirement) | 1.3.14 (per `cli/package.json` `packageManager`) | — |
| Vitest | `cli/` + `web/` tests | ✓ (devDep) | `^4.0.16` | — |
| `jose` | hub middleware/route + REFT-03 JWT factories | ✓ (already imported in `hub/src/web/middleware/auth.ts:3`) | n/a | — |
| `hono` | REFT-03 `app.request()` harness | ✓ (already imported in `cli.test.ts:2`) | n/a | — |
| `ripgrep` | Phase-11 guard block | ✓ (project requirement; existing guard works) | n/a | — |
| jsdom | REFT-02 (web/ tests) | ✓ (`web/vitest.config.ts environment: 'jsdom'`) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework (cli) | Vitest `^4.0.16` |
| Framework (web) | Vitest `^4.0.16` (jsdom) |
| Framework (hub) | `bun:test` (Bun 1.3.14) |
| Config (cli) | `cli/vitest.config.ts` |
| Config (web) | `web/vitest.config.ts` + `web/src/test/setup.ts` |
| Config (hub) | none — `bun test` auto-discovers `**/*.test.ts` |
| Quick run (per test file, cli) | `cd cli && bun run vitest run src/agent/permissionMatrix.test.ts` |
| Quick run (per test file, web) | `cd web && bun run vitest run src/hooks/useSSE.test.tsx` |
| Quick run (per test file, hub) | `cd hub && bun test src/web/routes/auth.test.ts` |
| Full suite | `bun run test` (repo root → runs cli + hub + web sequentially) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| REFT-01 | Every PermissionMode row asserted; new mode without row fails | unit (type + runtime) | `cd cli && bun run vitest run src/agent/permissionMatrix.test.ts` | ❌ — Wave 0 create `cli/src/agent/permissionMatrix.test.ts` |
| REFT-02 | SSE reconnect convergence + dropped-event reconciliation | unit (jsdom + fake timers) | `cd web && bun run vitest run src/hooks/useSSE.test.tsx` | ✓ — extend existing file with new describe block + extend `MockEventSource` mock |
| REFT-03 (route) | Empty/non-JSON/invalid/bad-token/valid-token cases | unit (Hono `app.request()`) | `cd hub && bun test src/web/routes/auth.test.ts` | ❌ — Wave 0 create `hub/src/web/routes/auth.test.ts` |
| REFT-03 (middleware) | Missing/empty/expired/tampered/wrong-alg cases | unit (Hono middleware mount) | `cd hub && bun test src/web/middleware/auth.test.ts` | ❌ — Wave 0 create `hub/src/web/middleware/auth.test.ts` |
| REFT-03 (no-leak invariant) | Every failure-case body and log free of secrets | helper-driven assertion | (folded into each failure-case `it()`) | ❌ — Wave 0 create `hub/src/web/test-utils/assertNoSecretLeak.ts` |
| Guard sweep | Phase-11 ripgrep block exits 0 | shell script | `bash scripts/check-no-cut-agents.sh` | ✓ — append block to existing file |
| Type exhaustiveness | New PermissionMode without matrix row → typecheck fails | static | `bun typecheck` (from root or per package) | ✓ — existing pipeline |

### Sampling rate

- **Per task commit:** the per-file quick-run command for the file the task touched (≤ 1 s wall time).
- **Per slice merge:** the package's full suite (`bun run test:cli` / `:hub` / `:web`).
- **Phase gate:** `bun run test` (root) + `bash scripts/check-no-cut-agents.sh` + `bun typecheck` (per package) all green.

### Wave 0 gaps

- [ ] `cli/src/agent/permissionMatrix.test.ts` — covers REFT-01.
- [ ] `hub/src/web/test-utils/assertNoSecretLeak.ts` — helper (no `.test` suffix; not a test file).
- [ ] `hub/src/web/routes/auth.test.ts` — covers REFT-03 route layer.
- [ ] `hub/src/web/middleware/auth.test.ts` — covers REFT-03 middleware layer.
- [ ] `web/src/hooks/useSSE.ts` — add `export` to 5 backoff constants (no value change; D-190).
- [ ] `web/src/hooks/useSSE.test.tsx` — extend `MockEventSource` with `emitOpen` / `emitError` + add `describe('useSSE reconnect convergence (REFT-02)', …)` block.
- [ ] `scripts/check-no-cut-agents.sh` — append Phase 11 guard block per § Code Examples.

Framework install: none needed.

## Security Domain

> `security_enforcement` is not explicitly set to `false` in `.planning/config.json` — section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control (this phase) |
|---|---|---|
| V2 Authentication | yes | REFT-03 verifies the `jose`-based JWT contract (`alg: HS256`, `exp` enforcement, signature verification). No change to auth itself — only test additions. |
| V3 Session Management | yes | REFT-03 covers JWT expiry & rejection. No session store — JWT is stateless per D-184. |
| V4 Access Control | no | Middleware does not enforce `uid === ownerId`; this is by design (Tailscale single-user). Test coverage limited to "valid token → next() is invoked"; access control as such is not in scope this phase. |
| V5 Input Validation | yes | REFT-03 route covers `zod` rejection of empty/non-JSON/non-string body. |
| V6 Cryptography | yes | REFT-03 verifies HS256 enforcement + `alg:'none'` rejection. Uses `jose` (never hand-rolled HMAC). |
| V7 Error Handling & Logging | yes | `assertNoSecretLeak` enforces (a) response body never echoes `cliApiToken` or JWT secret; (b) `console.{log,warn,error}` never logs them either. |

### Known Threat Patterns for `hono` + `jose` auth stack

| Pattern | STRIDE | Standard mitigation (this phase verifies) |
|---|---|---|
| Signature stripping (`alg:'none'` swap) | Spoofing | `jwtVerify` called with `algorithms: ['HS256']` — `alg:'none'` token rejected. REFT-03 middleware case explicitly asserts. |
| Algorithm confusion (HS256 ↔ RS256) | Spoofing | Same allow-list; REFT-03 wrong-alg case asserts rejection. |
| Token theft echoed in error body | Information Disclosure | `assertNoSecretLeak` against every 4xx body. Currently the route returns only `'Invalid body'` / `'Invalid access token'` and middleware returns `'Missing authorization token'` / `'Invalid token'` / `'Invalid token payload'` — none contain the input. Test makes this a regression guard. |
| Token theft via log injection | Information Disclosure | `assertNoSecretLeak` against captured `console.*` lines. |
| Replay after expiry | Spoofing / Repudiation | `exp` enforced by `jose`. REFT-03 expired-JWT case asserts rejection (= the project's "replay-detection"). |
| Timing oracle on `cliApiToken` comparison | Information Disclosure | `hub/src/utils/crypto.ts::constantTimeEquals` uses `node:crypto.timingSafeEqual`. Already in place; no new test required. Optional: a single sanity test that confirms `constantTimeEquals('a','b') === false` and `constantTimeEquals('abc','abc') === true` — but **not in scope** for Phase 11 (already covered indirectly by route 401 tests). |

## Sources

### Primary (HIGH confidence — read directly in this session)

- `cli/src/agent/modeConfig.ts` (lines 1–17) — REFT-01 SUT exact return values.
- `cli/src/agent/modeConfig.test.ts` (lines 1–37) — baseline error-path coverage; complement target.
- `cli/src/cursor/modes.ts` (lines 1–17) — `PermissionMode = CursorPermissionMode` type chain.
- `shared/src/modes.ts` (lines 1–55) — `CURSOR_PERMISSION_MODES` source-of-truth array.
- `shared/src/flavors.ts` (lines 38–48) — `FLAVOR_CAPS.cursor.permissionModes` capability table.
- `web/src/hooks/useSSE.ts` (lines 1–465, especially 27–31 constants, 145–185 reconnect, 414–434 error/watchdog) — REFT-02 SUT.
- `web/src/hooks/useSSE.test.tsx` (lines 1–379, especially 18–48 MockEventSource, 159–178 beforeEach/afterEach) — baseline harness to extend.
- `hub/src/web/routes/auth.ts` (lines 1–49) — REFT-03 route SUT exact 4xx shapes.
- `hub/src/web/routes/cli.test.ts` (lines 1–146) — `app.request()` pattern reference.
- `hub/src/web/middleware/auth.ts` (lines 1–51) — REFT-03 middleware SUT exact 4xx shapes; confirmed **no `ownerId` comparison**.
- `hub/src/utils/crypto.ts` + `hub/src/utils/accessToken.ts` — input pre-processing that determines `{accessToken:''}` is 401 not 400.
- `scripts/check-no-cut-agents.sh` (full read) — Phase 1–10 block patterns; verified disjointness of proposed Phase-11 pattern.
- `.planning/codebase/TESTING.md` (full read) — runner split, `:memory:` Store, `make*` factories, `vi.hoisted`, anti-patterns.
- `.planning/codebase/CONVENTIONS.md` (lines 1–40) — TS strict, named exports, 4-space indent, single quotes.
- `.planning/codebase/STRUCTURE.md` (lines 1–80) — directory layout for new file siting.
- `.planning/REQUIREMENTS.md` (lines 40–43, 133–135, 158) — REFT-01/02/03 requirement text.
- `.planning/phases/11-test-gap-fill/11-CONTEXT.md` (full read) — locked decisions D-176 to D-190, discretion areas, deferred items.
- `.planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md` (lines 1–50) — option matrices A–F (audit-only confirmation).
- `.planning/config.json` — `workflow.nyquist_validation: true` → Validation Architecture section required.

### Secondary (MEDIUM)

- Existing usage of `jose.SignJWT` in `hub/src/web/routes/auth.ts:31–35` confirms HS256 + `.setExpirationTime('4h')` API surface — implicitly verifies factory shapes in §M3.

### Tertiary (LOW)

- None. No WebSearch performed; no external library research needed.

## Metadata

**Confidence breakdown:**
- REFT-01 ground truth: **HIGH** — extracted verbatim from `modeConfig.ts`.
- REFT-02 ground truth: **HIGH** — backoff constants and reconnect paths read line-by-line from `useSSE.ts`; existing test confirms MockEventSource pattern.
- REFT-03 ground truth: **HIGH** — every status code / body shape traced through `auth.ts` + middleware + `accessToken.ts` + `crypto.ts`.
- Guard pattern disjointness: **HIGH** — verified by reading every existing block (Phase 1–10) in `scripts/check-no-cut-agents.sh`.
- `assertNoSecretLeak` location: **MEDIUM** — `hub/src/web/test-utils/` does not exist yet; recommendation is a judgment call documented in §M3.
- Phase 10 coverage baseline: **MEDIUM** — searched and not found; planner must capture in this phase.

**Research date:** 2026-05-23
**Valid until:** 2026-06-22 (30 days — SUTs are stable; Phase 7 reshapes `useSSE` but D-183 insulates REFT-02 from that churn).
