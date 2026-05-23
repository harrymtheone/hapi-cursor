---
phase: 02-cut-external-integration-channels
reviewed: 2026-05-21T09:45:00Z
depth: standard
scope: "Source-code changes in commits 74e32fb (CUT-06 hub), 7e46a48 (CUT-06 web), a299805 (CUT-07 voice), 4f3cce9 (CUT-08 ServerChan), 53e93cf (final cleanup). Adjacent surfaces (READMEs, middleware, JSON schema, docs) cross-checked for stale references."
files_reviewed: 64
files_reviewed_list:
  - cli/src/commands/notify.ts
  - cli/src/terminal/TerminalManager.ts
  - hub/package.json
  - hub/src/config/serverSettings.ts
  - hub/src/config/settings.ts
  - hub/src/configuration.ts
  - hub/src/index.ts
  - hub/src/sync/messageService.test.ts
  - hub/src/sync/messageService.ts
  - hub/src/sync/rpcGateway.ts
  - hub/src/sync/syncEngine.ts
  - hub/src/web/routes/auth.ts
  - hub/src/web/routes/messages.ts
  - hub/src/web/server.ts
  - scripts/check-no-cut-agents.sh
  - shared/package.json
  - web/package.json
  - web/src/App.tsx
  - web/src/api/client.ts
  - web/src/components/AssistantChat/ComposerButtons.tsx
  - web/src/components/AssistantChat/HappyComposer.tsx
  - web/src/components/AssistantChat/StatusBar.tsx
  - web/src/components/InstallPrompt.tsx
  - web/src/components/LoginPrompt.tsx
  - web/src/components/SessionChat.tsx
  - web/src/components/SessionHeader.tsx
  - web/src/hooks/useAuth.ts
  - web/src/hooks/useAuthSource.ts
  - web/src/hooks/usePlatform.ts
  - web/src/hooks/useTheme.ts
  - web/src/hooks/useViewportHeight.ts
  - web/src/index.css
  - web/src/lib/languages.ts
  - web/src/lib/locales/en.ts
  - web/src/lib/locales/zh-CN.ts
  - web/src/main.tsx
  - web/src/router.tsx
  - web/src/routes/settings/index.test.tsx
  - web/src/routes/settings/index.tsx
  - web/src/sw.ts
  - web/vite.config.ts
adjacent_surfaces_checked:
  - hub/src/web/middleware/auth.ts
  - hub/README.md
  - cli/README.md
  - docs/guide/voice-assistant.md
  - docs/guide/faq.md
  - docs/guide/installation.md
  - docs/public/schemas/settings.schema.json
findings:
  critical: 0
  high: 3
  medium: 4
  low: 4
  info: 1
  total: 12
status: issues
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-21T09:45:00Z
**Depth:** standard
**Scope:** Source-code changes across the five Phase 02 commits — Telegram bot (hub + web), ElevenLabs voice, ServerChan push, plus final CLI/script cleanup. Adversarial pass: also cross-checked auth middleware whitelist, READMEs, JSON schema, and the web `lib/` for orphans the per-plan grep gates would not catch.

**Status:** issues_found (12 findings; 3 High, 4 Medium, 4 Low, 1 Info; no Critical correctness or security defects)

## Summary

The phase is mechanically clean — `bun typecheck` and the full test suite pass per each plan's per-commit gate, and the user-facing single-source `/api/auth` contract is end-to-end consistent. Most "known orphans" are already documented in the respective plan SUMMARYs as `minimum-diff` / `accept` decisions and are catalogued below as Low/Info.

Three **High-severity** dead-code remnants slipped through the per-plan grep gates because they live just outside each plan's declared scope:

1. `web/src/api/client.ts` retains the orphan `fetchVoiceToken()` ApiClient method targeting the deleted `/api/voice/token` route. Plan 02-03 did not list `web/src/api/client.ts` in its modified-file set.
2. `hub/src/web/middleware/auth.ts:20` still whitelists `/api/bind` for auth bypass — the route was deleted in 02-01 but its bypass entry survives. Harmless today (no route registered), but it is exactly the kind of stale whitelist that becomes a confused-deputy vulnerability if the path is ever re-registered.
3. `web/src/lib/languages.ts` (86 LOC: `Language` type, `LANGUAGES` constant, `getLanguageDisplayName`, `findLanguageByCode`) is entirely dead — the file's only consumer was the deleted Voice Assistant settings section. Plan 02-03's "rewrite languages.ts to drop ElevenLabs columns" presumed surviving consumers; there are none.

Four **Medium** findings concern documentation surfaces that still advertise the removed features (Voice Assistant guide, `hub/README.md` API list, `cli/README.md`, and the JSON Schema), plus the cli/terminal env redaction set that was narrowed for `TELEGRAM_BOT_TOKEN` but never expanded to cover the new keyword set.

The remaining Low + Info items are surface cleanups the plans explicitly chose to defer (orphan i18n keys, `--tg-theme-*` CSS fallbacks, degenerate `AuthSource` union, vestigial `auth.ts` user-shape, dead `applyPlatform()` function).

No correctness, data-loss, or authentication-bypass defects were found in the changed code paths. The `/api/auth` flow is sound; auth schema convergence (D-24) is intact.

## High

### HI-01: Orphan `ApiClient.fetchVoiceToken()` method targets deleted `/api/voice/token` route

**File:** `web/src/api/client.ts:508-518`

**Issue:** Plan 02-03 deleted `hub/src/web/routes/voice.ts` (the `/api/voice/token` endpoint) plus the entire `web/src/realtime/` consumer tree and `web/src/api/voice.ts`. The ApiClient method that fronts the hub voice endpoint, however, survived:

```ts
async fetchVoiceToken(options?: { customAgentId?: string; customApiKey?: string }): Promise<{
    allowed: boolean
    token?: string
    agentId?: string
    error?: string
}> {
    return await this.request('/api/voice/token', {
        method: 'POST',
        body: JSON.stringify(options || {})
    })
}
```

`Grep fetchVoiceToken` across the repo returns exactly one hit (the definition above) — zero callers anywhere in `web/src/`. The method ships in the production bundle, increases the public API surface of `ApiClient`, and would 404 with an unhelpful generic error if invoked (e.g. by a stale PWA shell). It is structurally identical to the now-removed `bind()` method that plan 02-02 correctly deleted; this one was simply missed because plan 02-03's modified-file set did not include `web/src/api/client.ts`.

**Fix:** Delete the method entirely. Verify with `Grep fetchVoiceToken web/src/` → 0 matches after fix. No other consumers to update.

### HI-02: Stale `/api/bind` whitelist in auth middleware (security-adjacent dead code)

**File:** `hub/src/web/middleware/auth.ts:20`

**Issue:** The auth middleware still bypasses authentication for the deleted `/api/bind` endpoint:

```ts
if (path === '/api/auth' || path === '/api/bind') {
    await next()
    return
}
```

Plan 02-01 deleted `hub/src/web/routes/bind.ts` and removed the route registration from `hub/src/web/server.ts`. With no handler registered, a request to `/api/bind` now bypasses auth and falls through to a 404 — currently harmless. The defect is forward-looking:

- A future contributor who registers `/api/bind` (or anything matching the literal `/api/bind`) for any unrelated purpose will inherit unauthenticated access by accident.
- The whitelist mirrors a deleted trust boundary; it is exactly the class of "stale ACL" finding security audits flag.
- Plan 02-01's grep gates checked `Grep telegram hub/src/socket/` and the `telegram*` keyword set; the literal path `'/api/bind'` does not match that regex, so the cleanup slipped through.

This was missed by every per-plan automated check.

**Fix:** Drop the `|| path === '/api/bind'` clause:

```ts
if (path === '/api/auth') {
    await next()
    return
}
```

Verify with `rg -n "/api/bind" hub/src` → 0 matches after fix.

### HI-03: `web/src/lib/languages.ts` is now an entirely dead module

**File:** `web/src/lib/languages.ts` (whole file, 86 LOC)

**Issue:** Plan 02-03 SUMMARY records that `languages.ts` was "rewritten clean (no ElevenLabsLanguage type, no elevenLabsCode column, no helpers). Other consumers untouched — only callers were voice-related." This last claim is incorrect: the only callers were voice-related, and they have been deleted. `Grep "from.*languages|@/lib/languages"` across `web/src/` returns **zero** import statements anywhere in the codebase. The exported symbols (`Language`, `LANGUAGES`, `getLanguageDisplayName`, `findLanguageByCode`) have no consumers.

Knock-on:
- The test file `web/src/routes/settings/index.test.tsx` correctly removed its `vi.mock('@/lib/languages', …)` block in the 02-03 commit, but the source file it was mocking is now itself unimported — the mock removal was a half-cleanup.
- The 47-entry `LANGUAGES` constant + helpers ship in every production bundle as ~3 KB of unused JS.

**Fix:** Delete `web/src/lib/languages.ts` entirely. Verify with:

```bash
rg -n "from.*['\"]@/lib/languages['\"]|getLanguageDisplayName|findLanguageByCode|LANGUAGES\b" web/src/
```

→ 0 matches after deletion. Re-run `bun typecheck` to confirm no surprise residual references.

## Medium

### ME-01: End-user Voice Assistant docs survive feature deletion

**Files:**
- `docs/guide/voice-assistant.md` (entire file)
- `docs/guide/faq.md:106` ("Set `ELEVENLABS_API_KEY`, open a session… See [Voice Assistant](./voice-assistant.md).")
- `docs/guide/installation.md:585` ("See [Voice Assistant](./voice-assistant.md) for usage details.")
- `docs/.vitepress/config.ts:26` (`{ text: 'Voice Assistant', link: '/guide/voice-assistant' }`)
- `README.md:41` (`- [Voice Assistant](docs/guide/voice-assistant.md)`)

**Issue:** Plan 02-03 SUMMARY's `Hand-off Note` only carved out `docs/public/schemas/settings.schema.json` as deferred to Phase 10/12. The user-facing Voice Assistant **documentation page** — including the FAQ entry that instructs users to set `ELEVENLABS_API_KEY` and click the (no-longer-rendered) mic button — was not in scope for either plan 02-03 or plan 02-05. The result is a 4-link cross-reference network pointing at a guide for a feature that no longer ships. This is more harmful than a stale TODO comment: it actively misleads users into configuring an env var that nothing reads.

Strictly outside "review source files" scope, but the most user-visible dead reference in the changeset. The plans' grep gates explicitly whitelisted `docs/**`; nothing automated would catch it.

**Fix:** Either (a) delete `docs/guide/voice-assistant.md`, remove the four backlinks, and remove the VitePress nav entry; or (b) rewrite the page to a "Removed in vX.Y" stub. Option (a) is cleaner for a `cut-` phase. The FAQ entry at `docs/guide/faq.md:106` and installation note at `docs/guide/installation.md:585` should be removed entirely, not redirected.

### ME-02: `hub/README.md` advertises three deleted endpoints + Telegram auth path

**File:** `hub/README.md:76-77, 128`

**Issue:** The hub README still documents API endpoints that were physically removed:

```md
- `POST /api/auth` - Get JWT token (Telegram initData or `CLI_API_TOKEN[:namespace]`).
- `POST /api/bind` - Bind a Telegram account using initData + `CLI_API_TOKEN:<namespace>`.
…
- `POST /api/voice/token` - Get ElevenLabs conversation token.
```

`/api/bind` and `/api/voice/token` no longer have route handlers; `/api/auth` no longer accepts an `initData` branch. The README is the canonical doc for the hub HTTP surface and is the first artifact a new contributor or third-party integrator will read.

**Fix:**
1. Drop the `/api/bind` line entirely.
2. Drop the `/api/voice/token` line entirely.
3. Reword `/api/auth` description: `Get JWT token. Body: { accessToken: "<CLI_API_TOKEN[:namespace]>" }.`

### ME-03: `cli/README.md` advertises Telegram Mini App

**File:** `cli/README.md:17`

**Issue:** Line 17 of the CLI README reads:

```md
4. Use the web app or Telegram Mini App to monitor and control.
```

The Telegram Mini App platform was physically removed in plans 02-01 + 02-02. This README is the first artifact users hit when running `--help` URLs or browsing the CLI package. It instructs them to use a feature that does not exist.

**Fix:** Replace the line with:

```md
4. Use the web app to monitor and control.
```

### ME-04: `SENSITIVE_ENV_KEYS` does not redact ElevenLabs / ServerChan secrets in terminal env

**File:** `cli/src/terminal/TerminalManager.ts:30-38`

**Issue:** Plan 02-05 correctly removed `TELEGRAM_BOT_TOKEN` from the `SENSITIVE_ENV_KEYS` redaction set. But the set never included `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, or `SERVERCHAN_SENDKEY`. Now that the hub no longer **reads** those env vars (plans 02-03 / 02-04 / threat T-02-03-1 + T-02-04-1), any user who still has them exported in their shell will pass them through to spawned terminal subprocesses, where they can be echoed into the remote-controlled terminal stream (`cat /proc/self/environ` is readable by any agent the user grants terminal access to). The hub stopped reading the secret but did not start **hiding** it.

```ts
const SENSITIVE_ENV_KEYS = new Set([
    'CLI_API_TOKEN',
    'HAPI_API_URL',
    'HAPI_HTTP_MCP_URL',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY'
])
```

T-02-05-1 documented this as `accept (low)` for the Telegram case under "single-user Tailscale topology". The same threat model applies (and is strictly worse if anything, because ElevenLabs/ServerChan keys are billing-attached third-party API credentials), but the disposition was never explicitly extended to the new key families.

**Fix:** Add the three legacy keys to `SENSITIVE_ENV_KEYS` as a defense-in-depth safety net:

```ts
const SENSITIVE_ENV_KEYS = new Set([
    'CLI_API_TOKEN',
    'HAPI_API_URL',
    'HAPI_HTTP_MCP_URL',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    // Legacy keys — hub no longer reads them (Phase 02) but users may still
    // have them exported; keep redacting from remote-controlled terminal env.
    'TELEGRAM_BOT_TOKEN',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_AGENT_ID',
    'SERVERCHAN_SENDKEY'
])
```

If the policy intent really is "stop redacting because the feature is gone", document that decision in a comment so it doesn't read as an oversight.

## Low

### LO-01: Orphan i18n keys `login.error.bindingUnavailable` + `login.error.bindFailed`

**Files:** `web/src/lib/locales/en.ts:19,21`, `web/src/lib/locales/zh-CN.ts:19,21`

**Issue:** `LoginPrompt.tsx` was rewritten access-token-only and has no `mode="bind"` branch. `Grep bindingUnavailable web/src` returns zero callers outside the two locale files. Acknowledged in plan 02-02 SUMMARY as "leaving them is acceptable per minimum-diff", but they remain dead ballast in the shipped bundle (twice — once per locale).

**Fix:** Delete L19 and L21 from each locale file (4 lines total).

### LO-02: `--tg-theme-*` CSS variable fallbacks throughout `index.css`

**File:** `web/src/index.css:6-14, 86-94` (16 occurrences total)

**Issue:** Every `--app-*` color token still resolves via `var(--tg-theme-*-color, <hardcoded>)`. The `--tg-theme-*` vars were exclusively set by the Telegram WebApp SDK, which is now physically removed (`useTelegram.ts` deleted, `<script src="https://telegram.org/js/telegram-web-app.js">` injection deleted from `main.tsx`). Nothing in the live codebase can ever set them; every read falls through to the hardcoded second argument. Acknowledged in plan 02-02 SUMMARY: "they don't match the D-27 regex `telegram|tgWebApp|isTelegramApp`; leaving them is minimum-diff."

The risk is purely cosmetic / readability — a future contributor will be misled into thinking the theme is themable via these vars when it is not.

**Fix:** Collapse each declaration to the literal fallback, e.g.:

```css
/* before */
--app-bg: var(--tg-theme-bg-color, #ffffff);
/* after */
--app-bg: #ffffff;
```

across all 16 sites. Mechanical rewrite; no behavioral change.

### LO-03: `AuthSource` is a degenerate single-variant "discriminated" union

**File:** `web/src/hooks/useAuth.ts:5`

**Issue:**

```ts
export type AuthSource = { type: 'accessToken'; token: string }
```

The `type` discriminator was meaningful when the union also had `{ type: 'telegram'; initData }`. Now it is a single object literal with a redundant tag field. Plan 02-02 SUMMARY decision #3 documents this as deliberate ("avoided changing the `AuthSource` import signature consumers may downstream-extend"), but `Grep "AuthSource"` shows the only consumers are `useAuthSource.ts` (sets it) and `useAuth.ts` itself (reads `.token`) — both within the web package. There is no downstream extension to preserve.

Code-smell rather than defect: future readers will reach for `switch (source.type)` exhaustiveness checks that have nothing to dispatch on.

**Fix (optional):** Either collapse to `export type AuthSource = { token: string }` and update the two consumer sites, or add a `// kept for forward-extensibility` comment.

### LO-04: Unused `applyPlatform()` function in `useTheme.ts`

**File:** `web/src/hooks/useTheme.ts:100-104`

**Issue:** The module-local function `applyPlatform()` is defined but never called anywhere in the repo:

```ts
function applyPlatform(): void {
    if (isIOS()) {
        document.documentElement.classList.add('ios')
    }
}
```

`Grep applyPlatform` across the repo returns exactly one hit (the definition above). This looks like a remnant of the Telegram platform-detection code path that previously called both `applyTheme(...)` and `applyPlatform()` at module load — only the `applyTheme(...)` call survived the 02-02 strip on line 111. As a result the `ios` body class is now never applied, which may also be a silent behavioral regression for iOS-specific CSS rules (worth verifying whether anything in `index.css` keys off `html.ios`).

**Fix:** Either delete `applyPlatform` if the `ios` class is unused, or invoke it at module load alongside `applyTheme(currentScheme)` on line 111:

```ts
applyTheme(currentScheme)
applyPlatform()
```

`Grep "\.ios\b|html\.ios|\.ios " web/src` (or in the CSS) will tell which side of the fix is correct.

## Info

### IN-01: `auth.ts` returns hardcoded user shape from Telegram bind era

**File:** `hub/src/web/routes/auth.ts:39-47`

**Issue:** The `/api/auth` response still returns a user object hand-shaped for the old Telegram path:

```ts
return c.json({
    token,
    user: {
        id: userId,
        username: undefined,
        firstName: 'Web User',
        lastName: undefined
    }
})
```

`firstName`, `lastName`, `username` were meaningful when the user came from a Telegram bind handshake; in the access-token-only world they are vestigial — `firstName: 'Web User'` is a string literal pretending to be a name. The web `LoginPrompt`/`useAuth` no longer renders any of these fields anywhere I could find. The `AuthResponse['user']` type contract probably needs a follow-up narrowing pass, but this is out of scope for "review the changed files" — flagging as Info rather than Low because Phase 02's contract was "delete bind, keep auth contract stable for now".

**Fix (optional, follow-up phase):** Narrow `AuthResponse['user']` to `{ id }` (or whatever fields the web actually consumes) and drop the placeholder strings. Verify via `Grep "user\.(firstName|lastName|username)" web/src/`.

---

## Cross-references checked but clean

For traceability, the following adversarial scans came up empty (no findings):

- `Grep -i "telegram|tgWebApp|isTelegramApp|HappyBot|grammy|telegramInitData" hub/src web/src cli/src shared/src` — clean (only `tg-theme-*` CSS-var fallbacks per LO-02, and `--app-viewport-height` CSS var which is legitimately used by `useViewportHeight.ts`)
- `Grep -i "elevenlabs|xi-api-key|ELEVENLABS|voice-context|VoiceProvider|VoiceErrorBanner|realtime/|RealtimeVoice" hub/src web/src cli/src shared/src` — clean
- `Grep -i "serverchan|SERVERCHAN|serverChanSendKey|serverChanNotification|ServerChanChannel|sctapi\.ftqq" hub/src web/src cli/src shared/src` — clean
- `Grep -n "sentFrom" hub/src cli/src web/src` — `sentFrom` literal union correctly narrowed to `'webapp'` on hub HTTP send path; CLI socket path is independent (per protocol) and uses its own `'cli'` value
- `hub/src/sync/syncEngine.ts` JSDoc header + `sentFrom` literal — no `'telegram-bot'` residual
- `hub/src/socket/server.ts` — no telegram refs
- `hub/src/index.ts` — `notificationChannels` is a single-element array containing only `PushNotificationChannel`
- `bun.lock` — no `grammy`, `@grammyjs/types`, or `@elevenlabs/react` entries (per 02-05 SUMMARY confirmation)
- `scripts/check-no-cut-agents.sh` — PATTERN correctly extended to `\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b`; dead `--glob '!shared/src/voice.ts'` whitelist entry removed

The phase delivered exactly what the plans promised. The three High-severity findings above are not regressions per se — they are scope-edge cleanups that the per-plan grep gates were not designed to catch. The Medium findings are documentation drift on surfaces that the plans explicitly exempted. None block the phase from being declared closed.

---

_Reviewed: 2026-05-21T09:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard, adversarial pass_
