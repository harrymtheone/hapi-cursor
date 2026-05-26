import { normalizeAgentArgs } from './normalizeAgentArgs';
import { normalizeAskUserQuestionArgs } from './normalizeAskUserQuestionArgs';
import { normalizeNotebookEditArgs } from './normalizeNotebookEditArgs';
import { normalizeNotebookReadArgs } from './normalizeNotebookReadArgs';
import { normalizeSkillArgs } from './normalizeSkillArgs';
import { normalizeTaskArgs } from './normalizeTaskArgs';

export function normalizeToolInputForName(
    hapiName: string,
    _nativeKey: string,
    args: Record<string, unknown>
): Record<string, unknown> {
    switch (hapiName) {
        case 'Task':
            return normalizeTaskArgs(args);
        case 'Agent':
            return normalizeAgentArgs(args);
        case 'NotebookRead':
            return normalizeNotebookReadArgs(args);
        case 'NotebookEdit':
            return normalizeNotebookEditArgs(args);
        case 'Skill':
            return normalizeSkillArgs(args);
        case 'AskUserQuestion':
            return normalizeAskUserQuestionArgs(args);
        default:
            return args;
    }
}

export { normalizeAgentArgs } from './normalizeAgentArgs';
export { normalizeAskUserQuestionArgs } from './normalizeAskUserQuestionArgs';
export { normalizeNotebookEditArgs } from './normalizeNotebookEditArgs';
export { normalizeNotebookReadArgs } from './normalizeNotebookReadArgs';
export { normalizeSkillArgs } from './normalizeSkillArgs';
export { normalizeTaskArgs } from './normalizeTaskArgs';
