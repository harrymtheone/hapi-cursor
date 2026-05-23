import { describe, it } from 'vitest'

// Wave-0 skeleton for Plan 03 (CLI loadConfig() cutover). Each describe.skip
// block names a pending behavior the active CLI configuration tests must
// cover once Plan 03 lands the loadConfig() DI cutover. Plan 03 will flip
// `.skip` to active suites.

// D-164: loadConfig() returns a deeply frozen config object.
describe.skip('cli/configuration loadConfig() — returns a deeply frozen config', () => {
    it.todo('top-level + nested objects are frozen (Object.isFrozen === true)')
})

// D-160: legacy `serverUrl` field must be rejected with a repair message
// directing operators to the canonical replacement.
describe.skip('cli/configuration loadConfig() — rejects legacy serverUrl field with repair message', () => {
    it.todo('throws an Error whose message names `serverUrl` and the replacement field')
})

// D-161: `WEBAPP_*` env vars must be rejected at load time (the rename in
// Plan 01 only fixes the CLI launcher; loadConfig() must hard-reject the
// stale names so they cannot silently misroute).
describe.skip('cli/configuration loadConfig() — rejects WEBAPP_* env vars', () => {
    it.todo('throws when WEBAPP_HOST / WEBAPP_PORT / WEBAPP_URL are set')
})

// D-167: malformed settings.json must surface the offending path in the
// thrown error so operators can repair the file in one step.
describe.skip('cli/configuration loadConfig() — throws on malformed settings.json with path in message', () => {
    it.todo('error message contains the absolute path to the offending settings.json')
})
