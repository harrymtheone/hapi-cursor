import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useMachines } from '@/hooks/queries/useMachines'
import { useCursorModels } from '@/hooks/useCursorModels'
import { useVisibleModelFamilies } from '@/hooks/useVisibleModelFamilies'
import { groupModelsIntoFamilies } from '@/lib/cursorModelFamilies'
import { CursorModelDiscoveryStatus } from '@/components/cursor/CursorModelDiscoveryStatus'
import { BackIcon } from './_sections/_icons'

export default function ModelsSettingsPage() {
    const { t } = useTranslation()
    const goBack = useAppGoBack()
    const navigate = useNavigate()
    const { api } = useAppContext()
    const { machines } = useMachines(api, true)
    const machineId = useMemo(
        () => machines.find((machine) => machine.active)?.id ?? machines[0]?.id ?? null,
        [machines]
    )
    const {
        result: discoveryResult,
        isLoading: isDiscoveryLoading,
        error: discoveryError,
        retry: retryDiscovery,
    } = useCursorModels(api, machineId, Boolean(machineId))
    const { visibleKeys, setVisibleFamilies } = useVisibleModelFamilies()

    const families = useMemo(() => {
        if (discoveryResult?.status !== 'ok') {
            return []
        }
        return groupModelsIntoFamilies(discoveryResult.models)
    }, [discoveryResult])

    const [searchQuery, setSearchQuery] = useState('')
    const [draftKeys, setDraftKeys] = useState<string[] | null>(null)

    const selectedKeys = draftKeys ?? visibleKeys ?? families.map((family) => family.key)
    const filteredFamilies = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) {
            return families
        }
        return families.filter((family) => family.displayName.toLowerCase().includes(query))
    }, [families, searchQuery])

    const toggleFamily = useCallback((familyKey: string) => {
        setDraftKeys((current) => {
            const base = current ?? selectedKeys
            if (base.includes(familyKey)) {
                return base.filter((key) => key !== familyKey)
            }
            return [...base, familyKey]
        })
    }, [selectedKeys])

    const handleSave = useCallback(() => {
        setVisibleFamilies(selectedKeys)
        setDraftKeys(null)
        navigate({ to: '/settings' })
    }, [navigate, selectedKeys, setVisibleFamilies])

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
                    <div className="flex-1 font-semibold">{t('settings.models.title')}</div>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={families.length === 0}
                        className="text-sm font-medium text-[var(--app-link)] disabled:opacity-40"
                    >
                        {t('settings.models.save')}
                    </button>
                </div>
            </div>

            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full max-w-content">
                    <div className="px-3 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide">
                        {t('settings.models.sectionTitle')}
                    </div>
                    <div className="px-3 pb-2">
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={t('settings.models.searchPlaceholder')}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)]"
                        />
                    </div>
                    <CursorModelDiscoveryStatus
                        isLoading={isDiscoveryLoading}
                        discoveryResult={discoveryResult}
                        discoveryError={discoveryError}
                        onRetryDiscovery={() => {
                            void retryDiscovery()
                        }}
                    />
                    {discoveryResult?.status === 'ok' ? (
                        <div className="divide-y divide-[var(--app-divider)]">
                            {filteredFamilies.map((family) => {
                                const checked = selectedKeys.includes(family.key)
                                return (
                                    <label
                                        key={family.key}
                                        className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-[var(--app-subtle-bg)]"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleFamily(family.key)}
                                            className="h-4 w-4 rounded border-[var(--app-border)]"
                                        />
                                        <span className="text-sm text-[var(--app-fg)]">{family.displayName}</span>
                                    </label>
                                )
                            })}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
