/**
 * Minimal Cursor stream-json NDJSON fixtures per native *ToolCall variant.
 * Shapes align with Cursor agent output-format (args on started, result on completed).
 */

export type CursorToolCallFixture = {
    started: string;
    completed: string;
    callId: string;
    expectedName: string;
};

function line(payload: Record<string, unknown>): string {
    return JSON.stringify(payload);
}

function toolCallEvent(
    subtype: 'started' | 'completed',
    callId: string,
    toolCall: Record<string, unknown>
): Record<string, unknown> {
    return {
        type: 'tool_call',
        subtype,
        call_id: callId,
        tool_call: toolCall,
        session_id: 'fixture-session',
    };
}

export const CURSOR_TOOL_CALL_NDJSON_FIXTURES: Record<string, CursorToolCallFixture> = {
    readToolCall: {
        callId: 'read-fixture-1',
        expectedName: 'Read',
        started: line(
            toolCallEvent('started', 'read-fixture-1', {
                readToolCall: { args: { path: '/project/src/index.ts' } },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'read-fixture-1', {
                readToolCall: {
                    args: { path: '/project/src/index.ts' },
                    result: { success: { content: 'export {};\n', totalLines: 1 } },
                },
            })
        ),
    },
    writeToolCall: {
        callId: 'write-fixture-1',
        expectedName: 'Write',
        started: line(
            toolCallEvent('started', 'write-fixture-1', {
                writeToolCall: {
                    args: { path: '/project/out.txt', fileText: 'hello', toolCallId: 'write-fixture-1' },
                },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'write-fixture-1', {
                writeToolCall: {
                    args: { path: '/project/out.txt', fileText: 'hello', toolCallId: 'write-fixture-1' },
                    result: { success: { path: '/project/out.txt', linesCreated: 1 } },
                },
            })
        ),
    },
    grepToolCall: {
        callId: 'grep-fixture-1',
        expectedName: 'Grep',
        started: line(
            toolCallEvent('started', 'grep-fixture-1', {
                grepToolCall: { args: { pattern: 'convertCursorEvent', path: '/project' } },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'grep-fixture-1', {
                grepToolCall: {
                    args: { pattern: 'convertCursorEvent', path: '/project' },
                    result: { success: { matches: [{ path: '/project/cli/src/cursor/utils/cursorEventConverter.ts' }] } },
                },
            })
        ),
    },
    globToolCall: {
        callId: 'glob-fixture-1',
        expectedName: 'Glob',
        started: line(
            toolCallEvent('started', 'glob-fixture-1', {
                globToolCall: { args: { globPattern: '**/*.test.ts', targetDirectory: '/project/cli' } },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'glob-fixture-1', {
                globToolCall: {
                    args: { globPattern: '**/*.test.ts', targetDirectory: '/project/cli' },
                    result: { success: { files: ['src/cursor/utils/cursorEventConverter.test.ts'] } },
                },
            })
        ),
    },
    editToolCall: {
        callId: 'edit-fixture-1',
        expectedName: 'Edit',
        started: line(
            toolCallEvent('started', 'edit-fixture-1', {
                editToolCall: {
                    args: {
                        path: '/project/cli/src/cursor/utils/cursorEventConverter.ts',
                        streamContent: 'export function foo() {}\n',
                    },
                },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'edit-fixture-1', {
                editToolCall: {
                    args: {
                        path: '/project/cli/src/cursor/utils/cursorEventConverter.ts',
                        streamContent: 'export function foo() {}\n',
                    },
                    result: { success: { path: '/project/cli/src/cursor/utils/cursorEventConverter.ts' } },
                },
            })
        ),
    },
    lsToolCall: {
        callId: 'ls-fixture-1',
        expectedName: 'LS',
        started: line(
            toolCallEvent('started', 'ls-fixture-1', {
                lsToolCall: { args: { path: '/project/cli/src' } },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'ls-fixture-1', {
                lsToolCall: {
                    args: { path: '/project/cli/src' },
                    result: { success: { entries: [{ name: 'cursor', isDirectory: true }] } },
                },
            })
        ),
    },
    shellToolCall: {
        callId: 'shell-fixture-1',
        expectedName: 'Bash',
        started: line(
            toolCallEvent('started', 'shell-fixture-1', {
                shellToolCall: { args: { command: 'echo hello', workingDirectory: '/project' } },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'shell-fixture-1', {
                shellToolCall: {
                    args: { command: 'echo hello', workingDirectory: '/project' },
                    result: { success: { output: 'hello\n', exitCode: 0 } },
                },
            })
        ),
    },
    bashToolCall: {
        callId: 'bash-fixture-1',
        expectedName: 'Bash',
        started: line(
            toolCallEvent('started', 'bash-fixture-1', {
                bashToolCall: { args: { command: 'pwd', workingDirectory: '/project' } },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'bash-fixture-1', {
                bashToolCall: {
                    args: { command: 'pwd', workingDirectory: '/project' },
                    result: { success: { output: '/project\n', exitCode: 0 } },
                },
            })
        ),
    },
    todoToolCall: {
        callId: 'todo-fixture-1',
        expectedName: 'TodoWrite',
        started: line(
            toolCallEvent('started', 'todo-fixture-1', {
                todoToolCall: {
                    args: {
                        todos: [{ id: '1', content: 'Ship mapping', status: 'in_progress' }],
                        merge: true,
                    },
                },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'todo-fixture-1', {
                todoToolCall: {
                    args: {
                        todos: [{ id: '1', content: 'Ship mapping', status: 'in_progress' }],
                        merge: true,
                    },
                    result: { success: {} },
                },
            })
        ),
    },
    functionMcp: {
        callId: 'mcp-fixture-1',
        expectedName: 'mcp__gitnexus__query',
        started: line(
            toolCallEvent('started', 'mcp-fixture-1', {
                function: {
                    name: 'mcp__gitnexus__query',
                    arguments: JSON.stringify({ query: 'auth flow' }),
                },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'mcp-fixture-1', {
                function: {
                    name: 'mcp__gitnexus__query',
                    arguments: JSON.stringify({ query: 'auth flow' }),
                },
                result: { content: [{ type: 'text', text: 'ok' }] },
            })
        ),
    },
};
