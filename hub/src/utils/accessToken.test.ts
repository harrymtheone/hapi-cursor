import { describe, expect, it } from 'bun:test'
import { parseAccessToken } from './accessToken'

describe('parseAccessToken', () => {
    it('returns trimmed opaque tokens', () => {
        expect(parseAccessToken(' token ')).toBe('token')
    })

    it('preserves colon-bearing tokens as one secret', () => {
        expect(parseAccessToken('token:alice')).toBe('token:alice')
    })

    it('preserves empty suffixes inside opaque tokens', () => {
        expect(parseAccessToken('token:')).toBe('token:')
    })

    it('preserves empty prefixes inside opaque tokens', () => {
        expect(parseAccessToken(':alice')).toBe(':alice')
    })

    it('rejects empty and whitespace-only tokens', () => {
        expect(parseAccessToken('')).toBeNull()
        expect(parseAccessToken('   ')).toBeNull()
    })
})
