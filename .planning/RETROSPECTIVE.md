# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Refactor & Slim-Down

**Shipped:** 2026-05-23
**Phases:** 12 | **Plans:** 60 | **Commits:** 318
**Stats:** 917 files / +60,520 / −72,559 (≈ −12k LOC net) over 4 calendar days

### What Was Built

- Cursor-only fork: 4 agent runtimes (Claude / Codex / Gemini+ACP / OpenCode) + 3 integration surfaces (Telegram / voice / ServerChan) deleted; `cli/src/agent/backends/` and `@anthropic-ai/*` / `grammy` / `@elevenlabs/react` deps gone
- Single-user shape: namespace token suffix, JWT `ns` field, `users.platform` column, built-in `tunwg` tunnel, TLS gate, remote log upload stream all removed
- Reusable abstractions for v1.1: populated `FLAVOR_CAPS` table; shared agent runtime kit (`SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy`); `shared/` as single wire-contract source with strict `SessionPatchSchema` / `MachinePatchSchema`; frozen `loadConfig()` + DI replacing mutable singletons
- Internal decoupling: `SessionCache` 796 LOC → 4 services; `SyncEngine` 854 LOC → 4 sub-facades; `KeepaliveScheduler` with SIGINT-tested teardown; web giants (`SessionList` 953→229, `message-window-store` 1088→28 facade, `settings/index` 758→47, `HappyComposer` 669→178, `_results` 687→175 dispatcher)
- 0 circular dependencies across `cli/` + `hub/` + `web/`, enforced by `madge:check` in push-gated `.github/workflows/verify.yml`
- Test coverage closure: Cursor permission matrix (type-exhaustive + per-row deep-equal), SSE reconnect convergence test, 16 auth route/middleware negative cases with `assertNoSecretLeak`
- Doc surface rewrite: 5 READMEs + `AGENTS.md` rewritten from zero as Cursor-only Tailscale quickstart (364 lines); `website/` + `docs/` deleted; repo-wide ripgrep guard `scripts/check-no-cut-agents.sh` durable

### What Worked

- **"Big deletions first"** ordering paid off — Phases 1–4 cut ~half the surface area before any refactor touched it; downstream phases consistently took less work than estimated
- **Sequential phases, no parallelism** (`parallelization: false`) — kept the merge story trivial and let later phases learn from earlier-phase REVIEW/VERIFICATION findings
- **Push-gated CI from Phase 12-03 onward** caught path regressions immediately; the `madge:check` + ripgrep guard pair (one structural, one literal) is a strong invariant pairing
- **Phase-local guard scripts** (`scripts/check-no-cut-agents.sh` D-N blocks appended per phase, plus per-package `check-no-circular-{hub,web}.sh`) gave each phase a "close the door behind you" gate — no regressions slipped between phases
- **Decision logs (`D-NNN`) in DISCUSSION-LOG and SUMMARY frontmatter** — `Rule 3` deviations (in-scope but unplanned fixes) were absorbed cleanly without breaking the plan/execute contract
- **Yolo mode + verifier + nyquist validation** combo — auto-advance kept velocity high while verifier caught HIGH-severity gaps (e.g., Phase 2 verification-closure plan 02-06 found and fixed fetchVoiceToken, /api/bind auth bypass, web languages.ts)

### What Was Inefficient

- **Stale checkboxes in `REQUIREMENTS.md`** — at milestone close, CUT-01..05 and REFA-01 were still `[ ]` in the live file even though the work shipped weeks earlier; traceability table had stale "Pending" rows. `/gsd-transition` between phases should have been more rigorous about marking off requirements
- **`SUMMARY.md` frontmatter doesn't capture a `one_liner` field** — the workflow's `summary-extract` step expects one, but the actual SUMMARY files only have YAML metadata + free-form body. Made accomplishment extraction manual
- **Coverage tooling discovery happened late** — Phase 11-01 spent a full plan capturing a Phase-10 baseline because `@vitest/coverage-v8` wasn't installed on `main`. Should be a permanent dev dep, not a phase-by-phase capture
- **Single 50-minute plan (08-02)** flagged as a too-large slice retrospectively — the KeepaliveScheduler + 4 timer rewires + SyncEngine 4 sub-facades + SSE swap + SIGINT closure was 3 concerns bundled. Could have been split
- **`STATE.md` Accumulated Context bloated to ~50 phase-local D-NNN entries** before close — should have been pruned at each `/gsd-transition`, not at milestone-close time

### Patterns Established

- **Phase guard block per phase** — each phase appends a `D-NNN` zero-tolerance block to `scripts/check-no-cut-agents.sh` (ripgrep absence + structural assertions); accumulates into a durable repo-wide invariant
- **Decomposition pattern: thin facade + sub-modules** — used uniformly for SessionCache (4 services), SyncEngine (4 sub-facades), message-window-store (5 sub-modules), SessionList (4 hooks + 4 components), settings/HappyComposer/_results. Public surface preserved; tests untouched; sub-modules each ≤ ~400 lines
- **Capability-driven branching** — every `if (flavor === ...)` / `switch (flavor)` replaced by `getCapability(flavor, 'capName')` lookup. New Cursor capabilities now only require an entry in `shared/src/flavors.ts`
- **Strict-or-full-snapshot SSE contract** — heuristic patch detection (`hasUnknownSessionPatchKeys()`) replaced with `SessionPatchSchema` / `MachinePatchSchema` in `shared/`; malformed events log/drop, no fallback invalidation
- **Frozen `loadConfig()` + DI** — both CLI and Hub return `Object.freeze`d Config; consumers receive via parameter, no module-level mutable singleton. Tests use `makeConfig(overrides)` factory instead of singleton-monkey-patching
- **Two-layer auth tests** — route layer + middleware layer separately, with `assertNoSecretLeak` helper covering 4xx body + console redaction

### Key Lessons

1. **Slim before you reshape** — deleting 50%+ of the codebase before any refactor cut downstream work disproportionately (per-phase plan counts trended down across the milestone)
2. **Phase gates compound** — a per-phase guard block in `check-no-cut-agents.sh` is cheap to write and catches an entire class of regressions for the rest of the project's lifetime
3. **`Rule 3` deviations are signal** — when an in-scope unplanned fix surfaces mid-plan, document it in SUMMARY's deviations section rather than scope-creep silently; the verifier catches the rest
4. **Single coordinated wave for HIGH-risk DI cutover** — Phase 10's `loadConfig()` refactor touched ~30 CLI consumers and 7 Hub consumers; attempting to split it across plans would have left consumers temporarily reading from two different config shapes
5. **Pre-existing cycles bite during decomposition** — Phase 9's `messageWindow*` madge cycles only surfaced once SessionList was split; carry a cycle-check into every decomposition plan, not just guard-installation plans
6. **Manual E2E scenario is non-negotiable** — automated gates (typecheck/test/madge/ripgrep) caught everything except the actual Tailscale + phone + hub-restart loop, which is what users actually do
7. **`/gsd-transition` discipline matters** — failing to mark requirements complete at phase boundaries created a 33-row reconciliation task at milestone close that should have been distributed across 12 transitions

### Cost Observations

- Model mix: not tracked
- Sessions: not tracked (single-developer, multi-day continuous-context work)
- Notable: net `−12k LOC` with `+60.5k / −72.5k` — i.e., roughly half of changed lines were *replacements* (rewrite from zero), not pure deletions. The README rewrite alone replaced ~500 lines. Suggests "slim-down" milestones are still substantial creative work, not just `rm -rf`

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | — | 12 | Initial milestone; established phase guard pattern + decomposition facade pattern + capability-driven branching |

### Cumulative Quality

| Milestone | Tests (cli / hub / web) | Madge cycles | Zero-dep additions |
|-----------|-------------------------|--------------|--------------------|
| v1.0 | 253 / 239 / 541+ | 0 / 0 / 0 | `madge:check` script + `verify.yml` push-gate |

### Top Lessons (Verified Across Milestones)

*(Single milestone — verification across milestones pending v1.1 close.)*

1. Slim before reshape (provisional — needs v1.1 to confirm pattern holds when adding features rather than removing them)
2. Per-phase guard blocks compound (provisional — needs v1.1 to confirm the guards still hold against new code)

---

*Created: 2026-05-23 after v1.0 milestone close*
