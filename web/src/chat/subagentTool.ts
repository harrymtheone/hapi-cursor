/**
 * Returns true when the tool name identifies a subagent invocation.
 *
 * The agent SDK has used two names for the same concept:
 *   - 'Task'  — earlier SDK releases
 *   - 'Agent' — later SDK releases
 *
 * Both share the same input shape: { prompt: string, subagent_type: string }.
 * The tracer, reducer, and UI surfaces must treat them identically.
 * Keeping both ensures sessions recorded under either name continue to work.
 */
export function isSubagentToolName(name: string): boolean {
    return name === 'Task' || name === 'Agent'
}
