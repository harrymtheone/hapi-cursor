import { describe, it, expect } from 'vitest';
import { resolvePermissionMode } from './runCursor';
import { UnknownPermissionModeError } from '@hapi/protocol/modes';

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
