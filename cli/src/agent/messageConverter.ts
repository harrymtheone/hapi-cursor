import { randomUUID } from 'node:crypto';
import type { AgentMessage, PlanItem } from './types';

export type AgentWireMessage =
    | { type: 'message'; message: string }
    | { type: 'reasoning'; message: string; id: string }
    | {
        type: 'tool-call';
        name: string;
        callId: string;
        input: unknown;
        status?: 'pending' | 'in_progress' | 'completed' | 'failed';
    }
    | {
        type: 'tool-call-result';
        callId: string;
        output: unknown;
        is_error?: boolean;
    }
    | { type: 'plan'; entries: PlanItem[] }
    | { type: 'error'; message: string };

export function convertAgentMessage(message: AgentMessage): AgentWireMessage | null {
    switch (message.type) {
        case 'text':
            return { type: 'message', message: message.text };
        case 'reasoning':
            // AgentMessage uses `text` (consistent with the `text` variant);
            // the wire-level AgentWireMessage uses `message` to match the
            // legacy reasoning payload format (wire `type` tag preserved via
            // AGENT_MESSAGE_PAYLOAD_TYPE in shared/src/modes.ts).
            return { type: 'reasoning', message: message.text, id: randomUUID() };
        case 'tool_call':
            return {
                type: 'tool-call',
                name: message.name,
                callId: message.id,
                input: message.input,
                status: message.status
            };
        case 'tool_result':
            return {
                type: 'tool-call-result',
                callId: message.id,
                output: message.output,
                is_error: message.status === 'failed'
            };
        case 'plan':
            return {
                type: 'plan',
                entries: message.items
            };
        case 'error':
            return { type: 'error', message: message.message };
        case 'turn_complete':
            return null;
        default: {
            const _exhaustive: never = message;
            return _exhaustive;
        }
    }
}
