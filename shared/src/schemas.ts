import { z } from 'zod'
import { PERMISSION_MODES } from './modes'

export const PermissionModeSchema = z.enum(PERMISSION_MODES)
export const SessionEndReasonSchema = z.enum(['completed', 'terminated', 'error', 'handoff'])
export type SessionEndReason = z.infer<typeof SessionEndReasonSchema>

const MetadataSummarySchema = z.object({
    text: z.string(),
    updatedAt: z.number()
})

const SessionCapabilitiesSchema = z.object({
    terminal: z.boolean().optional()
})

export const WorktreeMetadataSchema = z.object({
    basePath: z.string(),
    branch: z.string(),
    name: z.string(),
    worktreePath: z.string().optional(),
    createdAt: z.number().optional()
})

export type WorktreeMetadata = z.infer<typeof WorktreeMetadataSchema>

export const MetadataSchema = z.object({
    path: z.string(),
    host: z.string(),
    version: z.string().optional(),
    name: z.string().optional(),
    os: z.string().optional(),
    summary: MetadataSummarySchema.optional(),
    machineId: z.string().optional(),
    cursorSessionId: z.string().optional(),
    tools: z.array(z.string()).optional(),
    slashCommands: z.array(z.string()).optional(),
    homeDir: z.string().optional(),
    happyHomeDir: z.string().optional(),
    happyLibDir: z.string().optional(),
    happyToolsDir: z.string().optional(),
    startedFromRunner: z.boolean().optional(),
    hostPid: z.number().optional(),
    startedBy: z.enum(['runner', 'terminal']).optional(),
    lifecycleState: z.string().optional(),
    lifecycleStateSince: z.number().optional(),
    archivedBy: z.string().optional(),
    archiveReason: z.string().optional(),
    capabilities: SessionCapabilitiesSchema.optional(),
    worktree: WorktreeMetadataSchema.optional()
})

export type Metadata = z.infer<typeof MetadataSchema>

export const AgentStateRequestSchema = z.object({
    tool: z.string(),
    arguments: z.unknown(),
    createdAt: z.number().nullish()
})

export type AgentStateRequest = z.infer<typeof AgentStateRequestSchema>

export const AgentStateCompletedRequestSchema = z.object({
    tool: z.string(),
    arguments: z.unknown(),
    createdAt: z.number().nullish(),
    completedAt: z.number().nullish(),
    status: z.enum(['canceled', 'denied', 'approved']),
    reason: z.string().optional(),
    mode: z.string().optional(),
    decision: z.enum(['approved', 'approved_for_session', 'denied', 'abort']).optional(),
    allowTools: z.array(z.string()).optional(),
    // Flat format: Record<string, string[]> (AskUserQuestion)
    // Nested format: Record<string, { answers: string[] }> (request_user_input)
    answers: z.union([
        z.record(z.string(), z.array(z.string())),
        z.record(z.string(), z.object({ answers: z.array(z.string()) }))
    ]).optional()
})

export type AgentStateCompletedRequest = z.infer<typeof AgentStateCompletedRequestSchema>

export const AgentStateSchema = z.object({
    controlledByUser: z.boolean().nullish(),
    requests: z.record(z.string(), AgentStateRequestSchema).nullish(),
    completedRequests: z.record(z.string(), AgentStateCompletedRequestSchema).nullish()
})

export type AgentState = z.infer<typeof AgentStateSchema>

export const TodoItemSchema = z.object({
    content: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed']),
    priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
    id: z.string().optional().default(''),
    activeForm: z.string().optional()
})

export type TodoItem = z.infer<typeof TodoItemSchema>

export const TodosSchema = z.array(TodoItemSchema)

export const TeamMemberSchema = z.object({
    name: z.string(),
    agentType: z.string().optional(),
    status: z.enum(['active', 'idle', 'shutdown']).optional()
})

export type TeamMember = z.infer<typeof TeamMemberSchema>

export const TeamTaskSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
    owner: z.string().optional()
})

export type TeamTask = z.infer<typeof TeamTaskSchema>

export const TeamMessageSchema = z.object({
    from: z.string(),
    to: z.string(),
    summary: z.string(),
    type: z.enum(['message', 'broadcast', 'shutdown_request', 'shutdown_response']),
    timestamp: z.number()
})

export type TeamMessage = z.infer<typeof TeamMessageSchema>

export const TeamStateSchema = z.object({
    teamName: z.string(),
    description: z.string().optional(),
    members: z.array(TeamMemberSchema).optional(),
    tasks: z.array(TeamTaskSchema).optional(),
    messages: z.array(TeamMessageSchema).optional(),
    updatedAt: z.number().optional()
})

export type TeamState = z.infer<typeof TeamStateSchema>

export const ThreadGoalStatusSchema = z.enum(['active', 'paused', 'budgetLimited', 'complete'])
export type ThreadGoalStatus = z.infer<typeof ThreadGoalStatusSchema>

export const ThreadGoalSchema = z.object({
    threadId: z.string(),
    objective: z.string(),
    status: ThreadGoalStatusSchema,
    tokenBudget: z.number().nullable().optional(),
    tokensUsed: z.number().optional().default(0),
    timeUsedSeconds: z.number().optional().default(0),
    createdAt: z.number().optional().default(0),
    updatedAt: z.number().optional().default(0)
})

export type ThreadGoal = z.infer<typeof ThreadGoalSchema>

export const AttachmentMetadataSchema = z.object({
    id: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    path: z.string(),
    previewUrl: z.string().optional()
})

export type AttachmentMetadata = z.infer<typeof AttachmentMetadataSchema>

export const DecryptedMessageSchema = z.object({
    id: z.string(),
    seq: z.number().nullable(),
    localId: z.string().nullable(),
    content: z.unknown(),
    createdAt: z.number(),
    invokedAt: z.number().nullable().optional(),
    scheduledAt: z.number().nullable().optional()
})

export type DecryptedMessage = z.infer<typeof DecryptedMessageSchema>

export const MachineMetadataSchema = z.object({
    host: z.string(),
    platform: z.string(),
    happyCliVersion: z.string(),
    displayName: z.string().optional(),
    homeDir: z.string(),
    happyHomeDir: z.string(),
    happyLibDir: z.string(),
    workspaceRoot: z.string().optional(),
    workspaceRoots: z.array(z.string()).optional()
}).transform(({ workspaceRoot, workspaceRoots, ...rest }) => {
    const normalizedWorkspaceRoots = Array.from(new Set(
        Array.isArray(workspaceRoots)
            ? workspaceRoots.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
            : workspaceRoot
                ? [workspaceRoot]
                : []
    ))

    return {
        ...rest,
        workspaceRoots: normalizedWorkspaceRoots.length > 0 ? normalizedWorkspaceRoots : undefined
    }
})

export type MachineMetadata = z.infer<typeof MachineMetadataSchema>

export const RunnerStateSchema = z.object({
    status: z.union([z.enum(['running', 'shutting-down']), z.string()]),
    pid: z.number().optional(),
    httpPort: z.number().optional(),
    startedAt: z.number().optional(),
    shutdownRequestedAt: z.number().optional(),
    shutdownSource: z.union([z.enum(['mobile-app', 'cli', 'os-signal', 'unknown']), z.string()]).optional(),
    lastSpawnError: z.object({
        message: z.string(),
        pid: z.number().optional(),
        exitCode: z.number().nullable().optional(),
        signal: z.string().nullable().optional(),
        at: z.number()
    }).nullable().optional()
})

export type RunnerState = z.infer<typeof RunnerStateSchema>

export const MachineSchema = z.object({
    id: z.string(),
    seq: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    active: z.boolean(),
    activeAt: z.number(),
    metadata: MachineMetadataSchema.nullable(),
    metadataVersion: z.number(),
    runnerState: RunnerStateSchema.nullable(),
    runnerStateVersion: z.number()
})

export type Machine = z.infer<typeof MachineSchema>

export const MessageMetaSchema = z.object({
    sentFrom: z.string().optional(),
    fallbackModel: z.string().nullable().optional(),
    customSystemPrompt: z.string().nullable().optional(),
    appendSystemPrompt: z.string().nullable().optional(),
    allowedTools: z.array(z.string()).nullable().optional(),
    disallowedTools: z.array(z.string()).nullable().optional()
})

export type MessageMeta = z.infer<typeof MessageMetaSchema>

export const UserMessageSchema = z.object({
    role: z.literal('user'),
    content: z.object({
        type: z.literal('text'),
        text: z.string(),
        attachments: z.array(AttachmentMetadataSchema).optional()
    }),
    localKey: z.string().optional(),
    meta: MessageMetaSchema.optional()
})

export type UserMessage = z.infer<typeof UserMessageSchema>

export const AgentMessageSchema = z.object({
    role: z.literal('agent'),
    content: z.object({
        type: z.literal('output'),
        data: z.unknown()
    }),
    meta: MessageMetaSchema.optional()
})

export type AgentMessage = z.infer<typeof AgentMessageSchema>

export const MessageContentSchema = z.union([UserMessageSchema, AgentMessageSchema])

export type MessageContent = z.infer<typeof MessageContentSchema>

export const ToolCallProjectionSchema = z.object({
    callId: z.string().min(1),
    name: z.string().min(1),
    input: z.unknown(),
    status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
    result: z.unknown().optional(),
    error: z.unknown().optional(),
    startedAt: z.number(),
    completedAt: z.number().optional(),
    permission: z.object({
        toolName: z.string().optional(),
        input: z.unknown().optional(),
        decision: z.string().optional()
    }).strict().optional()
}).strict()

export type ToolCallProjection = z.infer<typeof ToolCallProjectionSchema>

export const CursorModelSummarySchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
    isCurrent: z.boolean().optional()
}).strict()

export type CursorModelSummary = z.infer<typeof CursorModelSummarySchema>

const CursorRuntimeConfigFailureReasonSchema = z.enum([
    'cursor-cli-unavailable',
    'not-authenticated',
    'timed-out',
    'empty-model-list',
    'unknown'
])

export const CursorModelDiscoveryResultSchema = z.discriminatedUnion('status', [
    z.object({
        status: z.literal('ok'),
        models: z.array(CursorModelSummarySchema),
        discoveredAt: z.number()
    }).strict(),
    z.object({
        status: z.literal('error'),
        reason: CursorRuntimeConfigFailureReasonSchema,
        discoveredAt: z.number()
    }).strict()
])

export type CursorModelDiscoveryResult = z.infer<typeof CursorModelDiscoveryResultSchema>

const CursorRuntimeConfigStateSchema = {
    model: z.string().nullable(),
    modelReasoningEffort: z.string().nullable(),
    effort: z.string().nullable()
}

export const CursorRuntimeConfigApplyResultSchema = z.discriminatedUnion('status', [
    z.object({
        status: z.literal('applied'),
        ...CursorRuntimeConfigStateSchema
    }).strict(),
    z.object({
        status: z.literal('pending'),
        ...CursorRuntimeConfigStateSchema,
        reason: CursorRuntimeConfigFailureReasonSchema.optional()
    }).strict(),
    z.object({
        status: z.literal('failed'),
        ...CursorRuntimeConfigStateSchema,
        reason: CursorRuntimeConfigFailureReasonSchema.optional()
    }).strict(),
    z.object({
        status: z.literal('applies-next-run'),
        ...CursorRuntimeConfigStateSchema,
        reason: CursorRuntimeConfigFailureReasonSchema.optional()
    }).strict()
])

export type CursorRuntimeConfigApplyResult = z.infer<typeof CursorRuntimeConfigApplyResultSchema>

const SessionSummaryStatusKindSchema = z.enum(['running', 'thinking', 'waiting', 'error', 'completed', 'idle'])

export const SessionSchema = z.object({
    id: z.string(),
    seq: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    active: z.boolean(),
    activeAt: z.number(),
    metadata: MetadataSchema.nullable(),
    metadataVersion: z.number(),
    agentState: AgentStateSchema.nullable(),
    agentStateVersion: z.number(),
    thinking: z.boolean(),
    thinkingAt: z.number(),
    backgroundTaskCount: z.number().optional(),
    todos: TodosSchema.optional(),
    teamState: TeamStateSchema.optional(),
    model: z.string().nullable().optional().default(null),
    modelReasoningEffort: z.string().nullable().optional().default(null),
    effort: z.string().nullable().optional().default(null),
    turnCompletionMarker: z.number().nullable().optional().default(null),
    permissionMode: PermissionModeSchema.optional(),
    endReason: SessionEndReasonSchema.optional()
})

export type Session = z.infer<typeof SessionSchema>

export const SessionPatchSchema = z.object({
    active: z.boolean().optional(),
    activeAt: z.number().optional(),
    thinking: z.boolean().optional(),
    updatedAt: z.number().optional(),
    permissionMode: PermissionModeSchema.optional(),
    model: z.string().nullable().optional(),
    modelReasoningEffort: z.string().nullable().optional(),
    effort: z.string().nullable().optional(),
    backgroundTaskCount: z.number().optional(),
    statusKind: SessionSummaryStatusKindSchema.optional(),
    completionMarker: z.number().nullable().optional(),
    errorMarker: z.number().nullable().optional()
}).strict()

export type SessionPatch = z.infer<typeof SessionPatchSchema>

export const MachinePatchSchema = z.object({
    active: z.literal(false),
    activeAt: z.number().optional()
}).strict()

export type MachinePatch = z.infer<typeof MachinePatchSchema>

const SessionChangedSchema = z.object({
    sessionId: z.string()
})

const MachineChangedSchema = z.object({
    machineId: z.string()
})

export const SyncEventSchema = z.discriminatedUnion('type', [
    SessionChangedSchema.extend({
        type: z.literal('session-added'),
        data: SessionSchema
    }),
    SessionChangedSchema.extend({
        type: z.literal('session-updated'),
        data: z.union([SessionSchema, SessionPatchSchema])
    }),
    z.object({
        type: z.literal('session-removed'),
        sessionId: z.string()
    }),
    SessionChangedSchema.extend({
        type: z.literal('message-received'),
        message: DecryptedMessageSchema
    }),
    SessionChangedSchema.extend({
        type: z.literal('messages-invalidated')
    }),
    SessionChangedSchema.extend({
        type: z.literal('session-ended'),
        reason: SessionEndReasonSchema.optional()
    }),
    MachineChangedSchema.extend({
        type: z.literal('machine-updated'),
        data: z.union([MachineSchema, MachinePatchSchema, z.null()])
    }),
    z.object({
        type: z.literal('toast'),
        data: z.object({
            title: z.string(),
            body: z.string(),
            sessionId: z.string(),
            url: z.string()
        })
    }),
    SessionChangedSchema.extend({
        type: z.literal('messages-consumed'),
        localIds: z.array(z.string()),
        invokedAt: z.number()
    }),
    SessionChangedSchema.extend({
        type: z.literal('message-cancelled'),
        messageId: z.string(),
        localId: z.string().optional()
    }),
    z.object({
        type: z.literal('heartbeat'),
        data: z.object({
            timestamp: z.number()
        }).optional()
    }),
    z.object({
        type: z.literal('connection-changed'),
        data: z.object({
            status: z.string(),
            subscriptionId: z.string().optional()
        }).optional()
    }),
    SessionChangedSchema.extend({
        type: z.literal('tool-call-projection-updated'),
        callId: z.string().min(1),
        projection: ToolCallProjectionSchema
    })
])

export type SyncEvent = z.infer<typeof SyncEventSchema>

export const CancelMessageResponseSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('cancelled'), localId: z.string().nullable() }),
    z.object({ status: z.literal('invoked'), message: DecryptedMessageSchema }),
])

export type CancelMessageResponse = z.infer<typeof CancelMessageResponseSchema>
