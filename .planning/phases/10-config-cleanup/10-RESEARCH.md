# Phase 10: Config cleanup - Research

**Researched:** 2026-05-23
**Domain:** TypeScript config refactor — singleton elimination, legacy alias removal, frozen-config DI in a Bun monorepo (CLI + Hub)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Legacy config and command residue**
- **D-160:** Legacy residue must fail hard with repair guidance. Old settings fields, old env names, or `hapi server` command alias must error at startup, not be silently ignored. Messages name the old key/command, the new canonical replacement, and the file/env/command to edit.
- **D-161:** Failure coverage includes settings, env, **and** command names. Cleanup spans `settings.json` fields (`serverUrl`, `webapp*`), old env aliases (if any remain detectable), and command resolution (`hapi server`). Broader than source-code deletion alone.
- **D-162:** Error messages guide manual edits, **not** auto-migrate. For `~/.hapi/settings.json`, list old→new mappings (`serverUrl` → `apiUrl`, `webapp*` → `publicUrl`/`listen*`) and tell the user to edit + restart. Do **not** auto-delete/recreate settings because the file still holds `machineId` / `cliApiToken`.
- **D-163:** Guard + runtime tests are both required. Tests cover failure messages; guard sweep rejects legacy reads/aliases. Guard must be precise enough to allow tests/docs where asserted, but production source must not keep alias reads or command-alias registration.

**Frozen config shape**
- **D-164:** `loadConfig()` returns a plain frozen `Readonly` object. Do **not** preserve the mutable `Configuration` class as the primary public surface. Fields directly readable; mutation throws in strict-mode tests.
- **D-165:** Freeze nested mutable collections too. Top-level freeze not enough — `extraHeaders`, `sources`, `corsOrigins` must be frozen or copied to immutable equivalents.
- **D-166:** Public surface becomes `loadConfig()` + `Config` type. Delete `configuration` / `getConfiguration()` as production access surfaces this phase rather than leaving wrapper shims. Package-internal helpers are fine; downstream code uses explicit loaded config.
- **D-167:** Malformed settings fail fast. CLI must stop swallowing malformed `settings.json` into defaults. Unreadable file or invalid field types → `loadConfig()` throws with settings path + repair message (Hub `readSettingsOrThrow` pattern).

**Dependency injection boundary**
- **D-168:** DI covers startup chains and constructor boundaries. Load config at CLI/Hub entry; pass explicitly to commands, API clients, stores, service constructors, init helpers. **No** broad AppContext/ServiceContainer in Phase 10.
- **D-169:** CLI prompting is a bootstrap step *before* freeze. CLI startup may still read settings, prompt for missing token, write updated settings — all before final `Config` construction. After `loadConfig()` returns, runtime mutation is forbidden.
- **D-170:** Tests use factories/fixtures, **not** reset setters. Replace singleton-reset patterns with explicit test config factories. No `resetConfigForTests()` or test-only mutable backdoor.
- **D-171:** Production consumers cut over in one phase. All direct production reads from `configuration` / `getConfiguration()` converted to explicit passing. Tests updated alongside. Phase 10 must not leave production half-singleton / half-DI.

**SQLite runtime migration policy**
- **D-172:** Delete runtime migrations; keep explicit offline tools. Remove runtime `migration-vN` source/invocation. Keep explicitly named offline scripts/tests like namespace-isolation migration (matches "operator chooses migration" policy).
- **D-173:** Schema-mismatch errors point to offline migration or rebuild. Startup failure includes DB path, expected version, found version, and instruction: back up, then run offline migration tool or rebuild.
- **D-174:** Bump schema version when strict decoding would reject old persisted data. Not limited to table/column changes — if Phase 10 removes compatibility that makes old persisted JSON fail under strict schemas, bump `SCHEMA_VERSION` and rely on mismatch rejection.
- **D-175:** SQLite cleanup needs Store tests + guard coverage. Keep/add tests for version mismatch and missing required tables. Guard rejects runtime `migration-v*.ts` files + runtime migration callsites, while allowing explicitly named offline scripts and their tests.

### Claude's Discretion
- Slice order — recommended: (1) legacy residue + guard, (2) `loadConfig()` frozen object for CLI/Hub, (3) DI cutover for consumers, (4) SQLite cleanup + final guard.
- Exact module names for helper functions, as long as public surface is `loadConfig()` + `Config` and production consumers do not touch a mutable singleton.
- The exact old env alias list to be discovered by researcher from current source / historical settings code; decision is to fail hard for any old alias with detectable runtime surface.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFC-01 | Drop `serverUrl → apiUrl` / `webapp* → publicUrl` aliases, `hapi server` command alias, and runtime SQLite migrations. SQLite schema mismatch → reject startup + point to offline tool. | Inventory (Standard Stack), Legacy Residue Map, Runtime State Inventory. Schema rejection already in place (`hub/src/store/index.ts::initSchema`); no `migration-v*.ts` files exist, so REFC-01 SQLite work is *guard + bug-fix in `cli/src/commands/hub.ts`* (still writes `WEBAPP_HOST/PORT`), not deletion. |
| REFC-02 | CLI + Hub → `loadConfig()` returning frozen object; remove `_setApiUrl()` / `_setCliApiToken()` / `_setExtraHeaders()` setters; DI for consumers. | Architecture Patterns + DI Cutover map. CLI has 30+ singleton callsites; Hub has 5 prod files using `getConfiguration()` / `configuration`. Bootstrap-then-freeze pattern (D-169) + constructor DI pattern from Phase 8 (D-139). |
</phase_requirements>

## Summary

This is a brownfield refactor phase in a Bun + TypeScript monorepo (CLI + Hub + Web + Shared). The phase has four cleanly separable concerns: (1) **legacy field/command residue** — delete `serverUrl` migration read in CLI, delete `hapi server` command alias, fix `cli/src/commands/hub.ts` which still exports `WEBAPP_HOST/PORT` env vars that the hub no longer reads (a dead bug); (2) **frozen-config refactor** — replace the two module-level `Configuration` singletons (CLI `cli/src/configuration.ts`, Hub `hub/src/configuration.ts`) with `loadConfig()` returning a deeply frozen object; (3) **DI cutover** — thread the loaded `Config` through CLI command entry points + Hub `main()` to all 30+ CLI consumers and 7 Hub consumers (incl. `getOrCreateJwtSecret` and `getOrCreateOwnerId` which currently re-grab the singleton); (4) **SQLite guard + Hub bootstrap polish** — the runtime migration paths are *already gone* (no `migration-v*.ts` files exist; `Store.initSchema` already rejects mismatches); Phase 10 work here is mostly tests + ripgrep guard to prevent regressions.

The shape of work is well-precedented in the project — Phase 8 already established explicit constructor DI for `KeepaliveScheduler` (D-139), and Phase 9 established the "split + final guard sweep" cadence (D-157/D-158). Phase 10 follows the same green-per-slice + final guard pattern.

**Primary recommendation:** Slice 1 (residue + guard scaffold) → Slice 2 (Hub `loadConfig()` since Hub already has an entry-point `main()` and is the smaller blast radius) → Slice 3 (CLI `loadConfig()` + bootstrap-then-freeze in command handlers) → Slice 4 (DI cutover for CLI library exports `cli/src/lib.ts` + final guard sweep). Wave 0 of slice 1 should add the Phase-10 guard block to `scripts/check-no-cut-agents.sh` so subsequent slices land green.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Read env vars + `~/.hapi/settings.json` on startup | CLI entry-point / Hub `main()` | — | Bootstrap reads filesystem; consumers must not |
| Validate + freeze `Config` | CLI / Hub config module (`loadConfig`) | — | Single trust boundary between mutable bootstrap and immutable runtime |
| Reject old settings fields / old env vars | CLI `loadConfig()` / Hub `loadConfig()` (extend existing `rejectOldSettingsFields`) | — | Fail-fast at the same boundary that validates new fields |
| Reject `hapi server` command alias | CLI `commands/registry.ts` resolver | — | Command-resolution layer — not config |
| Reject SQLite schema mismatch | Hub `Store` constructor (already does this) | — | Persistence layer owns schema gate |
| Pass `Config` to API clients / stores / sockets | CLI command handlers / Hub `main()` | — | Constructor DI (Phase 8 pattern) |
| Interactive token prompt | CLI bootstrap (pre-freeze) | — | UI step; produces input to `loadConfig()` (D-169) |

## Standard Stack

This phase uses **only** existing dependencies — no new packages.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x (workspace pinned) | `Readonly<>` types for frozen config shape | Native immutability annotation [VERIFIED: in repo] |
| `Object.freeze` (built-in) | ES2015+ | Runtime deep-freeze of returned config | Standard ES API; complements `Readonly<>` type [CITED: MDN Object.freeze] |
| Zod | already in repo | Validate `settings.json` shape in CLI `loadConfig()`, mirroring Hub's `parseStringSetting`/etc. (or hand-rolled like Hub does today) | Hub `loadServerSettings` validates manually today; adopting zod is *optional* — hand-rolled validators are accepted per current Hub style [VERIFIED: hub/src/config/serverSettings.ts] |
| Bun test runner | repo standard | Frozen-config mutation tests, schema-mismatch tests | All existing tests use it [VERIFIED: package.json scripts] |
| ripgrep guard script | `scripts/check-no-cut-agents.sh` | Extend with Phase-10 sweep block | Same pattern as Phase 1-9 [VERIFIED: file exists] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bun:sqlite` | bundled | Schema version PRAGMA + mismatch error | Already in `hub/src/store/index.ts`; **only** the error message + version-bump may change |
| `node:readline/promises` | built-in | CLI interactive token prompt | Already used in `cli/src/ui/tokenInit.ts`; will move into bootstrap step |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Object.freeze` + deep walk | [`deep-freeze`](https://www.npmjs.com/package/deep-freeze) npm package | **Reject** — single-file utility in repo is simpler; adds dep weight + supply-chain risk for trivial recursion. |
| `Object.freeze` + deep walk | TypeScript `as const` + Readonly types only | **Reject** — `as const` is compile-time only; D-164 requires mutation to *throw* at runtime, not just fail typecheck. |
| Plain object factory `loadConfig()` | Keep `Configuration` class, expose frozen instance | **Reject** — D-164 explicitly forbids keeping the class as primary public surface. |
| Singleton-with-init (`createConfiguration()` + `getConfiguration()`) | DI via parameters | **Reject** — D-166/D-168 forbid; constructor DI already accepted post Phase 8 (D-139). |
| `npm install zod` for CLI settings validation | Hand-rolled validators mirroring `parseStringSetting`/`parseListenPort` | **Either acceptable** — repo already has zod (used in `hub/src/config/jwtSecret.ts`); hand-rolled is simpler and matches `hub/src/config/serverSettings.ts`. Planner discretion. |

**Installation:** No new packages needed.

**Version verification:**
```bash
# No new deps; verify existing in-repo tooling only:
grep -r '"zod"' --include=package.json   # confirms zod available across packages
```

## Package Legitimacy Audit

> **Not applicable** — Phase 10 installs zero new packages. All dependencies (`zod`, `bun:sqlite`, `node:readline/promises`, `chalk`) are already used in production code today.

## Architecture Patterns

### System Architecture Diagram

```
Phase 10 — Config flow (target state)

┌────────────────────────────────────────────────────────────────┐
│  CLI entry-point (cli/src/index.ts → runCli)                   │
│                                                                 │
│  1. resolveCommand(args)  ──reject──►  if subcommand=='server' │
│                                       throw with repair msg   │
│  2. command.bootstrap()  ── may prompt + write settings ──┐   │
│  3. const config = loadConfig()  ◄────────────────────────┘   │
│     • reads env + settings.json                                │
│     • rejects serverUrl, webapp*, malformed JSON               │
│     • rejects WEBAPP_HOST / WEBAPP_PORT / WEBAPP_URL env       │
│     • Object.freeze (deep) on return                           │
│  4. command.run({ config, ... })  ── DI to all consumers       │
│                                                                 │
│     ApiClient(config) ──► HTTP to ${config.apiUrl}             │
│     Runner(config)   ──► uses cliApiToken + extraHeaders       │
│     persistence(config) ──► uses settingsFile + happyHomeDir   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Hub entry-point (hub/src/index.ts → main)                     │
│                                                                 │
│  1. const config = await loadConfig()                          │
│     • reads env + settings.json                                │
│     • already rejects webapp* / relay* fields                  │
│     • now also rejects WEBAPP_HOST / WEBAPP_PORT / WEBAPP_URL  │
│     • loads cliApiToken                                        │
│     • Object.freeze (deep) on return                           │
│  2. const store = new Store(config.dbPath)                     │
│     • Store.initSchema rejects schema mismatch (unchanged)     │
│  3. jwtSecret = getOrCreateJwtSecret(config.dataDir)  ── DI    │
│  4. ownerId   = getOrCreateOwnerId(config.dataDir)    ── DI    │
│  5. createSocketServer({ ..., cliApiToken: config.cliApiToken })│
│  6. startWebServer({ ..., config })                            │
│     • createCliRoutes(syncEngine, cliApiToken)                 │
│     • createAuthRoutes(jwtSecret, cliApiToken)                 │
└────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (target)

```
cli/src/
├── configuration.ts        # exports loadConfig() + type Config (no class, no singleton)
├── persistence.ts          # takes (config, settings) — no module-level import of config
├── ui/
│   ├── apiUrlInit.ts       # DELETED — folded into loadConfig() / bootstrap
│   └── tokenInit.ts        # exported as `bootstrapToken(): Promise<string>` — pre-freeze
├── commands/
│   ├── registry.ts         # removes { ...hubCommand, name: 'server' }
│   ├── hub.ts              # sets HAPI_LISTEN_HOST / HAPI_LISTEN_PORT (bug fix)
│   ├── runCli.ts           # calls loadConfig() after bootstrap; passes config to command.run
│   └── types.ts            # CommandContext gains { config: Config }
└── lib.ts                  # exports loadConfig + type Config (replaces `configuration` export)

hub/src/
├── configuration.ts        # exports loadConfig() + type Config (no class, no singleton)
├── config/
│   ├── jwtSecret.ts        # accepts dataDir as arg
│   ├── ownerId.ts          # accepts dataDir as arg
│   └── serverSettings.ts   # extend OLD_SETTINGS_FIELDS; add env-var rejection
├── store/index.ts          # unchanged (already rejects schema mismatch)
└── index.ts                # main() loads config once, threads through
```

### Pattern 1: `loadConfig()` returning a deeply frozen object

**What:** Replace the mutable `Configuration` class with a plain factory that returns a deep-frozen object literal.
**When to use:** At CLI/Hub startup, exactly once per process.

```typescript
// Pattern (proposed for hub/src/configuration.ts and cli/src/configuration.ts)
export type Config = Readonly<{
    apiUrl: string
    cliApiToken: string
    extraHeaders: Readonly<Record<string, string>>
    happyHomeDir: string
    // ...
}>

function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(deepFreeze)
        Object.freeze(value)
    }
    return value
}

export async function loadConfig(opts: LoadConfigOpts = {}): Promise<Config> {
    // 1. read env
    // 2. read + validate settings.json (throw on parse failure — D-167)
    // 3. reject legacy fields / env vars (D-160, D-161)
    // 4. apply precedence: env > file > default
    // 5. (Hub only) load cliApiToken
    return deepFreeze({
        apiUrl,
        cliApiToken,
        extraHeaders: { ...extraHeaders },   // copy before freezing
        happyHomeDir,
        // ...
    }) as Config
}
```
*Source: synthesized from existing `hub/src/configuration.ts::Configuration.create` and Node `Object.freeze` docs.*

### Pattern 2: Bootstrap-then-freeze (CLI token prompt)

**What:** Pre-config-load steps that write to disk are allowed (D-169). They run before `loadConfig()`, mutate settings file, then `loadConfig()` reads the final state.
**When to use:** CLI commands that may need to prompt for `CLI_API_TOKEN`.

```typescript
// Pattern (proposed for cli/src/commands/runCli.ts)
export async function runCli(): Promise<void> {
    const args = getCliArgs()
    const { command, context } = resolveCommand(args)

    if (command.requiresAuth) {
        await ensureTokenSettled()   // may prompt + writeSettings
    }

    const config = await loadConfig()   // ← frozen from here on
    await command.run({ ...context, config })
}
```
*Source: D-169 wording + current `cli/src/ui/tokenInit.ts::initializeToken` structure (just inlines the mutation back into bootstrap).*

### Pattern 3: Constructor DI for stateful consumers

**What:** Already-established Phase 8 pattern (D-139 `KeepaliveScheduler`). For Phase 10, apply to `getOrCreateJwtSecret`, `getOrCreateOwnerId`, route factories, socket factory, `ApiClient`.
**When to use:** Any module that currently calls `getConfiguration()` or imports `configuration`.

```typescript
// Before
export async function getOrCreateJwtSecret(): Promise<Uint8Array> {
    const secretFile = join(getConfiguration().dataDir, 'jwt-secret.json')
    // ...
}

// After
export async function getOrCreateJwtSecret(dataDir: string): Promise<Uint8Array> {
    const secretFile = join(dataDir, 'jwt-secret.json')
    // ...
}
```

### Anti-Patterns to Avoid

- **`resetConfigForTests()` / mutable test backdoor** — D-170 forbids. Use a `loadConfig({ overrides })` factory or pass a hand-crafted `Config` literal to tests.
- **Shallow `Object.freeze` only** — D-165 forbids. Nested `extraHeaders` / `corsOrigins` arrays must also be frozen, otherwise mutation slips through.
- **Singleton wrapper shim** (`export const config = loadConfig()` at module top-level) — D-166 forbids. Production consumers must accept `config` as a parameter.
- **Migrating `serverUrl` silently** — D-160/D-162 forbid. The legacy field must *throw* with old→new mapping in the message, not silently copy to `apiUrl`.
- **Auto-deleting/rewriting `~/.hapi/settings.json` on legacy detection** — D-162. The file holds `machineId` and `cliApiToken` which must be preserved across the user's manual edit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep readonly TypeScript type | Recursive `DeepReadonly<T>` helper | Plain `Readonly<>` at each nested level (or accept TS's structural shallow `Readonly`) | DeepReadonly recursion gets gnarly across union types; D-164 specifies "fields directly readable" which `Readonly<>` already gives. Type strictness is secondary to *runtime* freeze (which is enforced by tests). |
| Settings JSON parsing/validation | Custom validators per field | Mirror existing `hub/src/config/serverSettings.ts` style (`parseStringSetting`, `parseListenPort`) OR zod schema | Hub already established the pattern; consistency > novelty. |
| Schema-version mismatch detection | A new migration runner | Keep `hub/src/store/index.ts::initSchema` unchanged (it already throws on mismatch) | Already done; Phase 10 only adds tests + guard. |
| Old-field rejection | A new alias-detection framework | Extend existing `rejectOldSettingsFields(...)` in `hub/src/config/serverSettings.ts` + add a sibling `rejectOldEnvVars(...)` and a CLI-side equivalent | Reuses the same "throw a single error listing all old fields found" pattern. |
| Ripgrep guard | A new test framework | Add a Phase-10 block to `scripts/check-no-cut-agents.sh` (same structure as Phase 8 / 9 blocks) | Proven pattern across 9 phases. |

**Key insight:** Most of Phase 10's "deletion" work is already done by the codebase as it stands — `migration-v*.ts` files don't exist, Hub already rejects `webapp*` settings fields, Hub `Store` already rejects schema mismatches. The actual delta is much smaller than the requirement headline suggests: **delete the CLI singleton + 30 consumers, delete the Hub singleton + 7 consumers, delete two CLI legacy code paths (`apiUrlInit` migration read, `name: 'server'` alias), and fix one bug (`commands/hub.ts` writing dead env vars).**

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `~/.hapi/settings.json` may contain legacy `serverUrl` field on user machines. SQLite DB at `~/.hapi/hapi.db` may be at an older `user_version` (current = 10). | **Code edit only.** CLI `loadConfig()` throws on `serverUrl` field with "rename to apiUrl". SQLite mismatch already throws via `Store.initSchema`. Per D-162, do *not* auto-edit `settings.json`. |
| Live service config | None — no external service stores `serverUrl` or `webapp*` outside the project. Single-user Tailscale model (per PROJECT.md). | None. |
| OS-registered state | None — CLI runner registers `runner.state.json` + lock file under `~/.hapi/`, both already controlled by `configuration.runnerStateFile` / `runnerLockFile` which become `config.runnerStateFile`. No systemd/launchd/Task-Scheduler entries. | None. |
| Secrets / env vars | `CLI_API_TOKEN`, `HAPI_API_URL`, `HAPI_HOME`, `DB_PATH`, `HAPI_LISTEN_HOST`, `HAPI_LISTEN_PORT`, `HAPI_PUBLIC_URL`, `CORS_ORIGINS`, `VAPID_SUBJECT`, `HAPI_EXTRA_HEADERS_JSON`, `HAPI_EXPERIMENTAL` — all current. Historical aliases removed at rename time: `WEBAPP_HOST`, `WEBAPP_PORT`, `WEBAPP_URL`, `SERVER_URL`. | **Code edit:** `loadConfig()` (both packages) should throw if `WEBAPP_HOST` / `WEBAPP_PORT` / `WEBAPP_URL` env vars are set (D-161). |
| Build artifacts / installed packages | None of the above leaks into `dist/` or any compiled artifact. CLI is bundled via `pkgroll`; no runtime-generated config caches. | None. |

**Critical bug discovered during research:** `cli/src/commands/hub.ts:30-34` still sets `process.env.WEBAPP_HOST` / `process.env.WEBAPP_PORT` before importing the hub. The hub no longer reads these env vars (it reads `HAPI_LISTEN_HOST` / `HAPI_LISTEN_PORT`). **The `hapi hub --host X --port Y` invocation is silently broken today.** Phase 10 must rename these two `process.env.*` assignments to `HAPI_LISTEN_HOST` / `HAPI_LISTEN_PORT`.

## Legacy Residue Map (concrete inventory)

This is the **complete** production-code surface Phase 10 must touch — verified via Grep across `cli/src/`, `hub/src/`, `web/src/`, `shared/src/`.

### Legacy field reads — `serverUrl`

| File | Line | Action |
|------|------|--------|
| `cli/src/persistence.ts` | L22-23 (`serverUrl?: string` field on `Settings`) | Remove field; `loadConfig()` throws if present. |
| `cli/src/ui/apiUrlInit.ts` | L29-32 (silent migration path) | Delete the entire `if (settings.serverUrl)` block; convert to fail-fast in `loadConfig()`. |

### Legacy field reads — `webapp(Host|Port|Url)`

| File | Line | Action |
|------|------|--------|
| `hub/src/config/serverSettings.ts` | L13-21 (`OLD_SETTINGS_FIELDS`) | Already rejects. **Keep**; verify test coverage for each member. |
| `hub/src/config/serverSettings.test.ts` | — | Verify each field in `OLD_SETTINGS_FIELDS` has a test asserting the error. |
| `web/src/hooks/useServerUrl.ts` | — (web-internal, not config) | **Out of scope** — this is the *web client's* concept of "which hub URL am I talking to" and is unrelated to the CLI `serverUrl` settings field. Verify, then leave alone. |

### `hapi server` command alias

| File | Line | Action |
|------|------|--------|
| `cli/src/commands/registry.ts` | L16 (`{ ...hubCommand, name: 'server' }`) | Delete the spread. Add a command-resolution test asserting `resolveCommand(['server'])` falls through to `cursorCommand` (the default) — or, per D-160, throws with "use `hapi hub` instead". Planner picks. |
| `cli/src/commands/registry.ts` resolver | L28-42 | Optionally extend `resolveCommand()` to detect `server` specifically and emit a repair message. |

### Mutable setters — `_setApiUrl` / `_setCliApiToken` / `_setExtraHeaders`

| File | Line | Action |
|------|------|--------|
| `cli/src/configuration.ts` | L101-119 (setter definitions) | Delete with the class itself. |
| `cli/src/ui/apiUrlInit.ts` | L26, L31 (callers) | Delete file or fold into `loadConfig()`. |
| `cli/src/ui/tokenInit.ts` | L33, L50 (callers) | Convert to bootstrap (write settings before `loadConfig()`); no setter calls survive. |
| `cli/src/api/api.extraHeaders.test.ts` | — | Replace mutation-then-assert pattern with factory-fixture `Config`. |
| `cli/src/api/hubExtraHeaders.test.ts` | — | Same. |
| `cli/src/commands/auth.test.ts` | — | Same. |
| `hub/src/configuration.ts` | L137-148 (`_setCliApiToken`) | Delete method; load token before constructing the frozen config. |
| `hub/src/web/routes/cli.test.ts` | — | Convert to fixture-based config. |

### CLI singleton consumers (`configuration.*`)

Grep over `cli/src/` found ~30 production callsites; the comprehensive list:

| File | Field(s) read |
|------|---------------|
| `cli/src/persistence.ts` (8 reads) | `settingsFile`, `happyHomeDir`, `privateKeyFile`, `runnerStateFile`, `runnerLockFile` |
| `cli/src/api/api.ts` (6 reads) | `apiUrl` |
| `cli/src/api/apiSession.ts` (2 reads) | `apiUrl` |
| `cli/src/api/apiMachine.ts` (1 read) | `apiUrl` |
| `cli/src/api/auth.ts` (2 reads) | `cliApiToken` |
| `cli/src/api/hubExtraHeaders.ts` (3 reads) | `extraHeaders` |
| `cli/src/ui/logger.ts` (3 reads) | `isRunnerProcess`, `logsDir` |
| `cli/src/ui/doctor.ts` (5 reads) | `happyHomeDir`, `apiUrl`, `logsDir`, `runnerStateFile` |
| `cli/src/ui/auth.ts` (2 reads) | `cliApiToken` |
| `cli/src/ui/tokenInit.ts` (2 reads) | `cliApiToken`, `settingsFile` |
| `cli/src/runner/run.ts` (3 reads) | `apiUrl`, `cliApiToken` |
| `cli/src/runner/controlClient.ts` (2 reads) | `apiUrl`, `cliApiToken` |
| `cli/src/agent/sessionFactory.ts` (2 reads) | `happyHomeDir` |
| `cli/src/utils/autoStartServer.ts` (1 read) | `apiUrl` |
| `cli/src/projectPath.ts` (1 read) | `happyHomeDir` |
| `cli/src/modules/common/hooks/generateHookSettings.ts` (1 read) | `happyHomeDir` |
| `cli/src/commands/auth.ts` (2 reads) | `apiUrl`, `settingsFile` |
| `cli/src/lib.ts` (1 export) | re-exports `configuration` as **library API** |

**Special case — `cli/src/lib.ts`:** This file is the *public library surface* of the `hapi` package. It currently re-exports `configuration` as a singleton. Per D-166, Phase 10 must replace this with `export { loadConfig, type Config }`. Downstream lib consumers (other dev-environment helpers per the file comment) must adapt. This is a **breaking public API change** — call it out in the PLAN.

### Hub singleton consumers (`getConfiguration()` / `configuration`)

Verified via GitNexus impact analysis: **7 direct callers, 3 affected processes, risk HIGH**.

| File | Field(s) read | DI conversion |
|------|---------------|---------------|
| `hub/src/web/server.ts` L75-76, L200-205, L218-219 | `corsOrigins`, `listenHost`, `listenPort`, `publicUrl` | `startWebServer({ ..., config })` |
| `hub/src/socket/server.ts` L53-54, L108 | `corsOrigins`, `cliApiToken` | `createSocketServer({ ..., corsOrigins, cliApiToken })` |
| `hub/src/web/routes/cli.ts` L78-80 | `cliApiToken` | `createCliRoutes(syncEngine, cliApiToken)` |
| `hub/src/web/routes/auth.ts` L24-26 | `cliApiToken` | `createAuthRoutes(jwtSecret, cliApiToken)` |
| `hub/src/config/jwtSecret.ts` L12 | `dataDir` | `getOrCreateJwtSecret(dataDir)` |
| `hub/src/config/ownerId.ts` L27 | `dataDir` | `getOrCreateOwnerId(dataDir)` |
| `hub/src/configuration.ts` itself (`createConfiguration` + `getConfiguration`) | — | Both deleted; replaced by `loadConfig()`. |

### Runtime SQLite migrations

| Search | Result |
|--------|--------|
| `**/migration-v*.ts` | **0 files** — already deleted by prior phases. |
| Runtime migration invocation in `hub/src/store/index.ts` | None — `initSchema` either creates fresh schema (version 0 → `SCHEMA_VERSION`) or rejects mismatch. |
| `hub/scripts/migrate-namespace-isolation.ts` | **Explicit offline tool** — preserve. Already named per D-172 pattern. |

**Conclusion:** SQLite "runtime migration deletion" is already done. Phase 10 work in this domain is *guard + tests only*. Per D-174, planner must also evaluate whether any change in Phase 10 (e.g. stricter persisted-JSON parsing in `messages.ts`) warrants a `SCHEMA_VERSION` bump from 10 → 11.

## Common Pitfalls

### Pitfall 1: Shallow `Object.freeze`
**What goes wrong:** `Object.freeze({ extraHeaders: { ... } })` freezes the outer object but leaves `extraHeaders` mutable. Tests pass when asserting `config.apiUrl = 'x'` throws but miss `config.extraHeaders['X-Foo'] = 'bar'`.
**Why it happens:** `Object.freeze` is one level deep [CITED: developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze].
**How to avoid:** Recursive freeze utility (small inline helper). Per D-165, test mutation of both top-level and nested fields.
**Warning signs:** Test only mutates scalar top-level fields.

### Pitfall 2: `loadConfig()` race when called twice
**What goes wrong:** If two code paths each call `loadConfig()`, the second call re-reads disk and could return a different object (different freeze identity, potential consistency drift).
**Why it happens:** D-166 deletes the singleton cache; nothing inherently prevents re-calls.
**How to avoid:** Document that `loadConfig()` is called exactly once at entry (CLI `runCli`, Hub `main`). Don't add a cache (D-170 forbids singleton-style memoization that surfaces a mutable backdoor). For tests, factories build `Config` objects directly without going through `loadConfig()`.
**Warning signs:** Any module *importing* `loadConfig` outside of `cli/src/commands/runCli.ts` / `hub/src/index.ts` / tests.

### Pitfall 3: `cli/src/lib.ts` public-API break
**What goes wrong:** `cli/src/lib.ts` re-exports `configuration` for external dev tooling. Removing it breaks downstream scripts.
**Why it happens:** PROJECT.md says no backward compatibility, but `lib.ts` is a *library entry point*, not internal code.
**How to avoid:** Replace export with `loadConfig` + `Config` type. Add a one-line note to the JSDoc that explains the migration. No shim — per D-166.
**Warning signs:** PLAN that leaves `lib.ts` untouched while deleting `configuration` would fail typecheck.

### Pitfall 4: `cli/src/commands/hub.ts` env-var bug masking
**What goes wrong:** Today, `hapi hub --host X --port Y` is **silently broken** — the CLI sets `WEBAPP_HOST` / `WEBAPP_PORT`, which the hub no longer reads. If Phase 10 adds a `WEBAPP_*` env rejection (D-161), the bug surfaces as a startup *error*, but the fix (rename to `HAPI_LISTEN_*`) must land **in the same slice** to prevent the regression.
**Why it happens:** Hub renamed env vars in a prior phase but `cli/src/commands/hub.ts` wasn't updated.
**How to avoid:** Land the rename + the rejection in the same slice. Add an integration test that runs `hapi hub --host 127.0.0.1 --port 4006` and asserts the hub binds correctly.
**Warning signs:** PLAN that adds the WEBAPP_* env rejection without first fixing `cli/src/commands/hub.ts:31,34`.

### Pitfall 5: Test mocks that import the singleton
**What goes wrong:** Existing tests use `vi.mock('@/configuration', ...)` to swap the singleton. After conversion to DI, mocks silently no-op because production code no longer imports the module.
**Why it happens:** Mock targets disappear when import paths disappear.
**How to avoid:** Audit `cli/src/api/api.extraHeaders.test.ts`, `cli/src/api/hubExtraHeaders.test.ts`, `cli/src/commands/auth.test.ts`, `hub/src/web/routes/cli.test.ts` and replace mocks with explicit `Config` factories passed to constructors.
**Warning signs:** Tests pass after refactor without code changes — they may have become no-ops.

### Pitfall 6: `cli/src/configuration.ts` directory side-effects at import time
**What goes wrong:** The current `Configuration` constructor calls `mkdirSync(this.happyHomeDir)` at module-load time. Removing the class but keeping the same mkdir call inside `loadConfig()` is fine, but tests that import `loadConfig` *for the type* will trigger disk writes unless careful.
**Why it happens:** Module-load-time side effects.
**How to avoid:** Keep the mkdir inside `loadConfig()`, not at module top-level. Pure type imports (`import type { Config } from '@/configuration'`) won't trigger the function.
**Warning signs:** A test fails on a CI runner without `~/.hapi` permissions, but passes locally.

## Code Examples

### Deep freeze helper
```typescript
// Source: synthesized from MDN Object.freeze docs + D-165
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

### Legacy-field rejection (CLI side, mirrors hub `rejectOldSettingsFields`)
```typescript
// Source: hub/src/config/serverSettings.ts:77-86 pattern
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

### Legacy env-var rejection
```typescript
// Source: synthesized from D-161
const OLD_ENV_VARS = {
    WEBAPP_HOST: 'HAPI_LISTEN_HOST',
    WEBAPP_PORT: 'HAPI_LISTEN_PORT',
    WEBAPP_URL: 'HAPI_PUBLIC_URL',
    SERVER_URL: 'HAPI_API_URL',
} as const

function rejectOldEnvVars(): void {
    for (const [oldName, newName] of Object.entries(OLD_ENV_VARS)) {
        if (process.env[oldName] !== undefined) {
            throw new Error(
                `Unsupported legacy env var ${oldName}. ` +
                `Rename to ${newName} and restart.`
            )
        }
    }
}
```

### Frozen-config mutation test
```typescript
// Source: D-164 / D-165 + Bun test runner conventions
import { describe, it, expect } from 'bun:test'
import { loadConfig } from '@/configuration'

describe('loadConfig', () => {
    it('returns a deeply frozen config', async () => {
        const config = await loadConfig()
        expect(() => { (config as any).apiUrl = 'mutated' }).toThrow(TypeError)
        expect(() => { (config as any).extraHeaders['X-Foo'] = 'bar' }).toThrow(TypeError)
    })
})
```

### Phase-10 guard block (extend `scripts/check-no-cut-agents.sh`)
```bash
# ===== Phase 10 — Config cleanup (D-160..D-175) =====
PHASE10_SOURCE_DIRS=(cli/src hub/src)
PHASE10_TEST_GLOB=(--glob '!**/*.test.ts' --glob '!**/serverSettings.ts')

# (#1) Legacy field reads: serverUrl + webapp(Host|Port|Url|Origin)
if "$RG_BIN" -n "${PHASE10_TEST_GLOB[@]}" '\bserverUrl\b|\bwebapp(Host|Port|Url|Origin)\b' "${PHASE10_SOURCE_DIRS[@]}"; then
  echo "❌ Phase 10 D-160: legacy config field read in production source."
  exit 1
fi

# (#2) Mutable setters
if "$RG_BIN" -n '_setApiUrl|_setCliApiToken|_setExtraHeaders' "${PHASE10_SOURCE_DIRS[@]}" --glob '!**/*.test.ts'; then
  echo "❌ Phase 10 D-164/D-168: mutable config setter found in production source."
  exit 1
fi

# (#3) hapi server command alias
if "$RG_BIN" -n "name:\s*['\"]server['\"]" cli/src/commands/registry.ts; then
  echo "❌ Phase 10 D-160: hapi server command alias still registered."
  exit 1
fi

# (#4) Runtime migration files
if find hub/src -name 'migration-v*.ts' | grep -q .; then
  echo "❌ Phase 10 D-172: runtime migration-v*.ts file present."
  exit 1
fi

# (#5) getConfiguration / configuration singleton imports
PHASE10_SINGLETON=$("$RG_BIN" -n "getConfiguration\(\)|from ['\"]@/configuration['\"]|from ['\"]\\.\\./configuration['\"]" \
  "${PHASE10_SOURCE_DIRS[@]}" --glob '!**/*.test.ts' --glob '!cli/src/configuration.ts' --glob '!hub/src/configuration.ts' || true)
if [ -n "$PHASE10_SINGLETON" ]; then
  echo "$PHASE10_SINGLETON"
  echo "❌ Phase 10 D-166/D-171: production code still imports the config singleton."
  exit 1
fi

echo "✅ Phase 10 guard PASS."
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Module-level mutable singleton + setters | `loadConfig()` returning deep-frozen object + constructor DI | Phase 10 (now) | All consumers accept config as a parameter |
| `serverUrl` field with silent migration to `apiUrl` | `serverUrl` field rejected at startup with repair message | Phase 10 | One-time user action; settings file is hand-edited |
| `hapi server` as alias for `hapi hub` | `hapi server` not registered; resolves to default (cursor) or throws | Phase 10 | Users of `hapi server` see an error or fallback |
| Runtime `migration-vN.ts` per schema version | Schema mismatch → throw + point to offline tool | Already done (pre-Phase 10) | Operator runs offline tool or rebuilds DB |
| `webapp(Host|Port|Url)` settings + `WEBAPP_*` env | Rejected at startup (settings: already; env: Phase 10) | Settings: pre-Phase 10; env: Phase 10 | One-time user action |

**Deprecated/outdated:**
- `cli/src/ui/apiUrlInit.ts` — folded into `loadConfig()` bootstrap.
- `Configuration` class in both `cli/src/configuration.ts` and `hub/src/configuration.ts` — replaced by plain object factory.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All historical env aliases are `WEBAPP_HOST` / `WEBAPP_PORT` / `WEBAPP_URL` / `SERVER_URL` (no others) | Legacy Residue Map | If another alias was used historically, rejection would miss it. Verified via `git log -S "WEBAPP_HOST"` showing rename diff; no other rename commit found. Confidence MEDIUM — would benefit from one more `git log -S` for any candidate alias the planner can think of (`HAPI_URL`, `TUNNEL_*`, `RELAY_*`). |
| A2 | `cli/src/lib.ts` consumers are limited to "dev-environment cli helper programs" per the file comment, not external npm consumers | Pitfall 3 | If `lib.ts` is published to npm and used by third parties, the breaking export change has wider impact. Verified `lib.ts` exists; npm publish surface not verified. Confidence MEDIUM. |
| A3 | `web/src/hooks/useServerUrl.ts` is web-internal (browser's view of hub URL) and unrelated to the CLI `serverUrl` settings field | Legacy Residue Map | If the web's "serverUrl" leaks into a `settings.json` field via web routes, the rejection would over-fire. Spot-checked file name; full read deferred to planner. Confidence MEDIUM. |
| A4 | Phase 10 does not need a `SCHEMA_VERSION` bump | Don't Hand-Roll / D-174 | If Phase 10 incidentally tightens persisted-JSON decoding (e.g. via stricter zod schemas in `messageStore`), old persisted data could fail decoding without a version bump signaling the break. Planner must re-check during slice design. Confidence MEDIUM. |

## Open Questions

1. **Should `hapi server` throw with repair guidance, or silently fall through to the default (cursor) command?**
   - What we know: D-160 says "fail hard with repair guidance". Today the alias falls through to `hubCommand`, so silently using a non-existent alias historically *worked*. Pure deletion makes it fall through to `cursorCommand` (the default), which is confusing.
   - What's unclear: Should `resolveCommand(['server'])` throw "Use `hapi hub` instead" or fall through to the default?
   - Recommendation: **Throw** per D-160 spirit. Add a one-line special case in `resolveCommand()` that detects `args[0] === 'server'` and throws with the repair message.

2. **Should `loadConfig()` be sync or async in CLI?**
   - What we know: Hub `loadConfig()` must be async (loads cliApiToken, may read disk). CLI's current `Configuration` constructor is sync; `initializeApiUrl` + `initializeToken` are async.
   - What's unclear: Whether to merge bootstrap (which is async — reads/prompts) into `loadConfig` (making it async) or keep `loadConfig` sync and run bootstrap as a separate step.
   - Recommendation: **Async** for both packages. Symmetry > sync purity; the cost of `await loadConfig()` is negligible.

3. **Does the `cli/src/lib.ts` library export need to remain stable for any known consumer?**
   - What we know: File comment says "dev-environment cli helper programs". No npm release notes reviewed.
   - What's unclear: Whether anything external depends on `import { configuration } from 'hapi/lib'`.
   - Recommendation: Replace export; PROJECT.md explicitly states "no backward compatibility". Note in PLAN as breaking change.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | All tests + builds | ✓ | (workspace pinned, used in all phases) | — |
| `bun:sqlite` | `hub/src/store/index.ts` schema test | ✓ | bundled with bun | — |
| `ripgrep` (`rg`) | Guard script | ✓ | required by existing guard | — |
| `madge` | Not directly needed (Phase 10 doesn't touch import cycles) | — | — | — |
| `zod` | Optional CLI settings validation | ✓ | already in `hub/src/config/jwtSecret.ts` | Hand-rolled validators (preferred — matches Hub style) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (`bun:test`) for `cli/`, `hub/`, `web/`; `vitest` mock helpers in some legacy CLI tests |
| Config file | `cli/package.json`, `hub/package.json`, `web/package.json` test scripts; no top-level test config |
| Quick run command | `bun run test:cli`, `bun run test:hub`, `bun run test:web` |
| Full suite command | `bun run test` (runs all three + `test:guard`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REFC-01 | CLI `loadConfig()` throws on legacy `serverUrl` field | unit | `bun test cli/src/configuration.test.ts -t "serverUrl"` | ❌ Wave 0 |
| REFC-01 | Hub `loadServerSettings` throws on `webapp*` fields | unit | `bun test hub/src/config/serverSettings.test.ts` | ✅ (extend) |
| REFC-01 | `loadConfig()` throws on `WEBAPP_*` env vars | unit | `bun test cli/src/configuration.test.ts -t "WEBAPP"` and `bun test hub/src/configuration.test.ts -t "WEBAPP"` | ❌ Wave 0 |
| REFC-01 | `resolveCommand(['server'])` throws or falls through with repair msg | unit | `bun test cli/src/commands/registry.test.ts -t "server alias"` | ❌ Wave 0 |
| REFC-01 | `Store` constructor throws on schema-version mismatch | unit | `bun test hub/src/store/index.test.ts -t "schema mismatch"` | ❓ (verify; if absent: Wave 0) |
| REFC-01 | `Store` constructor throws on missing required tables | unit | `bun test hub/src/store/index.test.ts -t "missing table"` | ❓ (verify; if absent: Wave 0) |
| REFC-01 | `hapi hub --host X --port Y` actually binds to X:Y (regression for env-rename bug) | integration | `bun test cli/src/runner/runner.integration.test.ts -t "hub --host"` | ❌ Wave 0 (or augment existing integration test) |
| REFC-02 | `loadConfig()` returns a deeply frozen object | unit | `bun test cli/src/configuration.test.ts -t "frozen"` and `bun test hub/src/configuration.test.ts -t "frozen"` | ❌ Wave 0 |
| REFC-02 | Mutating nested `extraHeaders` / `corsOrigins` throws | unit | (same files, additional cases) | ❌ Wave 0 |
| REFC-02 | Malformed `settings.json` causes `loadConfig` to throw with path | unit | `bun test cli/src/configuration.test.ts -t "malformed"` | ❌ Wave 0 (Hub side may exist via `readSettingsOrThrow` — verify) |
| REFC-02 | Ripgrep guard rejects `getConfiguration()` / `_setApiUrl()` in production source | guard | `bun run test:guard` | ✅ (extend `scripts/check-no-cut-agents.sh`) |

### Sampling Rate
- **Per task commit:** `bun run test:<package>` for the package touched.
- **Per wave merge:** `bun run test` (all three packages + guard).
- **Phase gate:** `bun typecheck && bun run test` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `cli/src/configuration.test.ts` — new file; covers frozen object, legacy field/env rejection, malformed settings.
- [ ] `hub/src/configuration.test.ts` — new file; covers frozen object, env rejection (settings field rejection already in `serverSettings.test.ts`).
- [ ] `cli/src/commands/registry.test.ts` — new file; covers `server` alias removal.
- [ ] `hub/src/store/index.test.ts` — verify exists; if not, add schema-mismatch + missing-table tests.
- [ ] Augment `cli/src/runner/runner.integration.test.ts` with `hapi hub --host/--port` regression coverage.
- [ ] Extend `scripts/check-no-cut-agents.sh` with the Phase-10 guard block (see Code Examples).
- [ ] Audit + rewrite tests using singleton mocks: `cli/src/api/api.extraHeaders.test.ts`, `cli/src/api/hubExtraHeaders.test.ts`, `cli/src/commands/auth.test.ts`, `cli/src/commands/resume.test.ts`, `hub/src/web/routes/cli.test.ts`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | `CLI_API_TOKEN` shared-secret authentication — flow unchanged this phase; DI must preserve `constantTimeEquals` comparisons in `hub/src/web/routes/cli.ts`, `hub/src/web/routes/auth.ts`, `hub/src/socket/server.ts`. |
| V3 Session Management | no (no change) | JWT secret loaded via `getOrCreateJwtSecret`; DI just changes who passes `dataDir`. |
| V4 Access Control | no (no change) | Single-user Tailscale; no authz layer. |
| V5 Input Validation | yes | `loadConfig()` validates `settings.json` field types (D-167). Hub already does this; CLI must adopt the same. |
| V6 Cryptography | no (no change) | JWT + token primitives unchanged. |

### Known Threat Patterns for `cli + hub + bun` stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `cliApiToken` leaked via error message when validation fails | Information Disclosure | `loadConfig()` error messages must reference *field names + file path*, not values. Verify each `throw new Error(...)` site. |
| Timing attack on `cliApiToken` comparison | Spoofing | Already uses `constantTimeEquals` in 3 sites; DI conversion must preserve this. |
| Settings file with permissive permissions (group/world readable) | Information Disclosure | `loadConfig()` could optionally `chmod 0600` the settings file at write time. Out of scope for Phase 10 (not a regression introduced by this phase). |
| Malformed `settings.json` silently swallowed → defaults applied → request to wrong host | Tampering | D-167 fixes by failing fast. |
| Old `serverUrl` field pointing to a stale URL silently used after rename | Spoofing | D-160 fixes by throwing on legacy field. |

## Project Constraints (from `.cursor/rules/`)

Two workspace rules apply:

1. **`.cursor/rules/gitnexus.mdc`** — Before editing any function (e.g. `getConfiguration`, `createConfiguration`, `_setApiUrl`, `_setCliApiToken`, `_setExtraHeaders`), the planner/executor MUST run `impact` on it. GitNexus impact for `getConfiguration` returned **HIGH risk** (7 direct callers, 3 affected processes including `main`) — the PLAN must explicitly note this and include the migration as a single coordinated wave for the Hub side (cannot be split per consumer without breaking the build between commits). `detect_changes` must run before each commit.

2. **`.cursor/rules/gsd-workflow.mdc`** — Standard GSD per-slice green requirement (typecheck + tests + guard green at each plan commit).

## Sources

### Primary (HIGH confidence)
- `hub/src/configuration.ts` — current Hub singleton + setter pattern [VERIFIED: read in this session]
- `cli/src/configuration.ts` — current CLI singleton + setter pattern [VERIFIED: read in this session]
- `hub/src/config/serverSettings.ts::rejectOldSettingsFields` — proven failure-mode pattern [VERIFIED: read in this session]
- `hub/src/store/index.ts::initSchema` — current schema mismatch behavior [VERIFIED: read in this session]
- GitNexus impact analysis on `Function:hub/src/configuration.ts:getConfiguration` — HIGH risk, 7 direct callers, 3 affected processes [VERIFIED: queried this session]
- Grep across `cli/src/`, `hub/src/`, `web/src/`, `shared/src/` for all targeted patterns [VERIFIED: queried this session]
- `git log -S "WEBAPP_HOST"` — confirms historical env alias rename [VERIFIED: queried this session]
- `.planning/phases/10-config-cleanup/10-CONTEXT.md` — locked decisions D-160..D-175 [VERIFIED: read this session]
- `.planning/phases/08-hub-internal-decoupling/08-CONTEXT.md` reference (constructor DI precedent, D-139) [CITED: CONTEXT.md canonical_refs]
- `.planning/phases/09-web-internal-decoupling/09-CONTEXT.md` reference (4-slice + guard cadence, D-157/D-158) [CITED: CONTEXT.md canonical_refs]
- `scripts/check-no-cut-agents.sh` Phase 8 + Phase 9 blocks — proven guard pattern [VERIFIED: read this session]

### Secondary (MEDIUM confidence)
- MDN `Object.freeze` docs — shallow freeze + recursive freeze pattern [CITED: developer.mozilla.org]
- Bun test runner conventions for `expect(() => ...).toThrow(TypeError)` [ASSUMED — verify in any existing CLI test]

### Tertiary (LOW confidence)
- None. All claims grounded in either repo source or locked CONTEXT decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; uses existing repo conventions.
- Architecture: HIGH — DI pattern proven in Phase 8, guard pattern proven Phases 1-9.
- Pitfalls: HIGH — pitfalls 1, 3, 4 verified directly in source; pitfalls 2, 5, 6 are standard reasoning from D-170 and module-load semantics.
- Legacy residue map: HIGH — file-by-file inventory grounded in Grep results.
- GitNexus impact: HIGH for Hub (7 callers confirmed); MEDIUM for CLI (index appears stale on `cli/src/configuration.ts:configuration` — impact returned 0 callers but Grep found 30+).

**Research date:** 2026-05-23
**Valid until:** 2026-06-22 (30 days — codebase stable, no Bun major release expected)
