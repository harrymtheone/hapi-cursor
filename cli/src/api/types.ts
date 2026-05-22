import {
    MachineSchema,
    SessionSchema
} from '@hapi/protocol/schemas'
import {
    LocalHandoffResponseSchema,
    LocalResumeTargetResponseSchema,
    ResumableSessionsResponseSchema
} from '@hapi/protocol'
import type { PermissionMode } from '@hapi/protocol/types'
import { z } from 'zod'
import { UsageSchema } from '@/agent/agentLogSchema'

export type Usage = z.infer<typeof UsageSchema>

export type {
    AgentMessage,
    AgentState,
    AttachmentMetadata,
    Machine,
    MachineMetadata,
    MessageContent,
    MessageMeta,
    Metadata,
    RunnerState,
    Session,
    UserMessage
} from '@hapi/protocol/types'
export type SessionPermissionMode = PermissionMode
export type SessionModel = string | null
export type SessionModelReasoningEffort = string | null
export type SessionEffort = string | null

export {
    AgentMessageSchema,
    AgentStateSchema,
    AttachmentMetadataSchema,
    MachineMetadataSchema,
    MachineSchema,
    MessageContentSchema,
    MessageMetaSchema,
    MetadataSchema,
    RunnerStateSchema,
    UserMessageSchema
} from '@hapi/protocol/schemas'

export const CliMessagesResponseSchema = z.object({
    messages: z.array(z.object({
        id: z.string(),
        seq: z.number(),
        createdAt: z.number(),
        localId: z.string().nullable().optional(),
        content: z.unknown()
    }))
})

export type CliMessagesResponse = z.infer<typeof CliMessagesResponseSchema>

export const CreateSessionResponseSchema = z.object({
    session: SessionSchema
})

export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>

export const CreateMachineResponseSchema = z.object({
    machine: MachineSchema
})

export type CreateMachineResponse = z.infer<typeof CreateMachineResponseSchema>

export const GetSessionResponseSchema = CreateSessionResponseSchema
export type GetSessionResponse = z.infer<typeof GetSessionResponseSchema>

export {
    LocalHandoffResponseSchema,
    LocalResumeTargetResponseSchema,
    ResumableSessionsResponseSchema
}
