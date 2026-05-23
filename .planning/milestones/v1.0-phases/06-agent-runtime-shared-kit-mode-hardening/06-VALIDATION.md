---
phase: 6
slug: agent-runtime-shared-kit-mode-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 6 is a cli-runtime type/abstraction-convergence phase: validation focuses on (a) args-array shape, (b) error-class identity, (c) import topology (madge zero cycles), and (d) zero regression on the existing `bun run test` suite.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (cli workspace) + bun typecheck + madge guard |
| **Config file** | `cli/vitest.config.ts` (existing) |
| **Quick run command** | `bun typecheck` |
| **Full suite command** | `bun run test` |
| **Madge guard command** | `npx madge --circular --extensions ts,tsx cli/src/cursor` (exit code = 0 required) |
| **Ripgrep guards** | See D-108 keywords below |
| **Estimated runtime** | ~30s typecheck, ~2 min full suite |

---

## Sampling Rate

- **After every task commit:** Run `bun typecheck`
- **After every plan wave:** Run `bun run test`
- **Before `/gsd:verify-work`:** Full suite green + `madge --circular cli/src/cursor` exit 0 + all D-108 ripgrep guards 0 hits
- **Max feedback latency:** ~30 s for typecheck, ~120 s for full suite

---

## Validation Dimensions (Nyquist)

| # | Dimension | What is sampled | How (automated) |
|---|-----------|-----------------|------------------|
| 1 | **Args-fragment correctness** | `permissionModeToCursorArgs(mode)` returns the right `{mode?, yolo?}` for each `PermissionMode` value (default / plan / ask / yolo) | Unit test on `cli/src/agent/modeConfig.ts` |
| 2 | **Unknown-mode error identity** | Passing `'weird' as PermissionMode` to ModeConfig throws `UnknownPermissionModeError` with `error.offendingMode === 'weird'` | Unit test + assert `instanceof UnknownPermissionModeError` |
| 3 | **RPC-boundary error class upgrade** | `runCursor.ts::resolvePermissionMode` throws `UnknownPermissionModeError` (not bare `Error`) for invalid payloads | Unit / integration test on `resolvePermissionMode` |
| 4 | **Mid-session yolo + remote switch** | After turn 1 with `default`, switching session mode to `yolo` makes the remote launcher's next turn args include `--yolo` and exclude `--mode` | Mock-spawn test exporting `buildAgentArgs` from `cursorRemoteLauncher.ts` |
| 5 | **Mid-session plan switch (local)** | Local launcher inserts `--mode plan` on plan-mode turn and omits `--mode` when switched back to default | Mock-spawn test on `cli/src/cursor/cursorLocal.ts::spawnWithTerminalGuard` |
| 6 | **Mid-session plan switch (remote, optional)** | Same as #5 but on remote launcher (if test infrastructure reuses easily) | Mock-spawn variant of #4 |
| 7 | **Import-topology / madge zero cycles** | `cli/src/cursor` has zero circular imports | `npx madge --circular --extensions ts,tsx cli/src/cursor` exit 0 |
| 8 | **Ripgrep zero-tolerance (D-108)** | a) `permissionModeToCursorArgs` only defined in `cli/src/agent/modeConfig.ts`; b) `permissionModeToAgentArgs` 0 hits anywhere; c) `permissionMode as string` 0 hits in launcher files | Extension of `scripts/check-no-cut-agents.sh` (or equivalent guard) |
| 9 | **Module isolation of `modes.ts`** | `cli/src/cursor/modes.ts` does NOT import `loop.ts` / `session.ts` / `cursorLocalLauncher.ts` / `cursorRemoteLauncher.ts` / `cursorLocal.ts` | Static grep / scripted assertion |
| 10 | **Typecheck after type-narrowing** | `bun typecheck` green after `getPermissionMode()` returns narrow type and `as string` strips removed | `bun typecheck` |
| 11 | **No regression on existing suite** | Existing `bun run test` is green at every slice boundary (D-107) | `bun run test` |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-* | 01 (modes.ts + cycle break) | 1 | REFA-05 | — | N/A (refactor) | type+madge | `bun typecheck && npx madge --circular --extensions ts,tsx cli/src/cursor` | ✅ existing | ⬜ pending |
| 06-02-* | 02 (ModeConfig + UnknownPermissionModeError) | 2 | REFA-02 | — | Typed throw on unknown mode | unit | `bun run test cli/src/agent/modeConfig.test.ts` | ❌ W0 (new file) | ⬜ pending |
| 06-03-* | 03 (Launcher convergence) | 3 | REFA-02 | — | Args fragment from single source; no `as string` casts | unit + grep | `bun typecheck && bun run test && rg 'permissionModeToAgentArgs\|permissionMode as string' cli/src` | ✅ existing | ⬜ pending |
| 06-04-* | 04 (3 tests + ripgrep+madge guard) | 4 | REFA-02, REFA-05 | — | Mid-session args correctness + zero cycles + zero mapping duplication | integration + guard | `bun run test && npx madge --circular --extensions ts,tsx cli/src/cursor && bash scripts/check-no-cut-agents.sh` | ❌ W0 (new tests, extended guard) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `cli/src/agent/modeConfig.test.ts` — unit tests for `permissionModeToCursorArgs` happy paths + UnknownPermissionModeError
- [ ] `cli/src/cursor/cursorLocalLauncher.test.ts` (or co-located) — mid-session plan switch via mocked `spawnWithTerminalGuard`
- [ ] `cli/src/cursor/cursorRemoteLauncher.test.ts` (or co-located) — mid-session yolo switch via direct `buildAgentArgs` export
- [ ] Extend `scripts/check-no-cut-agents.sh` (or equivalent source-guard host) with D-108 keyword checks + `madge --circular cli/src/cursor` invocation
- [ ] (If not already devDep) add `madge` to root `devDependencies` per researcher's open-question recommendation

*Existing infrastructure (`vitest`, `bun run test`, `cursorEventConverter.test.ts` / `buildCliArgs.test.ts` patterns) covers framework needs — only new test files required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end Cursor agent launch in interactive terminal still works after refactor | REFA-02 / REFA-05 | spawn of real `agent` CLI not exercised in unit suite (per D-105) | Run a manual local Cursor session with each of default/plan/ask/yolo and confirm visible behavior unchanged |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 new test files + extended guard script)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120 s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter when planner finalizes

**Approval:** pending
