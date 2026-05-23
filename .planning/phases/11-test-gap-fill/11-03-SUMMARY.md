---
phase: 11-test-gap-fill
plan: 03
subsystem: hub/web/auth
tags: [tests, REFT-03, auth, jwt, middleware, no-leak]
requires: []
provides:
  - "REFT-03 route-layer coverage: 400 Invalid body (non-JSON, {}, non-string accessToken), 401 Invalid access token (empty + wrong), 200 HS256 JWT decodable to { uid: ownerId }"
  - "REFT-03 middleware coverage: /api/auth short-circuit, 401 Missing authorization token (no header + Bearer-empty), 401 Invalid token (tampered + expired + wrong-alg + alg:none), 401 Invalid token payload (no-uid case replacing dropped uid != ownerId per orchestrator override 2026-05-23), /api/events ?token= fallback rejection, positive next() control"
  - "Shared no-leak invariant: assertNoSecretLeak helper at hub/src/web/test-utils/ — every 4xx response body AND every captured console.{log,warn,error} line asserted free of access token + raw jwtSecret bytes (D-186)"
affects:
  - hub/src/web/test-utils/assertNoSecretLeak.ts
  - hub/src/web/routes/auth.test.ts
  - hub/src/web/middleware/auth.test.ts
tech_stack:
  added: []
  patterns:
    - "Module-local make* JWT fixture factories on jose SignJWT (D-187)"
    - "captureConsole() via spyOn('log'|'warn'|'error') with try/finally restore (RESEARCH § M3)"
    - "Mount-and-app.request() Hono test pattern (RESEARCH § Pattern 3, mirrors hub/src/web/routes/cli.test.ts)"
    - "Hand-constructed alg:'none' JWS compact serialization with empty signature segment (jose refuses to sign 'none')"
key_files:
  created:
    - hub/src/web/test-utils/assertNoSecretLeak.ts
    - hub/src/web/routes/auth.test.ts
    - hub/src/web/middleware/auth.test.ts
  modified: []
decisions:
  - "Helper location: hub/src/web/test-utils/assertNoSecretLeak.ts (NOT hub/src/test-utils/) — per RESEARCH § M3 recommendation and CONTEXT § Deferred (a project-wide hub/src/test-utils is out of scope for this plan)."
  - "Wrong-alg construction: HS512 re-sign with the same secret. Header alg='HS512' is outside the middleware's `algorithms: ['HS256']` allow-list, so jose rejects with JWSAlgNotAllowed before signature verification — the simplest deterministic path to a 401 Invalid token."
  - "Orchestrator override 2026-05-23 applied: the dropped uid != ownerId middleware case is replaced by a `makePayloadWithoutUidJwt()` case asserting 401 Invalid token payload (middleware validates uid TYPE via zod, not uid VALUE)."
  - "Empty-string accessToken pinned to 401 (NOT 400). `parseAccessToken('')` trims to null and falls through to the constantTimeEquals failure path — RESEARCH § M3 ground-truth correction adopted (D-190: SUT remains unchanged; tightening z.string() to z.string().min(1) is scope creep)."
metrics:
  duration: ~8 min
  completed: 2026-05-23
  tasks: 3
  files: 3
---

# Phase 11 Plan 03: REFT-03 auth.ts + middleware negative-case coverage Summary

## One-Liner

Added 16 new bun:test cases (6 route + 10 middleware) plus a shared
`assertNoSecretLeak` invariant helper that pins every REFT-03 negative path
(bad body, bad token, expired/tampered/wrong-alg/alg:none/no-uid JWT,
/api/auth short-circuit, /api/events query fallback) returns the documented
4xx status with no access-token or JWT-secret leak in either the response
body or captured console output — zero changes to production code.

## What Was Built

| File | Purpose | Lines | Tests |
|------|---------|-------|-------|
| `hub/src/web/test-utils/assertNoSecretLeak.ts` | Shared no-leak invariant (D-186). Iterates `secrets`, skipping falsy entries, and asserts each is absent from both `responseBody` and every `capturedLogs` line via `expect().not.toContain()`. Imports `expect` from `'bun:test'` only. | 31 | — (helper) |
| `hub/src/web/routes/auth.test.ts` | REFT-03 route layer via `app.route('/api', createAuthRoutes(...))` + `app.request()`. Module-local fixtures (`jwtSecret`, `cliApiToken = 'cli-token-xyz-do-not-leak-marker'`, `ownerId = 42`), `makeApp()`, `captureConsole()`. | 145 | 6 |
| `hub/src/web/middleware/auth.test.ts` | REFT-03 middleware via throwaway `Hono<WebAppEnv>` + `app.use('/api/*', createAuthMiddleware(jwtSecret))` + dummy `/api/auth`, `/api/ping`, `/api/events` handlers. D-187 `make*` factories: `makeValidJwt`, `makeExpiredJwt`, `makeTamperedJwt`, `makeWrongAlgJwt` (HS512), `makeAlgNoneJwt` (hand-built), `makePayloadWithoutUidJwt`. | 265 | 10 |

### Test counts per file

| File | Cases | Outcome |
|------|-------|---------|
| `hub/src/web/routes/auth.test.ts` | 6 | 6 pass, 26 expect() calls |
| `hub/src/web/middleware/auth.test.ts` | 10 | 10 pass, 28 expect() calls |
| **Total new** | **16** | **all green** |

### Test name inventory (middleware)

1. `skips auth for path /api/auth (short-circuit; pins login endpoint behavior)` — pins the early-return at `auth.ts:22–26`.
2. `returns 401 Missing authorization token when no header present on /api/ping`
3. `returns 401 Missing authorization token for Bearer with empty token`
4. `returns 401 Invalid token for tampered signature`
5. `returns 401 Invalid token for expired JWT (replay-after-expiry; D-184)` — no replay-detection.
6. `returns 401 Invalid token for wrong-alg JWT (HS512 vs HS256 allow-list)`
7. `returns 401 Invalid token for forged alg:none`
8. `returns 401 Invalid token payload for valid HS256 JWT with no uid (replaces uid != ownerId case per orchestrator override 2026-05-23)` — replaces the dropped case.
9. `falls back to ?token= query param on /api/events and rejects bad token` — pins `auth.ts:30–31`.
10. `passes valid HS256 JWT with { uid } payload through to next()` — positive control.

### Test name inventory (route)

1. `rejects non-JSON body with 400 Invalid body + no leak`
2. `rejects empty {} body with 400 Invalid body + no leak`
3. `rejects non-string accessToken (number) with 400 Invalid body + no leak`
4. `rejects empty-string accessToken with 401 Invalid access token + no leak (parseAccessToken trims to null)` — orchestrator override.
5. `rejects wrong accessToken with 401 Invalid access token + no leak`
6. `accepts correct accessToken — returns 200 with HS256 JWT decodable to { uid: ownerId }`

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| Route tests green | `cd hub && bun test src/web/routes/auth.test.ts` | ✅ 6 / 6 pass |
| Middleware tests green | `cd hub && bun test src/web/middleware/auth.test.ts` | ✅ 10 / 10 pass |
| Full hub suite (regression check) | `cd hub && bun test` | ✅ 239 / 239 pass across 37 files |
| Typecheck | `cd hub && bun typecheck` | ✅ exit 0 |
| Helper export shape | `bun -e "import('./src/web/test-utils/assertNoSecretLeak.ts')"` | ✅ `assertNoSecretLeak` exported as function |
| No vitest import (TESTING.md anti-pattern) | `grep -E "from\s+'vitest'" hub/src/web/{test-utils/assertNoSecretLeak.ts,routes/auth.test.ts,middleware/auth.test.ts}` | ✅ zero matches |
| Helper imports only from bun:test | `grep -E "from\s+'bun:test'" hub/src/web/test-utils/assertNoSecretLeak.ts` | ✅ exactly one match (`expect`) |
| `assertNoSecretLeak` invocations in route file (acceptance ≥ 5) | `grep -c assertNoSecretLeak hub/src/web/routes/auth.test.ts` | ✅ 6 |
| `assertNoSecretLeak` invocations in middleware file (acceptance ≥ 7) | `grep -c assertNoSecretLeak hub/src/web/middleware/auth.test.ts` | ✅ 9 |
| Dropped case not re-introduced | `grep -Ec "uid\s*!=\s*ownerId\|ownerId\s*!=\s*uid" hub/src/web/middleware/auth.test.ts` | ✅ 0 |
| D-187 make* factories present (acceptance ≥ 6) | `grep -Ec "make(Valid\|Expired\|Tampered\|WrongAlg\|AlgNone\|PayloadWithoutUid)Jwt" hub/src/web/middleware/auth.test.ts` | ✅ 19 |
| D-190 SUT unchanged | `git diff HEAD~3 HEAD -- hub/src/web/routes/auth.ts hub/src/web/middleware/auth.ts hub/src/utils/accessToken.ts hub/src/utils/crypto.ts` | ✅ empty diff (0 lines) |
| Plan files added | `git diff --name-only HEAD~3 HEAD` | ✅ exactly the three planned files |

## Deviations from Plan

None — plan executed exactly as written. The three orchestrator overrides
embedded in the plan (empty-string → 401, wrong-alg variant choice,
no-uid-payload replacing uid != ownerId) were applied as planned.

## Helper location chosen

`hub/src/web/test-utils/assertNoSecretLeak.ts` (per plan + RESEARCH § M3
recommendation). A project-wide `hub/src/test-utils/` directory is deferred
to a later phase per `11-CONTEXT.md § Deferred`. Co-locating the helper
under `hub/src/web/` keeps it adjacent to its only consumers and means
neither `bun test` (`.test.ts` discovery) nor `tsc` discovers any new
top-level concept.

## Wrong-alg construction variant chosen

**HS512 re-sign with the same secret.** Rationale: `jose.SignJWT` happily
signs HS512, and the middleware's `algorithms: ['HS256']` allow-list rejects
HS512 with `JWSAlgNotAllowed` before signature verification, giving the
simplest deterministic path to 401 `{ error: 'Invalid token' }`. The
alternative (HS256 sign + post-hoc header rewrite to `RS256`) requires
re-encoding the protected-header segment and risks accidental signature
re-validation drift if jose's internals change; HS512 re-sign is robust to
that.

## Orchestrator override confirmation

The 2026-05-23 orchestrator override is fully applied:

- **uid != ownerId case dropped.** Middleware does not enforce uid equality
  (only `z.object({ uid: z.number() })` shape via `jwtPayloadSchema`). The
  case is replaced by `makePayloadWithoutUidJwt()` which signs a valid
  HS256 JWT with payload `{ foo: 'bar' }` — signature verifies, zod
  rejects → 401 `{ error: 'Invalid token payload' }`.
- **Empty-string accessToken pinned to 401, not 400.** `parseAccessToken('')`
  trims to `null` and falls through to the constantTimeEquals failure path;
  test asserts 401 `{ error: 'Invalid access token' }` as the actual SUT
  behavior (D-190 forbids tightening to `z.string().min(1)`).
- **No replay-detection added** (D-184); "replayed JWT" == expired-JWT
  resubmitted via `makeExpiredJwt()`.

## Threat Model Coverage (T-11-01 … T-11-08)

| Threat ID | Mitigation | Test |
|-----------|------------|------|
| T-11-01 Spoofing | HS256 allow-list rejects tampered + wrong-alg + alg:none | middleware cases 4, 6, 7 |
| T-11-02 Spoofing/Repudiation | jose `exp` rejects expired | middleware case 5 |
| T-11-03 Tampering | alg:'none' rejection | middleware case 7 |
| T-11-04 Info Disclosure (body) | `assertNoSecretLeak(body, [], [...])` on every 4xx | route + middleware (15 invocations) |
| T-11-05 Info Disclosure (logs) | `captureConsole` → `assertNoSecretLeak(body, cap.logs, [...])` | route + middleware (every failure case) |
| T-11-06 Input validation bypass | 400 Invalid body for non-JSON / {} / non-string accessToken | route cases 1–3 |
| T-11-07 Empty-string accessToken | Pinned to current 401 behavior (not 400) | route case 4 |
| T-11-08 Package legitimacy | No new packages installed; zero `npm/bun add` calls | (n/a) |

## Known Stubs

None — every test wires a real `jose.SignJWT` fixture (or hand-built JWS),
mounts the live SUT (`createAuthRoutes` / `createAuthMiddleware`), and
asserts against actual `app.request()` responses + real `console.*` spies.

## Threat Flags

None — tests-only plan, no new network/auth/file/schema surface introduced;
helper file is internal to `hub/src/web/test-utils/` and not exported from
any package boundary.

## Self-Check: PASSED

- `hub/src/web/test-utils/assertNoSecretLeak.ts` → FOUND
- `hub/src/web/routes/auth.test.ts` → FOUND
- `hub/src/web/middleware/auth.test.ts` → FOUND
- Commit `690a6d8` (Task 1) → FOUND
- Commit `9203950` (Task 2) → FOUND
- Commit `6675a0b` (Task 3) → FOUND
- SUT files diff (HEAD~3..HEAD) → empty (D-190 satisfied)
- Full hub suite → 239 / 239 green
