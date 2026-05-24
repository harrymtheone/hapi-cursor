import type { CursorModelDiscoveryResult } from '@hapi/protocol/types'
import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { SyncEngine } from '../../sync/syncEngine'
import { registerApiErrorHandler } from '../middleware/apiRouteError'
import type { WebAppEnv } from '../middleware/auth'
import { createMachinesRoutes } from './machines'

describe('machines routes', () => {
    function createMachine(overrides: { active?: boolean } = {}) {
        return {
            id: 'machine-1',
            seq: 1,
            createdAt: 1,
            updatedAt: 1,
            active: overrides.active ?? true,
            activeAt: 1,
            metadata: null,
            metadataVersion: 1,
            runnerState: null,
            runnerStateVersion: 1
        }
    }

    function createApp(engine: Partial<SyncEngine>) {
        const app = new Hono<WebAppEnv>()
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine))
        registerApiErrorHandler(app)
        return app
    }

    it('returns discovered Cursor models for an online machine', async () => {
        const result: CursorModelDiscoveryResult = {
            status: 'ok',
            models: [{ id: 'cursor-fast', label: 'Cursor Fast' }],
            discoveredAt: 123
        }
        const calls: string[] = []
        const app = createApp({
            getMachine: (machineId: string) => {
                calls.push(`machine:${machineId}`)
                return createMachine()
            },
            discoverCursorModels: async (machineId: string) => {
                calls.push(`discover:${machineId}`)
                return result
            }
        } as never)

        const response = await app.request('/api/machines/machine-1/cursor/models')

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(result)
        expect(calls).toEqual(['machine:machine-1', 'discover:machine-1'])
    })

    it('returns safe discovery error results without converting them to HTTP failures', async () => {
        const result: CursorModelDiscoveryResult = {
            status: 'error',
            reason: 'not-authenticated',
            discoveredAt: 123
        }
        const app = createApp({
            getMachine: () => createMachine(),
            discoverCursorModels: async () => result
        } as never)

        const response = await app.request('/api/machines/machine-1/cursor/models')

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(result)
    })

    it('uses the existing machine guard response when the machine is missing', async () => {
        let discoveryCalls = 0
        const app = createApp({
            getMachine: () => undefined,
            discoverCursorModels: async () => {
                discoveryCalls += 1
                throw new Error('should not discover')
            }
        } as never)

        const response = await app.request('/api/machines/missing/cursor/models')

        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({ error: 'Machine not found' })
        expect(discoveryCalls).toBe(0)
    })

    it('does not attempt discovery for an offline machine', async () => {
        let discoveryCalls = 0
        const app = createApp({
            getMachine: () => createMachine({ active: false }),
            discoverCursorModels: async () => {
                discoveryCalls += 1
                throw new Error('should not discover')
            }
        } as never)

        const response = await app.request('/api/machines/machine-1/cursor/models')

        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({ error: 'Machine is offline' })
        expect(discoveryCalls).toBe(0)
    })

    it('wraps invalid discovery transport results in the API error format', async () => {
        const app = createApp({
            getMachine: () => createMachine(),
            discoverCursorModels: async () => {
                throw new Error('Invalid cursor model discovery result')
            }
        } as never)

        const response = await app.request('/api/machines/machine-1/cursor/models')

        expect(response.status).toBe(502)
        expect(await response.json()).toEqual({
            error: {
                code: 'model-discovery-failed',
                message: 'Invalid cursor model discovery result'
            }
        })
    })

    it('preserves selected runtime config rejection codes from spawn responses', async () => {
        const app = createApp({
            getMachine: () => createMachine(),
            spawnSession: async () => ({
                type: 'error',
                message: 'Cursor rejected the selected runtime config',
                code: 'selected-runtime-config-rejected'
            })
        } as never)

        const response = await app.request('/api/machines/machine-1/spawn', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                directory: '/tmp/project',
                agent: 'cursor',
                model: 'cursor-fast'
            })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            type: 'error',
            message: 'Cursor rejected the selected runtime config',
            code: 'selected-runtime-config-rejected'
        })
    })

    it('rejects unsupported effort at the spawn route boundary before engine invocation', async () => {
        let spawnCalls = 0
        const app = createApp({
            getMachine: () => createMachine(),
            spawnSession: async () => {
                spawnCalls += 1
                return { type: 'success', sessionId: 'session-1' }
            }
        } as never)

        const response = await app.request('/api/machines/machine-1/spawn', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                directory: '/tmp/project',
                effort: 'high'
            })
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: {
                code: 'unsupported-runtime-effort',
                message: 'Unsupported runtime effort config'
            }
        })
        expect(spawnCalls).toBe(0)
    })

    it('rejects unsupported modelReasoningEffort at the spawn route boundary before engine invocation', async () => {
        let spawnCalls = 0
        const app = createApp({
            getMachine: () => createMachine(),
            spawnSession: async () => {
                spawnCalls += 1
                return { type: 'success', sessionId: 'session-1' }
            }
        } as never)

        const response = await app.request('/api/machines/machine-1/spawn', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                directory: '/tmp/project',
                modelReasoningEffort: 'xhigh'
            })
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: {
                code: 'unsupported-runtime-effort',
                message: 'Unsupported runtime effort config'
            }
        })
        expect(spawnCalls).toBe(0)
    })

    it('passes model-only spawn requests through with the raw selected model id', async () => {
        let capturedModel: string | undefined
        const app = createApp({
            getMachine: () => createMachine(),
            spawnSession: async (
                _machineId: string,
                _directory: string,
                _agent?: 'cursor',
                model?: string
            ) => {
                capturedModel = model
                return { type: 'success', sessionId: 'session-1' }
            }
        } as never)

        const response = await app.request('/api/machines/machine-1/spawn', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                directory: '/tmp/project',
                agent: 'cursor',
                model: 'cursor-fast'
            })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ type: 'success', sessionId: 'session-1' })
        expect(capturedModel).toBe('cursor-fast')
    })
})
