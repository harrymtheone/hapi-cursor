import type {
    DecryptedMessage as ProtocolDecryptedMessage,
    SyncEvent as ProtocolSyncEvent,
} from '@hapi/protocol/types'

export type {
    AgentState,
    AttachmentMetadata,
    CursorModelDiscoveryResult,
    Machine,
    MachinesResponse,
    MessagesResponse,
    PermissionMode,
    RunnerState,
    Session,
    SessionResponse,
    SessionSummary,
    SessionSummaryMetadata,
    SessionsResponse,
    SpawnResponse,
    TeamMember,
    TeamMessage,
    TeamState,
    TeamTask,
    ThreadGoal,
    ThreadGoalStatus,
    TodoItem,
    WorktreeMetadata,
} from '@hapi/protocol/types'

export type MessageStatus = 'queued' | 'sending' | 'sent' | 'failed'

export type DecryptedMessage = ProtocolDecryptedMessage & {
    status?: MessageStatus
    originalText?: string
    invokedAt?: number | null
}

export type AuthResponse = {
    token: string
    user: {
        id: number
        username?: string
        firstName?: string
        lastName?: string
    }
}

export type MachinePathsExistsResponse = { exists: Record<string, boolean> }

export type MachineDirectoryEntry = {
    name: string
    type: 'file' | 'directory' | 'other'
    size?: number
    modified?: number
    isGitRepo?: boolean
}

export type MachineListDirectoryResponse = {
    success: boolean
    entries?: MachineDirectoryEntry[]
    error?: string
}

export type GitCommandResponse = {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
}

export type FileSearchItem = {
    fileName: string
    filePath: string
    fullPath: string
    fileType: 'file' | 'folder'
}

export type FileSearchResponse = {
    success: boolean
    files?: FileSearchItem[]
    error?: string
}

export type DirectoryEntry = {
    name: string
    type: 'file' | 'directory' | 'other'
    size?: number
    modified?: number
}

export type ListDirectoryResponse = {
    success: boolean
    entries?: DirectoryEntry[]
    error?: string
}

export type FileReadResponse = {
    success: boolean
    content?: string
    error?: string
}

export type UploadFileResponse = {
    success: boolean
    path?: string
    error?: string
}

export type DeleteUploadResponse = {
    success: boolean
    error?: string
}

export type GitFileStatus = {
    fileName: string
    filePath: string
    fullPath: string
    status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'
    isStaged: boolean
    linesAdded: number
    linesRemoved: number
    oldPath?: string
}

export type GitStatusFiles = {
    stagedFiles: GitFileStatus[]
    unstagedFiles: GitFileStatus[]
    branch: string | null
    totalStaged: number
    totalUnstaged: number
}

export type SlashCommand = {
    name: string
    description?: string
    source: 'builtin' | 'user' | 'plugin' | 'project'
    content?: string  // Expanded content for user prompts
    pluginName?: string
}

export type SlashCommandsResponse = {
    success: boolean
    commands?: SlashCommand[]
    error?: string
}

export type SkillSummary = {
    name: string
    description?: string
}

export type SkillsResponse = {
    success: boolean
    skills?: SkillSummary[]
    error?: string
}

export type PushSubscriptionKeys = {
    p256dh: string
    auth: string
}

export type PushSubscriptionPayload = {
    endpoint: string
    keys: PushSubscriptionKeys
}

export type PushUnsubscribePayload = {
    endpoint: string
}

export type PushVapidPublicKeyResponse = {
    publicKey: string
}

export type VisibilityPayload = {
    subscriptionId: string
    visibility: 'visible' | 'hidden'
}

export type SyncEvent = ProtocolSyncEvent
