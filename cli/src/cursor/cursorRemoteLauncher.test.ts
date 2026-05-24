import { describe, it, expect, vi } from 'vitest';
import { buildAgentArgs } from './cursorRemoteLauncher';
import { permissionModeToCursorArgs } from '@/agent/modeConfig';
import { CursorSession } from './session';
import { MessageQueue2 } from '@/utils/MessageQueue2';
import { hashObject } from '@/utils/deterministicJson';
import type { EnhancedMode } from './modes';

function createSessionStub(model: string | undefined): CursorSession {
    const client = {
        keepAlive: vi.fn(),
        sendAgentMessage: vi.fn(),
        sendUserMessage: vi.fn(),
        sendSessionEvent: vi.fn(),
        emitMessagesConsumed: vi.fn(),
        updateMetadata: vi.fn(),
        rpcHandlerManager: { registerHandler: vi.fn() }
    } as unknown as ConstructorParameters<typeof CursorSession>[0]['client'];
    const api = {} as ConstructorParameters<typeof CursorSession>[0]['api'];
    const queue = new MessageQueue2<EnhancedMode>((mode) =>
        hashObject({ permissionMode: mode.permissionMode, model: mode.model })
    );
    const session = new CursorSession({
        api,
        client,
        path: '/tmp/p',
        logPath: '/tmp/p/log',
        sessionId: null,
        messageQueue: queue,
        onModeChange: () => {},
        startedBy: 'runner',
        startingMode: 'remote',
        model
    });
    session.stopKeepAlive();
    return session;
}

describe('cursorRemoteLauncher mid-session permission-mode switch', () => {
    it('args contain --yolo and not --mode after switching from default to yolo', () => {
        const frag1 = permissionModeToCursorArgs('default');
        const args1 = buildAgentArgs({ message: 'hi', cwd: '/tmp', sessionId: 's1', ...frag1 });
        expect(args1).not.toContain('--yolo');
        expect(args1).not.toContain('--mode');

        const frag2 = permissionModeToCursorArgs('yolo');
        const args2 = buildAgentArgs({ message: 'continue', cwd: '/tmp', sessionId: 's1', ...frag2 });
        expect(args2).toContain('--yolo');
        expect(args2).not.toContain('--mode');
    });

    it('args contain --mode plan and not --yolo for plan turn', () => {
        const frag = permissionModeToCursorArgs('plan');
        const args = buildAgentArgs({ message: 'q', cwd: '/tmp', sessionId: null, ...frag });
        expect(args).toEqual(expect.arrayContaining(['--mode', 'plan']));
        expect(args).not.toContain('--yolo');
    });

    it('buildAgentArgs prefers per-turn mode.model over session.model when constructing next spawn args', () => {
        const args1 = buildAgentArgs({
            message: 'first',
            cwd: '/tmp/p',
            sessionId: 'cursor-session-abc',
            model: 'cursor-runtime-model-current'
        });
        expect(args1).toEqual(expect.arrayContaining(['--model', 'cursor-runtime-model-current']));
        expect(args1).toEqual(expect.arrayContaining(['--resume', 'cursor-session-abc']));

        const args2 = buildAgentArgs({
            message: 'second',
            cwd: '/tmp/p',
            sessionId: 'cursor-session-abc',
            model: 'cursor-runtime-model-next'
        });
        expect(args2).toEqual(expect.arrayContaining(['--model', 'cursor-runtime-model-next']));
        expect(args2).not.toEqual(expect.arrayContaining(['--model', 'cursor-runtime-model-current']));
        expect(args2).toEqual(expect.arrayContaining(['--resume', 'cursor-session-abc']));
    });

    it('CursorSession.setModel mutates session.model so the launcher sees the latest selected model', () => {
        const session = createSessionStub('cursor-runtime-model-current');
        expect(session.model).toBe('cursor-runtime-model-current');

        session.setModel('cursor-runtime-model-next');
        expect(session.model).toBe('cursor-runtime-model-next');

        session.setModel(null);
        expect(session.model).toBeUndefined();
    });
});
