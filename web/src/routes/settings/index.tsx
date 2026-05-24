import { useTranslation } from '@/lib/use-translation'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useSettingsState } from './useSettingsState'
import { BackIcon } from './_sections/_icons'
import { LanguageSection } from './_sections/LanguageSection'
import { DisplaySection } from './_sections/DisplaySection'
import { ChatSection } from './_sections/ChatSection'
import { AboutSection } from './_sections/AboutSection'
import { ModelsSection } from './_sections/ModelsSection'

export default function SettingsPage() {
    const { t } = useTranslation()
    const goBack = useAppGoBack()
    const state = useSettingsState()

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
                <div className="mx-auto w-full max-w-content flex items-center gap-2 p-3 border-b border-[var(--app-border)]">
                    <button
                        type="button"
                        onClick={goBack}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                    >
                        <BackIcon />
                    </button>
                    <div className="flex-1 font-semibold">{t('settings.title')}</div>
                </div>
            </div>

            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full max-w-content">
                    <LanguageSection dropdown={state.language} />
                    <DisplaySection
                        appearanceDropdown={state.appearance}
                        fontDropdown={state.fontScale}
                        terminalFontDropdown={state.terminalFontSize}
                    />
                    <ChatSection
                        composerEnterDropdown={state.composerEnter}
                        terminalToolDisplayDropdown={state.terminalToolDisplay}
                    />
                    <ModelsSection />
                    <AboutSection />
                </div>
            </div>
        </div>
    )
}
