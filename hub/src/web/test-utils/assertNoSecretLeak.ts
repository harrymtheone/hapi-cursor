import { expect } from 'bun:test'

/**
 * REFT-03 / D-186 — Shared no-leak invariant for hub/web auth tests.
 *
 * Asserts that none of the supplied `secrets` appear in either the HTTP
 * response body (raw string) or any captured `console.*` log line. Falsy /
 * empty secrets are skipped defensively so that callers cannot trigger a
 * vacuous `''.includes('')` true-positive when a fixture is misconfigured.
 *
 * Parameters:
 * - `responseBody`: the raw response body string (e.g. `await res.text()`).
 * - `capturedLogs`: lines collected from a `console.{log,warn,error}` spy.
 * - `secrets`: the literal secret values that MUST NOT leak (e.g. the CLI
 *   access token, the JWT signing secret in its raw form, etc.).
 *
 * Pure: no I/O, no state, side effects limited to `expect()` calls.
 */
export function assertNoSecretLeak(
    responseBody: string,
    capturedLogs: string[],
    secrets: ReadonlyArray<string>
): void {
    for (const secret of secrets) {
        if (!secret) continue
        expect(responseBody).not.toContain(secret)
        for (const line of capturedLogs) {
            expect(line).not.toContain(secret)
        }
    }
}
