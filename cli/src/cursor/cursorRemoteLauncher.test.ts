import { describe, it, expect } from 'vitest';
import { buildAgentArgs } from './cursorRemoteLauncher';
import { permissionModeToCursorArgs } from '@/agent/modeConfig';

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
});
