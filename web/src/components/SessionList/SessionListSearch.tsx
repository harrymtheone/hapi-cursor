import { useTranslation } from '@/lib/use-translation'

function SearchIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
        </svg>
    )
}

function XIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}

export function SessionListSearch(props: {
    value: string
    onChange: (value: string) => void
}) {
    const { t } = useTranslation()
    return (
        <div className="relative px-3 pb-2">
            <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center pb-2 text-[var(--app-hint)]">
                <SearchIcon className="h-3.5 w-3.5" />
            </div>
            <input
                type="search"
                value={props.value}
                onChange={(event) => props.onChange(event.target.value)}
                placeholder={t('sessions.search.placeholder')}
                className="w-full appearance-none rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] py-1.5 pl-8 pr-8 text-sm text-[var(--app-fg)] outline-none transition-colors placeholder:text-[var(--app-hint)] focus:border-[var(--app-link)] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {props.value ? (
                <button
                    type="button"
                    onClick={() => props.onChange('')}
                    className="absolute inset-y-0 right-5 flex items-center pb-2 rounded p-0.5 text-[var(--app-hint)] hover:text-[var(--app-fg)]"
                    title={t('sessions.search.clear')}
                >
                    <XIcon className="h-3.5 w-3.5" />
                </button>
            ) : null}
        </div>
    )
}
