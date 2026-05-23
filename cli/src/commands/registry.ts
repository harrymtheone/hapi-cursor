import { authCommand } from './auth'
import { cursorCommand } from './cursor'
import { connectCommand } from './connect'
import { runnerCommand } from './runner'
import { resumeCommand } from './resume'
import { doctorCommand } from './doctor'
import { notifyCommand } from './notify'
import { hubCommand } from './hub'
import type { CommandContext, CommandDefinition } from './types'

const COMMANDS: CommandDefinition[] = [
    authCommand,
    connectCommand,
    cursorCommand,
    hubCommand,
    doctorCommand,
    resumeCommand,
    runnerCommand,
    notifyCommand
]

const commandMap = new Map<string, CommandDefinition>()
for (const command of COMMANDS) {
    commandMap.set(command.name, command)
}

// Per D-160: retired command aliases must fail hard with a repair message
// naming the canonical replacement, not silently fall through to cursorCommand.
const RETIRED_COMMANDS: Record<string, string> = {
    server: 'hub'
}

export function resolveCommand(args: string[]): { command: CommandDefinition; context: Omit<CommandContext, 'config'> } {
    const subcommand = args[0]
    if (subcommand && subcommand in RETIRED_COMMANDS) {
        throw new Error(`Unknown command "hapi ${subcommand}". Use "hapi ${RETIRED_COMMANDS[subcommand]}" instead.`)
    }
    const command = subcommand ? commandMap.get(subcommand) : undefined
    const resolvedCommand = command ?? cursorCommand
    const commandArgs = command ? args.slice(1) : args

    return {
        command: resolvedCommand,
        context: {
            args,
            subcommand,
            commandArgs
        }
    }
}
