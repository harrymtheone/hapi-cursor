import { describe, it, expect } from 'vitest';
import {
    parseCursorEvent,
    convertCursorEventToAgentMessage,
    type CursorStreamEvent
} from './cursorEventConverter';
import {
    CAPTURED_FIXTURES_MAPPING_READY,
    CURSOR_TOOL_CALL_NDJSON_CAPTURED_FIXTURES,
} from './fixtures/cursorToolCallNdjson.captured';
import { CURSOR_TOOL_CALL_NDJSON_FIXTURES } from './fixtures/cursorToolCallNdjson';

describe('cursorEventConverter', () => {
    describe('parseCursorEvent', () => {
        it('parses system init event', () => {
            const line =
                '{"type":"system","subtype":"init","apiKeySource":"login","cwd":"D:\\\\projects\\\\hapi","session_id":"cec26d70-d2d5-48ac-a88b-9e820eb201cf","timestamp_ms":1772422778942}';
            const event = parseCursorEvent(line);
            expect(event).not.toBeNull();
            expect(event?.type).toBe('system');
            if (event && event.type === 'system') {
                expect(event.subtype).toBe('init');
                expect(event.session_id).toBe('cec26d70-d2d5-48ac-a88b-9e820eb201cf');
            }
        });

        it('parses assistant event', () => {
            const line =
                '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"\\n你好。"}]},"session_id":"cec26d70-d2d5-48ac-a88b-9e820eb201cf"}';
            const event = parseCursorEvent(line);
            expect(event).not.toBeNull();
            expect(event?.type).toBe('assistant');
        });

        it('parses result event', () => {
            const line =
                '{"type":"result","subtype":"success","duration_ms":12456,"is_error":false,"result":"\\n你好。","session_id":"cec26d70-d2d5-48ac-a88b-9e820eb201cf"}';
            const event = parseCursorEvent(line);
            expect(event).not.toBeNull();
            expect(event?.type).toBe('result');
        });

        it('returns null for non-JSON lines', () => {
            expect(parseCursorEvent('')).toBeNull();
            expect(parseCursorEvent('   ')).toBeNull();
            expect(parseCursorEvent('正在写入 Web 请求')).toBeNull();
        });
    });

    describe('convertCursorEventToAgentMessage', () => {
        it('converts assistant to text message', () => {
            const event = {
                type: 'assistant',
                message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
                session_id: 's1'
            } as CursorStreamEvent;
            const msg = convertCursorEventToAgentMessage(event);
            expect(msg).toEqual({ type: 'text', text: 'Hello' });
        });

        it('converts result to turn_complete', () => {
            const event = { type: 'result', subtype: 'success', session_id: 's1' } as CursorStreamEvent;
            const msg = convertCursorEventToAgentMessage(event);
            expect(msg).toEqual({ type: 'turn_complete', stopReason: 'success' });
        });
    });

    describe('native ToolCall NDJSON fixtures', () => {
        const nativeVariants = Object.entries(CURSOR_TOOL_CALL_NDJSON_FIXTURES).filter(
            ([key]) => key !== 'functionMcp'
        );

        it.each(nativeVariants)(
            'started %s converts to expected HAPI name with non-empty input',
            (_variantKey, fixture) => {
                const event = parseCursorEvent(fixture.started);
                expect(event?.type).toBe('tool_call');
                const msg = convertCursorEventToAgentMessage(event as CursorStreamEvent);
                expect(msg).toMatchObject({
                    type: 'tool_call',
                    id: fixture.callId,
                    name: fixture.expectedName,
                    status: 'in_progress',
                });
                expect(msg && 'input' in msg && msg.input).not.toEqual({});
            }
        );

        it.each(nativeVariants)(
            'completed %s converts to tool_result with output',
            (_variantKey, fixture) => {
                const event = parseCursorEvent(fixture.completed);
                const msg = convertCursorEventToAgentMessage(event as CursorStreamEvent);
                expect(msg).toMatchObject({
                    type: 'tool_result',
                    id: fixture.callId,
                    status: 'completed',
                });
                expect(msg && 'output' in msg && msg.output).toBeDefined();
                expect(msg && 'output' in msg && msg.output).not.toEqual({});
            }
        );

        it('grepToolCall and shellToolCall no longer emit name unknown', () => {
            for (const key of ['grepToolCall', 'shellToolCall'] as const) {
                const fixture = CURSOR_TOOL_CALL_NDJSON_FIXTURES[key];
                const event = parseCursorEvent(fixture.started);
                const msg = convertCursorEventToAgentMessage(event as CursorStreamEvent);
                expect(msg && 'name' in msg ? msg.name : '').not.toBe('unknown');
            }
        });

        it('function.name MCP fixture preserves custom tool name', () => {
            const fixture = CURSOR_TOOL_CALL_NDJSON_FIXTURES.functionMcp;
            const event = parseCursorEvent(fixture.started);
            const msg = convertCursorEventToAgentMessage(event as CursorStreamEvent);
            expect(msg).toMatchObject({
                type: 'tool_call',
                name: fixture.expectedName,
                status: 'in_progress',
            });
        });
    });

    describe('captured fixtures', () => {
        function expectCanonicalInput(
            name: string,
            input: unknown
        ): void {
            expect(input).toBeTruthy();
            expect(typeof input).toBe('object');
            const record = input as Record<string, unknown>;

            switch (name) {
                case 'Task': {
                    const description =
                        typeof record.description === 'string' ? record.description : '';
                    const prompt = typeof record.prompt === 'string' ? record.prompt : '';
                    expect(description.length > 0 || prompt.length > 0).toBe(true);
                    break;
                }
                case 'Agent': {
                    expect(typeof record.prompt === 'string' && record.prompt.length > 0).toBe(
                        true
                    );
                    break;
                }
                case 'NotebookEdit':
                case 'NotebookRead': {
                    expect(
                        typeof record.notebook_path === 'string' && record.notebook_path.length > 0
                    ).toBe(true);
                    break;
                }
                case 'Skill': {
                    expect(typeof record.skill === 'string' && record.skill.length > 0).toBe(true);
                    break;
                }
                case 'AskUserQuestion': {
                    expect(Array.isArray(record.questions) && record.questions.length > 0).toBe(
                        true
                    );
                    break;
                }
                default:
                    break;
            }
        }

        it.each(CAPTURED_FIXTURES_MAPPING_READY)(
            'started %s converts to expected HAPI name and canonical input',
            (key, fixture) => {
                void key;
                const event = parseCursorEvent(fixture.started);
                expect(event?.type).toBe('tool_call');
                const msg = convertCursorEventToAgentMessage(event as CursorStreamEvent);
                expect(msg).toMatchObject({
                    type: 'tool_call',
                    id: fixture.callId,
                    name: fixture.expectedName,
                    status: 'in_progress',
                });
                if (msg && msg.type === 'tool_call') {
                    expectCanonicalInput(fixture.expectedName, msg.input);
                }
            }
        );

        it('all captured fixtures are mapping-ready after Plan 01.3-02', () => {
            const pending = Object.entries(CURSOR_TOOL_CALL_NDJSON_CAPTURED_FIXTURES).filter(
                ([, f]) => f.pendingMapping
            );
            expect(pending).toEqual([]);
        });
    });
});
