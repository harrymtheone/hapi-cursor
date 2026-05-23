import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ApiMachineClient } from './apiMachine';
import type { Machine } from './types';
import { discoverCursorModels } from '../cursor/modelDiscovery';

vi.mock('../cursor/modelDiscovery', () => ({
    discoverCursorModels: vi.fn()
}));

function createMachine(): Machine {
    return {
        id: 'machine-1',
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadata: {
            host: 'host',
            platform: 'linux',
            happyCliVersion: '0.0.0',
            homeDir: '/home/user',
            happyHomeDir: '/home/user/.hapi',
            happyLibDir: '/home/user/.hapi/lib'
        },
        metadataVersion: 1,
        runnerState: null,
        runnerStateVersion: 1
    };
}

describe('ApiMachineClient runtime discovery RPC', () => {
    beforeEach(() => {
        vi.mocked(discoverCursorModels).mockReset();
    });

    it('registers a machine-scoped discover-cursor-models handler that returns a schema-valid result', async () => {
        vi.mocked(discoverCursorModels).mockResolvedValue({
            status: 'ok',
            models: [{ id: 'runtime-fast', label: 'Fast runtime' }],
            discoveredAt: 1234
        });
        const client = new ApiMachineClient(
            'token',
            createMachine(),
            { apiUrl: 'http://127.0.0.1:3006' },
            ['/tmp']
        );

        client.setRPCHandlers({
            spawnSession: vi.fn(),
            stopSession: vi.fn(),
            requestShutdown: vi.fn()
        });

        const response = await (client as unknown as {
            rpcHandlerManager: {
                hasHandler: (method: string) => boolean;
                handleRequest: (request: { method: string; params: string }) => Promise<string>;
            };
        }).rpcHandlerManager.handleRequest({
            method: 'machine-1:discover-cursor-models',
            params: '{}'
        });

        expect(JSON.parse(response)).toEqual({
            status: 'ok',
            models: [{ id: 'runtime-fast', label: 'Fast runtime' }],
            discoveredAt: 1234
        });
        expect(discoverCursorModels).toHaveBeenCalledTimes(1);
    });
});
