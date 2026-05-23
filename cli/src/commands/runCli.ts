import { homedir } from 'node:os'
import { join } from 'node:path'
import packageJson from '../../package.json'
import { ensureRuntimeAssets } from '@/runtime/assets'
import { isBunCompiled } from '@/projectPath'
import { logger, initializeLogger } from '@/ui/logger'
import { loadConfig } from '@/configuration'
import { bootstrapToken } from '@/ui/tokenInit'
import { getCliArgs } from '@/utils/cliArgs'
import { resolveCommand } from './registry'

function provisionalSettingsFile(): string {
    const happyHomeDir = process.env.HAPI_HOME
        ? process.env.HAPI_HOME.replace(/^~/, homedir())
        : join(homedir(), '.hapi')
    return join(happyHomeDir, 'settings.json')
}

export async function runCli(): Promise<void> {
    const args = getCliArgs()

    if (args.includes('-v') || args.includes('--version')) {
        console.log(`hapi version: ${packageJson.version}`)
        process.exit(0)
    }

    if (isBunCompiled()) {
        process.env.DEV = 'false'
    }

    const { command, context } = resolveCommand(args)

    // Bootstrap-then-freeze pattern (D-169): token resolution happens BEFORE
    // loadConfig() reads ~/.hapi/settings.json, so the frozen Config sees a
    // usable cliApiToken on first load.
    if (command.requiresAuth) {
        await bootstrapToken(provisionalSettingsFile())
    }

    const config = await loadConfig({ argv: args })
    initializeLogger(config)

    if (command.requiresRuntimeAssets) {
        await ensureRuntimeAssets(config)
        logger.debug('Starting hapi CLI with args: ', process.argv)
    }

    await command.run({ ...context, config })
}
