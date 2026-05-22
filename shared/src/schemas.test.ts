import { describe, expect, it } from 'bun:test'
import {
    MachinePatchSchema,
    MachineSchema,
    MessageContentSchema,
    MetadataSchema,
    SessionPatchSchema,
    SessionSchema,
    SyncEventSchema
} from './schemas'

const minimalSession = {
    id: 'session-1',
    seq: 1,
    createdAt: 1,
    updatedAt: 2,
    active: true,
    activeAt: 2,
    metadata: { path: '/tmp/project', host: 'devbox' },
    metadataVersion: 1,
    agentState: null,
    agentStateVersion: 1,
    thinking: false,
    thinkingAt: 0
}

const minimalMachine = {
    id: 'machine-1',
    seq: 1,
    createdAt: 1,
    updatedAt: 2,
    active: true,
    activeAt: 2,
    metadata: {
        host: 'devbox',
        platform: 'linux',
        happyCliVersion: '0.0.0',
        homeDir: '/home/u',
        happyHomeDir: '/home/u/.happy',
        happyLibDir: '/home/u/.happy/lib'
    },
    metadataVersion: 1,
    runnerState: null,
    runnerStateVersion: 1
}

describe('SessionPatchSchema', () => {
    it('accepts an empty patch (all fields optional)', () => {
        expect(SessionPatchSchema.safeParse({}).success).toBe(true)
    })

    it('accepts active patch', () => {
        expect(SessionPatchSchema.safeParse({ active: false }).success).toBe(true)
    })

    it('accepts activeAt patch', () => {
        expect(SessionPatchSchema.safeParse({ activeAt: 123 }).success).toBe(true)
    })

    it('accepts thinking patch', () => {
        expect(SessionPatchSchema.safeParse({ thinking: true }).success).toBe(true)
    })

    it('accepts updatedAt patch', () => {
        expect(SessionPatchSchema.safeParse({ updatedAt: 123 }).success).toBe(true)
    })

    it('accepts permissionMode patch', () => {
        expect(SessionPatchSchema.safeParse({ permissionMode: 'plan' }).success).toBe(true)
    })

    it('accepts model patch (string and null)', () => {
        expect(SessionPatchSchema.safeParse({ model: 'gpt-5' }).success).toBe(true)
        expect(SessionPatchSchema.safeParse({ model: null }).success).toBe(true)
    })

    it('accepts modelReasoningEffort patch (string and null)', () => {
        expect(SessionPatchSchema.safeParse({ modelReasoningEffort: 'high' }).success).toBe(true)
        expect(SessionPatchSchema.safeParse({ modelReasoningEffort: null }).success).toBe(true)
    })

    it('accepts effort patch (string and null)', () => {
        expect(SessionPatchSchema.safeParse({ effort: 'high' }).success).toBe(true)
        expect(SessionPatchSchema.safeParse({ effort: null }).success).toBe(true)
    })

    it('accepts backgroundTaskCount patch (the smoking-gun fixture)', () => {
        expect(SessionPatchSchema.safeParse({ backgroundTaskCount: 3 }).success).toBe(true)
    })

    it('rejects unknown keys (strict)', () => {
        expect(SessionPatchSchema.safeParse({ unknownKey: 1 }).success).toBe(false)
        expect(SessionPatchSchema.safeParse({ active: false, surprise: true }).success).toBe(false)
    })
})

describe('MachinePatchSchema', () => {
    it('accepts active=false', () => {
        expect(MachinePatchSchema.safeParse({ active: false }).success).toBe(true)
    })

    it('accepts active=false with activeAt', () => {
        expect(MachinePatchSchema.safeParse({ active: false, activeAt: 123 }).success).toBe(true)
    })

    it('rejects active=true (literal false only)', () => {
        expect(MachinePatchSchema.safeParse({ active: true }).success).toBe(false)
    })

    it('rejects unknown keys (strict)', () => {
        expect(MachinePatchSchema.safeParse({ active: false, unknownKey: 1 }).success).toBe(false)
    })
})

describe('SyncEventSchema data union', () => {
    it('session-added accepts a full Session', () => {
        const result = SyncEventSchema.safeParse({
            type: 'session-added',
            sessionId: 's1',
            data: minimalSession
        })
        expect(result.success).toBe(true)
    })

    it('session-added FORBIDS a patch payload (strict-full per §5)', () => {
        const result = SyncEventSchema.safeParse({
            type: 'session-added',
            sessionId: 's1',
            data: { backgroundTaskCount: 3 }
        })
        expect(result.success).toBe(false)
    })

    it('session-updated accepts a full Session', () => {
        const result = SyncEventSchema.safeParse({
            type: 'session-updated',
            sessionId: 's1',
            data: minimalSession
        })
        expect(result.success).toBe(true)
    })

    it('session-updated accepts a single-field backgroundTaskCount patch (the bug fixture)', () => {
        const result = SyncEventSchema.safeParse({
            type: 'session-updated',
            sessionId: 's1',
            data: { backgroundTaskCount: 3 }
        })
        expect(result.success).toBe(true)
    })

    it('session-updated rejects a payload with unknown keys', () => {
        const result = SyncEventSchema.safeParse({
            type: 'session-updated',
            sessionId: 's1',
            data: { unknownField: 1 }
        })
        expect(result.success).toBe(false)
    })

    it('machine-updated accepts data: null', () => {
        const result = SyncEventSchema.safeParse({
            type: 'machine-updated',
            machineId: 'm1',
            data: null
        })
        expect(result.success).toBe(true)
    })

    it('machine-updated accepts a full Machine', () => {
        const result = SyncEventSchema.safeParse({
            type: 'machine-updated',
            machineId: 'm1',
            data: minimalMachine
        })
        expect(result.success).toBe(true)
    })

    it('machine-updated accepts an inactivate patch { active: false }', () => {
        const result = SyncEventSchema.safeParse({
            type: 'machine-updated',
            machineId: 'm1',
            data: { active: false }
        })
        expect(result.success).toBe(true)
    })

    it('machine-updated rejects { active: true } (patch must be literal-false)', () => {
        const result = SyncEventSchema.safeParse({
            type: 'machine-updated',
            machineId: 'm1',
            data: { active: true }
        })
        expect(result.success).toBe(false)
    })
})

describe('MessageContentSchema', () => {
    it('accepts a UserMessage with text content', () => {
        const result = MessageContentSchema.safeParse({
            role: 'user',
            content: { type: 'text', text: 'hello' }
        })
        expect(result.success).toBe(true)
    })

    it('accepts an AgentMessage with output content', () => {
        const result = MessageContentSchema.safeParse({
            role: 'agent',
            content: { type: 'output', data: { anything: true } }
        })
        expect(result.success).toBe(true)
    })

    it('rejects an unknown role', () => {
        const result = MessageContentSchema.safeParse({
            role: 'other',
            content: { type: 'text', text: 'x' }
        })
        expect(result.success).toBe(false)
    })
})

describe('MetadataSchema strip behavior — Pitfall #1', () => {
    it('strips a legacy flavor key (not strict — silent strip)', () => {
        const result = MetadataSchema.safeParse({
            path: '/x',
            host: 'h',
            flavor: 'cursor'
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect('flavor' in result.data).toBe(false)
        }
    })
})

describe('MachineSchema', () => {
    it('parses a minimal Machine with full required metadata', () => {
        expect(MachineSchema.safeParse(minimalMachine).success).toBe(true)
    })
})

describe('SessionSchema', () => {
    it('parses a minimal Session and ignores legacy flavor on metadata', () => {
        const result = SessionSchema.safeParse({
            ...minimalSession,
            metadata: { ...minimalSession.metadata, flavor: 'cursor' }
        })
        expect(result.success).toBe(true)
        if (result.success && result.data.metadata) {
            expect('flavor' in result.data.metadata).toBe(false)
        }
    })
})
