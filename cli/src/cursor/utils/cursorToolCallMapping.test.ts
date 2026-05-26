import { describe, expect, it } from 'vitest';
import {
    CURSOR_TOOL_KEY_TO_HAPI_NAME,
    findNativeToolCallVariant,
    resolveHapiToolName,
} from './cursorToolCallMapping';

describe('cursorToolCallMapping', () => {
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

    it('resolveHapiToolName uses function.name for MCP tools', () => {
        expect(
            resolveHapiToolName({
                function: { name: 'mcp__server__tool', arguments: '{}' },
            })
        ).toBe('mcp__server__tool');
    });

    it('resolveHapiToolName PascalCases unmapped *ToolCall keys', () => {
        expect(
            resolveHapiToolName({
                customWidgetToolCall: { args: { id: 1 } },
            })
        ).toBe('CustomWidget');
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
});
