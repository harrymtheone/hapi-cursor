/**
 * Redacted real-sample + evidence-shaped synthetic Cursor NDJSON fixtures (Phase 01.3 capture).
 *
 * Capture session: 13e5b3cd-2437-4395-a87a-53a8536b5b72 (~/.hapi/cursor-ndjson-capture/)
 *
 * Wire evidence:
 * - taskToolCall: started+completed (description, prompt, subagentType camelCase, model, agentId)
 * - editToolCall on .ipynb: EditNotebook maps to editToolCall (not notebook*ToolCall); infer NotebookEdit in 01.3-02/03
 *
 * Zero wire in capture (synthetic fixtures below): agentToolCall, subagentToolCall, skillToolCall,
 * askUserQuestionToolCall, notebookReadToolCall
 */

import type { CursorToolCallFixture } from './cursorToolCallNdjson';
import { CURSOR_TOOL_CALL_NDJSON_FIXTURES } from './cursorToolCallNdjson';

export type CapturedToolCallFixture = CursorToolCallFixture & {
    /** When true, converter test skipped until Plan 01.3-02 mapping/normalizers land */
    pendingMapping?: boolean;
    /** Human note for SUMMARY / planner */
    captureNote?: string;
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
        session_id: 'captured-fixture-session',
    };
}

/** Re-export base helper pattern for captured-only variants */
export { line, toolCallEvent };

export const CURSOR_TOOL_CALL_NDJSON_CAPTURED_FIXTURES: Record<string, CapturedToolCallFixture> = {
    taskToolCall: {
        callId: 'tool_78f77005-c356-49de-9333-b2b4958e555',
        expectedName: 'Task',
        captureNote: 'Captured wire; subagentType is camelCase on args',
        started: line(
            toolCallEvent('started', 'tool_78f77005-c356-49de-9333-b2b4958e555', {
                taskToolCall: {
                    args: {
                        description: '01.3-capture-task',
                        prompt: "在 cli/src/cursor/utils 里 rg 'ToolCall'，只输出匹配行数，不要改文件",
                        subagentType: { unspecified: {} },
                        model: 'composer-2.5-fast',
                        agentId: '3e57e1fa-cbf4-4263-8d12-90fe7f93d4b7',
                        attachments: [],
                        mode: 'TASK_MODE_UNSPECIFIED',
                        respondingToMessageIds: [],
                        environment: 'SUBAGENT_EXECUTION_ENVIRONMENT_UNSPECIFIED',
                    },
                },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'tool_78f77005-c356-49de-9333-b2b4958e555', {
                taskToolCall: {
                    args: {
                        description: '01.3-capture-task',
                        prompt: "在 cli/src/cursor/utils 里 rg 'ToolCall'，只输出匹配行数，不要改文件",
                        subagentType: { unspecified: {} },
                        model: 'composer-2.5-fast',
                        agentId: '3e57e1fa-cbf4-4263-8d12-90fe7f93d4b7',
                    },
                    result: {
                        success: {
                            conversationSteps: [],
                        },
                    },
                },
            })
        ),
    },

    editToolCall_ipynb_notebookEdit: {
        callId: 'tool_2c9e8e70-eabf-40b4-96e8-3e604ead25f',
        expectedName: 'NotebookEdit',
        captureNote:
            'Captured EditNotebook uses editToolCall on .ipynb; Plan 01.3-02 infers NotebookEdit from path + cell result message',
        started: line(
            toolCallEvent('started', 'tool_2c9e8e70-eabf-40b4-96e8-3e604ead25f', {
                editToolCall: {
                    args: {
                        path: '/project/fixtures/capture-test.ipynb',
                        streamContent: '# capture\nedited-01.3-capture',
                    },
                },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'tool_2c9e8e70-eabf-40b4-96e8-3e604ead25f', {
                editToolCall: {
                    args: {
                        path: '/project/fixtures/capture-test.ipynb',
                        streamContent: '# capture\nedited-01.3-capture',
                    },
                    result: {
                        success: {
                            path: '/project/fixtures/capture-test.ipynb',
                            linesAdded: 1,
                            linesRemoved: 0,
                            message:
                                'The notebook cell at index 0 in /project/fixtures/capture-test.ipynb has been updated.',
                        },
                    },
                },
            })
        ),
    },

    subagentToolCall: {
        callId: 'captured-subagent-fixture-1',
        expectedName: 'Agent',
        captureNote: 'Synthetic — zero agentToolCall/subagentToolCall wire in capture session',
        started: line(
            toolCallEvent('started', 'captured-subagent-fixture-1', {
                subagentToolCall: {
                    args: {
                        prompt: '只执行: rg -c subagent_type web/src/chat --glob *.ts',
                        subagent_type: 'generalPurpose',
                    },
                },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'captured-subagent-fixture-1', {
                subagentToolCall: {
                    args: {
                        prompt: '只执行: rg -c subagent_type web/src/chat --glob *.ts',
                        subagent_type: 'generalPurpose',
                    },
                    result: { success: { output: 'done' } },
                },
            })
        ),
    },

    skillToolCall: {
        callId: 'captured-skill-fixture-1',
        expectedName: 'Skill',
        captureNote: 'Synthetic — Skill tool not exposed in capture; name via PascalCase until allowlist in 01.3-02',
        started: line(
            toolCallEvent('started', 'captured-skill-fixture-1', {
                skillToolCall: {
                    args: { skill: 'gitnexus-exploring' },
                },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'captured-skill-fixture-1', {
                skillToolCall: {
                    args: { skill: 'gitnexus-exploring' },
                    result: { success: {} },
                },
            })
        ),
    },

    askUserQuestionToolCall: {
        callId: 'captured-ask-fixture-1',
        expectedName: 'AskUserQuestion',
        captureNote: 'Synthetic — zero askUserQuestionToolCall wire in capture; name via PascalCase',
        started: line(
            toolCallEvent('started', 'captured-ask-fixture-1', {
                askUserQuestionToolCall: {
                    args: {
                        questions: [
                            {
                                question: 'Proceed with fixture commit?',
                                options: [{ id: 'yes', label: 'Yes' }],
                            },
                        ],
                    },
                },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'captured-ask-fixture-1', {
                askUserQuestionToolCall: {
                    args: {
                        questions: [
                            {
                                question: 'Proceed with fixture commit?',
                                options: [{ id: 'yes', label: 'Yes' }],
                            },
                        ],
                    },
                    result: { success: { answers: [{ id: 'yes' }] } },
                },
            })
        ),
    },

    notebookReadToolCall: {
        callId: 'captured-notebook-read-fixture-1',
        expectedName: 'NotebookRead',
        captureNote: 'Synthetic — zero notebook*ToolCall wire; name via PascalCase until allowlist',
        started: line(
            toolCallEvent('started', 'captured-notebook-read-fixture-1', {
                notebookReadToolCall: {
                    args: { notebook_path: '/project/fixtures/capture-test.ipynb' },
                },
            })
        ),
        completed: line(
            toolCallEvent('completed', 'captured-notebook-read-fixture-1', {
                notebookReadToolCall: {
                    args: { notebook_path: '/project/fixtures/capture-test.ipynb' },
                    result: { success: { cellCount: 1 } },
                },
            })
        ),
    },
};

/** Fixtures ready for green converter tests in Plan 01.3-01 (PascalCase / existing map only) */
export const CAPTURED_FIXTURES_MAPPING_READY = Object.entries(
    CURSOR_TOOL_CALL_NDJSON_CAPTURED_FIXTURES
).filter(([, f]) => !f.pendingMapping);

/** All captured keys for Plan 01.3-02 allowlist work */
export const CAPTURED_NATIVE_KEYS = Object.keys(CURSOR_TOOL_CALL_NDJSON_CAPTURED_FIXTURES);

// Re-export synthetic baseline for tests that need a known-good editToolCall (non-ipynb)
export const SYNTHETIC_EDIT_BASELINE = CURSOR_TOOL_CALL_NDJSON_FIXTURES.editToolCall;
