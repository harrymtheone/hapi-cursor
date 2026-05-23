# Phase 1: Cursor Runtime Config Contract - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 23
**Analogs found:** 23 / 23

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shared/src/schemas.ts` | model | event-driven, request-response | `shared/src/schemas.ts` | exact |
| `shared/src/types.ts` | model | transform | `shared/src/types.ts` | exact |
| `shared/src/sessionSummary.ts` | model | transform | `shared/src/sessionSummary.ts` | exact |
| `cli/src/cursor/modelDiscovery.ts` | service/utility | batch, file-I/O | `cli/src/cursor/cursorRemoteLauncher.ts` + `cli/src/modules/common/handlers/bash.ts` | role-match |
| `cli/src/cursor/modelDiscovery.test.ts` | test | batch | `cli/src/runner/buildCliArgs.test.ts` + `cli/src/cursor/runCursor.test.ts` | role-match |
| `cli/src/cursor/runCursor.ts` | service | event-driven, request-response | `cli/src/cursor/runCursor.ts` | exact |
| `cli/src/cursor/session.ts` | model | event-driven | `cli/src/cursor/session.ts` | exact |
| `cli/src/api/apiMachine.ts` | service | request-response, RPC | `cli/src/api/apiMachine.ts` | exact |
| `cli/src/modules/common/rpcTypes.ts` | model | request-response | `cli/src/modules/common/rpcTypes.ts` | exact |
| `cli/src/runner/run.ts` | service | request-response, process spawn | `cli/src/runner/run.ts` | exact |
| `hub/src/web/routes/machines.ts` | route | request-response | `hub/src/web/routes/machines.ts` | exact |
| `hub/src/web/routes/sessions/config.ts` | route | request-response | `hub/src/web/routes/sessions/config.ts` | exact |
| `hub/src/sync/rpcGateway.ts` | service | request-response, RPC | `hub/src/sync/rpcGateway.ts` | exact |
| `hub/src/sync/syncEngineSession.ts` | service | request-response, event-driven | `hub/src/sync/syncEngineSession.ts` | exact |
| `hub/src/sync/sessionConfigService.ts` | service | CRUD, event-driven | `hub/src/sync/sessionConfigService.ts` | exact |
| `web/src/api/client.ts` | service | request-response | `web/src/api/client.ts` | exact |
| `web/src/hooks/useCursorModels.ts` | hook | request-response, cache | `web/src/hooks/useMachinePathsExists.ts` | role-match |
| `web/src/components/NewSession/ModelSelector.tsx` | component | request-response | `web/src/components/NewSession/ModelSelector.tsx` | exact |
| `web/src/components/NewSession/index.tsx` | component | request-response | `web/src/components/NewSession/index.tsx` | exact |
| `web/src/components/AssistantChat/StatusBar.tsx` | component | event-driven | `web/src/components/AssistantChat/StatusBar.tsx` | exact |
| `web/src/components/AssistantChat/useHappyComposerState.ts` | hook | event-driven | `web/src/components/AssistantChat/useHappyComposerState.ts` | exact |
| `web/src/components/AssistantChat/HappyComposerOverlays.tsx` | component | event-driven | `web/src/components/AssistantChat/HappyComposerOverlays.tsx` | exact |
| `web/src/components/SessionList/SessionListItem.tsx` | component | event-driven | `web/src/components/SessionList/SessionListItem.tsx` | exact |

## Pattern Assignments

### Shared Runtime Contract Files

Apply to `shared/src/schemas.ts`, `shared/src/types.ts`, and `shared/src/sessionSummary.ts`.

**Analog:** `shared/src/schemas.ts`

**Imports/schema style** (lines 1-6):
```typescript
import { z } from 'zod'
import { PERMISSION_MODES } from './modes'

export const PermissionModeSchema = z.enum(PERMISSION_MODES)
export const SessionEndReasonSchema = z.enum(['completed', 'terminated', 'error', 'handoff'])
export type SessionEndReason = z.infer<typeof SessionEndReasonSchema>
```

**Session fields and strict patch pattern** (lines 280-316):
```typescript
export const SessionSchema = z.object({
    id: z.string(),
    // ... existing code ...
    model: z.string().nullable().optional().default(null),
    modelReasoningEffort: z.string().nullable().optional().default(null),
    effort: z.string().nullable().optional().default(null),
    permissionMode: PermissionModeSchema.optional()
})

export const SessionPatchSchema = z.object({
    active: z.boolean().optional(),
    // ... existing code ...
    model: z.string().nullable().optional(),
    modelReasoningEffort: z.string().nullable().optional(),
    effort: z.string().nullable().optional(),
    backgroundTaskCount: z.number().optional()
}).strict()
```

**Sync event validation pattern** (lines 333-395):
```typescript
export const SyncEventSchema = z.discriminatedUnion('type', [
    SessionChangedSchema.extend({
        type: z.literal('session-added'),
        data: SessionSchema
    }),
    SessionChangedSchema.extend({
        type: z.literal('session-updated'),
        data: z.union([SessionSchema, SessionPatchSchema])
    }),
    // ... existing code ...
])

export type SyncEvent = z.infer<typeof SyncEventSchema>
```

**Type export pattern** from `shared/src/types.ts` (lines 1-27):
```typescript
export type {
    AgentMessage,
    AgentState,
    // ... existing code ...
    Session,
    SessionPatch,
    SyncEvent,
    // ... existing code ...
} from './schemas'
```

**Summary transform pattern** from `shared/src/sessionSummary.ts` (lines 12-24, 26-56):
```typescript
export type SessionSummary = {
    id: string
    active: boolean
    thinking: boolean
    // ... existing code ...
    model: string | null
    effort: string | null
}

export function toSessionSummary(session: Session): SessionSummary {
    const pendingRequestsCount = session.agentState?.requests ? Object.keys(session.agentState.requests).length : 0
    // ... existing code ...
    return {
        id: session.id,
        active: session.active,
        // ... existing code ...
        model: session.model,
        effort: session.effort
    }
}
```

Planner guidance: add new discovery/apply result schemas in `shared/src/schemas.ts` first, export inferred types through `shared/src/types.ts`, and update summary only for fields that are allowed in list cache. Keep patch schemas strict.

---

### `cli/src/cursor/modelDiscovery.ts` (service/utility, batch)

**Analog:** `cli/src/cursor/cursorRemoteLauncher.ts`; secondary error-result shape from `cli/src/modules/common/handlers/bash.ts`.

**Process spawn/import pattern** (lines 1-17):
```typescript
import React from 'react';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { logger } from '@/ui/logger';
// ... existing code ...
import type { PermissionMode } from './modes';
```

**Argument array, never shell-concatenate** (lines 19-43):
```typescript
export function buildAgentArgs(opts: {
    message: string;
    cwd: string;
    sessionId: string | null;
    mode?: string;
    model?: string;
    yolo?: boolean;
}): string[] {
    const args = ['-p', opts.message, '--output-format', 'stream-json', '--trust', '--workspace', opts.cwd];
    // ... existing code ...
    if (opts.model) {
        args.push('--model', opts.model);
    }
    return args;
}
```

**Spawn/stdout/stderr pattern** (lines 162-210):
```typescript
private runAgentProcess(
    args: string[],
    cwd: string,
    onEvent: (event: ReturnType<typeof parseCursorEvent> & object) => void
): Promise<number | null> {
    return new Promise((resolve, reject) => {
        const child = spawn('agent', args, {
            cwd,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32'
        });
        // ... existing code ...
        const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
        rl.on('line', (line) => {
            const event = parseCursorEvent(line);
            if (event) {
                onEvent(event);
            }
        });

        child.stderr?.on('data', (chunk) => {
            const text = chunk.toString();
            if (text.trim()) {
                logger.debug('[cursor-remote] agent stderr:', text.trim());
            }
        });
    });
}
```

**Safe response shape for failures** from `cli/src/modules/common/handlers/bash.ts` (lines 16-22, 49-69):
```typescript
interface BashResponse {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
}

// ... existing code ...
return rpcError(getErrorMessage(execError, 'Command failed'), {
    stdout: execError.stdout ? execError.stdout.toString() : '',
    stderr: execError.stderr ? execError.stderr.toString() : execError.message || 'Command failed',
    exitCode: typeof execError.code === 'number' ? execError.code : 1
})
```

Planner guidance: implement model discovery as a small exported function that runs `agent models` or `agent --list-models` with `spawn('agent', args, ...)`, parses stdout lines, logs stderr locally, and returns a status-bearing result with a short safe reason. Use argument arrays only.

---

### CLI Runtime Config/RPC Files

Apply to `cli/src/cursor/runCursor.ts`, `cli/src/cursor/session.ts`, `cli/src/api/apiMachine.ts`, `cli/src/modules/common/rpcTypes.ts`, and `cli/src/runner/run.ts`.

**Analog:** existing Cursor runtime/config RPC path.

**Permission validation at RPC boundary** from `cli/src/cursor/runCursor.ts` (lines 19-25):
```typescript
export const resolvePermissionMode = (value: unknown): PermissionMode => {
    const parsed = PermissionModeSchema.safeParse(value);
    if (!parsed.success || !isPermissionModeAllowedForFlavor(parsed.data, 'cursor')) {
        throw new UnknownPermissionModeError(typeof value === 'string' ? value : JSON.stringify(value));
    }
    return parsed.data as PermissionMode;
};
```

**Session config RPC handler** from `cli/src/cursor/runCursor.ts` (lines 119-131):
```typescript
session.rpcHandlerManager.registerHandler('set-session-config', async (payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid session config payload');
    }
    const config = payload as { permissionMode?: unknown };

    if (config.permissionMode !== undefined) {
        currentPermissionMode = resolvePermissionMode(config.permissionMode);
    }

    syncSessionMode();
    return { applied: { permissionMode: currentPermissionMode } };
});
```

**Mutable runtime session pattern** from `cli/src/cursor/session.ts` (lines 12-17, 52-65):
```typescript
export class CursorSession extends AgentSessionBase<EnhancedMode> {
    readonly cursorArgs?: string[];
    readonly model?: string;
    readonly startedBy: 'runner' | 'terminal';
    readonly startingMode: 'local' | 'remote';
    localLaunchFailure: LocalLaunchFailure | null = null;
    // ... existing code ...
    setPermissionMode = (mode: PermissionMode): void => {
        this.permissionMode = mode;
    };

    recordLocalLaunchFailure = (message: string, exitReason: LocalLaunchExitReason): void => {
        this.localLaunchFailure = { message, exitReason };
    };
}
```

**Machine RPC handler registration** from `cli/src/api/apiMachine.ts` (lines 138-145, 275-313):
```typescript
this.rpcHandlerManager = new RpcHandlerManager({
    scopePrefix: this.machine.id,
    logger: (msg, data) => logger.debug(msg, data)
})

registerCommonHandlers(this.rpcHandlerManager, getInvokedCwd())

// ... existing code ...
this.rpcHandlerManager.registerHandler('spawn-happy-session', async (params: any) => {
    const { directory, sessionId, resumeSessionId, machineId, approvedNewDirectoryCreation, agent, model, effort, modelReasoningEffort, yolo, permissionMode, token, sessionType, worktreeName } = params || {}
    // ... existing code ...
    const result = await spawnSession({
        directory,
        sessionId,
        resumeSessionId,
        machineId,
        approvedNewDirectoryCreation,
        agent,
        model,
        effort,
        modelReasoningEffort,
        yolo,
        permissionMode,
        token,
        sessionType,
        worktreeName
    })
    // ... existing code ...
})
```

**Spawn option contract** from `cli/src/modules/common/rpcTypes.ts` (lines 1-16):
```typescript
export interface SpawnSessionOptions {
    machineId?: string
    directory: string
    sessionId?: string
    resumeSessionId?: string
    approvedNewDirectoryCreation?: boolean
    agent?: 'cursor'
    model?: string
    effort?: string
    modelReasoningEffort?: string
    yolo?: boolean
    permissionMode?: string
    token?: string
    sessionType?: 'simple' | 'worktree'
    worktreeName?: string
}
```

**Launch-time explicit-only args** from `cli/src/runner/run.ts` (lines 889-908):
```typescript
export function buildCliArgs(
  _agent: string,
  options: SpawnSessionOptions,
  yolo?: boolean
): string[] {
  const args = ['cursor'];
  if (options.resumeSessionId) {
    args.push('--resume', options.resumeSessionId);
  }
  args.push('--hapi-starting-mode', 'remote', '--started-by', 'runner');
  if (options.model) {
    args.push('--model', options.model);
  }
  if (options.permissionMode && (PERMISSION_MODES as readonly string[]).includes(options.permissionMode)) {
    args.push('--permission-mode', options.permissionMode);
  } else if (yolo) {
    args.push('--yolo');
  }
  return args;
}
```

Planner guidance: add discovery as a machine-level RPC beside `spawn-happy-session`, and change active session model changes to return a discriminated status, not bare `{ applied }`. Keep `undefined` as "not selected"; reserve `null` for explicit clearing.

---

### Hub Routes and Sync Services

Apply to `hub/src/web/routes/machines.ts`, `hub/src/web/routes/sessions/config.ts`, `hub/src/sync/rpcGateway.ts`, `hub/src/sync/syncEngineSession.ts`, and `hub/src/sync/sessionConfigService.ts`.

**Analog:** existing machine routes, config routes, and sync services.

**Machine route validation/guard style** from `hub/src/web/routes/machines.ts` (lines 1-16, 35-65):
```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { requireMachine } from './guards'

const spawnBodySchema = z.object({
    directory: z.string().min(1),
    agent: z.literal('cursor').optional(),
    model: z.string().optional(),
    effort: z.string().optional(),
    modelReasoningEffort: z.string().optional(),
    yolo: z.boolean().optional(),
    sessionType: z.enum(['simple', 'worktree']).optional(),
    worktreeName: z.string().optional()
})

// ... existing code ...
const body = await c.req.json().catch(() => null)
const parsed = spawnBodySchema.safeParse(body)
if (!parsed.success) {
    return c.json({ error: 'Invalid body' }, 400)
}

const result = await engine.spawnSession(
    machineId,
    parsed.data.directory,
    parsed.data.agent,
    parsed.data.model,
    parsed.data.modelReasoningEffort,
    parsed.data.yolo,
    parsed.data.sessionType,
    parsed.data.worktreeName,
    undefined,
    parsed.data.effort
)
return c.json(result)
```

**Composable route middleware style** from `hub/src/web/routes/sessions/config.ts` (lines 1-18, 23-49, 51-71):
```typescript
import { getPermissionModesForFlavor, isPermissionModeAllowedForFlavor, supportsModelChange } from '@hapi/protocol'
import { PermissionModeSchema } from '@hapi/protocol/schemas'
import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../../sync/syncEngine'
import { ApiRouteError } from '../../middleware/apiRouteError'
import type { WebAppEnv } from '../../middleware/auth'
import { parseJsonBody, withActiveSession, withEngine, withSession } from '../../middleware/route-helpers'

const modelSchema = z.object({
    model: z.string().trim().min(1).nullable()
})

// ... existing code ...
app.post(
    '/sessions/:id/model',
    withEngine(getSyncEngine),
    withActiveSession(),
    parseJsonBody(modelSchema),
    async (c) => {
        const session = c.get('session')
        const body = c.get('body') as z.infer<typeof modelSchema>

        if (!supportsModelChange('cursor')) {
            throw new ApiRouteError(400, 'model-change-unsupported', undefined, 'Model selection is not supported for this session')
        }
        try {
            await c.get('engine').applySessionConfig(session.id, { model: body.model })
            return c.json({ ok: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to apply model'
            throw new ApiRouteError(409, 'apply-config-failed', undefined, message)
        }
    }
)
```

**Shared route helper pattern** from `hub/src/web/middleware/route-helpers.ts` (lines 7-17, 33-47, 62-79):
```typescript
export function withEngine(
    getSyncEngine: () => SyncEngine | null
): MiddlewareHandler<WebAppEnv> {
    return async (c, next) => {
        const engine = getSyncEngine()
        if (!engine) {
            throw new ApiRouteError(503, 'engine-unavailable', undefined, 'Not connected')
        }
        c.set('engine', engine)
        await next()
    }
}

export function parseJsonBody<TSchema extends z.ZodTypeAny>(
    schema: TSchema
): MiddlewareHandler<WebAppEnv> {
    return async (c, next) => {
        let raw: unknown
        try {
            raw = await c.req.json()
        } catch {
            throw new ApiRouteError(400, 'invalid-body', undefined, 'Body is not valid JSON')
        }
        const parsed = schema.safeParse(raw)
        if (!parsed.success) {
            throw new ApiRouteError(400, 'invalid-body', parsed.error.issues)
        }
        c.set('body', parsed.data)
        await next()
    }
}
```

**RPC gateway machine/session RPC pattern** from `hub/src/sync/rpcGateway.ts` (lines 102-112, 122-172, 260-303):
```typescript
async requestSessionConfig(
    sessionId: string,
    config: {
        permissionMode?: PermissionMode
        model?: string | null
        modelReasoningEffort?: string | null
        effort?: string | null
    }
): Promise<unknown> {
    return await this.sessionRpc(sessionId, 'set-session-config', config)
}

async spawnSession(
    machineId: string,
    directory: string,
    agent: 'cursor' = 'cursor',
    model?: string,
    // ... existing code ...
): Promise<{ type: 'success'; sessionId: string } | { type: 'error'; message: string }> {
    try {
        const result = await this.machineRpc(
            machineId,
            'spawn-happy-session',
            { type: 'spawn-in-directory', directory, agent, model, modelReasoningEffort, yolo, sessionType, worktreeName, resumeSessionId, effort, permissionMode }
        )
        // validate unknown result shape before returning
    } catch (error) {
        return { type: 'error', message: error instanceof Error ? error.message : String(error) }
    }
}

private async rpcCall(method: string, params: unknown, timeoutMs: number = DEFAULT_RPC_TIMEOUT_MS): Promise<unknown> {
    const socketId = this.rpcRegistry.getSocketIdForMethod(method)
    if (!socketId) {
        throw new Error(`RPC handler not registered: ${method}`)
    }
    // ... existing code ...
    const response = await socket.timeout(timeoutMs).emitWithAck('rpc-request', {
        method,
        params: JSON.stringify(params)
    }) as unknown
    // parse string JSON response
}
```

**Active vs inactive config invariant** from `hub/src/sync/syncEngineSession.ts` (lines 176-209):
```typescript
async applySessionConfig(
    sessionId: string,
    config: {
        permissionMode?: PermissionMode
        model?: string | null
        modelReasoningEffort?: string | null
        effort?: string | null
    }
): Promise<void> {
    const session = this.sessionCache.getSession(sessionId)
    if (!session?.active) {
        this.sessionCache.applySessionConfig(sessionId, config)
        return
    }

    const result = await this.rpcGateway.requestSessionConfig(sessionId, config)
    if (!result || typeof result !== 'object') {
        throw new Error('Invalid response from session config RPC')
    }
    const applied = (result as { applied?: {
        permissionMode?: Session['permissionMode']
        model?: Session['model']
        modelReasoningEffort?: Session['modelReasoningEffort']
        effort?: Session['effort']
    } }).applied
    if (!applied || typeof applied !== 'object') {
        throw new Error('Missing applied session config')
    }

    this.sessionCache.applySessionConfig(sessionId, applied)
}
```

**Persist then emit pattern** from `hub/src/sync/sessionConfigService.ts` (lines 17-25, 31-80):
```typescript
applySessionConfig(
    sessionId: string,
    config: {
        permissionMode?: PermissionMode
        model?: string | null
        modelReasoningEffort?: string | null
        effort?: string | null
    }
): void {
    const session = this.repository.sessions.get(sessionId) ?? this.repository.refreshSession(sessionId)
    if (!session) {
        return
    }

    if (config.model !== undefined) {
        if (config.model !== session.model) {
            const stored = this.repository.store.sessions.getSession(sessionId)
            if (!stored) {
                throw new Error('Session not found')
            }
            const updated = this.repository.store.sessions.setSessionModel(sessionId, config.model, {
                touchUpdatedAt: false
            })
            if (!updated) {
                throw new Error('Failed to update session model')
            }
        }
        session.model = config.model
    }
    // ... modelReasoningEffort and effort follow the same shape ...

    this.publisher.emit({ type: 'session-updated', sessionId, data: session })
}
```

Planner guidance: machine discovery route should stay authenticated by normal web middleware and route through `SyncEngine`/`RpcGateway`, not directly shell out. Config routes should return status-bearing results for model/effort changes while preserving the active-session runtime ack before persistence.

---

### Web API, Discovery Hook, and New Session Selector

Apply to `web/src/api/client.ts`, `web/src/hooks/useCursorModels.ts`, `web/src/components/NewSession/ModelSelector.tsx`, and `web/src/components/NewSession/index.tsx`.

**Analog:** existing API client, path existence hook, and new-session panel state.

**API client method pattern** from `web/src/api/client.ts` (lines 85-125, 396-440):
```typescript
private async request<T>(
    path: string,
    init?: RequestInit,
    attempt: number = 0,
    overrideToken?: string | null
): Promise<T> {
    const headers = new Headers(init?.headers)
    // ... auth and JSON header setup ...
    const res = await fetch(this.buildUrl(path), {
        ...init,
        headers
    })
    // ... error handling ...
    return await res.json() as T
}

async getMachines(): Promise<MachinesResponse> {
    return await this.request<MachinesResponse>('/api/machines')
}

async spawnSession(
    machineId: string,
    directory: string,
    agent?: 'cursor',
    model?: string,
    yolo?: boolean,
    sessionType?: 'simple' | 'worktree',
    worktreeName?: string,
    effort?: string
): Promise<SpawnResponse> {
    return await this.request<SpawnResponse>(`/api/machines/${encodeURIComponent(machineId)}/spawn`, {
        method: 'POST',
        body: JSON.stringify({ directory, agent, model, yolo, sessionType, worktreeName, effort })
    })
}
```

**Hook request/cancellation pattern** from `web/src/hooks/useMachinePathsExists.ts` (lines 1-16, 18-41, 43-58):
```typescript
import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '@/api/client'

export function useMachinePathsExists(
    api: ApiClient,
    machineId: string | null,
    paths: string[]
): {
    pathExistence: Record<string, boolean>
    checkPathsExists: (pathsToCheck: string[]) => Promise<Record<string, boolean>>
} {
    const [pathExistence, setPathExistence] = useState<Record<string, boolean>>({})

    useEffect(() => {
        let cancelled = false

        if (!machineId || paths.length === 0) {
            setPathExistence({})
            return () => {
                cancelled = true
            }
        }

        void api.checkMachinePathsExists(machineId, paths)
            .then((result) => {
                if (cancelled) return
                setPathExistence(result.exists ?? {})
            })
            .catch(() => {
                if (cancelled) return
                setPathExistence({})
            })
        // cleanup sets cancelled = true
    }, [api, machineId, paths])
}
```

**Selector props/loading/error pattern** from `web/src/components/NewSession/ModelSelector.tsx` (lines 1-13, 20-44):
```typescript
import type { AgentType } from './types'
import { MODEL_OPTIONS } from './types'
import { useTranslation } from '@/lib/use-translation'

export function ModelSelector(props: {
    agent: AgentType
    model: string
    options?: Array<{ value: string; label: string }>
    isDisabled: boolean
    isLoading?: boolean
    error?: string | null
    onModelChange: (value: string) => void
}) {
    const { t } = useTranslation()
    const options = props.options ?? MODEL_OPTIONS[props.agent]
    // ... existing code ...
    <select
        value={props.model}
        onChange={(e) => props.onModelChange(e.target.value)}
        disabled={props.isDisabled || props.isLoading}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
    >
        {options.map((option) => (
            <option key={option.value} value={option.value}>
                {option.label}
            </option>
        ))}
    </select>
}
```

**Explicit-only launch selection** from `web/src/components/NewSession/index.tsx` (lines 38-48, 236-245, 303-308):
```typescript
const [machineId, setMachineId] = useState<string | null>(props.initialMachineId ?? null)
const [directory, setDirectory] = useState(props.initialDirectory ?? '')
const [model, setModel] = useState('auto')
const [yoloMode, setYoloMode] = useState(false)
// ... existing code ...

const resolvedModel = model !== 'auto' ? model : undefined
const result = await spawnSession({
    machineId,
    directory: trimmedDirectory,
    agent: 'cursor',
    model: resolvedModel,
    yolo: yoloMode,
    sessionType,
    worktreeName: sessionType === 'worktree' ? (worktreeName.trim() || undefined) : undefined
})

// ... existing code ...
<ModelSelector
    agent="cursor"
    model={model}
    isDisabled={isFormDisabled}
    onModelChange={setModel}
/>
```

Planner guidance: implement discovery trigger when the panel opens and a machine exists. Cache briefly in the hook, expose safe selector states, include an auto/unspecified option in web state, and pass `undefined` when the user leaves auto selected.

---

### Composer Model Status and Switching UI

Apply to `web/src/components/AssistantChat/StatusBar.tsx`, `useHappyComposerState.ts`, `HappyComposerOverlays.tsx`, `useHappyComposerHandlers.ts`, `HappyComposer.tsx`, and `SessionChat.tsx`.

**Analog:** existing composer settings and status model.

**StatusBar derived display pattern** from `web/src/components/AssistantChat/StatusBar.tsx` (lines 112-123, 158-204):
```typescript
export function StatusBar(props: {
    active: boolean
    thinking: boolean
    agentState: AgentState | null | undefined
    backgroundTaskCount?: number
    contextSize?: number
    contextCacheRead?: number
    contextWindow?: number | null
    model?: string | null
    permissionMode?: PermissionMode
    agentFlavor?: string | null
}) {
    // ... existing code ...
    const displayPermissionMode = permissionMode
        && permissionMode !== 'default'
        && isPermissionModeAllowedForFlavor(permissionMode, props.agentFlavor)
        ? permissionMode
        : null

    return (
        <div className="flex min-w-0 items-center justify-between gap-2 px-2 pb-1">
            {/* left status */}
            <div className="flex min-w-0 shrink-0 items-center gap-2">
                {displayPermissionMode ? (
                    <span className={`whitespace-nowrap text-xs ${permissionModeColor}`}>
                        {permissionModeLabel}
                    </span>
                ) : null}
            </div>
        </div>
    )
}
```

**Composer state capability gates** from `web/src/components/AssistantChat/useHappyComposerState.ts` (lines 21-49, 172-194, 197-249):
```typescript
export interface UseHappyComposerStateProps {
    sessionId?: string
    disabled?: boolean
    permissionMode?: PermissionMode
    // ... existing code ...
    model?: string | null
    modelReasoningEffort?: string | null
    effort?: string | null
    active?: boolean
    thinking?: boolean
    agentState?: AgentState | null
    backgroundTaskCount?: number
    agentFlavor?: string | null
    availableModelOptions?: Array<{ value: string | null; label: string }>
    onPermissionModeChange?: (mode: PermissionMode) => void
    onModelChange?: (model: string | null) => void
}

const permissionModeOptions = useMemo(
    () => getPermissionModeOptionsForFlavor(agentFlavor),
    [agentFlavor]
)
const modelOptions = useMemo(
    () => getModelOptionsForFlavor(agentFlavor, model, availableModelOptions),
    [agentFlavor, model, availableModelOptions]
)
const showModelSettings = Boolean(onModelChange && supportsModelChange(agentFlavor) && modelOptions.length > 0)
```

**Overlay selector pattern** from `web/src/components/AssistantChat/HappyComposerOverlays.tsx` (lines 6-21, 86-121):
```typescript
export interface HappyComposerOverlaysProps {
    showSettings: boolean
    showPermissionSettings: boolean
    showModelSettings: boolean
    permissionMode: PermissionMode
    permissionModeOptions: Array<{ mode: PermissionMode; label: string }>
    model: string | null
    modelOptions: Array<{ value: string | null; label: string }>
    // ... existing code ...
    onModelChange: (model: string | null) => void
}

{showModelSettings ? (
    <div className="py-2">
        <div className="px-3 pb-1 text-xs font-semibold text-[var(--app-hint)]">
            {t('misc.model')}
        </div>
        {modelOptions.map((option) => (
            <button
                key={option.value ?? 'auto'}
                type="button"
                disabled={controlsDisabled}
                // ... existing code ...
                onClick={() => onModelChange(option.value)}
                onMouseDown={(e) => e.preventDefault()}
            >
                {/* radio dot + label */}
            </button>
        ))}
    </div>
) : null}
```

**Handler pattern for status controls** from `web/src/components/AssistantChat/useHappyComposerHandlers.ts` (lines 181-192, 245-257):
```typescript
useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
        if (e.key === 'm' && (e.metaKey || e.ctrlKey) && onModelChange && supportsModelChange(agentFlavor)) {
            e.preventDefault()
            onModelChange(getNextModelForFlavor(agentFlavor, model, availableModelOptions))
            haptic('light')
        }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
}, [model, onModelChange, haptic, agentFlavor, availableModelOptions])

const handleModelChange = useCallback((nextModel: string | null) => {
    if (!onModelChange || controlsDisabled) return
    onModelChange(nextModel)
    setShowSettings(false)
    haptic('light')
}, [onModelChange, controlsDisabled, haptic, setShowSettings])
```

**SessionChat mutation ownership** from `web/src/components/SessionChat.tsx` (lines 226-248, 407-430):
```typescript
const handleModelChange = useCallback(async (model: string | null) => {
    try {
        await setModel(model)
        haptic.notification('success')
        props.onRefresh()
    } catch (e) {
        haptic.notification('error')
        console.error('Failed to set model:', e)
    }
}, [setModel, props.onRefresh, haptic])

// ... existing code ...
<HappyComposer
    key={props.session.id}
    sessionId={props.session.id}
    permissionMode={props.session.permissionMode}
    model={props.session.model}
    effort={props.session.effort}
    agentFlavor={agentFlavor}
    active={props.session.active}
    thinking={props.session.thinking}
    agentState={props.session.agentState}
    onPermissionModeChange={handlePermissionModeChange}
    onModelChange={handleModelChange}
/>
```

Planner guidance: keep switch feedback in the composer/status area. Disable model switching while busy by extending the existing `controlsDisabled`/`thinking` gates. Do not create chat timeline events for switch status.

---

### Session List Compact Status

Apply to `web/src/components/SessionList/SessionListItem.tsx` and tests.

**Analog:** current session row status rendering.

**Current row structure and spinner placement** (lines 121-156):
```typescript
const sessionName = getSessionTitle(s)
const todoProgress = getTodoProgress(s)
return (
    <>
        <button
            type="button"
            {...longPressHandlers}
            className={`session-list-item flex w-full flex-col gap-1 px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)] select-none rounded-lg ${selected ? 'bg-[var(--app-secondary-bg)]' : ''}`}
            style={{ WebkitTouchCallout: 'none' }}
            aria-current={selected ? 'page' : undefined}
        >
            <div className={`flex items-center justify-between gap-3 ${!s.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`truncate text-sm font-medium ${s.active ? 'text-[var(--app-fg)]' : 'text-[var(--app-hint)]'}`}>
                        {sessionName}
                    </div>
                    {s.active && s.thinking ? (
                        <LoaderIcon className="h-3.5 w-3.5 shrink-0 text-[var(--app-hint)] animate-spin-slow" />
                    ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                    {s.pendingRequestsCount > 0 ? (
                        <span className="text-[var(--app-badge-warning-text)]">
                            {t('session.item.pending')} {s.pendingRequestsCount}
                        </span>
                    ) : null}
                    <span className="text-[var(--app-hint)]">
                        {formatRelativeTime(s.updatedAt, t)}
                    </span>
                </div>
            </div>
        </button>
    </>
)
```

**Test harness pattern** from `web/src/components/SessionList/SessionListItem.test.tsx` (lines 21-45, 65-91):
```typescript
function makeSession(overrides: Partial<SessionSummary> & { id: string }): SessionSummary {
    return {
        active: true,
        thinking: false,
        activeAt: 0,
        updatedAt: Date.now(),
        metadata: { name: 'My Session', path: '' },
        todoProgress: null,
        pendingRequestsCount: 0,
        backgroundTaskCount: 0,
        model: null,
        effort: null,
        ...overrides,
    }
}

function renderWithProviders(children: ReactNode) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <I18nProvider>{children}</I18nProvider>
        </QueryClientProvider>
    )
}

it('marks the button with aria-current when selected', () => {
    renderWithProviders(
        <SessionListItem
            session={makeSession({ id: 'sess-selected', metadata: { name: 'Selected', path: '' } })}
            onSelect={vi.fn()}
            api={null}
            selected
        />
    )
    const button = screen.getByRole('button', { current: 'page' })
    expect(button).toBeInTheDocument()
})
```

Planner guidance: replace visible pending text and model text with compact indicators. Keep accessible labels via `aria-label`/`title` or visually hidden text. Add tests for running/thinking spinner, yellow dot for pending input/approval, red error, green unread completed result, and gray viewed completed result.

---

### SSE Patch Handling

Apply to `web/src/hooks/useSSE.ts` and `web/src/hooks/useSSE.test.tsx`.

**Analog:** strict event parse plus direct TanStack cache patching.

**Patch summary/detail pattern** from `web/src/hooks/useSSE.ts` (lines 207-260, 354-361):
```typescript
const patchSessionSummary = (sessionId: string, patch: SessionPatch): boolean => {
    let patched = false
    queryClient.setQueryData<SessionsResponse | undefined>(queryKeys.sessions, (previous) => {
        // ... existing code ...
        const nextSummary: SessionSummary = {
            ...current,
            active: patch.active ?? current.active,
            thinking: patch.thinking ?? current.thinking,
            activeAt: patch.activeAt ?? current.activeAt,
            updatedAt: patch.updatedAt ?? current.updatedAt,
            backgroundTaskCount: patch.backgroundTaskCount ?? current.backgroundTaskCount,
            model: Object.prototype.hasOwnProperty.call(patch, 'model') ? patch.model ?? null : current.model,
            effort: Object.prototype.hasOwnProperty.call(patch, 'effort') ? patch.effort ?? null : current.effort
        }
        // ... existing code ...
    })
    return patched
}

const patchSessionDetail = (sessionId: string, patch: SessionPatch): boolean => {
    let patched = false
    queryClient.setQueryData<SessionResponse | undefined>(queryKeys.session(sessionId), (previous) => {
        if (!previous?.session) {
            return previous
        }
        patched = true
        return {
            ...previous,
            session: {
                ...previous.session,
                ...patch
            }
        }
    })
    return patched
}

if (event.type === 'session-updated') {
    if ('metadata' in event.data) {
        queryClient.setQueryData<SessionResponse>(queryKeys.session(event.sessionId), { session: event.data })
        upsertSessionSummary(event.data)
    } else {
        patchSessionDetail(event.sessionId, event.data)
        patchSessionSummary(event.sessionId, event.data)
    }
}
```

**Strict malformed-event test pattern** from `web/src/hooks/useSSE.test.tsx` (lines 235-279, 358-374):
```typescript
it('session-updated with each other patch field mutates summary or detail correctly', async () => {
    const cases: Array<[string, SyncEvent & { type: 'session-updated' }, (queryClient: QueryClient) => void]> = [
        ['model', { type: 'session-updated', sessionId: 'session-1', data: { model: 'model-2' } }, (queryClient) => {
            expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.model).toBe('model-2')
        }],
        ['modelReasoningEffort', { type: 'session-updated', sessionId: 'session-1', data: { modelReasoningEffort: 'high' } }, (queryClient) => {
            expect(queryClient.getQueryData<{ session: Session }>(queryKeys.session('session-1'))?.session.modelReasoningEffort).toBe('high')
        }],
        ['effort', { type: 'session-updated', sessionId: 'session-1', data: { effort: 'medium' } }, (queryClient) => {
            expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.effort).toBe('medium')
        }],
    ]
    // ... existing code ...
})

it('malformed session-updated patch with unknown field logs and does not mutate', async () => {
    const { queryClient, wrapper } = createHarness()
    const seeded = { sessions: [createSummary()] }
    queryClient.setQueryData(queryKeys.sessions, seeded)
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    mountUseSSE(wrapper)

    act(() => {
        activeSource().dispatch({ type: 'session-updated', sessionId: 'session-1', data: { unknownField: 1 } })
    })

    await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled()
        expect(queryClient.getQueryData(queryKeys.sessions)).toEqual(seeded)
        expect(invalidateSpy).not.toHaveBeenCalled()
    })
})
```

Planner guidance: add any new live status fields to `SessionPatchSchema` before emitting them. If fields belong only to the composer/status box, patch detail cache; add summary fields only if session list needs them.

---

## Shared Patterns

### Auth And Route Protection
**Source:** `hub/src/web/middleware/auth.ts`
**Apply to:** all new web routes through existing server middleware.
```typescript
export function createAuthMiddleware(jwtSecret: Uint8Array): MiddlewareHandler<WebAppEnv> {
    return async (c, next) => {
        const path = c.req.path
        if (path === '/api/auth') {
            await next()
            return
        }

        const authorization = c.req.header('authorization')
        const tokenFromHeader = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined
        const tokenFromQuery = path === '/api/events' ? c.req.query().token : undefined
        const token = tokenFromHeader ?? tokenFromQuery

        if (!token) {
            return c.json({ error: 'Missing authorization token' }, 401)
        }
        // ... jwtVerify + payload validation ...
    }
}
```

### API Error Format
**Source:** `hub/src/web/middleware/apiRouteError.ts`
**Apply to:** config/discovery routes that use route helpers.
```typescript
export class ApiRouteError extends HTTPException {
    readonly code: string
    readonly details?: unknown

    constructor(
        status: ContentfulStatusCode,
        code: string,
        details?: unknown,
        message?: string
    ) {
        super(status, { message: message ?? code })
        this.code = code
        this.details = details
    }
}

export function registerApiErrorHandler(app: Hono<WebAppEnv>): void {
    app.onError((err, c) => {
        if (err instanceof ApiRouteError) {
            return c.json(
                {
                    error: {
                        code: err.code,
                        message: err.message,
                        ...(err.details !== undefined ? { details: err.details } : {})
                    }
                },
                err.status
            )
        }
        // ... existing code ...
    })
}
```

### Web Strings
**Source:** web components use `useTranslation()`.
**Apply to:** selector failures, retry labels, status labels, accessible labels.
```typescript
const { t } = useTranslation()
// ...
<label className="text-xs font-medium text-[var(--app-hint)]">
    {t('newSession.model')}{' '}
    <span className="font-normal">({t('newSession.model.optional')})</span>
</label>
```

### Test Runner Split
**Source:** `AGENTS.md`
**Apply to:** all phase tests.
```text
cli/ + web/ run under Vitest; hub/ + shared/ run under bun:test. Co-locate tests beside files under test.
```

## No Analog Found

None. `cli/src/cursor/modelDiscovery.ts` has no exact domain analog, but it has strong process-spawn and RPC response analogs in `cli/src/cursor/cursorRemoteLauncher.ts`, `cli/src/modules/common/handlers/bash.ts`, and `cli/src/api/apiMachine.ts`.

## Metadata

**Analog search scope:** `shared/src`, `cli/src/cursor`, `cli/src/api`, `cli/src/runner`, `hub/src/web/routes`, `hub/src/sync`, `web/src/api`, `web/src/hooks`, `web/src/components/NewSession`, `web/src/components/AssistantChat`, `web/src/components/SessionList`.
**Files scanned/read:** 44
**Pattern extraction date:** 2026-05-23

