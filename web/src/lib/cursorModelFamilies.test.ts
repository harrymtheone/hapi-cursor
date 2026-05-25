import { describe, expect, it } from 'vitest'
import type { CursorModelSummary } from '@hapi/protocol/types'
import {
    composeVariantId,
    decomposeModelId,
    formatFamilySummary,
    getEnabledContextModes,
    groupModelsIntoFamilies,
    selectionSupportsOption,
} from './cursorModelFamilies'

/** Fixture ids from live `agent models` samples (RESEARCH). */
export const RESEARCH_MODEL_FIXTURES: CursorModelSummary[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'composer-2', label: 'Composer 2' },
    { id: 'composer-2-fast', label: 'Composer 2 Fast' },
    { id: 'gpt-5.3-codex-high-fast', label: 'Codex 5.3 High Fast' },
    {
        id: 'claude-opus-4-7-thinking-medium-fast',
        label: 'Opus 4.7 1M Medium Thinking Fast',
    },
    { id: 'claude-4.6-opus-high-thinking', label: 'Opus 4.6 1M Thinking' },
    { id: 'claude-4.6-sonnet-medium', label: 'Sonnet 4.6 1M' },
]

describe('groupModelsIntoFamilies', () => {
    it('excludes auto from families', () => {
        const families = groupModelsIntoFamilies(RESEARCH_MODEL_FIXTURES)
        expect(families.map((f) => f.key)).not.toContain('auto')
        expect(families.some((f) => f.variants.some((v) => v.id === 'auto'))).toBe(false)
    })

    it('groups RESEARCH fixture ids into expected families', () => {
        const families = groupModelsIntoFamilies(RESEARCH_MODEL_FIXTURES)
        const keys = families.map((f) => f.key).sort()
        expect(keys).toEqual([
            'claude-4.6-opus',
            'claude-4.6-sonnet',
            'claude-opus-4-7',
            'composer-2',
            'gpt-5.3-codex',
        ])
    })

    it('keeps composer-2 and composer-2.5 as separate families', () => {
        const models: CursorModelSummary[] = [
            { id: 'composer-2', label: 'Composer 2' },
            { id: 'composer-2-fast', label: 'Composer 2 Fast' },
            { id: 'composer-2.5', label: 'Composer 2.5' },
            { id: 'composer-2.5-fast', label: 'Composer 2.5 Fast (default)' },
        ]
        const families = groupModelsIntoFamilies(models)
        expect(families.map((f) => f.key).sort()).toEqual(['composer-2', 'composer-2.5'])
        const c25 = families.find((f) => f.key === 'composer-2.5')
        expect(c25?.displayName).toBe('Composer 2.5')
        expect(c25?.variants).toHaveLength(2)
        expect(composeVariantId(c25!, {})).toBe('composer-2.5')
    })

    it('assigns human-readable display names from labels', () => {
        const families = groupModelsIntoFamilies(RESEARCH_MODEL_FIXTURES)
        const byKey = Object.fromEntries(families.map((f) => [f.key, f.displayName]))
        expect(byKey['composer-2']).toBe('Composer 2')
        expect(byKey['gpt-5.3-codex']).toBe('Codex 5.3')
        expect(byKey['claude-opus-4-7']).toBe('Opus 4.7')
        expect(byKey['claude-4.6-opus']).toBe('Opus 4.6')
        expect(byKey['claude-4.6-sonnet']).toBe('Sonnet 4.6')
    })

    it('groups gpt-5.x effort variants into one family per version', () => {
        const models: CursorModelSummary[] = [
            { id: 'gpt-5.2', label: 'GPT-5.2' },
            { id: 'gpt-5.2-low', label: 'GPT-5.2 Low' },
            { id: 'gpt-5.2-high', label: 'GPT-5.2 High' },
            { id: 'gpt-5.2-high-fast', label: 'GPT-5.2 High Fast' },
            { id: 'gpt-5.5-medium', label: 'GPT-5.5 1M' },
            { id: 'gpt-5.5-extra-high-fast', label: 'GPT-5.5 Extra High Fast' },
        ]
        const families = groupModelsIntoFamilies(models)
        const keys = families.map((f) => f.key).sort()
        expect(keys).toEqual(['gpt-5.2', 'gpt-5.5'])
        const gpt52 = families.find((f) => f.key === 'gpt-5.2')
        expect(gpt52?.variants).toHaveLength(4)
        expect(gpt52?.displayName).toBe('GPT-5.2')
    })

    it('keeps gpt mini and nano as separate families from base gpt-5.4', () => {
        const models: CursorModelSummary[] = [
            { id: 'gpt-5.4-medium', label: 'GPT-5.4 1M' },
            { id: 'gpt-5.4-mini-medium', label: 'GPT-5.4 Mini' },
            { id: 'gpt-5.4-nano-low', label: 'GPT-5.4 Nano Low' },
        ]
        const families = groupModelsIntoFamilies(models)
        expect(families.map((f) => f.key).sort()).toEqual([
            'gpt-5.4',
            'gpt-5.4-mini',
            'gpt-5.4-nano',
        ])
    })

    it('groups gpt-5.1-codex-max variants under codex-max family key', () => {
        const models: CursorModelSummary[] = [
            { id: 'gpt-5.1-codex-max-medium', label: 'Codex 5.1 Max' },
            { id: 'gpt-5.1-codex-max-high-fast', label: 'Codex 5.1 Max High Fast' },
        ]
        const families = groupModelsIntoFamilies(models)
        expect(families).toHaveLength(1)
        expect(families[0]!.key).toBe('gpt-5.1-codex-max')
        expect(families[0]!.variants).toHaveLength(2)
    })

    it('has unique display names across families', () => {
        const models: CursorModelSummary[] = [
            { id: 'gpt-5.1', label: 'GPT-5.1' },
            { id: 'gpt-5.1-low', label: 'GPT-5.1 Low' },
            { id: 'gpt-5.1-high', label: 'GPT-5.1 High' },
            { id: 'gpt-5.2', label: 'GPT-5.2' },
            { id: 'gpt-5.2-xhigh', label: 'GPT-5.2 Extra High' },
            { id: 'gpt-5.4-low', label: 'GPT-5.4 1M Low' },
            { id: 'gpt-5.4-medium', label: 'GPT-5.4 1M' },
            { id: 'gpt-5.5-none', label: 'GPT-5.5 1M None' },
            { id: 'gpt-5.5-medium', label: 'GPT-5.5 1M' },
        ]
        const families = groupModelsIntoFamilies(models)
        const displayNames = families.map((f) => f.displayName)
        expect(new Set(displayNames).size).toBe(displayNames.length)
    })
})

describe('selectionSupportsOption', () => {
    it('picks standard context when context1m is false', () => {
        const models: CursorModelSummary[] = [
            { id: 'gpt-5.5-medium', label: 'GPT-5.5 1M' },
            { id: 'gpt-5.5-medium-fast', label: 'GPT-5.5 Fast' },
        ]
        const families = groupModelsIntoFamilies(models)
        const family = families.find((f) => f.key === 'gpt-5.5')!
        expect(composeVariantId(family, { context1m: false })).toBe('gpt-5.5-medium-fast')
        expect(getEnabledContextModes(family)).toEqual(['standard', '1m'])
    })

    it('reports no thinking support for families without thinking variants', () => {
        const models: CursorModelSummary[] = [{ id: 'gpt-5.5-medium', label: 'GPT-5.5 1M' }]
        const family = groupModelsIntoFamilies(models)[0]!
        expect(selectionSupportsOption(family, { thinking: true })).toBe(false)
    })

    it('enables thinking when a matching variant exists for the current effort', () => {
        const models: CursorModelSummary[] = [
            { id: 'claude-opus-4-7-medium', label: 'Opus 4.7 1M Medium' },
            { id: 'claude-opus-4-7-thinking-medium', label: 'Opus 4.7 1M Medium Thinking' },
        ]
        const family = groupModelsIntoFamilies(models)[0]!
        expect(selectionSupportsOption(family, { thinking: true }, { effort: 'medium' })).toBe(true)
        expect(selectionSupportsOption(family, { thinking: true }, { effort: 'low' })).toBe(false)
    })
})

describe('composeVariantId', () => {
    it('returns only ids that exist on family.variants', () => {
        const families = groupModelsIntoFamilies(RESEARCH_MODEL_FIXTURES)
        for (const family of families) {
            const composed = composeVariantId(family, {})
            if (composed !== null) {
                expect(family.variants.some((v) => v.id === composed)).toBe(true)
            }
        }
    })

    it('prefers base variant without thinking or fast when selection is empty', () => {
        const families = groupModelsIntoFamilies(RESEARCH_MODEL_FIXTURES)
        const composer = families.find((f) => f.key === 'composer-2')
        expect(composer).toBeDefined()
        expect(composeVariantId(composer!, {})).toBe('composer-2')
    })

    it('composes explicit option combinations when a variant exists', () => {
        const families = groupModelsIntoFamilies(RESEARCH_MODEL_FIXTURES)
        const codex = families.find((f) => f.key === 'gpt-5.3-codex')
        expect(composeVariantId(codex!, { effort: 'high', fast: true })).toBe(
            'gpt-5.3-codex-high-fast'
        )
    })

    it('returns null for impossible option combinations', () => {
        const families = groupModelsIntoFamilies(RESEARCH_MODEL_FIXTURES)
        const composer = families.find((f) => f.key === 'composer-2')
        expect(
            composeVariantId(composer!, { thinking: true, effort: 'max', fast: true })
        ).toBeNull()
    })
})

describe('decomposeModelId', () => {
    it('decomposes non-1m variant with context1m false', () => {
        const models: CursorModelSummary[] = [
            { id: 'gpt-5.5-medium-fast', label: 'GPT-5.5 Fast' },
        ]
        const families = groupModelsIntoFamilies(models)
        const decomposed = decomposeModelId('gpt-5.5-medium-fast', families)
        expect(decomposed?.selection.context1m).toBe(false)
    })

    it('round-trips composed ids for fixture families', () => {
        const families = groupModelsIntoFamilies(RESEARCH_MODEL_FIXTURES)
        for (const family of families) {
            for (const variant of family.variants) {
                const decomposed = decomposeModelId(variant.id, families)
                expect(decomposed).not.toBeNull()
                expect(decomposed!.familyKey).toBe(family.key)
                expect(composeVariantId(family, decomposed!.selection)).toBe(variant.id)
            }
        }
    })
})

describe('formatFamilySummary', () => {
    it('formats family and option parts for status display', () => {
        const families = groupModelsIntoFamilies(RESEARCH_MODEL_FIXTURES)
        const decomposed = decomposeModelId('claude-opus-4-7-thinking-medium-fast', families)
        expect(decomposed).not.toBeNull()
        const summary = formatFamilySummary(decomposed!)
        expect(summary).toContain('Opus 4.7')
        expect(summary).toMatch(/Medium|Thinking|Fast/)
    })
})
