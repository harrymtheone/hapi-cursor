export type AccessErrorReason = 'access-denied' | 'not-found'

export type AccessResult<T> =
    | { ok: true; value: T }
    | { ok: false; reason: AccessErrorReason }
