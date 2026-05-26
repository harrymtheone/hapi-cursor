/**
 * Converts Cursor Agent stream-json events to HAPI AgentMessage format.
 * Cursor emits NDJSON: system/init, thinking, assistant, tool_call, result.
 */

import type { AgentMessage } from '@/agent/types';
import { findNativeToolCallVariant, resolveHapiToolName } from './cursorToolCallMapping';

export type CursorStreamEvent =
    | { type: 'system'; subtype: 'init'; session_id: string; cwd?: string; model?: string }
    | { type: 'thinking'; subtype: 'delta' | 'completed'; text?: string; session_id: string }
    | {
          type: 'user';
          message: { role: string; content: Array<{ type: string; text: string }> };
          session_id: string;
      }
    | {
          type: 'assistant';
          message: { role: string; content: Array<{ type: string; text: string }> };
          session_id: string;
      }
    | {
          type: 'tool_call';
          subtype: 'started' | 'completed';
          call_id: string;
          tool_call: Record<string, unknown>;
          session_id: string;
      }
    | {
          type: 'result';
          subtype: 'success';
          session_id: string;
          result?: string;
          is_error?: boolean;
      };

export function parseCursorEvent(line: string): CursorStreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) {
        return null;
    }
    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed && typeof parsed === 'object' && 'type' in parsed) {
            return parsed as CursorStreamEvent;
        }
    } catch {
        // ignore non-JSON lines (e.g. stderr progress)
    }
    return null;
}

function extractToolName(toolCall: Record<string, unknown>): string {
    return resolveHapiToolName(toolCall);
}

function extractToolInput(toolCall: Record<string, unknown>): unknown {
    const native = findNativeToolCallVariant(toolCall);
    if (native) {
        return native.variant.args ?? {};
    }
    if (toolCall.function && typeof toolCall.function === 'object') {
        const fn = toolCall.function as Record<string, unknown>;
        return { arguments: fn.arguments };
    }
    return {};
}

function extractToolResult(toolCall: Record<string, unknown>): unknown {
    const native = findNativeToolCallVariant(toolCall);
    if (native) {
        return native.variant.result ?? {};
    }
    if (toolCall.function && typeof toolCall.function === 'object') {
        const fn = toolCall.function as Record<string, unknown>;
        return fn.result ?? {};
    }
    return {};
}

export function convertCursorEventToAgentMessage(event: CursorStreamEvent): AgentMessage | null {
    switch (event.type) {
        case 'assistant': {
            const text = event.message?.content
                ?.filter((c): c is { type: string; text: string } => c.type === 'text')
                .map((c) => c.text)
                .join('') ?? '';
            if (!text) return null;
            return { type: 'text', text };
        }
        case 'tool_call': {
            const toolCall = event.tool_call as Record<string, unknown>;
            const name = extractToolName(toolCall);
            const input = extractToolInput(toolCall);
            if (event.subtype === 'started') {
                return {
                    type: 'tool_call',
                    id: event.call_id,
                    name,
                    input,
                    status: 'in_progress'
                };
            }
            const result = extractToolResult(toolCall);
            return {
                type: 'tool_result',
                id: event.call_id,
                output: result,
                status: 'completed'
            };
        }
        case 'result':
            return { type: 'turn_complete', stopReason: 'success' };
        default:
            return null;
    }
}
