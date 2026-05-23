# Phase 10: Config cleanup - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 17 new/modified production files + 6 new/rewritten tests + 1 guard script
**Analogs found:** 17 / 17 (every target has an in-repo analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `cli/src/configuration.ts` (rewrite) | config / factory | startup batch | `hub/src/configuration.ts::Configuration.create` + `hub/src/config/serverSettings.ts` | exact (sibling) |
| `hub/src/configuration.ts` (rewrite) | config / factory | startup batch | `hub/src/config/serverSettings.ts::loadServerSettings` | exact |
| `hub/src/config/serverSettings.ts` (extend) | config helper | startup batch | itself (existing `rejectOldSettingsFields`) | exact (extend in place) |
| `cli/src/persistence.ts` (modify) | utility / persistence | file I/O | `hub/src/config/settings.ts` (`readSettingsOrThrow`, `writeSettings`) | exact |
| `cli/src/ui/tokenInit.ts` (refactor → `bootstrapToken`) | bootstrap / UI prompt | request-response (interactive) | itself (current `initializeToken`) | exact (in-place) |
| `cli/src/ui/apiUrlInit.ts` | bootstrap | — | DELETED (folded into `loadConfig`) | n/a |
| `cli/src/commands/registry.ts` (modify) | command router | request-response | itself (extend `resolveCommand`) | exact (in-place) |
| `cli/src/commands/hub.ts` (bug fix) | command launcher | startup batch | itself (env-name rename) | exact (in-place) |
| `cli/src/commands/types.ts` (extend `CommandContext`) | type | — | itself | exact (in-place) |
| `cli/src/commands/runCli.ts` *or* `cli/src/index.ts` (entry) | CLI entry / DI root | startup batch | `hub/src/index.ts::main` | role-match |
| `cli/src/lib.ts` (replace exports) | library public surface | — | itself | exact (in-place breaking change) |
| `cli/src/api/api.ts` (DI cutover) | service / HTTP client | request-response | `hub/src/notifications/notificationHub.ts` constructor DI from Phase 8 | role-match |
| `cli/src/api/apiSession.ts`, `apiMachine.ts`, `auth.ts`, `hubExtraHeaders.ts` (DI cutover) | service | request-response | same as above | role-match |
| `cli/src/runner/run.ts`, `runner/controlClient.ts`, `agent/sessionFactory.ts`, `ui/{logger,doctor,auth}.ts`, `utils/autoStartServer.ts`, `projectPath.ts`, `modules/common/hooks/generateHookSettings.ts`, `commands/auth.ts` (DI cutover) | service / utility | mixed | constructor-DI / function-arg DI per `hub/src/notifications/notificationHub.ts` + `hub/src/web/server.ts` options bag | role-match |
| `hub/src/config/jwtSecret.ts` (DI: accept `dataDir`) | config loader | file I/O | itself (drop `getConfiguration()`) | exact (in-place) |
| `hub/src/config/ownerId.ts` (DI: accept `dataDir`) | config loader | file I/O | itself | exact (in-place) |
| `hub/src/web/server.ts`, `hub/src/socket/server.ts`, `hub/src/web/routes/{cli,auth}.ts` (DI cutover) | service | request-response | same files (extend options bag) | exact (in-place) |
| `hub/src/index.ts` (main: load once, thread through) | entry / DI root | startup batch | itself | exact (in-place) |
| `hub/src/store/index.ts` | persistence | — | unchanged — already rejects schema mismatch | exact |
| `scripts/check-no-cut-agents.sh` (extend Phase-10 block) | guard | — | Phase-8 + Phase-9 blocks in same file | exact (in-place) |
| **Tests (Wave 0):** `cli/src/configuration.test.ts`, `hub/src/configuration.test.ts`, `cli/src/commands/registry.test.ts`, `hub/src/store/index.test.ts` (if absent), augment `cli/src/runner/runner.integration.test.ts` | test | — | `hub/src/config/serverSettings.test.ts` style | role-match |
| **Tests (rewrite — drop singleton mocks):** `cli/src/api/api.extraHeaders.test.ts`, `cli/src/api/hubExtraHeaders.test.ts`, `cli/src/commands/auth.test.ts`, `cli/src/commands/resume.test.ts`, `hub/src/web/routes/cli.test.ts` | test | — | factory-fixture style — see "Shared Pattern: Test Config Factory" | role-match |

---

## Pattern Assignments

### `hub/src/configuration.ts` rewrite (config factory, startup batch)

**Analog:** `hub/src/config/serverSettings.ts` (same package, identical role of "load + validate + reject legacy + return frozen result").

**Imports pattern** — copy the existing Hub-side import shape and add a deep-freeze helper:

```13:24:hub/src/configuration.ts
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getOrCreateCliApiToken } from './config/cliApiToken'
import { getSettingsFile } from './config/settings'
import { loadServerSettings, type ServerSettings, type ServerSettingsResult } from './config/serverSettings'
```

**Legacy-field-rejection pattern** (the canonical analog — Phase 10 extends this exact helper to add env-var rejection and to feed the CLI mirror):

```77:86:hub/src/config/serverSettings.ts
function rejectOldSettingsFields(settings: object, settingsFile: string): void {
    const oldFields = OLD_SETTINGS_FIELDS.filter((field) => field in settings)
    if (oldFields.length === 0) {
        return
    }
    throw new Error(
        `Unsupported old settings field(s) in ${settingsFile}: ${oldFields.join(', ')}. ` +
        'Use listenHost, listenPort, and publicUrl.'
    )
}
```

**Malformed-settings fail-fast pattern** (analog for D-167, both Hub and CLI):

```43:51:hub/src/config/settings.ts
export async function readSettingsOrThrow(settingsFile: string): Promise<Settings> {
    const settings = await readSettings(settingsFile)
    if (settings === null) {
        throw new Error(
            `Cannot read ${settingsFile}. Please fix or remove the file and restart.`
        )
    }
    return settings
}
```

**Async factory shape to *replace*** (current Hub singleton — delete this class and the `_setCliApiToken` setter):

```103:148:hub/src/configuration.ts
    static async create(): Promise<Configuration> {
        // 1. Determine data directory (env only - not persisted)
        const dataDir = process.env.HAPI_HOME
            ? process.env.HAPI_HOME.replace(/^~/, homedir())
            : join(homedir(), '.hapi')
        // ...
        const settingsResult = await loadServerSettings(dataDir)
        // ...
        const config = new Configuration(...)
        const tokenResult = await getOrCreateCliApiToken(dataDir)
        config._setCliApiToken(tokenResult.token, tokenResult.source, tokenResult.isNew)
        return config
    }
```

**Target shape (proposed)** — plain `loadConfig()` returning deep-frozen `Config`:

```typescript
export type Config = Readonly<{
    dataDir: string
    dbPath: string
    settingsFile: string
    listenHost: string
    listenPort: number
    publicUrl: string
    corsOrigins: readonly string[]
    cliApiToken: string
    cliApiTokenSource: 'env' | 'file' | 'generated'
    cliApiTokenIsNew: boolean
    sources: Readonly<ConfigSources>
}>

export async function loadConfig(): Promise<Config> {
    const dataDir = process.env.HAPI_HOME ? ... : join(homedir(), '.hapi')
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
    const dbPath = process.env.DB_PATH ? ... : join(dataDir, 'hapi.db')
    rejectOldEnvVars()                                            // new helper, D-161
    const { settings, sources, savedToFile } = await loadServerSettings(dataDir)
    const tokenResult = await getOrCreateCliApiToken(dataDir)
    return deepFreeze({
        dataDir, dbPath, settingsFile: getSettingsFile(dataDir),
        listenHost: settings.listenHost,
        listenPort: settings.listenPort,
        publicUrl: settings.publicUrl,
        corsOrigins: Object.freeze([...settings.corsOrigins]),
        cliApiToken: tokenResult.token,
        cliApiTokenSource: tokenResult.source,
        cliApiTokenIsNew: tokenResult.isNew,
        sources: Object.freeze({ ...sources, cliApiToken: tokenResult.source }),
    }) as Config
}
```

---

### `cli/src/configuration.ts` rewrite (config factory, startup batch)

**Analog (sibling):** `hub/src/configuration.ts::Configuration.create` for shape; **`hub/src/config/serverSettings.ts::rejectOldSettingsFields`** for the legacy-rejection helper.

**Current singleton to *replace*** (delete the class and the three `_set*` setters):

```42:122:cli/src/configuration.ts
class Configuration {
    private _apiUrl: string
    private _cliApiToken: string
    private _extraHeaders: Record<string, string>
    // ...
    _setApiUrl(url: string): void { this._apiUrl = url }
    _setCliApiToken(token: string): void { this._cliApiToken = token }
    _setExtraHeaders(headers: Record<string, string>): void {
        this._extraHeaders = { ...headers }
    }
}
export const configuration: Configuration = new Configuration()
```

**Current silent-migration logic to *delete*** (this is the REFC-01 + REFC-02 overlap — the entire branch must move from silent-migrate to throw-with-repair-message):

```17:36:cli/src/ui/apiUrlInit.ts
export async function initializeApiUrl(): Promise<void> {
    if (process.env.HAPI_API_URL) return
    const settings = await readSettings()
    if (settings.apiUrl) {
        configuration._setApiUrl(settings.apiUrl)
        return
    }
    if (settings.serverUrl) {
        // Migrate from legacy field name
        configuration._setApiUrl(settings.serverUrl)
        return
    }
}
```

**Pattern to *copy*** — mirror `rejectOldSettingsFields` on the CLI side:

```typescript
const OLD_CLI_SETTINGS_FIELDS = ['serverUrl'] as const

function rejectOldCliSettingsFields(settings: object, settingsFile: string): void {
    const old = OLD_CLI_SETTINGS_FIELDS.filter((f) => f in settings)
    if (old.length === 0) return
    throw new Error(
        `Unsupported legacy field(s) in ${settingsFile}: ${old.join(', ')}. ` +
        `Rename "serverUrl" to "apiUrl" and restart.`
    )
}
```

**`extraHeaders` parsing pattern** — keep `parseExtraHeaders` (already exported, pure function); it just gets called inside `loadConfig()` rather than the class constructor:

```14:40:cli/src/configuration.ts
export function parseExtraHeaders(raw: string | undefined, warn: ...): Record<string, string> {
    if (!raw) return {}
    try {
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            warn('[WARN] HAPI_EXTRA_HEADERS_JSON must be a JSON object. Ignoring value.')
            return {}
        }
        // ...
    } catch { ... }
}
```

**Target `loadConfig()` shape (proposed)**:

```typescript
export type Config = Readonly<{
    apiUrl: string
    cliApiToken: string
    extraHeaders: Readonly<Record<string, string>>
    isRunnerProcess: boolean
    happyHomeDir: string
    logsDir: string
    settingsFile: string
    privateKeyFile: string
    runnerStateFile: string
    runnerLockFile: string
    currentCliVersion: string
    isExperimentalEnabled: boolean
}>

export async function loadConfig(opts?: { argv?: string[] }): Promise<Config> {
    const happyHomeDir = process.env.HAPI_HOME
        ? process.env.HAPI_HOME.replace(/^~/, homedir())
        : join(homedir(), '.hapi')
    mkdirSync(happyHomeDir, { recursive: true })
    const logsDir = join(happyHomeDir, 'logs')
    mkdirSync(logsDir, { recursive: true })
    const settingsFile = join(happyHomeDir, 'settings.json')

    rejectOldEnvVars()                              // D-161 (shared helper, see below)

    let apiUrl = process.env.HAPI_API_URL || 'http://localhost:3006'
    let cliApiToken = process.env.CLI_API_TOKEN || ''
    if (existsSync(settingsFile)) {
        const raw = await readFile(settingsFile, 'utf8').catch(() => null)
        if (raw === null) throw new Error(`Cannot read ${settingsFile}. ...`)
        let parsed: Record<string, unknown>
        try { parsed = JSON.parse(raw) } catch {
            throw new Error(`Cannot read ${settingsFile}. ...`)        // D-167
        }
        rejectOldCliSettingsFields(parsed, settingsFile)               // D-160
        if (!process.env.HAPI_API_URL && typeof parsed.apiUrl === 'string') apiUrl = parsed.apiUrl
        if (!process.env.CLI_API_TOKEN && typeof parsed.cliApiToken === 'string') cliApiToken = parsed.cliApiToken
    }

    const args = opts?.argv ?? getCliArgs()
    return deepFreeze({
        apiUrl,
        cliApiToken,
        extraHeaders: Object.freeze({ ...parseExtraHeaders(process.env.HAPI_EXTRA_HEADERS_JSON) }),
        isRunnerProcess: args.length >= 2 && args[0] === 'runner' && args[1] === 'start-sync',
        happyHomeDir, logsDir, settingsFile,
        privateKeyFile: join(happyHomeDir, 'access.key'),
        runnerStateFile: join(happyHomeDir, 'runner.state.json'),
        runnerLockFile: join(happyHomeDir, 'runner.state.json.lock'),
        currentCliVersion: packageJson.version,
        isExperimentalEnabled: ['true', '1', 'yes'].includes(process.env.HAPI_EXPERIMENTAL?.toLowerCase() || ''),
    }) as Config
}
```

---

### `cli/src/commands/registry.ts` — drop `hapi server` alias (command router)

**Analog:** the file itself (in-place delete + extend resolver).

**Current alias to *delete*** (line 16 — single spread that is the entire residue):

```11:21:cli/src/commands/registry.ts
const COMMANDS: CommandDefinition[] = [
    authCommand,
    connectCommand,
    cursorCommand,
    hubCommand,
    { ...hubCommand, name: 'server' },
    doctorCommand,
    resumeCommand,
    runnerCommand,
    notifyCommand
]
```

**Resolver to *extend*** (D-160 spirit — throw with repair message rather than fall through to `cursorCommand`, per Open Question #1 recommendation):

```28:42:cli/src/commands/registry.ts
export function resolveCommand(args: string[]): { command: CommandDefinition; context: CommandContext } {
    const subcommand = args[0]
    const command = subcommand ? commandMap.get(subcommand) : undefined
    const resolvedCommand = command ?? cursorCommand
    const commandArgs = command ? args.slice(1) : args
    return { command: resolvedCommand, context: { args, subcommand, commandArgs } }
}
```

**Target shape:** add a single guard before the fallback:

```typescript
const RETIRED_COMMANDS: Record<string, string> = { server: 'hub' }

export function resolveCommand(args: string[]): { command: CommandDefinition; context: CommandContext } {
    const subcommand = args[0]
    if (subcommand && subcommand in RETIRED_COMMANDS) {
        throw new Error(`Unknown command "hapi ${subcommand}". Use "hapi ${RETIRED_COMMANDS[subcommand]}" instead.`)
    }
    // ... existing logic unchanged ...
}
```

---

### `cli/src/commands/hub.ts` — env-rename bug fix (command launcher)

**Analog:** the file itself; this is a one-character-class rename in lines 31 and 34.

**Current dead-env-var assignment** (RESEARCH "Critical bug discovered"):

```26:36:cli/src/commands/hub.ts
    run: async (context: CommandContext) => {
        try {
            const { host, port } = parseHubArgs(context.commandArgs)

            if (host) {
                process.env.WEBAPP_HOST = host
            }
            if (port) {
                process.env.WEBAPP_PORT = port
            }
            await import('../../../hub/src/index')
```

**Target shape:** rename to the env vars the hub actually reads today:

```typescript
if (host) process.env.HAPI_LISTEN_HOST = host
if (port) process.env.HAPI_LISTEN_PORT = port
```

*This rename MUST land in the same slice that adds the `WEBAPP_*` env rejection (Pitfall 4 in RESEARCH).*

---

### `cli/src/ui/tokenInit.ts` → `bootstrapToken()` (bootstrap, pre-freeze)

**Analog:** the file itself. The bootstrap-then-freeze pattern (D-169) is: keep the prompt + write-settings logic, drop the singleton mutation, return the resolved token to the entry point so `loadConfig()` reads it back from settings.

**Current singleton mutation to *delete*** (lines 33, 50 — both `_setCliApiToken` callsites):

```26:51:cli/src/ui/tokenInit.ts
    if (configuration.cliApiToken) {
        return
    }
    const settings = await readSettings()
    if (settings.cliApiToken) {
        configuration._setCliApiToken(settings.cliApiToken)
        return
    }
    if (!process.stdin.isTTY) {
        throw new Error('CLI_API_TOKEN is required. ...')
    }
    const token = await promptForToken()
    await updateSettings(current => ({ ...current, cliApiToken: token }))
    configuration._setCliApiToken(token)
```

**Target shape (proposed)** — write settings then return; no setter call:

```typescript
export async function bootstrapToken(settingsFile: string): Promise<void> {
    if (process.env.CLI_API_TOKEN) return
    if (existsSync(settingsFile)) {
        const raw = await readFile(settingsFile, 'utf8')
        const settings = JSON.parse(raw) as { cliApiToken?: string }
        if (settings.cliApiToken) return
    }
    if (!process.stdin.isTTY) {
        throw new Error('CLI_API_TOKEN is required. Set it via env or run `hapi auth login`.')
    }
    const token = await promptForToken(settingsFile)
    await updateSettings(current => ({ ...current, cliApiToken: token }))   // existing helper
}
```

Caller (CLI entry point):

```typescript
const args = getCliArgs()
const { command, context } = resolveCommand(args)            // may throw on `server`
if (command.requiresAuth) await bootstrapToken(provisionalSettingsFile())
const config = await loadConfig({ argv: args })               // ← frozen from here on
await command.run({ ...context, config })
```

---

### `cli/src/persistence.ts` — accept config arg (utility / persistence)

**Analog:** `hub/src/config/settings.ts` — same role (read/write settings JSON) but parameterized by `settingsFile`/`dataDir` rather than by a singleton.

**Current singleton reads to *replace*** (8 callsites of `configuration.*` paths):

```45:64:cli/src/persistence.ts
export async function readSettings(): Promise<Settings> {
  if (!existsSync(configuration.settingsFile)) {
    return { ...defaultSettings }
  }
  try {
    const content = await readFile(configuration.settingsFile, 'utf8')
    return JSON.parse(content)
  } catch {
    return { ...defaultSettings }
  }
}

export async function writeSettings(settings: Settings): Promise<void> {
  if (!existsSync(configuration.happyHomeDir)) {
    await mkdir(configuration.happyHomeDir, { recursive: true })
  }
  await writeFile(configuration.settingsFile, JSON.stringify(settings, null, 2))
}
```

**Analog pattern** — `hub/src/config/settings.ts` already parameterizes by path:

```21:23:hub/src/config/settings.ts
export function getSettingsFile(dataDir: string): string {
    return join(dataDir, 'settings.json')
}
```

```56:65:hub/src/config/settings.ts
export async function writeSettings(settingsFile: string, settings: Settings): Promise<void> {
    const dir = dirname(settingsFile)
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true, mode: 0o700 })
    }
    const tmpFile = settingsFile + '.tmp'
    await writeFile(tmpFile, JSON.stringify(settings, null, 2))
    await rename(tmpFile, settingsFile)
}
```

**Target shape:** mirror the Hub signature — each function takes the config (or the specific paths it needs) as a parameter; remove the field `serverUrl?: string` from the `Settings` type and `delete defaultSettings` if unused after the change.

Also note D-167: the silent `catch { return { ...defaultSettings } }` in `readSettings()` (lines 53-55) is exactly the swallow that must go — replace with `readSettingsOrThrow` semantics.

---

### `hub/src/config/jwtSecret.ts` and `ownerId.ts` — DI parameter

**Analog:** the files themselves; this is a one-argument rewrite per the Phase-8 KeepaliveScheduler precedent (D-139).

**Current singleton read to *replace*** (jwtSecret L4, L11-12; ownerId L4, L27):

```1:12:hub/src/config/jwtSecret.ts
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import { getConfiguration } from '../configuration'
import { getOrCreateJsonFile } from './generators'

const jwtSecretFileSchema = z.object({ secretBase64: z.string() })

export async function getOrCreateJwtSecret(): Promise<Uint8Array> {
    const secretFile = join(getConfiguration().dataDir, 'jwt-secret.json')
```

**Target shape** — drop the `getConfiguration` import; accept `dataDir`:

```typescript
export async function getOrCreateJwtSecret(dataDir: string): Promise<Uint8Array> {
    const secretFile = join(dataDir, 'jwt-secret.json')
    // ... rest unchanged ...
}
```

`hub/src/index.ts::main` is the caller — it already has `config.dataDir` in scope after `loadConfig()`, so the change there is `await getOrCreateJwtSecret(config.dataDir)` (line 142).

For `ownerId.ts`, also drop the `cachedOwnerId` module-level cache (D-170 forbids that kind of singleton backdoor); the entry point should call it once and pass the value through DI.

---

### `hub/src/index.ts::main` — entry-point DI root

**Analog:** the file itself (already follows the load-once-then-thread shape; just needs `createConfiguration()` → `loadConfig()` swap plus passing `config.dataDir` / `config.cliApiToken` to the now-parameterized helpers).

**Existing DI-root pattern to *preserve*** (already correct shape — Phase 10 just removes the singleton and adds explicit parameters):

```141:188:hub/src/index.ts
    const store = new Store(config.dbPath)
    const jwtSecret = await getOrCreateJwtSecret()                          // ← becomes (config.dataDir)
    const vapidKeys = await getOrCreateVapidKeys(config.dataDir)            // ← already DI'd, copy this shape
    // ...
    const socketServer = createSocketServer({
        store, jwtSecret, scheduler, corsOrigins,
        // ...
    })
    syncEngine = new SyncEngine(store, socketServer.io, ...)
    webServer = await startWebServer({
        // ...
    })
```

`getOrCreateVapidKeys(config.dataDir)` at line 143 is the exact template for the `jwtSecret` / `ownerId` DI cutover — same package, same call shape.

---

### `cli/src/api/*` and `cli/src/runner/*` — constructor / function DI cutover

**Analog (Phase 8 precedent, D-139):** `hub/src/sync/syncEngineSession.ts` — accepts `private readonly scheduler: KeepaliveScheduler` via constructor:

```36:40:hub/src/sync/syncEngineSession.ts
        private readonly scheduler: KeepaliveScheduler
```

**Current CLI singleton consumer to *convert*** (representative — ApiClient reads `configuration.apiUrl` directly):

```23:46:cli/src/api/api.ts
export class ApiClient {
    static async create(): Promise<ApiClient> {
        return new ApiClient(getAuthToken())
    }

    private constructor(private readonly token: string) { }
    // ...
    async getOrCreateSession(opts: {...}): Promise<Session> {
        const response = await axios.post<CreateSessionResponse>(
            `${configuration.apiUrl}/cli/sessions`,
            // ...
        )
```

**Target shape:** constructor accepts a `Config` (or just the slice it needs — `apiUrl`, `cliApiToken`, `extraHeaders`):

```typescript
export class ApiClient {
    static create(config: Pick<Config, 'apiUrl' | 'cliApiToken' | 'extraHeaders'>): ApiClient {
        return new ApiClient(config, getAuthToken(config.cliApiToken))
    }
    private constructor(
        private readonly config: Pick<Config, 'apiUrl' | 'extraHeaders'>,
        private readonly token: string
    ) {}

    async getOrCreateSession(opts: {...}): Promise<Session> {
        const response = await axios.post<CreateSessionResponse>(
            `${this.config.apiUrl}/cli/sessions`,
            // ...
        )
    }
}
```

Apply the same pattern across the 30 callsites enumerated in RESEARCH "Legacy Residue Map — CLI singleton consumers". For pure utility modules (e.g. `cli/src/projectPath.ts`, `cli/src/utils/autoStartServer.ts`) that read a single field, **prefer passing the field directly** (`happyHomeDir: string`) rather than the whole `Config` — the function signature stays narrowest possible.

---

### `hub/src/web/server.ts` / `socket/server.ts` / `web/routes/{cli,auth}.ts` — options-bag DI

**Analog (in-place):** the same files already use an options-bag pattern (`startWebServer({ ... })`, `createSocketServer({ ... })`). The cutover is "add `cliApiToken` / `corsOrigins` / `listenHost` / `listenPort` / `publicUrl` to the options bag; stop calling `getConfiguration()` inside".

**Current singleton read to *replace*** (representative):

```75:77:hub/src/web/server.ts
    const configuration = getConfiguration()
    const corsOrigins = options.corsOrigins ?? configuration.corsOrigins
    const corsOriginOption = corsOrigins.includes('*') ? '*' : corsOrigins
```

**Target shape:** make `corsOrigins` (and `cliApiToken` where applicable) required on the options type, and delete the `getConfiguration()` fallback. `hub/src/index.ts::main` already passes `corsOrigins` (line 187) — the only thing to do is make it non-optional.

---

### `cli/src/lib.ts` — library public surface (breaking change, D-166)

**Analog (in-place):** the file itself.

**Current export to *replace*** (line 13):

```1:15:cli/src/lib.ts
export { ApiClient } from '@/api/api'
export { ApiSessionClient } from '@/api/apiSession'
export { logger } from '@/ui/logger'
export { configuration } from '@/configuration'
export { RawJSONLinesSchema, type RawJSONLines } from '@/agent/agentLogSchema'
```

**Target shape:**

```typescript
export { ApiClient } from '@/api/api'
export { ApiSessionClient } from '@/api/apiSession'
export { logger } from '@/ui/logger'
export { loadConfig, type Config } from '@/configuration'
export { RawJSONLinesSchema, type RawJSONLines } from '@/agent/agentLogSchema'
```

Add a one-line JSDoc note that `configuration` was removed; consumers must call `await loadConfig()` (D-166, Pitfall 3 in RESEARCH).

---

### `scripts/check-no-cut-agents.sh` — Phase-10 guard block

**Analog (same file):** Phase-8 block at lines 286-386 and Phase-9 block at lines 388-496. Both demonstrate the "numbered sub-guards (#1, #2, …), echo PASS at the end, exit 1 on the first failure" cadence. The Phase-10 block should slot in after the Phase-9 block and before any future Phase-11 block.

**Pattern to copy** (header + dirs declaration from Phase 8):

```286:295:scripts/check-no-cut-agents.sh
# ===== Phase 8 — Hub internal decoupling (D-143) =====
# Zero-tolerance keywords closing REFH-01..REFH-04:
#   #1 SSE → SyncEngine reverse import          (SC#2)
#   #2 SessionCache construction whitelist      (D-129 / D-130)
#   #3 setInterval/setTimeout outside scheduler (SC#4)
#   #5 file-size budgets                        (SC#1)
# #4 (madge zero cycles) is enforced by the tail-invocation of
# scripts/check-no-circular-hub.sh so a single `bash scripts/check-no-cut-agents.sh`
# command is the Phase 8 gate.
PHASE8_SWEEP_DIRS=(hub/src/sse hub/src/sync hub/src/socket hub/src/notifications)
```

**Per-check pattern** (from Phase 9 #1 — exactly-N hits, error string mentions D-number + repair):

```400:412:scripts/check-no-cut-agents.sh
# (#1) D-158 #1 — levenshteinDistance: exactly 1 hit in web/src/lib/fuzzyMatch.ts, 0 elsewhere
PHASE9_LEV_HITS=$("$RG_BIN" -n '\bfunction levenshteinDistance\b|\bfunction levenshtein\b' "${PHASE9_WEB_SCOPE[@]}" 2>/dev/null || true)
PHASE9_LEV_COUNT=$(echo -n "$PHASE9_LEV_HITS" | grep -c '^' || true)
if [ "$PHASE9_LEV_COUNT" -ne 1 ] || ! echo "$PHASE9_LEV_HITS" | grep -q 'web/src/lib/fuzzyMatch\.ts'; then
    echo "$PHASE9_LEV_HITS"
    echo "❌ Phase 9 D-158 #1: levenshteinDistance must be defined exactly once in web/src/lib/fuzzyMatch.ts."
    exit 1
fi
echo "✅ Phase 9 D-158 #1: levenshteinDistance lives only in web/src/lib/fuzzyMatch.ts."
```

**Phase-10 block (proposed — already drafted in RESEARCH §"Code Examples")** covers #1 legacy field reads, #2 mutable setters, #3 `name: 'server'` alias, #4 runtime `migration-v*.ts` files, #5 singleton imports. Include test/whitelisting precedent from Phase 8 #2 (count-equals-N) and Phase 9 #6 (≥N importers) for any "must exist exactly once" assertions (e.g. `loadConfig` definition must appear exactly once per package).

---

## Shared Patterns

### Shared #1: Deep-Freeze Helper (apply to both `loadConfig()` callsites)

**Source:** synthesized — repo has no existing deep-freeze utility. Define inline in each `configuration.ts` (or in a single `shared/src/deepFreeze.ts` if both packages co-import).

```typescript
function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const key of Object.keys(value)) {
            deepFreeze((value as Record<string, unknown>)[key])
        }
        Object.freeze(value)
    }
    return value
}
```

**Apply to:** the `return deepFreeze({ ... })` in `cli/src/configuration.ts::loadConfig` and `hub/src/configuration.ts::loadConfig`. Nested `extraHeaders` / `corsOrigins` MUST also be frozen — see Pitfall 1 in RESEARCH.

### Shared #2: Legacy Env-Var Rejection (apply to both packages)

**Source:** `hub/src/config/serverSettings.ts::rejectOldSettingsFields` (lines 77-86) — same shape, applied to `process.env` instead of a settings object.

```typescript
const OLD_ENV_VARS = {
    WEBAPP_HOST: 'HAPI_LISTEN_HOST',
    WEBAPP_PORT: 'HAPI_LISTEN_PORT',
    WEBAPP_URL: 'HAPI_PUBLIC_URL',
    SERVER_URL: 'HAPI_API_URL',
} as const

function rejectOldEnvVars(): void {
    for (const [oldName, newName] of Object.entries(OLD_ENV_VARS)) {
        if (process.env[oldName] !== undefined) {
            throw new Error(`Unsupported legacy env var ${oldName}. Rename to ${newName} and restart.`)
        }
    }
}
```

**Apply to:** called from both `cli/src/configuration.ts::loadConfig` and `hub/src/configuration.ts::loadConfig` (or factored into `hub/src/config/serverSettings.ts` as a sibling of `rejectOldSettingsFields` and re-imported by CLI — planner discretion).

### Shared #3: Legacy Settings-Field Rejection

**Source:** `hub/src/config/serverSettings.ts::rejectOldSettingsFields` lines 77-86 (already shown above).

**Apply to:** Hub-side is already wired; CLI needs the parallel `rejectOldCliSettingsFields(['serverUrl'])` helper inside `cli/src/configuration.ts::loadConfig`.

### Shared #4: Malformed-Settings Fail-Fast

**Source:** `hub/src/config/settings.ts::readSettingsOrThrow` (lines 43-51, shown above) + `hub/src/config/serverSettings.ts` lines 118-122.

**Apply to:** CLI `loadConfig()` — the existing `cli/src/persistence.ts::readSettings()` silent-default branch (lines 53-55) must be deleted in favor of throwing with the settings path + repair message (D-167).

### Shared #5: Constructor DI for Stateful Consumers (Phase 8 precedent)

**Source:** `hub/src/sync/syncEngineSession.ts:36-40` (`private readonly scheduler: KeepaliveScheduler`) and `hub/src/index.ts:147,171` (entry-point constructs scheduler once and passes it down).

**Apply to:** all 30 CLI singleton consumers + 7 Hub consumers per RESEARCH "Legacy Residue Map". Pass the narrowest slice each consumer actually needs (`Pick<Config, ...>`), not the whole `Config`, to keep test fixtures minimal.

### Shared #6: Test Config Factory (replaces singleton mocks)

**Source:** D-170 + the test pattern implied by `hub/src/config/serverSettings.test.ts` (passes paths/values directly to `loadServerSettings`).

**Apply to:** the five tests listed in RESEARCH §"Wave 0 Gaps" that currently use `vi.mock('@/configuration', ...)`. Replace each `vi.mock` with a `makeConfig(overrides?: Partial<Config>): Config` helper exported from a per-package `__fixtures__/config.ts`:

```typescript
// cli/src/__fixtures__/config.ts (proposed)
import type { Config } from '@/configuration'

export function makeConfig(overrides: Partial<Config> = {}): Config {
    return Object.freeze({
        apiUrl: 'http://localhost:3006',
        cliApiToken: 'test-token',
        extraHeaders: Object.freeze({}),
        isRunnerProcess: false,
        happyHomeDir: '/tmp/.hapi-test',
        // ... rest of defaults ...
        ...overrides,
    }) as Config
}
```

Tests then construct services with `new ApiClient(makeConfig({ extraHeaders: { 'X-Foo': 'bar' } }))` rather than mocking the module.

### Shared #7: Frozen-Config Mutation Test

**Source:** D-164 / D-165, Bun test conventions (already used across `cli/` and `hub/`).

```typescript
import { describe, it, expect } from 'bun:test'
import { loadConfig } from '@/configuration'

describe('loadConfig', () => {
    it('returns a deeply frozen config', async () => {
        const config = await loadConfig()
        expect(() => { (config as any).apiUrl = 'mutated' }).toThrow(TypeError)
        expect(() => { (config as any).extraHeaders['X-Foo'] = 'bar' }).toThrow(TypeError)
        expect(() => { (config as any).corsOrigins.push('http://evil') }).toThrow(TypeError)
    })
})
```

**Apply to:** `cli/src/configuration.test.ts` (new) and `hub/src/configuration.test.ts` (new). Strict-mode is on by default in TypeScript-compiled Bun tests, so the `(config as any).field = ...` form throws as required by D-164.

### Shared #8: 4-Slice + Final Guard Cadence (Phase 9 precedent, D-157/D-158)

**Source:** RESEARCH §Summary recommendation — Phase 9 split its work into 4 slices and gated each with `bun typecheck && bun run test && bun run test:guard` per task commit. Phase 10 follows the same cadence:

1. Slice 1 — residue + guard scaffold (delete `serverUrl` migration, delete `name: 'server'`, fix `WEBAPP_*` env names in `cli/src/commands/hub.ts`, add Phase-10 guard block, add Wave-0 tests).
2. Slice 2 — Hub `loadConfig()` + Hub DI cutover (single coordinated wave per GitNexus HIGH-risk note; cannot be split across commits without breaking the build).
3. Slice 3 — CLI `loadConfig()` + bootstrap-then-freeze in command entry; convert `cli/src/persistence.ts` and the 30 CLI singleton consumers.
4. Slice 4 — `cli/src/lib.ts` export swap + final guard sweep + delete `cli/src/ui/apiUrlInit.ts`.

Each slice ends green (typecheck + tests + guard). Final commit re-runs the full guard block and prints `✅ Phase 10 guard PASS.`.

---

## No Analog Found

None. Every target file has either an in-place precedent or a sibling-package analog in the repo.

---

## Metadata

**Analog search scope:** `cli/src/`, `hub/src/`, `shared/src/`, `scripts/`.
**Files scanned (Read):** `cli/src/configuration.ts`, `cli/src/persistence.ts`, `cli/src/ui/apiUrlInit.ts`, `cli/src/ui/tokenInit.ts`, `cli/src/commands/registry.ts`, `cli/src/commands/hub.ts`, `cli/src/commands/types.ts`, `cli/src/lib.ts`, `cli/src/api/api.ts` (head), `hub/src/configuration.ts`, `hub/src/config/serverSettings.ts`, `hub/src/config/settings.ts`, `hub/src/config/jwtSecret.ts`, `hub/src/config/ownerId.ts`, `hub/src/store/index.ts` (head), `hub/src/index.ts`, `hub/src/web/server.ts` (head), `scripts/check-no-cut-agents.sh`.
**Pattern extraction date:** 2026-05-23
