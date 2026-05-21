---
phase: 04-cut-deployment-infrastructure
reviewed: 2026-05-21T09:46:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - cli/src/runtime/assets.ts
  - cli/src/runtime/embeddedAssets.bun.ts
  - cli/src/types/assetImports.d.ts
  - cli/src/ui/doctor.test.ts
  - cli/src/ui/doctor.ts
  - cli/src/ui/logger.test.ts
  - cli/src/ui/logger.ts
  - docs/guide/installation.md
  - docs/guide/quick-start.md
  - docs/guide/voice-assistant.md
  - docs/guide/why-hapi.md
  - hub/README.md
  - hub/package.json
  - hub/src/config/serverSettings.test.ts
  - hub/src/config/serverSettings.ts
  - hub/src/configuration.ts
  - hub/src/index.ts
  - hub/src/web/server.ts
  - scripts/check-no-cut-agents.sh
  - website/src/pages/Home.tsx
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-21T09:46:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the Phase 04 runtime asset, hub configuration, web serving, logging, docs, package, and residue-guard changes. The runtime asset and remote-log removal paths are mostly coherent, but the Phase 04 guard is currently not merge-ready because it will still match an existing workflow state file. The user-facing docs also retain relay-era architecture language after the relay/tunnel removal.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Phase 04 residue guard still fails on current repository state

**File:** `scripts/check-no-cut-agents.sh:134-167`

**Issue:** The Phase 04 hard-pattern scan runs from the repository root and excludes only `.planning/codebase/**`, selected source-of-truth planning files, the Phase 04 phase directory, `CHANGELOG.md`, and the guard itself. It does not exclude or scrub `.planning/STATE.md`, which currently contains `tunwg` in the Phase 04 progress entry. As written, `bash scripts/check-no-cut-agents.sh` will report `tunwg` from `.planning/STATE.md` and fail `test:guard`, even though the runtime source was removed.

**Fix:**

Either remove/reword the forbidden term from `.planning/STATE.md`, or add a narrow, documented exclusion if workflow state is allowed to retain historical phase summaries:

```bash
PHASE4_WHITELIST=(
  # ...
  --glob '!.planning/STATE.md'
  # ...
)
```

## Warnings

### WR-01: Installation guide still implies a removed public relay path exists

**File:** `docs/guide/installation.md:241-244`

**Issue:** The self-hosted remote access section says, "If you prefer not to use the public relay..." after Phase 04 removes the bundled/public relay infrastructure. This is now misleading user guidance: users may look for a relay mode that no longer exists.

**Fix:** Rename the section around self-managed network paths and remove the public-relay comparison, for example: "For phone access, expose the local hub through a network path you control, such as Tailscale, Cloudflare Tunnel, or your own reverse proxy."

### WR-02: Why-HAPI architecture comparison still describes relay-backed encryption

**File:** `docs/guide/why-hapi.md:5-15`

**Issue:** The page still says the relay server forwards encrypted traffic and lists "WireGuard + TLS via relay" as HAPI's encryption model. That contradicts the Phase 04 deployment cut, where the relay/tunnel/TLS gate was removed and the supported path is user-managed private networking or HTTPS.

**Fix:** Reframe the HAPI side as local hub plus user-managed private network/HTTPS, and remove relay/WireGuard language from the comparison table and opening explanation.

---

_Reviewed: 2026-05-21T09:46:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
