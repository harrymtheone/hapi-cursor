---
phase: 04-cut-deployment-infrastructure
plan: 01
subsystem: infra
tags: [hub, web, tunnel, relay, tailscale]

requires:
  - phase: 03-cut-multi-user-namespace-isolation
    provides: owner-only hub/session/runtime contracts
provides:
  - Hub startup without built-in tunnel lifecycle, TLS gate, relay CLI args, relay env reads, or token-bearing QR/direct URL output
  - Hub web server that always serves embedded/static local PWA assets instead of a hosted relay entry
  - Deleted `hub/src/tunnel/` runtime source
affects: [phase-04, cut-deployment-infrastructure, cut-10]

tech-stack:
  added: []
  patterns:
    - deletion-first runtime cleanup
    - neutral HAPI_PUBLIC_URL startup output

key-files:
  created:
    - .planning/phases/04-cut-deployment-infrastructure/04-01-SUMMARY.md
  modified:
    - hub/src/index.ts
    - hub/src/web/server.ts
    - hub/src/tunnel/index.ts
    - hub/src/tunnel/tunnelManager.ts
    - hub/src/tunnel/tlsGate.ts

key-decisions:
  - "Deleted the built-in relay/tunnel runtime outright instead of preserving disabled flags, compatibility errors, or no-op stubs."
  - "Kept `HAPI_PUBLIC_URL` and local URL startup text as the neutral Tailscale access path."
  - "Removed hosted relay web serving so the hub always serves its local embedded/static PWA."

patterns-established:
  - "Relay deletion keeps normal hub startup order intact: config, store, push, sockets, sync, web server, ready output."
  - "Web server options now describe only local serving dependencies; hosted relay options are not part of the contract."

requirements-completed: [CUT-10]

duration: 2 min
completed: 2026-05-21
---

# Phase 04 Plan 01: Tunnel and Hosted Relay-Web Runtime Deletion Summary

**Hub runtime relay startup and hosted relay web entry removed while preserving local and `HAPI_PUBLIC_URL` access for Tailscale users.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-21T09:05:47Z
- **Completed:** 2026-05-21T09:07:55Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Removed the built-in tunnel lifecycle from `hub/src/index.ts`: no `TunnelManager`, TLS readiness polling, relay CLI flags, relay env reads, relay CORS merge, token-bearing direct URL, QR output, or tunnel shutdown path remains.
- Deleted `hub/src/tunnel/` source files outright.
- Removed `relayMode` and `officialWebUrl` from `hub/src/web/server.ts`, including the hosted `app.hapi.run` root response, while preserving embedded asset and `web/dist` fallback serving.
- Preserved local and public URL startup output through `config.listenPort` and `config.publicUrl`.

## Task Commits

Each task was committed atomically:

1. **Task 04-01-01: Delete hub tunnel startup and QR runtime path** - `d875160` (feat)
2. **Task 04-01-02: Remove hosted relay web server branch and web relay helpers** - `6971bc8` (feat)

## Files Created/Modified

- `hub/src/index.ts` - Removed relay/tunnel startup behavior and kept neutral local/public URL output.
- `hub/src/web/server.ts` - Removed hosted relay web branch and relay-specific server options.
- `hub/src/tunnel/index.ts` - Deleted tunnel barrel export.
- `hub/src/tunnel/tunnelManager.ts` - Deleted tunwg subprocess lifecycle manager.
- `hub/src/tunnel/tlsGate.ts` - Deleted tunnel TLS readiness gate.
- `.planning/phases/04-cut-deployment-infrastructure/04-01-SUMMARY.md` - Execution summary and verification record.

## Decisions Made

- Deleted relay runtime paths without compatibility shims, matching D-49 and the repo's no-backward-compatibility rule.
- Preserved `HAPI_PUBLIC_URL` as the user-managed Tailscale URL output, matching D-50.
- Kept web serving local/embedded-only rather than redirecting users to an official hosted relay web app, matching D-52.

## GitNexus Impact Notes

- Pre-edit impact analysis reported LOW risk for `main`, `startWebServer`, `createWebApp`, `TunnelManager`, `waitForTunnelTlsReady`, `resolveRelayFlag`, and `mergeCorsOrigins`.
- Direct blast radius was limited to `hub/src/index.ts`, `hub/src/web/server.ts`, and the deleted tunnel directory, with indexed affected flow `main`.
- Staged detect for Task 1 reported HIGH because `main` participates in ten indexed startup/config flows; the change intentionally removed only relay/tunnel branches and was verified with typecheck, tests, and source sweeps.
- Staged detect for Task 2 reported LOW risk with `createWebApp` as the only changed symbol and no affected processes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Stub scan matched existing nullable process-wide service handles in `hub/src/index.ts` (`SyncEngine | null`, `BunServer | null`, etc.). These are lifecycle handles, not UI/data stubs, and were not introduced by this plan.
- `bun run test` emitted existing jsdom navigation "Not implemented" console noise in web tests while still exiting 0.

## Verification

- `test ! -d hub/src/tunnel` passed.
- `hub/src/index.ts` has no `TunnelManager`, `waitForTunnelTlsReady`, `resolveRelayFlag`, `HAPI_RELAY_`, `HAPI_OFFICIAL_WEB_URL`, `QRCode`, `directAccessUrl`, `--relay`, or `--no-relay` runtime source references.
- `hub/src/index.ts` still prints URL text through `config.listenPort` and `config.publicUrl`.
- `hub/src/web/server.ts` has no `relayMode`, `officialWebUrl`, `app.hapi.run`, hosted-web relay HTML, or early relay return branch.
- `web/src/lib/relay-mode*` is absent.
- `hub/src/web/server.ts` still references embedded assets and `web/dist` fallback serving.
- `bun typecheck && bun run test` passed after Task 1 and after Task 2.
- Final source sweep found no plan-level runtime references to `TunnelManager`, `waitForTunnelTlsReady`, `relayMode`, `officialWebUrl`, `app.hapi.run`, `--relay`, or `--no-relay` in `hub/src/index.ts`, `hub/src/web/server.ts`, or `web/src/lib`.

## Known Stubs

None.

## Threat Flags

None - this plan removed external network relay and token-bearing URL surfaces without adding new endpoints, auth paths, file access patterns, or schemas.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 04-02 to remove relay config/settings/env surfaces. Remaining CUT-10 work still includes relay config convergence and build/runtime tunwg asset cleanup in later Phase 04 plans.

## Self-Check: PASSED

- Summary file created at `.planning/phases/04-cut-deployment-infrastructure/04-01-SUMMARY.md`.
- Task commit `d875160` exists.
- Task commit `6971bc8` exists.
- Deleted files were intentional and documented: `hub/src/tunnel/index.ts`, `hub/src/tunnel/tlsGate.ts`, `hub/src/tunnel/tunnelManager.ts`.

---
*Phase: 04-cut-deployment-infrastructure*
*Completed: 2026-05-21*
