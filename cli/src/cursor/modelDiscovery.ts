import { spawn } from 'node:child_process';
import { CursorModelDiscoveryResultSchema } from '@hapi/protocol/schemas';
import type { CursorModelDiscoveryResult, CursorModelSummary } from '@hapi/protocol/types';
import { logger } from '@/ui/logger';

const DEFAULT_TIMEOUT_MS = 5000;
const AUTH_FAILURE_PATTERN = /\b(auth|authenticate|authenticated|authentication|login|log in|logged in|sign in|signin|unauthorized|401|403)\b/i;

export function parseCursorModelList(stdout: string): CursorModelSummary[] {
    const models: CursorModelSummary[] = [];
    for (const line of stdout.split(/\r?\n/)) {
        const match = line.match(/^\s*(\S+)\s+-\s+(.+?)\s*$/);
        if (!match) {
            continue;
        }

        models.push({
            id: match[1],
            label: match[2]
        });
    }
    return models;
}

export async function discoverCursorModels(options: {
    timeoutMs?: number;
    now?: () => number;
} = {}): Promise<CursorModelDiscoveryResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const now = options.now ?? Date.now;
    const discoveredAt = now();

    const safeResult = (result: CursorModelDiscoveryResult): CursorModelDiscoveryResult => {
        return CursorModelDiscoveryResultSchema.parse(result);
    };

    return await new Promise<CursorModelDiscoveryResult>((resolve) => {
        let stdout = '';
        let stderr = '';
        let settled = false;
        let child: ReturnType<typeof spawn> | null = null;

        const settle = (result: CursorModelDiscoveryResult) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            resolve(safeResult(result));
        };

        const timeout = setTimeout(() => {
            settle({
                status: 'error',
                reason: 'timed-out',
                discoveredAt
            });
            child?.kill();
        }, timeoutMs);

        try {
            child = spawn('agent', ['models'], {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: process.platform === 'win32'
            });
        } catch (error) {
            clearTimeout(timeout);
            const code = (error as NodeJS.ErrnoException).code;
            settle({
                status: 'error',
                reason: code === 'ENOENT' ? 'cursor-cli-unavailable' : 'unknown',
                discoveredAt
            });
            return;
        }

        child.stdout?.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr?.on('data', (chunk) => {
            const text = chunk.toString();
            stderr += text;
            if (text.trim()) {
                logger.debug('[cursor-model-discovery] stderr:', text.trim());
            }
        });

        child.on('error', (error) => {
            const code = (error as NodeJS.ErrnoException).code;
            settle({
                status: 'error',
                reason: code === 'ENOENT' ? 'cursor-cli-unavailable' : 'unknown',
                discoveredAt
            });
        });

        child.on('exit', (code) => {
            const models = parseCursorModelList(stdout);
            if (models.length > 0) {
                settle({
                    status: 'ok',
                    models,
                    discoveredAt
                });
                return;
            }

            if (code === 0) {
                settle({
                    status: 'error',
                    reason: 'empty-model-list',
                    discoveredAt
                });
                return;
            }

            settle({
                status: 'error',
                reason: AUTH_FAILURE_PATTERN.test(`${stdout}\n${stderr}`) ? 'not-authenticated' : 'unknown',
                discoveredAt
            });
        });
    });
}
