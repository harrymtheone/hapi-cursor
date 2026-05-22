import { describe, expect, it } from 'vitest'
import { getModelOptionsForFlavor, getNextModelForFlavor } from './modelOptions'

describe('getModelOptionsForFlavor', () => {
    it('returns an empty list when no custom options are provided', () => {
        expect(getModelOptionsForFlavor('cursor')).toEqual([])
    })

    it('includes the current custom model when it is missing from explicit options', () => {
        const options = getModelOptionsForFlavor('cursor', 'gpt-legacy', [
            { value: 'gpt-5.5', label: 'GPT-5.5' }
        ])
        expect(options).toEqual([
            { value: 'gpt-legacy', label: 'gpt-legacy' },
            { value: 'gpt-5.5', label: 'GPT-5.5' }
        ])
    })
})

describe('getNextModelForFlavor', () => {
    it('returns null when no custom options are provided', () => {
        expect(getNextModelForFlavor('cursor', null)).toBeNull()
    })

    it('cycles explicit model options', () => {
        const next = getNextModelForFlavor('cursor', 'gpt-5.5', [
            { value: 'gpt-5.5', label: 'GPT-5.5' },
            { value: 'gpt-5.4', label: 'GPT-5.4' }
        ])
        expect(next).toBe('gpt-5.4')
    })

    it('does not choose auto when cycling explicit model options from an unknown current model', () => {
        const next = getNextModelForFlavor('cursor', 'gpt-legacy', [
            { value: 'gpt-5.5', label: 'GPT-5.5' },
            { value: 'gpt-5.4', label: 'GPT-5.4' }
        ])
        expect(next).toBe('gpt-5.5')
    })
})
