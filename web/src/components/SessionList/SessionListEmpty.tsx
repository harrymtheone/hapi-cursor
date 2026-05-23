import { useTranslation } from '@/lib/use-translation'

export function SessionListEmpty(props: {
    onNewSession: () => void
    onBrowse?: () => void
}) {
    const { t } = useTranslation()
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--app-hint)] opacity-60"
            >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 9h18" />
                <path d="M8 14h8" />
                <path d="M8 17h5" />
            </svg>
            <div className="text-base font-medium text-[var(--app-fg)]">
                {t('sessions.empty.title')}
            </div>
            <div className="max-w-sm text-sm text-[var(--app-hint)]">
                {t('sessions.empty.hint')}
            </div>
            <div className="flex items-center gap-2 mt-2">
                <button
                    type="button"
                    onClick={props.onNewSession}
                    className="px-4 py-1.5 text-sm rounded-lg bg-[var(--app-button)] text-[var(--app-button-text)] font-medium hover:opacity-90 transition-opacity"
                >
                    {t('sessions.empty.startSession')}
                </button>
                {props.onBrowse && (
                    <button
                        type="button"
                        onClick={props.onBrowse}
                        className="px-4 py-1.5 text-sm rounded-lg border border-[var(--app-border)] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                    >
                        {t('sessions.empty.browse')}
                    </button>
                )}
            </div>
        </div>
    )
}
