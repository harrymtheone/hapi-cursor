import { describe, expect, it } from 'vitest'
import { isRemoteTerminalSupported, isWindowsHostOs } from './terminalSupport'

describe('terminal support helpers', () => {
    it('does not disable remote terminal only because the session host is Windows', () => {
        expect(isWindowsHostOs('win32')).toBe(true)
        expect(isRemoteTerminalSupported({ path: '' })).toBe(true)
    })

    it('keeps remote terminal enabled for non-Windows or unknown hosts by default', () => {
        expect(isWindowsHostOs('linux')).toBe(false)
        expect(isRemoteTerminalSupported({ path: '' })).toBe(true)
        expect(isRemoteTerminalSupported(null)).toBe(true)
    })
})
