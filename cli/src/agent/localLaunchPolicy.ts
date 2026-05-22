/**
 * @implements LaunchPolicy (Phase 6 SC#1)
 *
 * Concept-position anchor for the shared agent-runtime kit. This module is the
 * LaunchPolicy leaf in the four-concept shared-kit lattice. The file body is
 * intentionally unchanged (Phase 6 CONTEXT D-93); identification is via this
 * JSDoc anchor and grep.
 */

export type StartedBy = 'runner' | 'terminal';

export type LocalLaunchExitReason = 'switch' | 'exit';

export type LocalLaunchContext = {
    startedBy?: StartedBy;
    startingMode?: 'local' | 'remote';
};

export function getLocalLaunchExitReason(context: LocalLaunchContext): LocalLaunchExitReason {
    if (context.startedBy === 'runner' || context.startingMode === 'remote') {
        return 'switch';
    }

    return 'exit';
}
