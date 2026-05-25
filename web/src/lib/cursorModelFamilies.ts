import type { CursorModelSummary } from '@hapi/protocol/types'

export type ModelEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type ModelOptionSelection = {
    effort?: ModelEffort
    thinking?: boolean
    fast?: boolean
    context1m?: boolean
}

export type VariantFlags = {
    thinking: boolean
    fast: boolean
    context1m: boolean
    effort?: ModelEffort
}

export type ModelFamily = {
    key: string
    displayName: string
    variants: CursorModelSummary[]
}

export type DecomposedModel = {
    familyKey: string
    displayName: string
    selection: ModelOptionSelection
    variantId: string
}

const EFFORT_VALUES: readonly ModelEffort[] = ['xhigh', 'max', 'medium', 'high', 'low']

const LABEL_STOP_WORDS = new Set([
    '1M',
    'Thinking',
    'Fast',
    'Low',
    'Medium',
    'High',
    'Extra',
    'Max',
])

function deriveFamilyKey(id: string): string {
    if (id === 'auto') {
        return 'auto'
    }
    if (id.startsWith('claude-opus-4-7')) {
        return 'claude-opus-4-7'
    }
    if (id.startsWith('claude-4.6-opus')) {
        return 'claude-4.6-opus'
    }
    if (id.startsWith('claude-4.6-sonnet')) {
        return 'claude-4.6-sonnet'
    }
    const codexMaxMatch = id.match(/^gpt-(\d+\.\d+)-codex-max/)
    if (codexMaxMatch) {
        return `gpt-${codexMaxMatch[1]}-codex-max`
    }
    const codexMatch = id.match(/^gpt-(\d+\.\d+)-codex/)
    if (codexMatch) {
        return `gpt-${codexMatch[1]}-codex`
    }
    const gptSizeMatch = id.match(/^gpt-(\d+\.\d+)-(mini|nano)(?:-|$)/)
    if (gptSizeMatch) {
        return `gpt-${gptSizeMatch[1]}-${gptSizeMatch[2]}`
    }
    const gptBaseMatch = id.match(/^gpt-(\d+\.\d+)(?:-|$)/)
    if (gptBaseMatch) {
        return `gpt-${gptBaseMatch[1]}`
    }
    const composerMatch = id.match(/^composer-2(?:\.(\d+))?(?:-|$)/)
    if (composerMatch) {
        const minor = composerMatch[1]
        return minor ? `composer-2.${minor}` : 'composer-2'
    }
    const parts = id.split('-')
    return parts.slice(0, Math.min(3, parts.length)).join('-')
}

function formatFamilyKeyAsDisplay(familyKey: string): string {
    return familyKey
        .split('-')
        .map((part) => (part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part))
        .join(' ')
}

function deriveDisplayNameFromLabel(label: string | undefined, familyKey: string): string {
    if (!label) {
        return formatFamilyKeyAsDisplay(familyKey)
    }
    const tokens: string[] = []
    for (const token of label.split(/\s+/)) {
        if (token === '1M' || LABEL_STOP_WORDS.has(token)) {
            break
        }
        tokens.push(token)
    }
    if (tokens.length === 0) {
        return formatFamilyKeyAsDisplay(familyKey)
    }
    return tokens.join(' ')
}

function extractEffortFromId(id: string): ModelEffort | undefined {
    const segments = id.split('-')
    for (const effort of EFFORT_VALUES) {
        if (segments.includes(effort)) {
            return effort
        }
    }
    return undefined
}

function extractEffortFromLabel(label: string): ModelEffort | undefined {
    if (/\bExtra High\b/i.test(label) || /\bxhigh\b/i.test(label)) {
        return 'xhigh'
    }
    if (/\bMax\b/.test(label)) {
        return 'max'
    }
    if (/\bMedium\b/.test(label)) {
        return 'medium'
    }
    if (/\bHigh\b/.test(label)) {
        return 'high'
    }
    if (/\bLow\b/.test(label)) {
        return 'low'
    }
    return undefined
}

export function parseVariantFlags(id: string, label?: string): VariantFlags {
    const lbl = label ?? ''
    return {
        thinking: id.includes('-thinking') || /\bThinking\b/.test(lbl),
        fast: id.endsWith('-fast') || /\bFast\b/.test(lbl),
        context1m: /\b1M\b/.test(lbl) || id.includes('[1m]'),
        effort: extractEffortFromId(id) ?? extractEffortFromLabel(lbl),
    }
}

/** How a binary model option (thinking / 1M context) should appear in the picker. */
export type BinaryOptionAvailability = 'hidden' | 'locked-on' | 'toggleable'

export function getBinaryOptionAvailability(
    family: ModelFamily,
    flag: 'thinking' | 'context1m'
): BinaryOptionAvailability {
    let hasOn = false
    let hasOff = false
    for (const variant of family.variants) {
        const flags = parseVariantFlags(variant.id, variant.label)
        const on = flag === 'thinking' ? flags.thinking : flags.context1m
        if (on) {
            hasOn = true
        } else {
            hasOff = true
        }
    }
    if (!hasOn) {
        return 'hidden'
    }
    if (!hasOff) {
        return 'locked-on'
    }
    return 'toggleable'
}

/** Apply locked-on flags so composeVariantId matches discovery-only variants. */
export function normalizeOptionSelection(
    family: ModelFamily,
    selection: ModelOptionSelection
): ModelOptionSelection {
    const normalized = { ...selection }
    if (getBinaryOptionAvailability(family, 'thinking') === 'locked-on') {
        normalized.thinking = true
    }
    if (getBinaryOptionAvailability(family, 'context1m') === 'locked-on') {
        normalized.context1m = true
    }
    return normalized
}

function modifierScore(flags: VariantFlags): number {
    let score = 0
    if (flags.thinking) score += 1
    if (flags.fast) score += 1
    if (flags.context1m) score += 1
    if (flags.effort) score += 1
    return score
}

function variantMatchesSelection(flags: VariantFlags, selection: ModelOptionSelection): boolean {
    if (selection.thinking === true && !flags.thinking) {
        return false
    }
    if (selection.thinking === false && flags.thinking) {
        return false
    }
    if (selection.fast === true && !flags.fast) {
        return false
    }
    if (selection.fast === false && flags.fast) {
        return false
    }
    if (selection.context1m === true && !flags.context1m) {
        return false
    }
    if (selection.context1m === false && flags.context1m) {
        return false
    }
    if (selection.effort !== undefined && flags.effort !== selection.effort) {
        return false
    }
    return true
}

function flagsToSelection(flags: VariantFlags): ModelOptionSelection {
    const selection: ModelOptionSelection = {}
    if (flags.thinking) {
        selection.thinking = true
    }
    if (flags.fast) {
        selection.fast = true
    }
    if (flags.context1m) {
        selection.context1m = true
    }
    if (flags.effort) {
        selection.effort = flags.effort
    }
    return selection
}

export function groupModelsIntoFamilies(models: CursorModelSummary[]): ModelFamily[] {
    const byKey = new Map<string, CursorModelSummary[]>()

    for (const model of models) {
        if (model.id === 'auto') {
            continue
        }
        const key = deriveFamilyKey(model.id)
        const bucket = byKey.get(key) ?? []
        bucket.push(model)
        byKey.set(key, bucket)
    }

    const families: ModelFamily[] = []
    for (const [key, variants] of byKey) {
        const sortedVariants = [...variants].sort((a, b) => a.id.localeCompare(b.id))
        const labelSource = sortedVariants.find((v) => v.label)?.label
        families.push({
            key,
            displayName: deriveDisplayNameFromLabel(labelSource, key),
            variants: sortedVariants,
        })
    }

    return families.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function composeVariantId(
    family: ModelFamily,
    selection: ModelOptionSelection
): string | null {
    const candidates = family.variants
        .map((variant) => ({
            variant,
            flags: parseVariantFlags(variant.id, variant.label),
        }))
        .filter(({ flags }) => variantMatchesSelection(flags, selection))

    if (candidates.length === 0) {
        return null
    }

    const hasExplicitSelection =
        selection.effort !== undefined ||
        selection.thinking !== undefined ||
        selection.fast !== undefined ||
        selection.context1m !== undefined

    if (!hasExplicitSelection) {
        candidates.sort((a, b) => {
            const scoreDiff = modifierScore(a.flags) - modifierScore(b.flags)
            if (scoreDiff !== 0) {
                return scoreDiff
            }
            return a.variant.id.localeCompare(b.variant.id)
        })
    } else {
        candidates.sort((a, b) => a.variant.id.localeCompare(b.variant.id))
    }

    return candidates[0]!.variant.id
}

export function decomposeModelId(
    id: string,
    families: ModelFamily[]
): DecomposedModel | null {
    const family = families.find((f) => f.variants.some((v) => v.id === id))
    if (!family) {
        return null
    }
    const variant = family.variants.find((v) => v.id === id)
    if (!variant) {
        return null
    }
    const flags = parseVariantFlags(variant.id, variant.label)
    return {
        familyKey: family.key,
        displayName: family.displayName,
        selection: flagsToSelection(flags),
        variantId: id,
    }
}

export type FamilySummaryTranslator = (key: string, fallback: string) => string

const EFFORT_LABEL_KEYS: Record<ModelEffort, string> = {
    low: 'composer.modelPicker.effort.low',
    medium: 'composer.modelPicker.effort.medium',
    high: 'composer.modelPicker.effort.high',
    xhigh: 'composer.modelPicker.effort.xhigh',
    max: 'composer.modelPicker.effort.max',
}

const EFFORT_FALLBACKS: Record<ModelEffort, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra High',
    max: 'Max',
}

export function formatFamilySummary(
    decomposed: DecomposedModel,
    t?: FamilySummaryTranslator
): string {
    const translate = t ?? ((_key, fallback) => fallback)
    const parts: string[] = [decomposed.displayName]
    const { selection } = decomposed

    if (selection.context1m) {
        parts.push('1M')
    }
    if (selection.effort) {
        const key = EFFORT_LABEL_KEYS[selection.effort]
        parts.push(translate(key, EFFORT_FALLBACKS[selection.effort]))
    }
    if (selection.thinking) {
        parts.push(translate('composer.modelPicker.option.thinking', 'Thinking'))
    }
    if (selection.fast) {
        parts.push(translate('composer.modelPicker.option.fast', 'Fast'))
    }

    if (parts.length === 1) {
        return parts[0]!
    }
    return parts.join(' · ')
}
