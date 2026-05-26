export function normalizeAskUserQuestionArgs(args: Record<string, unknown>): Record<string, unknown> {
    const questions = args.questions;
    if (Array.isArray(questions) && questions.length > 0) {
        return { ...args, questions };
    }
    return { ...args };
}
