---
phase: 08-hub-internal-decoupling
plan: 03
subsystem: hub-web-routes
tags: [refactor, hub, web-api, middleware, error-handling]
requires:
  - 08-01 (SessionCache decomposition; resolveSessionAccess shape unchanged)
provides:
  - hub/src/web/middleware/apiRouteError.ts (ApiRouteError + registerApiErrorHandler)
  - hub/src/web/middleware/route-helpers.ts (withEngine, withSession, withActiveSession, withMachine, parseJsonBody)
  - hub/src/web/routes/sessions/{index,lifecycle,config,upload,read}.ts
affects:
  - hub/src/web/server.ts (registerApiErrorHandler before app.route)
  - hub/src/web/middleware/auth.ts (WebAppEnv['Variables'] extended)
tech-stack:
  added:
    - hono/http-exception (already in node_modules)
  patterns:
    - Hono middleware DI via c.set(...) / c.get(...) instead of Response-union guards
    - Centralized error handler via app.onError pinning {error:{code,message,details?}} shape
    - app.route('/path', subApp) sub-router composition for the sessions router
key-files:
  created:
    - hub/src/web/middleware/apiRouteError.ts
    - hub/src/web/middleware/apiRouteError.test.ts
    - hub/src/web/middleware/route-helpers.ts
    - hub/src/web/routes/sessions/index.ts
    - hub/src/web/routes/sessions/lifecycle.ts
    - hub/src/web/routes/sessions/config.ts
    - hub/src/web/routes/sessions/upload.ts
    - hub/src/web/routes/sessions/read.ts
    - hub/src/web/routes/sessions/__tests__/_fixtures.ts
    - hub/src/web/routes/sessions/__tests__/lifecycle.test.ts
    - hub/src/web/routes/sessions/__tests__/config.test.ts
    - hub/src/web/routes/sessions/__tests__/upload.test.ts
    - hub/src/web/routes/sessions/__tests__/read.test.ts
  modified:
    - hub/src/web/middleware/auth.ts
    - hub/src/web/server.ts
  deleted:
    - hub/src/web/routes/sessions.ts
    - hub/src/web/routes/sessions.test.ts
decisions:
  - "Resume body remains parsed inline (not via parseJsonBody middleware) to preserve 'empty body == no permissionMode override' semantics from the legacy handler"
  - "Old guards.ts (requireSyncEngine/requireSession/requireSessionFromParam/requireMachine) is intentionally retained — still used by messages.ts/machines.ts/permissions.ts (Pitfall 5; D-144)"
metrics:
  duration: "≈30 min"
  completed: "2026-05-23"
  tasks: 3
  files_changed: 17
---

# Phase 08 Plan 03: Sessions Route Decomposition + Unified Error Handling Summary

One-liner: Split the 467-line, 14-handler `routes/sessions.ts` into 4 responsibility-keyed sub-files behind an unchanged `createSessionsRoutes(getSyncEngine)` facade, swap hand-rolled `c.json({error},status)` for `ApiRouteError extends HTTPException` + a global `app.onError` that pins `{ error: { code, message, details? } }`, and route DI through new Hono middleware (`withEngine` / `withSession` / `withActiveSession` / `withMachine` / `parseJsonBody`).

## What was built

**Task 1 — Middleware foundation** (`629c9b7`):
- `apiRouteError.ts` exports `class ApiRouteError extends HTTPException` (adds `readonly code: string`, optional `details: unknown`) and `registerApiErrorHandler(app)` that emits the unified JSON shape. Non-`ApiRouteError` `HTTPException`s fall through to `err.getResponse()`; anything else returns 500 `internal-error` and logs the underlying error to stderr (no stack leak in the response).
- `route-helpers.ts` exports 5 middleware factories (`withEngine`, `withSession`, `withActiveSession`, `withMachine`, `parseJsonBody`) that `c.set(...)` shared values and `throw new ApiRouteError(...)` on the unhappy paths. Each helper failure path maps to a specific status + kebab-case code (`engine-unavailable` 503, `not-found` 404, `session-not-active` 409, `invalid-body` 400 with Zod issues in `details`).
- `WebAppEnv['Variables']` extended with `engine: SyncEngine`, `session: Session`, `machine: Machine`, `body: unknown`.
- `createWebApp` calls `registerApiErrorHandler(app)` immediately after `new Hono<WebAppEnv>()` and BEFORE any `app.route(...)` (Pitfall 6).

**Task 2 — Route split** (`2999550`):
- `routes/sessions/index.ts` (18 LOC) — composes 4 sub-apps via `app.route('/', subApp)`. External signature `createSessionsRoutes(getSyncEngine)` unchanged; `server.ts:90` untouched.
- `routes/sessions/lifecycle.ts` (108 LOC) — handlers 3, 6, 7, 8, 11, 12: resume, abort, archive, switch, PATCH /:id, DELETE /:id. `abort`/`archive`/`switch` use `withActiveSession`; `PATCH`/`DELETE` use `withSession`; DELETE keeps the original 409-on-active behavior via `ApiRouteError(409, 'session-active')`.
- `routes/sessions/config.ts` (74 LOC) — handlers 9 (`permission-mode`, withSession) and 10 (`model`, withActiveSession).
- `routes/sessions/upload.ts` (79 LOC) — handlers 4 (`/upload`) and 5 (`/upload/delete`) both `withActiveSession` + `parseJsonBody`. The 50 MB cap is preserved as a business-rule check after schema parsing, throwing `ApiRouteError(413, 'payload-too-large')`. Routes registered with the more specific `/upload/delete` first so Hono's trie does not shadow it.
- `routes/sessions/read.ts` (117 LOC) — handlers 1 (`GET /sessions`), 2 (`GET /:id`), 13 (`/slash-commands`), 14 (`/skills`). Slash-commands keeps its metadata-fallback merge semantics inline (heavy logic, not easily helper-able per RESEARCH §"Sub-file budget projections").
- Legacy `routes/sessions.ts` deleted.

**Task 3 — Test redistribution + error contract** (`0eebead`):
- Shared `_fixtures.ts` exports `createSession()` (legacy `namespace` field via reflection workaround retained) and `createApp(session, overrides)` that registers the global error handler so redistributed cases see the unified JSON body.
- 4 per-sub-file test files moved the original 5 cases and added regression coverage (abort-on-inactive 409, 50 MB upload cap 413 payload-too-large, unknown-session 404 not-found, etc.).
- New `apiRouteError.test.ts` pins the JSON shape with 6 cases: zod-fail invalid-body (details = issues array), JSON-parse-fail invalid-body, engine-unavailable 503, not-found 404, plain `Error` → 500 internal-error with `details` absent (no stack leak), and `ApiRouteError` without details omits the `details` key entirely.
- Legacy `routes/sessions.test.ts` deleted.

## Deviations from Plan

None — plan executed exactly as written.

Minor planner-discretion choices (allowed by the plan):
- Resume body parsing kept inline (not via `parseJsonBody`) to preserve the legacy "missing/empty body defaults to `{}`" behavior; `parseJsonBody` would reject an empty body as invalid JSON.
- `_fixtures.ts` extracted at first cut because all 4 redistributed test files would have duplicated the ~80-line `createApp` factory.

## Verification

- `bun typecheck` exits 0 (cli + web + hub).
- `bun run test` exits 0 across the workspace (hub 209 pass / 0 fail, up from 189; web 541 pass / 0 fail).
- `madge --circular hub/src` clean.
- `wc -l hub/src/web/routes/sessions/*.ts` → 18 + 108 + 74 + 79 + 117 = 396 (every file < 250 LOC; SC#1).
- `rg "from .*middleware/route-helpers" hub/src/web/routes/sessions/` → 4 (lifecycle, config, upload, read).
- `rg "return c\\.json\\(\\s*\\{\\s*error" hub/src/web/routes/sessions/` → 0 (no hand-rolled error JSON).
- `rg "throw new ApiRouteError\\(" hub/src/web/routes/sessions/` → 14 invocations across 4 sub-files.
- `rg "registerApiErrorHandler\\(" hub/src/web/server.ts` → 1, registered before any `app.route(...)`.

## Commits

| Task | Hash    | Title                                                                         |
| ---- | ------- | ----------------------------------------------------------------------------- |
| 1    | 629c9b7 | feat(08-03): add ApiRouteError + route-helpers middleware; register onError   |
| 2    | 2999550 | refactor(08-03): split sessions.ts into routes/sessions/{lifecycle,...}.ts    |
| 3    | 0eebead | test(08-03): redistribute sessions tests + pin ApiRouteError JSON shape       |

## Self-Check: PASSED

All claimed files exist; all claimed commits present in `git log`.
