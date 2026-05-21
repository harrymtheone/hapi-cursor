---
phase: 02-cut-external-integration-channels
plan: 03
subsystem: hub+web+shared
tags: [cut, deletion, elevenlabs, voice]
requires: [hub-side-telegram-free, web-side-telegram-free]
provides:
  - voice-free
  - elevenlabs-dep-free
affects:
  - hub/src/web/routes/voice.ts
  - hub/src/web/server.ts
  - shared/src/voice.ts
  - shared/package.json
  - web/src/realtime/
  - web/src/lib/voice-context.tsx
  - web/src/api/voice.ts
  - web/src/components/VoiceErrorBanner.tsx
  - web/src/components/SessionChat.tsx
  - web/src/components/AssistantChat/ComposerButtons.tsx
  - web/src/components/AssistantChat/HappyComposer.tsx
  - web/src/components/AssistantChat/StatusBar.tsx
  - web/src/App.tsx
  - web/src/lib/locales/en.ts
  - web/src/lib/locales/zh-CN.ts
  - web/src/lib/languages.ts
  - web/src/routes/settings/index.tsx
  - web/src/routes/settings/index.test.tsx
  - web/vite.config.ts
  - web/package.json
tech-stack:
  added: []
  removed: ["@elevenlabs/react"]
  patterns:
    - composer single-button (send only; no voice/mic toggle states)
    - status bar no voice priority
key-files:
  created: []
  deleted:
    - hub/src/web/routes/voice.ts
    - shared/src/voice.ts
    - web/src/lib/voice-context.tsx
    - web/src/api/voice.ts
    - web/src/components/VoiceErrorBanner.tsx
    - web/src/realtime/RealtimeSession.ts
    - web/src/realtime/RealtimeVoiceSession.tsx
    - web/src/realtime/hooks/contextFormatters.ts
    - web/src/realtime/hooks/voiceHooks.ts
    - web/src/realtime/index.ts
    - web/src/realtime/realtimeClientTools.ts
    - web/src/realtime/types.ts
    - web/src/realtime/voiceConfig.ts
  modified:
    - hub/src/web/server.ts
    - shared/package.json
    - web/src/App.tsx
    - web/src/components/AssistantChat/ComposerButtons.tsx
    - web/src/components/AssistantChat/HappyComposer.tsx
    - web/src/components/AssistantChat/StatusBar.tsx
    - web/src/components/SessionChat.tsx
    - web/src/lib/languages.ts
    - web/src/lib/locales/en.ts
    - web/src/lib/locales/zh-CN.ts
    - web/src/routes/settings/index.tsx
    - web/src/routes/settings/index.test.tsx
    - web/vite.config.ts
    - web/package.json
decisions:
  - "Single atomic commit per plan <output> (`feat(phase-02): CUT-07 remove ElevenLabs voice`). Per-task interim commits would leave intermediate broken typecheck states (e.g. SessionChat.tsx referencing deleted @/realtime imports after Task 1 deletes the hub route)."
  - "ComposerButtons UnifiedButton collapsed to send-only — voice/mic state branches removed, send when text else greyed-out. Mic toggle button removed entirely from the bar."
  - "languages.ts rewritten clean (no ElevenLabsLanguage type, no elevenLabsCode column, no helpers). Other consumers untouched — only callers were voice-related."
  - "Per RESEARCH §Test Fixture Stripping Plan: the index.test.tsx getElevenLabsSupportedLanguages mock entry deleted in this commit, not in 02-05."
metrics:
  duration: ~7min
  completed: 2026-05-21
---

# Phase 2 Plan 03: CUT-07 remove ElevenLabs voice Summary

Physically deleted the ElevenLabs voice surface end-to-end (D-19 / D-20 / D-21). Removed `hub/src/web/routes/voice.ts` (197 LOC) + its registration in `hub/src/web/server.ts`; removed `shared/src/voice.ts` (257 LOC) + its `./voice` subpath export from `shared/package.json`; deleted `web/src/realtime/` entire directory (8 files: `RealtimeSession.ts`, `RealtimeVoiceSession.tsx`, `hooks/contextFormatters.ts`, `hooks/voiceHooks.ts`, `index.ts`, `realtimeClientTools.ts`, `types.ts`, `voiceConfig.ts`); deleted `web/src/lib/voice-context.tsx` (87 LOC), `web/src/api/voice.ts` (162 LOC), `web/src/components/VoiceErrorBanner.tsx` (28 LOC); stripped voice surfaces from `SessionChat.tsx` (VoiceProvider, voiceHooks plumbing, useVoiceOptional, RealtimeVoiceSession mount, ~95 LOC), `AssistantChat/ComposerButtons.tsx` (VoiceAssistantIcon, SpeakerIcon, LoadingIcon, StopIcon, voice mic toggle button, UnifiedButton voice branching, ~140 LOC → ~25 LOC), `AssistantChat/HappyComposer.tsx` (voiceStatus/voiceMicMuted/onVoiceToggle/onVoiceMicToggle props + voiceEnabled + ConversationStatus import), `AssistantChat/StatusBar.tsx` (voice connecting priority branch + voiceStatus prop), `App.tsx` (`<VoiceProvider>` wrap + `<VoiceErrorBanner/>` mount + 2 imports); removed entire Voice Assistant settings section + helpers + state from `web/src/routes/settings/index.tsx` (Voice Assistant block JSX, `voiceLanguages` constant, `isVoiceOpen` / `voiceLanguage` / `voiceContainerRef` state, `handleVoiceLanguageChange`, voice closures in click-outside + escape effects, voice imports); deleted `getElevenLabsSupportedLanguages` mock from `index.test.tsx`; rewrote `web/src/lib/languages.ts` to drop the `ElevenLabsLanguage` type + `elevenLabsCode` column + `getElevenLabsCode` / `getElevenLabsCodeFromPreference` / `getElevenLabsSupportedLanguages` helpers; dropped the `@elevenlabs/react` manualChunks rule from `web/vite.config.ts` (L28-30); removed `@elevenlabs/react` dependency from `web/package.json`; removed 18 voice-related i18n keys × 2 locales = 36 lines from `web/src/lib/locales/{en,zh-CN}.ts`.

## Tasks Completed

| Task | Name | Outcome |
|------|------|---------|
| 1 | Delete hub voice route + shared voice + shared package export | ✅ `hub/src/web/routes/voice.ts` + `shared/src/voice.ts` deleted; `server.ts` no longer imports/registers voice route; `shared/package.json` `./voice` subpath gone |
| 2 | Delete web realtime/ + voice-context + api/voice + VoiceErrorBanner; strip voice from SessionChat/AssistantChat/App | ✅ Entire `web/src/realtime/` dir + 3 files + banner deleted; `SessionChat.tsx` voiceHooks plumbing + useVoiceOptional + RealtimeVoiceSession removed; ComposerButtons voice icons + mic toggle button + UnifiedButton voice branches removed; HappyComposer voice props gone; StatusBar voiceStatus gone; App.tsx VoiceProvider/VoiceErrorBanner gone |
| 3 | Strip voice from settings page + i18n + languages helpers + vite config + remove @elevenlabs/react dep; commit | ✅ Voice Assistant section + helpers removed from settings page; index.test.tsx mock entry removed; 18 i18n keys × 2 locales removed; languages.ts rewritten without ElevenLabs; vite manualChunks voice rule dropped; `@elevenlabs/react` removed from web/package.json |

## i18n keys removed (per locale)

18 keys × 2 locales = **36 lines**:

- `composer.voice`
- `voice.connecting`, `voice.active`, `voice.muted`, `voice.error`, `voice.mute`, `voice.unmute`, `voice.end`, `voice.dismiss`
- `voice.error.micPermission`, `voice.error.network`, `voice.error.notInitialized`, `voice.error.startFailed`, `voice.error.notAllowed`, `voice.error.connection`
- `settings.voice.title`, `settings.voice.language`, `settings.voice.autoDetect`

## Settings page Voice Assistant section LOC

| | Before | After |
|---|---|---|
| `web/src/routes/settings/index.tsx` total LOC | 870 | 712 |
| Δ | — | -158 |

## vite manualChunks rule

`web/vite.config.ts` L28-30: removed `if (id.includes('/node_modules/@elevenlabs/react/')) { return 'vendor-voice' }` block. Other chunk rules (`@xterm/`, `@assistant-ui/`, `remark-gfm`, `hast-util-to-jsx-runtime`) preserved.

## `@elevenlabs/react` removal

`web/package.json` L17: `"@elevenlabs/react": "^0.13.0"` removed from `dependencies`. Lockfile regeneration deferred to 02-05 per D-30 commit ordering.

## `shared/src/voice.ts` + `./voice` subpath export

`shared/package.json` `exports` map: `"./voice": "./src/voice.ts"` entry removed. Other subpath exports (`.`, `./messages`, `./modes`, `./schemas`, `./types`) preserved. `shared/src/schemas.ts` verified clean (no voice re-exports — `rg voice shared/src/schemas.ts` returns 0).

## D-31 Per-commit Gate

| Check | Result |
|-------|--------|
| `bun typecheck` (cli + web + hub) | ✅ exit 0 |
| `bun run test` (cli + hub + web + shared + guard) | ✅ 596 tests passed; 0 failed |
| `Grep elevenlabs web/src shared/src hub/src cli/src` (case-insensitive) | ✅ 0 matches |
| `Grep 'voice\.\|composer\.voice\|settings\.voice' web/src/lib/locales/` | ✅ 0 matches |
| `Grep @elevenlabs/react web/package.json` | ✅ 0 matches |
| `Grep elevenLabsCode\|getElevenLabsSupportedLanguages web/src/` | ✅ 0 matches |

The Phase-1 ripgrep guard PATTERN does not yet match `elevenlabs`; PATTERN extension is owned by 02-05 commit #5 per D-29. `rg` is not installed on this host so `check-no-cut-agents.sh` short-circuits (documented Phase-1 behavior).

## Hand-off Note

CUT-07 is now closed. Voice surface is fully gone from hub routes, shared schemas, web realtime stack, composer/status UI, settings UI, i18n, and web deps.

The `xi-api-key` env-var (`ELEVENLABS_API_KEY` / `ELEVENLABS_AGENT_ID`) is no longer read anywhere in code. Any stale settings.json entries become inert per D-32. Phase 2 ripgrep guard PATTERN extension (to catch any new `elevenlabs` reintroduction) remains owned by 02-05 commit #5 per D-29.

`docs/public/schemas/settings.schema.json` may still list voice fields per T-02-03-4 — `accept (medium)` per D-28; schema regen owned by Phase 10/12. 02-05's guard update will whitelist that path.

## Deviations from Plan

None of consequence — plan executed as written. Three notes on Discretion calls:

1. **Single atomic commit covers all three tasks.** Per plan `<output>`: "One commit `feat(phase-02): CUT-07 remove ElevenLabs voice`." Per-task interim commits would break the D-31 per-commit gate (e.g. a Task 1 commit deletes `hub/src/web/routes/voice.ts` but `web/src/components/SessionChat.tsx` still imports from `@/realtime`, breaking the cross-package typecheck). All three tasks land in one commit.
2. **`ElevenLabsLanguage` type removed entirely** rather than kept as orphan — no other code referenced it after the column + helpers were dropped.
3. **No placeholder voice button added.** Per plan Action step 10 (Task 2) + D-20 commentary: "do NOT add placeholder/disabled voice button. UI converges naturally." Composer now renders send-only.

## Self-Check: PASSED

- ✅ `hub/src/web/routes/voice.ts` absent
- ✅ `shared/src/voice.ts` absent
- ✅ `web/src/realtime/` absent
- ✅ `web/src/lib/voice-context.tsx` absent
- ✅ `web/src/api/voice.ts` absent
- ✅ `web/src/components/VoiceErrorBanner.tsx` absent
- ✅ `bun typecheck` exit 0
- ✅ `bun run test` exit 0 (596 / 596)
- ✅ `Grep elevenlabs web/src shared/src hub/src cli/src` returns 0 matches
- ✅ `Grep @elevenlabs/react web/package.json` returns 0 matches
- ✅ `Grep voice\. composer.voice settings.voice` returns 0 matches in `web/src/lib/locales/`

## Threat Flags

None. This plan deletes attack surface (the ElevenLabs API token proxy route, the dynamic realtime WebSocket session, the third-party SDK script); no new endpoints, auth paths, file access patterns, or trust-boundary schema changes were introduced. T-02-03-1 (stale `xi-api-key` env-var) is documented in PLAN.md as `mitigate (low)` — code stops reading the secret; commit #5 (02-05) extends the ripgrep guard PATTERN to catch any reintroduction.
