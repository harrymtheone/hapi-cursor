import { useTranslation } from '@/lib/use-translation'

function PlusIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    )
}

export function SessionListHeader(props: {
    isSearching: boolean
    visibleSessionCount: number
    totalSessionCount: number
    groupCount: number
    onNewSession: () => void
}) {
    const { t } = useTranslation()
    return (
        <div className="flex items-center justify-between px-3 py-1">
            <div className="text-xs text-[var(--app-hint)]">
                {props.isSearching
                    ? t('sessions.search.count', { n: props.visibleSessionCount, total: props.totalSessionCount })
                    : t('sessions.count', { n: props.totalSessionCount, m: props.groupCount })}
            </div>
            <button
                type="button"
                onClick={props.onNewSession}
                className="session-list-new-button p-1.5 rounded-full text-[var(--app-link)] transition-colors"
                title={t('sessions.new')}
            >
                <PlusIcon className="h-5 w-5" />
            </button>
        </div>
    )
}
