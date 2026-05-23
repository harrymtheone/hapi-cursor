import type { Config } from '@/configuration'

export function getAuthToken(config: Pick<Config, 'cliApiToken'>): string {
    if (!config.cliApiToken) {
        throw new Error('CLI_API_TOKEN is required')
    }
    return config.cliApiToken
}
