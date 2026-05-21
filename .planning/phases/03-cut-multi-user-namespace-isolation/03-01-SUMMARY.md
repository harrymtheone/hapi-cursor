---
phase: 03-cut-multi-user-namespace-isolation
plan: 01
subsystem: auth
tags: [cli-api-token, bearer-auth, hono, socket-io, bun-test]

requires:
  - phase: 02-cut-external-integration-channels
    provides: access-token-only auth surface after Telegram removal
provides:
  - Opaque CLI access-token parser that preserves colon-bearing secrets
  - CLI token config validation that accepts colon-bearing `CLI_API_TOKEN` values
  - `/api/cli/*` bearer auth comparing whole opaque tokens without token-derived route namespace state
affects: [03-02-store-cache-facades, 03-03-web-auth-routes, 03-04-socket-contract]

tech-stack:
  added: []
  patterns: [whole-token-constant-time-compare, transitional-legacy-namespace-for-unmigrated-consumers]

key-files:
  created:
    - .planning/phases/03-cut-multi-user-namespace-isolation/03-01-SUMMARY.md
  modified:
    - hub/src/utils/accessToken.ts
    - hub/src/utils/accessToken.test.ts
    - hub/src/config/cliApiToken.ts
    - hub/src/config/cliApiToken.test.ts
    - hub/src/web/routes/cli.ts
    - hub/src/web/routes/cli.test.ts
    - hub/src/web/routes/auth.ts
    - hub/src/socket/server.ts

key-decisions:
  - "Treat every parsed CLI access token as one trimmed opaque string; colons are data, not namespace separators."
  - "Keep temporary `default` namespace constants only at unmigrated JWT/socket/store callsites so Plan 03-03/03-04 can cut those contracts atomically."

patterns-established:
  - "Opaque token auth: `parseAccessToken()` returns `string | null`, and callers pass that string directly to `constantTimeEquals()`."
  - "Deferred namespace consumers use explicit local transitional constants instead of deriving authority from token suffixes."

requirements-completed: [CUT-09]

duration: 3min 20s
completed: 2026-05-21
---

# Phase 03 Plan 01: Opaque CLI Token Handling Summary

**Colon-bearing CLI access tokens now compare as whole opaque secrets across parser, config, CLI bearer routes, and related auth entry points.**

## Performance

- **Duration:** 3min 20s
- **Started:** 2026-05-21T03:56:30Z
- **Completed:** 2026-05-21T03:59:50Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Replaced `parseAccessToken()` suffix parsing with a trim-and-return opaque token parser.
- Removed config-layer colon rejection while preserving generated tokens, settings persistence, and weak-token warnings.
- Updated `/api/cli/*` bearer auth to compare whole tokens directly and stop writing namespace route state from token suffixes.
- Added focused coverage for colon-bearing env/file tokens and CLI bearer tokens.

## Task Commits

Each task was committed atomically where the dependency graph allowed:

1. **Task 03-01-01 RED: Specify opaque CLI token behavior** - `1c6e4db` (test)
2. **Tasks 03-01-01/03-01-02 GREEN: Opaque token implementation and CLI bearer auth** - `688887f` (feat)

_Note: The parser return-type cut made the route/socket/auth callsites compile together; keeping the implementation in one green commit preserved D-47 after the plan commit._

## Files Created/Modified

- `hub/src/utils/accessToken.ts` - `parseAccessToken()` now returns the whole trimmed token or `null`.
- `hub/src/utils/accessToken.test.ts` - covers opaque colon-bearing tokens, empty prefixes/suffixes, and empty-token rejection.
- `hub/src/config/cliApiToken.ts` - no longer rejects `CLI_API_TOKEN` values containing `:`.
- `hub/src/config/cliApiToken.test.ts` - covers colon-bearing env and settings-file tokens.
- `hub/src/web/routes/cli.ts` - compares whole bearer tokens and removes token-derived `c.set('namespace')`.
- `hub/src/web/routes/cli.test.ts` - covers colon-bearing bearer auth and no token-derived route namespace state.
- `hub/src/web/routes/auth.ts` - compares whole parsed tokens to keep the parser contract typecheckable before Plan 03-03.
- `hub/src/socket/server.ts` - compares whole parsed CLI socket tokens to keep the parser contract typecheckable before Plan 03-04.

## Decisions Made

- Followed D-34/D-37 for the parser/config layer: no `DEFAULT_NAMESPACE`, `ParsedAccessToken`, `baseToken`, suffix split, or `lastIndexOf()` parsing remains in `hub/src/utils` or `hub/src/config`.
- Deferred JWT payload narrowing and SocketData deletion as planned. Their callsites now use explicit transitional `default` constants only because the downstream namespace-consuming contracts are owned by Plans 03-03 and 03-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated non-CLI parser callsites for the new string contract**
- **Found during:** Task 03-01-01/03-01-02 verification
- **Issue:** `hub/src/web/routes/auth.ts` and `hub/src/socket/server.ts` still referenced `parsedToken.baseToken` / `parsedToken.namespace`, so `bun typecheck` failed after `parseAccessToken()` became `string | null`.
- **Fix:** Compared the whole parsed token in those auth entry points and used explicit transitional `default` namespace constants for the deferred JWT/socket data contracts.
- **Files modified:** `hub/src/web/routes/auth.ts`, `hub/src/socket/server.ts`
- **Verification:** `bun typecheck && bun run test`
- **Committed in:** `688887f`

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking)
**Impact on plan:** Kept the repo green without narrowing WebAppEnv or deleting SocketData ahead of their planned atomic slices.

## Verification

- `bun test hub/src/utils/accessToken.test.ts hub/src/config/cliApiToken.test.ts hub/src/web/routes/cli.test.ts` - exit 0
- Focused source gate: `DEFAULT_NAMESPACE|ParsedAccessToken|baseToken|lastIndexOf` absent from `hub/src/utils` and `hub/src/config`
- Focused CLI route gate: `parsedToken.(namespace|baseToken)` and `c.set('namespace')` absent from `hub/src/web/routes/cli.ts`
- `bun typecheck && bun run test` - exit 0 after commit `688887f`

## Known Stubs

None. Stub-pattern scan produced only false positives in tests and existing null checks.

## Issues Encountered

- The repository shell PATH does not expose `rg`; focused source gates used the installed Cursor ripgrep binary at `/usr/share/cursor/resources/app/node_modules/@vscode/ripgrep/bin/rg`.
- `scripts/check-no-cut-agents.sh` prints `rg: command not found` in the current shell but still exits 0. This is pre-existing environment/tooling behavior; Phase 03 Plan 07 owns the final namespace guard.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-02 can add namespace-free store/cache/SyncEngine facades against a parser/config/auth surface that already treats `CLI_API_TOKEN` as opaque.

## Self-Check: PASSED

- Found summary file: `.planning/phases/03-cut-multi-user-namespace-isolation/03-01-SUMMARY.md`
- Found commit: `1c6e4db`
- Found commit: `688887f`

---
*Phase: 03-cut-multi-user-namespace-isolation*
*Completed: 2026-05-21*
