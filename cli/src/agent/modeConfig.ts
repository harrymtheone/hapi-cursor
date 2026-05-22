import type { PermissionMode } from '@/cursor/modes';
import { UnknownPermissionModeError } from '@hapi/protocol/modes';

export type CursorArgsFragment = {
    mode?: 'plan' | 'ask';
    yolo?: boolean;
};

export function permissionModeToCursorArgs(
    mode: PermissionMode | undefined
): CursorArgsFragment {
    if (mode === undefined || mode === 'default') return {};
    if (mode === 'plan') return { mode: 'plan' };
    if (mode === 'ask') return { mode: 'ask' };
    if (mode === 'yolo') return { yolo: true };
    throw new UnknownPermissionModeError(mode);
}
