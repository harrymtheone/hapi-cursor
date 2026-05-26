import { describe, expect, it } from 'vitest';
import {
    normalizeAgentArgs,
    normalizeAskUserQuestionArgs,
    normalizeNotebookEditArgs,
    normalizeNotebookReadArgs,
    normalizeSkillArgs,
    normalizeTaskArgs,
    normalizeToolInputForName,
} from './index';

describe('normalizeToolArgs', () => {
    it('normalizeTaskArgs maps task_description to description', () => {
        expect(normalizeTaskArgs({ task_description: 'x' })).toMatchObject({
            description: 'x',
        });
    });

    it('normalizeTaskArgs preserves prompt and maps subagentType string', () => {
        expect(
            normalizeTaskArgs({
                description: 'd',
                prompt: 'p',
                subagentType: 'explore',
            })
        ).toMatchObject({
            description: 'd',
            prompt: 'p',
            subagent_type: 'explore',
        });
    });

    it('normalizeAgentArgs preserves prompt and subagent_type', () => {
        expect(
            normalizeAgentArgs({ prompt: 'go', subagent_type: 'explore' })
        ).toMatchObject({
            prompt: 'go',
            subagent_type: 'explore',
        });
    });

    it('normalizeAgentArgs maps subagentType camelCase', () => {
        expect(normalizeAgentArgs({ prompt: 'go', subagentType: 'explore' })).toMatchObject({
            prompt: 'go',
            subagent_type: 'explore',
        });
    });

    it('normalizeNotebookReadArgs maps path to notebook_path', () => {
        expect(normalizeNotebookReadArgs({ path: '/a.ipynb' })).toMatchObject({
            notebook_path: '/a.ipynb',
        });
    });

    it('normalizeNotebookEditArgs maps path to notebook_path', () => {
        expect(
            normalizeNotebookEditArgs({ path: '/a.ipynb', edit_mode: 'replace' })
        ).toMatchObject({
            notebook_path: '/a.ipynb',
            edit_mode: 'replace',
        });
    });

    it('normalizeSkillArgs sets skill from aliases', () => {
        expect(normalizeSkillArgs({ skill: 'gitnexus-exploring' })).toMatchObject({
            skill: 'gitnexus-exploring',
        });
    });

    it('normalizeAskUserQuestionArgs preserves questions array', () => {
        const questions = [{ question: 'Q?' }];
        expect(normalizeAskUserQuestionArgs({ questions })).toMatchObject({ questions });
    });

    it('normalizeToolInputForName dispatches by HAPI name', () => {
        expect(
            normalizeToolInputForName('Task', 'taskToolCall', { task_description: 'x' })
        ).toMatchObject({ description: 'x' });
        expect(normalizeToolInputForName('Grep', 'grepToolCall', { pattern: 'a' })).toEqual({
            pattern: 'a',
        });
    });
});
