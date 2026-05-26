import { pickString } from './pickString';

export function normalizeNotebookEditArgs(args: Record<string, unknown>): Record<string, unknown> {
    const notebook_path = pickString(args, ['notebook_path', 'path']);
    const edit_mode = pickString(args, ['edit_mode', 'editMode', 'mode']);

    const normalized: Record<string, unknown> = { ...args };
    if (notebook_path) normalized.notebook_path = notebook_path;
    if (edit_mode) normalized.edit_mode = edit_mode;

    return normalized;
}
