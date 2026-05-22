import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/spawnWithTerminalGuard', () => ({
    spawnWithTerminalGuard: vi.fn(async () => {})
}));

import { cursorLocal } from './cursorLocal';
import { spawnWithTerminalGuard } from '@/utils/spawnWithTerminalGuard';

describe('cursorLocal mid-session permission-mode switch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('emits --mode plan then no --mode flag when switched back to default', async () => {
        const ctrl = new AbortController();

        await cursorLocal({ abort: ctrl.signal, chatId: null, path: '/tmp', mode: 'plan' });
        const firstArgs = vi.mocked(spawnWithTerminalGuard).mock.calls[0][0].args;
        expect(firstArgs).toEqual(expect.arrayContaining(['--mode', 'plan']));

        await cursorLocal({ abort: ctrl.signal, chatId: null, path: '/tmp' });
        const secondArgs = vi.mocked(spawnWithTerminalGuard).mock.calls[1][0].args;
        expect(secondArgs).not.toContain('--mode');
    });
});
