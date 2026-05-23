import { describe, expect, it } from 'bun:test'
import type { Session } from './schemas'
import { toSessionSummary } from './sessionSummary'

function makeSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 'session-1',
        seq: 1,
        createdAt: 1_000,
        updatedAt: 2_000,
        active: false,
        activeAt: 0,
        metadata: {
            path: '/repo',
            host: 'local'
        },
        metadataVersion: 1,
        agentState: null,
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: 0,
        backgroundTaskCount: 0,
        model: null,
        modelReasoningEffort: null,
        effort: null,
        permissionMode: 'default',
        ...overrides
    }
}

describe('toSessionSummary status fields', () => {
    it('derives idle status for a blank active Cursor session', () => {
        const summary = toSessionSummary(makeSession({
            active: true,
            thinking: false,
            backgroundTaskCount: 0,
            agentState: null
        }))

        expect(summary.statusKind).toBe('idle')
        expect(summary.completionMarker).toBeNull()
        expect(summary.errorMarker).toBeNull()
    })

    it('derives thinking status from active thinking sessions', () => {
        const summary = toSessionSummary(makeSession({ active: true, thinking: true }))

        expect(summary.statusKind).toBe('thinking')
        expect(summary.completionMarker).toBeNull()
        expect(summary.errorMarker).toBeNull()
    })

    it('derives waiting status from pending agent requests', () => {
        const summary = toSessionSummary(makeSession({
            agentState: {
                controlledByUser: false,
                requests: {
                    approval: {
                        tool: 'edit',
                        arguments: {},
                        createdAt: 1_500
                    }
                }
            }
        }))

        expect(summary.statusKind).toBe('waiting')
    })

    it('derives running status from background work instead of active liveness alone', () => {
        const summary = toSessionSummary(makeSession({
            active: true,
            backgroundTaskCount: 1
        }))

        expect(summary.statusKind).toBe('running')
    })

    it('derives completed status and marker from completed end reason', () => {
        const summary = toSessionSummary(makeSession({
            updatedAt: 3_000,
            endReason: 'completed'
        }))

        expect(summary.statusKind).toBe('completed')
        expect(summary.completionMarker).toBe(3_000)
        expect(summary.errorMarker).toBeNull()
    })

    it('derives error status and marker from error end reason', () => {
        const summary = toSessionSummary(makeSession({
            updatedAt: 4_000,
            endReason: 'error'
        }))

        expect(summary.statusKind).toBe('error')
        expect(summary.errorMarker).toBe(4_000)
        expect(summary.completionMarker).toBeNull()
    })
})
