---
session: session-list-spinner-stuck
phase: 01-cursor-runtime-config-contract
test: 5
status: resolved
resolved_by: "01-19-PLAN.md, 01-20-PLAN.md"
resolved_date: "2026-05-24"
updated: 2026-05-24T03:35:00Z
---

# Debug: Test 5 – Session list status stuck and viewed markers reset on refresh

## Symptoms

User UAT report:
1. While viewing a single chat session, its spinner correctly switches to a gray idle dot when the agent finishes.
2. When the user **switches to a different chat session**, the previously-running session's spinner is **stuck**; it does not auto-update to gray/green even after that agent's turn completes.
3. With multiple completed sessions showing green unread dots, opening one turns it gray (viewed). After **page refresh**, every gray dot reverts to green **except the currently-selected session**.

## Root cause #1 — SSE subscription narrows to a single session on session pages

`web/src/App.tsx:274-279` builds the SSE subscription scope based on the currently selected session:

```274:279:web/src/App.tsx
    const eventSubscription = useMemo(() => {
        if (selectedSessionId) {
            return { sessionId: selectedSessionId }
        }
        return { all: true }
    }, [selectedSessionId])
```

When the user navigates into a session, the client closes the `all: true` stream and opens a `sessionId: <id>` scoped stream. The Hub filters `session-updated` events to that one session id, so the rest of the session list **stops receiving status/completion patches**. The other sessions therefore freeze at whichever `statusKind` was last cached (e.g. `running`/`thinking`), and `useSSE.patchSessionSummary` never gets a chance to converge them to `idle`/`completed`.

This matches the user-reported behavior exactly: the spinner you see for "other sessions" while inside one is whatever Hub last broadcast over the previous `all: true` window; once subscribed to a single session, no new patches arrive for the others.

`SessionList`'s display is fed from `queryClient`'s `queryKeys.sessions` cache; it does **not** poll or re-fetch on a timer, so the stale status sticks until the user navigates back to a list-only route (re-enabling `all: true`).

## Root cause #2 — Viewed completion markers are React-only state with no persistence

`web/src/components/SessionList.tsx:85` declares the viewed-completed state as plain `useState` and never persists it:

```85:101:web/src/components/SessionList.tsx
    const [viewedCompletionMarkers, setViewedCompletionMarkers] = useState<Record<string, number>>({})

    const markCompletionViewed = useCallback((session: SessionSummary) => {
        const marker = session.completionMarker
        if (session.statusKind !== 'completed' || marker === null) {
            return
        }
        setViewedCompletionMarkers((previous) => {
            if (previous[session.id] === marker) {
                return previous
            }
            return {
                ...previous,
                [session.id]: marker
            }
        })
    }, [])
```

On every page mount/refresh this map starts empty. The only auto-re-mark is for the currently selected session, in the effect at lines 103-111:

```103:111:web/src/components/SessionList.tsx
    useEffect(() => {
        if (!selectedSessionId) {
            return
        }
        const selectedSession = props.sessions.find((session) => session.id === selectedSessionId)
        if (selectedSession) {
            markCompletionViewed(selectedSession)
        }
    }, [markCompletionViewed, props.sessions, selectedSessionId])
```

Therefore after refresh, every completed session whose `completionMarker` is not in `viewedCompletionMarkers` is treated as **unread** again — so it shows green. Only the active session is re-marked because of the effect above.

This is consistent with the Plan 01-08 decision in `01-08-SUMMARY.md`:
> "Viewed completion state remains in Web state instead of shared protocol state. It represents local user read state, not runtime session truth."

The team intentionally chose to keep read state local, but did not add browser-side persistence, so refresh wipes it.

## Files involved

- `web/src/App.tsx` – Narrows SSE subscription to a single session when a chat session is open.
- `web/src/hooks/useSSE.ts` – Only converges patches for sessions present in the current subscription window.
- `web/src/components/SessionList.tsx` – `viewedCompletionMarkers` is React-only state, no persistence; only the currently selected session is re-marked on mount.

## Suggested fix direction (for plan-phase --gaps)

For symptom 1/2 (stuck spinner on other sessions while inside one):
- Always subscribe to `all: true` so the global session list keeps converging. Pair it with a session-id filter on the client if the goal of the narrow subscription was bandwidth — but the list status must be globally accurate.
- Alternatively, layer two subscriptions: a persistent `all: true` for the list, plus a `sessionId` stream for the open session. The hook currently supports only one EventSource at a time, so this would require a second `useSSE` invocation or a Hub-side broadcast strategy that includes list-level status patches even on session-scoped streams.

For symptom 3 (viewed markers reset after refresh):
- Persist `viewedCompletionMarkers` to `localStorage` (or IndexedDB), keyed by user/session, and restore on mount before computing list rows. Cap the store and prune deleted sessions.
- Add a regression test: mount `SessionList` with seeded `localStorage`, expect the seeded sessions to render as viewed (gray) without requiring re-click.
