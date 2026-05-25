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
            <div className="py-1">
                <div className="flex items-center justify-between px-2.5 pb-1">
                    <button
                        type="button"
                        className="text-[10px] text-[var(--app-link)]"
                        onClick={() => setPanel('primary')}
                    >
                        {props.t('composer.modelPicker.back')}
                    </button>
                    <span className="truncate text-[10px] font-medium text-[var(--app-hint)]">
                        {editingFamily.displayName}
                    </span>
                </div>
                <div className="space-y-1 px-2.5">
                    <label className="flex items-center gap-2 text-xs">
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
                    <label className="flex items-center gap-2 text-xs">
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
                    <label className="flex items-center gap-2 text-xs">
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
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-[var(--app-hint)]">
                                {props.t('composer.modelPicker.option.effort')}
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {enabledEfforts.map((effort) => (
                                    <button
                                        key={effort}
                                        type="button"
                                        disabled={props.controlsDisabled}
                                        className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
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
                <div className="px-2.5 pt-1">
                    <button
                        type="button"
                        disabled={!canApplyOptions || props.controlsDisabled}
                        className="w-full rounded-md bg-[var(--app-link)] px-2 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                        onClick={applyOptions}
                    >
                        {props.t('composer.modelPicker.apply')}
                    </button>
                </div>
            </div>
        )
    }

    const autoSelected = props.currentModelId === null

    return (
        <div className="py-1">
            <button
                type="button"
                disabled={props.controlsDisabled}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--app-secondary-bg)] disabled:opacity-50"
                onClick={() => props.onModelChange(null)}
            >
                <span className="w-3.5 shrink-0 text-[var(--app-link)]">{autoSelected ? '✓' : ''}</span>
                <span className="flex-1">{props.t('composer.modelPicker.auto')}</span>
            </button>
            {props.families.map((family) => {
                const decomposed = props.currentModelId
                    ? decomposeModelId(props.currentModelId, props.families)
                    : null
                const isSelected = decomposed?.familyKey === family.key
                return (
                    <div
                        key={family.key}
                        className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[var(--app-secondary-bg)]"
                    >
                        <button
                            type="button"
                            disabled={props.controlsDisabled}
                            className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5 text-left text-xs disabled:opacity-50"
                            onClick={() => selectFamilyDefault(family)}
                        >
                            <span className="w-3.5 shrink-0 text-[var(--app-link)]">{isSelected ? '✓' : ''}</span>
                            <span className="truncate text-[var(--app-fg)]">{family.displayName}</span>
                        </button>
                        <button
                            type="button"
                            disabled={props.controlsDisabled}
                            className="shrink-0 px-1 py-0.5 text-[10px] text-[var(--app-link)] disabled:opacity-50"
                            onClick={() => openOptions(family)}
                        >
                            {props.t('composer.modelPicker.edit')}
                        </button>
                    </div>
                )
            })}
            <div className="mx-2.5 mt-1 border-t border-[var(--app-divider)] pt-1">
                <button
                    type="button"
                    className="w-full py-0.5 text-left text-[10px] text-[var(--app-link)]"
                    onClick={() => navigate({ to: '/settings/models' })}
                >
                    {props.t('composer.modelPicker.manageVisible')}
                </button>
            </div>
        </div>
    )
}
