import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isPermissionModeAllowedForFlavor } from '@hapi/protocol'
import type { CursorRuntimeConfigApplyResult, SkillPolicyState } from '@hapi/protocol/types'
import type { ApiClient } from '@/api/client'
import type { PermissionMode } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'
import { clearMessageWindow } from '@/lib/message-window-store'
import { isKnownFlavor } from '@hapi/protocol'

export function useSessionActions(
    api: ApiClient | null,
    sessionId: string | null,
    agentFlavor?: string | null
): {
    abortSession: () => Promise<void>
    archiveSession: () => Promise<void>
    switchSession: () => Promise<void>
    setPermissionMode: (mode: PermissionMode) => Promise<void>
    setModel: (model: string | null) => Promise<CursorRuntimeConfigApplyResult>
    setSkillPolicy: (name: string, state: SkillPolicyState) => Promise<void>
    applySkillPolicy: (skillPolicy: Record<string, SkillPolicyState>) => Promise<void>
    resetSkillPolicy: () => Promise<void>
    renameSession: (name: string) => Promise<void>
    deleteSession: () => Promise<void>
    isPending: boolean
} {
    const queryClient = useQueryClient()

    const invalidateSession = async () => {
        if (!sessionId) return
        await queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) })
        await queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
    }

    const abortMutation = useMutation({
        mutationFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.abortSession(sessionId)
        },
        onSuccess: () => void invalidateSession(),
    })

    const archiveMutation = useMutation({
        mutationFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.archiveSession(sessionId)
        },
        onSuccess: () => void invalidateSession(),
    })

    const switchMutation = useMutation({
        mutationFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.switchSession(sessionId)
        },
        onSuccess: () => void invalidateSession(),
    })

    const permissionMutation = useMutation({
        mutationFn: async (mode: PermissionMode) => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            if (isKnownFlavor(agentFlavor) && !isPermissionModeAllowedForFlavor(mode, agentFlavor)) {
                throw new Error('Invalid permission mode for session flavor')
            }
            await api.setPermissionMode(sessionId, mode)
        },
        onSuccess: () => void invalidateSession(),
    })

    const modelMutation = useMutation({
        mutationFn: async (model: string | null) => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            return await api.setModel(sessionId, model)
        },
        onSuccess: () => void invalidateSession(),
    })

    const skillPolicyMutation = useMutation({
        mutationFn: async (input: { name: string; state: SkillPolicyState } | { skillPolicy: Record<string, SkillPolicyState> }) => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            if ('skillPolicy' in input) {
                await api.applySkillPolicy(sessionId, input.skillPolicy)
            } else {
                await api.setSkillPolicy(sessionId, input)
            }
        },
        onSuccess: () => void invalidateSession(),
    })

    const resetSkillPolicyMutation = useMutation({
        mutationFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.resetSkillPolicy(sessionId)
        },
        onSuccess: () => void invalidateSession(),
    })

    const renameMutation = useMutation({
        mutationFn: async (name: string) => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.renameSession(sessionId, name)
        },
        onSuccess: () => void invalidateSession(),
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.deleteSession(sessionId)
        },
        onSuccess: async () => {
            if (!sessionId) return
            queryClient.removeQueries({ queryKey: queryKeys.session(sessionId) })
            clearMessageWindow(sessionId)
            await queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
        },
    })

    return {
        abortSession: abortMutation.mutateAsync,
        archiveSession: archiveMutation.mutateAsync,
        switchSession: switchMutation.mutateAsync,
        setPermissionMode: permissionMutation.mutateAsync,
        setModel: modelMutation.mutateAsync,
        setSkillPolicy: async (name: string, state: SkillPolicyState) => {
            await skillPolicyMutation.mutateAsync({ name, state })
        },
        applySkillPolicy: async (skillPolicy: Record<string, SkillPolicyState>) => {
            await skillPolicyMutation.mutateAsync({ skillPolicy })
        },
        resetSkillPolicy: resetSkillPolicyMutation.mutateAsync,
        renameSession: renameMutation.mutateAsync,
        deleteSession: deleteMutation.mutateAsync,
        isPending: abortMutation.isPending
            || archiveMutation.isPending
            || switchMutation.isPending
            || permissionMutation.isPending
            || modelMutation.isPending
            || skillPolicyMutation.isPending
            || resetSkillPolicyMutation.isPending
            || renameMutation.isPending
            || deleteMutation.isPending,
    }
}
