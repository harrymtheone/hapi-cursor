import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeConfig } from '@/__fixtures__/config'

const {
    checkRunnerMock,
    findAllProcessesMock,
    findRunawayProcessesMock,
    readRunnerStateMock,
    readSettingsMock
} = vi.hoisted(() => ({
    checkRunnerMock: vi.fn(),
    findAllProcessesMock: vi.fn(),
    findRunawayProcessesMock: vi.fn(),
    readRunnerStateMock: vi.fn(),
    readSettingsMock: vi.fn()
}))

vi.mock('@/persistence', () => ({
    readRunnerState: readRunnerStateMock,
    readSettings: readSettingsMock
}))

vi.mock('@/runner/controlClient', () => ({
    checkIfRunnerRunningAndCleanupStaleState: checkRunnerMock
}))

vi.mock('@/runner/doctor', () => ({
    findAllHappyProcesses: findAllProcessesMock,
    findRunawayHappyProcesses: findRunawayProcessesMock
}))

import { getEnvironmentInfo, runDoctorCommand } from './doctor'

function stripAnsi(value: string): string {
    return value.replace(/\u001B\[[0-9;]*m/g, '')
}

describe('doctor remote-log diagnostics', () => {
    const removedRemoteLogEnv = ['DANGEROUSLY', 'LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING'].join('_')
    const originalApiUrl = process.env.HAPI_API_URL
    const originalRemovedRemoteLogging = process.env[removedRemoteLogEnv]

    beforeEach(() => {
        readSettingsMock.mockResolvedValue({})
        readRunnerStateMock.mockResolvedValue(null)
        checkRunnerMock.mockResolvedValue(false)
        findAllProcessesMock.mockResolvedValue([])
        findRunawayProcessesMock.mockResolvedValue([])
        process.env.HAPI_API_URL = 'https://hapi.example.com'
        process.env[removedRemoteLogEnv] = '1'
    })

    afterEach(() => {
        if (originalApiUrl === undefined) {
            delete process.env.HAPI_API_URL
        } else {
            process.env.HAPI_API_URL = originalApiUrl
        }

        if (originalRemovedRemoteLogging === undefined) {
            delete process.env[removedRemoteLogEnv]
        } else {
            process.env[removedRemoteLogEnv] = originalRemovedRemoteLogging
        }

        vi.restoreAllMocks()
    })

    it('omits the dangerous remote-log toggle while preserving HAPI_API_URL diagnostics', async () => {
        expect(getEnvironmentInfo()).not.toHaveProperty(removedRemoteLogEnv)

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        let output = ''

        try {
            await runDoctorCommand(makeConfig({ apiUrl: 'https://hapi.example.com' }), 'all')
            output = logSpy.mock.calls
                .map((call) => stripAnsi(call.map(String).join(' ')))
                .join('\n')
        } finally {
            logSpy.mockRestore()
        }

        expect(output).toContain('HAPI_API_URL: https://hapi.example.com')
        expect(output).not.toContain(removedRemoteLogEnv)
        expect(output).not.toContain(['DANGEROUSLY', 'LOG_TO_SERVER'].join('_'))
    })
})
