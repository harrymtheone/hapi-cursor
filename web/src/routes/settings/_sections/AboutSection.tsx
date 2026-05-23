import { PROTOCOL_VERSION } from '@hapi/protocol'
import { useTranslation } from '@/lib/use-translation'

export function AboutSection() {
    const { t } = useTranslation()

    return (
        <div className="border-b border-[var(--app-divider)]">
            <div className="px-3 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide">
                {t('settings.about.title')}
            </div>
            <div className="flex w-full items-center justify-between px-3 py-3">
                <span className="text-[var(--app-fg)]">{t('settings.about.website')}</span>
                <a
                    href="https://hapi.run"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--app-link)] hover:underline"
                >
                    hapi.run
                </a>
            </div>
            <div className="flex w-full items-center justify-between px-3 py-3">
                <span className="text-[var(--app-fg)]">{t('settings.about.appVersion')}</span>
                <span className="text-[var(--app-hint)]">{__APP_VERSION__}</span>
            </div>
            <div className="flex w-full items-center justify-between px-3 py-3">
                <span className="text-[var(--app-fg)]">{t('settings.about.protocolVersion')}</span>
                <span className="text-[var(--app-hint)]">{PROTOCOL_VERSION}</span>
            </div>
        </div>
    )
}
