---
phase: 02-cut-external-integration-channels
plan: 02
subsystem: web
tags: [cut, deletion, telegram, auth, platform]
requires: [hub-side-telegram-free]
provides:
  - web-side-telegram-free
  - auth-source-single-variant
  - platform-no-telegram
affects:
  - web/src/hooks/useTelegram.ts
  - web/src/hooks/useAuthSource.ts
  - web/src/hooks/useAuth.ts
  - web/src/hooks/usePlatform.ts
  - web/src/hooks/useTheme.ts
  - web/src/hooks/useViewportHeight.ts
  - web/src/main.tsx
  - web/src/router.tsx
  - web/src/sw.ts
  - web/src/App.tsx
  - web/src/index.css
  - web/src/components/SessionHeader.tsx
  - web/src/components/InstallPrompt.tsx
  - web/src/components/LoginPrompt.tsx
  - web/src/api/client.ts
  - web/src/lib/locales/en.ts
  - web/src/lib/locales/zh-CN.ts
tech-stack:
  added: []
  removed: [telegram-web-app-sdk]
  patterns:
    - single-variant AuthSource (no discriminated union)
    - browser-only Platform shape (isTouch + haptic via Vibration API)
final_commit: 7e46a48
key-files:
  created: []
  deleted:
    - web/src/hooks/useTelegram.ts
  modified:
    - web/src/App.tsx
    - web/src/api/client.ts
    - web/src/components/InstallPrompt.tsx
    - web/src/components/LoginPrompt.tsx
    - web/src/components/SessionHeader.tsx
    - web/src/hooks/useAuth.ts
    - web/src/hooks/useAuthSource.ts
    - web/src/hooks/usePlatform.ts
    - web/src/hooks/useTheme.ts
    - web/src/hooks/useViewportHeight.ts
    - web/src/index.css
    - web/src/lib/locales/en.ts
    - web/src/lib/locales/zh-CN.ts
    - web/src/main.tsx
    - web/src/router.tsx
    - web/src/sw.ts
decisions:
  - "Single atomic commit (D-30 commit #2 contract). Per-task interim commits would leave intermediate broken typecheck states (e.g. App.tsx still calls bind() after useAuth.ts removed bind)."
  - "sw.ts: mechanical strip chosen over rewrite (RESEARCH Open Q #2). Telegram ref was scoped to a single CacheFirst registerRoute(/^https:\\/\\/telegram\\.org\\/.*/) block caching the SDK CDN script — does NOT touch start_url, scope, or precaching manifest, so deleting the block is safe; PWA install behavior unchanged."
  - "AuthSource collapsed to single-variant object { type: 'accessToken'; token } rather than deleted, to preserve the discriminator pattern with minimum diff at consumer sites (only useAuth.ts and useAuthSource.ts internals; App.tsx still narrows on .type === 'accessToken' indirectly via useAuth's contract)."
  - "usePlatform haptic kept as Vibration-API stub (no-op when Vibration API absent). Removing it would have churned 10+ consumer sites for no semantic gain."
  - "Router back-button gates (NewSessionPage / BrowsePage L445/L500): UNGATED rather than deleted. Both routes were always reachable from browser/PWA entry; only the back-button render was telegram-conditional. Now always renders."
  - "LoginPrompt rewritten end-to-end (no bind mode). The orphaned i18n keys login.error.bindingUnavailable / login.error.bindFailed remain — they don't match the D-27 regex 'telegram|tgWebApp|isTelegramApp', so leaving them is acceptable per minimum-diff."
metrics:
  duration: ~6min
  completed: 2026-05-21
---

# Phase 2 Plan 02: CUT-06 remove Telegram WebApp platform (web-side) Summary

Physically purged Telegram WebApp platform branch from `web/` end-to-end (D-16 / D-17 / D-18). Deleted `web/src/hooks/useTelegram.ts` (the SDK detection + dynamic-script-load module, 144 LOC). Collapsed `AuthSource` discriminated union to single accessToken variant. Narrowed `Platform` shape (dropped `isTelegram` field). Stripped telegram branches from `useAuth` (no more `bind()` / `isNotBoundError` / `getAuthPayload` / `setNeedsBinding`), `useTheme` (no `tg.colorScheme` / `themeChanged` listener), `useViewportHeight` (no `isTelegramApp()` early return), `main.tsx` (no SDK script-tag injection / `dataset.telegramApp` / `createMemoryHistory` switch / `tgWebAppData` start_param), `router.tsx` (no `isTelegramApp()` back-button gates), `sw.ts` (no `telegram.org` CDN cache route), `App.tsx` (no `tg.ready/expand` / `BackButton` bridge / push-prompt guard / telegram error UI / bind-mode LoginPrompt branch), `SessionHeader.tsx` (no isTelegramApp early-return), `InstallPrompt.tsx` (no `!isTelegram` guards), `api/client.ts` (deleted `bind()` method, narrowed `authenticate()` body type to `{ accessToken }`); rewrote `LoginPrompt.tsx` access-token-only (no bind mode); removed three `login.bind.*` i18n keys per locale; removed `[data-telegram-app]` CSS rule blocks.

## Tasks Completed

| Task | Name | Outcome |
|------|------|---------|
| 1 | Collapse hook layer | ✅ useTelegram.ts deleted; useAuthSource simplified (no telegram polling); useAuth.bind/isNotBoundError/getAuthPayload/needsBinding removed; usePlatform.isTelegram dropped, haptic uses Vibration API only; useTheme telegram branches gone; useViewportHeight unconditional |
| 2 | Strip Telegram from app entry + components + ApiClient + i18n + CSS | ✅ main.tsx single browser history; router.tsx back-buttons ungated; sw.ts telegram.org route deleted; App.tsx 5 telegram surfaces removed; SessionHeader/InstallPrompt cleaned; LoginPrompt rewritten access-token-only; ApiClient.bind() deleted + authenticate() narrowed; 6 locale entries removed; CSS [data-telegram-app] rules removed |

## Key Code Diffs

### `AuthSource` union → single variant (D-18)

**Before (`useAuth.ts`):**
```ts
export type AuthSource =
    | { type: 'telegram'; initData: string }
    | { type: 'accessToken'; token: string }
```

**After:**
```ts
export type AuthSource = { type: 'accessToken'; token: string }
```

Knock-on: `getAuthPayload()` deleted; `client.authenticate({ accessToken: source.token })` called directly. `isNotBoundError` deleted. `bind()` method (22 LOC) deleted. `needsBinding` state and consumer branch deleted from `App.tsx`.

### `Platform` shape narrowing (D-17)

**Before (`usePlatform.ts`):**
```ts
export type Platform = {
    isTelegram: boolean
    isTouch: boolean
    haptic: PlatformHaptic
}
```

**After:**
```ts
export type Platform = {
    isTouch: boolean
    haptic: PlatformHaptic
}
```

`haptic.impact/notification/selection` simplified to single `vibrate()` call (no `tg.HapticFeedback` branch). Only consumer of `isTelegram` was `InstallPrompt.tsx`; updated to drop the destructure and the `!isTelegram` filter on `showFloatingPrompt`.

### `ApiClient.authenticate()` body type narrowing (D-24 web knock-on)

**Before:**
```ts
async authenticate(auth: { initData: string } | { accessToken: string }): Promise<AuthResponse>
async bind(auth: { initData: string; accessToken: string }): Promise<AuthResponse>
```

**After:**
```ts
async authenticate(auth: { accessToken: string }): Promise<AuthResponse>
```

`bind()` method removed entirely. The hub side (`/api/auth` zod schema) was already collapsed to `z.object({ accessToken })` in 02-01; the web client now matches.

## sw.ts disposition (RESEARCH Open Q #2)

**Decision: mechanical strip.**

The only telegram ref in `web/src/sw.ts` was a single `registerRoute(/^https:\/\/telegram\.org\/.*/)` block that cached the Telegram WebApp SDK CDN script with a `CacheFirst` strategy. It does NOT affect:

- `start_url` (set in `vite.config.*` PWA manifest, not in `sw.ts`)
- `scope` (default scope, not telegram-tagged)
- `precacheAndRoute(self.__WB_MANIFEST)` (Workbox-injected manifest, no telegram entries since `useTelegram.ts` is deleted from this build)
- Push notification or notificationclick handlers (untouched)

A rewrite would have been needed if telegram were affecting `start_url` or scope; mechanical strip is sufficient for cache-key-only impact.

## i18n keys removed

Three keys × two locales = **6 entries**:
- `login.bind.title` (en: "Bind Telegram", zh-CN: "绑定 Telegram")
- `login.bind.submit` (en: "Bind", zh-CN: "绑定")
- `login.bind.submitting` (en: "Binding…", zh-CN: "绑定中…")

`login.error.bindingUnavailable` and `login.error.bindFailed` remain (orphaned but D-27-regex-clean — they don't match `telegram|tgWebApp|isTelegramApp`). Acceptable per minimum-diff; will be cleaned up incidentally if any future plan touches LoginPrompt error surface.

## CSS rules removed

| Range (before) | Content | Disposition |
|---|---|---|
| L85 | `/* Primary colors - override fallbacks for non-Telegram browsers */` | Rewritten → `/* Primary colors - dark mode fallbacks */` |
| L207 | `height: var(--tg-viewport-stable-height, var(--app-viewport-height, 100dvh));` | Deleted (var was only ever set by Telegram SDK) |
| L213-216 | `html[data-telegram-app="true"], html[data-telegram-app="true"] body { overflow: hidden }` | Deleted entirely |
| L218-222 | `html:not([data-telegram-app="true"]), html:not([data-telegram-app="true"]) body { overflow-x: hidden; overflow-y: auto }` | Promoted to unconditional `html, body` rule (merged into base block) |

After-state: zero `data-telegram-app` references in `web/src/index.css`. The `--tg-theme-*` CSS var fallbacks (`var(--tg-theme-bg-color, #fff)` etc.) remain — they are CSS-var fallbacks the Telegram SDK *used to* set but are inert without it (always falls through to the second arg). They don't match the D-27 regex (`tg-theme` ≠ `telegram|tgWebApp|isTelegramApp`); leaving them is minimum-diff.

## D-31 Per-commit Gate

| Check | Result |
|-------|--------|
| `bun typecheck` (cli + web + hub) | ✅ exit 0 |
| `bun run test` (cli + hub + web + shared + guard) | ✅ 596 tests passed; 0 failed |
| `rg -ni 'telegram\|tgWebApp\|isTelegramApp' web/src/` (Grep tool) | ✅ 0 matches |
| `git log -1 --format=%s` | ✅ `feat(phase-02): CUT-06 remove Telegram WebApp platform (web-side)` |

Final commit hash: `7e46a48`. 17 files changed, +119 / -597.

## Hand-off Note

CUT-06 is now closed across both hub (02-01) and web (02-02). The `/api/auth` HTTP contract is end-to-end single-source: web sends `{ accessToken }`, hub validates `z.object({ accessToken })`. `ApiClient.bind()` and the `LoginPrompt mode="bind"` UI are gone — only the access-token form survives.

CLI residuals (`cli/src/terminal/TerminalManager.ts` `'TELEGRAM_BOT_TOKEN'` in `SENSITIVE_ENV_KEYS`; `cli/src/commands/notify.ts` "Use Telegram notifications…" string) and the Phase-1 ripgrep guard PATTERN extension remain — owned by 02-05 commit #5 per D-33.

## Deviations from Plan

None of consequence — plan executed as written. Three documented discretionary calls (all explicitly anticipated by the plan as "Discretion: …"):

1. **`useAuthSource.ts` kept as a hook (not deleted)** — plan said "either keep it as `() => ({ type: 'access-token' as const })` OR delete the file"; kept it because `App.tsx` already destructures `{ authSource, isLoading, setAccessToken }` from it and inlining would have churned `App.tsx` more than the surrounding hook. Minimum diff.
2. **`AuthSource` kept as a single-variant object (not collapsed to a literal)** — plan permitted either; preserving the `{ type: 'accessToken'; token }` shape avoided changing the `AuthSource` import signature consumers may downstream-extend.
3. **`usePlatform.haptic` kept (not removed)** — verified via Grep that 11+ consumers (`SessionChat`, `SessionList`, `NewSession`, `HappyComposer`, `useCopyToClipboard`, multiple `ToolCard/*Footer.tsx`, `useSendMessage`, etc.) use `haptic`. Removing it would have churned all of them; the plan explicitly allowed "Keep haptic interface as a stub if consumer expects it (no-op if no Vibration API)."

## Self-Check: PASSED

- ✅ `web/src/hooks/useTelegram.ts` absent
- ✅ Commit `7e46a48` exists in `git log --oneline -3`
- ✅ `bun typecheck` exit 0
- ✅ `bun run test` exit 0 (596 / 596)
- ✅ `Grep telegram|tgWebApp|isTelegramApp web/src/` returns 0 matches
- ✅ `Grep login\.bind web/src/lib/locales/` returns 0 matches
- ✅ `Grep data-telegram-app web/src/index.css` returns 0 matches
- ✅ `Grep \\bbind\\b web/src/api/client.ts` returns 0 matches

## Threat Flags

None. This plan deletes attack surface (the Telegram HMAC-validation entry path, the `/api/bind` endpoint client, the dynamic external-CDN script load); no new endpoints, auth paths, or trust-boundary schema changes were introduced. T-02-02-1 (cached-PWA `{ initData }` send post-deploy) is documented in PLAN.md as `accept (medium)` per D-25; this commit does not change that disposition.
