# Phase 4: Cut deployment infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 4-Cut deployment infrastructure
**Areas discussed:** Tunnel deletion boundary, Config/settings convergence, Remote log upload, Build/release pipeline, Verification whitelist

---

## Tunnel Deletion Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Keep neutral public URL | Delete relay/tunwg/TLS gate but keep `HAPI_PUBLIC_URL` / local URL output for Tailscale. | ✓ |
| Delete all URL output | Remove hub startup access URL / QR output entirely. | |
| Physical deletion | Delete `hub/src/tunnel/`, `hub/tools/tunwg/`, `hub/scripts/download-tunwg.ts`, `web/src/lib/relay-mode*`; no stubs. | ✓ |
| Keep stubs | Delete implementation but keep feature flags or empty shells. | |
| Remove QR | Delete tunnel QR rendering and `qrcode`; print URLs as text. | ✓ |
| Keep public QR | Keep QR for `HAPI_PUBLIC_URL`. | |
| Delete relay Web | Remove relay-mode Web path and hosted relay entry. | ✓ |
| Keep hosted Web | Keep external hosted Web entry compatibility. | |

**User's choice:** Keep neutral public URL, physical deletion, remove QR, delete relay Web.
**Notes:** Tailscale URL path remains; relay/tunwg/TLS and hosted relay semantics do not.

---

## Config/Settings Convergence

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit failure | Delete relay fields from config/schema; old settings with relay fields fail validation. | ✓ |
| Silent ignore | Keep compatibility by ignoring old fields. | |
| Keep public/drop official | Keep `HAPI_PUBLIC_URL`; delete/stop using relay-hosted `HAPI_OFFICIAL_WEB_URL` semantics. | ✓ |
| Keep both neutral | Keep both config keys as neutral external URL settings. | |
| Remove all surfaces | Remove relay config reads/defaults/source reporting/banner surfaces. | ✓ |
| Disabled line | Keep a startup line saying relay is disabled/removed. | |
| Update current tests | Update tests/schema related to relay fields in this phase. | ✓ |
| Defer tests | Leave tests/schema cleanup to Phase 10. | |

**User's choice:** Explicit failure, keep public/drop official, remove all surfaces, update current tests.
**Notes:** No compatibility shim; Phase 10 remains responsible for broader config cleanup.

---

## Remote Log Upload

| Option | Description | Selected |
|--------|-------------|----------|
| Delete upload, keep local | Remove dangerous env flag and `HAPI_API_URL` upload path; keep local file/console logger. | ✓ |
| Disabled code | Keep upload code but make it unreachable/default-off. | |
| Remove remote doctor mention | Delete remote log toggle/help from doctor; keep local diagnostics. | ✓ |
| Removed-feature note | Keep a doctor line saying remote logs were removed. | |
| Only log-owned uses | Delete only remote-log/relay/debug uses of `HAPI_API_URL`; avoid unrelated string-match deletion. | ✓ |
| Delete all `HAPI_API_URL` | Remove every hit. | |
| Local-only diagnostics | No new export/upload; use `~/.hapi/logs`, doctor, manual sharing. | ✓ |
| Export command | Add a logs export command. | |

**User's choice:** Delete upload, remove remote doctor mention, only log-owned uses, local-only diagnostics.
**Notes:** No replacement feature is added.

---

## Build/Release Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Remove download step | Remove `download-tunwg` from scripts/package scripts. | ✓ |
| No-op script | Keep the script as a no-op. | |
| Remove tunwg only | Remove tunwg asset/extraction/path logic; keep rg/difftastic runtime assets. | ✓ |
| Simplify all runtime assets | Refactor runtime asset extraction broadly. | |
| Delete tunwg release surface | Remove tunwg release/CI/cache/checksum/platform asset references. | ✓ |
| Defer release/CI | Only change local build script. | |
| single-exe required | `bun run build:single-exe` must pass with no tunwg download/extraction/network dependency. | ✓ |
| typecheck/test only | Leave single-exe to Phase 12. | |

**User's choice:** Remove download step, remove tunwg only, delete tunwg release surface, single-exe required.
**Notes:** Do not disturb non-tunwg tool packaging.

---

## Verification Whitelist

| Option | Description | Selected |
|--------|-------------|----------|
| Roadmap plus relay-mode | Hard-check roadmap keywords and sweep `relay-mode` / hosted-web symbols. | ✓ |
| Roadmap only | Only check `tunwg`, `HAPI_RELAY_`, dangerous remote log flag. | |
| Planning/CHANGELOG only | Default whitelist limited to `.planning/codebase/` and `CHANGELOG.md`. | ✓ |
| Docs whitelist | Also whitelist `docs/` / `website/`. | |
| Source comments now | Clean source comments/JSDoc now; long-form docs later. | ✓ |
| All docs now | Clean all docs/website now. | |
| Four commits | Prefer tunnel/web relay, config, remote logging, build+guard slices. | ✓ |
| Two commits | Merge into two larger slices. | |

**User's choice:** Roadmap plus relay-mode, planning/CHANGELOG only, source comments now/docs later, four commits.
**Notes:** Extra whitelist entries must be justified in PLAN.

---

## Claude's Discretion

- Planner may adjust file ordering, names, and exact test placement by dependency graph.
- Ambiguous release/CI hits should be judged by whether they download, package, checksum, or reference tunwg.

## Deferred Ideas

- General config cleanup remains Phase 10.
- Long-form docs/website cleanup remains Phase 12.
- Alternative tunnel providers or logs export are out of scope.
