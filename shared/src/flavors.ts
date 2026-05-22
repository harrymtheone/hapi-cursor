import {
    CURSOR_PERMISSION_MODES,
    type AgentFlavor,
    type PermissionMode,
} from './modes'

// --- Capability constants (prevent literal scattering) ---
export const Capabilities = {
    ModelChange: 'model-change',
    Effort: 'effort',
} as const

export type Capability = typeof Capabilities[keyof typeof Capabilities]

// --- Per-flavor capability object (D-72/D-73) ---
// 7 value-bearing slots; readonly to make the table truly the single source of truth.
export type FlavorCapabilities = {
    readonly permissionModes: readonly PermissionMode[]
    readonly supportsModelChange: boolean
    readonly supportsEffort: boolean
    readonly contextBudgetTokens: number | null
    readonly userSlashCommandsDir: ((homedir: string) => string | null) | null
    readonly projectSlashCommandsDir: ((projectDir: string) => string | null) | null
    readonly permissionToneCopy: 'cursor' | 'codex'
}

// --- Per-flavor capability table (Slice 1b: AgentFlavor narrowed to 'cursor',
// so only the cursor row remains; placeholder rows from Slice 1a deleted) ---
export const FLAVOR_CAPS: Record<AgentFlavor, FlavorCapabilities> = {
    cursor: {
        permissionModes: CURSOR_PERMISSION_MODES,
        supportsModelChange: false,
        supportsEffort: false,
        contextBudgetTokens: null,
        userSlashCommandsDir: null,
        projectSlashCommandsDir: null,
        permissionToneCopy: 'cursor',
    },
}

// --- Flavor display names ---
const FLAVOR_LABELS: Record<AgentFlavor, string> = {
    cursor: 'Cursor',
}

// --- Query functions ---
export function isKnownFlavor(flavor: string | null | undefined): flavor is AgentFlavor {
    return typeof flavor === 'string' && Object.hasOwn(FLAVOR_CAPS, flavor)
}

/**
 * Return the full capability row for a flavor, or `null` for unknown / null / undefined input (D-76).
 * Never throws — flavor strings can originate from SQLite / SSE wire data.
 */
export function getCapabilities(flavor: string | null | undefined): FlavorCapabilities | null {
    if (!isKnownFlavor(flavor)) return null
    return FLAVOR_CAPS[flavor]
}

/**
 * Return a single capability slot for a flavor, or `null` for unknown flavor.
 *
 * NOTE: the `?? null` collapse is safe because every D-73 slot is either a
 * non-null value or already `null` — a slot whose value is `null` resolves to
 * `null`, which is the same as the unknown-flavor branch by design.
 */
export function getCapability<K extends keyof FlavorCapabilities>(
    flavor: string | null | undefined,
    key: K,
): FlavorCapabilities[K] | null {
    const caps = getCapabilities(flavor)
    if (caps === null) return null
    return caps[key]
}

export function hasCapability(flavor: string | null | undefined, cap: Capability): boolean {
    const caps = getCapabilities(flavor)
    if (caps === null) return false
    if (cap === Capabilities.ModelChange) return caps.supportsModelChange
    if (cap === Capabilities.Effort) return caps.supportsEffort
    return false
}

export function getFlavorLabel(flavor: string | null | undefined): string {
    if (!isKnownFlavor(flavor)) return 'Unknown'
    return FLAVOR_LABELS[flavor]
}

// --- Convenience functions ---
export function supportsModelChange(flavor: string | null | undefined): boolean {
    return hasCapability(flavor, Capabilities.ModelChange)
}

export function supportsEffort(flavor: string | null | undefined): boolean {
    return hasCapability(flavor, Capabilities.Effort)
}
