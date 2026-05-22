/**
 * LEAF MODULE — mode types for the cursor agent runtime.
 *
 * This file MUST NOT import from `./loop`, `./session`,
 * `./cursorLocalLauncher`, `./cursorRemoteLauncher`, or `./cursorLocal`.
 * Adding any such import regenerates the Phase 6 `session ↔ loop ↔ launcher`
 * cycle (see .planning/phases/06-agent-runtime-shared-kit-mode-hardening,
 * decisions D-94 / D-95 / D-96).
 */
import type { CursorPermissionMode } from '@hapi/protocol/types';

export type PermissionMode = CursorPermissionMode;

export interface EnhancedMode {
    permissionMode: PermissionMode;
    model?: string;
}
