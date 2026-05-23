import type { Config } from '@/configuration'

export type CommandContext = {
    args: string[]
    subcommand?: string
    commandArgs: string[]
    config: Config
}

export type CommandDefinition = {
    name: string
    requiresRuntimeAssets: boolean
    /**
     * If true, `runCli` calls `bootstrapToken()` before `loadConfig()` so the
     * frozen Config carries a usable `cliApiToken`. Commands that talk to the
     * hub (cursor, runner start-sync, resume) need this; commands like `hub`
     * (which starts the server itself) and `auth` do not.
     */
    requiresAuth?: boolean
    run: (context: CommandContext) => Promise<void>
}
