import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillSummary } from '@hapi/protocol/schemas';
import type { UserMessage } from '@hapi/protocol/types';
import { MessageQueue2 } from '@/utils/MessageQueue2';
import { makeConfig } from '@/__fixtures__/config';
import { applyCursorSessionConfig, resolvePermissionMode } from './runCursor';
import { UnknownPermissionModeError } from '@hapi/protocol/modes';

const HAPI_SESSION_SKILL_POLICY_MARKER = '[HAPI session skill policy]';

const {
    listSkillsMock,
    loopMock,
    bootstrapSessionMock,
    setControlledByUserMock,
    createModeChangeHandlerMock,
    createRunnerLifecycleMock,
    registerKillSessionHandlerMock,
    registerLocalHandoffHandlerMock
} = vi.hoisted(() => ({
    listSkillsMock: vi.fn<typeof import('@/modules/common/skills').listSkills>(),
    loopMock: vi.fn(async () => {}),
    bootstrapSessionMock: vi.fn(),
    setControlledByUserMock: vi.fn(),
    createModeChangeHandlerMock: vi.fn(() => vi.fn()),
    createRunnerLifecycleMock: vi.fn(),
    registerKillSessionHandlerMock: vi.fn(),
    registerLocalHandoffHandlerMock: vi.fn()
}));

vi.mock('@/modules/common/skills', () => ({
    listSkills: listSkillsMock
}));

vi.mock('@/cursor/loop', () => ({
    loop: loopMock
}));

vi.mock('@/agent/sessionFactory', () => ({
    bootstrapSession: bootstrapSessionMock,
    bootstrapExistingSession: vi.fn()
}));

vi.mock('@/agent/runnerLifecycle', () => ({
    setControlledByUser: setControlledByUserMock,
    createModeChangeHandler: createModeChangeHandlerMock,
    createRunnerLifecycle: createRunnerLifecycleMock
}));

vi.mock('@/agent/registerKillSessionHandler', () => ({
    registerKillSessionHandler: registerKillSessionHandlerMock
}));

vi.mock('@/agent/localHandoff', () => ({
    registerLocalHandoffHandler: registerLocalHandoffHandlerMock
}));

function skill(name: string): SkillSummary {
    return { name, source: 'project', valid: true, pathHint: name };
}

function userMessage(text: string): UserMessage {
    return { role: 'user', content: { type: 'text', text, attachments: [] } };
}

describe('resolvePermissionMode (RPC-boundary regression sentry — D-104 #3b / VALIDATION dim 3)', () => {
    it('throws UnknownPermissionModeError for invalid string payload', () => {
        expect(() => resolvePermissionMode('weird')).toThrow(UnknownPermissionModeError);

        let caught: unknown;
        try {
            resolvePermissionMode('weird');
        } catch (e) {
            caught = e;
        }
        expect(caught instanceof UnknownPermissionModeError).toBe(true);
        expect((caught as UnknownPermissionModeError).offendingMode).toBe('weird');
    });

    it('throws UnknownPermissionModeError with JSON-stringified payload for non-string input', () => {
        const payload = { not: 'a string' };
        let caught: unknown;
        try {
            resolvePermissionMode(payload);
        } catch (e) {
            caught = e;
        }
        expect(caught instanceof UnknownPermissionModeError).toBe(true);
        expect((caught as UnknownPermissionModeError).offendingMode).toBe(JSON.stringify(payload));
    });

    it('returns the validated PermissionMode for valid cursor mode', () => {
        expect(resolvePermissionMode('plan')).toBe('plan');
    });
});

describe('runCursor onUserMessage skill refresh', () => {
    let onUserMessageHandler: ((message: UserMessage, localId?: string) => void | Promise<void>) | undefined;
    let pushSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        onUserMessageHandler = undefined;
        listSkillsMock.mockReset();
        listSkillsMock.mockResolvedValue([skill('deploy')]);
        loopMock.mockReset();
        loopMock.mockResolvedValue(undefined);
        bootstrapSessionMock.mockReset();
        createRunnerLifecycleMock.mockReset();
        createRunnerLifecycleMock.mockReturnValue({
            registerProcessHandlers: vi.fn(),
            cleanupAndExit: vi.fn(async () => {}),
            markCrash: vi.fn(),
            setExitCode: vi.fn(),
            setArchiveReason: vi.fn(),
            setSessionEndReason: vi.fn()
        });

        const session = {
            onUserMessage: vi.fn((callback: typeof onUserMessageHandler) => {
                onUserMessageHandler = callback;
            }),
            onCancelQueuedMessage: vi.fn(),
            rpcHandlerManager: { registerHandler: vi.fn() },
            getMetadata: vi.fn(() => null),
            updateMetadata: vi.fn(),
            updateAgentState: vi.fn(),
            sendSessionEvent: vi.fn(),
            sendSessionDeath: vi.fn(),
            flush: vi.fn(async () => {}),
            close: vi.fn(async () => {})
        };

        bootstrapSessionMock.mockResolvedValue({ api: {}, session });

        pushSpy = vi.spyOn(MessageQueue2.prototype, 'push');

        const { runCursor } = await import('./runCursor');
        await runCursor(makeConfig(), { workingDirectory: '/tmp/project', startedBy: 'runner' });
    });

    it('calls listSkills when a user message is queued', async () => {
        expect(onUserMessageHandler).toBeDefined();
        listSkillsMock.mockClear();

        await onUserMessageHandler!(userMessage('hello'), 'local-1');

        expect(listSkillsMock).toHaveBeenCalledWith('/tmp/project');
        expect(listSkillsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('queues formatted text without HAPI session skill policy marker', async () => {
        expect(onUserMessageHandler).toBeDefined();
        pushSpy.mockClear();

        await onUserMessageHandler!(userMessage('plain user text'), 'local-2');

        expect(pushSpy).toHaveBeenCalled();
        const queuedText = pushSpy.mock.calls[0]?.[0] as string;
        expect(queuedText).toBe('plain user text');
        expect(queuedText).not.toContain(HAPI_SESSION_SKILL_POLICY_MARKER);
    });

    it('coalesces concurrent refreshSkills calls (single listSkills in flight)', async () => {
        expect(onUserMessageHandler).toBeDefined();
        let resolveListSkills: (skills: SkillSummary[]) => void = () => {};
        listSkillsMock.mockImplementation(() => new Promise((resolve) => {
            resolveListSkills = resolve;
        }));

        const first = onUserMessageHandler!(userMessage('one'), 'local-a');
        const second = onUserMessageHandler!(userMessage('two'), 'local-b');

        expect(listSkillsMock).toHaveBeenCalledTimes(1);

        resolveListSkills([skill('alpha')]);
        await Promise.all([first, second]);

        expect(listSkillsMock).toHaveBeenCalledTimes(1);
    });
});

describe('applyCursorSessionConfig', () => {
    it('keeps permission mode changes applied through the existing runtime path', () => {
        const syncPermissionMode = vi.fn();

        const result = applyCursorSessionConfig(
            { permissionMode: 'plan' },
            {
                currentPermissionMode: 'default',
                currentModel: 'cursor-runtime-model-raw-id',
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toEqual({ applied: { permissionMode: 'plan' } });
        expect(syncPermissionMode).toHaveBeenCalledWith('plan');
    });

    it('strips unsupported effort fields from runtime config acknowledgements', () => {
        const syncPermissionMode = vi.fn();

        const result = applyCursorSessionConfig(
            {
                model: 'cursor-runtime-model-next',
                modelReasoningEffort: 'medium',
                effort: 'background'
            },
            {
                currentPermissionMode: 'default',
                currentModel: 'cursor-runtime-model-current',
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toEqual({
            status: 'applies-next-run',
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        });
        expect(syncPermissionMode).not.toHaveBeenCalled();
    });

    it('does not treat unsupported effort-only payloads as runtime config changes', () => {
        const syncPermissionMode = vi.fn();

        const result = applyCursorSessionConfig(
            { modelReasoningEffort: 'medium', effort: 'background' },
            {
                currentPermissionMode: 'default',
                currentModel: 'cursor-runtime-model-current',
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toEqual({
            status: 'failed',
            model: 'cursor-runtime-model-current',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        });
        expect(syncPermissionMode).not.toHaveBeenCalled();
    });

    it('does not persist effort-only payloads as runtime config changes', () => {
        const syncPermissionMode = vi.fn();

        const result = applyCursorSessionConfig(
            { effort: 'high' },
            {
                currentPermissionMode: 'default',
                currentModel: 'cursor-runtime-model-current',
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toEqual({
            status: 'failed',
            model: 'cursor-runtime-model-current',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        });
        expect(result).not.toEqual({ applied: { permissionMode: 'default' } });
        expect(syncPermissionMode).not.toHaveBeenCalled();
    });

    it('reports model changes as applies-next-run without claiming active hot switch', () => {
        const syncPermissionMode = vi.fn();

        const result = applyCursorSessionConfig(
            { model: 'cursor-runtime-model-next' },
            {
                currentPermissionMode: 'default',
                currentModel: 'cursor-runtime-model-current',
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toEqual({
            status: 'applies-next-run',
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        });
        expect(syncPermissionMode).not.toHaveBeenCalled();
    });

    it('rejects invalid model payloads before runtime mutation', () => {
        expect(() => applyCursorSessionConfig(
            { model: 123 },
            {
                currentPermissionMode: 'default',
                currentModel: null,
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode: vi.fn()
            }
        )).toThrow('Invalid session config payload');
    });

    it('mutates current model via syncModel callback on applies-next-run model branch', () => {
        const syncPermissionMode = vi.fn();
        const syncModel = vi.fn();
        const state = {
            currentPermissionMode: 'default' as const,
            currentModel: 'cursor-runtime-model-current',
            currentModelReasoningEffort: null,
            currentEffort: null,
            syncPermissionMode,
            syncModel
        };

        const result = applyCursorSessionConfig({ model: 'cursor-runtime-model-next' }, state);

        expect(result).toEqual({
            status: 'applies-next-run',
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        });
        expect(syncModel).toHaveBeenCalledTimes(1);
        expect(syncModel).toHaveBeenCalledWith('cursor-runtime-model-next');
        expect(syncPermissionMode).not.toHaveBeenCalled();

        syncModel.mockClear();
        const clearResult = applyCursorSessionConfig({ model: null }, state);
        expect(clearResult).toMatchObject({ status: 'applies-next-run', model: null });
        expect(syncModel).toHaveBeenCalledTimes(1);
        expect(syncModel).toHaveBeenCalledWith(null);
    });

    it('syncModel is independent of syncPermissionMode (permission-only payload does not call syncModel)', () => {
        const syncPermissionMode = vi.fn();
        const syncModel = vi.fn();
        const state = {
            currentPermissionMode: 'default' as const,
            currentModel: 'cursor-runtime-model-current',
            currentModelReasoningEffort: null,
            currentEffort: null,
            syncPermissionMode,
            syncModel
        };

        const result = applyCursorSessionConfig({ permissionMode: 'plan' }, state);

        expect(result).toEqual({ applied: { permissionMode: 'plan' } });
        expect(syncPermissionMode).toHaveBeenCalledWith('plan');
        expect(syncModel).not.toHaveBeenCalled();
    });

    it('does not emit timeline events for model status results', () => {
        const syncPermissionMode = vi.fn();
        const sendSessionEvent = vi.fn();

        const result = applyCursorSessionConfig(
            { model: 'cursor-runtime-model-next' },
            {
                currentPermissionMode: 'default',
                currentModel: null,
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toMatchObject({ status: 'applies-next-run' });
        expect(sendSessionEvent).not.toHaveBeenCalled();
    });
});
