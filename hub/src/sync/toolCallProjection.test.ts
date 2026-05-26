import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import type { ToolCallProjection } from '@hapi/protocol/types'

import { Store } from '../store'
import {
    collectCallIdsFromDecryptedMessages,
    extractToolCallEventsFromMessageContent,
    inferToolNameFromPayload,
    mergeToolCallProjection,
    reconcileSessionToolCalls,
    type ToolCallEvent
} from './toolCallProjection'

// ---- Wire fixtures -------------------------------------------------------

function cursorStartContent(callId: string, name: string, input: unknown): unknown {
    return {
        role: 'agent',
        content: {
            type: 'cursor',
            data: { type: 'tool-call', callId, name, input }
        }
    }
}

function cursorResultContent(callId: string, output: unknown, is_error = false): unknown {
    return {
        role: 'agent',
        content: {
            type: 'cursor',
            data: { type: 'tool-call-result', callId, output, is_error }
        }
    }
}

function legacyAssistantContent(
    toolUseId: string,
    name: string,
    input: unknown,
    result: unknown,
    is_error = false
): unknown {
    return {
        role: 'assistant',
        content: [
            { type: 'tool_use', id: toolUseId, name, input },
            { type: 'tool_result', tool_use_id: toolUseId, content: result, is_error }
        ]
    }
}

function decryptedMessage(id: string, content: unknown, createdAt = 1000) {
    return { id, seq: 1, localId: null, content, createdAt }
}

// ---- Tests ---------------------------------------------------------------

describe('extractToolCallEventsFromMessageContent', () => {
    it('extracts start event from Cursor wire tool-call', () => {
        const events = extractToolCallEventsFromMessageContent(
            cursorStartContent('call-1', 'Bash', { command: 'ls' }),
            1000
        )
        expect(events).toHaveLength(1)
        expect(events[0]).toMatchObject({ kind: 'start', callId: 'call-1', name: 'Bash', at: 1000 })
    })

    it('extracts result event from Cursor wire tool-call-result', () => {
        const events = extractToolCallEventsFromMessageContent(
            cursorResultContent('call-1', 'output text'),
            2000
        )
        expect(events).toHaveLength(1)
        expect(events[0]).toMatchObject({ kind: 'result', callId: 'call-1', isError: false, at: 2000 })
    })

    it('extracts result event with is_error true', () => {
        const events = extractToolCallEventsFromMessageContent(
            cursorResultContent('call-1', 'error text', true),
            3000
        )
        expect(events[0]).toMatchObject({ kind: 'result', callId: 'call-1', isError: true })
    })

    it('extracts start and result events from legacy tool_use + tool_result array', () => {
        const events = extractToolCallEventsFromMessageContent(
            legacyAssistantContent('call-legacy', 'Read', { path: '/tmp' }, 'content here'),
            5000
        )
        expect(events).toHaveLength(2)
        const start = events.find((e) => e.kind === 'start')
        const result = events.find((e) => e.kind === 'result')
        expect(start).toMatchObject({ kind: 'start', callId: 'call-legacy', name: 'Read' })
        expect(result).toMatchObject({ kind: 'result', callId: 'call-legacy', isError: false })
    })

    it('returns empty array for non-agent/assistant content', () => {
        const events = extractToolCallEventsFromMessageContent(
            { role: 'user', content: { text: 'hello' } },
            1000
        )
        expect(events).toHaveLength(0)
    })

    it('returns empty array for null/undefined content', () => {
        expect(extractToolCallEventsFromMessageContent(null, 1000)).toHaveLength(0)
        expect(extractToolCallEventsFromMessageContent(undefined, 1000)).toHaveLength(0)
    })

    it('does not mutate message content (D-03)', () => {
        const content = cursorStartContent('call-1', 'Bash', { command: 'ls' })
        const copy = JSON.parse(JSON.stringify(content))
        extractToolCallEventsFromMessageContent(content, 1000)
        expect(content).toEqual(copy)
    })
})

describe('inferToolNameFromPayload', () => {
    it('maps command/cmd to Bash', () => {
        expect(inferToolNameFromPayload({ command: 'ls' }, null)).toBe('Bash')
        expect(inferToolNameFromPayload({ cmd: 'npm test' }, null)).toBe('Bash')
    })

    it('maps pattern+path to Grep and glob patterns to Glob', () => {
        expect(inferToolNameFromPayload({ pattern: 'foo', path: '/src' }, null)).toBe('Grep')
        expect(inferToolNameFromPayload({ pattern: '**/*.ts' }, null)).toBe('Glob')
        expect(inferToolNameFromPayload({ pattern: '*.ts' }, null)).toBe('Glob')
    })

    it('maps path+read result to Read and path+fileText to Write', () => {
        expect(
            inferToolNameFromPayload({ path: '/foo' }, { success: { content: '...' } })
        ).toBe('Read')
        expect(inferToolNameFromPayload({ path: '/foo', fileText: 'x' }, null)).toBe('Write')
    })

    it('returns null when ambiguous', () => {
        expect(inferToolNameFromPayload({}, null)).toBeNull()
        expect(inferToolNameFromPayload({ path: '/foo' }, null)).toBeNull()
    })
})

describe('mergeToolCallProjection legacy unknown', () => {
    it('upgrades unknown start name from recognizable input', () => {
        const startEvent: ToolCallEvent = {
            kind: 'start',
            callId: 'call-legacy',
            name: 'unknown',
            input: { command: 'echo hi' },
            at: 1000
        }
        const proj = mergeToolCallProjection(null, startEvent)
        expect(proj.name).toBe('Bash')
    })

    it('does not downgrade existing non-placeholder name', () => {
        const prev = mergeToolCallProjection(null, {
            kind: 'start',
            callId: 'call-1',
            name: 'Grep',
            input: { pattern: 'x', path: '/src' },
            at: 1000
        })
        const proj = mergeToolCallProjection(prev, {
            kind: 'start',
            callId: 'call-1',
            name: 'unknown',
            input: { command: 'ls' },
            at: 2000
        })
        expect(proj.name).toBe('Grep')
    })

    it('upgrades result-only bootstrap from output-shaped Read', () => {
        const resultEvent: ToolCallEvent = {
            kind: 'result',
            callId: 'call-ro',
            output: { success: { content: 'file body' } },
            isError: false,
            at: 2000
        }
        const afterResult = mergeToolCallProjection(null, resultEvent)
        const proj = mergeToolCallProjection(afterResult, {
            kind: 'start',
            callId: 'call-ro',
            name: 'unknown',
            input: { path: '/foo' },
            at: 1000
        })
        expect(proj.name).toBe('Read')
    })
})

describe('mergeToolCallProjection', () => {
    const startEvent: ToolCallEvent = {
        kind: 'start',
        callId: 'call-1',
        name: 'Bash',
        input: { command: 'ls' },
        at: 1000
    }
    const resultEvent: ToolCallEvent = {
        kind: 'result',
        callId: 'call-1',
        output: 'file1 file2',
        isError: false,
        at: 2000
    }

    it('creates pending projection from start event when prev is null', () => {
        const proj = mergeToolCallProjection(null, startEvent)
        expect(proj.callId).toBe('call-1')
        expect(proj.name).toBe('Bash')
        expect(proj.status).toBe('in_progress')
        expect(proj.startedAt).toBe(1000)
        expect(proj.completedAt).toBeUndefined()
    })

    it('start then result yields completed projection with correct name', () => {
        const afterStart = mergeToolCallProjection(null, startEvent)
        const proj = mergeToolCallProjection(afterStart, resultEvent)
        expect(proj.name).toBe('Bash')
        expect(proj.status).toBe('completed')
        expect(proj.result).toBe('file1 file2')
        expect(proj.completedAt).toBe(2000)
    })

    it('out-of-order: result then start converges to completed with correct name', () => {
        const afterResult = mergeToolCallProjection(null, resultEvent)
        const proj = mergeToolCallProjection(afterResult, startEvent)
        expect(proj.name).toBe('Bash')
        expect(proj.status).toBe('completed')
        expect(proj.result).toBe('file1 file2')
    })

    it('duplicate start events are idempotent', () => {
        const p1 = mergeToolCallProjection(null, startEvent)
        const p2 = mergeToolCallProjection(p1, startEvent)
        expect(p2.name).toBe('Bash')
        expect(p2.startedAt).toBe(1000)
        expect(p2.status).toBe('in_progress')
    })

    it('result event with is_error sets status to failed', () => {
        const errEvent: ToolCallEvent = { ...resultEvent, isError: true, output: 'error msg' }
        const proj = mergeToolCallProjection(null, errEvent)
        expect(proj.status).toBe('failed')
    })

    it('never downgrades non-placeholder name to empty on second start', () => {
        const p1 = mergeToolCallProjection(null, startEvent)
        const emptyNameStart: ToolCallEvent = { ...startEvent, name: '' }
        const p2 = mergeToolCallProjection(p1, emptyNameStart)
        expect(p2.name).toBe('Bash')
    })

    it('startedAt takes minimum of two start events', () => {
        const laterStart: ToolCallEvent = { ...startEvent, at: 500 }
        const p1 = mergeToolCallProjection(null, startEvent)
        const p2 = mergeToolCallProjection(p1, laterStart)
        expect(p2.startedAt).toBe(500)
    })
})

describe('reconcileSessionToolCalls', () => {
    let store: Store
    let sessionId: string

    beforeEach(() => {
        store = new Store(':memory:')
        const session = store.sessions.getOrCreateSession('test-tag', { path: '/tmp' }, null)
        sessionId = session.id
    })

    afterEach(() => {
        store.close()
    })

    it('populates tool_calls from session messages on first scan', () => {
        store.messages.addMessage(sessionId, cursorStartContent('call-1', 'Bash', { command: 'ls' }))
        store.messages.addMessage(sessionId, cursorResultContent('call-1', 'output text'))

        reconcileSessionToolCalls(sessionId, store)

        const rows = store.toolCalls.getBySessionAndCallIds(sessionId, ['call-1'])
        expect(rows['call-1']).toMatchObject({ callId: 'call-1', name: 'Bash', status: 'completed' })
    })

    it('matches sequential ingest merge for same fixture: result then start produces completed', () => {
        store.messages.addMessage(sessionId, cursorResultContent('call-2', 'out'))
        store.messages.addMessage(sessionId, cursorStartContent('call-2', 'Read', { path: '/x' }))

        reconcileSessionToolCalls(sessionId, store)

        const rows = store.toolCalls.getBySessionAndCallIds(sessionId, ['call-2'])
        expect(rows['call-2']?.status).toBe('completed')
        expect(rows['call-2']?.name).toBe('Read')
    })

    it('handles legacy tool_use + tool_result fixture in reconcile', () => {
        store.messages.addMessage(
            sessionId,
            legacyAssistantContent('call-legacy', 'EditNotebook', { file: 'x' }, 'done')
        )

        reconcileSessionToolCalls(sessionId, store)

        const rows = store.toolCalls.getBySessionAndCallIds(sessionId, ['call-legacy'])
        expect(rows['call-legacy']).toMatchObject({ callId: 'call-legacy', name: 'EditNotebook', status: 'completed' })
    })

    it('is idempotent on repeated calls', () => {
        store.messages.addMessage(sessionId, cursorStartContent('call-1', 'Bash', {}))
        reconcileSessionToolCalls(sessionId, store)
        reconcileSessionToolCalls(sessionId, store)

        const rows = store.toolCalls.getBySessionAndCallIds(sessionId, ['call-1'])
        expect(rows['call-1']?.name).toBe('Bash')
    })
})

describe('collectCallIdsFromDecryptedMessages', () => {
    it('collects callIds from Cursor wire tool-call messages', () => {
        const messages = [
            decryptedMessage('m1', cursorStartContent('call-1', 'Bash', {})),
            decryptedMessage('m2', cursorResultContent('call-2', 'out'))
        ]
        const ids = collectCallIdsFromDecryptedMessages(messages)
        expect(ids).toContain('call-1')
        expect(ids).toContain('call-2')
    })

    it('collects callIds from legacy tool_use messages', () => {
        const messages = [
            decryptedMessage('m1', legacyAssistantContent('call-legacy', 'Read', {}, 'out'))
        ]
        const ids = collectCallIdsFromDecryptedMessages(messages)
        expect(ids).toContain('call-legacy')
    })

    it('returns empty set for messages with no tool events', () => {
        const messages = [
            decryptedMessage('m1', { role: 'user', content: { type: 'text', text: 'hello' } })
        ]
        const ids = collectCallIdsFromDecryptedMessages(messages)
        expect(ids.size).toBe(0)
    })

    it('deduplicates callIds that appear in multiple messages', () => {
        const messages = [
            decryptedMessage('m1', cursorStartContent('call-1', 'Bash', {})),
            decryptedMessage('m2', cursorResultContent('call-1', 'out'))
        ]
        const ids = collectCallIdsFromDecryptedMessages(messages)
        expect(ids.size).toBe(1)
        expect(ids).toContain('call-1')
    })
})
