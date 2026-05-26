# Phase 2: Skills Visibility and Session Policy - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning
**Mode:** `--auto` (all gray areas selected; recommended defaults applied)

<domain>
## Phase Boundary

Users can **see** which Cursor skills HAPI discovers (with honest metadata) and **set per-session skill policy** (inherited / enabled / disabled) without editing `SKILL.md` files or global Cursor configuration. Policy is HAPI-owned session state, persisted through Hub, and surfaced in mobile UI with clear enforcement labeling.

Out of scope: skill authoring/editing, global Cursor settings, MCP policy (Phase 3), changing desktop Cursor skill files, claiming hard Cursor enforcement without evidence.

</domain>

<decisions>
## Implementation Decisions

### Skill discovery & inventory (SKIL-01)
- **D-01:** Expand CLI discovery beyond current `~/.agents/skills` + project `.agents/skills` to also scan **Cursor-documented roots**: project `.cursor/skills` and user `~/.cursor/skills`, walking ancestors to git root (same pattern as today).
- **D-02:** Support **nested** `SKILL.md` under skill trees (not only immediate child directories of the skills root); dedupe by resolved skill **name** with project-over-user precedence (extend existing `Map` dedup in `listSkills`).
- **D-03:** Promote **`SkillSummary` to `@hapi/protocol`** (Zod + exported type): `name`, `description?`, `source` (`project` | `user`), `invocationMode?` (from frontmatter when present), `valid: boolean`, `invalidReason?` (safe parse/frontmatter errors), `pathHint?` (repo-relative or redacted path segment for “where found” — no home-dir secrets).
- **D-04:** **Invalid skills appear in the list** with error copy (not silently dropped) so “invalid metadata states” is visible.
- **D-05:** Hub route `GET /sessions/:id/skills` continues to RPC `listSkills` on the session’s working directory; response uses shared schema end-to-end (remove parallel `web/src/types/api.ts` shape).

### Session policy model (SKIL-02)
- **D-06:** Per-skill tri-state policy: **`inherited` | `enabled` | `disabled`**, keyed by skill `name`, stored on **session metadata** (new field in `MetadataSchema` / strict session patch — e.g. `skillPolicy: Record<string, SkillPolicyState>`), **not** machine metadata and **not** web-only localStorage.
- **D-07:** Default for skills without an explicit row: **`inherited`** (HAPI does not override Cursor discovery; no implicit “enable all”).
- **D-08:** Mutations go through **authenticated Hub session API** (dedicated `PATCH` sub-route or structured session patch) → SyncEngine → SQLite session row → SSE strict patch to Web TanStack cache (same convergence pattern as model/effort).
- **D-09:** Policy must **survive resume/reload** within the session record (Phase 5 INTG-01 will E2E this; Phase 2 must include resume persistence test per pitfalls table).

### Enforcement honesty (SKIL-03)
- **D-10:** v1.1 enforcement is **HAPI session policy** unless plan-phase research finds a verified Cursor CLI per-session suppress API — filter at **turn construction / prompt layer** and composer UX; **do not** write skill files or global Cursor config.
- **D-11:** UI shows per-skill (or section) enforcement badge: default **`HAPI session policy`**; upgrade to **`Cursor enforced`** only when research proves a hard runtime hook (otherwise never imply isolation).
- **D-12:** Composer **`$skill` autocomplete** omits **disabled** skills; **enabled** overrides inherited-off is allowed; **inherited** follows discovery visibility rules.
- **D-13:** Optional system/context preamble listing allowed skills for the session is acceptable at planner discretion; must be deterministic from policy map + discovery list.

### UI surfaces
- **D-14:** **Primary control surface: active session** — skills policy sheet reachable from SessionChat composer/status area (parity with model picker affordance).
- **D-15:** **Settings drill-down** `/settings/skills` — **read-only** discovery catalog (source, invocation mode, validity) for browse when user wants inventory without toggling; **policy toggles only in session UI** (avoids global-settings confusion per REQUIREMENTS out-of-scope).
- **D-16:** Policy row UX: tri-state control (inherited / enabled / disabled) + short explanation of inherited behavior; bulk “reset all to inherited” action is in scope if cheap.

### Integration & contracts
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — SKIL-01, SKIL-02, SKIL-03; out-of-scope table (no skill file edits, session-local policy)
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria
- `.planning/PROJECT.md` — v1.1 core value and architecture
- `.planning/research/SUMMARY.md` — Phase 2 deliverables and research flag (Cursor per-session skill suppression)
- `.planning/research/PITFALLS.md` — Pitfall 3 (global/session conflation), Pitfall 5 (shared contracts), skill policy resume test

### Prior phase context
- `.planning/phases/01-cursor-runtime-config-contract/01-CONTEXT.md` — Session metadata, strict patches, Hub-backed config
- `.planning/phases/01.3-cursor-session-ndjson-toolcall-task-agent-notebook-skill-ask/01.3-CONTEXT.md` — Skill tool mapping only; explicitly defers session policy to Phase 2

### CLI discovery (extend)
- `cli/src/modules/common/skills.ts` — Current `listSkills`, frontmatter parse, `.agents/skills` roots
- `cli/src/modules/common/handlers/skills.ts` — `listSkills` RPC handler
- `cli/src/modules/common/skills.test.ts` — Discovery unit tests (extend for new roots/nested/invalid)
- `cli/src/modules/common/registerCommonHandlers.ts` — Handler registration

### Hub & wire
- `hub/src/web/routes/sessions/read.ts` — `GET /sessions/:id/skills`
- `hub/src/sync/syncEngine.ts` — `listSkills` delegation
- `hub/src/sync/rpcGateway.ts` — Session RPC bridge
- `shared/src/schemas.ts` — `MetadataSchema`, `SessionSchema`, `SessionPatchSchema` (extend for `skillPolicy`)

### Web (extend)
- `web/src/hooks/queries/useSkills.ts` — Discovery query + `$` suggestions
- `web/src/lib/recent-skills.ts` — Recency only (not policy)
- `web/src/api/client.ts` — `getSkills`; add policy mutation client method
- `web/src/router.tsx` — Composer autocomplete wiring
- `web/src/routes/settings/models.tsx` — Pattern for settings drill-down (01.1)

### Tooling / skill invoke surface
- `web/src/components/ToolCard/knownTools.tsx` — Skill tool card name
- `cli/src/cursor/utils/normalizeToolArgs/normalizeSkillArgs.ts` — Skill tool args (read-only for Phase 2)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cli/src/modules/common/skills.ts` — Working frontmatter parser, git-root walk, project/user dedup; extend rather than rewrite.
- `hub/src/web/routes/sessions/read.ts` — Established `GET /sessions/:id/skills` pattern.
- `web/src/hooks/queries/useSkills.ts` + `queryKeys.skills` — TanStack query for discovery; extend staleTime/refetch policy as needed.
- `web/src/routes/settings/models.tsx` + `useVisibleModelFamilies` — Settings drill-down and local preference pattern (visibility is global; skill **policy** must NOT copy this storage model).

### Established Patterns
- Cross-package contracts live in `shared/` with strict `SessionPatchSchema` (Phase 1 / Pitfall 5).
- Session-scoped runtime truth in Hub SQLite + SSE patches to Web cache (model/effort/status).
- Session API via `withSession()` + SyncEngine RPC for CLI-backed reads.

### Integration Points
- New `MetadataSchema.skillPolicy` (or equivalent) → session create/resume/handoff must preserve it.
- Policy write: Hub route → SyncEngine session update → SSE → Web session cache.
- Composer: `useHappyComposerHandlers` / `getAutocompleteSuggestions` when query starts with `$`.
- Settings index: new row linking to `/settings/skills` read-only list.

</code_context>

<specifics>
## Specific Ideas

- Match Cursor Desktop mental model: “I see what’s available” + “this session may differ” without touching files on disk.
- Research during plan-phase must answer: does `agent` CLI expose per-session skill deny? If yes, document and wire; if no, keep D-10/D-11 honest.
- Resume test is non-negotiable acceptance evidence (called out in PITFALLS verification table).

</specifics>

<deferred>
## Deferred Ideas

- Mobile skill authoring / `SKILL.md` editing — REQUIREMENTS out of scope.
- Global per-machine skill visibility profiles — analogous to deferred per-machine model profiles (01.1 D-18).
- Bulk export/import of skill policy across sessions — future PREF milestone.
- MCP session policy — Phase 3.
- Skill policy on inactive sessions beyond metadata persist — follow model inactive-session pattern from Phase 1.

</deferred>

---

*Phase: 02-skills-visibility-and-session-policy*
*Context gathered: 2026-05-26*
