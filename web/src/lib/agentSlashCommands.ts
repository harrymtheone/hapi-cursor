import type { SlashCommand } from '@/types/api'

// Cursor-only built-in slash commands. The mapping is keyed by agent type for
// future-proofing (Phase 5 will narrow the AgentFlavor union); only 'cursor'
// is populated post Phase-1 cut.
const BUILTIN_COMMANDS: Record<string, SlashCommand[]> = {
    cursor: [],
}

export function getBuiltinSlashCommands(agentType: string): SlashCommand[] {
    return BUILTIN_COMMANDS[agentType] ?? []
}

export function mergeSlashCommands(commands: readonly SlashCommand[]): SlashCommand[] {
    const commandMap = new Map<string, SlashCommand>()
    for (const command of commands) {
        const key = command.name.toLowerCase()
        if (commandMap.has(key)) {
            commandMap.delete(key)
        }
        commandMap.set(key, command)
    }
    return Array.from(commandMap.values())
}

export function findAgentCustomPromptExpansion(
    text: string,
    availableCommands: readonly SlashCommand[]
): string | null {
    const trimmed = text.trim()
    const match = /^\/([a-z0-9:_-]+)$/i.exec(trimmed)
    if (!match) {
        return null
    }

    const commandName = match[1]?.toLowerCase()
    if (!commandName) {
        return null
    }

    const command = availableCommands.find(
        candidate => candidate.source !== 'builtin'
            && candidate.name.toLowerCase() === commandName
            && typeof candidate.content === 'string'
            && candidate.content.length > 0
    )
    return command?.content ?? null
}
