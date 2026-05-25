import { beforeEach, describe, expect, it } from 'vitest'
import type { ToolCallProjection } from '@hapi/protocol'
import {
    clearProjectionsForSession,
    getProjectionsForSession,
    mergePageToolCalls,
    patchProjection,
} from './toolProjectionStore'

function makeProjection(overrides: Partial<ToolCallProjection> = {}): ToolCallProjection {
    return {
        callId: 'call-1',
        name: 'Bash',
        input: { command: 'ls' },
        status: 'completed',
        startedAt: 1_700_000_000_000,
        ...overrides,
    }
}

describe('toolProjectionStore', () => {
    beforeEach(() => {
        clearProjectionsForSession('session-1')
        clearProjectionsForSession('session-2')
    })

    it('mergePageToolCalls retains prior callIds when new page adds different ids', () => {
        mergePageToolCalls('session-1', {
            'call-1': makeProjection({ callId: 'call-1', name: 'Bash' }),
        })
        mergePageToolCalls('session-1', {
            'call-2': makeProjection({ callId: 'call-2', name: 'Read' }),
        })
        const result = getProjectionsForSession('session-1')
        expect(result['call-1']).toBeDefined()
        expect(result['call-2']).toBeDefined()
        expect(result['call-1']?.name).toBe('Bash')
        expect(result['call-2']?.name).toBe('Read')
    })

    it('clearProjectionsForSession empties session entry', () => {
        mergePageToolCalls('session-1', {
            'call-1': makeProjection({ callId: 'call-1' }),
        })
        clearProjectionsForSession('session-1')
        const result = getProjectionsForSession('session-1')
        expect(Object.keys(result)).toHaveLength(0)
    })

    it('patchProjection adds a new callId entry', () => {
        const proj = makeProjection({ callId: 'call-1', name: 'Bash' })
        patchProjection('session-1', 'call-1', proj)
        const result = getProjectionsForSession('session-1')
        expect(result['call-1']?.name).toBe('Bash')
    })

    it('patchProjection does not overwrite other callIds', () => {
        mergePageToolCalls('session-1', {
            'call-2': makeProjection({ callId: 'call-2', name: 'Read' }),
        })
        patchProjection('session-1', 'call-1', makeProjection({ callId: 'call-1', name: 'Bash' }))
        const result = getProjectionsForSession('session-1')
        expect(result['call-2']?.name).toBe('Read')
        expect(result['call-1']?.name).toBe('Bash')
    })

    it('getProjectionsForSession returns empty object for unknown session', () => {
        const result = getProjectionsForSession('unknown-session')
        expect(result).toEqual({})
    })

    it('mergePageToolCalls is a no-op when toolCalls is empty', () => {
        mergePageToolCalls('session-1', {})
        expect(Object.keys(getProjectionsForSession('session-1'))).toHaveLength(0)
    })

    it('mergePageToolCalls is a no-op when toolCalls is undefined', () => {
        mergePageToolCalls('session-1', undefined)
        expect(Object.keys(getProjectionsForSession('session-1'))).toHaveLength(0)
    })

    it('projections are isolated per session', () => {
        mergePageToolCalls('session-1', {
            'call-1': makeProjection({ callId: 'call-1', name: 'Bash' }),
        })
        mergePageToolCalls('session-2', {
            'call-1': makeProjection({ callId: 'call-1', name: 'Read' }),
        })
        expect(getProjectionsForSession('session-1')['call-1']?.name).toBe('Bash')
        expect(getProjectionsForSession('session-2')['call-1']?.name).toBe('Read')
    })
})
