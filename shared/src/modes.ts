/**
 * @description The legacy payload type identifier used for all generic agent messages.
 * Changing this value will affect the communication schema between CLI, Hub, and Web.
 * A migration plan is required if this literal is ever modified.
 *
 * NOTE: wire-protocol legacy literal — owned by Phase 7; do not change.
 * The Phase 5 source guard's post-filter pins on this anchor line (D-81).
 */
export const AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const

export const CURSOR_PERMISSION_MODES = ['default', 'plan', 'ask', 'yolo'] as const
export type CursorPermissionMode = typeof CURSOR_PERMISSION_MODES[number]

export const PERMISSION_MODES = CURSOR_PERMISSION_MODES
export type PermissionMode = CursorPermissionMode

export type AgentFlavor = 'cursor'

export const PERMISSION_MODE_LABELS: Record<PermissionMode, string> = {
    default: 'Default',
    plan: 'Plan Mode',
    ask: 'Ask Mode',
    yolo: 'Yolo'
}

export type PermissionModeTone = 'neutral' | 'info' | 'warning' | 'danger'

export const PERMISSION_MODE_TONES: Record<PermissionMode, PermissionModeTone> = {
    default: 'neutral',
    plan: 'info',
    ask: 'info',
    yolo: 'danger'
}

export type PermissionModeOption = {
    mode: PermissionMode
    label: string
    tone: PermissionModeTone
}

export function getPermissionModeLabel(mode: PermissionMode): string {
    return PERMISSION_MODE_LABELS[mode]
}

export function getPermissionModeTone(mode: PermissionMode): PermissionModeTone {
    return PERMISSION_MODE_TONES[mode]
}

export function getPermissionModesForFlavor(_flavor?: string | null): readonly PermissionMode[] {
    return CURSOR_PERMISSION_MODES
}

export function getPermissionModeOptionsForFlavor(flavor?: string | null): PermissionModeOption[] {
    return getPermissionModesForFlavor(flavor).map((mode) => ({
        mode,
        label: getPermissionModeLabel(mode),
        tone: getPermissionModeTone(mode)
    }))
}

export function isPermissionModeAllowedForFlavor(mode: PermissionMode, _flavor?: string | null): boolean {
    return (CURSOR_PERMISSION_MODES as readonly PermissionMode[]).includes(mode)
}
