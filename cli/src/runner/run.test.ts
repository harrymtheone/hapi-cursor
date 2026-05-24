import { describe, it, expect } from 'vitest';

import { toSafeSpawnFailure } from './run';

describe('toSafeSpawnFailure', () => {
    it('returns selected-runtime-config-rejected for explicit selected model launch failures', () => {
        expect(toSafeSpawnFailure({
            directory: '/tmp',
            model: 'runtime-fast'
        }, 'Session process exited before webhook. stderr: raw runtime output')).toEqual({
            type: 'error',
            code: 'selected-runtime-config-rejected',
            errorMessage: 'Cursor rejected the selected runtime config'
        });
    });

    it('preserves ordinary spawn failures for auto or unspecified runtime launches', () => {
        expect(toSafeSpawnFailure({
            directory: '/tmp'
        }, 'Session webhook timeout')).toEqual({
            type: 'error',
            errorMessage: 'Session webhook timeout'
        });
    });

    it('does not infer selected-runtime-config-rejected from unsupported effort-shaped input', () => {
        expect(toSafeSpawnFailure({
            directory: '/tmp',
            ...({ effort: 'high' } as Record<string, unknown>)
        }, 'Session webhook timeout')).toEqual({
            type: 'error',
            errorMessage: 'Session webhook timeout'
        });
    });
});
