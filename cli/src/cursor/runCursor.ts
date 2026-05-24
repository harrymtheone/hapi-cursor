import { logger } from '@/ui/logger';
import { loop } from './loop';
import type { EnhancedMode, PermissionMode } from './modes';
import { MessageQueue2 } from '@/utils/MessageQueue2';
import { hashObject } from '@/utils/deterministicJson';
import { registerKillSessionHandler } from '@/agent/registerKillSessionHandler';
import type { AgentState } from '@/api/types';
import type { CursorSession } from './session';
import { bootstrapExistingSession, bootstrapSession } from '@/agent/sessionFactory';
import type { Config } from '@/configuration';
import { registerLocalHandoffHandler } from '@/agent/localHandoff';
import { createModeChangeHandler, createRunnerLifecycle, setControlledByUser } from '@/agent/runnerLifecycle';
import { isPermissionModeAllowedForFlavor } from '@hapi/protocol';
import { UnknownPermissionModeError } from '@hapi/protocol/modes';
import { CursorRuntimeConfigApplyResultSchema, PermissionModeSchema } from '@hapi/protocol/schemas';
import type { CursorRuntimeConfigApplyResult } from '@hapi/protocol/types';
import { formatMessageWithAttachments } from '@/utils/attachmentFormatter';
import { getInvokedCwd } from '@/utils/invokedCwd';
import { z } from 'zod';

export const resolvePermissionMode = (value: unknown): PermissionMode => {
    const parsed = PermissionModeSchema.safeParse(value);
    if (!parsed.success || !isPermissionModeAllowedForFlavor(parsed.data, 'cursor')) {
        throw new UnknownPermissionModeError(typeof value === 'string' ? value : JSON.stringify(value));
    }
    return parsed.data as PermissionMode;
};

const nullableRuntimeConfigValue = z.string().trim().min(1).nullable();

const CursorSessionConfigPayloadSchema = z.object({
    permissionMode: z.unknown().optional(),
    model: nullableRuntimeConfigValue.optional(),
    modelReasoningEffort: nullableRuntimeConfigValue.optional(),
    effort: nullableRuntimeConfigValue.optional()
}).strict();

type CursorSessionConfigApplyResponse =
    | CursorRuntimeConfigApplyResult
    | { applied: { permissionMode: PermissionMode } };

export function applyCursorSessionConfig(
    payload: unknown,
    state: {
        currentPermissionMode: PermissionMode;
        currentModel: string | null | undefined;
        currentModelReasoningEffort: string | null | undefined;
        currentEffort: string | null | undefined;
        syncPermissionMode: (mode: PermissionMode) => void;
    }
): CursorSessionConfigApplyResponse {
    const parsed = CursorSessionConfigPayloadSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error('Invalid session config payload');
    }

    const config = parsed.data;
    let nextPermissionMode = state.currentPermissionMode;
    if (config.permissionMode !== undefined) {
        nextPermissionMode = resolvePermissionMode(config.permissionMode);
        state.syncPermissionMode(nextPermissionMode);
    }

    const hasModelConfigRequest = Object.prototype.hasOwnProperty.call(config, 'model');

    if (!hasModelConfigRequest) {
        const hasUnsupportedEffortRequest =
            Object.prototype.hasOwnProperty.call(config, 'effort')
            || Object.prototype.hasOwnProperty.call(config, 'modelReasoningEffort');
        if (hasUnsupportedEffortRequest && config.permissionMode === undefined) {
            return CursorRuntimeConfigApplyResultSchema.parse({
                status: 'failed',
                model: state.currentModel ?? null,
                modelReasoningEffort: null,
                effort: null,
                reason: 'unknown'
            });
        }
        return { applied: { permissionMode: nextPermissionMode } };
    }

    return CursorRuntimeConfigApplyResultSchema.parse({
        status: 'applies-next-run',
        model: config.model,
        modelReasoningEffort: null,
        effort: null,
        reason: 'unknown'
    });
}

const formatFailureReason = (message: string): string => {
    const maxLength = 200;
    if (message.length <= maxLength) {
        return message;
    }
    return `${message.slice(0, maxLength)}...`;
};

export async function runCursor(
    config: Pick<Config, 'apiUrl' | 'cliApiToken' | 'extraHeaders' | 'happyHomeDir' | 'settingsFile' | 'runnerStateFile'>,
    opts: {
        startedBy?: 'runner' | 'terminal';
        cursorArgs?: string[];
        permissionMode?: PermissionMode;
        resumeSessionId?: string;
        model?: string;
        existingSessionId?: string;
        workingDirectory?: string;
    }
): Promise<void> {
    const workingDirectory = opts.workingDirectory ?? getInvokedCwd();
    const startedBy = opts.startedBy ?? 'terminal';

    logger.debug(`[cursor] Starting with options: startedBy=${startedBy}`);

    const state: AgentState = {
        controlledByUser: false
    };
    const bootstrap = opts.existingSessionId
        ? await bootstrapExistingSession(config, {
            sessionId: opts.existingSessionId,
            startedBy,
            workingDirectory
        })
        : await bootstrapSession(config, {
            startedBy,
            workingDirectory,
            agentState: state,
            model: opts.model
        });
    const { api, session } = bootstrap;

    const startingMode: 'local' | 'remote' = startedBy === 'runner' ? 'remote' : 'local';

    setControlledByUser(session, startingMode);

    const messageQueue = new MessageQueue2<EnhancedMode>((mode) =>
        hashObject({
            permissionMode: mode.permissionMode,
            model: mode.model
        })
    );

    const sessionWrapperRef: { current: CursorSession | null } = { current: null };

    let currentPermissionMode: PermissionMode = opts.permissionMode ?? 'default';
    const currentModel = opts.model;

    const lifecycle = createRunnerLifecycle({
        session,
        logTag: 'cursor',
        stopKeepAlive: () => sessionWrapperRef.current?.stopKeepAlive()
    });

    lifecycle.registerProcessHandlers();
    registerKillSessionHandler(session.rpcHandlerManager, lifecycle.cleanupAndExit);
    registerLocalHandoffHandler(session.rpcHandlerManager, lifecycle);

    const syncSessionMode = () => {
        const sessionInstance = sessionWrapperRef.current;
        if (!sessionInstance) {
            return;
        }
        sessionInstance.setPermissionMode(currentPermissionMode);
        logger.debug(`[cursor] Synced session permission mode: ${currentPermissionMode}`);
    };

    session.onUserMessage((message, localId) => {
        const enhancedMode: EnhancedMode = {
            permissionMode: currentPermissionMode ?? 'default',
            model: currentModel
        };
        const formattedText = formatMessageWithAttachments(message.content.text, message.content.attachments);
        messageQueue.push(formattedText, enhancedMode, localId);
    });

    session.onCancelQueuedMessage((localId) => {
        const removed = messageQueue.cancelByLocalId(localId);
        logger.debug(`[cursor] cancelByLocalId(${localId}): ${removed ? 'removed' : 'not found (best-effort)'}`);
        return removed;
    });

    session.rpcHandlerManager.registerHandler('set-session-config', async (payload: unknown) => {
        return applyCursorSessionConfig(payload, {
            currentPermissionMode,
            currentModel: currentModel ?? null,
            currentModelReasoningEffort: null,
            currentEffort: null,
            syncPermissionMode: (mode) => {
                currentPermissionMode = mode;
                syncSessionMode();
            }
        });
    });

    let crashed = false;

    try {
        await loop({
            path: workingDirectory,
            startingMode,
            messageQueue,
            api,
            session,
            cursorArgs: opts.cursorArgs,
            startedBy,
            permissionMode: currentPermissionMode,
            resumeSessionId: opts.resumeSessionId,
            model: opts.model,
            onModeChange: createModeChangeHandler(session),
            onSessionReady: (instance) => {
                sessionWrapperRef.current = instance;
                syncSessionMode();
            }
        });
    } catch (error) {
        crashed = true;
        lifecycle.markCrash(error);
        logger.debug('[cursor] Loop error:', error);
    } finally {
        const localFailure = sessionWrapperRef.current?.localLaunchFailure;
        if (localFailure?.exitReason === 'exit') {
            lifecycle.setExitCode(1);
            lifecycle.setArchiveReason(`Local launch failed: ${formatFailureReason(localFailure.message)}`);
            lifecycle.setSessionEndReason('error');
        } else if (!crashed) {
            lifecycle.setSessionEndReason('completed');
        }
        await lifecycle.cleanupAndExit();
    }
}
