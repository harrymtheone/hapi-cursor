/**
 * REFT-01 — Cursor permission contract matrix.
 *
 * This file is intentionally separate from `modeConfig.test.ts` (D-178):
 *   - `modeConfig.test.ts` owns behavioral coverage of
 *     `permissionModeToCursorArgs`, including the `UnknownPermissionModeError`
 *     throw path and the `undefined` carve-out for direct callers.
 *   - THIS file owns the contract matrix that any new `PermissionMode`
 *     literal must extend, providing:
 *       - D-176: compile-time exhaustiveness via
 *         `satisfies Record<PermissionMode, ExpectedSpec>` PLUS a runtime
 *         key-set cross-check against `CURSOR_PERMISSION_MODES` (so removing
 *         a key from the matrix while it remains in the source-of-truth
 *         array fails at runtime).
 *       - D-177: per-row strict `toEqual` against
 *         `permissionModeToCursorArgs` (never partial match).
 *
 * Adding a new mode literal to `shared/src/modes.ts` without extending the
 * `MATRIX` below will fail `bun typecheck` — that is the contract this file
 * exists to enforce (Phase 11 Success Criterion #1).
 */
import { describe, expect, it } from 'vitest';
import type { PermissionMode } from '@/cursor/modes';
import { CURSOR_PERMISSION_MODES } from '@hapi/protocol/modes';
import { FLAVOR_CAPS } from '@hapi/protocol/flavors';
import {
    permissionModeToCursorArgs,
    type CursorArgsFragment,
} from './modeConfig';

type ExpectedSpec = { expectedArgs: CursorArgsFragment };

const MATRIX = {
    default: { expectedArgs: {} },
    plan: { expectedArgs: { mode: 'plan' } },
    ask: { expectedArgs: { mode: 'ask' } },
    yolo: { expectedArgs: { yolo: true } },
} as const satisfies Record<PermissionMode, ExpectedSpec>;

describe('Cursor permission contract matrix (REFT-01)', () => {
    it('matrix keys equal CURSOR_PERMISSION_MODES (D-176 runtime key-set guard)', () => {
        expect(Object.keys(MATRIX).sort()).toEqual(
            [...CURSOR_PERMISSION_MODES].sort()
        );
    });

    it('matrix keys equal FLAVOR_CAPS.cursor.permissionModes (capability-table alignment)', () => {
        expect(Object.keys(MATRIX).sort()).toEqual(
            [...FLAVOR_CAPS.cursor.permissionModes].sort()
        );
    });

    for (const [mode, spec] of Object.entries(MATRIX) as Array<
        [PermissionMode, ExpectedSpec]
    >) {
        it(`mode '${mode}' produces ${JSON.stringify(spec.expectedArgs)} (D-177)`, () => {
            expect(permissionModeToCursorArgs(mode)).toEqual(spec.expectedArgs);
        });
    }

    it('returns {} for undefined (carve-out — not a PermissionMode member)', () => {
        expect(permissionModeToCursorArgs(undefined)).toEqual({});
    });
});
