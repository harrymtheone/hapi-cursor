# Phase 04: cut-deployment-infrastructure - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 20
**Analogs found:** 17 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `hub/src/index.ts` | entrypoint / orchestrator | event-driven startup | `hub/src/index.ts` current non-tunnel startup path | exact |
| `hub/src/web/server.ts` | HTTP server / route container | request-response + static file serving | `hub/src/web/server.ts` embedded/static branches | exact |
| `hub/src/tunnel/` | service deletion | event-driven subprocess | `hub/src/index.ts` shutdown + optional service wiring | deletion-target |
| `hub/tools/tunwg/` | runtime asset deletion | file-I/O | `cli/src/runtime/embeddedAssets.bun.ts` common asset list | deletion-target |
| `hub/scripts/download-tunwg.ts` | build script deletion | batch + network file-I/O | root `package.json` build scripts | deletion-target |
| `web/src/lib/relay-mode*` | web utility deletion | request-response URL routing | `hub/src/web/server.ts` local static serving | no-current-file |
| `hub/src/configuration.ts` | config facade | request-response startup config | `hub/src/config/serverSettings.ts` env/file/default loading | exact |
| `hub/src/config/settings.ts` | settings model | file-I/O | `hub/src/config/serverSettings.ts` old-field rejection | role-match |
| `hub/src/config/serverSettings.ts` | config service | file-I/O + validation | existing `rejectOldSettingsFields` | exact |
| `hub/src/config/serverSettings.test.ts` | unit test | file-I/O validation | existing old webapp field rejection test | exact |
| `cli/src/ui/logger.ts` | CLI service | file-I/O logging | local `logToFile` path in same file | exact |
| `cli/src/ui/logger.test.ts` | unit test | file-I/O + env/mock isolation | `cli/src/utils/spawnHappyCLI.test.ts`, `cli/src/api/api.extraHeaders.test.ts` | role-match |
| `cli/src/ui/doctor.ts` | CLI diagnostic command | console output | `cli/src/commands/auth.test.ts` console capture pattern | role-match |
| `cli/src/ui/doctor.test.ts` | unit test | console output | `cli/src/commands/auth.test.ts` | role-match |
| `cli/src/runtime/assets.ts` | runtime asset manager | file-I/O + batch unpack | `areToolsUnpacked` / `unpackTools` in same file | exact |
| `cli/src/runtime/embeddedAssets.bun.ts` | build-time asset manifest | file-I/O + conditional bundling | common rg/difftastic asset pattern in same file | exact |
| `cli/src/types/assetImports.d.ts` | type declaration | build-time module typing | existing `*.tar.gz` / `*-LICENSE` declarations | exact |
| `package.json` | build config | batch script orchestration | root build/test scripts | exact |
| `hub/package.json` | package config | dependency declaration | existing dependency/devDependency blocks | exact |
| `scripts/check-no-cut-agents.sh` | guard script | batch source scan | existing Phase 1-3 guard structure | exact |

## Pattern Assignments

### `hub/src/index.ts` (entrypoint, event-driven startup)

**Analog:** current `hub/src/index.ts`

**Imports pattern to preserve** (lines 10-22): keep direct local subsystem imports grouped at top; remove tunnel/qrcode imports without introducing replacement abstractions.

```typescript
import { createConfiguration, type ConfigSource } from './configuration'
import { Store } from './store'
import { SyncEngine, type SyncEvent } from './sync/syncEngine'
import { NotificationHub } from './notifications/notificationHub'
import type { NotificationChannel } from './notifications/notificationTypes'
import { startWebServer } from './web/server'
```

**Config source logging pattern** (lines 29-41): reuse `formatSource` for remaining config fields only; do not add "relay disabled" status.

```typescript
function formatSource(source: ConfigSource | 'generated'): string {
    switch (source) {
        case 'env':
            return 'environment'
        case 'file':
            return 'settings.json'
```

**Hub startup orchestration pattern** (lines 148-196): keep the local startup order: store, secrets, push, socket, sync engine, web server. Delete tunnel setup around it.

```typescript
const store = new Store(config.dbPath)
const jwtSecret = await getOrCreateJwtSecret()
const vapidKeys = await getOrCreateVapidKeys(config.dataDir)
const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@hapi.run'
const pushService = new PushService(vapidKeys, vapidSubject, store)

visibilityTracker = new VisibilityTracker()
sseManager = new SSEManager(30_000, visibilityTracker)
```

**Local URL output pattern** (lines 198-200): preserve simple text output and use `HAPI_PUBLIC_URL`/local URL semantics only.

```typescript
console.log('')
console.log('[Web] Hub listening on :' + config.listenPort)
console.log('[Web] Local:  http://localhost:' + config.listenPort)
```

**Deletion targets** (lines 43-60, 103-117, 202-260, 266-272): remove `resolveRelayFlag`, `tunnelManager`, relay CORS merge, `TunnelManager.start()`, QR direct-access generation, and `tunnelManager?.stop()`.

### `hub/src/web/server.ts` (HTTP server, request-response/static)

**Analog:** current local embedded/static serving branches in `hub/src/web/server.ts`

**Imports pattern** (lines 1-27): Hono routes stay flat and explicit; no barrel imports.

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { serveStatic } from 'hono/bun'
```

**API and auth route mounting pattern** (lines 69-96): keep HTTP behavior unchanged; relay deletion should not alter auth/API route ordering.

```typescript
app.use('*', logger())
app.get('/health', (c) => c.json({ status: 'ok', protocolVersion: PROTOCOL_VERSION }))

const configuration = getConfiguration()
const corsOrigins = options.corsOrigins ?? configuration.corsOrigins
```

**Static serving pattern to preserve** (lines 123-164): after relay branch deletion, compiled builds should continue serving embedded assets first.

```typescript
if (options.embeddedAssetMap) {
    const embeddedAssetMap = options.embeddedAssetMap
    const indexHtmlAsset = embeddedAssetMap.get('/index.html')

    if (!indexHtmlAsset) {
        app.get('*', (c) => {
            return c.text(
```

**Fallback dist serving pattern** (lines 166-198): non-compiled development serving remains the fallback.

```typescript
const { distDir, indexHtmlPath } = findWebappDistDir()

if (!existsSync(indexHtmlPath)) {
    app.get('/', (c) => {
        return c.text(
            'Mini App is not built.\n\nRun:\n  cd web\n  bun install\n  bun run build\n',
```

**Deletion target** (lines 64-65, 98-121, 210-225): remove `relayMode`, `officialWebUrl`, and hosted-web root response.

### `hub/src/configuration.ts`, `hub/src/config/settings.ts`, `hub/src/config/serverSettings.ts` (config, file-I/O + validation)

**Analog:** `hub/src/config/serverSettings.ts`

**Settings shape pattern** (`settings.ts` lines 5-19): keep settings as a narrow typed interface; remove relay settings fields rather than preserving optional compatibility fields.

```typescript
export interface Settings {
    machineId?: string
    machineIdConfirmedByServer?: boolean
    runnerAutoStartWhenRunningHappy?: boolean
    cliApiToken?: string
    vapidKeys?: {
```

**Old field rejection pattern** (`serverSettings.ts` lines 13, 69-78): extend this exact mechanism if legacy relay settings keys exist in settings JSON.

```typescript
const OLD_SETTINGS_FIELDS = ['webappHost', 'webappPort', 'webappUrl'] as const

function rejectOldSettingsFields(settings: object, settingsFile: string): void {
    const oldFields = OLD_SETTINGS_FIELDS.filter((field) => field in settings)
    if (oldFields.length === 0) {
        return
    }
```

**Env/file/default precedence pattern** (`serverSettings.ts` lines 104-148): preserve `HAPI_PUBLIC_URL`; remove only relay env reads and docs.

```typescript
let publicUrl = `http://localhost:${listenPort}`
if (process.env.HAPI_PUBLIC_URL) {
    publicUrl = process.env.HAPI_PUBLIC_URL
    sources.publicUrl = 'env'
    if (settings.publicUrl === undefined) {
        settings.publicUrl = publicUrl
```

**Configuration facade pattern** (`configuration.ts` lines 123-142): keep `createConfiguration()` as the single startup loader.

```typescript
const settingsResult = await loadServerSettings(dataDir)

if (settingsResult.savedToFile) {
    console.log(`[Hub] Configuration saved to ${getSettingsFile(dataDir)}`)
}
```

### `hub/src/config/serverSettings.test.ts` (unit test, file-I/O validation)

**Analog:** existing `hub/src/config/serverSettings.test.ts`

**Temp settings pattern** (lines 1-19): use Bun test and temp directories, with `afterEach` cleanup.

```typescript
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
```

**Explicit rejection test pattern** (lines 21-30): add relay-field cases here if old relay setting keys are represented.

```typescript
it('rejects old webapp settings fields instead of migrating them', async () => {
    dir = makeTempDir()
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({
        webappHost: '0.0.0.0',
        webappPort: 3007,
```

### `cli/src/ui/logger.ts` (CLI service, file-I/O logging)

**Analog:** local file logger path in `cli/src/ui/logger.ts`

**Imports pattern** (lines 8-13): keep local filesystem/config imports; remote upload removal should also remove now-unused `chalk` if no remaining console color path needs it.

```typescript
import chalk from 'chalk'
import { appendFileSync } from 'fs'
import { configuration } from '@/configuration'
import { existsSync, readdirSync, statSync } from 'node:fs'
```

**Constructor pattern after deletion** (lines 50-59): remove remote env gate and private remote URL field; constructor should only establish local path defaults.

```typescript
constructor(
  public readonly logFilePath = getSessionLogPath()
) {
  // Remote logging enabled only when explicitly set with API URL
  if (process.env.DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING
```

**Local file write pattern to preserve** (lines 202-229): keep append-only local file behavior and production fail-silent behavior.

```typescript
private logToFile(prefix: string, message: string, ...args: unknown[]): void {
  const logLine = `${prefix} ${message} ${args.map(arg => 
    typeof arg === 'string' ? arg : JSON.stringify(arg)
  ).join(' ')}\n`
```

**Deletion target** (lines 47-58, 180-200, 207-218): remove `dangerouslyUnencryptedServerLoggingUrl`, `sendToRemoteServer`, `fetch`, and the fire-and-forget remote branch.

### `cli/src/ui/doctor.ts` and `cli/src/ui/doctor.test.ts` (CLI diagnostic command, console output)

**Analog:** `cli/src/commands/auth.test.ts`

**Environment info pattern to shrink** (`doctor.ts` lines 24-47): keep legitimate direct-connect `HAPI_API_URL`; remove only dangerous remote-log flag.

```typescript
export function getEnvironmentInfo(): Record<string, any> {
    return {
        PWD: process.env.PWD,
        HAPI_HOME: process.env.HAPI_HOME,
        HAPI_API_URL: process.env.HAPI_API_URL,
```

**Doctor output pattern to preserve** (`doctor.ts` lines 108-122): keep local config/log diagnostics; remove the dangerous remote-log display line.

```typescript
console.log(chalk.bold('⚙️  Configuration'));
console.log(`hapi Home: ${chalk.blue(configuration.happyHomeDir)}`);
console.log(`Bot URL: ${chalk.blue(configuration.apiUrl)}`);
console.log(`Logs Dir: ${chalk.blue(configuration.logsDir)}`);
```

**Console capture test pattern** (`cli/src/commands/auth.test.ts` lines 50-65): use spy/restore in `finally`, then strip ANSI before assertions.

```typescript
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

try {
    await handleAuthCommand(['status'])
    expect(initializeApiUrlMock).toHaveBeenCalledOnce()
```

### `cli/src/runtime/assets.ts` (runtime asset manager, file-I/O + batch unpack)

**Analog:** existing rg/difftastic runtime asset flow in `cli/src/runtime/assets.ts`

**Tool readiness pattern** (lines 53-68): after tunwg deletion, readiness should only check `tools/unpacked` binaries.

```typescript
function areToolsUnpacked(unpackedPath: string): boolean {
    if (!existsSync(unpackedPath)) {
        return false;
    }

    const isWin = platform() === 'win32';
```

**Archive unpack pattern** (lines 88-131): preserve rg/difftastic archive extraction and chmod loop.

```typescript
function unpackTools(runtimeRoot: string): void {
    const platformDir = getPlatformDir();
    const toolsDir = join(runtimeRoot, 'tools');
    const archivesDir = join(toolsDir, 'archives');
```

**Compiled asset extraction pattern** (lines 138-164): keep marker/version check, copy embedded assets, unpack tools, write marker. Remove tunwg readiness/chmod from this flow.

```typescript
export async function ensureRuntimeAssets(): Promise<void> {
    if (!isBunCompiled()) {
        return;
    }

    const { loadEmbeddedAssets } = await import('#embedded-assets');
```

**Deletion target** (lines 70-86, 134-135, 163, 167-179): remove `isTunwgReady`, `ensureTunwgExecutable`, `getTunwgPath`, and any runtime readiness dependency on tunwg.

### `cli/src/runtime/embeddedAssets.bun.ts` and `cli/src/types/assetImports.d.ts` (build-time asset manifest/types)

**Analog:** rg/difftastic manifest entries in the same files.

**Common asset pattern** (`embeddedAssets.bun.ts` lines 1-27): common assets are explicit imports plus `asset(...)` entries. Delete tunwg license import/entry; keep rg/difftastic licenses.

```typescript
import { feature } from 'bun:bundle';

import difftasticArchiveLicense from '../../tools/archives/difftastic-LICENSE' assert { type: 'file' };
import ripgrepArchiveLicense from '../../tools/archives/ripgrep-LICENSE' assert { type: 'file' };
```

**Target-specific asset pattern** (`embeddedAssets.bun.ts` lines 29-45): each target imports only platform-specific archives. Remove the third tunwg import and `asset('tools/tunwg/...')`.

```typescript
if (feature('HAPI_TARGET_DARWIN_ARM64')) {
    const [
        { default: difftasticArm64Darwin },
        { default: ripgrepArm64Darwin },
        { default: tunwgArm64Darwin }
```

**Asset import declarations pattern** (`assetImports.d.ts` lines 1-14): keep generic file asset declarations; delete tunwg-specific declarations.

```typescript
declare module '*.tar.gz' {
    const path: string;
    export default path;
}

declare module '*-LICENSE' {
```

### `package.json`, `hub/package.json`, `hub/scripts/download-tunwg.ts`, `hub/tools/tunwg/` (build/package config, batch + file-I/O)

**Analog:** root build/test scripts and hub dependency blocks.

**Root script pattern** (`package.json` lines 8-12): remove `download:tunwg` and its use from single-exe scripts; leave web build, embedded web asset generation, and CLI all-in-one build.

```json
"build": "bun run build:cli && bun run build:hub && bun run build:web",
"build:cli": "cd cli && bun run build",
"build:single-exe": "bun run download:tunwg && bun run build:web && (cd hub && bun run generate:embedded-web-assets) && (cd cli && bun run build:exe:allinone)",
"build:single-exe:all": "bun run download:tunwg && bun run build:web && (cd hub && bun run generate:embedded-web-assets) && (cd cli && bun run build:exe:allinone:all)",
```

**Hub dependency pattern** (`hub/package.json` lines 17-32): remove `qrcode` and `@types/qrcode` only; do not disturb Hono/socket/push deps.

```json
"dependencies": {
    "@hapi/protocol": "workspace:*",
    "@socket.io/bun-engine": "^0.1.0",
    "hono": "^4.11.2",
    "jose": "^6.1.3",
    "qrcode": "^1.5.4",
```

**Deletion target** (`hub/scripts/download-tunwg.ts` lines 14-22, 41-79): delete the script rather than rewriting it; the build must not download external tunnel binaries.

### `scripts/check-no-cut-agents.sh` (guard script, batch source scan)

**Analog:** existing Phase 1-3 guard in `scripts/check-no-cut-agents.sh`

**rg fallback pattern** (lines 21-28): keep the robust `rg` lookup/fallback.

```bash
if command -v rg >/dev/null 2>&1; then
  RG_BIN="rg"
elif [ -x "/usr/share/cursor/resources/app/node_modules/@vscode/ripgrep/bin/rg" ]; then
  RG_BIN="/usr/share/cursor/resources/app/node_modules/@vscode/ripgrep/bin/rg"
```

**Pattern + whitelist shape** (lines 30-43): add a Phase 04 pattern separately instead of mixing with old agent/channel guard. D-66 default whitelist is only `.planning/codebase/` and `CHANGELOG.md`, plus unavoidable infra like `.git`, `node_modules`, lockfiles, and this guard file if needed.

```bash
PATTERN='\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b'
PHASE3_PATTERN='namespace|:ns'
PHASE3_SOURCE_DIRS=(cli/src hub/src web/src shared/src)
WHITELIST=(
```

**Fail message pattern** (lines 129-146): each phase-specific scan should fail with a clear remediation message and then print a success line.

```bash
if "$RG_BIN" -i "${WHITELIST[@]}" "$PATTERN" .; then
  echo ""
  echo "❌ Non-Cursor / external-channel literals found outside whitelist."
```

### `cli/src/ui/logger.test.ts` (new unit test, file-I/O + env/mock isolation)

**Analogs:** `cli/src/utils/spawnHappyCLI.test.ts`, `cli/src/api/api.extraHeaders.test.ts`

**Hoisted mock pattern** (`api.extraHeaders.test.ts` lines 4-19): use `vi.hoisted` and module mocks when logger imports make direct setup order matter.

```typescript
const axiosPostMock = vi.hoisted(() => vi.fn())
const ioMock = vi.hoisted(() => vi.fn())

vi.mock('axios', () => ({
    default: {
        post: axiosPostMock
```

**Env restore pattern** (`spawnHappyCLI.test.ts` lines 37-80): snapshot original env values and restore in setup/cleanup so tests do not poison the process.

```typescript
const originalInvokedCwd = process.env.HAPI_INVOKED_CWD;
const originalCliExecutable = process.env.HAPI_CLI_EXECUTABLE;

function setPlatform(value: string) {
  Object.defineProperty(process, 'platform', {
```

**Assertion target:** prove `logger.debug/info/warn` writes local file and never calls `fetch` even when `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` and `HAPI_API_URL` are set.

### `cli/src/ui/doctor.test.ts` (new unit test, console output)

**Analog:** `cli/src/commands/auth.test.ts`

**Console spy + ANSI strip pattern** (lines 30-65): use this to assert output does not contain dangerous remote-log labels while preserving `HAPI_API_URL`, local logs dir, and runner diagnostics.

```typescript
function stripAnsi(value: string): string {
    return value.replace(/\u001B\[[0-9;]*m/g, '')
}

const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
```

## Shared Patterns

### Deletion-First TypeScript Cleanup

**Source:** `hub/src/index.ts`, `cli/src/runtime/assets.ts`, `cli/src/runtime/embeddedAssets.bun.ts`
**Apply to:** tunnel manager, tunwg script/assets, qrcode import, runtime tunwg helper, relay web branch

Remove imports/types/calls first, then rely on `bun typecheck` to expose dangling references. Do not leave no-op stubs or disabled status branches.

### Neutral Public URL Preservation

**Source:** `hub/src/config/serverSettings.ts`, `hub/src/index.ts`
**Apply to:** `hub/src/index.ts`, `hub/src/configuration.ts`, `hub/src/web/server.ts`

```typescript
let publicUrl = `http://localhost:${listenPort}`
if (process.env.HAPI_PUBLIC_URL) {
    publicUrl = process.env.HAPI_PUBLIC_URL
    sources.publicUrl = 'env'
```

Keep `HAPI_PUBLIC_URL` and local URL output for user-managed Tailscale. Remove `HAPI_OFFICIAL_WEB_URL`, hosted relay URL construction, tokenized direct-access QR generation, and relay-derived CORS additions.

### Settings Fail-Fast

**Source:** `hub/src/config/serverSettings.ts`
**Apply to:** relay settings cleanup

```typescript
function rejectOldSettingsFields(settings: object, settingsFile: string): void {
    const oldFields = OLD_SETTINGS_FIELDS.filter((field) => field in settings)
    if (oldFields.length === 0) {
        return
    }
    throw new Error(
```

If old relay fields are known, add them to this rejection set. Do not use `.passthrough()`, silent ignore, or migration shims.

### CLI Local-Only Diagnostics

**Source:** `cli/src/ui/logger.ts`, `cli/src/ui/doctor.ts`
**Apply to:** logger and doctor cleanup

```typescript
try {
  appendFileSync(this.logFilePath, logLine)
} catch (appendError) {
  if (process.env.DEBUG) {
    console.error('[DEV MODE ONLY THROWING] Failed to append to log file:', appendError)
```

Keep local file/console behavior. Remove remote upload code and dangerous env display. `HAPI_API_URL` remains legitimate direct-connect config outside the logger upload path.

### Runtime Asset Boundary

**Source:** `cli/src/runtime/assets.ts`, `cli/src/runtime/embeddedAssets.bun.ts`
**Apply to:** tunwg asset removal

```typescript
const archives = [
    `difftastic-${platformDir}.tar.gz`,
    `ripgrep-${platformDir}.tar.gz`
];
```

Preserve `ripgrep` and `difftastic` extraction. Only remove tunwg binary readiness, chmod, import declarations, build download, embedded asset entries, and tracked `hub/tools/tunwg/` source asset.

### Guard Script Extension

**Source:** `scripts/check-no-cut-agents.sh`
**Apply to:** Phase 04 keyword validation

```bash
if "$RG_BIN" -n "$PHASE3_PATTERN" "${PHASE3_SOURCE_DIRS[@]}"; then
  echo ""
  echo "❌ Phase-3 namespace residue found in runtime source scope."
```

Add a Phase 04 scan for `tunwg`, `HAPI_RELAY_`, `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`, and plan-level sweeps for `relay-mode`, `relayMode`, `officialWebUrl`, `app.hapi.run`, and `download-tunwg`. Keep whitelist tight and explicit.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `web/src/lib/relay-mode*` | web utility deletion | request-response URL routing | No current files matched `web/src/lib/relay-mode*`; use `hub/src/web/server.ts` local serving as the remaining behavior analog. |
| `hub/src/tunnel/` | service deletion | event-driven subprocess | Existing code is the feature being deleted. No replacement service should be created. |
| `hub/tools/tunwg/` | runtime asset deletion | file-I/O | Asset directory is removed outright; copy rg/difftastic asset patterns only to preserve non-tunwg tools. |

## Metadata

**Analog search scope:** `hub/src`, `cli/src`, `web/src/lib`, `scripts`, root and hub `package.json`
**Files scanned:** 20 direct reads plus targeted grep/glob searches
**GitNexus query:** `relay tunnel startup tunwg hosted web remote logging runtime assets`
**Key flows found:** `main -> Configuration`, `main -> TunnelManager.spawnTunwg`, `createWebApp`, `ensureRuntimeAssets`, `selectEmbeddedAssets`, `download-tunwg main`
**Pattern extraction date:** 2026-05-21
