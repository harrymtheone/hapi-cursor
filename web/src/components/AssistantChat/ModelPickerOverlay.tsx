import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
    composeVariantId,
    decomposeModelId,
    type ModelFamily,
    type ModelOptionSelection,
} from '@/lib/cursorModelFamilies'

type PickerPanel = 'primary' | 'options'

function emptySelection(): ModelOptionSelection {
    return {}
}

function variantSupportsOption(
    family: ModelFamily,
    option: keyof ModelOptionSelection,
    value: boolean | ModelOptionSelection['effort']
): boolean {
    const probe: ModelOptionSelection = { [option]: value } as ModelOptionSelection
    return composeVariantId(family, probe) !== null
}

export function ModelPickerOverlay(props: {
    families: ModelFamily[]
    currentModelId: string | null
    onModelChange: (model: string | null) => void
    controlsDisabled: boolean
    t: (key: string, params?: Record<string, string | number>) => string
}) {
    const navigate = useNavigate()
    const [panel, setPanel] = useState<PickerPanel>('primary')
    const [editingFamilyKey, setEditingFamilyKey] = useState<string | null>(null)
    const [optionSelection, setOptionSelection] = useState<ModelOptionSelection>(emptySelection)

    const editingFamily = useMemo(
        () => props.families.find((family) => family.key === editingFamilyKey) ?? null,
        [editingFamilyKey, props.families]
    )

    const openOptions = useCallback((family: ModelFamily) => {
        const decomposed = props.currentModelId
            ? decomposeModelId(props.currentModelId, props.families)
            : null
        const initial =
            decomposed?.familyKey === family.key ? decomposed.selection : emptySelection()
        setEditingFamilyKey(family.key)
        setOptionSelection(initial)
        setPanel('options')
    }, [props.currentModelId, props.families])

    const selectFamilyDefault = useCallback(
        (family: ModelFamily) => {
            const composed = composeVariantId(family, {})
            if (composed) {
                props.onModelChange(composed)
            }
        },
        [props]
    )

    const applyOptions = useCallback(() => {
        if (!editingFamily) {
            return
        }
        const composed = composeVariantId(editingFamily, optionSelection)
        if (composed) {
            props.onModelChange(composed)
        }
    }, [editingFamily, optionSelection, props])

    const thinkingEnabled = editingFamily
        ? variantSupportsOption(editingFamily, 'thinking', true)
        : false
    const fastEnabled = editingFamily
        ? variantSupportsOption(editingFamily, 'fast', true)
        : false
    const contextEnabled = editingFamily
        ? variantSupportsOption(editingFamily, 'context1m', true)
        : false
    const effortLevels: Array<NonNullable<ModelOptionSelection['effort']>> = [
        'low',
        'medium',
        'high',
        'xhigh',
        'max',
    ]
    const enabledEfforts = editingFamily
        ? effortLevels.filter((effort) => variantSupportsOption(editingFamily, 'effort', effort))
        : []
    const canApplyOptions = editingFamily
        ? composeVariantId(editingFamily, optionSelection) !== null
        : false

    if (panel === 'options' && editingFamily) {
        return (
            <div className="py-2">
                <div className="flex items-center justify-between px-3 pb-2">
                    <button
                        type="button"
                        className="text-xs text-[var(--app-link)]"
                        onClick={() => setPanel('primary')}
                    >
                        {props.t('composer.modelPicker.back')}
                    </button>
                    <span className="text-xs font-semibold text-[var(--app-hint)]">
                        {editingFamily.displayName}
                    </span>
                </div>
                <div className="space-y-2 px-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            disabled={!thinkingEnabled || props.controlsDisabled}
                            checked={optionSelection.thinking === true}
                            onChange={(event) =>
                                setOptionSelection((current) => ({
                                    ...current,
                                    thinking: event.target.checked ? true : undefined,
                                }))
                            }
                        />
                        <span>{props.t('composer.modelPicker.option.thinking')}</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            disabled={!fastEnabled || props.controlsDisabled}
                            checked={optionSelection.fast === true}
                            onChange={(event) =>
                                setOptionSelection((current) => ({
                                    ...current,
                                    fast: event.target.checked ? true : undefined,
                                }))
                            }
                        />
                        <span>{props.t('composer.modelPicker.option.fast')}</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            disabled={!contextEnabled || props.controlsDisabled}
                            checked={optionSelection.context1m === true}
                            onChange={(event) =>
                                setOptionSelection((current) => ({
                                    ...current,
                                    context1m: event.target.checked ? true : undefined,
                                }))
                            }
                        />
                        <span>{props.t('composer.modelPicker.option.context')}</span>
                    </label>
                    {enabledEfforts.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-[var(--app-hint)]">
                                {props.t('composer.modelPicker.option.effort')}
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {enabledEfforts.map((effort) => (
                                    <button
                                        key={effort}
                                        type="button"
                                        disabled={props.controlsDisabled}
                                        className={`rounded-full border px-2 py-1 text-xs ${
                                            optionSelection.effort === effort
                                                ? 'border-[var(--app-link)] text-[var(--app-link)]'
                                                : 'border-[var(--app-border)]'
                                        }`}
                                        onClick={() =>
                                            setOptionSelection((current) => ({
                                                ...current,
                                                effort: current.effort === effort ? undefined : effort,
                                            }))
                                        }
                                    >
                                        {props.t(`composer.modelPicker.effort.${effort}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
                <div className="px-3 pt-2">
                    <button
                        type="button"
                        disabled={!canApplyOptions || props.controlsDisabled}
                        className="w-full rounded-lg bg-[var(--app-link)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                        onClick={applyOptions}
                    >
                        {props.t('composer.modelPicker.apply')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="py-2">
            <div className="px-3 pb-1 text-xs font-semibold text-[var(--app-hint)]">
                {props.t('misc.model')}
            </div>
            <button
                type="button"
                disabled={props.controlsDisabled}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--app-secondary-bg)] disabled:opacity-50"
                onClick={() => props.onModelChange(null)}
            >
                <span>{props.t('composer.modelPicker.auto')}</span>
                {props.currentModelId === null ? (
                    <span className="text-[var(--app-link)]">✓</span>
                ) : null}
            </button>
            {props.families.map((family) => {
                const decomposed = props.currentModelId
                    ? decomposeModelId(props.currentModelId, props.families)
                    : null
                const isSelected = decomposed?.familyKey === family.key
                return (
                    <div
                        key={family.key}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                        <span className="text-sm text-[var(--app-fg)]">{family.displayName}</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={props.controlsDisabled}
                                className="text-xs text-[var(--app-link)] disabled:opacity-50"
                                onClick={() => openOptions(family)}
                            >
                                {props.t('composer.modelPicker.edit')}
                            </button>
                            <button
                                type="button"
                                disabled={props.controlsDisabled}
                                className="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs disabled:opacity-50"
                                onClick={() => selectFamilyDefault(family)}
                            >
                                {props.t('composer.modelPicker.select')}
                                {isSelected ? ' ✓' : ''}
                            </button>
                        </div>
                    </div>
                )
            })}
            <div className="mx-3 mt-2 border-t border-[var(--app-divider)] pt-2">
                <button
                    type="button"
                    className="w-full text-left text-xs text-[var(--app-link)]"
                    onClick={() => navigate({ to: '/settings/models' })}
                >
                    {props.t('composer.modelPicker.manageVisible')}
                </button>
            </div>
        </div>
    )
}
