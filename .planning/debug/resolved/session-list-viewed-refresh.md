---
status: resolved
trigger: "GSD UAT gap Test 6: refreshed page makes previously viewed completed non-selected sessions turn green again while current viewed chat remains gray"
created: 2026-05-24T06:11:00Z
updated: 2026-05-24T06:30:00Z
---

## Current Focus

hypothesis: "Refresh-time empty sessions from useSessions causes SessionList prune effect to erase persisted viewed markers before real sessions load; selected route then re-marks only the current session"
test: "Trace useSessions initial data, SessionList prune effect, and selectedSessionId auto-mark effect"
expecting: "If true, useSessions returns [] before query data, prune saves {}, and only selectedSessionId is written back after sessions load"
next_action: "Return root-cause diagnosis only; do not modify production code"

## Symptoms

expected: "Completed sessions turn green until opened/viewed, then gray; after refresh/reconnect/refetch, viewed completions stay gray while a new completion marker becomes green again."
actual: "After page refresh, all sessions except the currently viewed chat session change from gray to green."
errors: "No thrown error reported."
reproduction: "Test 6 in .planning/phases/01-cursor-runtime-config-contract/01-UAT.md"
started: "Discovered during UAT"

## Eliminated

## Evidence

- timestamp: 2026-05-24T06:11:00Z
  checked: ".planning/phases/01-cursor-runtime-config-contract/01-UAT.md and 01-20-SUMMARY.md"
  found: "UAT Test 6 reports viewed completed sessions should persist gray across refresh; 01-20 claims localStorage-backed viewedCompletionMarkers with prune effect dropping absent-session and stale-marker entries."
  implication: "Likely fault is in actual persistence/pruning/selection behavior, not in the intended design."
- timestamp: 2026-05-24T06:13:00Z
  checked: "web/src/hooks/queries/useSessions.ts and web/src/hooks/queries/_factory.ts"
  found: "useSessions returns data from createApiQuery; createApiQuery computes data as spec.select(query.data), and useSessions select maps undefined query data to []."
  implication: "On refresh before getSessions resolves, SessionList receives props.sessions = [] while isLoading is true."
- timestamp: 2026-05-24T06:14:00Z
  checked: "web/src/components/SessionList.tsx prune effect"
  found: "The prune effect runs for every props.sessions change, builds liveMarkers from props.sessions, and removes every persisted marker not present in liveMarkers, then saveViewedCompletionMarkers(next). It does not check isLoading or whether the empty list is authoritative."
  implication: "A refresh-time loading render with sessions=[] deletes all persisted viewed completion markers from localStorage."
- timestamp: 2026-05-24T06:15:00Z
  checked: "web/src/components/SessionList.tsx selected-session effect and row rendering"
  found: "After real sessions load, selectedSessionId effect calls markCompletionViewed only for the selected session. Row unread/viewed state is computed from viewedCompletionMarkers[s.id] === s.completionMarker."
  implication: "The currently open chat is written back to localStorage and stays gray, while other previously viewed completed sessions remain missing from viewedCompletionMarkers and render as green unread completions."
- timestamp: 2026-05-24T06:15:00Z
  checked: "web/src/components/SessionList.viewed-persistence.test.tsx"
  found: "Tests cover hydrate with immediate non-empty sessions, write-through for selected completed session, pruning stale entries, and storage failure. They do not cover refresh/load sequence where localStorage has multiple viewed markers and the first render passes sessions=[]."
  implication: "Existing regression coverage misses the exact asymmetry reported in UAT."

## Resolution

root_cause: "SessionList's prune effect treats the initial loading-time empty sessions array as authoritative and writes an empty viewedCompletionMarkers map to localStorage. When the real session list arrives, the selected-session effect re-marks only the currently opened chat, leaving other previously viewed completions erased and therefore green/unread."
fix: "Gate pruning so it only runs against an authoritative loaded session list, or otherwise avoid saving pruned storage from transient loading/empty query data; add a regression test for empty-first-render followed by hydrated sessions."
verification: "Diagnosed by static trace of useSessions initial [] -> SessionList prune save {} -> selectedSessionId markCompletionViewed(selected only) -> row completionViewed lookup."
files_changed: []
