import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

import { ApiClient } from '@/api/api'
import type { ApiSessionClient } from '@/api/apiSession'
import type { AgentState, MachineMetadata, Metadata, Session } from '@/api/types'
import { notifyRunnerSessionStarted } from '@/runner/controlClient'
import { readSettings } from '@/persistence'
import type { Config } from '@/configuration'
import { logger } from '@/ui/logger'
import { runtimePath } from '@/projectPath'

type SessionFactoryConfig = Pick<
    Config,
    'apiUrl' | 'cliApiToken' | 'extraHeaders' | 'happyHomeDir' | 'settingsFile' | 'runnerStateFile'
>
import { getInvokedCwd } from '@/utils/invokedCwd'
import { readWorktreeEnv } from '@/utils/worktreeEnv'
import packageJson from '../../package.json'

export type SessionStartedBy = 'runner' | 'terminal'

export type SessionBootstrapOptions = {
    startedBy?: SessionStartedBy
    workingDirectory?: string
    tag?: string
    agentState?: AgentState | null
    model?: string
    modelReasoningEffort?: string
    effort?: string
    metadataOverrides?: Partial<Metadata>
}

export type SessionBootstrapResult = {
    api: ApiClient
    session: ApiSessionClient
    sessionInfo: Session
    metadata: Metadata
    machineId: string
    startedBy: SessionStartedBy
    workingDirectory: string
}

export function buildMachineMetadata(
    config: Pick<Config, 'happyHomeDir'>,
    options?: { workspaceRoots?: string[] }
): MachineMetadata {
    return {
        host: process.env.HAPI_HOSTNAME || os.hostname(),
        platform: os.platform(),
        happyCliVersion: packageJson.version,
        homeDir: os.homedir(),
        happyHomeDir: config.happyHomeDir,
        happyLibDir: runtimePath(config.happyHomeDir),
        workspaceRoots: options?.workspaceRoots
    }
}

export function buildSessionMetadata(
    config: Pick<Config, 'happyHomeDir'>,
    options: {
        startedBy: SessionStartedBy
        workingDirectory: string
        machineId: string
        now?: number
        metadataOverrides?: Partial<Metadata>
    }
): Metadata {
    const happyLibDir = runtimePath(config.happyHomeDir)
    const worktreeInfo = readWorktreeEnv()
    const now = options.now ?? Date.now()

    return {
        path: options.workingDirectory,
        host: process.env.HAPI_HOSTNAME || os.hostname(),
        version: packageJson.version,
        os: os.platform(),
        machineId: options.machineId,
        homeDir: os.homedir(),
        happyHomeDir: config.happyHomeDir,
        happyLibDir,
        happyToolsDir: resolve(happyLibDir, 'tools', 'unpacked'),
        startedFromRunner: options.startedBy === 'runner',
        hostPid: process.pid,
        startedBy: options.startedBy,
        lifecycleState: 'running',
        lifecycleStateSince: now,
        capabilities: {
            terminal: true
        },
        worktree: worktreeInfo ?? undefined,
        ...options.metadataOverrides
    }
}

function pickExistingSessionMetadata(metadata: Metadata | null | undefined): Partial<Metadata> {
    if (!metadata) return {}

    const preserved: Partial<Metadata> = {}

    if (metadata.name !== undefined) preserved.name = metadata.name
    if (metadata.summary !== undefined) preserved.summary = metadata.summary
    if (metadata.cursorSessionId !== undefined) preserved.cursorSessionId = metadata.cursorSessionId
    if (metadata.tools !== undefined) preserved.tools = metadata.tools
    if (metadata.slashCommands !== undefined) preserved.slashCommands = metadata.slashCommands
    if (metadata.worktree !== undefined) preserved.worktree = metadata.worktree
    if (metadata.skillPolicy !== undefined) preserved.skillPolicy = metadata.skillPolicy

    return preserved
}

async function getMachineIdOrExit(settingsFile: string): Promise<string> {
    const settings = await readSettings(settingsFile)
    const machineId = settings?.machineId
    if (!machineId) {
        console.error(`[START] No machine ID found in settings, which is unexpected since authAndSetupMachineIfNeeded should have created it. Please report this issue on ${packageJson.bugs}`)
        process.exit(1)
    }
    logger.debug(`Using machineId: ${machineId}`)
    return machineId
}

async function reportSessionStarted(runnerStateFile: string, sessionId: string, metadata: Metadata): Promise<void> {
    try {
        logger.debug(`[START] Reporting session ${sessionId} to runner`)
        const result = await notifyRunnerSessionStarted(runnerStateFile, sessionId, metadata)
        if (result?.error) {
            logger.debug(`[START] Failed to report to runner (may not be running):`, result.error)
        } else {
            logger.debug(`[START] Reported session ${sessionId} to runner`)
        }
    } catch (error) {
        logger.debug('[START] Failed to report to runner (may not be running):', error)
    }
}

export async function bootstrapSession(
    config: SessionFactoryConfig,
    options: SessionBootstrapOptions
): Promise<SessionBootstrapResult> {
    const workingDirectory = options.workingDirectory ?? getInvokedCwd()
    const startedBy = options.startedBy ?? 'terminal'
    const sessionTag = options.tag ?? randomUUID()
    const agentState = options.agentState === undefined ? {} : options.agentState

    const api = await ApiClient.create(config)

    const machineId = await getMachineIdOrExit(config.settingsFile)
    await api.getOrCreateMachine({
        machineId,
        metadata: buildMachineMetadata(config)
    })

    const metadata = buildSessionMetadata(config, {
        startedBy,
        workingDirectory,
        machineId,
        metadataOverrides: options.metadataOverrides
    })

    const sessionInfo = await api.getOrCreateSession({
        tag: sessionTag,
        metadata,
        state: agentState,
        model: options.model,
        modelReasoningEffort: options.modelReasoningEffort,
        effort: options.effort
    })

    const session = api.sessionSyncClient(sessionInfo)

    await reportSessionStarted(config.runnerStateFile, sessionInfo.id, metadata)

    return {
        api,
        session,
        sessionInfo,
        metadata,
        machineId,
        startedBy,
        workingDirectory
    }
}

export async function bootstrapExistingSession(
    config: SessionFactoryConfig,
    options: {
        sessionId: string
        startedBy?: SessionStartedBy
        workingDirectory: string
        metadataOverrides?: Partial<Metadata>
    }
): Promise<SessionBootstrapResult> {
    const startedBy = options.startedBy ?? 'terminal'
    const api = await ApiClient.create(config)
    const machineId = await getMachineIdOrExit(config.settingsFile)

    await api.getOrCreateMachine({
        machineId,
        metadata: buildMachineMetadata(config)
    })

    const sessionInfo = await api.getSession(options.sessionId)
    const baseMetadata = buildSessionMetadata(config, {
        startedBy,
        workingDirectory: options.workingDirectory,
        machineId
    })
    const metadata = {
        ...baseMetadata,
        ...pickExistingSessionMetadata(sessionInfo.metadata),
        ...options.metadataOverrides
    }

    const buildUpdatedMetadata = (current: Metadata): Metadata => ({
        ...baseMetadata,
        ...pickExistingSessionMetadata(current),
        ...options.metadataOverrides
    })

    const session = api.sessionSyncClient(sessionInfo)
    session.updateMetadata(buildUpdatedMetadata)
    await reportSessionStarted(config.runnerStateFile, sessionInfo.id, metadata)

    return {
        api,
        session,
        sessionInfo,
        metadata,
        machineId,
        startedBy,
        workingDirectory: options.workingDirectory
    }
}
