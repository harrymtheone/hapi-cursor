import type { RefObject } from 'react'
import { FloatingOverlay } from '@/components/ChatInput/FloatingOverlay'
import { Autocomplete } from '@/components/ChatInput/Autocomplete'
import type { ModelFamily } from '@/lib/cursorModelFamilies'
import type { PermissionMode } from '@/types/api'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { ModelPickerOverlay } from './ModelPickerOverlay'

export interface HappyComposerOverlaysProps {
    settingsOverlay: 'model' | 'permission' | null
    showPermissionSettings: boolean
    showModelSettings: boolean
    permissionMode: PermissionMode
    permissionModeOptions: Array<{ mode: PermissionMode; label: string }>
    model: string | null
    modelFamilies: ModelFamily[]
    suggestions: readonly Suggestion[]
    selectedIndex: number
    controlsDisabled: boolean
    onPermissionChange: (mode: PermissionMode) => void
    onModelChange: (model: string | null) => void
    onSuggestionSelect: (index: number) => void
    autocompleteOverlayRef?: RefObject<HTMLDivElement | null>
    autocompleteAnchorLeft?: number | null
    t: (key: string) => string
}

export function HappyComposerOverlays(props: HappyComposerOverlaysProps) {
    const {
        settingsOverlay,
        showPermissionSettings,
        showModelSettings,
        permissionMode,
        permissionModeOptions,
        model,
        modelFamilies,
        suggestions,
        selectedIndex,
        controlsDisabled,
        onPermissionChange,
        onModelChange,
        onSuggestionSelect,
        autocompleteOverlayRef,
        autocompleteAnchorLeft,
        t,
    } = props

    if (settingsOverlay === 'permission' && showPermissionSettings) {
        return (
            <div className="absolute bottom-[100%] left-0 mb-2 flex w-full justify-start">
                <FloatingOverlay maxHeight={200} className="w-[min(100%,240px)]">
                    <div className="py-1">
                        <div className="px-2.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-hint)]">
                            {t('misc.permissionMode')}
                        </div>
                        {permissionModeOptions.map((option) => (
                            <button
                                key={option.mode}
                                type="button"
                                disabled={controlsDisabled}
                                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors ${
                                    controlsDisabled
                                        ? 'cursor-not-allowed opacity-50'
                                        : 'cursor-pointer hover:bg-[var(--app-secondary-bg)]'
                                }`}
                                onClick={() => onPermissionChange(option.mode)}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <div
                                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${
                                        permissionMode === option.mode
                                            ? 'border-[var(--app-link)]'
                                            : 'border-[var(--app-hint)]'
                                    }`}
                                >
                                    {permissionMode === option.mode && (
                                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--app-link)]" />
                                    )}
                                </div>
                                <span className={permissionMode === option.mode ? 'text-[var(--app-link)]' : ''}>
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </FloatingOverlay>
            </div>
        )
    }

    if (settingsOverlay === 'model' && showModelSettings) {
        return (
            <div className="absolute bottom-[100%] right-0 mb-2 flex w-full justify-end">
                <FloatingOverlay maxHeight={280} className="w-[min(100%,260px)]">
                    <ModelPickerOverlay
                        families={modelFamilies}
                        currentModelId={model}
                        onModelChange={onModelChange}
                        controlsDisabled={controlsDisabled}
                        t={t}
                    />
                </FloatingOverlay>
            </div>
        )
    }

    if (suggestions.length > 0) {
        const anchored = typeof autocompleteAnchorLeft === 'number'
        const style = anchored
            ? { left: `${Math.max(0, autocompleteAnchorLeft)}px` }
            : undefined
        return (
            <div
                ref={autocompleteOverlayRef}
                className={
                    anchored
                        ? 'absolute bottom-[100%] mb-2 w-[min(220px,calc(100%-1rem))]'
                        : 'absolute bottom-[100%] mb-2 w-[min(220px,calc(100%-1rem))] left-0'
                }
                style={style}
            >
                <FloatingOverlay>
                    <Autocomplete
                        suggestions={suggestions}
                        selectedIndex={selectedIndex}
                        onSelect={onSuggestionSelect}
                    />
                </FloatingOverlay>
            </div>
        )
    }

    return null
}
