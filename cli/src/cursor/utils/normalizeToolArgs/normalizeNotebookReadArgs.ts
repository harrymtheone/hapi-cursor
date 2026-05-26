import { pickString } from './pickString';

export function normalizeNotebookReadArgs(args: Record<string, unknown>): Record<string, unknown> {
    const notebook_path = pickString(args, ['notebook_path', 'path']);
    if (!notebook_path) return { ...args };
    return { ...args, notebook_path };
}
