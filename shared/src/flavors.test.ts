import { describe, expect, test } from 'bun:test'
import {
    Capabilities,
    getCapabilities,
    getCapability,
    getFlavorLabel,
    hasCapability,
    isKnownFlavor,
    supportsEffort,
    supportsModelChange,
} from './flavors'

describe('flavor capability table', () => {
    // Case 1
    test('getCapabilities(cursor) returns an object with all 7 D-73 slots populated', () => {
        const caps = getCapabilities('cursor')
        expect(caps).not.toBeNull()
        expect(caps).toHaveProperty('permissionModes')
        expect(caps).toHaveProperty('supportsModelChange')
        expect(caps).toHaveProperty('supportsEffort')
        expect(caps).toHaveProperty('contextBudgetTokens')
        expect(caps).toHaveProperty('userSlashCommandsDir')
        expect(caps).toHaveProperty('projectSlashCommandsDir')
        expect(caps).toHaveProperty('permissionToneCopy')
    })

    // Case 2
    test('getCapabilities(cursor).permissionModes deep-equals [default, plan, ask, yolo]', () => {
        expect(getCapabilities('cursor')!.permissionModes).toEqual(['default', 'plan', 'ask', 'yolo'])
    })

    // Case 3
    test('getCapabilities(cursor).supportsModelChange === false', () => {
        expect(getCapabilities('cursor')!.supportsModelChange).toBe(false)
    })

    // Case 4
    test('getCapabilities(cursor).supportsEffort === false', () => {
        expect(getCapabilities('cursor')!.supportsEffort).toBe(false)
    })

    // Case 5
    test('getCapabilities(cursor).contextBudgetTokens === null', () => {
        expect(getCapabilities('cursor')!.contextBudgetTokens).toBeNull()
    })

    // Case 6
    test('getCapabilities(cursor).userSlashCommandsDir === null', () => {
        expect(getCapabilities('cursor')!.userSlashCommandsDir).toBeNull()
    })

    // Case 7
    test('getCapabilities(cursor).projectSlashCommandsDir === null', () => {
        expect(getCapabilities('cursor')!.projectSlashCommandsDir).toBeNull()
    })

    // Case 8
    test("getCapabilities(cursor).permissionToneCopy === 'cursor'", () => {
        expect(getCapabilities('cursor')!.permissionToneCopy).toBe('cursor')
    })

    // Case 9
    test('getCapabilities(unknown) === null', () => {
        expect(getCapabilities('unknown')).toBeNull()
    })

    // Case 10
    test('getCapabilities(null) === null AND getCapabilities(undefined) === null', () => {
        expect(getCapabilities(null)).toBeNull()
        expect(getCapabilities(undefined)).toBeNull()
    })

    // Case 11
    test("getCapability(cursor, 'permissionModes') returns the array", () => {
        expect(getCapability('cursor', 'permissionModes')).toEqual(['default', 'plan', 'ask', 'yolo'])
    })

    // Case 12
    test("getCapability(unknown, 'permissionModes') === null", () => {
        expect(getCapability('unknown', 'permissionModes')).toBeNull()
    })

    // Case 12b (WR-03 regression): permissionToneCopy is a deferred
    // forward-extensibility slot — pin its cursor inhabitant so accidental
    // deletion or re-typing is caught.
    test("getCapability('cursor', 'permissionToneCopy') === 'cursor'", () => {
        expect(getCapability('cursor', 'permissionToneCopy')).toBe('cursor')
    })

    // Case 13
    test("getFlavorLabel('cursor') === 'Cursor'", () => {
        expect(getFlavorLabel('cursor')).toBe('Cursor')
    })

    // Case 14
    test("getFlavorLabel('unknown-flavor') === 'Unknown'", () => {
        expect(getFlavorLabel('unknown-flavor')).toBe('Unknown')
    })

    // Case 15
    test("getFlavorLabel(null) === 'Unknown'", () => {
        expect(getFlavorLabel(null)).toBe('Unknown')
    })

    // Case 16
    test('isKnownFlavor(cursor) === true (also serves as TS narrow check)', () => {
        expect(isKnownFlavor('cursor')).toBe(true)
    })

    // Case 17
    test("isKnownFlavor('unknown-flavor') === false", () => {
        expect(isKnownFlavor('unknown-flavor')).toBe(false)
    })

    // Case 18
    test('isKnownFlavor(null) === false AND isKnownFlavor(undefined) === false', () => {
        expect(isKnownFlavor(null)).toBe(false)
        expect(isKnownFlavor(undefined)).toBe(false)
    })

    // Case 19
    test("hasCapability('cursor', 'model-change') === false", () => {
        expect(hasCapability('cursor', Capabilities.ModelChange)).toBe(false)
    })

    // Case 20
    test("hasCapability('cursor', 'effort') === false", () => {
        expect(hasCapability('cursor', Capabilities.Effort)).toBe(false)
    })

    // Case 21
    test("hasCapability(null, 'model-change') === false", () => {
        expect(hasCapability(null, Capabilities.ModelChange)).toBe(false)
    })

    // Case 22
    test('supportsModelChange(cursor) === false; supportsModelChange(null) === false', () => {
        expect(supportsModelChange('cursor')).toBe(false)
        expect(supportsModelChange(null)).toBe(false)
    })

    // Case 23
    test('supportsEffort(cursor) === false', () => {
        expect(supportsEffort('cursor')).toBe(false)
    })
})
