/**
 * Result types shared by SyncEngineSession + SyncEngineSessionResume.
 *
 * Lives in its own module to keep both files clear of duplicate exports and
 * to satisfy the SC#1 < 400 line budget on syncEngineSession.ts.
 */
import type { LocalResumeTarget } from '@hapi/protocol'

export type ResumeSessionResult =
    | { type: 'success'; sessionId: string }
    | { type: 'error'; message: string; code: 'session_not_found' | 'no_machine_online' | 'resume_unavailable' | 'resume_failed' }

export type LocalResumeTargetResult =
    | { type: 'success'; target: LocalResumeTarget }
    | { type: 'error'; message: string; code: 'session_not_found' | 'resume_unavailable' }

export type LocalHandoffResult =
    | { type: 'success' }
    | { type: 'error'; message: string; code: 'session_not_found' | 'already_local' | 'handoff_failed' }
