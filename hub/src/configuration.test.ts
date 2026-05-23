import { describe, it } from 'bun:test'

// Wave-0 skeleton for Plan 02 (Hub loadConfig() cutover). Each describe.skip
// block names a pending behavior the active hub configuration tests must
// cover once Plan 02 lands the loadConfig() DI cutover. Plan 02 will flip
// `.skip` to active suites.

// D-164: loadConfig() returns a deeply frozen config object.
describe.skip('hub/configuration loadConfig() — returns a deeply frozen config', () => {
    it('top-level + nested objects are frozen (Object.isFrozen === true)', () => {
        // Plan 02 will implement this assertion.
    })
})

// D-161: `WEBAPP_*` env vars must be rejected at load time so a stale env
// cannot silently re-route the hub to an unintended interface.
describe.skip('hub/configuration loadConfig() — rejects WEBAPP_* env vars', () => {
    it('throws when WEBAPP_HOST / WEBAPP_PORT / WEBAPP_ORIGIN are set', () => {
        // Plan 02 will implement this assertion.
    })
})
