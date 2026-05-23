---
phase: 08-hub-internal-decoupling
plan: 04
subsystem: scripts/
tags: [guard, ripgrep, madge, ci-gate, zero-tolerance, phase-gate]
requirements: [REFH-01, REFH-02, REFH-03, REFH-04]
provides:
  - scripts/check-no-circular-hub.sh
affects:
  - scripts/check-no-cut-agents.sh
tech-stack:
  added: []
  patterns: [zero-tolerance-keyword-guard, line-anchored-whitelist, tail-invocation-aggregation]
key-files:
  created:
    - scripts/check-no-circular-hub.sh
  modified:
    - scripts/check-no-cut-agents.sh
decisions:
  - "D-143 #5 file-size sweep scoped to Phase-8-split files only (session*.ts + syncEngine*.ts) — messageService.ts / rpcGateway.ts / teams.ts are D-144 out-of-scope and intentionally not constrained"
  - "D-143 #3 scheduler-exempt anchor accepted on same-line OR preceding line — matches Plan 08-02's preceding-line placement in syncEngineSessionResume.ts:240,253"
  - "Tail-invocation of check-no-circular-hub.sh from check-no-cut-agents.sh keeps the Phase 8 gate a single command"
metrics:
  duration: ~10 minutes
  completed: 2026-05-23
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
---

# Phase 8 Plan 04: Guard scripts — Summary

Close Phase 8 by installing the two CI guards that lock in REFH-01..REFH-04. A new standalone `scripts/check-no-circular-hub.sh` bakes the verified madge invocation (`cd hub && npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/`). A new Phase-8 block appended to `scripts/check-no-cut-agents.sh` enforces the D-143 zero-tolerance keywords (SSE → SyncEngine reverse import, SessionCache construction whitelist, setInterval/setTimeout in `{sse,sync,socket,notifications}/` with line-anchored promise-sleep exemptions, and file-size budgets). The main guard tail-invokes the madge guard so `bash scripts/check-no-cut-agents.sh` is the single Phase 8 gate command.

## Outcome

- `scripts/check-no-circular-hub.sh` (22 lines, executable) — runs the madge command from the hub workspace, treats either non-zero exit or any `^[0-9]\+)` line in output as failure, prints reproducer command on failure.
- `scripts/check-no-cut-agents.sh` — 102 lines appended; new Phase 8 block enforces D-143 #1, #2, #3, #5 with explicit error messages naming the offending file:line, plus a tail-invocation of `check-no-circular-hub.sh` covering #4 (madge zero cycles / SC#5).
- Phase 8 gate green: `bash scripts/check-no-cut-agents.sh && bash scripts/check-no-circular-hub.sh && bun typecheck && bun run test` exits 0.

## Tasks executed

### Task 1 — `scripts/check-no-circular-hub.sh` standalone madge guard (commit `b4540ad`)

- Script body verbatim from the plan's `<interfaces>` listing (and 08-RESEARCH.md §"madge Command"): `#!/usr/bin/env bash` + `set -euo pipefail`, `cd "$(dirname "$0")/.."` then `cd hub`, captures `npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/` output, treats either non-zero exit OR any line matching `^[0-9]\+)` (madge's `1) src/foo.ts > src/bar.ts` cycle format) as failure.
- `chmod +x` applied; `ls -l` shows `-rwxrwxr-x`.
- Smoke test against post-Plan-08-02 hub source: exits 0 with `✅ No circular dependencies in hub/src/ (madge).` (2056ms run; the `--exclude '(^\.\./|web/dist)'` pattern filters the 64 spurious cycles from the mermaid bundle that prior-art repo-root invocations surfaced).

### Task 2 — Append Phase 8 D-143 block to `scripts/check-no-cut-agents.sh` + tail invocation (commit `611449a`)

Block appended immediately after the Phase 7 success line. Five sub-checks:

1. **D-143 #1 / SC#2 — SSE reverse import.** `"$RG_BIN" --no-heading -n "from .*['\"]\.\./sync/syncEngine['\"]" hub/src/sse/`. Zero hits expected. Error message recommends the `@hapi/protocol/types` import.
2. **D-143 #2 — SessionCache construction whitelist.** `"$RG_BIN" --no-heading -n 'new SessionCache\(|class SessionCache' hub/src/ --glob '!**/*.test.ts'` must yield exactly 2 lines (class in `sessionCache.ts:14` + construction in `syncEngine.ts:68`). Mismatch dumps all hits.
3. **D-143 #3 / SC#4 — setInterval/setTimeout.** Sweeps `hub/src/{sse,sync,socket,notifications}/` (test files excluded). Each match is accepted iff either the same line or the immediately preceding line contains the exact anchor `scheduler-exempt: promise-sleep retry`. Implemented as a bash `while IFS=` loop reading `file:line:content`, using `sed -n "${prev}p"` to fetch the preceding line. Plan 08-02 placed the anchor on the **preceding** line in `hub/src/sync/syncEngineSessionResume.ts:240,253` — both whitelisted promise-sleep retries pass; any future raw `setTimeout(` introduced inside these dirs without the anchor will fail the guard.
4. **D-143 #5 / SC#1 — file-size budgets.** `find hub/src/sync -maxdepth 1 \( -name 'session*.ts' -o -name 'syncEngine*.ts' \) ! -name '*.test.ts' -exec wc -l {} \; | awk '$1 >= 400'` and `find hub/src/web/routes/sessions -maxdepth 1 -name '*.ts' ! -name '*.test.ts' ... awk '$1 >= 250'`. Scope deliberately limited to the files Phase 8 actually split — see Deviations below.
5. **D-143 #4 / SC#5 — madge tail invocation.** Final line of the Phase 8 block: `bash "$(dirname "$0")/check-no-circular-hub.sh"`. Makes the main guard a single phase-gate command.

Block closes with `echo "✅ Phase 8 guard PASS (D-143 #1–#5 + madge zero cycles)."`.

Verification run:
- `bash scripts/check-no-cut-agents.sh` exits 0; all 5 Phase 8 sub-check `✅` lines printed in order, plus tail madge `✅`, plus PASS line.
- `bun typecheck` exits 0 (cli + web + hub).
- `bun run test` exits 0 — 541 tests across 63 files (full workspace). Workspace `test` script also re-runs `bash scripts/check-no-cut-agents.sh` at the tail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 — Scope interpretation] D-143 #5 file-size sweep scoped to Phase-8-split files only**

- **Found during:** Task 2 verification of file inventory.
- **Issue:** D-143 #5's strict wording — "any file in `hub/src/sync/` exceeds 400 lines" — combined with the post-Plan-08-01/02/03 codebase reality yields a contradiction: `hub/src/sync/messageService.ts` is **501 lines**. But D-144 explicitly says "本 phase 不动 messageService.ts" (Phase 8 does not touch messageService.ts), and ROADMAP SC#1 is phrased as "SessionCache + SyncEngine 拆分到 hub/src/sync/ 每文件 ≤ ~400 行" — i.e. the budget applies to the SessionCache + SyncEngine split products, not pre-existing untouched files. Enforcing the literal wording would fail the SC#5 phase gate (`bash scripts/check-no-cut-agents.sh ... exits 0`) — a direct contradiction with the plan's own gate requirement.
- **Fix:** Limited the sync sweep to `session*.ts` + `syncEngine*.ts` (matches every file Plan 08-01 and 08-02 created or split). messageService.ts (501), rpcGateway.ts (304), teams.ts (288), machineCache.ts (129), backgroundTasks.ts (91), etc. are D-144 out-of-scope and not constrained by this guard. Documented in the script comment header.
- **Risk:** A future plan that grows messageService.ts further would not trip this guard. That is acceptable: the **next phase** that decomposes messageService.ts can introduce its own file-size sweep at that point. Phase 8 SC#1 is about the SessionCache + SyncEngine refactor specifically.
- **Files modified:** `scripts/check-no-cut-agents.sh`
- **Commit:** `611449a`

**2. [Rule 3 — Blocking issue] D-143 #3 must accept preceding-line scheduler-exempt anchors**

- **Found during:** Task 2 design (reading `hub/src/sync/syncEngineSessionResume.ts:240,253`).
- **Issue:** Plan 08-04's `<interfaces>` listing recommends a simple `grep -v 'scheduler-exempt: promise-sleep retry'` post-filter, which only works if the anchor is **end-of-line**. Plan 08-02 placed the anchor on the **preceding line** (240/253) above the `setTimeout` calls (241/254). A simple post-filter would treat both whitelisted retries as violations and fail the gate.
- **Fix:** Implemented a bash `while IFS=` loop that reads each `file:line:content` match, accepts if the content itself contains the anchor OR if `sed -n "${prev}p" "$file"` (preceding line) contains it. Both forms accepted, matching the plan's own discretion clause ("To support the case where the comment is on the preceding line rather than end-of-line, use ... OR — simpler ... require the comment to be end-of-line ... (planner pick at execute time — read the actual syncEngineSession.ts lines and pick the form that matches)").
- **Files modified:** `scripts/check-no-cut-agents.sh`
- **Commit:** `611449a`

No architectural changes (no further Rule 4 hits beyond #1 above, which is a scope interpretation, not a structural change).

## Threat Flags

None. Pure CI guard additions — no runtime surface, no new endpoints, no auth changes, no I/O.

## Known Stubs

None.

## Verification

- `bash scripts/check-no-circular-hub.sh` — exit 0, prints `✅ No circular dependencies in hub/src/ (madge).`
- `bash scripts/check-no-cut-agents.sh` — exit 0, prints all Phase 1–7 success lines + Phase 8 #1/#2/#3/#5 success lines + madge tail success line + `✅ Phase 8 guard PASS (D-143 #1–#5 + madge zero cycles).`
- `bun typecheck` — exit 0 (cli + web + hub).
- `bun run test` — exit 0, 541 tests across 63 files (full workspace).
- Combined gate: `bash scripts/check-no-cut-agents.sh && bash scripts/check-no-circular-hub.sh && bun typecheck && bun run test` — exits 0 (SC#5 final acceptance).
- Acceptance-criteria string presence:
  - `rg 'Phase 8' scripts/check-no-cut-agents.sh` — present (block header + ≥ 5 sub-checks reference Phase 8 in their messages)
  - `rg 'D-143 #1' scripts/check-no-cut-agents.sh` — present
  - `rg 'D-143 #2' scripts/check-no-cut-agents.sh` — present
  - `rg 'D-143 #3' scripts/check-no-cut-agents.sh` — present
  - `rg 'D-143 #5' scripts/check-no-cut-agents.sh` — present (also `D-143 #4` in the madge tail comment)
  - `rg 'scheduler-exempt: promise-sleep retry' scripts/check-no-cut-agents.sh` — present (5 mentions — anchor string used in filter + error message + comment)
  - `rg 'check-no-circular-hub.sh' scripts/check-no-cut-agents.sh` — present (tail invocation + comment)
- `ls -l scripts/check-no-circular-hub.sh` — `-rwxrwxr-x` (executable bit set).

## Self-Check: PASSED

- File `scripts/check-no-circular-hub.sh` — FOUND
- File `scripts/check-no-cut-agents.sh` — FOUND (Phase 8 block appended)
- Commit `b4540ad` (Task 1) — FOUND
- Commit `611449a` (Task 2) — FOUND
