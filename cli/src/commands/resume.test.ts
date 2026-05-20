import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    initializeTokenMock,
    maybeAutoStartServerMock,
    authAndSetupMachineIfNeededMock,
    listResumableSessionsMock,
    getLocalResumeTargetMock,
    handoffSessionToLocalMock,
    runCursorMock,
    existsSyncMock
} = vi.hoisted(() => ({
    initializeTokenMock: vi.fn(async () => {}),
    maybeAutoStartServerMock: vi.fn(async () => {}),
    authAndSetupMachineIfNeededMock: vi.fn(async () => ({ machineId: 'machine-1' })),
    listResumableSessionsMock: vi.fn(),
    getLocalResumeTargetMock: vi.fn(),
    handoffSessionToLocalMock: vi.fn(async () => {}),
    runCursorMock: vi.fn(async () => {}),
    existsSyncMock: vi.fn(() => true)
}))

vi.mock('@/ui/tokenInit', () => ({ initializeToken: initializeTokenMock }))
vi.mock('@/utils/autoStartServer', () => ({ maybeAutoStartServer: maybeAutoStartServerMock }))
vi.mock('@/ui/auth', () => ({ authAndSetupMachineIfNeeded: authAndSetupMachineIfNeededMock }))
vi.mock('@/api/api', () => ({
    ApiClient: {
        create: async () => ({
            listResumableSessions: listResumableSessionsMock,
            getLocalResumeTarget: getLocalResumeTargetMock,
            handoffSessionToLocal: handoffSessionToLocalMock
        })
    }
}))
vi.mock('@/cursor/runCursor', () => ({ runCursor: runCursorMock }))
vi.mock('node:fs', () => ({ existsSync: existsSyncMock }))

import { resumeCommand } from './resume'

function createContext(commandArgs: string[]) {
    return {
        args: ['resume'].concat(commandArgs),
        subcommand: 'resume',
        commandArgs
    }
}

describe('resumeCommand', () => {
    beforeEach(() => {
        initializeTokenMock.mockClear()
        maybeAutoStartServerMock.mockClear()
        authAndSetupMachineIfNeededMock.mockClear()
        listResumableSessionsMock.mockReset()
        getLocalResumeTargetMock.mockReset()
        handoffSessionToLocalMock.mockClear()
        runCursorMock.mockClear()
        existsSyncMock.mockReturnValue(true)
    })

    it('resumes an inactive Cursor target without handoff', async () => {
        getLocalResumeTargetMock.mockResolvedValue({
            sessionId: 'hapi-session-2',
            flavor: 'cursor',
            directory: '/tmp/project',
            machineId: 'machine-1',
            active: false,
            thinking: false,
            controlledByUser: false,
            agentSessionId: '11111111-1111-4111-8111-111111111111',
            model: 'sonnet',
            permissionMode: 'default'
        })

        await resumeCommand.run(createContext(['hapi-session-2']))

        expect(handoffSessionToLocalMock).not.toHaveBeenCalled()
        expect(runCursorMock).toHaveBeenCalledWith({
            existingSessionId: 'hapi-session-2',
            workingDirectory: '/tmp/project',
            resumeSessionId: '11111111-1111-4111-8111-111111111111',
            startedBy: 'terminal',
            permissionMode: 'default',
            model: 'sonnet'
        })
    })

    it('fails before launching when the target belongs to another machine', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            throw new Error(`process.exit:${code ?? 'undefined'}`)
        }) as never)

        getLocalResumeTargetMock.mockResolvedValue({
            sessionId: 'hapi-session-3',
            flavor: 'cursor',
            directory: '/tmp/project',
            machineId: 'machine-2',
            active: false,
            thinking: false,
            controlledByUser: false,
            agentSessionId: '11111111-1111-4111-8111-111111111111'
        })

        try {
            await expect(resumeCommand.run(createContext(['hapi-session-3']))).rejects.toThrow('process.exit:1')
            expect(runCursorMock).not.toHaveBeenCalled()
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('another machine'))
        } finally {
            consoleErrorSpy.mockRestore()
            exitSpy.mockRestore()
        }
    })

    it('resumes an inactive local target even when controlledByUser is sticky', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            throw new Error(`process.exit:${code ?? 'undefined'}`)
        }) as never)

        getLocalResumeTargetMock.mockResolvedValue({
            sessionId: 'hapi-session-4',
            flavor: 'cursor',
            directory: '/tmp/project',
            machineId: 'machine-1',
            active: false,
            thinking: false,
            controlledByUser: true,
            agentSessionId: '11111111-1111-4111-8111-111111111111',
            permissionMode: 'default'
        })

        try {
            await resumeCommand.run(createContext(['hapi-session-4']))

            expect(exitSpy).not.toHaveBeenCalled()
            expect(consoleErrorSpy).not.toHaveBeenCalled()
            expect(handoffSessionToLocalMock).not.toHaveBeenCalled()
            expect(runCursorMock).toHaveBeenCalledWith(expect.objectContaining({
                existingSessionId: 'hapi-session-4',
                resumeSessionId: '11111111-1111-4111-8111-111111111111'
            }))
        } finally {
            consoleErrorSpy.mockRestore()
            exitSpy.mockRestore()
        }
    })
})
