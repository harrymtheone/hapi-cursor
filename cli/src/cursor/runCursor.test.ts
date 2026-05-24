import { describe, it, expect, vi } from 'vitest';
import { applyCursorSessionConfig, resolvePermissionMode } from './runCursor';
import { UnknownPermissionModeError } from '@hapi/protocol/modes';

describe('resolvePermissionMode (RPC-boundary regression sentry — D-104 #3b / VALIDATION dim 3)', () => {
    it('throws UnknownPermissionModeError for invalid string payload', () => {
        expect(() => resolvePermissionMode('weird')).toThrow(UnknownPermissionModeError);

        let caught: unknown;
        try {
            resolvePermissionMode('weird');
        } catch (e) {
            caught = e;
        }
        expect(caught instanceof UnknownPermissionModeError).toBe(true);
        expect((caught as UnknownPermissionModeError).offendingMode).toBe('weird');
    });

    it('throws UnknownPermissionModeError with JSON-stringified payload for non-string input', () => {
        const payload = { not: 'a string' };
        let caught: unknown;
        try {
            resolvePermissionMode(payload);
        } catch (e) {
            caught = e;
        }
        expect(caught instanceof UnknownPermissionModeError).toBe(true);
        expect((caught as UnknownPermissionModeError).offendingMode).toBe(JSON.stringify(payload));
    });

    it('returns the validated PermissionMode for valid cursor mode', () => {
        expect(resolvePermissionMode('plan')).toBe('plan');
    });
});

describe('applyCursorSessionConfig', () => {
    it('keeps permission mode changes applied through the existing runtime path', () => {
        const syncPermissionMode = vi.fn();

        const result = applyCursorSessionConfig(
            { permissionMode: 'plan' },
            {
                currentPermissionMode: 'default',
                currentModel: 'cursor-runtime-model-raw-id',
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toEqual({ applied: { permissionMode: 'plan' } });
        expect(syncPermissionMode).toHaveBeenCalledWith('plan');
    });

    it('strips unsupported effort fields from runtime config acknowledgements', () => {
        const syncPermissionMode = vi.fn();

        const result = applyCursorSessionConfig(
            {
                model: 'cursor-runtime-model-next',
                modelReasoningEffort: 'medium',
                effort: 'background'
            },
            {
                currentPermissionMode: 'default',
                currentModel: 'cursor-runtime-model-current',
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toEqual({
            status: 'applies-next-run',
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        });
        expect(syncPermissionMode).not.toHaveBeenCalled();
    });

    it('does not treat unsupported effort-only payloads as runtime config changes', () => {
        const syncPermissionMode = vi.fn();

        const result = applyCursorSessionConfig(
            { modelReasoningEffort: 'medium', effort: 'background' },
            {
                currentPermissionMode: 'default',
                currentModel: 'cursor-runtime-model-current',
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toEqual({
            status: 'failed',
            model: 'cursor-runtime-model-current',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        });
        expect(syncPermissionMode).not.toHaveBeenCalled();
    });

    it('does not persist effort-only payloads as runtime config changes', () => {
        const syncPermissionMode = vi.fn();

        const result = applyCursorSessionConfig(
            { effort: 'high' },
            {
                currentPermissionMode: 'default',
                currentModel: 'cursor-runtime-model-current',
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toEqual({
            status: 'failed',
            model: 'cursor-runtime-model-current',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        });
        expect(result).not.toEqual({ applied: { permissionMode: 'default' } });
        expect(syncPermissionMode).not.toHaveBeenCalled();
    });

    it('reports model changes as applies-next-run without claiming active hot switch', () => {
        const syncPermissionMode = vi.fn();

        const result = applyCursorSessionConfig(
            { model: 'cursor-runtime-model-next' },
            {
                currentPermissionMode: 'default',
                currentModel: 'cursor-runtime-model-current',
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toEqual({
            status: 'applies-next-run',
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        });
        expect(syncPermissionMode).not.toHaveBeenCalled();
    });

    it('rejects invalid model payloads before runtime mutation', () => {
        expect(() => applyCursorSessionConfig(
            { model: 123 },
            {
                currentPermissionMode: 'default',
                currentModel: null,
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode: vi.fn()
            }
        )).toThrow('Invalid session config payload');
    });

    it('mutates current model via syncModel callback on applies-next-run model branch', () => {
        const syncPermissionMode = vi.fn();
        const syncModel = vi.fn();
        const state = {
            currentPermissionMode: 'default' as const,
            currentModel: 'cursor-runtime-model-current',
            currentModelReasoningEffort: null,
            currentEffort: null,
            syncPermissionMode,
            syncModel
        };

        const result = applyCursorSessionConfig({ model: 'cursor-runtime-model-next' }, state);

        expect(result).toEqual({
            status: 'applies-next-run',
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        });
        expect(syncModel).toHaveBeenCalledTimes(1);
        expect(syncModel).toHaveBeenCalledWith('cursor-runtime-model-next');
        expect(syncPermissionMode).not.toHaveBeenCalled();

        syncModel.mockClear();
        const clearResult = applyCursorSessionConfig({ model: null }, state);
        expect(clearResult).toMatchObject({ status: 'applies-next-run', model: null });
        expect(syncModel).toHaveBeenCalledTimes(1);
        expect(syncModel).toHaveBeenCalledWith(null);
    });

    it('syncModel is independent of syncPermissionMode (permission-only payload does not call syncModel)', () => {
        const syncPermissionMode = vi.fn();
        const syncModel = vi.fn();
        const state = {
            currentPermissionMode: 'default' as const,
            currentModel: 'cursor-runtime-model-current',
            currentModelReasoningEffort: null,
            currentEffort: null,
            syncPermissionMode,
            syncModel
        };

        const result = applyCursorSessionConfig({ permissionMode: 'plan' }, state);

        expect(result).toEqual({ applied: { permissionMode: 'plan' } });
        expect(syncPermissionMode).toHaveBeenCalledWith('plan');
        expect(syncModel).not.toHaveBeenCalled();
    });

    it('does not emit timeline events for model status results', () => {
        const syncPermissionMode = vi.fn();
        const sendSessionEvent = vi.fn();

        const result = applyCursorSessionConfig(
            { model: 'cursor-runtime-model-next' },
            {
                currentPermissionMode: 'default',
                currentModel: null,
                currentModelReasoningEffort: null,
                currentEffort: null,
                syncPermissionMode
            }
        );

        expect(result).toMatchObject({ status: 'applies-next-run' });
        expect(sendSessionEvent).not.toHaveBeenCalled();
    });
});
