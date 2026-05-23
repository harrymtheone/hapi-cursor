import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/use-translation'
import { getFontScaleOptions, useFontScale, type FontScale } from '@/hooks/useFontScale'
import { getTerminalFontSizeOptions, useTerminalFontSize, type TerminalFontSize } from '@/hooks/useTerminalFontSize'
import {
    MAX_SESSION_PREVIEW_LIMIT,
    MIN_SESSION_PREVIEW_LIMIT,
    normalizeSessionPreviewLimit,
    useSessionPreviewLimit,
} from '@/hooks/useSessionPreviewLimit'
import { useAppearance, getAppearanceOptions, type AppearancePreference } from '@/hooks/useTheme'
import type { DropdownSlot } from '@/routes/settings/useSettingsState'
import { CheckIcon, ChevronDownIcon, MinusIcon, PlusIcon } from './_icons'

interface SessionPreviewLimitControlProps {
    label: string
    value: number
    onChange: (value: number) => void
    decreaseLabel: string
    increaseLabel: string
}

function SessionPreviewLimitControl(props: SessionPreviewLimitControlProps) {
    const [draft, setDraft] = useState(String(props.value))

    useEffect(() => {
        setDraft(String(props.value))
    }, [props.value])

    const commitDraft = () => {
        const parsed = draft.trim() === '' ? props.value : Number(draft)
        const next = normalizeSessionPreviewLimit(parsed)
        props.onChange(next)
        setDraft(String(next))
    }

    const step = (delta: number) => {
        const next = normalizeSessionPreviewLimit(props.value + delta)
        props.onChange(next)
        setDraft(String(next))
    }

    return (
        <div className="flex w-full items-center justify-between gap-3 px-3 py-3">
            <label htmlFor="session-preview-limit" className="text-[var(--app-fg)]">
                {props.label}
            </label>
            <div className="flex h-9 shrink-0 items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-sm">
                <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={props.value <= MIN_SESSION_PREVIEW_LIMIT}
                    aria-label={props.decreaseLabel}
                    title={props.decreaseLabel}
                    className="flex h-8 w-8 items-center justify-center rounded-l-lg text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <MinusIcon className="h-3.5 w-3.5" />
                </button>
                <input
                    id="session-preview-limit"
                    type="number"
                    inputMode="numeric"
                    min={MIN_SESSION_PREVIEW_LIMIT}
                    max={MAX_SESSION_PREVIEW_LIMIT}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commitDraft}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault()
                            commitDraft()
                            event.currentTarget.blur()
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault()
                            setDraft(String(props.value))
                            event.currentTarget.blur()
                        }
                    }}
                    className="h-8 w-14 border-x border-[var(--app-border)] bg-transparent text-center text-sm font-medium tabular-nums text-[var(--app-fg)] outline-none focus:bg-[var(--app-subtle-bg)]"
                />
                <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={props.value >= MAX_SESSION_PREVIEW_LIMIT}
                    aria-label={props.increaseLabel}
                    title={props.increaseLabel}
                    className="flex h-8 w-8 items-center justify-center rounded-r-lg text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <PlusIcon className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    )
}

export interface DisplaySectionProps {
    appearanceDropdown: DropdownSlot
    fontDropdown: DropdownSlot
    terminalFontDropdown: DropdownSlot
}

export function DisplaySection(props: DisplaySectionProps) {
    const { t } = useTranslation()
    const { fontScale, setFontScale } = useFontScale()
    const { terminalFontSize, setTerminalFontSize } = useTerminalFontSize()
    const { sessionPreviewLimit, setSessionPreviewLimit } = useSessionPreviewLimit()
    const { appearance, setAppearance } = useAppearance()

    const fontScaleOptions = getFontScaleOptions()
    const terminalFontSizeOptions = getTerminalFontSizeOptions()
    const appearanceOptions = getAppearanceOptions()

    const currentAppearanceLabel = appearanceOptions.find((opt) => opt.value === appearance)?.labelKey ?? 'settings.display.appearance.system'
    const currentFontScaleLabel = fontScaleOptions.find((opt) => opt.value === fontScale)?.label ?? '100%'
    const currentTerminalFontSizeLabel = terminalFontSizeOptions.find((opt) => opt.value === terminalFontSize)?.label ?? '13px'

    const { appearanceDropdown, fontDropdown, terminalFontDropdown } = props

    const handleAppearanceChange = (pref: AppearancePreference) => {
        setAppearance(pref)
        appearanceDropdown.setIsOpen(false)
    }

    const handleFontScaleChange = (newScale: FontScale) => {
        setFontScale(newScale)
        fontDropdown.setIsOpen(false)
    }

    const handleTerminalFontSizeChange = (newSize: TerminalFontSize) => {
        setTerminalFontSize(newSize)
        terminalFontDropdown.setIsOpen(false)
    }

    return (
        <div className="border-b border-[var(--app-divider)]">
            <div className="px-3 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide">
                {t('settings.display.title')}
            </div>
            <div ref={appearanceDropdown.containerRef} className="relative">
                <button
                    type="button"
                    onClick={() => appearanceDropdown.setIsOpen(!appearanceDropdown.isOpen)}
                    className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[var(--app-subtle-bg)]"
                    aria-expanded={appearanceDropdown.isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="text-[var(--app-fg)]">{t('settings.display.appearance')}</span>
                    <span className="flex items-center gap-1 text-[var(--app-hint)]">
                        <span>{t(currentAppearanceLabel)}</span>
                        <ChevronDownIcon className={`transition-transform ${appearanceDropdown.isOpen ? 'rotate-180' : ''}`} />
                    </span>
                </button>

                {appearanceDropdown.isOpen && (
                    <div
                        className="absolute right-3 top-full mt-1 min-w-[160px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-lg overflow-hidden z-50"
                        role="listbox"
                        aria-label={t('settings.display.appearance')}
                    >
                        {appearanceOptions.map((opt) => {
                            const isSelected = appearance === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleAppearanceChange(opt.value)}
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
            <div ref={fontDropdown.containerRef} className="relative">
                <button
                    type="button"
                    onClick={() => fontDropdown.setIsOpen(!fontDropdown.isOpen)}
                    className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[var(--app-subtle-bg)]"
                    aria-expanded={fontDropdown.isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="text-[var(--app-fg)]">{t('settings.display.fontSize')}</span>
                    <span className="flex items-center gap-1 text-[var(--app-hint)]">
                        <span>{currentFontScaleLabel}</span>
                        <ChevronDownIcon className={`transition-transform ${fontDropdown.isOpen ? 'rotate-180' : ''}`} />
                    </span>
                </button>

                {fontDropdown.isOpen && (
                    <div
                        className="absolute right-3 top-full mt-1 min-w-[140px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-lg overflow-hidden z-50"
                        role="listbox"
                        aria-label={t('settings.display.fontSize')}
                    >
                        {fontScaleOptions.map((opt) => {
                            const isSelected = fontScale === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleFontScaleChange(opt.value)}
                                    className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                        isSelected
                                            ? 'text-[var(--app-link)] bg-[var(--app-subtle-bg)]'
                                            : 'text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
                                    }`}
                                >
                                    <span>{opt.label}</span>
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
            <div ref={terminalFontDropdown.containerRef} className="relative">
                <button
                    type="button"
                    onClick={() => terminalFontDropdown.setIsOpen(!terminalFontDropdown.isOpen)}
                    className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[var(--app-subtle-bg)]"
                    aria-expanded={terminalFontDropdown.isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="text-[var(--app-fg)]">{t('settings.display.terminalFontSize')}</span>
                    <span className="flex items-center gap-1 text-[var(--app-hint)]">
                        <span>{currentTerminalFontSizeLabel}</span>
                        <ChevronDownIcon className={`transition-transform ${terminalFontDropdown.isOpen ? 'rotate-180' : ''}`} />
                    </span>
                </button>

                {terminalFontDropdown.isOpen && (
                    <div
                        className="absolute right-3 top-full mt-1 min-w-[140px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-lg overflow-hidden z-50"
                        role="listbox"
                        aria-label={t('settings.display.terminalFontSize')}
                    >
                        {terminalFontSizeOptions.map((opt) => {
                            const isSelected = terminalFontSize === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleTerminalFontSizeChange(opt.value)}
                                    className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                        isSelected
                                            ? 'text-[var(--app-link)] bg-[var(--app-subtle-bg)]'
                                            : 'text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
                                    }`}
                                >
                                    <span>{opt.label}</span>
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
            <SessionPreviewLimitControl
                label={t('settings.display.sessionPreviewLimit')}
                value={sessionPreviewLimit}
                onChange={setSessionPreviewLimit}
                decreaseLabel={t('settings.display.sessionPreviewLimit.decrease')}
                increaseLabel={t('settings.display.sessionPreviewLimit.increase')}
            />
        </div>
    )
}
