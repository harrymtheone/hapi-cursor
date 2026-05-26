import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CURSOR_TOOL_KEY_TO_HAPI_NAME,
    findNativeToolCallVariant,
    resetUnmappedToolCallWarningsForTests,
    resolveHapiToolName,
} from './cursorToolCallMapping';

describe('cursorToolCallMapping', () => {
    afterEach(() => {
        resetUnmappedToolCallWarningsForTests();
        vi.restoreAllMocks();
    });

    it('findNativeToolCallVariant returns grep variant args', () => {
        const found = findNativeToolCallVariant({
            grepToolCall: { args: { pattern: 'foo' } },
        });
        expect(found).toEqual({
            key: 'grepToolCall',
            variant: { args: { pattern: 'foo' } },
        });
    });

    it('maps grepToolCall to Grep and shell/bash to Bash', () => {
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.grepToolCall).toBe('Grep');
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.shellToolCall).toBe('Bash');
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.bashToolCall).toBe('Bash');
    });

    it('maps read/write to Read/Write knownTools keys', () => {
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.readToolCall).toBe('Read');
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.writeToolCall).toBe('Write');
    });

    it('maps priority tools per capture allowlist (D-05–D-07)', () => {
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.taskToolCall).toBe('Task');
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.agentToolCall).toBe('Agent');
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.subagentToolCall).toBe('Agent');
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.skillToolCall).toBe('Skill');
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.askUserQuestionToolCall).toBe('AskUserQuestion');
        expect(CURSOR_TOOL_KEY_TO_HAPI_NAME.notebookReadToolCall).toBe('NotebookRead');
    });

    it('resolveHapiToolName uses function.name for MCP tools', () => {
        expect(
            resolveHapiToolName({
                function: { name: 'mcp__server__tool', arguments: '{}' },
            })
        ).toBe('mcp__server__tool');
    });

    it('resolveHapiToolName PascalCases unmapped *ToolCall keys and warns once (D-08)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(
            resolveHapiToolName({
                customWidgetToolCall: { args: { id: 1 } },
            })
        ).toBe('CustomWidget');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toBe('[cursor-ndjson] unmapped: customWidgetToolCall');

        resolveHapiToolName({
            customWidgetToolCall: { args: { id: 2 } },
        });
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('resolveHapiToolName returns unknown for non-ToolCall shapes', () => {
        expect(resolveHapiToolName({ notATool: { args: {} } })).toBe('unknown');
    });

    it('prefers mapped readToolCall when read and write keys coexist', () => {
        expect(
            resolveHapiToolName({
                writeToolCall: { args: { path: '/b' } },
                readToolCall: { args: { path: '/a' } },
            })
        ).toBe('Read');
    });

    it('resolveHapiToolName maps taskToolCall to Task without unmapped warn', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(
            resolveHapiToolName({
                taskToolCall: { args: { description: 'x' } },
            })
        ).toBe('Task');
        expect(warn).not.toHaveBeenCalled();
    });

    it('resolveHapiToolName maps subagentToolCall to Agent not Subagent', () => {
        expect(
            resolveHapiToolName({
                subagentToolCall: { args: { prompt: 'go' } },
            })
        ).toBe('Agent');
    });

    it('infers NotebookEdit from editToolCall on .ipynb path', () => {
        expect(
            resolveHapiToolName({
                editToolCall: {
                    args: { path: '/project/notebook.ipynb' },
                },
            })
        ).toBe('NotebookEdit');
    });

    it('infers NotebookEdit from editToolCall result notebook cell message', () => {
        expect(
            resolveHapiToolName({
                editToolCall: {
                    args: { path: '/project/notebook.ipynb' },
                    result: {
                        success: {
                            message:
                                'The notebook cell at index 0 in /project/notebook.ipynb has been updated.',
                        },
                    },
                },
            })
        ).toBe('NotebookEdit');
    });

    it('maps non-ipynb editToolCall to Edit (regression)', () => {
        expect(
            resolveHapiToolName({
                editToolCall: { args: { path: '/project/file.ts' } },
            })
        ).toBe('Edit');
    });
});
