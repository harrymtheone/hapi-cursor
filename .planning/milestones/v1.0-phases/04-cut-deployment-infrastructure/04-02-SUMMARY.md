---
phase: 04-cut-deployment-infrastructure
plan: 02
subsystem: infra
tags: [hub, config, relay, tailscale]

requires:
  - phase: 04-cut-deployment-infrastructure
    provides: tunnel runtime and hosted relay-web deletion from Plan 04-01
provides:
  - Relay-free hub configuration comments and startup-facing config surface
  - Explicit rejection of legacy relay settings fields via existing old-field validation
  - Regression tests proving legacy relay env vars do not affect returned server settings
affects: [phase-04, cut-deployment-infrastructure, cut-10]

tech-stack:
  added: []
  patterns:
    - existing old settings field rejection
    - env/file/default server settings precedence

key-files:
  created:
    - .planning/phases/04-cut-deployment-infrastructure/04-02-SUMMARY.md
  modified:
    - hub/src/configuration.ts
    - hub/src/config/serverSettings.ts
    - hub/src/config/serverSettings.test.ts

key-decisions:
  - "Kept `HAPI_PUBLIC_URL` as the only public URL env path and removed relay env names from the startup configuration documentation."
  - "Used the existing `OLD_SETTINGS_FIELDS` fail-fast mechanism for legacy relay settings rather than adding compatibility shims or silent ignore behavior."

patterns-established:
  - "Legacy removed settings are rejected centrally in `loadServerSettings()` before env/file/default resolution."
  - "Relay env variables may appear in tests only to prove they have no runtime effect."

requirements-completed: [CUT-10]

duration: 2 min
completed: 2026-05-21
---

# Phase 04 Plan 02: Relay Config and Settings Convergence Summary

**Hub configuration now keeps only the neutral Tailscale public URL path while failing legacy relay settings explicitly.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-21T09:10:23Z
- **Completed:** 2026-05-21T09:13:18Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Removed `HAPI_RELAY_API`, `HAPI_RELAY_AUTH`, and `HAPI_RELAY_FORCE_TCP` from the hub configuration documentation surface in `hub/src/configuration.ts`.
- Added legacy relay settings names to the existing old-field rejection mechanism in `hub/src/config/serverSettings.ts`, so represented stale settings fail fast instead of being migrated or silently accepted.
- Added regression coverage in `hub/src/config/serverSettings.test.ts` for old relay settings rejection and for `HAPI_RELAY_*` env vars having no effect on the returned settings while `HAPI_PUBLIC_URL` remains env-sourced.

## Task Commits

Each task was committed atomically:

1. **Task 04-02-01: Remove relay env and settings fields while preserving HAPI_PUBLIC_URL** - `5bb7f04` (feat)
2. **Task 04-02-02: Add explicit rejection tests for legacy relay settings if represented** - `7b2f05c` (test)

## Files Created/Modified

- `hub/src/configuration.ts` - Removed relay env names from the startup configuration comment.
- `hub/src/config/serverSettings.ts` - Extended old settings rejection with legacy relay settings keys while preserving `HAPI_PUBLIC_URL` precedence and source reporting.
- `hub/src/config/serverSettings.test.ts` - Added relay-settings rejection and relay-env no-effect regression tests.
- `.planning/phases/04-cut-deployment-infrastructure/04-02-SUMMARY.md` - Execution summary and verification record.

## Decisions Made

- Preserved `HAPI_PUBLIC_URL` as the only public URL configuration path for user-managed Tailscale.
- Reused the existing settings fail-fast path for legacy relay fields instead of adding a migration shim, passthrough mode, or disabled relay state.

## GitNexus Impact Notes

- Pre-edit impact analysis reported LOW risk for `loadServerSettings`, `rejectOldSettingsFields`, and `createConfiguration`.
- Pre-edit impact analysis reported MEDIUM risk for the shared `Settings` interface, but the interface shape was not changed.
- GitNexus change detection for the plan diff reported LOW risk with no affected execution processes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `bun run test` continued to emit existing jsdom "Not implemented: navigation" console noise in web tests while exiting 0.
- Source/stub scan matched existing nullable lifecycle/test variables (`dir: string | null`, parsed settings null checks, and empty normalized CORS arrays). These are not UI/data stubs and were not introduced as incomplete behavior.

## Verification

- `cd hub && bun test src/config/serverSettings.test.ts` passed with 3 tests.
- `bun typecheck && bun run test` passed after Task 04-02-01.
- `bun typecheck && bun run test` passed after Task 04-02-02 and final plan verification.
- Source sweep confirmed `hub/src/configuration.ts` and `hub/src/config/settings.ts` contain no relay env/settings terms.
- Source sweep confirmed `hub/src/config/serverSettings.ts` still reads `HAPI_PUBLIC_URL` and records `sources.publicUrl = 'env'`.
- `hub/src/config/serverSettings.ts` intentionally contains legacy relay field names only in `OLD_SETTINGS_FIELDS` so stale settings fail explicitly.

## Known Stubs

None.

## Threat Flags

None - this plan removed/blocked stale relay configuration surfaces without adding new endpoints, auth paths, file access patterns, or schemas.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 04-03 to remove the remote logging and doctor surfaces for CUT-11. Remaining CUT-10 work still includes build/runtime tunwg asset cleanup and final guard verification in Plan 04-04.

## Self-Check: PASSED

- Summary file created at `.planning/phases/04-cut-deployment-infrastructure/04-02-SUMMARY.md`.
- Task commit `5bb7f04` exists.
- Task commit `7b2f05c` exists.
- No tracked files were deleted by either task commit.

---
*Phase: 04-cut-deployment-infrastructure*
*Completed: 2026-05-21*
