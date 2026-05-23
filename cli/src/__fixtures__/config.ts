/**
 * Test config factory (Plan 10-03, PATTERNS §"Shared #6" / D-170).
 *
 * `makeConfig(overrides?)` returns a deeply-frozen `Config` literal with safe
 * test defaults. Used by tests that previously called
 * `vi.mock('@/configuration', ...)` against the deleted singleton — the
 * cutover replaces those mocks with constructor-injected fixtures.
 *
 * All fields are non-secret literals scoped under `/tmp/.hapi-test/` so the
 * fixture is unmistakably non-production (threat T-10-03-06).
 */

import type { Config } from '@/configuration'

const DEFAULT_TEST_CONFIG: Config = Object.freeze({
    apiUrl: 'http://localhost:3006',
    cliApiToken: 'test-token',
    extraHeaders: Object.freeze({}) as Readonly<Record<string, string>>,
    isRunnerProcess: false,
    happyHomeDir: '/tmp/.hapi-test',
    logsDir: '/tmp/.hapi-test/logs',
    settingsFile: '/tmp/.hapi-test/settings.json',
    privateKeyFile: '/tmp/.hapi-test/access.key',
    runnerStateFile: '/tmp/.hapi-test/runner.state.json',
    runnerLockFile: '/tmp/.hapi-test/runner.state.json.lock',
    currentCliVersion: '0.0.0-test',
    isExperimentalEnabled: false,
})

export function makeConfig(overrides: Partial<Config> = {}): Config {
    const merged: Config = {
        ...DEFAULT_TEST_CONFIG,
        ...overrides,
        extraHeaders: Object.freeze({
            ...DEFAULT_TEST_CONFIG.extraHeaders,
            ...(overrides.extraHeaders ?? {})
        }) as Readonly<Record<string, string>>,
    }
    return Object.freeze(merged)
}
