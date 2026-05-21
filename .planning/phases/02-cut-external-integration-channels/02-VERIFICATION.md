---
phase: 02-cut-external-integration-channels
verified: 2026-05-21T10:08:00Z
status: passed
score: 8/8 must-haves verified (5 ROADMAP SCs + 3 goal-derived dead-code truths)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/8
  gaps_closed:
    - "Telegram bot path fully removed from web (no orphan /api/bind auth bypass) — HI-02"
    - "ElevenLabs voice path fully removed from web (no orphan fetchVoiceToken) — HI-01"
    - "web/src/lib/languages.ts deleted (dead module post-CUT-07) — HI-03"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Voice Assistant guide page and 4 backlinks still present in docs/"
    addressed_in: "Phase 12"
    evidence: "ROADMAP Phase 12 SC#1+SC#4: 'docs/ retains only Cursor-relevant pages; ripgrep finds zero matches for elevenlabs/telegram/serverchan in non-historical files'"
  - truth: "hub/README.md still lists deleted endpoints and Telegram auth path"
    addressed_in: "Phase 12"
    evidence: "ROADMAP Phase 12 SC#1: 'hub/README.md describes Cursor as the only supported agent'"
  - truth: "cli/README.md Telegram Mini App reference"
    addressed_in: "Phase 12"
    evidence: "ROADMAP Phase 12 SC#1: 'cli/README.md describes Cursor as the only supported agent'"
---

# Phase 02: Cut External Integration Channels Verification Report

**Phase Goal:** Telegram bot, ElevenLabs voice route, and ServerChan push channel are fully removed from hub, web, and shared.
**Verified:** 2026-05-21T10:08:00Z
**Status:** passed
**Re-verification:** Yes — after plan 02-06 gap closure (HI-01..HI-03)

## Re-Verification Summary

Initial verification (2026-05-21T09:55:00Z) returned `gaps_found` with 5/8 must-haves verified. The three goal-derived BLOCKERs (HI-01..HI-03) were closed by plan 02-06 across three atomic commits:

| Gap | Commit | Closure Evidence |
| --- | ------ | ---------------- |
| HI-01 — orphan `fetchVoiceToken()` in `web/src/api/client.ts` | `8000755` | `Grep 'fetchVoiceToken' web/src/` → 0 matches |
| HI-02 — stale `/api/bind` clause in `hub/src/web/middleware/auth.ts:20` | `01896d0` | `Grep '/api/bind' hub/src/web/middleware/auth.ts` → 0 matches; line 20 now `if (path === '/api/auth') {` |
| HI-03 — unimported `web/src/lib/languages.ts` (86 LOC) | `196b755` | `test ! -f web/src/lib/languages.ts` → exit 0; `Grep 'from.*@/lib/languages\|getLanguageDisplayName\|findLanguageByCode\|\bLANGUAGES\b' web/src/` → 0 matches |

Regression checks: `bun typecheck` → exit 0; `bun run test` → 596/596 passing across 69 files; `bash scripts/check-no-cut-agents.sh` → exit 0 (✅ guard passes). Initial-verification truths #1..#5 remain green; no new dead code introduced; no scope creep into ME-/LO-/IN- items.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | `bun typecheck` and `bun run test` both pass after the 7 listed deletions | ✓ VERIFIED | `bun typecheck` exit 0 (re-run 10:08); `bun run test` 596 tests across 69 files all green |
| 2 | Zero ripgrep hits for `telegram` / `serverchan` / `elevenlabs` / `grammy` in cli/, hub/, web/, shared/ outside whitelist | ✓ VERIFIED | `bash scripts/check-no-cut-agents.sh` → ✅ No non-Cursor agent literals outside whitelist |
| 3 | No `grammy` or `@elevenlabs/react` in any package.json; notificationChannels reduced to `[PushNotificationChannel]` | ✓ VERIFIED | unchanged from initial verification; `hub/src/index.ts:178-180` retains single-element array |
| 4 | Env vars `TELEGRAM_BOT_TOKEN` / `TELEGRAM_NOTIFICATION` / `SERVERCHAN_SENDKEY` / `SERVERCHAN_NOTIFICATION` are not read anywhere | ✓ VERIFIED | unchanged from initial verification; zero reads across cli/, hub/, web/, shared/ |
| 5 | `/api/auth` no longer accepts Telegram `initData`; tests cover only the access-token branch | ✓ VERIFIED | unchanged from initial verification; `hub/src/web/routes/auth.ts:9-12` retains `z.object({ accessToken: z.string() })` only |
| 6 | No orphan client method targets the deleted `/api/voice/token` route (was HI-01) | ✓ VERIFIED | `Grep 'fetchVoiceToken' web/src/` → 0 matches (was 1 before commit `8000755`) |
| 7 | Auth middleware whitelist does not retain stale bypass entries for deleted routes (was HI-02) | ✓ VERIFIED | `hub/src/web/middleware/auth.ts:20` now reads `if (path === '/api/auth') {`; `Grep '/api/bind' hub/src/web/middleware/auth.ts` → 0 matches |
| 8 | `web/src/lib/languages.ts` is either consumed or deleted (was HI-03) | ✓ VERIFIED | File deleted (commit `196b755`); reachability grep → 0 matches workspace-wide |

**Score:** 8/8 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `hub/src/telegram/` | deleted | ✓ VERIFIED | absent |
| `hub/src/web/telegramInitData.ts` | deleted | ✓ VERIFIED | absent |
| `hub/src/web/routes/bind.ts` | deleted | ✓ VERIFIED | absent |
| `hub/src/web/routes/voice.ts` | deleted | ✓ VERIFIED | absent |
| `hub/src/serverchan/` | deleted | ✓ VERIFIED | absent |
| `web/src/realtime/` | deleted | ✓ VERIFIED | absent |
| `shared/src/voice.ts` | deleted | ✓ VERIFIED | absent |
| `hub/src/web/routes/auth.ts` | schema = `{ accessToken: z.string() }` only | ✓ VERIFIED | single-field schema confirmed |
| `hub/src/index.ts` notificationChannels | `[PushNotificationChannel]` only | ✓ VERIFIED | single-element array |
| `web/src/api/client.ts` | no orphan voice methods | ✓ VERIFIED | `fetchVoiceToken()` removed (HI-01 closed) |
| `hub/src/web/middleware/auth.ts` | no stale `/api/bind` whitelist | ✓ VERIFIED | clause dropped (HI-02 closed) |
| `web/src/lib/languages.ts` | deleted (no surviving consumers) | ✓ VERIFIED | file deleted (HI-03 closed) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `hub/src/web/routes/auth.ts` | `parseAccessToken` | direct import | ✓ WIRED | single auth path |
| `hub/src/index.ts` | `notificationHub` | constructor with `[PushNotificationChannel]` | ✓ WIRED | only push channel registered |
| `scripts/check-no-cut-agents.sh` PATTERN | extended to `\b(...\|telegram\|serverchan\|elevenlabs\|grammy)\b` | regex literal | ✓ WIRED | guard run exit 0 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Project typechecks | `bun typecheck` | exit 0 (cli + web + hub) | ✓ PASS |
| Test suite passes | `bun run test` | 596 passed / 596 total across 69 files (Duration 2.11s) | ✓ PASS |
| Ripgrep guard | `bash scripts/check-no-cut-agents.sh` | exit 0 — `✅ No non-Cursor agent literals outside whitelist.` | ✓ PASS |
| HI-01 closure | `Grep 'fetchVoiceToken' web/src/` | 0 matches | ✓ PASS |
| HI-02 closure | `Grep '/api/bind' hub/src/web/middleware/auth.ts` | 0 matches | ✓ PASS |
| HI-03 closure | `test ! -f web/src/lib/languages.ts` | exit 0 | ✓ PASS |
| HI-03 reachability | `Grep 'from.*@/lib/languages\|getLanguageDisplayName\|findLanguageByCode\|\bLANGUAGES\b' web/src/` | 0 matches | ✓ PASS |

### Probe Execution

No probe scripts declared in PLANs or in `scripts/*/tests/probe-*.sh`. Phase has no migration/tooling probes — N/A.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| CUT-06 | 02-01, 02-02, 02-05, 02-06 | Delete Telegram bot full chain | ✓ SATISFIED | All core deletions confirmed; auth-bypass whitelist cleaned up in 02-06 (HI-02). Doc surfaces (ME-02, ME-03) deferred to Phase 12. |
| CUT-07 | 02-03, 02-05, 02-06 | Delete voice route + ElevenLabs SDK | ✓ SATISFIED | All core deletions confirmed; `fetchVoiceToken()` orphan removed (HI-01) and `web/src/lib/languages.ts` deleted (HI-03) in 02-06. Voice Assistant doc (ME-01) deferred to Phase 12. |
| CUT-08 | 02-04, 02-05 | Delete ServerChan push channel | ✓ SATISFIED | All paths absent; notificationChannels reduced; no env-var reads; no dead-code remnants. |

No orphaned requirements: REQUIREMENTS.md maps exactly CUT-06, CUT-07, CUT-08 to Phase 2; all three are claimed by at least one plan's `requirements:` frontmatter field and now fully verified.

### Anti-Patterns Found

Remaining items are all Warning/Info classifications that do not block the phase goal:

| File | Pattern | Severity | Disposition |
| ---- | ------- | -------- | ----------- |
| `web/src/lib/locales/{en,zh-CN}.ts` | orphan i18n keys (LO-01) | ⚠️ WARNING | Accepted minimum-diff per plan 02-02 SUMMARY |
| `web/src/index.css` | `--tg-theme-*` CSS variable fallbacks (LO-02) | ⚠️ WARNING | Accepted minimum-diff per plan 02-02 SUMMARY |
| `web/src/hooks/useAuth.ts` | `AuthSource` degenerate union (LO-03) | ⚠️ WARNING | Code smell only |
| `web/src/hooks/useTheme.ts` | unused `applyPlatform()` (LO-04) | ⚠️ WARNING | Possible silent iOS body-class regression — user may want to triage |
| `hub/src/web/routes/auth.ts` | vestigial user-shape fields (IN-01) | ℹ️ INFO | Out of scope per reviewer |
| `cli/src/terminal/TerminalManager.ts` | `SENSITIVE_ENV_KEYS` not expanded (ME-04) | ⚠️ WARNING | Not addressed by any later phase — defense-in-depth gap; user triage recommended |
| `cli/README.md`, `hub/README.md`, `docs/guide/voice-assistant.md` | docs drift (ME-01..ME-03) | ⚠️ WARNING | Deferred to Phase 12 (see `deferred:` frontmatter) |

**No `TBD` / `FIXME` / `XXX` debt markers in any Phase-2-modified file (including the three 02-06 deltas).**

### Human Verification Required

None. All goal-derived must-haves are programmatically observable and now verified.

### Gaps Summary

No gaps. The phase achieves both the five literal ROADMAP Success Criteria and the three goal-derived "fully removed" truths that the initial verification flagged as BLOCKERs. Plan 02-06 closed HI-01/HI-02/HI-03 with three minimum-diff atomic commits, no regressions, and no scope creep.

Two non-blocking items remain for user triage (not classed as gaps):

- **ME-04** `SENSITIVE_ENV_KEYS` is the only finding without a clear later-phase home; recommend either folding into a Phase-2 follow-up or accepting the threat-model carve-out explicitly.
- **LO-04** `applyPlatform()` orphan may be a silent iOS body-class regression; worth a 5-minute investigation before closing this finding as accepted.

Three documentation surfaces (ME-01..ME-03) are explicitly deferred to Phase 12 per `deferred:` frontmatter — these are not actionable Phase-2 gaps.

---

_Verified: 2026-05-21T10:08:00Z_
_Verifier: Claude (gsd-verifier)_
