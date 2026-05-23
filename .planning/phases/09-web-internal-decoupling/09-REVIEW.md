---
phase: 09-web-internal-decoupling
reviewed: 2026-05-23T08:56:00Z
depth: standard
files_reviewed: 56
files_reviewed_list:
  - cli/src/modules/common/handlers/uploads.ts
  - hub/src/web/routes/sessions/upload.ts
  - scripts/check-no-circular-web.sh
  - scripts/check-no-cut-agents.sh
  - shared/src/index.ts
  - shared/src/uploads.ts
  - web/src/components/AssistantChat/HappyComposer.tsx
  - web/src/components/AssistantChat/HappyComposerOverlays.tsx
  - web/src/components/AssistantChat/useHappyComposerHandlers.ts
  - web/src/components/AssistantChat/useHappyComposerState.ts
  - web/src/components/SessionList.tsx
  - web/src/components/SessionList/SessionListEmpty.tsx
  - web/src/components/SessionList/SessionListHeader.tsx
  - web/src/components/SessionList/SessionListIcons.tsx
  - web/src/components/SessionList/SessionListItem.tsx
  - web/src/components/SessionList/SessionListSearch.tsx
  - web/src/components/SessionList/useSessionListData.ts
  - web/src/components/SessionList/useSessionListKeyboard.ts
  - web/src/components/SessionList/useSessionListSearch.ts
  - web/src/components/SessionList/useSessionListSelection.ts
  - web/src/components/ToolCard/knownTools.tsx
  - web/src/components/ToolCard/views/_results.tsx
  - web/src/components/ToolCard/views/results/BashResult.tsx
  - web/src/components/ToolCard/views/results/LineListResult.tsx
  - web/src/components/ToolCard/views/results/ReadResult.tsx
  - web/src/components/ToolCard/views/results/_resultHelpers.tsx
  - web/src/hooks/queries/_factory.ts
  - web/src/hooks/queries/useMachines.ts
  - web/src/hooks/queries/useSession.ts
  - web/src/hooks/queries/useSessions.ts
  - web/src/hooks/queries/useSkills.ts
  - web/src/hooks/queries/useSlashCommands.ts
  - web/src/lib/fuzzyMatch.ts
  - web/src/lib/message-window-store.ts
  - web/src/lib/messageWindowMergeService.ts
  - web/src/lib/messageWindowPaginationService.ts
  - web/src/lib/messageWindowPersistence.ts
  - web/src/lib/messageWindowState.ts
  - web/src/lib/messageWindowSubscriptions.ts
  - web/src/lib/messageWindowTrim.ts
  - web/src/routes/settings/_sections/AboutSection.tsx
  - web/src/routes/settings/_sections/ChatSection.tsx
  - web/src/routes/settings/_sections/DisplaySection.tsx
  - web/src/routes/settings/_sections/LanguageSection.tsx
  - web/src/routes/settings/_sections/_icons.tsx
  - web/src/routes/settings/index.tsx
  - web/src/routes/settings/useSettingsState.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-05-23T08:56:00Z
**Depth:** standard
**Files Reviewed:** 56 (test files excluded from findings unless they affect reliability)
**Status:** issues_found

## Summary

Phase 9 is a pure refactor/decomposition effort: util dedup (`estimateBase64Bytes`, `levenshteinDistance`), three large web files split into facade + sub-modules (message-window-store, SessionList, settings, HappyComposer, ToolCard `_results`), a `createApiQuery` factory abstraction, and a Phase-9 sweep block appended to `scripts/check-no-cut-agents.sh`. No new auth/IO surface introduced; all public exports preserved per the SUMMARYs.

The refactor is in good shape overall — every facade re-export was verified to match the pre-refactor public surface (`message-window-store.ts`, `SessionList.tsx`, `views/_results.tsx`), the trim/state cycle breaks introduced in 09-04 are clean (pure-helper extraction for merge↔pagination, registrar inversion for state↔persistence), and the sweep block is structurally sound. No critical bugs or security issues were found.

Three warning-level findings worth fixing before this code ships:

1. The `createApiQuery` factory's error-message branch is dead code, so per-hook `errorMessage` configuration silently never surfaces to users.
2. `useSettingsState` outside-click effect captures a stale `slots` snapshot when a second dropdown opens while another is already open, leaving the second dropdown immune to outside-click dismissal.
3. The new `messageWindowState ↔ messageWindowPersistence` registrar inversion relies on a module-load side-effect; any future caller that imports `messageWindowState` without first triggering persistence module load will silently lose sessionStorage hydration with no warning.

## Warnings

### WR-01: `createApiQuery` factory — `spec.errorMessage` is unreachable; per-hook error message configuration is silently dead

**File:** `web/src/hooks/queries/_factory.ts:50-57`

**Issue:** `useQuery<TRaw, Error>` types `query.error` as `Error | null`. The returned `error` field is computed as:

```ts
error: query.error instanceof Error
    ? query.error.message
    : query.error ? spec.errorMessage : null,
```

After the `instanceof Error` check fails, the only remaining value is `null` (per the `Error | null` union). The truthy branch `query.error ? spec.errorMessage : null` is therefore unreachable, and `spec.errorMessage` is never returned. This means the `errorMessage: 'Failed to load sessions' / 'Failed to load session' / 'Failed to load machines'` configuration in `useSessions`, `useSession`, and `useMachines` is dead — failure messages are always the raw `Error.message` from the API client, never the customised fallback. This is a behavioural regression vs. the pre-refactor shape-A pattern where each hook had its own bespoke fallback string.

**Fix:** Either drop the unused configuration knob (and update the three call sites) or fall back to `spec.errorMessage` when the message is empty / generic:

```ts
error: query.error
    ? (query.error instanceof Error && query.error.message
        ? query.error.message
        : spec.errorMessage)
    : null,
```

Then verify behaviour with a unit test that asserts a non-`Error` (or empty-message) rejection surfaces `spec.errorMessage`.

### WR-02: `useSettingsState` outside-click effect uses stale slot snapshot when a second dropdown opens

**File:** `web/src/routes/settings/useSettingsState.ts:38-55`

**Issue:** `slots` is rebuilt on every render with fresh `{ isOpen, setIsOpen, containerRef, _state: isOpen }` objects (each `useDropdownSlot()` call returns a *new* object literal even though `setIsOpen` and `containerRef` are stable). The `mousedown` effect's dep array is `[anyOpen]` only, so the effect re-runs and captures the current `slots` snapshot exactly when `anyOpen` transitions false→true. If a *second* dropdown is opened while the first is still open, `anyOpen` stays true, the effect does *not* re-run, and the captured closure still holds the snapshot with the second slot's `isOpen` = `false`. Consequently, a click outside the second dropdown's `containerRef` does not close it — the `if (slot.isOpen && ...)` guard short-circuits on the stale `false` flag.

Same closure-staleness applies to the Escape effect, but there it is benign: `setIsOpen(false)` is idempotent on already-closed slots, so calling it on a stale-snapshot slot still closes the live one.

**Fix:** Drop the eslint-disable and either include the live `slot.isOpen` flags in deps (e.g. a derived `openMask` string) or read state from refs so the listener always sees current values. Minimal patch using a ref:

```ts
const slotsRef = useRef(slots)
slotsRef.current = slots
useEffect(() => {
    if (!anyOpen) return
    const handleClickOutside = (event: MouseEvent) => {
        for (const slot of slotsRef.current) {
            if (slot.isOpen && slot.containerRef.current && !slot.containerRef.current.contains(event.target as Node)) {
                slot.setIsOpen(false)
            }
        }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
}, [anyOpen])
```

Add a regression test that opens dropdown A, then opens dropdown B, then dispatches a mousedown outside both — both should close.

### WR-03: `registerMessageWindowPersistence` registration is load-order-dependent and silently no-ops on direct state imports

**File:** `web/src/lib/messageWindowPersistence.ts:114-115`; consumer at `web/src/lib/messageWindowState.ts:177-185`

**Issue:** The 09-04 cycle fix inverts the `state ↔ persistence` dependency by having `messageWindowPersistence.ts` self-register `schedulePersist` + `hydrateState` via a module top-level call:

```ts
// eslint-disable-next-line @typescript-eslint/no-use-before-define
registerMessageWindowPersistence({ schedulePersist, hydrateState })
```

`getState` in `messageWindowState.ts` then calls `persistenceHooks?.hydrateState(sessionId) ?? createState(sessionId)`. If `persistenceHooks` is `null` because the persistence module hasn't been loaded yet, hydration is silently skipped. The current safe path is the facade (`message-window-store.ts` → `messageWindowSubscriptions.ts` → `import './messageWindowPersistence'`), but:

- `messageWindowMergeService.ts`, `messageWindowPaginationService.ts`, `messageWindowTrim.ts`, and `messageWindowSubscriptions.ts` all `import {...} from './messageWindowState'` directly. They happen to be loaded only via the facade today, but a future direct importer (an SSR helper, a worker, a non-test consumer) that doesn't transitively pull persistence will lose sessionStorage hydration with no error.
- Unit tests that import `messageWindowState` directly (`messageWindowState.test.ts`) will sometimes hydrate and sometimes not depending on whether another test file in the same vitest process happened to load persistence first. The "single-Map ownership" claim in the 09-02 SUMMARY makes this fragility easy to overlook.

**Fix (in order of preference):**
1. Make registration explicit at the facade entry point: have `message-window-store.ts` call `registerMessageWindowPersistence(...)` once on first use, and remove the module-load side-effect from `messageWindowPersistence.ts`. Sub-modules that need persistence semantics import the facade instead of `./messageWindowState`.
2. Or, at minimum, add a `console.warn` (gated on `import.meta.env.DEV`) inside `getState` when `persistenceHooks === null` and a persisted entry would otherwise have been hydrated — flag the load-order misconfiguration loudly during development.
3. Add a deterministic test that imports only `./messageWindowState` (no facade, no persistence module), seeds `sessionStorage`, and asserts `getMessageWindowState(sessionId).messages.length === 0` — i.e. document the "no hydration without facade" contract so a future change can't silently regress it the other direction.

## Info

### IN-01: `useSessionListData` — inline `resolveMachineLabel` defeats `useMemo` caching

**File:** `web/src/components/SessionList.tsx:53-61` (caller); `web/src/components/SessionList/useSessionListData.ts:191-207` (memo deps)

**Issue:** `resolveMachineLabel` is declared inline inside `SessionList.tsx` on every render and passed into `useSessionListData`, which uses it as a dep in `visibleSessions` and `machineGroups` `useMemo` calls. Because the function identity changes every render, the memos always recompute. Performance is out-of-scope for this review, but this also means tests that assert "no extra renders on prop X change" can't rely on memo stability here.

**Fix:** Wrap with `useCallback([machineLabelsById, t])` in `SessionList.tsx`. Same shape as the pre-refactor file — preserves stability without affecting the public surface.

### IN-02: `useSessionListData` — `useMemo(() => sessions, [sessions])` is a no-op

**File:** `web/src/components/SessionList/useSessionListData.ts:189`

**Issue:** `const allSessions = useMemo(() => sessions, [sessions])` returns the exact same reference as `sessions`. Drop the `useMemo` and use `sessions` directly (or rename to clarify intent — there is no compute being memoised).

**Fix:** `const allSessions = sessions` (and update the two downstream `useMemo([allSessions, ...])` deps to `[sessions, ...]`).

### IN-03: `messageWindowState.scheduleNotify` uses a sentinel `-1` cast for `notifyRafId`

**File:** `web/src/lib/messageWindowState.ts:87`

**Issue:** `notifyRafId = -1 as unknown as ReturnType<typeof requestAnimationFrame>` is a type-system escape hatch to communicate "setTimeout pending, RAF not yet scheduled" via the same slot as the real RAF id. The double-cast hides intent and risks confusion if any future code checks `if (notifyRafId > 0)` (which would now be false for the pending state).

**Fix:** Introduce a separate boolean flag (e.g. `let notifyScheduled = false`) and use `notifyRafId` only for real RAF ids. Clears the cast without behaviour change.

### IN-04: `useHappyComposerHandlers` global keydown effect re-registers on every parent render that passes a new `availableModelOptions` array

**File:** `web/src/components/AssistantChat/useHappyComposerHandlers.ts:181-192`

**Issue:** The effect deps `[model, onModelChange, haptic, agentFlavor, availableModelOptions]` include `availableModelOptions` (an `Array<...>` prop). If the caller passes a fresh array literal on each render — common pattern — the effect tears down and re-installs the global `keydown` listener on every render. Functionally harmless (handler closure stays correct via the new registration) but creates listener churn and complicates debugging if a user reports flaky `Cmd+M` behaviour.

**Fix:** Pull `availableModelOptions` into a `useRef` mirror updated in a separate effect, and read from the ref inside the handler — same pattern used to stabilise the `slots` array in WR-02.

---

_Reviewed: 2026-05-23T08:56:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
