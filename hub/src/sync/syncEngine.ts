import type { LocalResumeTarget, ResumableSession } from '@hapi/protocol'
import type { CursorModelDiscoveryResult, CursorRuntimeConfigApplyResult, DecryptedMessage, PermissionMode, Session, SyncEvent } from '@hapi/protocol/types'
import type { Server } from 'socket.io'
import type { Store, CancelQueuedMessageResult } from '../store'
import type { SessionActivity } from './sessionActivity'
import type { RpcRegistry } from '../socket/rpcRegistry'
import type { SSEManager } from '../sse/sseManager'
import type { KeepaliveScheduler } from '../utils/scheduler'
import { EventPublisher, type SyncEventListener } from './eventPublisher'
import { MachineCache, type Machine } from './machineCache'
import { MessageService } from './messageService'
import {
    RpcGateway,
    type RpcCommandResponse,
    type RpcDeleteUploadResponse,
    type RpcGeneratedImageResponse,
    type RpcListDirectoryResponse,
    type RpcPathExistsResponse,
    type RpcReadFileResponse,
    type SpawnErrorCode,
    type RpcUploadFileResponse
} from './rpcGateway'
import { SessionCache } from './sessionCache'
import { SyncEngineSession, type LocalHandoffResult, type LocalResumeTargetResult, type ResumeSessionResult } from './syncEngineSession'
import { SyncEngineMachine } from './syncEngineMachine'
import { SyncEngineMessage } from './syncEngineMessage'
import { SyncEngineRpc } from './syncEngineRpc'

export type { Session, SyncEvent } from '@hapi/protocol/types'
export type { Machine } from './machineCache'
export type { SyncEventListener } from './eventPublisher'
export type { LocalHandoffResult, LocalResumeTargetResult, ResumeSessionResult } from './syncEngineSession'
export type {
    RpcCommandResponse,
    RpcDeleteUploadResponse,
    RpcGeneratedImageResponse,
    RpcListDirectoryResponse,
    RpcPathExistsResponse,
    RpcReadFileResponse,
    SpawnErrorCode,
    RpcUploadFileResponse
} from './rpcGateway'

export class SyncEngine {
    private readonly eventPublisher: EventPublisher
    private readonly session: SyncEngineSession
    private readonly machine: SyncEngineMachine
    private readonly message: SyncEngineMessage
    private readonly rpc: SyncEngineRpc

    constructor(
        store: Store,
        io: Server,
        rpcRegistry: RpcRegistry,
        sseManager: SSEManager,
        scheduler: KeepaliveScheduler
    ) {
        this.eventPublisher = new EventPublisher(sseManager)
        const sessionCache = new SessionCache(store, this.eventPublisher)
        const machineCache = new MachineCache(store, this.eventPublisher)
        const messageService = new MessageService(
            store,
            io,
            this.eventPublisher,
            (sessionId, updatedAt) => this.recordSessionActivity(sessionId, updatedAt, { kind: 'message' })
        )
        const rpcGateway = new RpcGateway(io, rpcRegistry)

        this.session = new SyncEngineSession(sessionCache, machineCache, messageService, rpcGateway, this.eventPublisher, scheduler)
        this.machine = new SyncEngineMachine(machineCache)
        this.message = new SyncEngineMessage(messageService, sessionCache)
        this.rpc = new SyncEngineRpc(rpcGateway, (payload) => this.session.handleSessionEnd(payload))

        this.session.reloadAll()
        this.session.start()
    }

    shutdown(): void {
        this.session.shutdown()
    }

    subscribe(listener: SyncEventListener): () => void {
        return this.eventPublisher.subscribe(listener)
    }

    getSessions(): Session[] {
        return this.session.getSessions()
    }

    getSession(sessionId: string): Session | undefined {
        return this.session.getSession(sessionId)
    }

    resolveSessionAccess(
        sessionId: string
    ): { ok: true; sessionId: string; session: Session } | { ok: false; reason: 'not-found' } {
        return this.session.resolveSessionAccess(sessionId)
    }

    getActiveSessions(): Session[] {
        return this.session.getActiveSessions()
    }

    getMachines(): Machine[] {
        return this.machine.getMachines()
    }

    getMachine(machineId: string): Machine | undefined {
        return this.machine.getMachine(machineId)
    }

    getOnlineMachines(): Machine[] {
        return this.machine.getOnlineMachines()
    }

    getMessagesPage(
        sessionId: string,
        options: { limit: number; before?: { at: number; seq: number } | null }
    ): {
        messages: DecryptedMessage[]
        page: {
            limit: number
            nextBeforeSeq: number | null
            nextBeforeAt: number | null
            hasMore: boolean
        }
    } {
        return this.message.getMessagesPage(sessionId, options)
    }

    getDeliverableMessagesAfter(sessionId: string, options: { afterSeq: number; limit: number; now: number }): DecryptedMessage[] {
        return this.message.getDeliverableMessagesAfter(sessionId, options)
    }

    handleRealtimeEvent(event: SyncEvent): void {
        this.session.handleRealtimeEvent(event)
    }

    handleSessionAlive(payload: {
        sid: string
        time: number
        thinking?: boolean
        mode?: 'local' | 'remote'
        permissionMode?: PermissionMode
        model?: string | null
        modelReasoningEffort?: string | null
        effort?: string | null
    }): void {
        this.session.handleSessionAlive(payload)
    }

    handleSessionEnd(payload: { sid: string; time: number; reason?: 'completed' | 'terminated' | 'error' }): void {
        this.session.handleSessionEnd(payload)
    }

    handleBackgroundTaskDelta(sessionId: string, delta: { started: number; completed: number }): void {
        this.session.handleBackgroundTaskDelta(sessionId, delta)
    }

    recordSessionActivity(sessionId: string, updatedAt: number, activity?: SessionActivity): void {
        this.session.recordSessionActivity(sessionId, updatedAt, activity)
    }

    handleMachineAlive(payload: { machineId: string; time: number }): void {
        this.machine.handleMachineAlive(payload)
    }

    getOrCreateSession(
        tag: string,
        metadata: unknown,
        agentState: unknown,
        options?: { model?: string; effort?: string; modelReasoningEffort?: string }
    ): Session {
        return this.session.getOrCreateSession(tag, metadata, agentState, options)
    }

    getOrCreateMachine(id: string, metadata: unknown, runnerState: unknown): Machine {
        return this.machine.getOrCreateMachine(id, metadata, runnerState)
    }

    async sendMessage(
        sessionId: string,
        payload: {
            text: string
            localId?: string | null
            attachments?: Array<{
                id: string
                filename: string
                mimeType: string
                size: number
                path: string
                previewUrl?: string
            }>
            sentFrom?: 'webapp'
            scheduledAt?: number | null
        }
    ): Promise<void> {
        await this.message.sendMessage(sessionId, payload)
    }

    async cancelQueuedMessage(
        sessionId: string,
        messageId: string
    ): Promise<CancelQueuedMessageResult> {
        return this.message.cancelQueuedMessage(sessionId, messageId)
    }

    sweepImmediateQueuedOnSessionEnd(sessionId: string, invokedAt: number): void {
        this.message.sweepImmediateQueuedOnSessionEnd(sessionId, invokedAt)
    }

    async approvePermission(
        sessionId: string,
        requestId: string,
        mode?: PermissionMode,
        allowTools?: string[],
        decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort',
        answers?: Record<string, string[]> | Record<string, { answers: string[] }>
    ): Promise<void> {
        await this.rpc.approvePermission(sessionId, requestId, mode, allowTools, decision, answers)
    }

    async denyPermission(
        sessionId: string,
        requestId: string,
        decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort'
    ): Promise<void> {
        await this.rpc.denyPermission(sessionId, requestId, decision)
    }

    async abortSession(sessionId: string): Promise<void> {
        await this.rpc.abortSession(sessionId)
    }

    async archiveSession(sessionId: string): Promise<void> {
        await this.rpc.archiveSession(sessionId)
    }

    async switchSession(sessionId: string, to: 'remote' | 'local'): Promise<void> {
        await this.rpc.switchSession(sessionId, to)
    }

    async renameSession(sessionId: string, name: string): Promise<void> {
        await this.session.renameSession(sessionId, name)
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.session.deleteSession(sessionId)
    }

    async applySessionConfig(
        sessionId: string,
        config: {
            permissionMode?: PermissionMode
            model?: string | null
            modelReasoningEffort?: string | null
            effort?: string | null
        }
    ): Promise<CursorRuntimeConfigApplyResult> {
        return await this.session.applySessionConfig(sessionId, config)
    }

    async spawnSession(
        machineId: string,
        directory: string,
        agent: 'cursor' = 'cursor',
        model?: string,
        modelReasoningEffort?: string,
        yolo?: boolean,
        sessionType?: 'simple' | 'worktree',
        worktreeName?: string,
        resumeSessionId?: string,
        effort?: string,
        permissionMode?: PermissionMode
    ): Promise<{ type: 'success'; sessionId: string } | { type: 'error'; message: string; code?: SpawnErrorCode }> {
        return await this.rpc.spawnSession(
            machineId,
            directory,
            agent,
            model,
            modelReasoningEffort,
            yolo,
            sessionType,
            worktreeName,
            resumeSessionId,
            effort,
            permissionMode
        )
    }

    async discoverCursorModels(machineId: string): Promise<CursorModelDiscoveryResult> {
        return await this.rpc.discoverCursorModels(machineId)
    }

    resolveLocalResumeTarget(sessionId: string, scope: string): LocalResumeTargetResult
    resolveLocalResumeTarget(sessionId: string): LocalResumeTargetResult
    resolveLocalResumeTarget(sessionId: string, _scope?: string): LocalResumeTargetResult {
        return this.session.resolveLocalResumeTarget(sessionId, _scope)
    }

    listLocalResumableSessions(scope: string, opts?: { machineId?: string }): ResumableSession[]
    listLocalResumableSessions(opts?: { machineId?: string }): ResumableSession[]
    listLocalResumableSessions(
        scopeOrOpts?: string | { machineId?: string },
        legacyOpts?: { machineId?: string }
    ): ResumableSession[] {
        return this.session.listLocalResumableSessions(scopeOrOpts, legacyOpts)
    }

    async resumeSession(sessionId: string, scope: string, opts?: { permissionMode?: PermissionMode }): Promise<ResumeSessionResult>
    async resumeSession(sessionId: string, opts?: { permissionMode?: PermissionMode }): Promise<ResumeSessionResult>
    async resumeSession(
        sessionId: string,
        scopeOrOpts?: string | { permissionMode?: PermissionMode },
        legacyOpts?: { permissionMode?: PermissionMode }
    ): Promise<ResumeSessionResult> {
        return this.session.resumeSession(sessionId, scopeOrOpts, legacyOpts)
    }

    async handoffSessionToLocal(sessionId: string, scope: string): Promise<LocalHandoffResult>
    async handoffSessionToLocal(sessionId: string): Promise<LocalHandoffResult>
    async handoffSessionToLocal(sessionId: string, _scope?: string): Promise<LocalHandoffResult> {
        return this.session.handoffSessionToLocal(sessionId, _scope)
    }

    async waitForSessionActive(sessionId: string, timeoutMs: number = 15_000): Promise<boolean> {
        return this.session.waitForSessionActive(sessionId, timeoutMs)
    }

    async waitForSessionInactive(sessionId: string, timeoutMs: number = 15_000): Promise<boolean> {
        return this.session.waitForSessionInactive(sessionId, timeoutMs)
    }

    async checkPathsExist(machineId: string, paths: string[]): Promise<Record<string, boolean>> {
        return await this.rpc.checkPathsExist(machineId, paths)
    }

    async listMachineDirectory(machineId: string, path: string): Promise<RpcListDirectoryResponse> {
        return await this.rpc.listMachineDirectory(machineId, path)
    }

    async getGitStatus(sessionId: string, cwd?: string): Promise<RpcCommandResponse> {
        return await this.rpc.getGitStatus(sessionId, cwd)
    }

    async getGitDiffNumstat(sessionId: string, options: { cwd?: string; staged?: boolean }): Promise<RpcCommandResponse> {
        return await this.rpc.getGitDiffNumstat(sessionId, options)
    }

    async getGitDiffFile(sessionId: string, options: { cwd?: string; filePath: string; staged?: boolean }): Promise<RpcCommandResponse> {
        return await this.rpc.getGitDiffFile(sessionId, options)
    }

    async readSessionFile(sessionId: string, path: string): Promise<RpcReadFileResponse> {
        return await this.rpc.readSessionFile(sessionId, path)
    }

    async readGeneratedImage(sessionId: string, imageId: string): Promise<RpcGeneratedImageResponse> {
        return await this.rpc.readGeneratedImage(sessionId, imageId)
    }

    async listDirectory(sessionId: string, path: string): Promise<RpcListDirectoryResponse> {
        return await this.rpc.listDirectory(sessionId, path)
    }

    async uploadFile(sessionId: string, filename: string, content: string, mimeType: string): Promise<RpcUploadFileResponse> {
        return await this.rpc.uploadFile(sessionId, filename, content, mimeType)
    }

    async deleteUploadFile(sessionId: string, path: string): Promise<RpcDeleteUploadResponse> {
        return await this.rpc.deleteUploadFile(sessionId, path)
    }

    async runRipgrep(sessionId: string, args: string[], cwd?: string): Promise<RpcCommandResponse> {
        return await this.rpc.runRipgrep(sessionId, args, cwd)
    }

    async listSlashCommands(sessionId: string, agent: string): Promise<{
        success: boolean
        commands?: Array<{ name: string; description?: string; source: 'builtin' | 'user' | 'plugin' | 'project' }>
        error?: string
    }> {
        return await this.rpc.listSlashCommands(sessionId, agent)
    }

    async listSkills(sessionId: string): Promise<{
        success: boolean
        skills?: Array<{ name: string; description?: string }>
        error?: string
    }> {
        return await this.rpc.listSkills(sessionId)
    }
}
