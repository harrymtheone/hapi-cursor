import { describe, expect, it } from 'vitest'
import { resolveCommand } from './registry'
import { hubCommand } from './hub'
import { cursorCommand } from './cursor'

describe('resolveCommand — retired `server` alias', () => {
    it('throws an Error whose message names both `hapi server` and `hapi hub`', () => {
        expect(() => resolveCommand(['server'])).toThrow(/hapi server/)
        expect(() => resolveCommand(['server'])).toThrow(/hapi hub/)
    })

    it('throws on `server` regardless of trailing args', () => {
        expect(() => resolveCommand(['server', '--host', '0.0.0.0'])).toThrow(/hapi hub/)
    })
})

describe('resolveCommand — regression guards', () => {
    it('`hub` still resolves to hubCommand', () => {
        const { command } = resolveCommand(['hub'])
        expect(command).toBe(hubCommand)
    })

    it('empty args fall through to cursorCommand (unchanged behavior)', () => {
        const { command } = resolveCommand([])
        expect(command).toBe(cursorCommand)
    })
})
