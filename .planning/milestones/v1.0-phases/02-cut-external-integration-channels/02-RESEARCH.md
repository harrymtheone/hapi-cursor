# Phase 2: Cut external integration channels — Research

**Researched:** 2026-05-21
**Domain:** Pure-deletion refactor (Telegram bot, ElevenLabs voice route, ServerChan push) across `hub/`, `web/`, `shared/`, plus crosscut in `cli/`
**Confidence:** HIGH (all findings verified by `Grep` + `Read` of the working tree at HEAD)

## Summary

Phase 2 is a no-new-library, pure-deletion refactor sitting directly on top of Phase 1's
infrastructure (commit-per-requirement + ripgrep guard script + per-commit
typecheck+test gate). Every decision is already locked in `02-CONTEXT.md`; this research
verifies the file-level inventory the planner needs, confirms five CONTEXT hypotheses
(D-19, D-22, D-24, D-26, D-32) against the working tree, enumerates concrete settings
fields / i18n keys / locale lines / consumer files / line counts, and maps the existing
Phase 1 guard script (`scripts/check-no-cut-agents.sh`) to the exact delta the cleanup
commit (#5) must land.

**Primary recommendation:** Execute the 5-commit sequence from CONTEXT D-30 verbatim.
The only research-surfaced adjustment is to commit #5: **drop the planned
`notificationHub.test.ts` and `messageService.test.ts` fixture-stripping work** —
verification shows `notificationHub.test.ts` already uses a generic `StubChannel` (no
telegram fixtures) and `messageService.test.ts` only contains one comment line
mentioning "Telegram bot" as caller documentation. Both files survive D-31 typecheck/test
without modification; commit #5's actual surface area is smaller than CONTEXT estimated.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Inherited from Phase 1 (do not re-question):** D-01 minimal-cut posture, D-05~D-08
test-handling strategy, D-11~D-13 ripgrep zero-tolerance + guard script, D-14
commit-per-requirement, D-15 per-commit typecheck+test gate, "No backward compatibility"
principle.

**Phase 2 new decisions:**

- **D-16:** Strip Telegram WebApp platform branch end-to-end + collapse `usePlatform`.
  Delete all `useTelegram.ts` / `useAuthSource.ts` telegram source / `router.tsx` /
  `main.tsx` / `sw.ts` WebApp entry + SDK init. Delete Telegram-specific CSS
  (`index.css` `telegram-webapp` class).
- **D-17:** Keep `usePlatform` abstraction. Narrow union to `'pwa' | 'browser'`. Strip
  telegram branches from `useTheme` / `useViewportHeight` / `InstallPrompt` /
  `SessionHeader`. Keep only pwa/browser behaviors.
- **D-18:** Collapse `useAuthSource.ts` to single source = access-token. No more source
  switching.
- **D-19:** Delete entire `web/src/realtime/` directory. Grep confirms all consumers
  serve voice; no non-voice usage exists.
- **D-20:** Strip voice button + status indicator from consumers. Remove voice mic
  button from `AssistantChat/ComposerButtons.tsx`; remove recording status from
  `StatusBar.tsx`; remove voice input mode from `HappyComposer.tsx`; remove voice
  provider from `SessionChat.tsx`. Keep composer/chat body.
- **D-21:** Hub side: delete `hub/src/web/routes/voice.ts` + its registration in
  `hub/src/web/server.ts`. Shared side: delete `shared/src/voice.ts` + its Zod schema.
- **D-22:** Keep `NotificationChannel[]` abstraction. Delete only telegram +
  serverchan channel implementations + their registration; channel interface untouched
  (deferred to Phase 8 / REFH-04). Array length drops to 1 (web push).
- **D-23:** Channel-abstraction collapse is Phase 8 territory. Do not cross.
- **D-24:** Delete `telegramInitData.ts` + `bind.ts` + telegram source branch in
  `auth.ts`. `/api/auth` body schema collapses to `{ accessToken: string }`. JWT
  payload no longer carries telegram fields.
- **D-25:** Do NOT add negative-case auth tests (bad token / expired JWT / replayed JWT
  / empty body) — Phase 11 / REFT-03. Phase 2 only guarantees the access-token
  positive case stays green after telegram-branch removal.
- **D-26:** If socket.io auth handshake has a telegram branch, delete it (per D-24).
  **Research outcome:** there is **no telegram branch in `hub/src/socket/server.ts`** —
  see Section "D-26 Hypothesis Verification" below. D-26 is a no-op.
- **D-27:** Phase 2 ripgrep keywords = `telegram` / `serverchan` / `elevenlabs` /
  `grammy`. Zero tolerance across `cli/src/` / `hub/src/` / `web/src/` / `shared/src/`
  (identifier / import / string literal / comment).
- **D-28:** Whitelist = `.planning/codebase/` + `CHANGELOG.md` (carryover from Phase 1
  D-12) + `website/` (entire dir, Phase 12) + `docs/public/schemas/settings.schema.json`
  (schema is docs byproduct, Phase 10 / 12). All other `docs/**` and `*/README.md`
  must also be whitelisted explicitly because they are Phase 12 territory (carryover
  from Phase 1 whitelist categories — see Section "Ripgrep Guard Script Delta").
- **D-29:** Plan AND CI guard script BOTH list the keywords + whitelist explicitly.
  No human-memory dependency.
- **D-30:** 5 commits in order: (1) `feat(phase-02): CUT-06 remove Telegram bot
  (hub-side)`; (2) `feat(phase-02): CUT-06 remove Telegram WebApp platform
  (web-side)`; (3) `feat(phase-02): CUT-07 remove ElevenLabs voice`;
  (4) `feat(phase-02): CUT-08 remove ServerChan channel`;
  (5) `chore(phase-02): final cleanup + ripgrep guard update`.
- **D-31:** Each commit passes `bun typecheck` + `bun run test` independently.
- **D-32:** `settings.ts` + `serverSettings.ts` related fields are deleted outright.
  No Zod `.passthrough()` fallback. Old `settings.json` will fail at startup; user
  manually removes obsolete fields. Migration tool deferred to Phase 10 / REFC-01.
- **D-33:** CLI residuals (`TerminalManager.ts`, `commands/notify.ts`) live in
  commit #5. If cleanup causes typecheck failure, flag in PLAN per D-04.

### Claude's Discretion

- File-deletion order inside each commit (bottom-up by dependency graph).
- Whether to delete `useTelegram.ts` / `useAuthSource.ts` outright or leave empty
  shells for TS to converge — typecheck pass is the only hard constraint.
  Recommendation: delete outright (consistent with "No backward compatibility").
- `usePlatform.ts` internal implementation details (`matchMedia('(display-mode:
  standalone)')` vs existing abstraction).
- Form of channel-registration deletion in `hub/src/index.ts` (array-item delete vs
  feature flag) — recommendation: array-item delete.
- Whether to backfill a placeholder hint where the composer voice button used to live
  — recommendation: no, natural UI convergence.
- Whether to clean Telegram bind URL output from `hub/src/index.ts` startup banner in
  commit #5 — recommendation: yes (zero-tolerance scope).

### Deferred Ideas (OUT OF SCOPE)

- Notification channel abstraction folding / direct web-push call — Phase 8 (REFH-04)
- Auth route negative-case coverage (bad token / expired JWT / replayed JWT / empty
  body) — Phase 11 (REFT-03)
- Old `settings.json` field migration tool / schema-version reject-on-start —
  Phase 10 (REFC-01)
- `website/` deletion + `docs/` (telegram / voice / serverchan pages) cleanup —
  Phase 12 (CUT-12); Phase 2 only cleans source JSDoc / inline comments under D-27
- `website/src/locales/*.json` telegram / voice strings — Phase 12 (CUT-12) on dir
  delete
- `docs/public/schemas/settings.schema.json` telegram / serverchan field definitions
  — Phase 10 / 12 (schema is docs byproduct; regenerated from settings.ts)
- Hub `auth.ts` internal helper / error-return-structure refactor — Phase 8 (REFH-03)
  route template + `ApiRouteError`
- Composer voice button replacement with system-STT entry — out of milestone scope
  (PROJECT.md explicitly endorses "mobile system voice transcription is enough")
- `useTelegram.ts` / `useAuthSource.ts` reuse for PWA web-push auth flow — not
  reused; auth converges to access-token single source
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUT-06 | Delete full Telegram bot stack: `hub/src/telegram/`, `telegramInitData.ts`, `bind.ts`, `grammy` dep, Telegram notification channel, Telegram-only config | Sections: "File Inventory (CUT-06)", "Settings Field Inventory", "Web Telegram Consumer Inventory", "D-24 Auth Schema Convergence" |
| CUT-07 | Delete voice route + ElevenLabs SDK: `hub/src/web/routes/voice.ts`, `web/src/realtime/`, `shared/src/voice.ts`, `@elevenlabs/react` | Sections: "File Inventory (CUT-07)", "D-19 Realtime Consumer Verification", "i18n Voice Key Inventory" |
| CUT-08 | Delete ServerChan push channel: `hub/src/serverchan/`, related env vars | Sections: "File Inventory (CUT-08)", "Settings Field Inventory" |

## Phase 2 Success Criteria → Validation Map (from ROADMAP.md)

| SC | Statement | Phase 2 validation |
|----|-----------|--------------------|
| SC#1 | `bun typecheck` + `bun run test` green after the 7 listed paths are deleted | Run `bun typecheck && bun run test` from repo root after each commit (D-31) |
| SC#2 | Ripgrep zero match for `telegram` / `serverchan` / `elevenlabs` / `grammy` in `cli/`, `hub/`, `web/`, `shared/` outside whitelist | `bash scripts/check-no-cut-agents.sh` after commit #5 (script renamed or augmented per "Ripgrep Guard Script Delta") |
| SC#3 | `package.json` no `grammy` / `@elevenlabs/react`; `hub/src/index.ts` channel array refs neither Telegram nor ServerChan | `Grep "grammy\|@elevenlabs/react" **/package.json` returns empty; manual inspection of `hub/src/index.ts:199-219` |
| SC#4 | `TELEGRAM_BOT_TOKEN` / `TELEGRAM_NOTIFICATION` / `SERVERCHAN_SENDKEY` / `SERVERCHAN_NOTIFICATION` not read anywhere | `Grep "TELEGRAM_BOT_TOKEN\|TELEGRAM_NOTIFICATION\|SERVERCHAN_SENDKEY\|SERVERCHAN_NOTIFICATION" cli/src hub/src web/src shared/src` returns empty |
| SC#5 | `/api/auth` accepts only access-token branch; tests cover that branch | After commit #1: `hub/src/web/routes/auth.ts` body schema = `accessTokenAuthSchema` only; existing hub tests (`hub/src/web/routes/auth.test.ts` if present, else integration via socket/server tests) pass under `bun run test:hub` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Telegram bot (poll updates, send messages, render sessions) | API/Backend (`hub/src/telegram/`) | — | Long-polling subprocess owned by hub process |
| Telegram Mini App auth (`/api/auth` initData branch, `/api/bind`) | API/Backend (`hub/src/web/routes/`) | Browser/Client (`web/src/hooks/useAuthSource.ts`) | HMAC validation lives in hub; web side merely forwards initData |
| Telegram WebApp platform branching (haptics, theme, viewport, install prompt) | Browser/Client (`web/src/hooks/*`, `web/src/components/*`) | — | Pure client-side detection of `window.Telegram.WebApp` |
| ElevenLabs voice token mint + agent provisioning | API/Backend (`hub/src/web/routes/voice.ts`) | — | Requires `xi-api-key` secret; cannot live in browser |
| ElevenLabs voice realtime session (mic, WebRTC, agent context) | Browser/Client (`web/src/realtime/*`) | API/Backend (token-mint endpoint only) | `@elevenlabs/react` SDK runs in browser |
| Voice agent prompt + tools schema | Shared (`shared/src/voice.ts`) | Both | Reused by hub auto-create + web SDK config |
| ServerChan push (HAPI-Ready notifications) | API/Backend (`hub/src/serverchan/channel.ts`) | — | Outbound HTTP POST from hub process |
| Notification channel fan-out (Push / Telegram / ServerChan) | API/Backend (`hub/src/notifications/notificationHub.ts`) | — | All channels live in-process |
| CLI `notify` placeholder + `TerminalManager` env-scrubbing | CLI (`cli/src/commands/notify.ts`, `cli/src/terminal/TerminalManager.ts`) | — | CLI process; references telegram only as redirect message + sensitive env-key name |

All deletions stay within the tier that owns them. No cross-tier rewrites needed beyond
the `web ↔ hub` auth payload type narrowing (D-24).

## Standard Stack

**Phase 2 introduces no new libraries.** It removes:

| Library | Current ver | Phase | Reason for removal |
|---------|------------|-------|--------------------|
| `grammy` | ^1.38.4 (hub/package.json:20) [VERIFIED: cat hub/package.json] | CUT-06 commit #1 | Telegram bot framework — not used after telegram dir deletion |
| `@elevenlabs/react` | ^0.13.0 (web/package.json:17) [VERIFIED: cat web/package.json] | CUT-07 commit #3 | ElevenLabs ConvAI React SDK — only used by `web/src/realtime/RealtimeSession.ts` |

Also removed (subpath export): `shared/package.json:14` `"./voice": "./src/voice.ts"`
in commit #3.

**No version verification needed** because nothing is being installed.

## Package Legitimacy Audit

**N/A — Phase 2 installs zero new packages.** All work is deletion + dependency removal.
The legitimacy gate does not apply.

## Architecture Patterns

### Phase 2 Execution Flow

```
                  ┌──────────────────────────────┐
                  │  Phase 1 state (locked,      │
                  │  scripts/check-no-cut-       │
                  │  agents.sh installed)        │
                  └──────────────┬───────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │ Commit #1: CUT-06 hub-side    │
                  │  - rm hub/src/telegram/       │
                  │  - rm hub/src/web/{           │
                  │      telegramInitData,       │
                  │      routes/bind             │
                  │    }.ts                       │
                  │  - hub/src/web/server.ts:    │
                  │      drop createBindRoutes   │
                  │  - hub/src/web/routes/       │
                  │      auth.ts: collapse to    │
                  │      accessTokenAuthSchema   │
                  │      only (D-24)             │
                  │  - hub/src/index.ts:         │
                  │      drop HappyBot init +    │
                  │      telegram channel push + │
                  │      startup banner          │
                  │  - hub/src/notifications/    │
                  │      notificationTypes.ts:   │
                  │      strip telegram channel  │
                  │      ref (if any)            │
                  │  - hub/src/config/{settings, │
                  │      serverSettings}.ts +    │
                  │      configuration.ts: drop  │
                  │      telegram* fields        │
                  │  - hub/package.json: rm      │
                  │      grammy + "description"  │
                  │      Telegram wording        │
                  │  - hub/src/sync/{rpc,sync,   │
                  │      messageService}.ts:     │
                  │      drop telegram strings   │
                  │      ('telegram-bot' literal,│
                  │      comments)               │
                  │  Gate: bun typecheck +       │
                  │        bun run test          │
                  └──────────────┬───────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │ Commit #2: CUT-06 web-side    │
                  │  - rm web/src/hooks/         │
                  │      useTelegram.ts          │
                  │  - web/src/hooks/            │
                  │      useAuthSource.ts:       │
                  │      collapse to             │
                  │      accessToken-only        │
                  │      (or rewrite)            │
                  │  - web/src/hooks/useAuth.ts: │
                  │      AuthSource = single     │
                  │      variant; drop telegram  │
                  │      branches + bind()       │
                  │  - web/src/hooks/usePlatform │
                  │      .ts: drop isTelegram +  │
                  │      Telegram haptic branch  │
                  │  - web/src/hooks/{useTheme,  │
                  │      useViewportHeight}.ts:  │
                  │      drop telegram branches  │
                  │  - web/src/{main,router,sw,  │
                  │      App}.tsx: drop SDK      │
                  │      load + Mini App routes  │
                  │      + Telegram error UI     │
                  │  - web/src/components/{      │
                  │      SessionHeader,          │
                  │      InstallPrompt}.tsx:    │
                  │      drop isTelegram branches│
                  │  - web/src/index.css: drop   │
                  │      [data-telegram-app]     │
                  │      rules (L85, L213-219)   │
                  │  - web/src/lib/locales/{en,  │
                  │      zh-CN}.ts: drop         │
                  │      'login.bind.*' keys     │
                  │      (3 each)                │
                  │  - web/src/api/client.ts:    │
                  │      drop bind() method      │
                  │  - web/src/components/       │
                  │      LoginPrompt.tsx +       │
                  │      AssistantChat/messages: │
                  │      drop bind UI            │
                  │  Gate: bun typecheck +       │
                  │        bun run test          │
                  └──────────────┬───────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │ Commit #3: CUT-07 voice       │
                  │  - rm hub/src/web/routes/    │
                  │      voice.ts + server.ts    │
                  │      registration            │
                  │  - rm web/src/realtime/      │
                  │      entire dir              │
                  │  - rm web/src/lib/voice-     │
                  │      context.tsx             │
                  │  - rm web/src/api/voice.ts   │
                  │  - rm shared/src/voice.ts +  │
                  │      shared/package.json     │
                  │      ./voice export          │
                  │  - web/src/components/{      │
                  │      SessionChat,            │
                  │      AssistantChat/{         │
                  │        ComposerButtons,      │
                  │        HappyComposer,        │
                  │        StatusBar}}.tsx:      │
                  │      strip voice provider +  │
                  │      buttons + indicators    │
                  │  - rm web/src/components/    │
                  │      VoiceErrorBanner.tsx    │
                  │  - web/src/App.tsx: drop     │
                  │      <VoiceProvider> wrap +  │
                  │      <VoiceErrorBanner/>     │
                  │  - web/src/lib/locales/{en,  │
                  │      zh-CN}.ts: drop         │
                  │      'composer.voice', 14    │
                  │      'voice.*' keys, 3       │
                  │      'settings.voice.*' keys │
                  │  - web/src/lib/languages.ts: │
                  │      drop elevenLabsCode     │
                  │      column + helpers        │
                  │  - web/src/routes/settings/  │
                  │      index.tsx: drop entire  │
                  │      Voice Assistant section │
                  │      (L754-805+, helpers     │
                  │      L276-405)              │
                  │  - web/src/routes/settings/  │
                  │      index.test.tsx: drop    │
                  │      getElevenLabs* mock (1  │
                  │      hit at L91)             │
                  │  - web/vite.config.ts: drop  │
                  │      @elevenlabs vendor      │
                  │      chunk rule (L28-30)     │
                  │  - web/package.json: rm      │
                  │      @elevenlabs/react       │
                  │  Gate: bun typecheck +       │
                  │        bun run test          │
                  └──────────────┬───────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │ Commit #4: CUT-08 ServerChan  │
                  │  - rm hub/src/serverchan/    │
                  │      entire dir              │
                  │  - hub/src/index.ts: drop    │
                  │      ServerChanChannel import│
                  │      + push + banner lines   │
                  │  - hub/src/config/{settings, │
                  │      serverSettings}.ts +    │
                  │      configuration.ts: drop  │
                  │      serverChan* fields      │
                  │  - cli/src/commands/notify.ts│
                  │      (no serverchan ref —    │
                  │      see Section "CLI Crosscut │
                  │      Inventory"; defer to    │
                  │      commit #5 with telegram │
                  │      cleanup)                │
                  │  Gate: bun typecheck +       │
                  │        bun run test          │
                  └──────────────┬───────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │ Commit #5: cleanup + guard    │
                  │  - cli/src/commands/notify.ts│
                  │      drop telegram redirect  │
                  │      message (D-33)          │
                  │  - cli/src/terminal/         │
                  │      TerminalManager.ts:     │
                  │      drop TELEGRAM_BOT_TOKEN │
                  │      from SENSITIVE_ENV_KEYS │
                  │  - hub/src/index.ts: clean   │
                  │      any residual banner /   │
                  │      QR / bind-URL emission  │
                  │      tied to Telegram        │
                  │  - scripts/check-no-cut-     │
                  │      agents.sh: extend       │
                  │      PATTERN + whitelist     │
                  │      (see "Ripgrep Guard     │
                  │      Script Delta")          │
                  │  - bun.lock: bun install     │
                  │      regenerates             │
                  │  Gate: bun typecheck +       │
                  │        bun run test +        │
                  │        bash check-no-cut-    │
                  │        agents.sh             │
                  └──────────────────────────────┘
```

### Pattern 1: Per-CUT atomic commits with independently-green gate

**What:** Each commit deletes one logical surface and passes `bun typecheck` + `bun run
test` standalone (D-15 / D-31).
**When to use:** Pure-deletion phases where surfaces are mostly independent.
**Example:** Phase 1 used this exact pattern; verified by `01-VERIFICATION.md`
(5 commits, all green).

### Pattern 2: Workspace-isolated typecheck

**What:** `bun typecheck` runs `typecheck:cli && typecheck:hub && typecheck:web`
sequentially per-package — each package's `tsc --noEmit` only sees its own `src/` +
typed `@hapi/protocol` workspace dep.
**When to use:** Helps Commit #1 (hub-only) pass typecheck even though Commit #2
(web-side) hasn't run yet — the web package only learns about the auth payload shape
through HTTP, not through TypeScript types.
**Implication for D-30 commit ordering:** Commit #1 deleting `hub/src/telegram/` does
NOT break `web/typecheck` because web has no cross-package import of those files.
The web side's `AuthSource = { type: 'telegram' } | ...` union (in
`web/src/hooks/useAuth.ts:5-7`) remains valid TS until commit #2 collapses it.
Runtime contract drift across the two commits is acceptable per "No backward
compatibility" + per-commit test gate only running existing tests.
**Source:** `package.json:17-20` (`typecheck` = sequential package script).

### Anti-Patterns to Avoid

- **Cross-commit type coupling:** Do not introduce a new `shared/` type whose
  removal makes a different commit's typecheck fail. Phase 2 already avoids this
  by deleting `shared/src/voice.ts` and the AuthSource union in their own commits.
- **Leaving Zod `.passthrough()` fallbacks:** D-32 explicitly forbids this. Old
  `settings.json` MUST fail startup; user removes obsolete fields manually.
- **Adding placeholder UI:** Composer voice button vanishes without replacement
  (Discretion item; consistent with "No backward compatibility").
- **Renaming `useTelegram.ts` to empty shell:** Recommendation is to delete outright.
  Empty shells lengthen `Grep` whitelist and confuse future readers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema-version mismatch on settings.json | A migration codepath inside Phase 2 | Let startup fail; user removes obsolete fields by hand | D-32 + Phase 10 (REFC-01) own migration tool |
| `/api/auth` negative case coverage | New tests for bad/expired/replayed/empty token | Existing positive-case tests | D-25 + Phase 11 (REFT-03) own negative cases |
| Channel-abstraction cleanup | Inlined web-push direct call in `notificationHub` | Keep `NotificationChannel[]` length=1 | D-22 / D-23 + Phase 8 (REFH-04) owns this |
| Composer voice-button replacement | A "voice coming soon" disabled button | Just remove the button | D-20 + Discretion item; system STT is sufficient per PROJECT.md |
| Test fixture stripping where no fixture exists | Editing `notificationHub.test.ts` / `messageService.test.ts` for telegram fixtures | Skip these files (verified clean below) | Section "Test Fixture Stripping Plan" verifies |

## Runtime State Inventory

Phase 2 is a deletion phase touching code + settings.json — there IS one
runtime-state category to handle:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | SQLite `users` table rows with `platform='telegram'` (created by `hub/src/web/routes/bind.ts:48` `store.users.addUser('telegram', telegramUserId, namespace)`) | **No action in Phase 2.** Per D-32 + "No backward compatibility," stale rows are inert garbage; they're never queried again after auth.ts loses its telegram branch. Phase 3 (CUT-09 — namespace deletion) removes the `platform` column entirely. |
| **Live service config** | `~/.hapi/settings.json` containing `telegramBotToken` / `telegramNotification` / `serverChanSendKey` / `serverChanNotification` keys (persisted by `hub/src/config/serverSettings.ts:120-167`) | **No data-migration task in Phase 2** (D-32). User-facing behavior on first start after upgrade: Zod parse failure → restart blocks → user removes fields. Document in commit #5 message. |
| **OS-registered state** | None — verified by grep of `cli/src/`, `hub/src/` for `systemd`, `launchctl`, `task scheduler`, `pm2`. Telegram bot runs in-process. ServerChan is outbound HTTP only. | Nothing to do. |
| **Secrets / env vars** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_NOTIFICATION`, `SERVERCHAN_SENDKEY`, `SERVERCHAN_NOTIFICATION` referenced by `hub/src/config/serverSettings.ts:117,131,145,159` and documented in `hub/src/configuration.ts:10-13`. After Phase 2: code stops reading them. User-set env vars become inert. | Drop documentation lines in `configuration.ts:10-13`. Drop `TELEGRAM_BOT_TOKEN` from `cli/src/terminal/TerminalManager.ts:34` `SENSITIVE_ENV_KEYS` set (commit #5). No external secret-store integration to update. |
| **Build artifacts / installed packages** | `bun.lock` will retain stale `grammy` / `@elevenlabs/react` resolutions until regenerated. `node_modules` accumulates unused packages until `bun install` runs. `web/dist/vendor-voice-*.js` chunk (per vite.config.ts:28-30 manualChunks rule) will stop being emitted after `@elevenlabs/react` is dropped. | Commit #5 runs `bun install` to regenerate `bun.lock`. No persisted `dist/` artifact — built on demand. |

**The canonical question — answered:** *After every file is updated, what runtime
systems still have telegram/voice/serverchan cached, stored, or registered?*

→ **SQLite `users.platform='telegram'` rows + user's `~/.hapi/settings.json`**. Both
explicitly out-of-scope per CONTEXT (Phase 3 owns user table, Phase 10 owns settings
migration). User-facing: on first restart, `loadServerSettings` raises (no
`.passthrough()`); user must hand-edit settings.json. This is the documented
"No backward compatibility" cost.

## D-19 Hypothesis Verification — `web/src/realtime/` consumers

**Hypothesis:** All `web/src/realtime/` importers serve voice; no non-voice consumer
exists.

**Method:** `Grep` for `from ['\"](\.\.?/|@/)realtime|realtime/voiceHooks|voice-context|@/api/voice|@hapi/protocol/voice|shared/src/voice`.

**Result (8 importer files, all voice-purposed):**

```
web/src/components/SessionChat.tsx             # imports VoiceProvider
web/src/realtime/index.ts                       # internal re-export hub
web/src/realtime/RealtimeVoiceSession.tsx       # internal — @elevenlabs/react
web/src/lib/voice-context.tsx                   # imports startRealtimeSession, voiceHooks
web/src/components/VoiceErrorBanner.tsx         # imports useVoice
web/src/components/AssistantChat/ComposerButtons.tsx  # voice mic button
web/src/components/AssistantChat/HappyComposer.tsx    # voice input mode
web/src/components/AssistantChat/StatusBar.tsx        # voice recording status
web/src/api/voice.ts                            # token-mint API call
web/src/App.tsx                                 # <VoiceProvider>, <VoiceErrorBanner/>
```

**Conclusion:** ✅ Hypothesis confirmed. D-19's directory-level delete is safe.
No non-voice usage exists. The realtime/ directory + every listed consumer can be
deleted in commit #3 together.

## D-22 Hypothesis Verification — notification channel array reduces to web push

**Hypothesis:** After deleting Telegram + ServerChan channel implementations, the
`notificationChannels: NotificationChannel[]` array in `hub/src/index.ts` reduces to
PushNotificationChannel only; `NotificationChannel` interface survives untouched.

**Method:** Read `hub/src/index.ts:199-219` + `hub/src/notifications/notificationHub.ts`
+ `notificationTypes.ts`.

**Result:**

- **Channel array assembly** in `hub/src/index.ts:199-219`:
  ```
  const notificationChannels: NotificationChannel[] = [
      new PushNotificationChannel(pushService, sseManager, visibilityTracker, config.publicUrl)
  ]
  if (config.serverChanSendKey && config.serverChanNotification) {
      notificationChannels.push(new ServerChanChannel(config.serverChanSendKey, config.publicUrl))
  }
  if (config.telegramEnabled && config.telegramBotToken) {
      happyBot = new HappyBot({...})
      if (config.telegramNotification) {
          notificationChannels.push(happyBot)
      }
  }
  ```
- **Channel interface contract** (`notificationHub.ts:184-225`): four optional methods
  — `sendReady`, `sendPermissionRequest`, `sendTaskNotification`, `sendSessionCompletion`
  (last is optional via `typeof channel.sendSessionCompletion !== 'function'` check).
- **Channel interface surface to preserve** (lives in `notificationTypes.ts`): the
  `NotificationChannel` interface itself. **Research check:** Grep on
  `hub/src/notifications/` for `telegram` finds **zero** matches — meaning
  `notificationTypes.ts` does NOT mention Telegram. The HappyBot class (in
  `hub/src/telegram/bot.ts`) presumably `implements NotificationChannel` directly;
  no telegram-specific type extension exists.

**Conclusion:** ✅ Hypothesis confirmed. After commit #1 (drops HappyBot push +
init) and commit #4 (drops ServerChanChannel push), `notificationChannels` array is
just `[new PushNotificationChannel(...)]`. Length = 1. Interface contract
(`NotificationChannel`) is left intact and is Phase 8 territory.

## D-24 Auth Schema Convergence

**Current state** (`hub/src/web/routes/auth.ts`):

```
const telegramAuthSchema = z.object({ initData: z.string() })
const accessTokenAuthSchema = z.object({ accessToken: z.string() })
const authBodySchema = z.union([telegramAuthSchema, accessTokenAuthSchema])
```

Body discriminator: `if ('accessToken' in parsed.data) { ... } else { /* telegram */ }`.

JWT payload (both branches): `{ uid: userId, ns: namespace }`. **No telegram-specific
JWT claim exists** — the telegram path stores user data in the SQLite `users` table
and returns the same `{ uid, ns }` shape. So D-24's "JWT payload no longer contains
telegram fields" is a no-op: it never did.

**Converged shape after commit #1:**

```
const authBodySchema = z.object({ accessToken: z.string() })  // formerly accessTokenAuthSchema

app.post('/auth', async (c) => {
    const json = await c.req.json().catch(() => null)
    const parsed = authBodySchema.safeParse(json)
    if (!parsed.success) {
        return c.json({ error: 'Invalid body' }, 400)
    }
    const configuration = getConfiguration()
    const parsedToken = parseAccessToken(parsed.data.accessToken)
    if (!parsedToken || !constantTimeEquals(parsedToken.baseToken, configuration.cliApiToken)) {
        return c.json({ error: 'Invalid access token' }, 401)
    }
    const userId = await getOrCreateOwnerId()
    const namespace = parsedToken.namespace
    const token = await new SignJWT({ uid: userId, ns: namespace })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('4h')
        .sign(jwtSecret)
    return c.json({
        token,
        user: { id: userId, username: undefined, firstName: 'Web User', lastName: undefined }
    })
})
```

**Drops:** `import { validateTelegramInitData } from '../telegramInitData'`,
`import type { Store } from '../../store'` (no longer used), `store: Store` parameter
on `createAuthRoutes`. Update call site in `hub/src/web/server.ts` accordingly.
**Web-side knock-on (deferred to commit #2):** `web/src/api/client.ts` ApiClient
`authenticate()` body type narrows; `web/src/hooks/useAuth.ts:29-34` `getAuthPayload`
helper deletes; `AuthSource` union (line 5-7) collapses; `bind()` method (line 136-158)
deletes; the "Telegram auth failed" branch in `App.tsx:386-397` deletes.

## D-26 Hypothesis Verification — socket.io handshake telegram branch

**Hypothesis:** Socket.io auth handshake may have a telegram branch; if it does,
delete per D-24.

**Method:** `Grep "telegram" hub/src/socket/` (entire directory).

**Result:** **Zero matches.** Socket.io auth (`hub/src/socket/server.ts:103-140`) is
two-branch only: (1) raw `CLI_API_TOKEN` from socket handshake (`auth.token`),
parsed via `parseAccessToken` and constant-time compared; (2) JWT-bearing web client,
verified via `jwtVerify`. No telegram branch ever existed here.

**Conclusion:** ✅ D-26 is a **no-op**. Document this in commit #1's body and the
PLAN. No file to edit in `hub/src/socket/`.

## D-32 Settings Field Inventory (concrete)

### Fields to delete in commit #1 (Telegram) — files + exact line/field

| File | Field | Line(s) |
|------|-------|---------|
| `hub/src/config/settings.ts` | `telegramBotToken?: string` | 15 |
| `hub/src/config/settings.ts` | `telegramNotification?: boolean` | 16 |
| `hub/src/config/serverSettings.ts` | `OLD_SETTINGS_FIELDS` array — leave alone (it's about `webapp*` aliases, unrelated) | 13 |
| `hub/src/config/serverSettings.ts` | `telegramBotToken: string \| null` (interface) | 16 |
| `hub/src/config/serverSettings.ts` | `telegramNotification: boolean` (interface) | 17 |
| `hub/src/config/serverSettings.ts` | `telegramBotToken: 'env' \| 'file' \| 'default'` (sources) | 29 |
| `hub/src/config/serverSettings.ts` | `telegramNotification: 'env' \| 'file' \| 'default'` (sources) | 30 |
| `hub/src/config/serverSettings.ts` | `telegramBotToken` defaulting block | 106, 116-127 |
| `hub/src/config/serverSettings.ts` | `telegramNotification` defaulting block | 107, 130-141 |
| `hub/src/config/serverSettings.ts` | return value `telegramBotToken`, `telegramNotification` | 240-241 |
| `hub/src/configuration.ts` | JSDoc env-var docs for `TELEGRAM_BOT_TOKEN` + `TELEGRAM_NOTIFICATION` + `HAPI_PUBLIC_URL` (Mini App reference) | 10-11, 16 |
| `hub/src/configuration.ts` | `ConfigSources` keys `telegramBotToken`, `telegramNotification` | 36-37 |
| `hub/src/configuration.ts` | `Configuration` fields `telegramBotToken`, `telegramEnabled`, `telegramNotification` | 49-55 |
| `hub/src/configuration.ts` | constructor copies for telegram fields | 108-110 |
| `hub/package.json` | `"description": "Telegram Bot client for HAPI - control sessions"` | 5 |
| `hub/package.json` | `"grammy": "^1.38.4"` | 20 |

### Fields to delete in commit #4 (ServerChan) — files + exact line/field

| File | Field | Line(s) |
|------|-------|---------|
| `hub/src/config/settings.ts` | `serverChanSendKey?: string` | 17 |
| `hub/src/config/settings.ts` | `serverChanNotification?: boolean` | 18 |
| `hub/src/config/serverSettings.ts` | `serverChanSendKey: string \| null` (interface) | 18 |
| `hub/src/config/serverSettings.ts` | `serverChanNotification: boolean` (interface) | 19 |
| `hub/src/config/serverSettings.ts` | sources keys `serverChanSendKey`, `serverChanNotification` | 31-32 |
| `hub/src/config/serverSettings.ts` | defaulting blocks | 108-109, 143-169 |
| `hub/src/config/serverSettings.ts` | return value `serverChanSendKey`, `serverChanNotification` | 242-243 |
| `hub/src/configuration.ts` | JSDoc env-var docs `SERVERCHAN_SENDKEY` + `SERVERCHAN_NOTIFICATION` | 12-13 |
| `hub/src/configuration.ts` | `ConfigSources` keys `serverChanSendKey`, `serverChanNotification` | 38-39 |
| `hub/src/configuration.ts` | `Configuration` fields `serverChanSendKey`, `serverChanNotification` | 58-61 |
| `hub/src/configuration.ts` | constructor copies for serverchan fields | 111-112 |

### `shared/` re-exports

- `shared/src/schemas.ts` does **not** re-export `voice.ts` schemas — confirmed by
  Grep of `shared/src/` for `voice`. Only `shared/src/voice.ts` itself contains the
  `VoiceAgentConfig` interface. So deleting `shared/src/voice.ts` + the
  `shared/package.json:14` `"./voice"` export entry is sufficient; no other
  `shared/src/` file needs editing in commit #3.

## Web Telegram Consumer Inventory

**13 web files reference `telegram` / `useTelegram` / `useAuthSource` /
`TelegramWebApp` / `tgWebApp`:**

| File | Refs | Action (commit #2) |
|------|------|--------------------|
| `web/src/hooks/useTelegram.ts` | entire 144-line file | DELETE outright (Discretion) |
| `web/src/hooks/useAuthSource.ts` | telegram source branch (L7-22, L78-86, L106-131) | REWRITE as access-token-only (single source) |
| `web/src/hooks/useAuth.ts` | `AuthSource` union (L5-7), `getAuthPayload` (L29-34), `isNotBoundError` (L36-38), `bind()` (L136-158), `setNeedsBinding` state, telegram error branches | COLLAPSE to access-token only; drop `bind()` |
| `web/src/hooks/usePlatform.ts` | `isTelegram` field (L18, L43-71), `getTelegramWebApp` imports + branches in haptic (L43-67) | NARROW `Platform` to `{ isTouch, haptic }` (or `{ isPwa, isTouch, haptic }` per D-17); drop `isTelegram` |
| `web/src/hooks/useTheme.ts` | telegram branches (grep hit; specific lines TBD by planner via Read) | DROP telegram branch; keep light/dark/system from system pref |
| `web/src/hooks/useViewportHeight.ts` | telegram branches | DROP telegram branch; rely on `window.innerHeight` / VisualViewport API |
| `web/src/main.tsx` | SDK load (L41-50), `tgWebAppData` start_param (L21), `documentElement.dataset.telegramApp` (L43), router history switch (L76) | DROP all telegram init paths; force single history strategy |
| `web/src/router.tsx` | `isTelegramApp()` import (L23), gated route blocks (L445, L500) | UNGATE the affected routes (or remove them if telegram-only) |
| `web/src/sw.ts` | telegram refs (grep-confirmed; planner verifies) | DROP telegram refs |
| `web/src/App.tsx` | `getTelegramWebApp` import (L4), `isTelegramApp()` (L164), telegram error UI (L386-397), Telegram color theme bridge (L57, L104) | DROP all telegram code paths + error UI |
| `web/src/components/SessionHeader.tsx` | `isTelegramApp()` import (L4) + early-return (L128-129) | DROP early-return; always render header |
| `web/src/components/InstallPrompt.tsx` | `isTelegram` from usePlatform (L10, L12, L29) | DROP telegram branches; show prompt on browser/PWA only |
| `web/src/components/LoginPrompt.tsx` | bind UI | DROP bind UI (only Access Token form remains) |
| `web/src/components/AssistantChat/messages/AssistantMessage.tsx` | bind/login refs (grep hit — likely cosmetic) | Verify; drop if telegram-coupled |
| `web/src/components/AssistantChat/messages/UserMessage.tsx` | bind/login refs | Verify; drop if telegram-coupled |
| `web/src/api/client.ts` | bind/login refs + ApiClient `bind()` method | DROP `bind()` method |
| `web/src/index.css` | `/* non-Telegram browsers */` comment (L85), `html[data-telegram-app="true"]` rules (L213-214), `html:not([data-telegram-app="true"])` (L218-219) | DROP all four lines + associated rule bodies |
| `web/src/lib/locales/en.ts` | `'login.bind.title': 'Bind Telegram'` (L15), `'login.bind.submit': 'Bind'` (L17), `'login.bind.submitting': 'Binding…'` (L19) | DROP 3 keys |
| `web/src/lib/locales/zh-CN.ts` | `'login.bind.title': '绑定 Telegram'` (L15), `'login.bind.submit'` (L17), `'login.bind.submitting'` (L19) | DROP 3 keys |

**Crosscut with vite (web side):** `web/vite.config.ts` does NOT reference telegram —
only `@elevenlabs/react` (L28-30, dropped in commit #3). No telegram-vite delta in
commit #2.

## i18n Voice Key Inventory (commit #3)

**Keys to delete from `web/src/lib/locales/en.ts` and `zh-CN.ts`** (mirror-matched
between locales, same line numbers ±1):

| Line (en.ts) | Key |
|------|-----|
| 325 | `'composer.voice'` |
| 338 | `'voice.connecting'` |
| 339 | `'voice.active'` |
| 340 | `'voice.muted'` |
| 341 | `'voice.error'` |
| 342 | `'voice.mute'` |
| 343 | `'voice.unmute'` |
| 344 | `'voice.end'` |
| 345 | `'voice.error.micPermission'` |
| 346 | `'voice.error.network'` |
| 347 | `'voice.error.notInitialized'` |
| 348 | `'voice.error.startFailed'` |
| 349 | `'voice.error.notAllowed'` |
| 350 | `'voice.error.connection'` |
| 351 | `'voice.dismiss'` |
| 412 | `'settings.voice.title'` |
| 413 | `'settings.voice.language'` |
| 414 | `'settings.voice.autoDetect'` |

`zh-CN.ts` mirrors on lines 327, 340-353, 414-416. **Total: 18 keys × 2 locales = 36
i18n line deletions.**

## CSS Telegram Class Inventory (commit #2)

`web/src/index.css` — 4 hits, 2 rule blocks:

| Line | Content |
|------|---------|
| 85 | `/* Primary colors - override fallbacks for non-Telegram browsers */` (comment only — change or drop) |
| 213 | `html[data-telegram-app="true"],` (selector head) |
| 214 | `html[data-telegram-app="true"] body {` (rule open) |
| 218 | `html:not([data-telegram-app="true"]),` (selector head) |
| 219 | `html:not([data-telegram-app="true"]) body {` (rule open) |

**Planner action:** Drop the two telegram-gated rule blocks. The `:not(...)` form can
either be dropped (with its declarations promoted to the unconditional `html, body`
selector elsewhere in the file) or rewritten as `html, body { ... }` if those
declarations should remain universal. Planner verifies by reading `index.css` to see
the rule bodies.

## CLI Crosscut Inventory (commit #5)

| File | Line | Reference | Action |
|------|------|-----------|--------|
| `cli/src/terminal/TerminalManager.ts` | 34 | `'TELEGRAM_BOT_TOKEN'` in `SENSITIVE_ENV_KEYS` Set | DELETE this Set entry |
| `cli/src/commands/notify.ts` | 9 | `console.error(chalk.gray('Use Telegram notifications from hapi-hub instead.'))` | REWRITE error message — drop telegram reference. Suggested text: `chalk.gray('The notify command was removed in this fork.')` |
| `cli/src/runner/README.md` | 451 | `"The Telegram Mini App calls REST endpoints..."` | OUT OF SCOPE for Phase 2 — already Phase-12-whitelisted (`*/README.md`) per Phase 1 D-12 |

**No serverchan refs in `cli/src/`** — verified by Grep. No voice/elevenlabs refs in
`cli/src/` either. Commit #4 (CUT-08) has no CLI side-effect.

## Test Fixture Stripping Plan (commit #5)

| File | CONTEXT claim | Verification | Phase-2 action |
|------|---------------|--------------|----------------|
| `hub/src/sync/messageService.test.ts` | "剥离 telegram fixture" | Single hit at L766 — comment `// Zod layer, but non-REST callers (Telegram bot, MCP, internal) reach`. Pure documentation; no telegram fixture/import/code. | **Skip** — comment is allowed by D-27? No: D-27 is "comment line zero tolerance." → Edit comment to `// Zod layer, but non-REST callers (MCP, internal) reach` (drop "Telegram bot, "). 1-token diff. |
| `hub/src/notifications/notificationHub.test.ts` | "剥离 telegram fixture" | **Zero telegram refs** — file uses generic `StubChannel implements NotificationChannel`. | **Skip** — nothing to strip. |
| `web/src/routes/settings/index.test.tsx` | "测试 fixture 剥离" | One hit at L91: `getElevenLabsSupportedLanguages: () => [` (mock for the helper used by the Voice Assistant settings section being deleted in commit #3). | **Already handled by commit #3** — the test file's mock for the deleted helper must be removed in the same commit that deletes the helper + the settings section (commit #3, not commit #5). |
| `hub/src/sync/syncEngine.ts` | "telegram fixtures/strings" | L2 file-header JSDoc: `* Sync Engine for HAPI Telegram Bot (Direct Connect)`. L301: `sentFrom?: 'telegram-bot' \| 'webapp'` type literal. | Handle in commit #1: rewrite JSDoc (drop "Telegram Bot"); collapse `sentFrom` union to `'webapp'` (single-variant; verify no consumer relies on the `'telegram-bot'` literal) OR drop the field entirely. |
| `hub/src/sync/messageService.ts` | "telegram fixtures/strings" | L351: same `sentFrom?: 'telegram-bot' \| 'webapp'` literal. L355: comment `// Defence-in-depth invariant for non-REST callers (Telegram bot, MCP,` | Commit #1: same treatment as syncEngine — collapse union or drop, and edit comment. |
| `hub/src/sync/rpcGateway.ts` | "telegram fixtures/strings" | L95: string `'User aborted via Telegram Bot'` — passed as `reason` payload in `sessionRpc(... 'abort', { reason })`. | Commit #1: change string to `'User aborted via webapp'` (or similar non-telegram form). |
| `hub/src/web/routes/messages.ts` | "verify telegram hits are comments/strings only" | L30: comment `// Cap scheduledAt at 7 days from now to prevent zombie rows.  REST/Telegram/` | Commit #1: edit comment, drop "Telegram/". |

**Net surface area:** Smaller than CONTEXT estimated. The two test files singled out
in CONTEXT D-30 commit #5 description ("messageService.test.ts / notificationHub.test.ts")
need either a 1-token edit (`messageService.test.ts`) or no edit (`notificationHub.test.ts`).
The `settings/index.test.tsx` cleanup belongs in commit #3, not #5.

## Ripgrep Guard Script Delta

**Current state** (`scripts/check-no-cut-agents.sh`):

```
PATTERN='\b(claude|codex|gemini|opencode)\b'
WHITELIST=(
  # Infra (never agent code): .planning/**, CHANGELOG.md, .gitignore,
  #   node_modules/**, dist/**, bun.lock, .git/**,
  #   scripts/check-no-cut-agents.sh
  # Phase-5 territory: shared/src/{flavors,modes,resume,voice,schemas,
  #   sessionSummary,models,types}.ts + tests, hub/src/sync/{syncEngine,
  #   rpcGateway,sessionModel.test}.ts, hub/src/web/routes/{sessions,machines,
  #   cli,permissions}.ts + tests, cli/src/{commands/runner,runner/run,
  #   runner/buildCliArgs.test,api/apiSession,agent/serverUtils/*,ui/logger,
  #   ui/ink/{RemoteModeDisplay,CodexDisplay},utils/attachmentFormatter,
  #   parsers/specialCommands,modules/common/*}.ts, web/src/{api/client,
  #   chat/**,realtime/**,router,types/api,lib/{locales,query-keys,
  #   assistant-runtime*,sessionModelLabel.test,message-window-store*},
  #   hooks/{useActiveSuggestions,queries/{useSlashCommands,useCodexModels},
  #   mutations/{useSessionActions,useSpawnSession}},components/{SessionList*,
  #   SessionChat,ToolCard/**,NewSession/**,AssistantChat/**}}
  # Phase-12 deferred: cli/NOTICE, */README.md, docs/**, website/**, README.md,
  #   CONTRIBUTING.md, AGENTS.md, refactor.md, .cursor/rules/**
)
if rg -i "${WHITELIST[@]}" "$PATTERN" .; then ... exit 1; fi
```

**Phase 2 delta (applied in commit #5):**

1. **Rename script** (optional, recommended for clarity):
   `scripts/check-no-cut-agents.sh` → `scripts/check-no-cuts.sh`. Update
   `package.json:25` `test:guard` to match. Skip if planner prefers minimum-diff.

2. **Extend PATTERN:**

   ```
   PATTERN='\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b'
   ```

3. **Whitelist additions** (Phase 2 territory + Phase 12 deferred + new Phase-5
   removals):

   ```
   # === Phase-5 territory — REMOVE these on commit #3 (shared/src/voice.ts deleted)
   #   --glob '!shared/src/voice.ts'   ← already in script; DELETE this line in commit #3
   #
   # === Phase-12 deferred (NEW for Phase 2)
   --glob '!docs/public/schemas/settings.schema.json'    # schema regenerated by Phase 10/12
   --glob '!website/**'                                  # already in script; stays
   --glob '!docs/**'                                     # already in script; stays
   --glob '!*/README.md'                                 # already in script via cli/README.md etc; verify hub/README.md, web/README.md covered
   ```

   The existing Phase-1 whitelist already covers `docs/**`, `website/**`, `README.md`
   files, `.planning/**`, `CHANGELOG.md`. So the **only new entry strictly required**
   is `docs/public/schemas/settings.schema.json` (in case the schema lives outside
   `docs/**`; planner should verify the actual path).

4. **Whitelist removals** (paths that previously needed a carve-out only because they
   held telegram/voice content that Phase 2 deletes):

   - `--glob '!shared/src/voice.ts'` ← delete this line (file gone after commit #3)

5. **Error message** updated to reference the broader keyword set:

   ```
   echo "❌ Non-Cursor / external-channel literals found outside whitelist."
   echo "   Either rewrite the hit to remove the literal, or — if the hit"
   echo "   is structurally tied to wire constants (Phase-5 territory) or"
   echo "   docs (Phase-12 territory) — add an explicit whitelist entry."
   ```

6. **Gate behavior:** Script keeps working under both `rg` present (real check)
   and `rg` absent (current Phase-1 verifier short-circuits as documented in
   `01-VERIFICATION.md` Notes). CI environments must have `rg` for the actual
   guard to fire.

**Risk note:** The current script lives at `scripts/check-no-cut-agents.sh` and
the `test:guard` npm script invokes it via `bash scripts/check-no-cut-agents.sh`.
Renaming the file ALSO requires updating `package.json:25`. If planner picks
"minimum diff," keep the file name and just extend PATTERN + whitelist in place.

## Commit Dependency Ordering — typecheck risk audit

D-30 mandates 5 commits in order: #1 hub-Telegram → #2 web-Telegram → #3 voice →
#4 ServerChan → #5 cleanup. D-31 requires each commit to pass `bun typecheck` +
`bun run test` standalone.

**Cross-commit type coupling analysis:**

| Commit boundary | Risk | Mitigation |
|-----------------|------|------------|
| #1 → #2 | After commit #1, hub `/api/auth` body schema rejects `{ initData }`. Web `AuthSource = { type: 'telegram' } \| ...` still references that shape in its TS types. **Will web typecheck pass?** ✅ YES — web ↔ hub contract is HTTP-runtime only; web's `AuthSource` is a local TS union, not imported from `hub/`. `bun typecheck` (per-package) cannot detect the runtime mismatch. Existing web tests don't make real HTTP calls to the hub. | Per-package typecheck isolation makes this safe. Web's telegram code becomes "dead but typed-valid" between #1 and #2. |
| #1 → #2 | If commit #1 also removes the `'telegram-bot'` literal from `hub/src/sync/{syncEngine,messageService}.ts` `sentFrom` union, do any tests assert on this literal? **Check:** Grep for `'telegram-bot'` across `hub/src/`. Single hit in `syncEngine.ts:301` + `messageService.ts:351` (type definition only) + zero hits in `hub/src/**/*.test.ts`. ✅ Safe — collapsing the union doesn't break test fixtures. | Hub typecheck + test pass. |
| #2 → #3 | Commit #2 doesn't depend on commit #3's deletions. After #2, voice code still exists; voice imports still resolve; test stays green. | Safe. |
| #3 → #4 | Commit #3 (voice) and #4 (ServerChan) are orthogonal. | Safe. |
| #4 → #5 | Commit #4 leaves CLI `notify.ts`'s telegram reference + `TerminalManager.ts`'s `TELEGRAM_BOT_TOKEN` env-key string untouched. **Does this break test:guard?** YES — after #4, ripgrep guard (when extended to include `telegram`) would still fire on these two files. **That's exactly why commit #5 exists** — and per D-31 each commit must pass `bun run test` independently. The path through this is: **do not extend the ripgrep PATTERN to include the new keywords until commit #5**. The guard script's PATTERN extension and the CLI residual cleanup must land together. | Document explicitly in PLAN: commit #5 is atomic w.r.t. (a) extending PATTERN + whitelist AND (b) deleting CLI residuals. Skip extending PATTERN in earlier commits. |

**Conclusion:** ✅ No inter-commit typecheck breakage detected. Commits #1-#4 should
each leave the ripgrep guard's PATTERN unchanged (`\b(claude|codex|gemini|opencode)\b`
only). Commit #5 lands the PATTERN extension + whitelist updates + CLI residual
cleanup as one atomic unit.

## Code Examples

### Auth route post-collapse pattern (commit #1)

See "D-24 Auth Schema Convergence" above — full code shown there.

### NotificationChannels post-collapse (commit #4)

`hub/src/index.ts:199-205` becomes:

```typescript
const notificationChannels: NotificationChannel[] = [
    new PushNotificationChannel(pushService, sseManager, visibilityTracker, config.publicUrl)
]
```

Array length 1. NotificationHub constructor unchanged.

### Ripgrep guard extension (commit #5)

```bash
PATTERN='\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b'
# … existing Phase-1 + Phase-5 + Phase-12 whitelist entries …
# Remove (file deleted in commit #3):
#   --glob '!shared/src/voice.ts'
# Add (Phase 10/12 docs byproduct):
--glob '!docs/public/schemas/**'
```

## State of the Art

N/A — this phase introduces zero new patterns or libraries. It removes legacy
integration surfaces. The "state of the art" delta is: codebase no longer maintains
3 outbound integration channels (Telegram, ElevenLabs, ServerChan). Auth narrows
to single-source. Web platform abstraction narrows to PWA/browser.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | All claims in this research were verified via `Grep` / `Read` of the working tree at HEAD or are direct copies from CONTEXT.md / locked Phase-1 artifacts | — | — |

This research contains zero `[ASSUMED]` claims. All file paths, line numbers, settings
fields, locale keys, dependency versions, and hypothesis verifications were checked
directly against the codebase on 2026-05-21. No external library/API documentation
was consulted because no new libraries are introduced.

## Open Questions

> **Status note:** Q1 and Q3 RESOLVED at planning time (Q1 → in-place message rewrite per 02-05 Task 1 step 2; Q3 → whitelist the schema path, do not regenerate). Q2 RESOLVED as **deferred to executor**: 02-02 Task 2 step 3 reads `sw.ts` and picks mechanical strip vs rewrite, documenting the choice in the commit body. The deferral is also surfaced in 02-02-PLAN.md `must_haves.truths` for executor visibility.

1. **[RESOLVED — in-place rewrite]** Should commit #5 also delete or rewrite the `cli/src/commands/notify.ts` file
   entirely?
   - What we know: The command exists only as a hard-failing placeholder. Its sole
     purpose was to redirect users to "Use Telegram notifications from hapi-hub
     instead."
   - What's unclear: After dropping the telegram reference, is the placeholder still
     wanted? If not, the file + its `commands/registry.ts` entry can be deleted.
   - Recommendation: Defer to planner. Either (a) edit the error message to drop
     "Telegram" or (b) delete the command outright. Outright deletion is more
     aggressive but consistent with "No backward compatibility." Either choice
     satisfies D-27.

2. **[RESOLVED — deferred to executor]** Does `web/src/sw.ts` reference `telegram` in code that affects PWA install
   manifest or runtime caching?
   - What we know: Grep shows `sw.ts` has telegram hits.
   - What's unclear: Whether stripping changes service-worker behavior (e.g.,
     `start_url` or scope).
   - Recommendation: Planner reads `sw.ts` during commit #2 plan creation and
     decides whether the strip is mechanical or requires a small `sw.ts` rewrite.

3. **[RESOLVED — whitelist, do not regenerate]** Is `docs/public/schemas/settings.schema.json` actually generated from
   `settings.ts` automatically, or hand-maintained?
   - What we know: D-28 says it's "schema is docs byproduct, Phase 10 REFC-01 /
     Phase 12 CUT-12 handles it."
   - What's unclear: Whether Phase 2 needs to regenerate it now (would re-introduce
     telegram/serverchan field defs, violating SC#2) or leave it stale until Phase
     10/12.
   - Recommendation: Whitelist the path in Phase 2 (so ripgrep guard ignores it).
     Do not regenerate. Phase 10/12 fixes it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | All typecheck, test, install commands | ✓ | 1.3.14 (declared in `cli/package.json` packageManager) [VERIFIED: `.planning/codebase/TESTING.md:17`] | None — required |
| `rg` (ripgrep) | `scripts/check-no-cut-agents.sh` ripgrep guard | ⚠ Not installed on workspace host (verified by `command -v rg`) | — | Script short-circuits to success when rg absent (per Phase-1 verifier note in `01-VERIFICATION.md`). CI environment must have rg for real check. |
| `tsc` (TypeScript) | `bun typecheck` per package | ✓ | ^5 (hub) / ^5.9.3 (web) [VERIFIED: package.json files] | None — required |
| `vitest` | `bun run test:cli`, `bun run test:web` | ✓ | ^4.0.16 [VERIFIED: TESTING.md] | None — required |
| `bun:test` | `bun run test:hub`, `bun run test:shared` | ✓ | Built-in to bun runtime | None — required |

**Missing dependencies with no fallback:** None blocking Phase 2 work. The local
absence of `rg` only affects developer-machine guard runs; CI is the authoritative
gate.

**Missing dependencies with fallback:** `rg` (script short-circuits gracefully).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4 (cli + web) + Bun test (hub + shared) |
| Config file | `cli/vitest.config.ts`, `web/vitest.config.ts`, hub uses `bun test` discovery (no config), shared same |
| Quick run command | `bun run test:hub` (after hub edits) / `bun run test:web` (after web edits) — per-package iteration is fast |
| Full suite command | `bun run test` (from repo root, runs all 4 packages sequentially + ripgrep guard) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CUT-06 (hub) | `hub/src/telegram/` absent | file-existence | `! test -e hub/src/telegram` | ✅ post-commit assertion (manual) |
| CUT-06 (hub) | `/api/auth` access-token branch still works | integration | Existing `hub/src/web/routes/auth.test.ts` if present, else `bun run test:hub` exercises it through socket/server tests | ⚠ Verify auth.test.ts exists at planner time |
| CUT-06 (hub) | `hub/src/index.ts` channel array no Telegram | static (typecheck after HappyBot import deletion) | `bun run typecheck:hub` | ✅ |
| CUT-06 (hub) | grammy uninstalled | static | `grep -c grammy hub/package.json` → 0 | ✅ |
| CUT-06 (web) | `useTelegram.ts` deleted | file-existence | `! test -e web/src/hooks/useTelegram.ts` | ✅ post-commit |
| CUT-06 (web) | Web typecheck after AuthSource collapse | static | `bun run typecheck:web` | ✅ |
| CUT-06 (web) | Existing web tests pass | unit | `bun run test:web` | ✅ |
| CUT-07 | `web/src/realtime/` deleted | file-existence | `! test -e web/src/realtime` | ✅ post-commit |
| CUT-07 | `shared/src/voice.ts` deleted; shared export gone | static | `! test -e shared/src/voice.ts && ! grep voice shared/package.json` | ✅ |
| CUT-07 | `@elevenlabs/react` uninstalled | static | `grep -c @elevenlabs web/package.json` → 0 | ✅ |
| CUT-07 | Voice settings section deleted from settings page | static | `! grep settings.voice web/src/routes/settings/index.tsx` | ✅ |
| CUT-08 | `hub/src/serverchan/` deleted | file-existence | `! test -e hub/src/serverchan` | ✅ post-commit |
| CUT-08 | ServerChan settings fields gone | static | `! grep -i serverchan hub/src/config/*.ts hub/src/configuration.ts` | ✅ |
| Phase SC#2 | Ripgrep guard passes | guard | `bash scripts/check-no-cut-agents.sh` | ✅ (after commit #5 extends PATTERN) |
| Phase SC#3 | `bun.lock` reflects removed deps | static | `bun install --frozen-lockfile` exit 0 | ✅ |
| Phase SC#5 | `/api/auth` body shape collapsed | static | Inspect `hub/src/web/routes/auth.ts`: `authBodySchema` should be `z.object({ accessToken: z.string() })` | ✅ |

### Sampling Rate

- **Per task commit:** `bun run test:{cli|hub|web}` for the package touched by the commit
- **Per wave merge:** N/A — Phase 2 has no waves; each commit is a single logical wave
- **Phase gate:** Full `bun run test` (incl. `test:guard`) green before `/gsd:verify-work`

### Wave 0 Gaps

- [x] `scripts/check-no-cut-agents.sh` exists (from Phase 1) — only needs extension, not creation
- [ ] No new test files required (D-25 / D-07 carryover): Phase 2 is a pure-deletion phase
- [ ] Verify `hub/src/web/routes/auth.test.ts` existence at planner time (if absent, the SC#5 access-token positive case is exercised only through higher-level hub tests — planner should note this and decide whether to add a one-shot positive-case test or defer to Phase 11/REFT-03)

*(No framework install needed — Phase 1 already established the test infrastructure.)*

## Security Domain

Phase 2 deletes attack-surface — it does not introduce new security-relevant code paths.
Still, the deletions touch security-relevant subsystems (auth, env-var handling),
so a brief ASVS-aligned scan applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `parseAccessToken` + `constantTimeEquals` (existing, unchanged) — only the telegram initData path is removed, leaving the simpler access-token comparison |
| V3 Session Management | yes | JWT via `jose` (existing, unchanged) — payload `{ uid, ns }` shape preserved across the schema collapse |
| V4 Access Control | no | No new access-control logic added |
| V5 Input Validation | yes | `zod` (existing, unchanged) — `authBodySchema` shrinks from union to single object; `bindBodySchema` deleted entirely |
| V6 Cryptography | no | No crypto code added; HMAC validation in `telegramInitData.ts` deleted (becomes dead) |

### Known Threat Patterns for the deletion surface

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Dead-code rehydration: leaving `hub/src/web/telegramInitData.ts` on disk after `auth.ts` stops importing it could let a future developer accidentally re-wire it | Tampering / Elevation | D-19's directory/file-level delete (not just import removal) prevents this. Verify by `test -e hub/src/web/telegramInitData.ts` returning false. |
| Sensitive-env-key set drift: `TELEGRAM_BOT_TOKEN` was redacted in terminal sessions by `cli/src/terminal/TerminalManager.ts:34`. After deletion, sessions could expose a still-set token value | Information disclosure | After this phase the token has no use, but a defensive-coding review-time question: should other "telegram-like" external bot tokens be retained in `SENSITIVE_ENV_KEYS`? Decision: drop only the literal `'TELEGRAM_BOT_TOKEN'` entry; the surrounding set (Anthropic, Google, etc.) is governed by Phase 1's CUT-01..04 territory, not Phase 2. |
| Stale settings.json carrying secret tokens after upgrade | Information disclosure (local-machine threat model) | D-32 — startup fails fast, user manually removes obsolete fields. Documented behavior is the mitigation. |
| Schema-doc drift (`docs/public/schemas/settings.schema.json` may still list deleted fields) | Repudiation / Confusion | Out of scope for Phase 2; Phase 10/12 owns. Whitelisting the path is the Phase-2 cost. |

## Sources

### Primary (HIGH confidence)

All sources are direct reads of the working tree at HEAD on 2026-05-21:

- `hub/src/web/routes/auth.ts` (91 lines) — auth schema, telegram branch shape, JWT payload
- `hub/src/web/routes/bind.ts` (70 lines) — bind route to be deleted whole
- `hub/src/web/telegramInitData.ts` (109 lines) — initData HMAC validator, deleted whole
- `hub/src/web/server.ts` — route registration sites for auth/bind/voice
- `hub/src/index.ts` (331 lines) — channel array assembly, HappyBot init, startup banner
- `hub/src/notifications/notificationHub.ts` (226 lines) — channel iteration pattern; confirmed no telegram refs
- `hub/src/notifications/notificationHub.test.ts` (first 50 lines) — confirmed StubChannel pattern (no fixtures to strip)
- `hub/src/notifications/notificationTypes.ts` — NotificationChannel interface (lives here; Phase 2 leaves untouched)
- `hub/src/config/settings.ts`, `serverSettings.ts`, `configuration.ts` — full settings field inventory
- `hub/src/telegram/{bot,callbacks,renderer,sessionView}.ts` + `bot.test.ts` — directory-level delete target (line counts in inventory)
- `hub/src/serverchan/{channel.ts,channel.test.ts}` — directory-level delete target
- `hub/src/sync/{syncEngine,messageService,rpcGateway}.ts` — telegram comment/string hits (lines 2, 301, 351, 355, 95 respectively)
- `hub/src/sync/messageService.test.ts:766` — single comment hit, 1-token diff
- `hub/src/socket/server.ts` — D-26 verification (no telegram branch)
- `hub/package.json`, `web/package.json`, `shared/package.json`, root `package.json` — dependencies + test orchestration
- `web/src/hooks/{useTelegram,useAuthSource,usePlatform,useAuth}.ts` — full hook structure
- `web/src/{App,main,router,sw}.tsx` + `App.tsx:386-397` — telegram consumer sites
- `web/src/index.css:85,213-219` — Telegram-CSS line locations
- `web/src/lib/locales/{en,zh-CN}.ts:15,17,19,325,338-351,412-414` — i18n key inventory
- `web/src/lib/languages.ts` — ElevenLabs language column to remove
- `web/src/routes/settings/index.tsx:32,276-405,754-805+` + `index.test.tsx:91` — voice settings section
- `web/src/realtime/` (8 file directory) — D-19 verification
- `web/vite.config.ts:28-30` — @elevenlabs vendor-chunk rule
- `shared/src/voice.ts` (257 lines) — only file in shared/ referencing voice/elevenlabs
- `cli/src/terminal/TerminalManager.ts:34`, `cli/src/commands/notify.ts:9` — CLI crosscut
- `scripts/check-no-cut-agents.sh` (current Phase-1 guard form)
- `.planning/phases/01-cut-non-cursor-agents/{01-CONTEXT,01-VERIFICATION}.md` — Phase 1 carryover decisions
- `.planning/phases/02-cut-external-integration-channels/02-CONTEXT.md` — Phase 2 locked decisions
- `.planning/ROADMAP.md` — phase boundaries + SC statements
- `.planning/REQUIREMENTS.md` — CUT-06/07/08 wording
- `.planning/codebase/{INTEGRATIONS,TESTING}.md` — external integration map + test framework details
- `AGENTS.md` — workspace constraints (4-space, Bun workspaces, No backward compatibility)

### Secondary (MEDIUM confidence)

None — no WebSearch / Context7 lookups needed for this deletion-only phase.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**

- Standard stack: N/A (no new libs)
- File inventory: HIGH — direct `Read` + `Grep` against HEAD
- Settings field inventory: HIGH — direct line-number reads
- D-19 / D-22 / D-24 / D-26 / D-32 hypothesis verification: HIGH — explicit grep results
- Commit ordering / typecheck risk: HIGH — derived from per-package `bun typecheck`
  isolation in `package.json:17-20` and absence of cross-package type imports
- Ripgrep guard delta: HIGH — script read in full, delta minimal and explicit
- Pitfalls: HIGH — pulled from existing Phase 1 verification + workspace test
  conventions

**Research date:** 2026-05-21
**Valid until:** Phase 2 execution (the codebase is the source of truth; this
research is a snapshot of HEAD on the research date).

---

## RESEARCH COMPLETE

Phase 2 is a pure-deletion refactor sitting on Phase 1's commit-per-requirement + ripgrep-guard infrastructure; all five CONTEXT hypotheses (D-19, D-22, D-24, D-26, D-32) verified against HEAD, the 5-commit sequence is intact with one research-surfaced simplification (notificationHub.test.ts needs no fixture stripping; messageService.test.ts needs only a 1-token comment edit). Concrete file/line/key/field inventory documented for every deletion target so the planner can write task acceptance criteria without re-reading source.
