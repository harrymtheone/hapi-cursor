import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { discoverCursorModels, parseCursorModelList } from './modelDiscovery';

const spawnMock = vi.hoisted(() => vi.fn());
const loggerDebugMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
    spawn: spawnMock
}));

vi.mock('@/ui/logger', () => ({
    logger: {
        debug: loggerDebugMock
    }
}));

class FakeChildProcess extends EventEmitter {
    stdout = new PassThrough();
    stderr = new PassThrough();
    killed = false;

    kill(): boolean {
        this.killed = true;
        this.emit('exit', null, 'SIGTERM');
        return true;
    }
}

function spawnDiscoveryProcess(): FakeChildProcess {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValueOnce(child);
    return child;
}

describe('parseCursorModelList', () => {
    it('extracts raw ids and labels from Cursor model list output', () => {
        expect(parseCursorModelList([
            'runtime-fast - Fast runtime',
            'runtime-deep - Deep runtime',
            'not a model row'
        ].join('\n'))).toEqual([
            { id: 'runtime-fast', label: 'Fast runtime' },
            { id: 'runtime-deep', label: 'Deep runtime' }
        ]);
    });

    it('preserves raw Cursor ids as primary values', () => {
        const [model] = parseCursorModelList('vendor/model:2026-high - Display label');

        expect(model).toEqual({
            id: 'vendor/model:2026-high',
            label: 'Display label'
        });
    });
});

describe('discoverCursorModels', () => {
    beforeEach(() => {
        spawnMock.mockReset();
        loggerDebugMock.mockReset();
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('runs the local Cursor runtime with an argument array and returns parsed models', async () => {
        const child = spawnDiscoveryProcess();
        const resultPromise = discoverCursorModels({ now: () => 1234 });

        child.stdout.write('runtime-fast - Fast runtime\n');
        child.stderr.write('private diagnostic detail\n');
        child.emit('exit', 0, null);
        child.stdout.end();
        child.stderr.end();

        await expect(resultPromise).resolves.toEqual({
            status: 'ok',
            models: [{ id: 'runtime-fast', label: 'Fast runtime' }],
            discoveredAt: 1234
        });
        expect(spawnMock).toHaveBeenCalledWith('agent', ['models'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32'
        });
        expect(loggerDebugMock).toHaveBeenCalledWith(
            '[cursor-model-discovery] stderr:',
            'private diagnostic detail'
        );
    });

    it('returns a safe empty-list error for usable command output with no models', async () => {
        const child = spawnDiscoveryProcess();
        const resultPromise = discoverCursorModels({ now: () => 2222 });

        child.stdout.write('No models available\n');
        child.emit('exit', 0, null);
        child.stdout.end();
        child.stderr.end();

        await expect(resultPromise).resolves.toEqual({
            status: 'error',
            reason: 'empty-model-list',
            discoveredAt: 2222
        });
    });

    it('times out and kills the child process', async () => {
        vi.useFakeTimers();
        const child = spawnDiscoveryProcess();
        const resultPromise = discoverCursorModels({ timeoutMs: 25, now: () => 3333 });

        await vi.advanceTimersByTimeAsync(25);

        await expect(resultPromise).resolves.toEqual({
            status: 'error',
            reason: 'timed-out',
            discoveredAt: 3333
        });
        expect(child.killed).toBe(true);
    });

    it('returns cursor-cli-unavailable when the executable is missing', async () => {
        const child = spawnDiscoveryProcess();
        const resultPromise = discoverCursorModels({ now: () => 4444 });

        child.emit('error', Object.assign(new Error('spawn agent ENOENT'), { code: 'ENOENT' }));

        await expect(resultPromise).resolves.toEqual({
            status: 'error',
            reason: 'cursor-cli-unavailable',
            discoveredAt: 4444
        });
    });

    it('classifies nonzero auth failures without exposing raw output', async () => {
        const child = spawnDiscoveryProcess();
        const resultPromise = discoverCursorModels({ now: () => 5555 });

        child.stderr.write('Please login with Cursor first\n');
        child.emit('exit', 1, null);
        child.stdout.end();
        child.stderr.end();

        const result = await resultPromise;

        expect(result).toEqual({
            status: 'error',
            reason: 'not-authenticated',
            discoveredAt: 5555
        });
        expect(result).not.toHaveProperty('stderr');
        expect(result).not.toHaveProperty('stdout');
    });
});
