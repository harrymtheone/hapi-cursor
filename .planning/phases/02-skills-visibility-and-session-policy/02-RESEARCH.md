# Phase 2: Skills Visibility and Session Policy - Research

**Researched:** 2026-05-26
**Domain:** Cursor skill discovery, HAPI session policy persistence, mobile UI
**Confidence:** HIGH for discovery/schema/UI patterns; HIGH for “no Cursor CLI per-session skill suppress” conclusion

## Summary

Phase 2 extends existing `listSkills` plumbing into a Cursor-aligned inventory (SKIL-01), stores per-session tri-state policy in Hub-backed session metadata (SKIL-02), and enforces policy honestly at the HAPI composer/message layer with **“HAPI session policy”** badges unless a future verified Cursor hook appears (SKIL-03).

**Cursor CLI finding (critical):** Local `agent --help` (May 2026) exposes model, MCP, sandbox, and resume flags but **no skill allowlist/denylist or per-session skill suppression**. Official skills docs describe file-based discovery and `disable-model-invocation` in `SKILL.md` frontmatter—not a runtime session API. v1.1 enforcement must be HAPI-owned (autocomplete filter, optional message preamble, honest UI), not skill file mutation or `agent mcp enable/disable`-style global toggles.

**Schema note:** Locked decision D-06 places `skillPolicy` on `MetadataSchema`. Model/effort use top-level `Session` columns + `SessionPatchSchema`; metadata changes today propagate via **full `SessionSchema` `session-updated` events** (`'metadata' in event.data` in `web/src/hooks/useSSE.ts`). Policy writes should follow the **metadata versioned update + `refreshSession` emit** path, not `.passthrough()` on `SessionPatchSchema`.

**Primary recommendation:** Promote `SkillSummary` + `SkillPolicyState` in `@hapi/protocol`; expand `cli/src/modules/common/skills.ts` for Cursor roots + nested `SKILL.md`; add Hub `POST /sessions/:id/skill-policy` (or batch variant) writing `metadata.skillPolicy`; filter `$` suggestions in `useSkills`; add session policy sheet + read-only `/settings/skills`; wire optional CLI message preamble at `runCursor` `onUserMessage`; add resume persistence test per PITFALLS.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Skill discovery & inventory (SKIL-01)
- **D-01:** Expand CLI discovery beyond current `~/.agents/skills` + project `.agents/skills` to also scan **Cursor-documented roots**: project `.cursor/skills` and user `~/.cursor/skills`, walking ancestors to git root (same pattern as today).
- **D-02:** Support **nested** `SKILL.md` under skill trees (not only immediate child directories of the skills root); dedupe by resolved skill **name** with project-over-user precedence (extend existing `Map` dedup in `listSkills`).
- **D-03:** Promote **`SkillSummary` to `@hapi/protocol`** (Zod + exported type): `name`, `description?`, `source` (`project` | `user`), `invocationMode?` (from frontmatter when present), `valid: boolean`, `invalidReason?` (safe parse/frontmatter errors), `pathHint?` (repo-relative or redacted path segment for “where found” — no home-dir secrets).
- **D-04:** **Invalid skills appear in the list** with error copy (not silently dropped) so “invalid metadata states” is visible.
- **D-05:** Hub route `GET /sessions/:id/skills` continues to RPC `listSkills` on the session’s working directory; response uses shared schema end-to-end (remove parallel `web/src/types/api.ts` shape).

#### Session policy model (SKIL-02)
- **D-06:** Per-skill tri-state policy: **`inherited` | `enabled` | `disabled`**, keyed by skill `name`, stored on **session metadata** (new field in `MetadataSchema` / strict session patch — e.g. `skillPolicy: Record<string, SkillPolicyState>`), **not** machine metadata and **not** web-only localStorage.
- **D-07:** Default for skills without an explicit row: **`inherited`** (HAPI does not override Cursor discovery; no implicit “enable all”).
- **D-08:** Mutations go through **authenticated Hub session API** (dedicated `PATCH` sub-route or structured session patch) → SyncEngine → SQLite session row → SSE strict patch to Web TanStack cache (same convergence pattern as model/effort).
- **D-09:** Policy must **survive resume/reload** within the session record (Phase 5 INTG-01 will E2E this; Phase 2 must include resume persistence test per pitfalls table).

#### Enforcement honesty (SKIL-03)
- **D-10:** v1.1 enforcement is **HAPI session policy** unless plan-phase research finds a verified Cursor CLI per-session suppress API — filter at **turn construction / prompt layer** and composer UX; **do not** write skill files or global Cursor config.
- **D-11:** UI shows per-skill (or section) enforcement badge: default **`HAPI session policy`**; upgrade to **`Cursor enforced`** only when research proves a hard runtime hook (otherwise never imply isolation).
- **D-12:** Composer **`$skill` autocomplete** omits **disabled** skills; **enabled** overrides inherited-off is allowed; **inherited** follows discovery visibility rules.
- **D-13:** Optional system/context preamble listing allowed skills for the session is acceptable at planner discretion; must be deterministic from policy map + discovery list.

#### UI surfaces
- **D-14:** **Primary control surface: active session** — skills policy sheet reachable from SessionChat composer/status area (parity with model picker affordance).
- **D-15:** **Settings drill-down** `/settings/skills` — **read-only** discovery catalog (source, invocation mode, validity) for browse when user wants inventory without toggling; **policy toggles only in session UI** (avoids global-settings confusion per REQUIREMENTS out-of-scope).
- **D-16:** Policy row UX: tri-state control (inherited / enabled / disabled) + short explanation of inherited behavior; bulk “reset all to inherited” action is in scope if cheap.

#### Integration & contracts
- **D-17:** **Shared-first** (Pitfall 5): all wire types in `shared/`; update hub fixtures, SSE patch tests, and web cache patchers together — no `.passthrough()` on `SessionPatchSchema`.
- **D-18:** Keep existing `recent-skills` localStorage as **UX recency only**; it does not define policy.
- **D-19:** RPC remains `listSkills` on CLI; add session-policy write path on Hub only (no new CLI file mutation handlers).

### Claude's Discretion
- Exact nested-walk algorithm and `pathHint` redaction rules.
- Dedicated route vs generic session PATCH shape for policy updates.
- Whether inherited skills get a subtle “available via Cursor” subtitle vs enabled/disabled only.
- System-preamble wording for allowed skills.
- Component names (`SkillsPolicySheet`, settings section layout).
- i18n key namespace (`settings.skills.*`, `session.skills.*`).

### Deferred Ideas (OUT OF SCOPE)
- Mobile skill authoring / `SKILL.md` editing — REQUIREMENTS out of scope.
- Global per-machine skill visibility profiles — analogous to deferred per-machine model profiles (01.1 D-18).
- Bulk export/import of skill policy across sessions — future PREF milestone.
- MCP session policy — Phase 3.
- Skill policy on inactive sessions beyond metadata persist — follow model inactive-session pattern from Phase 1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKIL-01 | View discovered Cursor skills with source, invocation mode, description, invalid metadata | Expand `skills.ts` roots + nested walk; `SkillSummarySchema` in shared; map `disable-model-invocation` → `invocationMode: 'manual'`; invalid rows via `safeParse` |
| SKIL-02 | Session-level inherited/enabled/disabled without editing files or global Cursor config | `MetadataSchema.skillPolicy`; Hub write route + `updateSessionMetadata`; resume/merge preserve metadata; no CLI skill file writes |
| SKIL-03 | See whether policy is Cursor-hard-enforced or HAPI-only | **No CLI suppress API found** — badge `HAPI session policy`; never claim `Cursor enforced` in v1.1 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Skill filesystem discovery | CLI (`listSkills` RPC) | Hub (RPC delegate) | Skills are local files; Hub must not read disk |
| Skill inventory API | Hub (`GET /sessions/:id/skills`) | Web (TanStack query) | Session-scoped working directory from `metadata.path` |
| Session skill policy persistence | Hub (SQLite `metadata` JSON) | Shared (`MetadataSchema`) | Policy is session truth, survives reload |
| Policy mutation API | Hub (`POST`/`PATCH` skill-policy route) | Web (mutation hook) | Authenticated boundary; no web→CLI direct writes |
| Composer `$` filtering | Web (`useSkills` + session policy from cache) | — | UX enforcement; uses cached session metadata |
| Turn-level soft enforcement | CLI (`runCursor` message formatting) | Hub (optional future) | No Cursor flag; prepend deterministic preamble to user text |
| Read-only settings catalog | Web (`/settings/skills`) | CLI discovery via machine or last session | Browse without toggles; policy stays session-local |
| Enforcement labeling | Web (badges in sheet + settings) | — | SKIL-03 honesty |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `yaml` (cli) | repo-pinned | Parse `SKILL.md` frontmatter | Already used in `cli/src/modules/common/skills.ts` [VERIFIED: codebase] |
| `zod` (`@hapi/protocol`, hub) | ^4.2.1 (hub) | `SkillSummarySchema`, `SkillPolicyStateSchema`, `MetadataSchema` extension | Single wire contract source (Pitfall 5) [VERIFIED: codebase] |
| TanStack Query (web) | ^5.90.12 | Discovery + session cache | Existing `useSkills`, `useSSE` [VERIFIED: codebase] |
| Hono (hub) | ^4.11.2 | Session routes | Matches `config.ts` model route pattern [VERIFIED: codebase] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node `fs/promises` | built-in | Recursive `SKILL.md` discovery | CLI only |
| Vitest (cli/web) | repo-pinned | Unit/component tests | Discovery + UI |
| `bun:test` (hub) | Bun 1.x | Route + persistence tests | Hub session API |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `MetadataSchema.skillPolicy` | New SQLite `skill_policy` column | Column matches model/effort ergonomics but **contradicts locked D-06**; metadata JSON avoids migration |
| Hub file scan | CLI `listSkills` only | Duplicates Cursor discovery rules; violates architecture |
| Mutating `SKILL.md` / `disable-model-invocation` | HAPI policy map | Global/session conflation (Pitfall 3); out of scope |

**Installation:** No new packages required for Phase 2.

## Package Legitimacy Audit

> Phase 2 adds **no new external dependencies**. Existing `yaml` and `zod` are already workspace dependencies.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none new) | — | N/A |

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌─────────────────────────────────────┐
                    │  Web PWA                             │
                    │  /settings/skills (read-only list)   │
                    │  SessionChat → SkillsPolicySheet     │
                    │  $ autocomplete (filtered)           │
                    └──────────────┬──────────────────────┘
                                   │ REST + SSE
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  Hub                                 │
                    │  GET  /sessions/:id/skills           │
                    │  POST /sessions/:id/skill-policy     │
                    │  metadata.skillPolicy in SQLite      │
                    │  session-updated (full Session)      │
                    └──────────────┬──────────────────────┘
                                   │ Socket.IO RPC
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  CLI (session cwd)                   │
                    │  listSkills → scan skill roots       │
                    │  runCursor → optional preamble       │
                    └──────────────┬──────────────────────┘
                                   │ spawn
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  Cursor Agent CLI (`agent`)          │
                    │  Discovers skills from disk          │
                    │  (no per-session suppress flag)      │
                    └─────────────────────────────────────┘
```

### Recommended Project Structure

```text
shared/src/
├── schemas.ts              # MetadataSchema.skillPolicy, SkillSummarySchema, ListSkillsResponse
├── skills.ts               # (new) exported skill types + helpers if needed

cli/src/modules/common/
├── skills.ts               # extend discovery (roots, nested, invalid)
├── skills.test.ts
├── handlers/skills.ts      # return shared-shaped skills

hub/src/web/routes/sessions/
├── read.ts                 # GET skills (unchanged path)
├── skillPolicy.ts          # (new) POST/PATCH policy
├── config.ts               # pattern reference for session POST routes

hub/src/sync/
├── sessionPolicyService.ts # (new) or extend SessionConfigService for metadata.skillPolicy
├── sessionMergeService.ts  # merge skillPolicy on resume merge

web/src/
├── hooks/queries/useSkills.ts      # filter by policy; import from @hapi/protocol
├── hooks/mutations/useSkillPolicy.ts
├── routes/settings/skills.tsx      # read-only catalog
├── components/.../SkillsPolicySheet.tsx
```

### Pattern 1: Cursor-Aligned Nested Discovery

**What:** Walk each skills root recursively; every `SKILL.md` file is one skill; identity = parent directory name unless frontmatter `name` overrides.

**When to use:** All `listSkills` calls.

**Example:**

```typescript
// Source: https://cursor.com/docs/skills (nested directories)
// Project roots (git walk) processed before user roots; Map dedupe by name → project wins
async function collectSkillMdFiles(root: string): Promise<string[]> {
    const found: string[] = []
    async function walk(dir: string) {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue
            const full = join(dir, entry.name)
            if (entry.isDirectory()) await walk(full)
            else if (entry.name === 'SKILL.md') found.push(full)
        }
    }
    await walk(root)
    return found
}
```

### Pattern 2: Metadata Policy Write + Full Session SSE

**What:** Update `metadata.skillPolicy` via `updateSessionMetadata` with version check; call `SessionRepository.refreshSession` so SSE emits full `SessionSchema` (Web replaces session cache when `'metadata' in event.data`).

**When to use:** Every policy toggle (active or inactive session).

**Do not:** Add `skillPolicy` to `SessionPatchSchema` unless also updating `useSSE` patch merge for nested metadata (locked decision prefers metadata field).

### Pattern 3: Effective Policy Resolution

**What:** Pure function over discovery list + `metadata.skillPolicy`:

| Policy row | Effective for `$` / preamble |
|------------|-------------------------------|
| (missing) | `inherited` — include in autocomplete |
| `inherited` | include |
| `enabled` | include even if Cursor would manual-only |
| `disabled` | exclude from autocomplete |

**When to use:** Web `getSuggestions`; optional CLI preamble.

### Pattern 4: Settings Drill-Down (01.1 Models Parity)

**What:** `ModelsSection` → `/settings/models` uses local visibility prefs; skills settings row → `/settings/skills` is **read-only** and uses `useSkills` with a stable session or machine-scoped discovery path.

**Reference:** `web/src/routes/settings/models.tsx`, `web/src/routes/settings/_sections/ModelsSection.tsx`.

### Anti-Patterns to Avoid

- **Editing skill files from Hub/Web** — violates out-of-scope and Pitfall 3.
- **Storing policy in `recent-skills` localStorage** — D-18 forbids.
- **`.passthrough()` on `SessionPatchSchema`** — D-17 / Pitfall 5.
- **Claiming `Cursor enforced` without CLI evidence** — SKIL-03 failure mode.
- **Using `agent mcp disable` for skills** — wrong subsystem; global MCP only [VERIFIED: `agent mcp --help` locally].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter | Regex-only parser | Existing `parse` from `yaml` + `parseFrontmatter` | Invalid YAML, edge cases |
| Skill wire types | `web/src/types/api.ts` duplicate | `@hapi/protocol` Zod schemas | Pitfall 5 drift |
| Global skill off | Rewrite `SKILL.md` | Session `skillPolicy` map | Affects desktop Cursor |
| Per-session Cursor suppress | Assume CLI flag | HAPI preamble + UI filter | No flag in `agent --help` |
| Full metadata on every SSE tick | Patch entire metadata for liveness | Policy route emits full session only on policy change | Avoids session-list noise |

**Key insight:** Skills are Cursor’s file-backed discovery; HAPI only adds a **session preference overlay** and honest UX.

## Common Pitfalls

### Pitfall 1: No Cursor Per-Session Skill Suppression (Confirmed)

**What goes wrong:** UI implies disabled skills cannot run, but Cursor still auto-invokes from disk.

**Evidence:** `agent --help` has no skill flags [VERIFIED: local CLI May 2026]. Docs: `disable-model-invocation` is per-`SKILL.md`, not runtime session API [CITED: https://cursor.com/docs/skills].

**How to avoid:** Default badge **HAPI session policy**; preamble + `$` filter only; document limitation in settings copy.

### Pitfall 2: Metadata vs SessionPatch Confusion

**What goes wrong:** Planner adds `skillPolicy` to `SessionPatchSchema` while D-06 says metadata; patch merge shallow-spreads and drops nested policy.

**How to avoid:** Store on `MetadataSchema`; emit full `Session` on policy writes; extend `mergeSessionMetadata` to union `skillPolicy` keys on resume merge.

### Pitfall 3: Project/User Dedupe Order

**What goes wrong:** User skill shadows project skill.

**How to avoid:** Keep iteration order **project skills first**, then user — existing `listSkills` Map pattern [VERIFIED: `cli/src/modules/common/skills.ts`].

### Pitfall 4: pathHint Leaks Home Directory

**What goes wrong:** Mobile UI shows `/home/user/...` paths.

**How to avoid:** Project: path relative to git root; user: `~/.cursor/skills/...` or `~/.agents/skills/...` only (D-03).

### Pitfall 5: Resume Loses Policy

**What goes wrong:** Toggle works until resume.

**How to avoid:** Policy in stored metadata JSON; test hub resume round-trip (PITFALLS verification table); ensure `syncEngineSessionResume` spawn payload includes metadata (already passes `directory`, `machineId` — metadata loaded from store on session record).

### Pitfall 6: Invalid Skills Hidden

**What goes wrong:** SKIL-01 unmet.

**How to avoid:** On frontmatter parse failure, emit `{ name, valid: false, invalidReason, source, pathHint }` using directory basename as fallback name.

## Code Examples

### Shared schemas (extend `shared/src/schemas.ts`)

```typescript
// Source: Phase 02 CONTEXT D-03, D-06
export const SkillPolicyStateSchema = z.enum(['inherited', 'enabled', 'disabled'])
export type SkillPolicyState = z.infer<typeof SkillPolicyStateSchema>

export const SkillPolicyMapSchema = z.record(z.string(), SkillPolicyStateSchema)

export const SkillSummarySchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    source: z.enum(['project', 'user']),
    invocationMode: z.enum(['auto', 'manual']).optional(),
    valid: z.boolean(),
    invalidReason: z.string().optional(),
    pathHint: z.string().optional(),
})

// MetadataSchema extension:
// skillPolicy: SkillPolicyMapSchema.optional(),
```

### Hub policy route (mirror `config.ts`)

```typescript
// Source: hub/src/web/routes/sessions/config.ts pattern
app.post('/sessions/:id/skill-policy', withEngine, withSession, parseJsonBody(schema), async (c) => {
    const session = c.get('session')
    const body = c.get('body') // { name: string, state: SkillPolicyState } or { policy: SkillPolicyMap }
    await c.get('engine').applySkillPolicy(session.id, body)
    return c.json({ ok: true })
})
```

### Web autocomplete filter

```typescript
// Source: web/src/hooks/queries/useSkills.ts + D-12
function isSkillAllowed(name: string, policy: Record<string, SkillPolicyState> | undefined): boolean {
    const state = policy?.[name] ?? 'inherited'
    return state !== 'disabled'
}
```

### Optional CLI preamble (turn construction)

```typescript
// Source: cli/src/cursor/runCursor.ts onUserMessage — D-10, D-13
function buildSkillPolicyPreamble(
    skills: SkillSummary[],
    policy: Record<string, SkillPolicyState> | undefined
): string | null {
    const allowed = skills.filter((s) => s.valid && isEffectivelyAllowed(s.name, policy))
    if (allowed.length === 0) return null
    return `[HAPI session skill policy] Allowed skills: ${allowed.map((s) => s.name).join(', ')}.`
}
// Prepend to formattedText once per batch or when policy changes (planner discretion)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Top-level `.agents/skills` dirs only | Nested `SKILL.md` under `.cursor/skills` + `.agents/skills` | Cursor docs current | HAPI must recursive-walk |
| `{ name, description? }` wire shape | Rich `SkillSummary` in shared | Phase 2 | Remove `web/src/types/api.ts` duplicate |
| No session policy | `metadata.skillPolicy` tri-state | Phase 2 | Composer + optional preamble |
| Assume Cursor enforces toggles | Honest HAPI-only enforcement | Research 2026-05-26 | SKIL-03 badges |

**Deprecated/outdated:**
- Treating `agent mcp disable` as skill suppression — MCP-only, global [VERIFIED: `agent mcp --help`].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Nested monorepo `.cursor/skills` scoping matches Cursor (agent cwd-based) | Discovery | Over- or under-inclusive list; mitigate with `pathHint` |
| A2 | `disable-model-invocation: true` maps to `invocationMode: 'manual'` | SKIL-01 | Mislabeled mode in UI |
| A3 | Full-session SSE is acceptable for policy updates (no summary patch) | Persistence | Extra payload on toggle; acceptable for rare edits |
| A4 | Message preamble influences agent skill use | Enforcement | Cursor may still auto-invoke; UI must stay honest |

**Research-verified (not assumptions):** No skill flags on `agent` CLI; Cursor docs skill roots and nested layout.

## Open Questions

1. **Block send when message contains `$disabled-skill`?**
   - What we know: Discussion log defers unless cheap; D-12 requires autocomplete omit only.
   - Recommendation: Phase 2 — filter autocomplete; optional send-time validation in web `sendMessage` if trivial regex match.

2. **Settings catalog session key when no active session?**
   - What we know: Discovery is session-scoped today (`GET /sessions/:id/skills`).
   - Recommendation: Use active session id, or add machine-scoped `listSkills` with `metadata.path` from a default machine cwd (planner discretion).

3. **`mergeSessionMetadata` and `skillPolicy`**
   - What we know: Merge helper only handles `name` and `summary` today.
   - Recommendation: Deep-merge `skillPolicy` with new-session keys winning on conflict; preserve old keys absent in new.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `agent` (Cursor CLI) | Discovery / runtime | ✓ | (local install) | Safe empty discovery |
| Bun | hub tests | ✓ | — | — |
| Vitest | cli/web tests | ✓ | — | — |
| `~/.cursor/skills`, `~/.agents/skills` | User skill fixtures | ✓ | — | Temp dirs in unit tests |

**Missing dependencies with no fallback:** None for Phase 2 implementation.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (cli, web); `bun:test` (hub) |
| Config file | `cli/vitest.config.ts`, `web/vitest.config.ts`, hub inline |
| Quick run command | `cd cli && bun run test -- skills` / `cd hub && bun test skill` |
| Full suite command | `bun run test` (repo root) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKIL-01 | Nested + `.cursor/skills` roots | unit | `cd cli && bun run test -- skills.test` | ✅ extend |
| SKIL-01 | Invalid skill visible | unit | same | ❌ Wave 0 |
| SKIL-01 | Hub GET skills shared shape | unit | `cd hub && bun test read.test` | ✅ extend |
| SKIL-02 | Policy persist + SSE | unit | `cd hub && bun test skillPolicy` | ❌ Wave 0 |
| SKIL-02 | Resume retains skillPolicy | unit/integration | hub resume test | ❌ Wave 0 |
| SKIL-03 | Badge copy / no false Cursor claim | component | `cd web && bun run test -- SkillsPolicy` | ❌ Wave 0 |
| SKIL-02 | `$` omits disabled | unit | `cd web && bun run test -- useSkills` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd cli && bun run test -- skills.test.ts`
- **Per wave merge:** `bun run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `cli/src/modules/common/skills.test.ts` — nested `.cursor/skills`, invalid frontmatter, pathHint
- [ ] `hub/src/web/routes/sessions/__tests__/skillPolicy.test.ts` — metadata persist + version mismatch
- [ ] `hub/src/sync/sessionMergeService.test.ts` — skillPolicy merge on resume
- [ ] `web/src/hooks/queries/useSkills.test.ts` — disabled filter
- [ ] `shared/src/schemas.skill.test.ts` — strict parse rejects unknown metadata keys (if applicable)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Existing Hub token auth on session routes |
| V5 Input Validation | yes | Zod on policy route body + `SkillPolicyMapSchema` |
| V4 Access Control | yes | `withSession()` — policy scoped to session id |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| pathHint path traversal disclosure | Information disclosure | Redact home; repo-relative only |
| Oversized `skillPolicy` map | DoS | Zod max keys / max name length on write |
| Policy write without auth | Tampering | Existing `withEngine` + auth middleware |

## Project Constraints (from .cursor/rules/)

- **GitNexus:** Run `impact` before editing symbols; `detect_changes` before commit [gitnexus.mdc].
- **GSD / stack:** Bun + TypeScript strict; no backward compatibility; shared-first contracts [gsd-workflow.mdc, AGENTS.md].
- **No cut agents:** `scripts/check-no-cut-agents.sh` in integration phase.
- **Cross-runner:** cli/web Vitest; hub `bun:test` — do not mix.

## Sources

### Primary (HIGH confidence)

- [CITED: https://cursor.com/docs/skills] — skill roots (`.cursor/skills`, `.agents/skills`, user/project), nested `SKILL.md`, frontmatter (`name`, `description`, `disable-model-invocation`, `paths`).
- [VERIFIED: local `agent --help` May 2026] — no skill-related flags; MCP subcommands separate.
- Codebase: `cli/src/modules/common/skills.ts`, `hub/src/web/routes/sessions/read.ts`, `hub/src/web/routes/sessions/config.ts`, `shared/src/schemas.ts`, `web/src/hooks/useSSE.ts`, `web/src/hooks/queries/useSkills.ts`, `web/src/routes/settings/models.tsx`.
- `.planning/phases/02-skills-visibility-and-session-policy/02-CONTEXT.md`
- `.planning/research/PITFALLS.md` — Pitfall 3, 5, resume test table.

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md` — Phase 2 deliverables and research flag (aligned with findings).
- `.planning/research/ARCHITECTURE.md` — inventory vs policy split; optional `sessionPolicy.ts` in CLI.

### Tertiary (LOW confidence)

- None used for critical claims.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; existing yaml/zod/TanStack patterns.
- Architecture: HIGH — codebase paths verified; Cursor docs align with D-01/D-02.
- Pitfalls: HIGH for CLI non-enforcement; MEDIUM for preamble effectiveness (A4).

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (stable domain); re-check if Cursor CLI adds skill flags
