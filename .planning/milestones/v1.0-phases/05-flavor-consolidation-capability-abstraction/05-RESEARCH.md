# Phase 5: Flavor consolidation + capability abstraction — Research

**Researched:** 2026-05-22
**Domain:** Brownfield narrowing of a multi-flavor union to a single `'cursor'` literal + introduction of a value-bearing capability table; cli/hub/web call-site collapse driven by the TypeScript compiler.
**Confidence:** HIGH (every claim verified against the live tree on 2026-05-22)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-69 .. D-71** `AgentFlavor` narrows to literal `'cursor'`; wire/session `flavor` field stays (Phase 7 owns wire-level removal); union keeps room for future extension by adding one row to `FLAVOR_CAPS` + `FLAVOR_LABELS`.
- **D-72 .. D-76** `FLAVOR_CAPS` becomes `Record<AgentFlavor, FlavorCapabilities>` with value-bearing slots: `permissionModes`, `supportsModelChange`, `supportsEffort`, `contextBudgetTokens`, `userSlashCommandsDir`, `projectSlashCommandsDir`, `permissionToneCopy`. Unknown flavors return `null` (no throw). `hasCapability` / `supportsModelChange` / `supportsEffort` / `getFlavorLabel` / `isKnownFlavor` public API shapes preserved; internals switch from `Set` to `Record`.
- **D-77 .. D-80** Delete `CLAUDE_/CODEX_/GEMINI_/OPENCODE_PERMISSION_MODES` constants + types, all `CodexCollaborationMode*` symbols, all `flavor === '...'` branches inside `getPermissionModesForFlavor`/`getPermissionModeOptionsForFlavor`/`isPermissionModeAllowedForFlavor`. `PERMISSION_MODES` / `PERMISSION_MODE_LABELS` / `PERMISSION_MODE_TONES` collapse to Cursor's four modes IF web has no surviving `acceptEdits`/`bypassPermissions` UI; otherwise narrowed accordingly. Mode hardening (unknown-mode throw) stays Phase 6.
- **D-81 .. D-83** `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` stays as wire literal with JSDoc anchor + line-anchored ripgrep whitelist (Phase 7 owns); `isCodexFamilyFlavor()` deleted entirely; `FLAVOR_LABELS` collapses to one row but `getFlavorLabel()` keeps its `'Unknown'` fallback.
- **D-84 .. D-88** Ripgrep zero-tolerance keywords this phase adds: (1) literals `'claude'|'codex'|'gemini'|'opencode'` as flavor comparisons, (2) `flavor === '...'` / `switch (flavor)` for any non-`'cursor'` literal — and the degenerate `flavor === 'cursor' ? flavor : 'cursor'` pattern, (3) identifier `isCodexFamilyFlavor`. Whitelist sticks to `.planning/codebase/` + `CHANGELOG.md` plus a line-anchored entry for the `AGENT_MESSAGE_PAYLOAD_TYPE` JSDoc. Execution: 4 slices, each green on `bun typecheck` + `bun run test`; build:single-exe deferred to Phase 12.

### Claude's Discretion

- Capability field naming (`permissionToneCopy` is a placeholder; pick better-typed name if found), placement of `FlavorCapabilities` type (`flavors.ts` vs new file), lookup helper shape (`getCapabilities(flavor)` vs `getCursorCapabilities()`).
- If RESEARCH finds Cursor user/project slash-commands paths (e.g., `~/.cursor/commands/`), populate the capability with the real resolver rather than `null`.
- If RESEARCH finds same-shape hardcoded capability gates not enumerated in D-73 (e.g., model-list fallback, CLI binary path, MCP tools), fold them into the capability table + extend D-73 in PLAN.
- Whether `toolName.startsWith('Codex')` fallback in `PermissionFooter` stays after capability lookup — drop if no codex-prefixed tool names remain reachable in the post-Phase-1 codebase.

### Deferred Ideas (OUT OF SCOPE)

- Removing the wire-level `flavor` field from `Session/Machine/Message` DTOs (Phase 7).
- Renaming `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` wire literal (Phase 7).
- Mode-type independence from the `loop ↔ session ↔ launcher` cycle, unknown-mode throw, bypass+remote/bypass+plan test coverage (REFA-05, Phase 6).
- Cross-flavor permission-contract matrix test (REFT-01, Phase 11).
- README/docs/website prose cleanup of `claude/codex/gemini/opencode` mentions (CUT-12, Phase 12).
- Activating CURS-01 (model switch) — i.e., flipping `supportsModelChange` and populating a model-list capability (Milestone 2).
- New shims, feature flags, or `.passthrough()` compatibility layers.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUT-05 | `shared/src/flavors.ts` collapses to single flavor (`cursor`); `AgentFlavor` type + capability table strip all non-Cursor entries. | §"shared/ narrow surface", §"Slice 1 mechanics" |
| REFA-01 | Flavor capability abstraction is complete: Cursor capability set is extensible; every "is capability available?" judgement reads from the table; no hardcoded `if/else` at call sites. | §"Capability slot validation", §"Call-site inventory", §"Slices 2-3" |

</phase_requirements>

## Summary

Phase 5 is the planned narrowing of `AgentFlavor` from a 5-literal union to `'cursor'` plus an upgrade of `FLAVOR_CAPS` from a `Set<Capability>` flag-set to a value-bearing `Record<AgentFlavor, FlavorCapabilities>`. The mechanical work is well-bounded — `shared/` changes are surgical (single union, one constants block, a handful of helpers) — but the **call-site collapse driven by D-84's zero-tolerance ripgrep guard is much larger than CONTEXT.md headlines suggest**. The Phase-1 guard script (`scripts/check-no-cut-agents.sh`) currently whitelists **≈80 files** as "Phase-5 territory — owner: CUT-05". Phase 5 either rewrites them all Cursor-only and shrinks the whitelist to empty, or surfaces a scope renegotiation. CONTEXT.md D-84 plus SC#3 ("zero hardcoded `flavor ===` / capability gates") is unambiguous: the whitelist must collapse to `.planning/codebase/` + `CHANGELOG.md` + the line-anchored `AGENT_MESSAGE_PAYLOAD_TYPE` exception.

**Primary recommendation:** Plan for 4 slices that match D-86, but **slice 2 (web)** and **slice 3 (cli + hub)** each need to be sub-decomposed into roughly equal-size sub-tasks; each slice as written today carries ≥25 files of work. Slice 1 (shared/) is the leverage point — the `AgentFlavor` narrow makes the TypeScript compiler do the discovery for everything downstream. Don't skip the post-slice-1 typecheck failure inventory; it is the truest map of slices 2-3.

**Surprises uncovered during research:**

1. **`FLAVOR_BADGES` (`web/src/components/SessionList.tsx:491-508`) is a per-flavor visual UI map**, not a capability gate. After narrow, only the `cursor` row survives and `(flavor ?? 'claude').trim().toLowerCase()` becomes `(flavor ?? 'cursor')`. The component itself is single-row but its display value is a Cursor-only badge.
2. **The web UI hardcodes the agent type in 4 places** (`NewSession/AgentSelector.tsx:17`, `preferences.ts:6`, `preferences.test.ts:34/37`, `types.ts:1`, plus the default `'claude'` in `loadPreferredAgent`). Collapsing these is structural: `AgentSelector` either becomes a no-op component (single agent = no choice) or is deleted; `AgentType` collapses to `'cursor'`; preference storage becomes inert.
3. **CodexAgent / CodexBash / CodexPatch / CodexDiff / CodexReasoning are TOOL NAMES, not flavor literals.** Cursor doesn't emit them; they are dead code paths inside `web/src/components/ToolCard/` (codexAgents.ts, CodexDiffView.tsx, CodexPatchView.tsx, plus `CodexBashResultView` / `CodexPatchResultView` / `CodexReasoningResultView` / `CodexDiffResultView` / `CodexAgentResultView` in `views/_results.tsx`, `trace.tsx`, `ToolCard.test.ts`, `groupedPresentation.ts`). Phase 1 deleted the Codex *runtime* but left the *renderer*. D-84's ripgrep guard (`\b(codex)\b -i`) will flag these. Phase 5 must either (a) delete the now-dead Codex* tool views (cleanest — they're unreachable), or (b) whitelist `web/src/components/ToolCard/views/Codex*.tsx`, `codexAgents.ts`, etc. by exact filename and rationalize "wire-stable tool names". **Recommendation: delete (option a)** — see §"Dead-code cleanup recommended".
4. **`CodexCollaborationMode` is structurally entangled with the wire schema.** It is imported by `shared/src/schemas.ts:5` (Zod enum), `shared/src/resume.ts:2,20`, plus consumed by `cli/src/api/types.ts:4,14,23,28,124`, `web/src/api/client.ts:4,352`, `web/src/components/AssistantChat/{StatusBar,HappyComposer}.tsx`, `web/src/components/SessionChat.tsx:7,284`, `web/src/hooks/mutations/useSessionActions.ts:4,19,79`, `web/src/types/api.ts:12`. Removing the type cascades into `SessionSchema.collaborationMode`, `LocalResumeTargetSchema.collaborationMode`, and four web components. Each is genuinely tied to Codex (a defunct flavor) — none of it is Cursor functionality. **All `collaborationMode` schema fields + every consumer can be cut entirely with Phase 5**, since wire-level retention of the field is dead weight (Cursor never sets it). This is the same "delete wire field too" call as the per-flavor `*SessionId` cuts that Phase 1 already executed — CONTEXT.md D-70 explicitly says the wire `flavor` field stays, but never says `collaborationMode` does. **Recommendation: cut the `collaborationMode` field on the same pass; document it in PLAN as a wire-level field delete that's safe because the field was Codex-only.**
5. **`getContextBudgetTokens(model, flavor)` has a model-aware codex/claude branch that the proposed `contextBudgetTokens: number | null` slot does NOT cover.** For Cursor the slot is `null`, so the helper returns `null` — fine for now. But the existing branch (`'sonnet[1m]' → 990_000`) is model-aware logic; future Cursor model variants may need this. **Recommendation: keep slot shape as `number | null` for now; document model-aware variant as a follow-up if CURS-01 (Milestone 2) lands.** Drop the helper's Claude/Codex branches outright.
6. **`getPermissionModesForFlavor`'s no-match fallback today is `CLAUDE_PERMISSION_MODES` (`shared/src/modes.ts:105`).** After Cursor narrow + Claude constants delete, the fallback must become `CURSOR_PERMISSION_MODES` (or `[]` if the helper is allowed to return empty for unknown flavor — but consumers depend on a non-empty array). Keep the fallback semantics; just point the constant.
7. **`hub/src/sync/syncEngine.ts` carries a `'claude' | 'cursor'` agent union in two places** — line 366 default param `agent: 'claude' | 'cursor' = 'claude'` and line 518 `if (flavor !== 'claude' && flavor !== 'cursor')`. Phase 1 narrowed many surfaces but kept these as transitional. Phase 5 collapses them to `'cursor'`-only. **The `'claude'` default also lives in `hub/src/sync/rpcGateway.ts:125`, `hub/src/web/routes/sessions.ts:149/297/335/365/366/449/450`, `hub/src/web/routes/permissions.ts:59`, `web/src/router.tsx:340`, `web/src/components/SessionList.tsx:511`, `web/src/api/client.ts:445`, `web/src/hooks/mutations/useSpawnSession.ts:9`, `cli/src/runner/run.ts:235/349/894/903`, `cli/src/modules/common/rpcTypes.ts:7`.** All collapse to `'cursor'` defaults or are removed.
8. **No Cursor user/project slash-commands directories exist today.** `cli/src/modules/common/slashCommands.ts` has Claude/Codex cases but no Cursor case. WebSearch confirms Cursor IDE does support user-level commands at `~/.cursor/commands/*.md` `[CITED: cursor.com/docs/agent/chat/commands]`, but **no caller in this repo currently wires Cursor into `listSlashCommands`**. The capability slot `userSlashCommandsDir`/`projectSlashCommandsDir` can therefore default to `null` for Cursor today (matching current runtime behaviour); whether to wire `~/.cursor/commands/` is a separate scope decision (recommend keeping `null` — that's Cursor's path on the upstream Cursor IDE, and HAPI's runner has its own command surface; activating it is a v2 / CURS-02 concern).
9. **No `acceptEdits` / `bypassPermissions` UI emission remains** — the only surviving non-test references are in `web/src/components/ToolCard/PermissionFooter.tsx:43,151` (the `permission.mode === 'acceptEdits'` UI string + the `approvePermission(..., 'acceptEdits')` action), and the `web/src/api/client.ts:383-384` union type covering wire payload. These are inherited Claude UI affordances. **Cursor uses `default`/`plan`/`ask`/`yolo` only.** Recommendation: drop the `acceptEdits` UI branch entirely from `PermissionFooter` and collapse `web/src/api/client.ts` `approvePermission`'s mode argument to `CursorPermissionMode`. After that, `PERMISSION_MODES` / `PERMISSION_MODE_LABELS` / `PERMISSION_MODE_TONES` can collapse to Cursor's four modes — `PermissionMode` type alias = `CursorPermissionMode`. **D-78 condition met → collapse PermissionMode.**
10. **`toolName.startsWith('Codex')` in `PermissionFooter` is unreachable after Phase 1.** No CLI runtime emits `Codex*`-prefixed tool names anymore (Codex runtime deleted). The fallback can go.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Type-level flavor union | shared/ | — | `AgentFlavor` is the single source for cli/hub/web |
| Value-bearing capability table | shared/ | — | `FLAVOR_CAPS: Record<AgentFlavor, FlavorCapabilities>` exported by `shared/src/flavors.ts` |
| Permission-mode set selection | shared/ (lookup) | cli/hub/web (consume) | `getPermissionModesForFlavor` reads `caps.permissionModes` |
| Context window budget lookup | shared/ (lookup) | web (consume in `modelConfig.ts`) | Phase 5 narrows to `caps.contextBudgetTokens` |
| Permission-tone UI selection | shared/ (lookup) | web (consume in `PermissionFooter`) | `caps.permissionToneCopy` replaces `isCodexFamilyFlavor` |
| Slash-commands directory resolution | shared/ (lookup) | cli (consume in `slashCommands.ts`) | `caps.userSlashCommandsDir` / `caps.projectSlashCommandsDir` |
| Session resume agent-id picker | hub/ (collapse degenerate branch) | shared/ (schema retains `cursorSessionId`) | `syncEngine.resolveFlavor` / `resolveAgentResumeId` collapse |
| Agent type at session-spawn API | hub/ + web/ + cli (all collapse to single literal) | shared/ wire (`flavor` field retained per D-70) | Wire field stays, business code reads from capability table |
| GitHub Actions / build / docs | n/a (this phase) | — | Phase 12 owns; not touched here |

## Standard Stack

No new packages. This is a type-narrow + table-fill + call-site collapse phase.

**Existing tooling used:**

| Tool | Version | Purpose | Source |
|------|---------|---------|--------|
| Bun | 1.3.14 (root `packageManager`) | Workspaces, scripts, test runner | `package.json` |
| TypeScript | ^5 | `bun typecheck` drives call-site discovery after narrow | per-workspace |
| Vitest | ^4.0.16 | `bun run test` | per-workspace |
| ripgrep | system-installed (with vscode fallback) | `scripts/check-no-cut-agents.sh` guard | existing Phase 1-4 script |

`[VERIFIED: repo scan 2026-05-22]` — no new deps introduced; `bun.lock` does not change.

## Package Legitimacy Audit

**Skipped — this phase installs zero external packages.** Slopcheck not required; no install steps in any slice.

## Architecture Patterns

### Capability table shape

```typescript
// shared/src/flavors.ts (Phase-5 target shape, illustrative)

import type { PermissionMode } from './modes'  // collapsed alias for CursorPermissionMode

export type FlavorCapabilities = {
    readonly permissionModes: readonly PermissionMode[]
    readonly supportsModelChange: boolean
    readonly supportsEffort: boolean
    readonly contextBudgetTokens: number | null
    readonly userSlashCommandsDir: ((homedir: string) => string | null) | null
    readonly projectSlashCommandsDir: ((projectDir: string) => string | null) | null
    readonly permissionToneCopy: 'cursor' | 'codex'
}

const FLAVOR_CAPS: Record<AgentFlavor, FlavorCapabilities> = {
    cursor: {
        permissionModes: CURSOR_PERMISSION_MODES,
        supportsModelChange: false,
        supportsEffort: false,
        contextBudgetTokens: null,
        userSlashCommandsDir: null,
        projectSlashCommandsDir: null,
        permissionToneCopy: 'cursor',
    },
}

export function getCapabilities(flavor: string | null | undefined): FlavorCapabilities | null {
    return isKnownFlavor(flavor) ? FLAVOR_CAPS[flavor] : null
}

export function getCapability<K extends keyof FlavorCapabilities>(
    flavor: string | null | undefined,
    key: K
): FlavorCapabilities[K] | null {
    const caps = getCapabilities(flavor)
    return caps ? caps[key] : null
}
```

Compat helpers `hasCapability` / `supportsModelChange` / `supportsEffort` re-implement on top of `Record` instead of `Set`. `isCodexFamilyFlavor` is deleted; consumers call `getCapability(flavor, 'permissionToneCopy') === 'codex'` instead — which for Cursor is always `false`, so the codex branch dead-eliminates.

### Pattern: TypeScript-compiler-driven call-site discovery

Phase 1-4 established the workflow: narrow a union or delete a symbol, run `bun typecheck`, iterate on every compiler error. After Slice 1 narrows `AgentFlavor` to `'cursor'` and deletes the non-Cursor `*_PERMISSION_MODES`, the resulting compile errors map exactly to slices 2-3. **Recommendation: PLAN must reserve a "compile error inventory" step between slice 1 and slice 2** — write the error list to a transient `.planning/phases/05-.../05-COMPILE-ERRORS.md` artifact and use it to dimension slice 2/3 sub-tasks.

### Pattern: Capability lookup at call site

```typescript
// Before (web/src/chat/modelConfig.ts)
if (flavor === 'codex') return Math.max(1, DEFAULT_CODEX_CONTEXT_WINDOW_TOKENS - CONTEXT_HEADROOM_TOKENS)
if (flavor !== 'claude') return null
// ...claude-specific model branching...

// After
const window = getCapability(flavor, 'contextBudgetTokens')
if (window === null) return null
return Math.max(1, window - CONTEXT_HEADROOM_TOKENS)
```

### Anti-patterns

- **Adding capability slots Cursor doesn't need.** D-74 explicit. No `mcpToolsList`, no `pluginsDir`, no `modelListFallback` until a real call-site needs them.
- **Storing capability values in `Session` / `Message` DTO.** D-72 explicit. Capabilities are type/module-level, not wire payload.
- **Whitelisting whole files in the ripgrep guard.** D-85 explicit. The only line-anchored exception is `shared/src/modes.ts::AGENT_MESSAGE_PAYLOAD_TYPE`. Everything else gets rewritten to remove the literal, not whitelisted.
- **Touching `loop ↔ session ↔ launcher` mode wiring or `AgentRegistry`-style throw-on-unknown.** Phase 6 territory.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Capability lookup | A switch on `flavor` inside the call site | `getCapability(flavor, key)` | D-72/D-75; future flavors will silently break per-site switches |
| Permission-tone branch in UI | `if (flavor === 'codex' || flavor === 'gemini' ...)` | `getCapability(flavor, 'permissionToneCopy') === 'codex'` | D-73 covers this slot; `isCodexFamilyFlavor` is exactly the helper Phase 5 deletes |
| Slash-commands directory resolution | `switch (agent)` in `slashCommands.ts` | `caps.userSlashCommandsDir?.(homedir())` / `caps.projectSlashCommandsDir?.(dir)` | D-73 covers; Cursor returns `null` → caller skips |
| Context window budget | per-flavor constants + model-aware branches | `caps.contextBudgetTokens` | D-73; Cursor `null` is the right default while CURS-01 is parked |
| AgentType union for new-session UI | A hand-maintained 5-literal array | `Object.keys(FLAVOR_CAPS) as AgentFlavor[]` (single-element after narrow) | Cursor-only is structural; `AgentSelector` collapses |

## Call-site inventory (verified ripgrep, 2026-05-22)

Format: `file:line — kind — planned resolution`. Sourced from parallel ripgreps for `flavor === / switch (flavor)`, `isCodexFamilyFlavor / CodexCollaborationMode`, `*_PERMISSION_MODES`, `getPermissionModesForFlavor / getPermissionModeOptionsForFlavor / isPermissionModeAllowedForFlavor`, `\b(claude|codex|gemini|opencode)\b -i`, `'claude'|'codex'|'gemini'|'opencode'` literals, `acceptEdits|bypassPermissions`, `AgentFlavor`, `startsWith('Codex'|'Gemini'|'Claude'|'OpenCode')`.

### A. `shared/` — Slice 1 own scope

| Site | Kind | Resolution |
|------|------|------------|
| `shared/src/modes.ts:6` | `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const` | KEEP (D-81) — add JSDoc anchor + line-anchored whitelist |
| `shared/src/modes.ts:8-9` | `CLAUDE_PERMISSION_MODES` / `ClaudePermissionMode` | DELETE |
| `shared/src/modes.ts:11-12` | `CODEX_PERMISSION_MODES` / `CodexPermissionMode` | DELETE |
| `shared/src/modes.ts:14-15` | `CODEX_COLLABORATION_MODES` / `CodexCollaborationMode` | DELETE (cascades to schemas/resume/web — see below) |
| `shared/src/modes.ts:17-18` | `GEMINI_PERMISSION_MODES` / `GeminiPermissionMode` | DELETE |
| `shared/src/modes.ts:20-21` | `OPENCODE_PERMISSION_MODES` / `OpencodePermissionMode` | DELETE |
| `shared/src/modes.ts:23-24` | `CURSOR_PERMISSION_MODES` / `CursorPermissionMode` | KEEP (becomes the union of all surviving modes) |
| `shared/src/modes.ts:26-36` | `PERMISSION_MODES` (8-mode superset) / `PermissionMode` | NARROW to `CURSOR_PERMISSION_MODES`; `PermissionMode` becomes alias of `CursorPermissionMode` (D-78) |
| `shared/src/modes.ts:38` | `AgentFlavor` 5-literal union | NARROW to `'cursor'` |
| `shared/src/modes.ts:40-49` | `PERMISSION_MODE_LABELS` containing `acceptEdits`, `bypassPermissions`, `read-only`, `safe-yolo` | COLLAPSE to 4 cursor entries |
| `shared/src/modes.ts:53-62` | `PERMISSION_MODE_TONES` same shape | COLLAPSE to 4 cursor entries |
| `shared/src/modes.ts:70-78` | `CodexCollaborationModeOption` + `CODEX_COLLABORATION_MODE_LABELS` | DELETE |
| `shared/src/modes.ts:88-90` | `getCodexCollaborationModeLabel` | DELETE |
| `shared/src/modes.ts:92-106` | `getPermissionModesForFlavor` with codex/gemini/opencode/cursor branches + claude fallback | COLLAPSE to `caps.permissionModes` lookup (or single `CURSOR_PERMISSION_MODES` return) |
| `shared/src/modes.ts:108-114` | `getPermissionModeOptionsForFlavor` | KEEP signature; internal switch to capability lookup |
| `shared/src/modes.ts:116-118` | `isPermissionModeAllowedForFlavor` | KEEP signature; internal switch to capability lookup |
| `shared/src/modes.ts:120-125` | `getCodexCollaborationModeOptions` | DELETE |
| `shared/src/flavors.ts:1` | `import type { AgentFlavor } from './modes'` | KEEP (narrowed) |
| `shared/src/flavors.ts:4-9` | `Capabilities` const + `Capability` type | KEEP or convert to capability slot keys (planner's call) |
| `shared/src/flavors.ts:12-18` | `FLAVOR_CAPS: Record<AgentFlavor, Set<Capability>>` with 5 rows | COLLAPSE to single `cursor` row; SHAPE to `Record<AgentFlavor, FlavorCapabilities>` per D-72 |
| `shared/src/flavors.ts:21-27` | `FLAVOR_LABELS` 5 rows | COLLAPSE to `cursor: 'Cursor'` |
| `shared/src/flavors.ts:30-32` | `isKnownFlavor` | KEEP (rewires to new `FLAVOR_CAPS` shape) |
| `shared/src/flavors.ts:34-37` | `hasCapability` | REWRITE on Record (preserve signature for D-75) |
| `shared/src/flavors.ts:39-42` | `getFlavorLabel` (with `'Unknown'` fallback per D-83) | KEEP |
| `shared/src/flavors.ts:45-51` | `supportsModelChange` / `supportsEffort` | REWRITE on capability slots |
| `shared/src/flavors.ts:53-55` | `isCodexFamilyFlavor` | DELETE entirely (D-82) |
| `shared/src/flavors.test.ts` (entire file, 102 lines) | per-flavor matrix asserts | REWRITE per D-87: cursor capability slot asserts + unknown-fallback asserts + `isKnownFlavor` narrow asserts |
| `shared/src/resume.ts:2` | `import { CodexCollaborationModeSchema }` | DELETE import |
| `shared/src/resume.ts:4` | `AgentFlavorSchema = z.enum(['claude', 'codex', 'gemini', 'opencode', 'cursor'])` | NARROW to `z.enum(['cursor'])` (or `z.literal('cursor')`) |
| `shared/src/resume.ts:20` | `collaborationMode: CodexCollaborationModeSchema.optional()` | DELETE field |
| `shared/src/resume.test.ts:10/31` | `flavor: 'codex'` / `flavor: 'claude'` fixtures | REWRITE to `flavor: 'cursor'` |
| `shared/src/schemas.ts:2` | `import { CODEX_COLLABORATION_MODES, PERMISSION_MODES }` | DELETE codex import; keep PERMISSION_MODES (now narrowed) |
| `shared/src/schemas.ts:5` | `CodexCollaborationModeSchema = z.enum(CODEX_COLLABORATION_MODES)` | DELETE schema |
| `shared/src/schemas.ts:203` | `SessionSchema.collaborationMode: CodexCollaborationModeSchema.optional()` | DELETE field (see Summary #4 — wire-level cut, safe because Cursor never sets it) |
| `shared/src/types.ts:21` | `export { AGENT_MESSAGE_PAYLOAD_TYPE } from './modes'` | KEEP |
| `shared/src/types.ts:23-32` | re-exports `AgentFlavor`, `ClaudePermissionMode`, `CodexCollaborationMode`, `CodexCollaborationModeOption`, `CursorPermissionMode`, `PermissionMode`, etc. | DROP `ClaudePermissionMode`, `CodexCollaborationMode`, `CodexCollaborationModeOption` re-exports |
| `shared/src/types.ts:34` | `export type { ClaudeModelPreset } from './models'` | OUT-OF-SCOPE for this phase (models.ts is on Phase-1 whitelist; Phase 12 owns README; Phase 5 should DELETE if no Cursor consumer remains — see §"Cross-cut residue" |

### B. `hub/` — Slice 3 own scope

| Site | Kind | Resolution |
|------|------|------------|
| `hub/src/sync/syncEngine.ts:11` | `import type { AgentFlavor, ... }` | KEEP (narrowed type) |
| `hub/src/sync/syncEngine.ts:366` | `agent: 'claude' \| 'cursor' = 'claude'` default param | COLLAPSE to `agent: 'cursor' = 'cursor'` (or drop param entirely if call sites supply) |
| `hub/src/sync/syncEngine.ts:391-394` | `resolveFlavor` returning `flavor === 'cursor' ? flavor : 'cursor'` | COLLAPSE to constant `'cursor'` literal (or read from metadata + fallback) — D-84#2 explicitly calls this out |
| `hub/src/sync/syncEngine.ts:402-403` | `resolveAgentResumeId` flavor check | SIMPLIFY: always return `metadata.cursorSessionId ?? null` |
| `hub/src/sync/syncEngine.ts:518-520` | `if (flavor !== 'claude' && flavor !== 'cursor') { return error }` | COLLAPSE to `if (flavor !== 'cursor')` |
| `hub/src/sync/rpcGateway.ts:125` | `agent: 'claude' \| 'cursor' = 'cursor'` | COLLAPSE union → `'cursor'`-only |
| `hub/src/sync/sessionModel.test.ts` (8 hits) | `flavor: 'claude'`, `type: 'codex'` fixtures | REWRITE `flavor` to `'cursor'`; KEEP `type: 'codex'` (wire literal — but must use `AGENT_MESSAGE_PAYLOAD_TYPE` constant import to avoid ripgrep hit) |
| `hub/src/sync/todos.ts:9` | `extractTodosFromClaudeOutput` helper | RENAME → `extractTodosFromAgentOutput` (Claude-only naming residue) — or KEEP if Cursor doesn't use that path (verify); IF unreachable, DELETE |
| `hub/src/web/routes/sessions.ts:1` | `import { getPermissionModesForFlavor, isPermissionModeAllowedForFlavor, supportsModelChange, toSessionSummary }` | KEEP (helpers stay) |
| `hub/src/web/routes/sessions.ts:149` | `const flavor = sessionResult.session.metadata?.flavor ?? 'claude'` | COLLAPSE default → `'cursor'` |
| `hub/src/web/routes/sessions.ts:297/335/365` | same `?? 'claude'` defaults | COLLAPSE to `'cursor'` |
| `hub/src/web/routes/sessions.ts:366` | `if (flavor !== 'claude') { return error }` | COLLAPSE / remove (route was Claude-effort only; if endpoint dead, delete the endpoint) |
| `hub/src/web/routes/sessions.ts:449-450` | comment "default to 'claude'" + `agent = ... ?? 'claude'` | COLLAPSE default → `'cursor'` |
| `hub/src/web/routes/sessions.test.ts` (multiple `flavor: 'claude'`, `mode: 'bypassPermissions'`) | test fixtures | REWRITE to `flavor: 'cursor'`, `mode: 'yolo'` (Cursor's equivalent) |
| `hub/src/web/routes/permissions.ts:59` | `const flavor = session.metadata?.flavor ?? 'claude'` | COLLAPSE default → `'cursor'` |
| `hub/src/web/routes/cli.test.ts:105/124` | `flavor: 'claude'` fixtures | REWRITE to `'cursor'` |
| `hub/src/web/routes/machines.ts:9` | `agent: z.enum(['claude', 'cursor']).optional()` | NARROW to `z.enum(['cursor'])` or `z.literal('cursor')` |
| `hub/src/web/routes/machines.test.ts` | possibly enum-dependent assertions | VERIFY + REWRITE |
| `hub/src/notifications/sessionInfo.ts:1` | `import { getFlavorLabel, isKnownFlavor }` | KEEP (helpers retain `'Unknown'` fallback per D-83) |

### C. `cli/` — Slice 3 own scope

| Site | Kind | Resolution |
|------|------|------------|
| `cli/src/agent/types.ts:1,74` | `import type { AgentFlavor }` + `setModel(...opts?: { flavor?: AgentFlavor })` | KEEP (type narrows automatically) |
| `cli/src/api/types.ts:4,14,23,28,124` | `CodexCollaborationModeSchema` import + re-export + `SessionCollaborationMode = CodexCollaborationMode` alias + field | DELETE all 5 sites |
| `cli/src/api/apiSession.ts` (Phase-1 whitelist note) | likely uses `AGENT_MESSAGE_PAYLOAD_TYPE` already (line 12 import) | VERIFY; only narrow if `flavor === '...'` branches exist |
| `cli/src/commands/cursor.ts:6,41` | `CURSOR_PERMISSION_MODES` usage | KEEP unchanged |
| `cli/src/commands/runner.ts` | uses agent type unions (Phase-1 whitelist) | NARROW per type collapse |
| `cli/src/modules/common/rpcTypes.ts:7` | `agent?: 'claude' \| 'codex' \| 'cursor' \| 'gemini' \| 'opencode'` | COLLAPSE to `agent?: 'cursor'` |
| `cli/src/modules/common/slashCommands.ts:27-56` | `BUILTIN_COMMANDS: { claude: [...], codex: [...], gemini: [...], opencode: [] }` | DELETE all 4 entries; replace with `cursor: []` (since Cursor has no HAPI-injected builtins) OR drop builtin map entirely |
| `cli/src/modules/common/slashCommands.ts:100-114` | `getUserCommandsDir` switch on `'claude'`/`'codex'` | COLLAPSE to capability lookup `caps.userSlashCommandsDir?.(homedir())` per D-73 (returns `null` for Cursor today) |
| `cli/src/modules/common/slashCommands.ts:120-130` | `getProjectCommandsDir` switch on `'claude'`/`'codex'` | COLLAPSE to capability lookup `caps.projectSlashCommandsDir?.(projectDir)` per D-73 |
| `cli/src/modules/common/slashCommands.ts:265` | `if (agent !== 'claude') return []` (scanPluginCommands) | REWRITE: drop the plugin-scan path (Cursor doesn't use Claude plugin format) OR collapse to capability lookup if a `pluginsDir` slot is added (NOT recommended per D-74) — recommend DELETE the function + caller |
| `cli/src/modules/common/slashCommands.test.ts` (8 hits with `'claude'`/`'codex'` literals) | tests of switch behaviour | REWRITE to `'cursor'` (or DELETE if entire behaviour collapsed) |
| `cli/src/modules/common/skills.ts:34,154` | `'/etc/codex/skills'` path + `isCodexSkillsRoot` helper | DELETE codex skill scan (Cursor has its own skills source — Milestone 2 CURS-02 territory; for now drop the codex branch) |
| `cli/src/modules/common/skills.test.ts` | codex skill fixture tests | REWRITE / DELETE accordingly |
| `cli/src/modules/common/permission/BasePermissionHandler.ts` | likely a flavor literal in default mode handling | INSPECT + collapse |
| `cli/src/cursor/runCursor.ts:11,109` | `isPermissionModeAllowedForFlavor(parsed.data, 'cursor')` | KEEP (legit cursor-anchored guard) |
| `cli/src/runner/run.ts:235` | `const agent = options.agent ?? 'claude'` | COLLAPSE → `'cursor'` |
| `cli/src/runner/run.ts:349` | `if (options.agent === 'claude' \|\| !options.agent)` | COLLAPSE branch |
| `cli/src/runner/run.ts:894-895` | `const agentCommand = agent === 'cursor' ? 'cursor' : 'claude'` | COLLAPSE to `'cursor'` constant |
| `cli/src/runner/run.ts:903` | `if (options.effort && agent === 'claude')` | DELETE branch (Cursor doesn't take `--effort`) |
| `cli/src/runner/buildCliArgs.test.ts` (5 hits) | tests of `'claude'` agent | REWRITE to `'cursor'`; drop the all-mode enumeration including `acceptEdits`/`bypassPermissions`/`read-only`/`safe-yolo` |
| `cli/src/utils/attachmentFormatter.ts:7` | `formatAttachmentsForClaude` | RENAME → `formatAttachmentsForAgent` (Claude-only naming) OR confirm Cursor consumer + rename |
| `cli/src/parsers/specialCommands.ts` | likely flavor literals | INSPECT + collapse |
| `cli/src/agent/serverUtils/{buildHapiMcpBridge,startHookServer,startHappyServer}.ts` | Phase-1 whitelist; flavor refs | INSPECT — these were Cursor-shared hook servers; verify Cursor uses them. If yes, narrow type; if no, dead code |
| `cli/src/ui/logger.ts` | flavor-tagged log scopes (Phase-1 whitelist) | NARROW scope labels to cursor-only |
| `cli/src/ui/ink/CodexDisplay.tsx` | entire file — Codex-specific terminal UI | DELETE (Codex runtime gone) — or VERIFY referenced; if referenced, rename to AgentDisplay |
| `cli/src/ui/ink/RemoteModeDisplay.tsx` | flavor literals (Phase-1 whitelist) | INSPECT — likely cursor-only after narrow |

### D. `web/` — Slice 2 own scope (most volume)

| Site | Kind | Resolution |
|------|------|------------|
| `web/src/chat/modelConfig.ts:21-25` | `if (flavor === 'codex')` + `if (flavor !== 'claude')` codex/claude context window branches | COLLAPSE to `getCapability(flavor, 'contextBudgetTokens')` |
| `web/src/chat/modelConfig.test.ts` (all 4 cases) | per-flavor budget asserts | REWRITE to cover only cursor + unknown |
| `web/src/components/ToolCard/PermissionFooter.tsx:7,25-28` | `isCodexFamilyFlavor` import + `isCodexSession` helper + `toolName.startsWith('Codex')` fallback | DELETE `isCodexSession` entirely (always `false` post-narrow); drop all `codex` UI branches (lines 215-238 codex `<>...</>` block, line 138 `!codex && ...`, line 139 `!codex && ...`, lines 171-189 `codexApprove` / `codexAbort` functions); drop `permission.mode === 'acceptEdits'` branch (line 43) + `approvePermission(... 'acceptEdits')` call (line 151) |
| `web/src/components/AssistantChat/StatusBar.tsx:2,5,9,114-128,141,189-205` | imports of `getCodexCollaborationModeLabel` + `isPermissionModeAllowedForFlavor`; codex branches `formatCodexReasoningLabel`, `isCodexFastMode`, `displayCollaborationMode = props.agentFlavor === 'codex' ...`, `codexReasoningLabel`, `codexFastMode`, `goalLabel` | DELETE all codex helpers + branches; KEEP context-budget lookup (via capability); narrow `agentFlavor` param to optional `'cursor'` literal or drop param entirely |
| `web/src/components/AssistantChat/HappyComposer.tsx:1,15,48,64,283,291,474` | `getCodexCollaborationModeOptions` + `getPermissionModeOptionsForFlavor` imports; `collaborationMode` prop + change handler; `agentFlavor === 'codex' ? getCodexCollaborationModeOptions() : []` branches | DELETE `collaborationMode`-related code paths; KEEP `getPermissionModeOptionsForFlavor` (it's a capability lookup); collapse `agentFlavor === 'codex'` to constant `false` and DCE |
| `web/src/components/AssistantChat/messages/AssistantMessage.tsx` / `QueuedMessagesBar.tsx` / `MessageMetadata.test.ts` | various flavor refs | INSPECT + collapse |
| `web/src/components/AssistantChat/messages/CodexReviewCard.tsx` + `.test.tsx` | dedicated Codex review UI card | DELETE entire file (Codex runtime gone) |
| `web/src/components/AssistantChat/codexReasoningEffortOptions.ts` | Codex reasoning effort options | DELETE entire file |
| `web/src/components/AssistantChat/claudeEffortOptions.ts` + `.test.ts` | Claude effort options | DELETE entire file |
| `web/src/components/AssistantChat/claudeModelOptions.ts` + `claudeModelOptions.test.ts` | Claude model options | DELETE entire file |
| `web/src/components/AssistantChat/modelOptions.ts:4` | `ModelOption = ClaudeComposerModelOption` alias | REWRITE / DELETE (Cursor model UI doesn't ship until CURS-01) |
| `web/src/components/AssistantChat/modelOptions.test.ts` (line 6,25) | `getModelOptionsForFlavor('claude')` tests | REWRITE to use `'cursor'` or DELETE |
| `web/src/components/NewSession/AgentSelector.tsx:17` | hardcoded 5-literal agent array | DELETE entire component (single-agent UI has no choice) OR collapse to no-op |
| `web/src/components/NewSession/preferences.ts:6,17` | `VALID_AGENTS` list + default `'claude'` | DELETE entire file (preference is no-op) OR collapse to `'cursor'` constant and remove storage logic |
| `web/src/components/NewSession/preferences.test.ts` (5 hits) | tests assert claude/codex/gemini preferences | DELETE or REWRITE for cursor-only |
| `web/src/components/NewSession/types.ts:1,3-4,22,30` | `AgentType = 'claude' \| 'codex' \| 'cursor' \| 'gemini' \| 'opencode'`; `CodexReasoningEffort` / `ClaudeEffort` types; `CODEX_REASONING_EFFORT_OPTIONS` / `CLAUDE_EFFORT_OPTIONS` arrays | COLLAPSE `AgentType` to `'cursor'`; DELETE `CodexReasoningEffort` / `ClaudeEffort` types + option arrays |
| `web/src/components/NewSession/types.test.ts` | per-agent type tests | REWRITE / DELETE |
| `web/src/components/NewSession/index.tsx:107,281-282,361-364` | `agent === 'codex'` branches for codex models gate, reasoning effort, model selector | DELETE all codex branches |
| `web/src/components/NewSession/ClaudeEffortSelector.tsx:13` | `if (props.agent !== 'claude') return null` | DELETE entire component (Cursor doesn't have Claude-effort UI) |
| `web/src/components/NewSession/ReasoningEffortSelector.tsx:13` | `if (props.agent !== 'codex') return null` | DELETE entire component |
| `web/src/components/NewSession/OpencodeModelSelector.tsx`, `opencodeModelsGate.{ts,test.ts}` | OpenCode-specific (carry-over from Phase 1 known stubs per 01-04 SUMMARY) | DELETE entire files (unreachable after AgentType narrow) |
| `web/src/components/SessionChat.tsx:7,81,132,136,139,284,494,498,518,523` | `CodexCollaborationMode` import; `block.tool.name === 'CodexAgent'` rendering branch; multiple `agentFlavor === 'codex'` and `agentFlavor !== 'codex'` branches; `handleCollaborationModeChange` | DELETE Codex tool-name handling (covered by ToolCard cleanup); DELETE collaboration-mode handler; collapse `agentFlavor === 'codex'` to constant `false` |
| `web/src/components/SessionList.tsx:491-520` | `FLAVOR_BADGES` 4-entry map + `FlavorIcon` reading `(flavor ?? 'claude')` | COLLAPSE to single `cursor` row; change default to `'cursor'`; ICON simplifies |
| `web/src/components/SessionList.test.ts:92` / `.directory-action.test.tsx:53` | `flavor: 'codex'` test fixtures | REWRITE to `'cursor'` |
| `web/src/components/ToolCard/codexAgents.ts` (entire file, 320 lines) | Codex-specific agent tool helpers | DELETE entire file (no Cursor caller) |
| `web/src/components/ToolCard/views/CodexDiffView.tsx` | Codex diff renderer | DELETE entire file |
| `web/src/components/ToolCard/views/CodexPatchView.tsx` | Codex patch renderer | DELETE entire file |
| `web/src/components/ToolCard/views/_all.tsx:4-5,16-19,38-74` | `CodexDiffCompactView` / `CodexDiffFullView` / `CodexPatchView` imports + `CodexAgentView` component | DELETE codex views from registry |
| `web/src/components/ToolCard/views/_results.tsx:97-292,492-770` | `CodexBashOutput`, `extractCodexBashDisplay`, `parseCodexBashOutput`, `CodexBashResultView`, `CodexPatchResultView`, `CodexReasoningResultView`, `CodexDiffResultView`, `CodexAgentResultView` | DELETE all codex result views |
| `web/src/components/ToolCard/views/_results.test.tsx:150,316-325,411,423` | codex result view tests | DELETE codex tests |
| `web/src/components/ToolCard/trace.tsx:63,109` / `trace.test.tsx:98,110` | `if (block.tool.name === 'CodexAgent')` rendering branches | DELETE codex tool-name branches |
| `web/src/components/ToolCard/groupedPresentation.ts:60,67` / `.test.ts:46` | `CodexBash`, `CodexPatch`, `CodexDiff` in grouped tool detection | DELETE codex tool-name literals |
| `web/src/components/ToolCard/ToolCard.tsx:29` / `.test.ts:6` | `TERMINAL_RELATED_TOOL_NAMES = new Set(['Bash', 'CodexBash', ...])` | DROP `'CodexBash'` |
| `web/src/components/ToolCard/knownTools.test.tsx` | `'CodexAgent'` test cases | DELETE |
| `web/src/chat/types.ts:68-260` | `CodexReviewFinding`, `CodexReview`, `CodexReviewBlock`, `ChatBlock` union containing `CodexReviewBlock` | DELETE codex review types; narrow `ChatBlock` union |
| `web/src/chat/normalize.test.ts` (12+ hits with `type: 'codex'`, `source: 'codex'`) | normalizer fixtures | REWRITE to use `AGENT_MESSAGE_PAYLOAD_TYPE` constant import (so ripgrep sees no literal); for `source: 'codex'` references which appear to be Codex-specific normalize paths, DELETE entire test cases |
| `web/src/chat/normalizeAgent.ts:54,145,173,204,412,735,746` | `normalizeCodexTokenUsage`, `normalizeCodexReviewFinding`, `normalizeCodexReviewJson`, `parseCodexReviewMessage`, `isCodexContent`, two `source: 'codex'` emissions | DELETE Codex-only normalize functions; for `source: 'codex'` emissions REWRITE to use `AGENT_MESSAGE_PAYLOAD_TYPE` import |
| `web/src/chat/reducerTimeline.ts` + `.test.ts` (13 hits — `'CodexAgent'`/`'CodexBash'` tool names in tests) | timeline reducer with codex tool branches | DELETE codex tool-name branches |
| `web/src/chat/reducerEvents.ts:3` | `parseClaudeUsageLimit` | DELETE (Claude-specific) |
| `web/src/chat/reducerEvents.test.ts` | per-flavor event tests | REWRITE / DELETE |
| `web/src/chat/reducer.test.ts:262` / `reducerCliOutput.test.ts:2` | `type: 'codex'` fixtures | REWRITE via `AGENT_MESSAGE_PAYLOAD_TYPE` import |
| `web/src/chat/reconcile.ts:149` | `areCodexReviewBlocksEqual` | DELETE |
| `web/src/chat/subagentTool.ts` | flavor reference | INSPECT |
| `web/src/chat/toolGroups.test.ts` | codex tool-name fixtures | REWRITE/DELETE |
| `web/src/chat/presentation.test.ts` | codex-related case | REWRITE/DELETE |
| `web/src/chat/normalize.test.ts:532,543` | `source: 'codex'` literal | REWRITE via constant import |
| `web/src/hooks/queries/useCodexModels.ts` | entire codex models hook | DELETE (no Cursor caller) |
| `web/src/hooks/mutations/useSpawnSession.ts:9` | `agent?: 'claude' \| 'codex' \| 'cursor' \| 'gemini' \| 'opencode'` | COLLAPSE to `agent?: 'cursor'` |
| `web/src/hooks/mutations/useSessionActions.ts:2,4,19,70,79,83,109` | `CodexCollaborationMode` imports + `setCollaborationMode` mutation + `agentFlavor !== 'codex'` guards | DELETE collaboration-mode mutation entirely |
| `web/src/hooks/useActiveSuggestions.ts` | flavor reference | INSPECT + collapse |
| `web/src/api/client.ts:4,352,383-384,445` | `CodexCollaborationMode` import + `setCollaborationMode` method + `approvePermission(..., 'default' \| 'acceptEdits' \| ...)` union + `agent?: 'claude' \| 'codex' \| 'cursor' \| 'gemini' \| 'opencode'` | DELETE `setCollaborationMode`; collapse `approvePermission`'s mode union to `CursorPermissionMode`; collapse `agent` parameter to `'cursor'` |
| `web/src/lib/agentSlashCommands.ts:4` | comment `// future-proofing (Phase 5 will narrow ...)` | DELETE comment (Phase 5 is now) |
| `web/src/lib/assistant-runtime.ts:49` | `formatCodexReviewText` | DELETE |
| `web/src/lib/assistant-runtime.test.ts` | per-flavor fixtures | REWRITE / DELETE |
| `web/src/lib/message-window-store.ts:426-434` | `isCodexAgentRunMessage` + `payload.type !== 'codex'` check | REWRITE: import `AGENT_MESSAGE_PAYLOAD_TYPE` instead of bare `'codex'`; KEEP function but rename `isCodexAgentRunMessage` → `isAgentRunMessage` |
| `web/src/lib/message-window-store.test.ts:73,99` | `type: 'codex'` fixtures | REWRITE via constant import |
| `web/src/lib/query-keys.ts` | per-flavor cache keys | NARROW to cursor-only |
| `web/src/lib/sessionModelLabel.test.ts` | claude-name fixtures | REWRITE / DELETE |
| `web/src/lib/locales/en.ts` / `zh-CN.ts` | i18n strings mentioning Claude/Codex/etc. | DELETE strings (UI doesn't surface them post-narrow) |
| `web/src/router.tsx:340` | `?? 'claude'` default | COLLAPSE to `'cursor'` |
| `web/src/types/api.ts:12,218,226` | `CodexCollaborationMode` re-export + `CodexModelSummary` + `CodexModelsResponse` types | DELETE all 3 types (no Cursor consumer) |

## Capability slot validation (per slot — coverage vs. real call sites)

| Slot (D-73) | Replaces which sites | Coverage gaps |
|-------------|---------------------|---------------|
| `permissionModes` | `shared/src/modes.ts:92-106 getPermissionModesForFlavor` + downstream `getPermissionModeOptionsForFlavor`, `isPermissionModeAllowedForFlavor`. Consumed by `hub/src/web/routes/{sessions,permissions}.ts`, `cli/src/cursor/runCursor.ts`, `web/src/components/AssistantChat/{StatusBar,HappyComposer}.tsx`, `web/src/hooks/mutations/useSessionActions.ts`. | None — covers all real sites. |
| `supportsModelChange` | `shared/src/flavors.ts:45-47 supportsModelChange`. Consumed by `hub/src/web/routes/sessions.ts:1` (import only — verify use) and any web UI conditional. | None today. Future CURS-01 flips to `true` + needs a `modelListSource` slot (out of scope). |
| `supportsEffort` | `shared/src/flavors.ts:49-51 supportsEffort`. No current consumer (greps return zero hits outside `flavors.test.ts`). | **GAP: no active consumer** — slot is forward-looking only. Keep per D-72/D-73 to make `cursor: { supportsEffort: false }` explicit, but planner should verify zero downstream callers in PLAN. |
| `contextBudgetTokens` | `web/src/chat/modelConfig.ts:20-47 getContextBudgetTokens`. Indirectly consumed by `StatusBar.tsx` lines 154/162/169 via the helper. | **Partial coverage** — current logic is model-aware (`'sonnet[1m]' → 1M`). Cursor's `null` slot is correct *today*; future model-aware variants need a richer slot (`(model: string) => number \| null`). Document as a TODO for CURS-01. |
| `userSlashCommandsDir` | `cli/src/modules/common/slashCommands.ts:100-114 getUserCommandsDir`. | Plugin scanning (`scanPluginCommands`, line 263) was Claude-plugin-only — not covered by this slot. **Recommendation: delete `scanPluginCommands` outright; Cursor uses its own command surface.** |
| `projectSlashCommandsDir` | `cli/src/modules/common/slashCommands.ts:120-130 getProjectCommandsDir`. | None — direct 1:1 replacement. |
| `permissionToneCopy` | `web/src/components/ToolCard/PermissionFooter.tsx:25-28 isCodexSession`. | The `toolName.startsWith('Codex')` fallback (line 27) is **unreachable** post-Phase-1 (no `Codex*` toolName emitted by Cursor). Drop the fallback. Slot is sufficient. |

**Additional slot candidates surfaced during research** (not in D-73, recommended for inclusion if real consumers exist):

| Candidate slot | Reason | Recommendation |
|----------------|--------|----------------|
| `cliBinaryName: string` | `cli/src/runner/run.ts:894` `agentCommand = agent === 'cursor' ? 'cursor' : 'claude'` | NOT needed after narrow — collapse to constant `'cursor'`. Adding a slot is over-engineering per D-74. |
| `agentSpawnEnumValue` | `hub/src/web/routes/machines.ts:9` `z.enum(['claude', 'cursor'])` | NOT needed — Zod enum collapses to single literal. |
| `modelListSource` | `web/src/hooks/queries/useCodexModels.ts` (file deletion) | NOT needed for v1; flag for CURS-01 (Milestone 2). |
| `acceptsEffortFlag: boolean` | `cli/src/runner/run.ts:903` `if (options.effort && agent === 'claude')` | NOT needed — branch deletes; same semantics as `supportsEffort` capability. |

**Verdict: D-73's seven slots cover all current real consumers. No new slots required for Phase 5.**

## Compile-blast radius after narrow (predicted)

After Slice 1 narrows `AgentFlavor = 'cursor'` and deletes `CLAUDE_/CODEX_/GEMINI_/OPENCODE_PERMISSION_MODES` + `CodexCollaborationMode*` + `CODEX_COLLABORATION_MODES` + `isCodexFamilyFlavor`, expected `bun typecheck` failures by file (HIGH-confidence — derived from grep hits):

**Hard failures (missing symbol imports):**

- `shared/src/schemas.ts:2,5,203` — `CODEX_COLLABORATION_MODES` import + `CodexCollaborationModeSchema` definition + `SessionSchema.collaborationMode` field.
- `shared/src/resume.ts:2,20` — `CodexCollaborationModeSchema` import + field.
- `shared/src/types.ts:24-32` — re-export list contains deleted types.
- `cli/src/api/types.ts:4,14,23,28,124` — `CodexCollaborationModeSchema` + `CodexCollaborationMode` import/usage.
- `web/src/api/client.ts:4,352` — `CodexCollaborationMode` import + `setCollaborationMode` method.
- `web/src/components/AssistantChat/StatusBar.tsx:2` — `getCodexCollaborationModeLabel` import.
- `web/src/components/AssistantChat/HappyComposer.tsx:1` — `getCodexCollaborationModeOptions` import.
- `web/src/components/SessionChat.tsx:7` — `CodexCollaborationMode` import.
- `web/src/hooks/mutations/useSessionActions.ts:4` — `CodexCollaborationMode` import.
- `web/src/components/ToolCard/PermissionFooter.tsx:7` — `isCodexFamilyFlavor` import.
- `web/src/types/api.ts:12` — `CodexCollaborationMode` re-export.

**Soft failures (literal type mismatch — string `'claude'` no longer assignable to narrowed `AgentFlavor`):**

- Every site listed in §"Call-site inventory" section B/C/D that uses bare string literals `'claude' | 'codex' | 'gemini' | 'opencode'` typed against `AgentFlavor` or `AgentType`.

**Slice ordering rationale:** Slice 1 lands the type narrow but **cannot** atomically delete `CodexCollaborationModeSchema` from `shared/src/schemas.ts` until web consumers are rewritten (slice 2) — typecheck would fail across packages mid-slice. **Recommendation: Slice 1 narrows the type union + adds the new `Record` shape with backward-compat helpers for `getPermissionModesForFlavor` to keep returning a valid array; defer `CodexCollaborationMode*` deletion to a "Slice 1b" or to slice 4 (after slices 2-3 land downstream rewrites).** This is a refinement to D-86 — see §"Recommended slice ordering refinement" below.

## Ripgrep guard additions (concrete per D-84 + D-85)

The existing guard `scripts/check-no-cut-agents.sh` already enforces `\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b -i` outside whitelisted files. Phase 5's mandate is to **shrink the whitelist to empty for the agent literals**. Specific edits:

### Whitelist entries to REMOVE (already in script — lines 49-117)

After Phase 5 lands, every line tagged `# === Phase-5 territory` in `scripts/check-no-cut-agents.sh` must be deleted. Concretely, all `--glob '!shared/src/...'`, `--glob '!hub/src/...'`, `--glob '!cli/src/...'`, `--glob '!web/src/...'` entries between lines 49 and 117 in the current guard.

### Whitelist entries to ADD (line-anchored)

Two whitelist mechanisms are available — full-file glob (current) and ripgrep `-g` with a content-based filter. D-85 explicitly says "line-anchored with JSDoc anchor". `rg` does not support line-anchored whitelist natively; the canonical pattern is `rg ... \| grep -v 'AGENT_MESSAGE_PAYLOAD_TYPE.*as const'`. **Recommendation: implement as a post-filter:**

```bash
# After the main rg call, post-filter the only legitimate residue:
SURVIVORS=$("$RG_BIN" -n -i "${WHITELIST[@]}" "$PATTERN" .) || true
SURVIVORS_FILTERED=$(echo "$SURVIVORS" | grep -v "shared/src/modes.ts:.*AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const" || true)
if [ -n "$SURVIVORS_FILTERED" ]; then ...
```

Alternatively, wrap the legitimate literal in a JSDoc-tagged single line and add a `--glob '!shared/src/modes.ts'` with a **CI assertion** that the file contains exactly one `'codex'` occurrence at the documented line (a guard-of-the-guard). **Planner picks.** Recommendation: post-filter is simpler and avoids re-introducing a whole-file whitelist.

### New keyword sweep (Phase 5 additions on top of existing)

Already covered by existing `PATTERN='\b(claude|codex|gemini|opencode|...)\b'`. Phase 5 doesn't add new keyword classes — it removes whitelist tolerance for the existing keywords.

### Additional Phase-5 identifier checks (recommended per D-84#3)

```bash
PHASE5_IDENTIFIER_PATTERN='isCodexFamilyFlavor|CodexCollaborationMode|getCodexCollaboration|_PERMISSION_MODES'
if "$RG_BIN" -n "$PHASE5_IDENTIFIER_PATTERN" cli/src hub/src web/src shared/src; then
  echo "❌ Phase-5 forbidden symbol survived collapse."
  exit 1
fi
```

The `_PERMISSION_MODES` regex catches `CLAUDE_PERMISSION_MODES` etc. but **also matches `CURSOR_PERMISSION_MODES` and the legitimate `PERMISSION_MODES` constant**. Sharpen to: `(CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES`. Same correction applies to `_COLLABORATION_`. Final pattern:

```bash
PHASE5_IDENTIFIER_PATTERN='\bisCodexFamilyFlavor\b|\bCodexCollaborationMode\b|\bgetCodexCollaboration\w*\b|\b(CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES\b'
```

### `flavor === '...'` non-cursor literal check

```bash
PHASE5_BRANCH_PATTERN="flavor\s*===\s*['\"](?!cursor)(claude|codex|gemini|opencode)['\"]"
# or simpler — disallow ANY 'flavor === literal' unless it's exactly 'cursor':
PHASE5_BRANCH_PATTERN="flavor\s*===\s*['\"]"
# (then post-filter to allow only 'cursor')
```

Recommendation: use the simple pattern + post-filter exception for the single legit cursor narrow in resume / runCursor (if any survives). Per D-84#2, ideally even `flavor === 'cursor'` collapses away — verify in PLAN review.

## Wire-layer narrow safety analysis

**Question:** Does narrowing `AgentFlavor = 'cursor'` break Zod schemas / SQLite store / SSE deserialization for historical rows that may carry `flavor: 'claude' | 'codex' | ...`?

**Findings:**

1. **`shared/src/schemas.ts:50` `MetadataSchema.flavor: z.string().nullish()`** — flavor is stored as plain `z.string()`, NOT `z.enum`. **No Zod validation will fail** on a historical `flavor: 'claude'` row. The Zod schema is wider than the TypeScript type, intentionally — `z.string()` admits any string, the type narrow is purely type-level discipline.
2. **`shared/src/resume.ts:4` `AgentFlavorSchema = z.enum([...])`** — this IS a Zod enum. Narrowing it to `z.enum(['cursor'])` (or `z.literal('cursor')`) will REJECT old resume payloads with non-cursor flavors. **Impact assessment:** `LocalResumeTargetSchema` is used by `cli/src/api/types.ts` and `cli/src/commands/resume.ts` (already cursor-only post-Phase-1) — historical resume payloads are CLI-side, never persisted long-term in SQLite (resumes happen within an active CLI session). No long-lived persisted data carries this enum. **Verdict: safe to narrow.** Per AGENTS.md "no backward compatibility", a historical resume payload with `flavor: 'claude'` is acceptable to reject — the user must start a new session.
3. **SQLite store** — `hub/src/store/` reads `metadata` as JSON blob via `Metadata` type alias on top of `z.string().nullish()`. Historical rows with non-cursor `flavor` strings ingest cleanly; reads return the string as-is; consumers compare against `'cursor'` and treat anything else as unknown (graceful per D-76). **Verdict: safe.**
4. **SSE patch deserialization** — `web/src/hooks/useSSE.ts` and `shared/src/socket.ts` carry the wire schema. SSE events emit `Session` with `metadata.flavor: string` (per the `MetadataSchema` Zod definition). Historical SSE events stay parseable; web consumers compare via `=== 'cursor'` and don't crash on other strings.
5. **`SessionSchema.collaborationMode: CodexCollaborationModeSchema.optional()`** — DELETING this field from the schema means new SSE events won't carry it. Historical SQLite rows that still have `collaborationMode: 'plan'` ingest cleanly because Zod's default object semantics allow unknown keys (Zod 4 doesn't strip by default). **Verdict: safe to delete the field per Summary #4 and D-70 (which preserves `flavor` but says nothing about `collaborationMode`).**

**Overall verdict: type narrow is safe** because `MetadataSchema.flavor` was already typed as `z.string()` (not enum) — a foresight from earlier phases. The only Zod enum involved is `AgentFlavorSchema` in resume.ts, and resume payloads don't survive across sessions.

## Recommended 4-slice ordering refinement of D-86

CONTEXT.md D-86 specifies 4 slices: (1) shared/, (2) web/, (3) cli+hub, (4) ripgrep guard. Research findings recommend **decomposing slices 2 and 3** and adding a **Slice 1b** to handle wire-schema cuts that need downstream rewrites first.

### Refined slice plan

**Slice 1: `shared/` — type narrow + capability shape (NON-BREAKING for wire)**

- Narrow `AgentFlavor = 'cursor'` in `shared/src/modes.ts:38`.
- Add new `FlavorCapabilities` type + `FLAVOR_CAPS: Record<...>` shape with single `cursor` row.
- Keep `CodexCollaborationModeSchema` / `*_PERMISSION_MODES` constants alive but mark `@deprecated` (or just leave for slice 1b).
- Rewrite `getPermissionModesForFlavor` / `getPermissionModeOptionsForFlavor` / `isPermissionModeAllowedForFlavor` internals to read capability.
- Delete `isCodexFamilyFlavor`.
- Rewrite `shared/src/flavors.test.ts` per D-87.
- **Green:** `bun typecheck` + `bun run test` + guard.
- **Why this slice is safe alone:** it doesn't touch wire schemas; only adds the new shape and removes the obviously-unused helper.

**Slice 1b (NEW — between D-86 #1 and #2): wire schema cuts**

- DELETE `CodexCollaborationModeSchema` / `CodexCollaborationMode` / collaboration-mode fields from `shared/src/{schemas,resume,types}.ts`.
- DELETE `CLAUDE_/CODEX_/GEMINI_/OPENCODE_PERMISSION_MODES` constants + types.
- DELETE `CODEX_COLLABORATION_MODES` constant + label map.
- Narrow `AgentFlavorSchema = z.enum(['cursor'])`.
- Collapse `PERMISSION_MODES` to Cursor's 4 + collapse `PermissionMode` to `CursorPermissionMode`.
- Collapse `PERMISSION_MODE_LABELS` / `PERMISSION_MODE_TONES`.
- **This breaks ALL downstream consumers.** Must be merged with slices 2+3 below as a single PR (or slices 2+3 done IMMEDIATELY before this slice's commit so typecheck stays green across the boundary).
- **Alternative ordering:** Do slices 2+3 first (against the existing shared/ shape but read-from-new-capability-table only where slice 1 added it), THEN land slice 1b which closes the door.
- **Recommendation: PLAN does slices 2+3 first (consume capability), then 1b (delete dead shared symbols), then 4 (guard).** This is the safer order — each commit is independently green.

**Slice 2: `web/` consumer collapse (large — sub-decompose into 2a, 2b, 2c)**

- 2a: **ToolCard subsystem** — DELETE `codexAgents.ts`, `CodexDiffView.tsx`, `CodexPatchView.tsx`, codex result views in `views/_results.tsx`, codex tool-name branches in `trace.tsx` / `groupedPresentation.ts` / `ToolCard.tsx` / `knownTools.test.tsx` / `_all.tsx`. Rewrite `PermissionFooter.tsx` (drop codex branch, drop `acceptEdits` UI, capability lookup).
- 2b: **NewSession + AssistantChat + SessionList** — DELETE `AgentSelector.tsx`, `preferences.ts` (or collapse), `ClaudeEffortSelector.tsx`, `ReasoningEffortSelector.tsx`, `OpencodeModelSelector.tsx` + gates, `claudeEffortOptions.ts`, `claudeModelOptions.ts`, `codexReasoningEffortOptions.ts`, `CodexReviewCard.tsx`; collapse `AgentType` to `'cursor'`; rewrite `NewSession/index.tsx` codex branches; rewrite `StatusBar.tsx`, `HappyComposer.tsx`, `SessionChat.tsx`, `SessionList.tsx` flavor branches.
- 2c: **chat/ + lib/ + hooks/ + api/** — Rewrite `chat/modelConfig.ts`, `chat/normalizeAgent.ts`, `chat/normalize.test.ts`, `chat/reducerTimeline.ts`, `chat/reducerEvents.ts`, `chat/reconcile.ts`, `chat/types.ts`. DELETE `hooks/queries/useCodexModels.ts`. Rewrite `hooks/mutations/{useSpawnSession,useSessionActions}.ts`. Rewrite `api/client.ts` (drop `setCollaborationMode`, narrow union, narrow `approvePermission`). Rewrite `types/api.ts`. Rewrite `lib/{message-window-store,query-keys,assistant-runtime,sessionModelLabel,locales/en,locales/zh-CN}.ts`. Rewrite `router.tsx:340`.
- **Each sub-slice green:** `bun typecheck` + `bun run test`.

**Slice 3: `cli/` + `hub/` consumer collapse (sub-decompose into 3a, 3b)**

- 3a: **`cli/`** — Rewrite `runner/run.ts` (lines 235, 349, 894-895, 903), `runner/buildCliArgs.test.ts`, `modules/common/{slashCommands,skills,rpcTypes,permission/BasePermissionHandler}.ts` + tests, `api/types.ts` (drop CodexCollaborationMode), `utils/attachmentFormatter.ts`, `parsers/specialCommands.ts`, `commands/runner.ts`. DELETE `ui/ink/CodexDisplay.tsx`. Verify `agent/serverUtils/*` + `api/apiSession.ts`.
- 3b: **`hub/`** — Rewrite `sync/syncEngine.ts` (lines 366, 391-394, 402-403, 518-520), `sync/rpcGateway.ts:125`, `sync/sessionModel.test.ts`, `sync/todos.ts` (extractTodosFromClaudeOutput rename or delete), `web/routes/sessions.ts` (4 defaults + endpoint cleanup), `web/routes/sessions.test.ts`, `web/routes/permissions.ts:59`, `web/routes/machines.ts:9` + test, `web/routes/cli.test.ts`. Verify `notifications/sessionInfo.ts` (no changes needed — uses `isKnownFlavor` already).

**Slice 4: ripgrep guard collapse + final verification**

- Remove all `# === Phase-5 territory` whitelist entries from `scripts/check-no-cut-agents.sh`.
- Add the `AGENT_MESSAGE_PAYLOAD_TYPE` post-filter exception (or line-anchored equivalent per D-85).
- Add the Phase-5 identifier sweep (`isCodexFamilyFlavor`, `(CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES`, etc.).
- Add the `flavor === '...'` (non-cursor) sweep.
- Add capability-lookup focused unit test (verify cursor slot values + unknown-fallback + isKnownFlavor narrow) — D-87.
- Final `bun typecheck` + `bun run test` + guard green.

### Sequence summary

```
Slice 1  (shared add)
Slice 2a (web ToolCard)
Slice 2b (web NewSession/AssistantChat/SessionList)
Slice 2c (web chat/lib/hooks/api)
Slice 3a (cli)
Slice 3b (hub)
Slice 1b (shared delete — closes the door)
Slice 4  (guard + final verification)
```

This is **8 atomic commits**, not 4. Each is green on `bun typecheck` + `bun run test`. Slices 2a/2b/2c are interchangeable but should land before 1b. PLAN may decide to merge sub-slices if churn is small enough — recommendation: keep 2a/2b/2c separate because ToolCard alone is ≥30 file deletions, NewSession family is ≥10 file deletions, chat/lib/hooks/api is ≥20 file rewrites.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.16 (per-workspace) |
| Config | `cli/vitest.config.ts`, `hub/vitest.config.ts`, `web/vitest.config.ts` (existing) |
| Quick run | `bun run test` (root chain) |
| Full suite | `bun run typecheck && bun run test` |
| Guard | `bash scripts/check-no-cut-agents.sh` (modified for Phase 5) |

### Phase Requirements → Test Map

| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| CUT-05 / SC#1 | `AgentFlavor` literal `'cursor'`; ripgrep zero outside whitelist | unit + guard | `bun typecheck && bash scripts/check-no-cut-agents.sh` | ✅ guard exists, needs Phase-5 update |
| REFA-01 / SC#2 | `cursor` capability set non-empty, slots populated | unit (rewritten `flavors.test.ts`) | `cd shared && bun run test flavors.test.ts` | ✅ exists; rewrite per D-87 |
| REFA-01 / SC#3 | Zero hardcoded `flavor ===` or capability gates | guard | `bash scripts/check-no-cut-agents.sh` | ✅ extend per §"Ripgrep guard additions" |
| REFA-01 / SC#4 | Capability lookup focused unit test | unit | `cd shared && bun run test flavors.test.ts` | rewrite per D-87 |
| All slices | Each slice green on typecheck + test | smoke | `bun typecheck && bun run test` | ✅ existing |

### Capability-lookup focused unit test (mandatory per SC#4 + D-87)

Test cases to cover in rewritten `shared/src/flavors.test.ts`:

1. `getCapabilities('cursor')` returns object with all 7 slots populated.
2. `getCapabilities('cursor').permissionModes` deep-equals `['default','plan','ask','yolo']`.
3. `getCapabilities('cursor').supportsModelChange === false`.
4. `getCapabilities('cursor').supportsEffort === false`.
5. `getCapabilities('cursor').contextBudgetTokens === null`.
6. `getCapabilities('cursor').userSlashCommandsDir === null` (or function returning null).
7. `getCapabilities('cursor').projectSlashCommandsDir === null`.
8. `getCapabilities('cursor').permissionToneCopy === 'cursor'`.
9. `getCapabilities('unknown') === null`.
10. `getCapabilities(null) === null` and `getCapabilities(undefined) === null`.
11. `getCapability('cursor', 'permissionModes')` returns the array (single-key lookup).
12. `getCapability('unknown', 'permissionModes') === null`.
13. `getFlavorLabel('cursor') === 'Cursor'`.
14. `getFlavorLabel('claude') === 'Unknown'` (per D-83 fallback for historical strings).
15. `getFlavorLabel(null) === 'Unknown'`.
16. `isKnownFlavor('cursor') === true` (type guard narrow — TS-level only).
17. `isKnownFlavor('claude') === false`.
18. `isKnownFlavor(null) === false` / `isKnownFlavor(undefined) === false`.
19. `hasCapability('cursor', 'model-change') === false` (Cursor v1).
20. `hasCapability('cursor', 'effort') === false`.
21. `hasCapability(null, anything) === false`.
22. `supportsModelChange('cursor') === false`; `supportsModelChange(null) === false`.
23. `supportsEffort('cursor') === false`.

**Cross-flavor matrix tests:** EXPLICITLY EXCLUDED per D-87 (REFT-01 / Phase 11 owns).

### Sampling Rate
- **Per task commit (within a slice):** `cd <workspace> && bun typecheck && bun run test`
- **Per slice (8 commits):** root `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh`
- **Phase gate:** all 8 slices green + guard passes with whitelist collapsed
- **Build:** `bun run build:single-exe` SKIPPED for Phase 5 per D-88 (Phase 12 owns).

### Wave 0 Gaps
- [ ] None — capability lookup test FILE exists (`shared/src/flavors.test.ts`); test rewrite is part of Slice 1.
- [ ] Guard script `scripts/check-no-cut-agents.sh` exists; Phase-5-specific edits land in Slice 4.

## Security Domain

This phase is **deletion + narrowing + capability table fill** with no new external surfaces. ASVS:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a |
| V3 Session Management | no (no session-token changes) | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | Zod schemas in `shared/src/{schemas,resume}.ts` — narrow `AgentFlavorSchema` enum; verify ingest of historical rows (covered §"Wire-layer narrow safety") |
| V6 Cryptography | no | n/a |
| V7 Errors | no (no new error paths beyond `'Unknown'` fallback) | n/a |

**Known threat patterns for this stack:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale wire payload with non-cursor flavor | Tampering / I (input handling) | `MetadataSchema.flavor` stays `z.string().nullish()` — type narrow is type-only, runtime accepts any string; consumers compare via `=== 'cursor'` and treat non-match as unknown (D-76) |
| Old resume payload with deleted enum value | Tampering | Acceptable per AGENTS.md "no backward compatibility"; user starts a new session |

**No new threats introduced. No mitigations need adding.**

## Code Examples

### Capability lookup at call site (web/src/chat/modelConfig.ts target)

```typescript
// Source: 05-RESEARCH.md §"Pattern: Capability lookup at call site"
import { getCapability } from '@hapi/protocol'

const CONTEXT_HEADROOM_TOKENS = 10_000

export function getContextBudgetTokens(_model: string | null | undefined, flavor?: string | null): number | null {
    const windowTokens = getCapability(flavor, 'contextBudgetTokens')
    if (windowTokens === null) return null
    return Math.max(1, windowTokens - CONTEXT_HEADROOM_TOKENS)
}
```

### PermissionFooter capability lookup (target)

```typescript
// Source: 05-RESEARCH.md §"Surprises" #9, §"Slot validation" permissionToneCopy
import { getCapability } from '@hapi/protocol'

// Replace isCodexSession entirely. Always 'cursor' tone for the only known flavor.
const tone = getCapability(props.metadata?.flavor, 'permissionToneCopy') ?? 'cursor'
// Branches on `tone === 'codex'` dead-eliminate; planner deletes the JSX subtree.
```

### Slash-commands directory resolution (cli/src/modules/common/slashCommands.ts target)

```typescript
// Source: 05-RESEARCH.md §"D. cli/" slashCommands rows
import { getCapability } from '@hapi/protocol'

function getUserCommandsDir(agent: string): string | null {
    const resolver = getCapability(agent, 'userSlashCommandsDir')
    return resolver ? resolver(homedir()) : null
}

function getProjectCommandsDir(agent: string, projectDir: string): string | null {
    const resolver = getCapability(agent, 'projectSlashCommandsDir')
    return resolver ? resolver(projectDir) : null
}
```

## State of the Art

This is internal refactor — no external library churn. Not applicable.

## Runtime State Inventory

Phase 5 is a type narrow + call-site collapse — it edits source code and tests, not runtime state. However, the following live-data implications must be flagged:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | SQLite `metadata.flavor` column carries historical values `'claude'`, `'codex'`, `'gemini'`, `'opencode'` from pre-Phase-1 sessions. After narrow, `MetadataSchema.flavor: z.string().nullish()` still accepts them (Zod string is wider than TS narrow). Consumers compare `=== 'cursor'` and treat other strings as unknown (D-76 graceful degrade). | None — silent acceptance (matches Phase 1 protocol). |
| Stored data | SQLite `metadata.collaborationMode` may carry `'plan'` for old Codex sessions. Field is being DELETED from schema (Summary #4). | None — Zod tolerates extra keys; field is read by zero remaining consumers post-cut. |
| Live service config | n/a (no external services configured by flavor name). | None. |
| OS-registered state | n/a (no systemd / launchd / Task Scheduler entries reference flavor). | None. |
| Secrets / env vars | `CLAUDE_CONFIG_DIR` / `CODEX_HOME` env vars are read only by `slashCommands.ts:103,107` — the very lines being deleted. After Slice 3a, these env vars become inert (no consumer). | None. |
| Build artifacts | n/a (no per-flavor compiled artifact). `bun.lock` does not change. | None. |

## Risk Register (top 5 landmines)

### Risk 1 — Scope balloon: ripgrep whitelist is much larger than CONTEXT.md implies (HIGH)

**What goes wrong:** CONTEXT.md slices 2-3 list ~6 explicit files. Actual Phase-5-territory whitelist in `scripts/check-no-cut-agents.sh` is ~80 files. Planner sizes the phase at 4 slices and underestimates effort by 5×.
**Prevention:** PLAN must use the call-site inventory in §"Call-site inventory" above as the authoritative file count. Slice into 8 commits per §"Recommended slice ordering refinement". Reserve a "compile error inventory" intermediate artifact after Slice 1 to drive Slices 2a/2b/2c/3a/3b sizing.
**Warning signs:** `bun typecheck` errors after Slice 1 exceed planner's mental model by >2×. Reading file list in §B/C/D of inventory and feeling the urge to "just whitelist" any file.

### Risk 2 — Dead-code cleanup scope ambiguity: Codex* tool views (HIGH)

**What goes wrong:** Codex tool-name renderers (`CodexAgentView`, `CodexBashResultView`, `CodexPatchResultView`, `CodexDiffCompactView`, etc., spanning ~10 files and ~1000 lines) are dead code post-Phase-1 but match the ripgrep guard's `\bcodex\b -i` pattern. CONTEXT.md doesn't explicitly address them. Planner either deletes them (best — net negative LoC) or whitelists them (drift from D-85 single-line discipline).
**Prevention:** PLAN explicitly decides — recommended **delete** as part of Slice 2a. Document each file's deletion in PLAN with "verified unreachable: Cursor emits no `Codex*` tool names" rationale. Cross-check by `rg 'CodexAgent|CodexBash|CodexPatch|CodexDiff'` in `cli/src/cursor/` (expected: zero hits).
**Warning signs:** Slice 2 grows beyond a single PR; whitelist additions for `ToolCard/**` reappear.

### Risk 3 — Wire-schema delete of `collaborationMode` cascades unexpectedly (MEDIUM)

**What goes wrong:** Deleting `SessionSchema.collaborationMode` + `LocalResumeTargetSchema.collaborationMode` breaks four web components + cli/api types + hub-side store columns (if any) that the call-site inventory may have missed.
**Prevention:** Slice ordering puts wire-schema deletion in Slice 1b — AFTER web consumers (Slice 2c) are rewritten to no longer reference the field. SQLite store reads the field as part of the `metadata` JSON blob (verified: `SessionSchema.collaborationMode` is on `SessionSchema`, not `MetadataSchema` — so the field lives on the session row's top-level shape). Verify in PLAN that hub store reads/writes don't extract `collaborationMode` as a separate column.
**Warning signs:** `bun typecheck` after Slice 1b fails in `hub/src/store/` or `hub/src/sync/sessionCache.ts`.

### Risk 4 — `acceptEdits` / `bypassPermissions` UI removal breaks existing tests (MEDIUM)

**What goes wrong:** `hub/src/web/routes/sessions.test.ts` and `cli/src/runner/buildCliArgs.test.ts` still pass `'bypassPermissions'` / `'acceptEdits'` as mode strings. After narrowing `PermissionMode` to Cursor's 4 modes, these tests fail with "argument of type ... not assignable to PermissionMode".
**Prevention:** Test rewrites are part of Slices 2c (web) + 3a (cli) + 3b (hub). Rewrite to `'yolo'` (the Cursor equivalent of bypass) and `'default'` (closest to acceptEdits semantically — or DELETE the test cases as covered by D-06 cross-flavor cleanup precedent).
**Warning signs:** Hub or CLI tests fail after Slice 1b lands; ripgrep finds residual `'bypassPermissions'` literals.

### Risk 5 — Mid-slice typecheck failure due to wire-schema cut ordering (MEDIUM)

**What goes wrong:** Slice 1b deletes `CodexCollaborationModeSchema` before web consumers (Slice 2c) are rewritten — entire repo fails typecheck.
**Prevention:** Ordering enforced: Slices 2a + 2b + 2c (web consumers) land BEFORE Slice 1b. Each web slice writes new code that doesn't import from the soon-to-be-deleted shared symbols, while leaving existing imports temporarily; Slice 1b removes the now-unused symbols. Alternative: do Slice 1b ATOMICALLY with all slice-2 web rewrites in a single commit (heavier per-commit churn but identical pre/post net change).
**Warning signs:** Slice numbering in PLAN puts 1b before 2; reviewer comments "this commit broke typecheck for web/" between any two adjacent commits.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | All slices (typecheck + test) | ✓ | 1.3.14 (root packageManager) | none — hard requirement |
| ripgrep | Slice 4 guard script | ✓ (script has vscode fallback path) | system | already wired |
| TypeScript | Bun-bundled | ✓ | ^5 | n/a |
| Vitest | per-workspace | ✓ | ^4.0.16 | n/a |
| Node 18+ | Bun internal | ✓ | n/a | n/a |

**No missing dependencies.** Phase 5 is fully self-contained.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cursor IDE supports user-level commands at `~/.cursor/commands/*.md` `[CITED: cursor.com/docs/agent/chat/commands]` but HAPI's CLI does NOT currently wire this | §"Slot validation" userSlashCommandsDir | If a Cursor caller exists (e.g., upstream CursorDisplay UI), `null` capability is wrong — verify by `rg 'cursor.*commands' cli/src/cursor/` in PLAN |
| A2 | No `Codex*` tool name (`CodexBash`, `CodexAgent`, etc.) is emitted by the Cursor CLI runtime post-Phase-1 | Risk 2, §"Surprises" #3 | If verified wrong, the ToolCard codex views are NOT dead and must be retained/renamed. Verification command: `rg "CodexBash|CodexAgent|CodexPatch|CodexDiff|CodexReasoning" cli/src/cursor/ shared/src/` (expected: zero hits in cursor runtime) |
| A3 | `SessionSchema.collaborationMode` is not stored as its own SQLite column (only inside the `metadata` JSON blob via `Session` shape) | Risk 3 | If wrong, hub store has a `collaboration_mode` column that becomes orphan data after field delete. Verification: `rg "collaborationMode\|collaboration_mode" hub/src/store/` |
| A4 | Old SQLite `metadata.flavor: 'claude' \| 'codex' \| ...` rows ingest cleanly because `MetadataSchema.flavor: z.string().nullish()` is wider than the TS narrow | §"Wire-layer narrow safety" | If `MetadataSchema` were tightened in a future commit, ingest breaks — Phase 5 should NOT narrow this Zod field to `z.literal('cursor')` |
| A5 | `web/src/components/NewSession/{Opencode,Claude,Gemini}` selector files have no Cursor consumer | §"D. web/" rows | If a Cursor variant exists, deletion drops UI affordance. Verification: `rg 'OpencodeModelSelector\|ClaudeEffortSelector\|ReasoningEffortSelector' web/src/ | rg -v test` |
| A6 | `shared/src/models.ts` `ClaudeModelPreset` exports have no Cursor consumer post-Phase-1 | §"shared/" types.ts row + Phase-1 known stubs | If `web/src/lib/sessionModelLabel.ts` (or others) still imports it, deletion breaks. Phase 1 SUMMARY 01-04 notes models.ts cleanup deferred to "01-05-cleanup" with cursor-only carve-out — verify state at PLAN time |
| A7 | `cli/src/modules/common/slashCommands.ts::scanPluginCommands` (line 263) is Claude-plugin-specific and has no Cursor analog | §"C. cli/" slashCommands rows | If a Cursor plugin format exists or is planned, deletion is premature. CURS-02 (skills) is the closest analog but is Milestone 2 — safe to delete now |
| A8 | Hub-side `SessionCache` / `syncEngine` JSON serialization of historical session rows containing `collaborationMode` will not throw after field delete (Zod 4 tolerates unknown keys by default) | §"Wire-layer narrow safety" #5 | If `SessionSchema` is constructed with `.strict()` anywhere, ingest of old rows breaks. Verification: `rg '\.strict\(\)' shared/src/` |
| A9 | `web/src/lib/agentSlashCommands.ts` is the file Phase-1 renamed from `codexSlashCommands.ts`; its comment line 4 about "Phase 5 will narrow" is the only `claude/codex/gemini/opencode` hit in the file | §"D. web/" agentSlashCommands row | Verified by Phase-1 SUMMARY — comment edit only |

**If this table is empty:** N/A — 9 assumptions flagged; PLAN's Wave-0 step should verify A2, A3, A6, A8 in particular before locking the cut list.

## Open Questions

1. **Does Cursor IDE's `~/.cursor/commands/` directory need to be wired into `listSlashCommands` now or wait for Milestone 2 (CURS-02)?**
   - What we know: Cursor IDE supports it `[CITED: cursor.com/docs/agent/chat/commands]`.
   - What's unclear: Whether HAPI's CLI agent should mirror that. Phase 5 leaves `userSlashCommandsDir` capability as `null` (matches today's behaviour).
   - Recommendation: Defer — set capability to `null` for Cursor v1; revisit in CURS-02. Document as a known TODO.

2. **Whitelist mechanism for `AGENT_MESSAGE_PAYLOAD_TYPE` — line-anchored via post-filter or single-file glob with secondary CI check?**
   - What we know: D-85 says "named line + JSDoc anchor". Implementation has two reasonable forms.
   - What's unclear: Which is easier to maintain. Both work.
   - Recommendation: Post-filter (`rg ... | grep -v 'AGENT_MESSAGE_PAYLOAD_TYPE.*as const'`) is more transparent and survives line-number drift better than a hardcoded `--glob '!shared/src/modes.ts'` + content assertion.

3. **`hub/src/sync/todos.ts::extractTodosFromClaudeOutput` — keep (rename) or delete?**
   - What we know: Function name has `Claude` in it; the function logic may be Claude-output-format-specific.
   - What's unclear: Whether Cursor produces todos in a compatible format that this helper still parses, or if the helper is unreachable.
   - Recommendation: PLAN inspects callers via `rg 'extractTodosFromClaudeOutput' hub/src/`; if unreachable, delete; if reachable from Cursor path, rename to `extractTodosFromAgentOutput`.

4. **`cli/src/agent/serverUtils/{buildHapiMcpBridge,startHookServer,startHappyServer}.ts` — flavor references whitelisted by Phase 1; are they real Cursor consumers or dead code?**
   - What we know: They're in the Phase-1 guard whitelist; they presumably power Cursor's MCP / hook server.
   - What's unclear: Whether the flavor references are decorative (log scope tags) or branch on actual flavor logic.
   - Recommendation: PLAN inspects each file; expects 1-3 line edits.

## Sources

### Primary (HIGH confidence)
- Repo grep + file reads (2026-05-22): all 80+ files enumerated in §"Call-site inventory".
- `.planning/phases/05-flavor-consolidation-capability-abstraction/05-CONTEXT.md` (D-69..D-88).
- `.planning/phases/01-cut-non-cursor-agents/01-RESEARCH.md` (Phase-5-owned whitelist origin + cross-CUT PermissionFooter note).
- `.planning/phases/01-cut-non-cursor-agents/01-04-SUMMARY.md` (state of cleanup carry-overs to Phase 5).
- `.planning/phases/04-cut-deployment-infrastructure/04-CONTEXT.md` (D-65/D-66/D-67 whitelist + zero-tolerance guard precedent).
- `.planning/REQUIREMENTS.md` (CUT-05, REFA-01 wording).
- `.planning/ROADMAP.md` (Phase 5 SC#1..#4).
- `scripts/check-no-cut-agents.sh` (current whitelist surface — the truest map of Phase-5 work).
- `AGENTS.md` (No backward compatibility, Bun, TS strict, 4-space).
- `CLAUDE.md` (gitnexus impact rules — applied to type narrows below).

### Secondary (MEDIUM confidence)
- `[CITED: cursor.com/docs/agent/chat/commands]` — Cursor IDE user-commands directory location (`~/.cursor/commands/`) for slot decision A1.

### Tertiary (LOW confidence)
- None — every Phase-5-internal claim above is verified against the live tree.

## Metadata

**Confidence breakdown:**
- Call-site inventory (every file:line): **HIGH** — direct ripgrep + line-number verification 2026-05-22.
- Capability slot coverage: **HIGH** — every D-73 slot mapped to ≥1 real consumer (or flagged as forward-looking).
- Compile-blast-radius preview: **HIGH** — derived from import-graph grep, not heuristic.
- Wire-layer narrow safety: **HIGH** — Zod schema shape verified (`MetadataSchema.flavor: z.string().nullish()`).
- Slice refinement (8 commits): **MEDIUM** — depends on planner's tolerance for finer-grained commits. CONTEXT.md D-86 said 4; recommendation is 8 for sustainability. Either works.
- Dead-code recommendations (ToolCard codex views, `useCodexModels`, etc.): **HIGH for unreachability claim**; **MEDIUM for "delete vs. whitelist" call** (assumption A2 needs Wave-0 verification).
- Risk register: **HIGH** — each risk grounded in a specific surfaced finding.

**Research date:** 2026-05-22
**Valid until:** 14 days (active codebase; Phase 5 should land within this window before the file-list drifts).

## RESEARCH COMPLETE

**Phase:** 5 — Flavor consolidation + capability abstraction
**Confidence:** HIGH

### Key Findings
- The Phase-1 ripgrep guard's "Phase-5 territory" whitelist is ~80 files — much larger than CONTEXT.md's slice headlines (≈6 files). Real work is at the scale CONTEXT.md plus the guard whitelist combined imply.
- 4 slices (D-86) under-decompose the work; **recommended 8 atomic commits** (Slice 1, 1b, 2a/b/c, 3a/b, 4) for sustainable green-per-commit cadence.
- Wire schema narrow is safe: `MetadataSchema.flavor: z.string().nullish()` already accommodates historical non-cursor flavors; only `AgentFlavorSchema` (resume.ts) needs the enum narrow and resume payloads don't persist across sessions.
- Capability table D-73 covers all current real consumers — no new slots required for Phase 5. Cursor v1 leaves `supportsModelChange`, `supportsEffort`, `contextBudgetTokens`, slash-command resolvers all at `null`/`false`.
- `acceptEdits` / `bypassPermissions` UI affordances in `PermissionFooter` are unreachable for Cursor; `PermissionMode` can collapse to `CursorPermissionMode` (D-78 condition met).
- `SessionSchema.collaborationMode` can be deleted on the same pass — it's Codex-only and has no Cursor consumer. Cuts cascade to 4 web components + cli/api/types.
- `CodexAgent` / `CodexBash` / `CodexPatch` / `CodexDiff` ToolCard renderers are dead post-Phase-1; recommended **delete entire files** (≈10 files, ≈1000 LoC net negative) rather than whitelist them.

### File Created
`.planning/phases/05-flavor-consolidation-capability-abstraction/05-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Call-site inventory | HIGH | Direct ripgrep verification of file:line for every claim |
| Capability slot validation | HIGH | Every D-73 slot mapped to real consumer or flagged forward-looking |
| Compile-blast radius | HIGH | Derived from import-graph grep |
| Wire-layer safety | HIGH | Zod shape verified — `z.string().nullish()` accommodates historical rows |
| Slice ordering (8 commits) | MEDIUM | Planner judgement: 4 commits per D-86 also viable if each holds bigger churn |
| Risk register | HIGH | Each risk grounded in specific surfaced finding |
| Dead-code cleanup recommendations | HIGH (unreachable claim) / MEDIUM (delete vs. whitelist) | A2 needs Wave-0 verification |

### Open Questions
- A1 / Open #1: wire Cursor `~/.cursor/commands/` now or wait for CURS-02
- A3 / Risk 3: confirm `collaborationMode` not a standalone SQLite column
- A6: confirm `ClaudeModelPreset` has no remaining Cursor consumer

### Ready for Planning
Research complete. Planner has: full call-site inventory (every file:line), capability slot validation per D-73, compile-blast radius preview, slice ordering refinement (4 → 8 commits with green-per-commit rationale), wire-layer narrow safety analysis, ripgrep guard collapse plan with line-anchored exception mechanism, validation architecture with 23 capability-lookup unit test cases per D-87, and a 5-item risk register grounded in surfaced findings.
