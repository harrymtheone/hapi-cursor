import { useMemo } from 'react'

/**
 * Placeholder keyboard hook for the SessionList orchestrator. The pre-09-02
 * SessionList had no keyboard navigation, so this hook intentionally returns
 * empty handlers — exposed here as a structural slot so future keyboard
 * navigation (arrow keys / Enter / Esc) can be wired without touching the
 * orchestrator shape again.
 */
export function useSessionListKeyboard() {
    return useMemo(() => ({
        onKeyDown: undefined as undefined | ((event: React.KeyboardEvent) => void),
    }), [])
}
