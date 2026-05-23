import { useTranslation, type Locale } from '@/lib/use-translation'
import type { DropdownSlot } from '@/routes/settings/useSettingsState'
import { CheckIcon, ChevronDownIcon } from './_icons'

const locales: { value: Locale; nativeLabel: string }[] = [
    { value: 'en', nativeLabel: 'English' },
    { value: 'zh-CN', nativeLabel: '简体中文' },
]

export function LanguageSection(props: { dropdown: DropdownSlot }) {
    const { t, locale, setLocale } = useTranslation()
    const { isOpen, setIsOpen, containerRef } = props.dropdown
    const currentLocale = locales.find((loc) => loc.value === locale)

    const handleLocaleChange = (newLocale: Locale) => {
        setLocale(newLocale)
        setIsOpen(false)
    }

    return (
        <div className="border-b border-[var(--app-divider)]">
            <div className="px-3 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide">
                {t('settings.language.title')}
            </div>
            <div ref={containerRef} className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[var(--app-subtle-bg)]"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="text-[var(--app-fg)]">{t('settings.language.label')}</span>
                    <span className="flex items-center gap-1 text-[var(--app-hint)]">
                        <span>{currentLocale?.nativeLabel}</span>
                        <ChevronDownIcon className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </span>
                </button>

                {isOpen && (
                    <div
                        className="absolute right-3 top-full mt-1 min-w-[160px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-lg overflow-hidden z-50"
                        role="listbox"
                        aria-label={t('settings.language.title')}
                    >
                        {locales.map((loc) => {
                            const isSelected = locale === loc.value
                            return (
                                <button
                                    key={loc.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleLocaleChange(loc.value)}
                                    className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                        isSelected
                                            ? 'text-[var(--app-link)] bg-[var(--app-subtle-bg)]'
                                            : 'text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
                                    }`}
                                >
                                    <span>{loc.nativeLabel}</span>
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
        </div>
    )
}
