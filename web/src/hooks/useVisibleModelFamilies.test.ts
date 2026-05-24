import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
    VISIBLE_FAMILIES_CONFIGURED_KEY,
    VISIBLE_FAMILIES_STORAGE_KEY,
    useVisibleModelFamilies,
} from './useVisibleModelFamilies'

describe('useVisibleModelFamilies', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('returns visibleKeys null when storage key is unset', () => {
        const { result } = renderHook(() => useVisibleModelFamilies())
        expect(result.current.visibleKeys).toBeNull()
        expect(result.current.isConfigured).toBe(false)
        expect(result.current.isFamilyVisible('claude-opus-4-7')).toBe(true)
    })

    it('treats malformed JSON as unset (all visible)', () => {
        window.localStorage.setItem(VISIBLE_FAMILIES_STORAGE_KEY, '{not-json')
        const { result } = renderHook(() => useVisibleModelFamilies())
        expect(result.current.visibleKeys).toBeNull()
        expect(result.current.isFamilyVisible('any-family')).toBe(true)
    })

    it('hides all families when configured with empty array', () => {
        window.localStorage.setItem(VISIBLE_FAMILIES_CONFIGURED_KEY, 'true')
        window.localStorage.setItem(VISIBLE_FAMILIES_STORAGE_KEY, '[]')
        const { result } = renderHook(() => useVisibleModelFamilies())
        expect(result.current.visibleKeys).toEqual([])
        expect(result.current.isConfigured).toBe(true)
        expect(result.current.isFamilyVisible('claude-opus-4-7')).toBe(false)
    })

    it('respects partial visible family list', () => {
        window.localStorage.setItem(VISIBLE_FAMILIES_CONFIGURED_KEY, 'true')
        window.localStorage.setItem(
            VISIBLE_FAMILIES_STORAGE_KEY,
            JSON.stringify(['composer-2', 'gpt-5.3-codex'])
        )
        const { result } = renderHook(() => useVisibleModelFamilies())
        expect(result.current.isFamilyVisible('composer-2')).toBe(true)
        expect(result.current.isFamilyVisible('claude-opus-4-7')).toBe(false)
    })

    it('setVisibleFamilies writes configured flag and filters auto', () => {
        const { result } = renderHook(() => useVisibleModelFamilies())
        act(() => {
            result.current.setVisibleFamilies(['composer-2', 'auto', 'gpt-5.3-codex'])
        })
        expect(window.localStorage.getItem(VISIBLE_FAMILIES_CONFIGURED_KEY)).toBe('true')
        expect(JSON.parse(window.localStorage.getItem(VISIBLE_FAMILIES_STORAGE_KEY)!)).toEqual([
            'composer-2',
            'gpt-5.3-codex',
        ])
        expect(result.current.visibleKeys).toEqual(['composer-2', 'gpt-5.3-codex'])
    })

    it('syncs across tabs via storage event', () => {
        const { result } = renderHook(() => useVisibleModelFamilies())
        act(() => {
            window.localStorage.setItem(VISIBLE_FAMILIES_CONFIGURED_KEY, 'true')
            window.localStorage.setItem(
                VISIBLE_FAMILIES_STORAGE_KEY,
                JSON.stringify(['composer-2'])
            )
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: VISIBLE_FAMILIES_STORAGE_KEY,
                    newValue: JSON.stringify(['composer-2']),
                })
            )
        })
        expect(result.current.visibleKeys).toEqual(['composer-2'])
        expect(result.current.isConfigured).toBe(true)
    })

    it('summaryLabel reflects all, count, and none', () => {
        const { result } = renderHook(() => useVisibleModelFamilies())
        expect(result.current.summaryLabel(6, 6)).toBe('all')
        act(() => {
            result.current.setVisibleFamilies(['composer-2', 'gpt-5.3-codex', 'claude-opus-4-7'])
        })
        expect(result.current.summaryLabel(6, 3)).toBe('count')
        act(() => {
            result.current.setVisibleFamilies([])
        })
        expect(result.current.summaryLabel(6, 0)).toBe('none')
    })
})
