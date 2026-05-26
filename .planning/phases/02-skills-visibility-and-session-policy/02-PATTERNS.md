# Phase 2: Skills Visibility and Session Policy - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 28 new/modified/touched
**Analogs found:** 24 / 28

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shared/src/schemas.ts` | model | transform | `CursorModelSummarySchema` + `MetadataSchema` | exact |
| `shared/src/types.ts` | config | — | existing type re-exports from `schemas.ts` | exact |
| `shared/src/schemas.test.ts` | test | transform | `SessionPatchSchema` + `MetadataSchema` tests | exact |
| `cli/src/modules/common/skills.ts` | utility | file-I/O | same file (extend) | exact |
| `cli/src/modules/common/skills.test.ts` | test | file-I/O | same file (extend) | exact |
| `cli/src/modules/common/handlers/skills.ts` | controller | request-response | same file | exact |
| `hub/src/web/routes/sessions/read.ts` | route | request-response | `GET .../slash-commands` in same file | exact |
| `hub/src/web/routes/sessions/config.ts` (or new policy route) | route | request-response | `POST .../model`, `POST .../permission-mode` | exact |
| `hub/src/web/routes/sessions/__tests__/read.test.ts` | test | request-response | skills test block (lines 80–89) | exact |
| `hub/src/web/routes/sessions/__tests__/config.test.ts` (new policy tests) | test | request-response | model route tests in same file | exact |
| `hub/src/sync/sessionConfigService.ts` | service | CRUD | `renameSession` metadata path | exact |
| `hub/src/sync/sessionConfigService.test.ts` | test | CRUD | `renameSession` test (lines 124–134) | exact |
| `hub/src/sync/syncEngine.ts` + `syncEngineSession.ts` | service | CRUD | `renameSession` / `applySessionConfig` facade | role-match |
| `hub/src/sync/sessionRepository.ts` | service | CRUD | `refreshSession` after metadata write | exact |
| `hub/src/sync/sessionModel.test.ts` (resume + policy persist) | test | CRUD | model persist + resume tests | role-match |
| `web/src/types/api.ts` | model | — | remove `SkillSummary` (use protocol) | exact |
| `web/src/api/client.ts` | service | request-response | `getSkills` + `setModel` / `setPermissionMode` | exact |
| `web/src/hooks/queries/useSkills.ts` | hook | request-response | same file + policy filter | exact |
| `web/src/hooks/mutations/useSessionActions.ts` (or dedicated hook) | hook | request-response | `modelMutation` / `permissionMutation` | exact |
| `web/src/hooks/useSSE.ts` | hook | pub-sub | `'metadata' in event.data` branch | exact |
| `web/src/routes/settings/skills.tsx` | route | request-response | `web/src/routes/settings/models.tsx` | role-match |
| `web/src/routes/settings/_sections/SkillsSection.tsx` | component | request-response | `ModelsSection.tsx` | exact |
| `web/src/routes/settings/index.tsx` | route | request-response | `ModelsSection` import | exact |
| `web/src/router.tsx` | route | request-response | `settingsModelsRoute` | exact |
| `web/src/hooks/useAppGoBack.ts` | hook | request-response | `/settings/models` branch | exact |
| `web/src/components/AssistantChat/SkillsPolicySheet.tsx` (name TBD) | component | event-driven | `ModelPickerOverlay` + `HappyComposerOverlays` permission block | role-match |
| `web/src/components/AssistantChat/useHappyComposerState.ts` | hook | event-driven | `settingsOverlay: 'model' \| 'permission'` | role-match |
| `web/src/components/AssistantChat/HappyComposerOverlays.tsx` | component | event-driven | model/permission overlay branches | role-match |
| `web/src/lib/recent-skills.ts` | utility | file-I/O | keep as-is (recency only, D-18) | exact |
| `web/src/lib/locales/en.ts`, `zh-CN.ts` | config | — | `settings.models.*` / `composer.modelPicker.*` | exact |

## Pattern Assignments

### `shared/src/schemas.ts` — `SkillSummarySchema`, `SkillPolicyState`, `MetadataSchema.skillPolicy`

**Analog:** `CursorModelSummarySchema` (lines 298–305) + `MetadataSchema` (lines 27–51)

**Strict Zod object pattern** (CursorModelSummary):

```typescript
export const CursorModelSummarySchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
    isCurrent: z.boolean().optional()
}).strict()
```

**Target SkillSummary** (per CONTEXT D-03):

```typescript
export const SkillPolicyStateSchema = z.enum(['inherited', 'enabled', 'disabled'])
export type SkillPolicyState = z.infer<typeof SkillPolicyStateSchema>

export const SkillSummarySchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    source: z.enum(['project', 'user']),
    invocationMode: z.string().optional(),
    valid: z.boolean(),
    invalidReason: z.string().optional(),
    pathHint: z.string().optional()
}).strict()

export const ListSkillsResponseSchema = z.object({
    success: z.boolean(),
    skills: z.array(SkillSummarySchema).optional(),
    error: z.string().optional()
}).strict()
```

**Metadata extension** (append to `MetadataSchema`, do not use `.passthrough()` — Pitfall 5):

```typescript
skillPolicy: z.record(z.string(), SkillPolicyStateSchema).optional()
```

**Exports:** Add `SkillSummary`, `SkillPolicyState`, `ListSkillsResponse` to `shared/src/types.ts` re-export block (lines 1–31).

**Tests:** Mirror `SessionPatchSchema` strict unknown-key rejection in `shared/src/schemas.test.ts`; add `SkillSummarySchema` parse fixtures for valid/invalid rows.

**Do not** add `skillPolicy` to `SessionPatchSchema` unless planner chooses top-level patch — CONTEXT D-06 stores policy on **metadata**; SSE convergence uses full session when `metadata` is present (see `useSSE.ts` below).

---

### `cli/src/modules/common/skills.ts` (utility, file-I/O)

**Analog:** Same file — extend `listSkills`, `extractSkillSummary`, root walkers

**Root lists** (lines 24–35) — extend arrays, keep homedir helper:

```typescript
function getUserSkillsRoots(): string[] {
    const home = getHomeDirectory();
    return [
        join(home, '.agents', 'skills'),
        join(home, '.cursor', 'skills'),
    ];
}

function getProjectSkillsRoots(directory: string): string[] {
    return [
        join(directory, '.agents', 'skills'),
        join(directory, '.cursor', 'skills'),
    ];
}
```

**Git-root walk** (lines 46–68) — reuse `listProjectSkillsRoots`; no rewrite.

**Frontmatter parse** (lines 70–84, 86–98) — extend `extractSkillSummary` to return protocol shape: `source`, `invocationMode`, `valid`, `invalidReason`, `pathHint` (redact home). Invalid frontmatter → `valid: false` + reason, still listed (D-04).

**Dedup** (lines 151–161) — keep `Map<string, SkillSummary>`; project before user; nested walk replaces `listTopLevelSkillDirs` only.

**Imports:** Move `SkillSummary` type import from `@hapi/protocol` once promoted (remove local interface).

---

### `cli/src/modules/common/skills.test.ts` (test, file-I/O)

**Analog:** Same file (lines 7–17, 41–108)

**Fixture helper** `writeSkill` — extend for nested paths, `.cursor/skills`, invalid YAML, `invocationMode` frontmatter.

**Sandbox pattern** (lines 24–39): `mkdtemp`, override `HOME`, `afterEach` restore.

**New cases:** `.cursor/skills` roots; nested `SKILL.md`; invalid skill in list with `valid: false`; dedupe across roots.

**Run:** `cd cli && bunx vitest run src/modules/common/skills.test.ts`

---

### `cli/src/modules/common/handlers/skills.ts` (RPC handler)

**Analog:** Same file (lines 6–17)

```typescript
rpcHandlerManager.registerHandler<ListSkillsRequest, ListSkillsResponse>('listSkills', async () => {
    try {
        const skills = await listSkills(workingDirectory)
        return { success: true, skills }
    } catch (error) {
        return rpcError(getErrorMessage(error, 'Failed to list skills'))
    }
})
```

Update `ListSkillsResponse` to import from `@hapi/protocol/schemas` after promotion.

---

### `hub/src/web/routes/sessions/read.ts` — `GET /sessions/:id/skills`

**Analog:** `GET /sessions/:id/slash-commands` (lines 70–100) and skills route (lines 102–114)

```typescript
app.get('/sessions/:id/skills', withEngine(getSyncEngine), withSession(), async (c) => {
    const engine = c.get('engine')
    const session = c.get('session')
    try {
        const result = await engine.listSkills(session.id)
        return c.json(result)
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list skills'
        })
    }
})
```

Response body should validate against `ListSkillsResponseSchema` at planner discretion; RPC bridge unchanged in `rpcGateway.listSkills`.

---

### `hub/src/web/routes/sessions/config.ts` — skill policy write route

**Analog:** `POST /sessions/:id/model` (lines 51–68) for route shell; **`renameSession` + `updateSessionMetadata`** for persistence semantics (metadata, not `applySessionConfig`)

**Route shell** (model route):

```typescript
app.post(
    '/sessions/:id/model',
    withEngine(getSyncEngine),
    withSession(),
    parseJsonBody(modelSchema),
    async (c) => {
        const session = c.get('session')
        const body = c.get('body') as z.infer<typeof modelSchema>
        try {
            const result = await c.get('engine').applySessionConfig(session.id, { model: body.model })
            return c.json(result)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to apply model'
            throw new ApiRouteError(409, 'apply-config-failed', undefined, message)
        }
    }
)
```

**Policy route target:** `POST /sessions/:id/skill-policy` (or `PATCH` body) with Zod body e.g. `{ skillPolicy: Record<string, SkillPolicyState> }` or single `{ name, state }` — call new `engine.updateSessionSkillPolicy(sessionId, patch)` that mirrors `sessionConfigService.renameSession`:

```typescript
const currentMetadata = session.metadata ?? { path: '', host: '' }
const newMetadata = { ...currentMetadata, skillPolicy: mergedPolicy }
const result = this.repository.store.sessions.updateSessionMetadata(
    sessionId,
    newMetadata,
    session.metadataVersion,
    { touchUpdatedAt: false }
)
// version-mismatch → 409; then repository.refreshSession(sessionId)
```

`refreshSession` emits **full** `Session` including parsed `metadata` (`sessionRepository.ts` lines 94–140) — Web replaces cache when `'metadata' in event.data`.

---

### `hub/src/sync/sessionConfigService.ts` — `updateSessionSkillPolicy` / bulk reset

**Analog:** `renameSession` (lines 59–84)

```typescript
async renameSession(sessionId: string, name: string): Promise<void> {
    const session = this.repository.sessions.get(sessionId)
    // ...
    const newMetadata = { ...currentMetadata, name }
    const result = this.repository.store.sessions.updateSessionMetadata(
        sessionId,
        newMetadata,
        session.metadataVersion,
        { touchUpdatedAt: false }
    )
    if (result.result === 'version-mismatch') {
        throw new Error('Session was modified concurrently. Please try again.')
    }
    this.repository.refreshSession(sessionId)
}
```

**Test analog** (`sessionConfigService.test.ts` lines 124–134): assert SQLite metadata `skillPolicy` and cache after update; add resume reload test in `sessionModel.test.ts` per PITFALLS table.

**Contrast:** Do **not** use `applySessionConfig` for policy — that path is for top-level `model` / `permissionMode` and emits partial `SessionPatch`-shaped updates (`sessionConfigService.ts` lines 17–56).

---

### `web/src/types/api.ts` — remove duplicate `SkillSummary`

**Analog:** `CursorModelSummary` usage from `@hapi/protocol/types` in web hooks

Delete lines 149–158; import `SkillSummary`, `SkillsResponse` (or `ListSkillsResponse`) from protocol in `client.ts` and `useSkills.ts`.

---

### `web/src/api/client.ts` — discovery + policy mutation

**Analog:** `getSkills` (lines 447–451) + `setPermissionMode` (lines 344–349)

```typescript
async getSkills(sessionId: string): Promise<SkillsResponse> {
    return await this.request<SkillsResponse>(
        `/api/sessions/${encodeURIComponent(sessionId)}/skills`
    )
}

async setSkillPolicy(sessionId: string, skillPolicy: Record<string, SkillPolicyState>): Promise<void> {
    await this.request(`/api/sessions/${encodeURIComponent(sessionId)}/skill-policy`, {
        method: 'POST',
        body: JSON.stringify({ skillPolicy })
    })
}
```

Use protocol types for request/response shapes.

---

### `web/src/hooks/queries/useSkills.ts` (hook, request-response)

**Analog:** Same file (lines 21–33, 42–84)

**Query pattern** (unchanged):

```typescript
const query = useQuery({
    queryKey: queryKeys.skills(resolvedSessionId),
    queryFn: async () => {
        if (!api || !sessionId) throw new Error('Session unavailable')
        return await api.getSkills(sessionId)
    },
    enabled: Boolean(api && sessionId),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
})
```

**Policy-aware suggestions (D-12):** Accept `skillPolicy: Record<string, SkillPolicyState> | undefined` (from session metadata). Filter before map:

```typescript
function isSkillSuggestible(name: string, policy: Record<string, SkillPolicyState> | undefined): boolean {
    const state = policy?.[name] ?? 'inherited'
    return state !== 'disabled'
}
```

Apply in both empty-query and fuzzy branches; keep `getRecentSkills()` sort — recency does not override disabled (D-18).

**Optional:** `useSkillsCatalog(api, sessionId)` wrapper for settings page — same query key if same session.

---

### `web/src/hooks/mutations/useSessionActions.ts` — policy mutation

**Analog:** `permissionMutation` (lines 62–73)

```typescript
const skillPolicyMutation = useMutation({
    mutationFn: async (skillPolicy: Record<string, SkillPolicyState>) => {
        if (!api || !sessionId) throw new Error('Session unavailable')
        await api.setSkillPolicy(sessionId, skillPolicy)
    },
    onSuccess: () => void invalidateSession(),
})
```

Rely on SSE full-session replace for metadata; invalidation is safety net (same as permission mode).

---

### `web/src/hooks/useSSE.ts` — metadata session updates

**Analog:** `session-updated` handler (lines 403–410)

```typescript
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

Skill policy changes must go through `refreshSession` → full session payload with `metadata` so TanStack cache picks up `skillPolicy` without extending `SessionPatchSchema`.

---

### `web/src/routes/settings/skills.tsx` (read-only catalog)

**Analog:** `web/src/routes/settings/models.tsx` (page shell lines 66–80) + **session-scoped** `useSkills`

**Page shell** (models.tsx):

```typescript
<div className="flex h-full min-h-0 flex-col">
    <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-content flex items-center gap-2 p-3 border-b ...">
            <button type="button" onClick={goBack} ...><BackIcon /></button>
            <div className="flex-1 font-semibold">{t('settings.skills.title')}</div>
        </div>
    </div>
    <div className="app-scroll-y flex-1 min-h-0">...</div>
</div>
```

**D-15:** No policy toggles on this page — list rows show `source`, `invocationMode`, validity badge, `pathHint`. Discovery requires a **session id** (e.g. last-active session from router context or explicit picker) — unlike models page which uses `useCursorModels(machineId)`. Partial analog: document planner choice for catalog session source.

**Error/loading:** Reuse `CursorModelDiscoveryStatus` pattern only if shared status component fits; otherwise mirror `ModelSelector` conditional blocks from 01.1-PATTERNS.

---

### `web/src/routes/settings/_sections/SkillsSection.tsx`

**Analog:** `ModelsSection.tsx` (full file)

```typescript
<button
    type="button"
    onClick={() => navigate({ to: '/settings/skills' })}
    className="flex w-full items-center justify-between px-3 py-3 text-left ..."
>
    <span>{t('settings.skills.rowTitle')}</span>
    <span className="flex items-center gap-1 text-[var(--app-hint)]">
        <span className="text-sm">{subtitle}</span>
        <ChevronRightIcon />
    </span>
</button>
```

Subtitle: discovery count or “Not loaded” — **not** policy summary (policy is session-only per D-15).

---

### `web/src/router.tsx` + `useAppGoBack.ts`

**Analog:** Phase 01.1 — `settingsModelsRoute` (router ~665–669), goBack branch

```typescript
const settingsSkillsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings/skills',
    component: SkillsSettingsPage,
})
```

```typescript
if (pathname === '/settings/skills') {
    navigate({ to: '/settings' })
    return
}
```

Session chat: wire `useSkills` policy from `session.metadata?.skillPolicy`; add composer affordance parallel to model (extend `settingsOverlay` union in `useHappyComposerState.ts` line 112).

---

### `web/src/components/AssistantChat/*` — session policy sheet

**Analog:** `HappyComposerOverlays.tsx` permission block (lines 43–83) for tri-state rows; `ModelPickerOverlay` for scrollable list + footer link

**Tri-state row:** Three `button` rows with radio-style selected dot (same CSS as permission mode). Labels: inherited / enabled / disabled + i18n explanation for inherited.

**Enforcement badge (D-11):** Small hint text `t('session.skills.enforcement.hapiPolicy')` — never `Cursor enforced` without verified CLI hook.

**Bulk reset:** Single row calling `setSkillPolicy({})` or dedicated reset endpoint that clears map → all implicit inherited (D-07).

**Footer (optional):** `navigate({ to: '/settings/skills' })` for read-only catalog — mirror ModelPickerOverlay manage link.

Extend `settingsOverlay` type:

```typescript
const [settingsOverlay, setSettingsOverlay] = useState<'model' | 'permission' | 'skills' | null>(null)
```

---

### `web/src/lib/recent-skills.ts`

**Analog:** Same file — **no policy fields** (D-18)

Keep `markSkillUsed` / `getRecentSkills` for autocomplete ranking only.

---

### `web/src/lib/locales/en.ts`, `zh-CN.ts`

**Analog:** `settings.models.*`, `composer.modelPicker.*` (01.1-PATTERNS)

Add parallel trees:

- `settings.skills.title`, `settings.skills.sectionTitle`, `settings.skills.rowTitle`, `settings.skills.catalog.*` (source, validity, invocation)
- `session.skills.*` (sheet title, tri-state labels, inherited help, enforcement badge, reset all)

Mirror every key in `zh-CN.ts`.

---

## Shared Patterns

### Shared-first wire contracts (Pitfall 5)

**Source:** `shared/src/schemas.ts` + `shared/src/schemas.test.ts`  
**Apply to:** CLI handler types, hub route JSON, web `api/client.ts`, remove `web/src/types/api.ts` duplicates

Promote `SkillSummary` to Zod in shared; strict `.strict()` on new schemas; extend `MetadataSchema` only (no `.passthrough()` on `SessionPatchSchema`).

### Session metadata write + SSE full session

**Source:** `hub/src/sync/sessionConfigService.ts` `renameSession` + `hub/src/sync/sessionRepository.ts` `refreshSession`  
**Apply to:** All `skillPolicy` Hub writes

Versioned `updateSessionMetadata` → `refreshSession` → emit session with `metadata` → `useSSE` full replace.

### Session config route + ApiRouteError

**Source:** `hub/src/web/routes/sessions/config.ts`  
**Apply to:** Policy POST route

`withEngine`, `withSession`, `parseJsonBody(zodSchema)`, `ApiRouteError(409, ...)` on conflict.

### TanStack query + mutation

**Source:** `useSkills.ts` + `useSessionActions.ts`  
**Apply to:** Discovery query; policy mutation with `invalidateSession` fallback

`queryKeys.skills(sessionId)`; `staleTime: Infinity` for discovery list.

### Settings drill-down (01.1) — visibility only

**Source:** `ModelsSection.tsx`, `settings/models.tsx`, `useAppGoBack.ts`  
**Apply to:** `/settings/skills` read-only catalog

**Critical difference (D-15 vs 01.1 D-03):** Model family visibility uses `useVisibleModelFamilies` localStorage — **skill policy must NOT** copy that pattern; policy lives in `session.metadata.skillPolicy` only.

### Composer overlay UI

**Source:** `HappyComposerOverlays.tsx`, `FloatingOverlay.tsx`  
**Apply to:** `SkillsPolicySheet` in session chat

`FloatingOverlay`, `onMouseDown={(e) => e.preventDefault()}`, disabled styling when `controlsDisabled`.

### Phase 01.1 model picker (reference only)

**Source:** `.planning/phases/01.1-model-picker-ux-family-visibility-filter-auto-only-new-sessi/01.1-PATTERNS.md`  
**Apply to:** Settings navigation shell, composer overlay placement, i18n structure — **not** localStorage persistence model.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `web/src/routes/settings/skills.tsx` | route | request-response | No machine-global skill discovery; needs session/context strategy (D-15) |
| Tri-state per-skill control | component | event-driven | No 3-way toggle in codebase; compose from permission radio rows × 3 states |
| CLI nested `SKILL.md` walk | utility | file-I/O | Only top-level dirs today; greenfield walk algorithm (D-02 discretion) |
| Turn-time skill filter (CLI prompt) | utility | transform | No existing prompt-layer skill deny; planner + research (D-10) |

Planner should use RESEARCH.md / CONTEXT D-10 for enforcement layer; use permission overlay for tri-state UX.

---

## Metadata

**Analog search scope:** `cli/src/modules/common/`, `hub/src/web/routes/sessions/`, `hub/src/sync/`, `shared/src/`, `web/src/hooks/`, `web/src/routes/settings/`, `web/src/components/AssistantChat/`, `.planning/phases/01.1-model-picker-ux-family-visibility-filter-auto-only-new-sessi/01.1-PATTERNS.md`

**Files scanned:** ~40

**Pattern extraction date:** 2026-05-26

## PATTERN MAPPING COMPLETE

**Phase:** 02 - Skills Visibility and Session Policy
**Files classified:** 28
**Analogs found:** 24 / 28

### Coverage

- Files with exact analog: 18
- Files with role-match analog: 6
- Files with no analog: 4

### Key Patterns Identified

- Promote `SkillSummary` / `ListSkillsResponse` to `shared/` with strict Zod (mirror `CursorModelSummarySchema`); store `skillPolicy` on `MetadataSchema`, persist via `updateSessionMetadata` + `refreshSession`, not `SessionPatchSchema` / `applySessionConfig`.
- Extend `cli/.../skills.ts` roots, nested walk, and invalid-visible rows; keep `Map` dedup and git-root walk.
- Web: `useSkills` filters disabled for `$` autocomplete; settings `/settings/skills` copies 01.1 drill-down shell but read-only; session sheet copies `HappyComposerOverlays` + must not use `useVisibleModelFamilies` storage for policy.

### File Created

`.planning/phases/02-skills-visibility-and-session-policy/02-PATTERNS.md`

### Ready for Planning

Pattern mapping complete. Planner can reference analog patterns in PLAN.md files.
