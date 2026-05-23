import { FloatingOverlay } from '@/components/ChatInput/FloatingOverlay'
import { Autocomplete } from '@/components/ChatInput/Autocomplete'
import type { PermissionMode } from '@/types/api'
import type { Suggestion } from '@/hooks/useActiveSuggestions'

export interface HappyComposerOverlaysProps {
    showSettings: boolean
    showPermissionSettings: boolean
    showModelSettings: boolean
    permissionMode: PermissionMode
    permissionModeOptions: Array<{ mode: PermissionMode; label: string }>
    model: string | null
    modelOptions: Array<{ value: string | null; label: string }>
    suggestions: readonly Suggestion[]
    selectedIndex: number
    controlsDisabled: boolean
    onPermissionChange: (mode: PermissionMode) => void
    onModelChange: (model: string | null) => void
    onSuggestionSelect: (index: number) => void
    t: (key: string) => string
}

export function HappyComposerOverlays(props: HappyComposerOverlaysProps) {
    const {
        showSettings,
        showPermissionSettings,
        showModelSettings,
        permissionMode,
        permissionModeOptions,
        model,
        modelOptions,
        suggestions,
        selectedIndex,
        controlsDisabled,
        onPermissionChange,
        onModelChange,
        onSuggestionSelect,
        t,
    } = props

    if (showSettings && (showPermissionSettings || showModelSettings)) {
        return (
            <div className="absolute bottom-[100%] mb-2 w-full">
                <FloatingOverlay maxHeight={320}>
                    {showPermissionSettings ? (
                        <div className="py-2">
                            <div className="px-3 pb-1 text-xs font-semibold text-[var(--app-hint)]">
                                {t('misc.permissionMode')}
                            </div>
                            {permissionModeOptions.map((option) => (
                                <button
                                    key={option.mode}
                                    type="button"
                                    disabled={controlsDisabled}
                                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                        controlsDisabled
                                            ? 'cursor-not-allowed opacity-50'
                                            : 'cursor-pointer hover:bg-[var(--app-secondary-bg)]'
                                    }`}
                                    onClick={() => onPermissionChange(option.mode)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <div
                                        className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                            permissionMode === option.mode
                                                ? 'border-[var(--app-link)]'
                                                : 'border-[var(--app-hint)]'
                                        }`}
                                    >
                                        {permissionMode === option.mode && (
                                            <div className="h-2 w-2 rounded-full bg-[var(--app-link)]" />
                                        )}
                                    </div>
                                    <span className={permissionMode === option.mode ? 'text-[var(--app-link)]' : ''}>
                                        {option.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : null}

                    {showPermissionSettings && showModelSettings ? (
                        <div className="mx-3 h-px bg-[var(--app-divider)]" />
                    ) : null}

                    {showModelSettings ? (
                        <div className="py-2">
                            <div className="px-3 pb-1 text-xs font-semibold text-[var(--app-hint)]">
                                {t('misc.model')}
                            </div>
                            {modelOptions.map((option) => (
                                <button
                                    key={option.value ?? 'auto'}
                                    type="button"
                                    disabled={controlsDisabled}
                                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                        controlsDisabled
                                            ? 'cursor-not-allowed opacity-50'
                                            : 'cursor-pointer hover:bg-[var(--app-secondary-bg)]'
                                    }`}
                                    onClick={() => onModelChange(option.value)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <div
                                        className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                            model === option.value
                                                ? 'border-[var(--app-link)]'
                                                : 'border-[var(--app-hint)]'
                                        }`}
                                    >
                                        {model === option.value && (
                                            <div className="h-2 w-2 rounded-full bg-[var(--app-link)]" />
                                        )}
                                    </div>
                                    <span className={model === option.value ? 'text-[var(--app-link)]' : ''}>
                                        {option.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                </FloatingOverlay>
            </div>
        )
    }

    if (suggestions.length > 0) {
        return (
            <div className="absolute bottom-[100%] mb-2 w-full">
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
