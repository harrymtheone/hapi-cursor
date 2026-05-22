import { describe, expect, it } from 'vitest'
import { getContextBudgetTokens } from './modelConfig'

describe('getContextBudgetTokens', () => {
    it('returns null for cursor sessions (no capability budget defined)', () => {
        expect(getContextBudgetTokens(null, 'cursor')).toBeNull()
    })

    it('returns null for unknown flavors', () => {
        expect(getContextBudgetTokens('any-model', 'unknown')).toBeNull()
        expect(getContextBudgetTokens(null, null)).toBeNull()
    })
})
