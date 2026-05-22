import { describe, it, expect } from 'vitest';
import { permissionModeToCursorArgs } from './modeConfig';
import { UnknownPermissionModeError } from '@hapi/protocol/modes';

describe('permissionModeToCursorArgs', () => {
    it('returns {} for undefined', () => {
        expect(permissionModeToCursorArgs(undefined)).toEqual({});
    });

    it("returns {} for 'default'", () => {
        expect(permissionModeToCursorArgs('default')).toEqual({});
    });

    it("returns { mode: 'plan' } for 'plan'", () => {
        expect(permissionModeToCursorArgs('plan')).toEqual({ mode: 'plan' });
    });

    it("returns { mode: 'ask' } for 'ask'", () => {
        expect(permissionModeToCursorArgs('ask')).toEqual({ mode: 'ask' });
    });

    it("returns { yolo: true } for 'yolo'", () => {
        expect(permissionModeToCursorArgs('yolo')).toEqual({ yolo: true });
    });

    it('throws UnknownPermissionModeError with offendingMode for unknown string', () => {
        let caught: unknown;
        try {
            // @ts-expect-error — 'weird' is not a valid PermissionMode; exercises unknown-mode throw path
            permissionModeToCursorArgs('weird');
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(UnknownPermissionModeError);
        expect((caught as UnknownPermissionModeError).offendingMode).toBe('weird');
    });
});
