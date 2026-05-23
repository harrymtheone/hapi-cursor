/**
 * Token bootstrap module (Plan 10-03)
 *
 * `bootstrapToken(settingsFile)` ensures a CLI_API_TOKEN is available BEFORE
 * `loadConfig()` freezes the Config snapshot. Priority:
 * 1. Environment variable (highest — allows temporary override)
 * 2. Settings file (~/.hapi/settings.json)
 * 3. Interactive prompt (writes to settings file before returning)
 */

import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import chalk from 'chalk'
import { readSettings, updateSettings } from '@/persistence'

/**
 * Initialize CLI API token. Must be called before `loadConfig()` so the
 * frozen Config sees the token resolved at startup.
 */
export async function bootstrapToken(settingsFile: string): Promise<void> {
    // 1. Environment variable has highest priority (allows temporary override)
    if (process.env.CLI_API_TOKEN) {
        return
    }

    // 2. Read from settings file
    const settings = await readSettings(settingsFile)
    if (settings.cliApiToken) {
        return
    }

    // 3. Non-TTY environment cannot prompt, fail with clear error
    if (!process.stdin.isTTY) {
        throw new Error('CLI_API_TOKEN is required. Set it via environment variable or run `hapi auth login`.')
    }

    // 4. Interactive prompt
    const token = await promptForToken(settingsFile)

    // 5. Save (loadConfig() will pick it up from settings on next read)
    await updateSettings(settingsFile, current => ({
        ...current,
        cliApiToken: token
    }))
}

async function promptForToken(settingsFile: string): Promise<string> {
    const rl = readline.createInterface({ input, output })

    console.log(chalk.yellow('\nNo CLI_API_TOKEN found.'))
    console.log(chalk.gray('Where to find the token:'))
    console.log(chalk.gray('  1. Check the server startup logs (first run shows generated token)'))
    console.log(chalk.gray('  2. Read ~/.hapi/settings.json on the server'))
    console.log(chalk.gray('  3. Ask your server administrator (if token is set via env var)\n'))

    try {
        const token = await rl.question(chalk.cyan('Enter CLI_API_TOKEN: '))
        if (!token.trim()) {
            throw new Error('Token cannot be empty')
        }
        console.log(chalk.green(`\nToken saved to ${settingsFile}`))
        return token.trim()
    } finally {
        rl.close()
    }
}
