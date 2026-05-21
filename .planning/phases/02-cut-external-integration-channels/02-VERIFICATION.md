---
phase: 02-cut-external-integration-channels
verified: 2026-05-21T09:55:00Z
status: gaps_found
score: 5/5 ROADMAP SCs verified; 3/3 High-severity dead-code remnants block "fully removed" goal
overrides_applied: 0
gaps:
  - truth: "Telegram bot path is fully removed from web (no orphan client methods, no stale auth bypass)"
    status: partial
    reason: "Hub middleware still whitelists deleted /api/bind for auth bypass — stale ACL surviving the route deletion. Confused-deputy risk if /api/bind is ever re-registered."
    artifacts:
      - path: "hub/src/web/middleware/auth.ts:20"
        issue: "`if (path === '/api/auth' || path === '/api/bind')` — /api/bind handler was deleted in plan 02-01 but its auth bypass entry survives. Per-plan grep gates matched on the literal `telegram*` regex, which the path `/api/bind` does not contain."
    missing:
      - "Drop `|| path === '/api/bind'` clause from the auth middleware whitelist"
  - truth: "ElevenLabs voice path is fully removed from web (no orphan client methods targeting deleted /api/voice/token route)"
    status: partial
    reason: "ApiClient.fetchVoiceToken() in web/src/api/client.ts survives despite the entire voice consumer tree (web/src/realtime/, voice-context, shared/src/voice.ts, @elevenlabs/react dep) being deleted. Method targets the deleted /api/voice/token endpoint; zero callers in web/src; ships in production bundle."
    artifacts:
      - path: "web/src/api/client.ts:508-518"
        issue: "Orphan `fetchVoiceToken()` method targets deleted /api/voice/token route. Structurally identical to the now-removed `bind()` method (correctly deleted by plan 02-02). Plan 02-03's modified-file set did not include web/src/api/client.ts so the per-plan grep gate did not run on it."
    missing:
      - "Delete fetchVoiceToken() method (lines 508-518) entirely from web/src/api/client.ts"
  - truth: "web/src/lib/languages.ts post-rewrite has surviving consumers (per plan 02-03 SUMMARY claim)"
    status: failed
    reason: "Plan 02-03 SUMMARY claimed languages.ts was 'rewritten clean — other consumers untouched'. Grep `from.*@/lib/languages` across web/src/ returns zero import statements; the module's only consumers were the deleted Voice Assistant settings section. All 86 LOC (Language type, LANGUAGES constant of 47 entries, getLanguageDisplayName, findLanguageByCode) are dead and ship as ~3KB unused JS in the production bundle."
    artifacts:
      - path: "web/src/lib/languages.ts"
        issue: "Entire file is unimported. The 02-03 test file mock removal (vi.mock('@/lib/languages', …) was a half-cleanup — the mock was dropped but the now-unimported source survived."
    missing:
      - "Delete web/src/lib/languages.ts entirely; verify with `Grep 'from.*@/lib/languages|getLanguageDisplayName|findLanguageByCode|LANGUAGES\\b' web/src/` → 0 matches"
---

# Phase 02: Cut External Integration Channels Verification Report

**Phase Goal:** Telegram bot, ElevenLabs voice route, and ServerChan push channel are fully removed from hub, web, and shared.
**Verified:** 2026-05-21T09:55:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

The five ROADMAP Success Criteria all pass against the literal codebase checks they specify. However, three High-severity dead-code remnants flagged by the code reviewer constitute partial-removal evidence that contradicts the phase goal's "fully removed" language.

| # | Truth (ROADMAP SC) | Status | Evidence |
| - | ------------------ | ------ | -------- |
| 1 | `bun typecheck` and `bun run test` both pass after deletions of the 7 listed paths | ✓ VERIFIED | All 7 paths absent (`hub/src/telegram/`, `hub/src/web/telegramInitData.ts`, `hub/src/web/routes/bind.ts`, `hub/src/web/routes/voice.ts`, `hub/src/serverchan/`, `web/src/realtime/`, `shared/src/voice.ts`). `bun typecheck` → exit 0. `bun run test` → 596 tests passed across 69 files. |
| 2 | Zero ripgrep hits for `telegram` / `serverchan` / `elevenlabs` / `grammy` in cli/, hub/, web/, shared/ outside whitelist | ✓ VERIFIED | Grep of `\b(telegram\|serverchan\|elevenlabs\|grammy)\b` across cli/ hub/ web/ shared/ returns only README.md hits in cli/, hub/, web/ and cli/src/runner/README.md — all explicitly whitelisted as Phase-12-deferred in `scripts/check-no-cut-agents.sh:103-114`. No business-code hits. |
| 3 | No `grammy` or `@elevenlabs/react` in any package.json; notificationChannels array in hub/src/index.ts no longer references Telegram or ServerChan | ✓ VERIFIED | Grep `grammy\|@elevenlabs/react` across `**/package.json` returns zero matches. `hub/src/index.ts:178-180` shows `notificationChannels: NotificationChannel[] = [new PushNotificationChannel(...)]` — single element, length 1. |
| 4 | Env vars `TELEGRAM_BOT_TOKEN` / `TELEGRAM_NOTIFICATION` / `SERVERCHAN_SENDKEY` / `SERVERCHAN_NOTIFICATION` are not read anywhere | ✓ VERIFIED | Grep of all four env var names across cli/, hub/, web/, shared/ ts/tsx/js/json returns zero matches. |
| 5 | `/api/auth` no longer accepts Telegram `initData`; tests cover only the access-token branch | ✓ VERIFIED | `hub/src/web/routes/auth.ts:9-12` shows `z.object({ accessToken: z.string() })` — single-field schema, no `initData` branch. `parseAccessToken(parsed.data.accessToken)` is the only flow. Test suite at `hub/src/web/routes/auth.test.ts` is exercised by `bun run test` → green. |

**ROADMAP SC score:** 5/5 verified.

### Gap-Level Truths (derived from phase goal "fully removed")

The phase goal is broader than the five SCs: it asserts the three channels are **fully removed**, not merely that the named paths/keywords/env-vars are absent. Goal-backward verification surfaced three concrete partial-removal cases that the per-plan grep gates were structurally unable to catch (each lives just outside its plan's declared modified-file set).

| # | Goal-derived truth | Status | Evidence |
| - | ------------------ | ------ | -------- |
| 6 | No orphan client method targets the deleted `/api/voice/token` route | ✗ FAILED | `web/src/api/client.ts:508-518` — `fetchVoiceToken()` survives. Zero callers in web/src/. Ships in production bundle. |
| 7 | Auth middleware whitelist does not retain stale bypass entries for deleted routes | ✗ FAILED | `hub/src/web/middleware/auth.ts:20` — `/api/bind` still in the auth-bypass branch despite `bind.ts` being deleted in plan 02-01. Forward-looking confused-deputy risk. |
| 8 | `web/src/lib/languages.ts` retains the consumer base the 02-03 SUMMARY claimed | ✗ FAILED | Grep `from.*@/lib/languages\|getLanguageDisplayName\|findLanguageByCode\|LANGUAGES\b` across `web/src/` returns zero callers. Entire 86-LOC module is dead. |

**Goal score:** 5/8 must-haves verified once the goal-derived truths are added.

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
| `hub/src/web/routes/auth.ts` | schema = `{ accessToken: z.string() }` only | ✓ VERIFIED | single-field schema confirmed line 9-12 |
| `hub/src/index.ts` notificationChannels | `[PushNotificationChannel]` only (length 1) | ✓ VERIFIED | line 178-180 |
| `web/src/api/client.ts` | no orphan voice methods | ✗ STUB-LIKE | `fetchVoiceToken()` is an orphan exposing a public method that targets a deleted route — see HI-01 |
| `hub/src/web/middleware/auth.ts` | no stale `/api/bind` whitelist | ✗ STUB-LIKE | dead whitelist entry — see HI-02 |
| `web/src/lib/languages.ts` | imported by surviving consumers OR deleted | ✗ ORPHAN | entire file is unimported — see HI-03 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `hub/src/web/routes/auth.ts` | `parseAccessToken` | direct import | ✓ WIRED | single auth path; access-token-only |
| `hub/src/index.ts` | `notificationHub` | constructor with `[PushNotificationChannel]` | ✓ WIRED | only push channel registered |
| `web/src/hooks/useAuth.ts` → `AuthSource` | `{ type: 'accessToken'; token }` only | direct type | ✓ WIRED | single-variant union (degenerate, see LO-03) |
| `scripts/check-no-cut-agents.sh` PATTERN | extended to `\b(...\|telegram\|serverchan\|elevenlabs\|grammy)\b` | regex literal | ✓ WIRED | confirmed line 21 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Project typechecks after deletions | `bun typecheck` | exit 0, three packages green | ✓ PASS |
| Test suite passes after deletions | `bun run test` | 596 tests, 69 files, all passed | ✓ PASS |
| Ripgrep guard script PATTERN scope | inspected `scripts/check-no-cut-agents.sh` line 21 | PATTERN extended to include the four Phase-2 keywords | ✓ PASS |
| Guard script execution | `bash scripts/check-no-cut-agents.sh` | `rg: command not found` on this verifier host — script swallows the error via `if rg ...; then` and reports success. Manual Grep-tool fallback (ripgrep-backed) confirms zero non-whitelisted business-code hits. | ⚠️ TOOLING — environmental, not a phase defect |

### Probe Execution

No probe scripts declared in PLANs or in `scripts/*/tests/probe-*.sh`. Phase has no migration/tooling probes — N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CUT-06 | 02-01-PLAN.md, 02-02-PLAN.md, 02-05-PLAN.md | Delete Telegram bot full chain (hub/src/telegram/ tree, telegramInitData, bind.ts, grammy dep, Telegram notification channel, Telegram-only config) | ⚠️ SATISFIED with caveat | Core deletions complete. Two scope-edge orphans remain: `/api/bind` whitelist (HI-02) and i18n / CSS / `applyPlatform` / `AuthSource` degenerate union (LO-01..LO-04). Documentation surfaces still advertise the Mini App (ME-02, ME-03) — Phase-12 deferred. |
| CUT-07 | 02-03-PLAN.md, 02-05-PLAN.md | Delete voice route + ElevenLabs SDK (voice.ts, web/src/realtime/, shared/src/voice.ts, @elevenlabs/react) | ⚠️ SATISFIED with caveat | Core deletions complete. Two scope-edge orphans remain: `fetchVoiceToken()` ApiClient method (HI-01) and `web/src/lib/languages.ts` whole module (HI-03). Voice Assistant doc page survives (ME-01) — Phase-12 deferred. |
| CUT-08 | 02-04-PLAN.md, 02-05-PLAN.md | Delete ServerChan push channel (hub/src/serverchan/, env vars) | ✓ SATISFIED | All ServerChan paths absent. notificationChannels reduced to `[PushNotificationChannel]`. No env-var reads. No dead-code remnants found by reviewer. |

No orphaned requirements: REQUIREMENTS.md maps exactly CUT-06, CUT-07, CUT-08 to Phase 2; all three are claimed by at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `web/src/api/client.ts` | 508-518 | Orphan public method `fetchVoiceToken()` targeting deleted `/api/voice/token` route — no callers, ships in bundle, would 404 if invoked | 🛑 BLOCKER (HI-01) | Violates "fully removed" goal for ElevenLabs voice surface in web/ |
| `hub/src/web/middleware/auth.ts` | 20 | Stale auth-bypass whitelist for deleted `/api/bind` path | 🛑 BLOCKER (HI-02) | Confused-deputy class defect if `/api/bind` is ever re-registered. Currently harmless (route 404s) but the trust-boundary entry should not survive its route. |
| `web/src/lib/languages.ts` | whole file (86 LOC) | Entirely unimported module — `Language`, `LANGUAGES` (47 entries), `getLanguageDisplayName`, `findLanguageByCode` exports have zero consumers | 🛑 BLOCKER (HI-03) | Plan 02-03 SUMMARY claim "other consumers untouched" is incorrect; the only consumers were the deleted Voice Assistant settings section. ~3 KB unused JS in production bundle. |
| `web/src/lib/locales/{en,zh-CN}.ts` | 19, 21 | Orphan i18n keys `login.error.bindingUnavailable` / `login.error.bindFailed` | ⚠️ WARNING (LO-01) | Documented in plan 02-02 SUMMARY as accept-minimum-diff |
| `web/src/index.css` | 6-14, 86-94 | `--tg-theme-*` CSS variable fallbacks (16 occurrences) | ⚠️ WARNING (LO-02) | Documented in plan 02-02 SUMMARY as accept-minimum-diff |
| `web/src/hooks/useAuth.ts` | 5 | `AuthSource` degenerate single-variant discriminated union | ⚠️ WARNING (LO-03) | Code-smell only, no defect |
| `web/src/hooks/useTheme.ts` | 100-104 | Unused `applyPlatform()` function — silent regression: `.ios` body class never applied | ⚠️ WARNING (LO-04) | Possible iOS CSS regression; worth verifying whether anything keys off `html.ios` |
| `hub/src/web/routes/auth.ts` | 39-47 | Vestigial `firstName: 'Web User'` / `lastName` / `username` user shape from Telegram bind era | ℹ️ INFO (IN-01) | `AuthResponse['user']` contract narrowing flagged as out of scope by reviewer |
| `cli/src/terminal/TerminalManager.ts` | 30-38 | `SENSITIVE_ENV_KEYS` not expanded to cover `ELEVENLABS_API_KEY` / `ELEVENLABS_AGENT_ID` / `SERVERCHAN_SENDKEY` (or to keep `TELEGRAM_BOT_TOKEN`) | ⚠️ WARNING (ME-04) | Defense-in-depth gap — users with the env vars still exported leak secrets into spawned terminal subprocesses readable via `/proc/self/environ`. Threat T-02-05-1 implicitly accepted for the Telegram case only. |
| `cli/README.md` | 17 | Telegram Mini App advertised | ⚠️ WARNING (ME-03) | Docs drift; Phase-12 deferred per whitelist |
| `hub/README.md` | 76-77, 128 | Deleted endpoints + Telegram auth path still documented | ⚠️ WARNING (ME-02) | Docs drift; Phase-12 deferred per whitelist |
| `docs/guide/voice-assistant.md` + 4 backlinks | full file | Voice Assistant guide page survives despite feature deletion; tells users to set `ELEVENLABS_API_KEY` | ⚠️ WARNING (ME-01) | Docs drift; Phase-12 deferred per whitelist. Most user-visible dead reference. |

**No `TBD` / `FIXME` / `XXX` debt markers found in any Phase-2-modified file.** All three BLOCKERs derive from the same root cause: per-plan grep gates ran only against each plan's declared modified-file set, which left scope-edge dead code (the importer surface of a deleted server route, the auth whitelist for a deleted route, and a helper module whose sole consumer was inside the deleted feature) uncovered. A goal-backward grep for `voice|bind|languages` across **all** affected packages would have caught all three.

### Human Verification Required

None. All gaps are programmatically observable and have a concrete deterministic fix path. The phase has no UI-behavior or runtime-flow checks that require human attention.

### Deferred Items

The Medium documentation findings (ME-01..ME-03) are explicitly addressed by **Phase 12: Docs cleanup & milestone verification** — see ROADMAP.md line 175 (`Cursor-only README/AGENTS/docs; delete website/; docs/ retains only Cursor-relevant pages`) and SC#4 (ripgrep zero matches for `telegram/serverchan/elevenlabs` in non-historical files). These are not actionable Phase-2 gaps.

| # | Item | Addressed In | Evidence |
| - | ---- | ------------ | -------- |
| 1 | Voice Assistant guide page + 4 backlinks (ME-01) | Phase 12 | SC#1 + SC#4: "docs/ retains only Cursor-relevant pages; ripgrep finds zero matches for elevenlabs/telegram/serverchan in non-historical files" |
| 2 | `hub/README.md` deleted-endpoint listings (ME-02) | Phase 12 | SC#1: "hub/README.md describes Cursor as the only supported agent" |
| 3 | `cli/README.md` Mini App reference (ME-03) | Phase 12 | SC#1: "cli/README.md describes Cursor as the only supported agent" |

ME-04 (`SENSITIVE_ENV_KEYS` not expanded) is **not** clearly addressed by any later phase — defense-in-depth for legacy env-var redaction is not on the ROADMAP. Flagged as a warning for the user to either accept or fold into a later phase.

### Gaps Summary

The phase achieves all five literal ROADMAP Success Criteria — typecheck/test green, ripgrep clean against the four Phase-2 keywords (outside the documentation whitelist), no `grammy`/`@elevenlabs/react` package.json declarations, no `TELEGRAM_BOT_TOKEN`/`TELEGRAM_NOTIFICATION`/`SERVERCHAN_SENDKEY`/`SERVERCHAN_NOTIFICATION` env reads, `/api/auth` reduced to the access-token-only branch.

The phase **does not** achieve the stronger goal statement of "fully removed from hub, web, and shared." Three High-severity dead-code remnants survive — each one structurally outside a per-plan grep gate's declared file set:

1. **HI-01 `web/src/api/client.ts:508-518`** — `fetchVoiceToken()` ApiClient method targets the deleted `/api/voice/token` route. Single-line deletion; zero downstream consumers.
2. **HI-02 `hub/src/web/middleware/auth.ts:20`** — `/api/bind` retained in the auth-bypass whitelist. Single-clause deletion; security-adjacent (confused-deputy class).
3. **HI-03 `web/src/lib/languages.ts`** — entire 86-LOC module is unimported. Plan 02-03 SUMMARY's claim of surviving consumers is contradicted by grep.

These three are scope-edge polish items in the reviewer's framing but are **goal-blocking** under the verifier's adversarial stance: the phase goal claims the channels are "fully removed" and the codebase contains observable evidence to the contrary. Each fix is mechanical (delete one method, delete one clause, delete one file) and bounded; a single follow-up plan can close all three with `bun typecheck && bun run test` as the regression gate.

Two additional notable items the user may want to triage separately (not classed as gaps):

- **ME-04** `SENSITIVE_ENV_KEYS` is the only finding without a clear later-phase home; recommend either folding into a Phase-2 follow-up or accepting the threat-model carve-out explicitly.
- **LO-04** `applyPlatform()` orphan may be a silent iOS body-class regression; worth a 5-minute investigation before closing this finding as accepted.

---

_Verified: 2026-05-21T09:55:00Z_
_Verifier: Claude (gsd-verifier)_
