/** wire-tag for cursor agent message envelope */
export const AGENT_MESSAGE_PAYLOAD_TYPE = 'cursor' as const

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

export class UnknownPermissionModeError extends Error {
    readonly offendingMode: string

    constructor(offendingMode: string) {
        super(`Unknown permission mode: ${offendingMode}`)
        this.name = 'UnknownPermissionModeError'
        this.offendingMode = offendingMode
    }
}
