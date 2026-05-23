import { randomUUID } from 'node:crypto'
import type { Config } from '@/configuration'
import { updateSettings } from '@/persistence'

export async function authAndSetupMachineIfNeeded(
    config: Pick<Config, 'cliApiToken' | 'settingsFile'>
): Promise<{
    token: string
    machineId: string
}> {
    if (!config.cliApiToken) {
        throw new Error('CLI_API_TOKEN is required')
    }

    const settings = await updateSettings(config.settingsFile, (current) => {
        if (!current.machineId) {
            return {
                ...current,
                machineId: randomUUID()
            }
        }
        return current
    })

    if (!settings.machineId) {
        throw new Error('Failed to initialize machineId')
    }

    return { token: config.cliApiToken, machineId: settings.machineId }
}
