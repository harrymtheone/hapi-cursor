import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeConfig } from '@/__fixtures__/config'

const {
    readSettingsMock,
    clearMachineIdMock,
    updateSettingsMock
} = vi.hoisted(() => ({
    readSettingsMock: vi.fn(),
    clearMachineIdMock: vi.fn(),
    updateSettingsMock: vi.fn()
}))

vi.mock('@/persistence', () => ({
    readSettings: readSettingsMock,
    clearMachineId: clearMachineIdMock,
    updateSettings: updateSettingsMock
}))

import { handleAuthCommand } from './auth'

function stripAnsi(value: string): string {
    return value.replace(/\u001B\[[0-9;]*m/g, '')
}

describe('handleAuthCommand', () => {
    beforeEach(() => {
        readSettingsMock.mockReset()
        clearMachineIdMock.mockReset()
        updateSettingsMock.mockReset()
    })

    it('prints the configured api url from the frozen Config', async () => {
        readSettingsMock.mockResolvedValue({
            apiUrl: 'https://hapi.example.com',
            cliApiToken: 'token-from-settings',
            machineId: 'machine-123'
        })

        const config = makeConfig({ apiUrl: 'https://hapi.example.com' })

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

        try {
            await handleAuthCommand(config, ['status'])

            const output = logSpy.mock.calls
                .map((call) => stripAnsi(String(call[0])))
                .join('\n')

            expect(output).toContain('HAPI_API_URL: https://hapi.example.com')
            expect(output).toContain('CLI_API_TOKEN: set')
            expect(output).toContain('Machine ID: machine-123')
        } finally {
            logSpy.mockRestore()
        }
    })
})
