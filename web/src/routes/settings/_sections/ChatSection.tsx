import { useTranslation } from '@/lib/use-translation'
import { getComposerEnterBehaviorOptions, useComposerEnterBehavior, type ComposerEnterBehavior } from '@/hooks/useComposerEnterBehavior'
import { getTerminalToolDisplayModeOptions, useTerminalToolDisplayMode, type TerminalToolDisplayMode } from '@/hooks/useTerminalToolDisplayMode'
import {
    getChatSurfaceColorPickerValue,
    getChatSurfaceColorPresetOptions,
    toCustomChatSurfaceColorPreference,
    toPresetChatSurfaceColorPreference,
    useChatSurfaceColors,
    type ChatSurfaceColorPreference,
    type ChatSurfaceColorPreset,
} from '@/hooks/useChatSurfaceColors'
import type { DropdownSlot } from '@/routes/settings/useSettingsState'
import { CheckIcon, ChevronDownIcon } from './_icons'

interface ChatSurfaceColorControlProps {
    label: string
    preference: ChatSurfaceColorPreference
    onPresetChange: (preset: ChatSurfaceColorPreset) => void
    onCustomChange: (value: string) => void
    t: (key: string) => string
}

function ChatSurfaceColorControl(props: ChatSurfaceColorControlProps) {
    const presetOptions = getChatSurfaceColorPresetOptions()
    const pickerValue = getChatSurfaceColorPickerValue(props.preference)
    const isCustomSelected = props.preference.startsWith('custom:')

    return (
        <div className="border-t border-[var(--app-divider)] px-3 py-3">
            <div className="mb-2 text-[var(--app-fg)]">{props.label}</div>
            <div className="flex flex-wrap gap-2">
                {presetOptions.map((option) => {
                    const selected = props.preference === toPresetChatSurfaceColorPreference(option.value)
                    const swatchColor = getChatSurfaceColorPickerValue(toPresetChatSurfaceColorPreference(option.value))
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => props.onPresetChange(option.value)}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                selected
                                    ? 'border-[var(--app-link)] bg-[var(--app-subtle-bg)] text-[var(--app-link)]'
                                    : 'border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
                            }`}
                        >
                            <span className="h-2.5 w-2.5 rounded-full opacity-80" style={{ backgroundColor: swatchColor }} />
                            <span>{props.t(option.labelKey)}</span>
                        </button>
                    )
                })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--app-hint)]">{props.t('settings.chat.surfaceColor.custom')}</span>
                <label
                    className={`inline-flex items-center rounded-xl border px-2 py-1 transition-colors ${
                        isCustomSelected
                            ? 'border-[var(--app-link)] bg-[var(--app-subtle-bg)]'
                            : 'border-[var(--app-border)] bg-[var(--app-bg)]'
                    }`}
                >
                    <input
                        aria-label={props.t('settings.chat.surfaceColor.custom')}
                        type="color"
                        value={pickerValue}
                        onChange={(event) => props.onCustomChange(event.target.value)}
                        className="h-8 w-11 cursor-pointer appearance-none border-0 bg-transparent p-0"
                    />
                </label>
            </div>
        </div>
    )
}

export interface ChatSectionProps {
    composerEnterDropdown: DropdownSlot
    terminalToolDisplayDropdown: DropdownSlot
}

export function ChatSection(props: ChatSectionProps) {
    const { t } = useTranslation()
    const { composerEnterBehavior, setComposerEnterBehavior } = useComposerEnterBehavior()
    const { terminalToolDisplayMode, setTerminalToolDisplayMode } = useTerminalToolDisplayMode()
    const {
        toolGroupBackground,
        userMessageBackground,
        setToolGroupBackground,
        setUserMessageBackground,
    } = useChatSurfaceColors()

    const composerEnterBehaviorOptions = getComposerEnterBehaviorOptions()
    const terminalToolDisplayModeOptions = getTerminalToolDisplayModeOptions()
    const currentComposerEnterBehaviorLabel = composerEnterBehaviorOptions.find((opt) => opt.value === composerEnterBehavior)?.labelKey ?? 'settings.chat.enterBehavior.send'
    const currentTerminalToolDisplayModeLabel = terminalToolDisplayModeOptions.find((opt) => opt.value === terminalToolDisplayMode)?.labelKey ?? 'settings.chat.terminalToolDisplay.compact'

    const { composerEnterDropdown, terminalToolDisplayDropdown } = props

    const handleComposerEnterBehaviorChange = (newBehavior: ComposerEnterBehavior) => {
        setComposerEnterBehavior(newBehavior)
        composerEnterDropdown.setIsOpen(false)
    }

    const handleTerminalToolDisplayModeChange = (newMode: TerminalToolDisplayMode) => {
        setTerminalToolDisplayMode(newMode)
        terminalToolDisplayDropdown.setIsOpen(false)
    }

    return (
        <div className="border-b border-[var(--app-divider)]">
            <div className="px-3 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide">
                {t('settings.chat.title')}
            </div>
            <div ref={composerEnterDropdown.containerRef} className="relative">
                <button
                    type="button"
                    onClick={() => composerEnterDropdown.setIsOpen(!composerEnterDropdown.isOpen)}
                    className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[var(--app-subtle-bg)]"
                    aria-expanded={composerEnterDropdown.isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="text-[var(--app-fg)]">{t('settings.chat.enterBehavior')}</span>
                    <span className="flex items-center gap-1 text-[var(--app-hint)]">
                        <span>{t(currentComposerEnterBehaviorLabel)}</span>
                        <ChevronDownIcon className={`transition-transform ${composerEnterDropdown.isOpen ? 'rotate-180' : ''}`} />
                    </span>
                </button>

                {composerEnterDropdown.isOpen && (
                    <div
                        className="absolute right-3 top-full mt-1 min-w-[170px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-lg overflow-hidden z-50"
                        role="listbox"
                        aria-label={t('settings.chat.enterBehavior')}
                    >
                        {composerEnterBehaviorOptions.map((opt) => {
                            const isSelected = composerEnterBehavior === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleComposerEnterBehaviorChange(opt.value)}
                                    className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                        isSelected
                                            ? 'text-[var(--app-link)] bg-[var(--app-subtle-bg)]'
                                            : 'text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
                                    }`}
                                >
                                    <span>{t(opt.labelKey)}</span>
                                    {isSelected && (
                                        <span className="ml-2 text-[var(--app-link)]">
                                            <CheckIcon />
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
            <div ref={terminalToolDisplayDropdown.containerRef} className="relative">
                <button
                    type="button"
                    onClick={() => terminalToolDisplayDropdown.setIsOpen(!terminalToolDisplayDropdown.isOpen)}
                    className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[var(--app-subtle-bg)]"
                    aria-expanded={terminalToolDisplayDropdown.isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="text-[var(--app-fg)]">{t('settings.chat.terminalToolDisplay')}</span>
                    <span className="flex items-center gap-1 text-[var(--app-hint)]">
                        <span>{t(currentTerminalToolDisplayModeLabel)}</span>
                        <ChevronDownIcon className={`transition-transform ${terminalToolDisplayDropdown.isOpen ? 'rotate-180' : ''}`} />
                    </span>
                </button>

                {terminalToolDisplayDropdown.isOpen && (
                    <div
                        className="absolute right-3 top-full mt-1 min-w-[230px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-lg overflow-hidden z-50"
                        role="listbox"
                        aria-label={t('settings.chat.terminalToolDisplay')}
                    >
                        {terminalToolDisplayModeOptions.map((opt) => {
                            const isSelected = terminalToolDisplayMode === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleTerminalToolDisplayModeChange(opt.value)}
                                    className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                        isSelected
                                            ? 'text-[var(--app-link)] bg-[var(--app-subtle-bg)]'
                                            : 'text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
                                    }`}
                                >
                                    <span>{t(opt.labelKey)}</span>
                                    {isSelected && (
                                        <span className="ml-2 text-[var(--app-link)]">
                                            <CheckIcon />
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
            <ChatSurfaceColorControl
                label={t('settings.chat.groupedToolBackground')}
                preference={toolGroupBackground}
                onPresetChange={(preset) => setToolGroupBackground(toPresetChatSurfaceColorPreference(preset))}
                onCustomChange={(value) => setToolGroupBackground(toCustomChatSurfaceColorPreference(value))}
                t={t}
            />
            <ChatSurfaceColorControl
                label={t('settings.chat.userMessageBackground')}
                preference={userMessageBackground}
                onPresetChange={(preset) => setUserMessageBackground(toPresetChatSurfaceColorPreference(preset))}
                onCustomChange={(value) => setUserMessageBackground(toCustomChatSurfaceColorPreference(value))}
                t={t}
            />
        </div>
    )
}
