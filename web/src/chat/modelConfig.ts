import { getCapability } from '@hapi/protocol'

/**
 * Context windows vary by model/provider and may change over time.
 *
 * The UI only needs this to compute a conservative "context remaining" warning.
 * We intentionally keep a headroom budget to avoid false confidence near the limit
 * (system prompts, tool overhead, and other hidden tokens can consume extra space).
 *
 * If/when the server provides an explicit per-session context limit, prefer that
 * and use this only as a fallback.
 */
const CONTEXT_HEADROOM_TOKENS = 10_000

/**
 * Returns a Cursor session's context budget (capability-driven; `null` when no
 * budget is registered for the flavor). The `_model` parameter is reserved for
 * `CURS-01` model presets (per-model context budgets) and is currently unused —
 * the budget is derived solely from the flavor capability table.
 */
export function getContextBudgetTokens(_model: string | null | undefined, flavor?: string | null): number | null {
    const windowTokens = getCapability(flavor, 'contextBudgetTokens')
    if (windowTokens === null) return null
    return Math.max(1, windowTokens - CONTEXT_HEADROOM_TOKENS)
}
