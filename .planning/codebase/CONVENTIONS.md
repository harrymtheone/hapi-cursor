# Coding Conventions

**Analysis Date:** 2026-05-20

## Language & Strictness

- **TypeScript only.** No untyped JavaScript in any package (`cli/`, `hub/`, `web/`, `shared/`).
- `tsconfig.base.json` enables `strict`, `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`, `target: ESNext`, `module: ESNext`, `moduleResolution: bundler`.
- Each workspace package extends `../tsconfig.base.json` and adds `paths: { "@/*": ["./src/*"] }` plus `noEmit: true` (Bun runs `.ts` directly; web is bundled by Vite).
- `bun-types` + `@types/node` provided as devDependencies in `cli/` and `hub/`.

## Indentation & Formatting

- **4-space indentation everywhere** (declared in `AGENTS.md`, seen consistently in `hub/src/sync/sessionCache.ts`, `cli/src/utils/errorUtils.ts`, `web/src/components/SessionList.tsx`).
- **Single quotes** for string literals (`'vitest'`, `'@/lib/utils'`).
- **Semicolons:** inconsistent across the repo. Newer code in `hub/` and most of `web/`/`shared/` omits trailing semicolons; older `cli/src/utils/*` files keep them (`MessageQueue2.ts`). When editing a file, match the file's existing style; do not mass-change semicolon style.
- No project-wide Prettier or ESLint config. Only `website/.prettierrc` exists and applies to the marketing site, not to `cli`/`hub`/`web`/`shared`.
- No Biome config. Style is enforced by review + existing-file convention only.
- Trailing commas: present in multi-line object/array literals and function signatures (see `tsconfig.base.json`, `web/src/components/SessionList.tsx`).

## Naming Patterns

**Files:**
- TypeScript modules: `camelCase.ts` — `sessionCache.ts`, `errorUtils.ts`, `messageService.ts`, `cliApiToken.ts`.
- React components & TSX containers: `PascalCase.tsx` — `SessionList.tsx`, `CodeBlock.tsx`, `HappyThread.tsx`.
- shadcn/Radix-style primitives under `web/src/components/ui/`: lowercase — `button.tsx`, `card.tsx`, `dialog.tsx`, `badge.tsx`.
- Tests: co-located with `.test.ts` or `.test.tsx` suffix matching the file under test.
- Integration tests: `.integration.test.ts` suffix (e.g., `cli/src/runner/runner.integration.test.ts`).
- Seam-style isolation tests: `.seam.test.ts` suffix (e.g., `cli/src/claude/claudeRemote.seam.test.ts`).

**Identifiers:**
- Functions, methods, variables: `camelCase` (`extractErrorInfo`, `getOrCreateSession`, `redundantGoalStatusContent`).
- Classes & React components: `PascalCase` (`MessageService`, `SessionCache`, `MessageQueue2`, `HappyBot`).
- Types & interfaces: `PascalCase` (`ErrorInfo`, `SessionSummary`, `SyncEngine`). Prefer `type` aliases over `interface` for object shapes that won't be extended (`type ErrorInfo = { ... }`). Use `interface` only when augmenting or extending (e.g., `QueueItem<T>` in `MessageQueue2.ts`).
- Constants: `UPPER_SNAKE_CASE` for module-level numeric/string constants (`QUEUED_MESSAGE_THINKING_GRACE_MS`, `DEFAULT_SESSION_PREVIEW_LIMIT`).
- Boolean-bearing flags: `isXxx` / `hasXxx` (`isClosed`, `hasMore`, `hasActiveSession`).
- React hooks: `useXxx` (`useLongPress`, `usePlatform`, `useSessionPreviewLimit`).

## Import Organization

Observed order (top-to-bottom in a file):

1. Node built-ins via `node:` prefix — `import { resolve } from 'node:path'`, `import { mkdtempSync } from 'node:fs'`.
2. External npm packages — `vitest`, `bun:test`, `hono`, `socket.io`, `react`, `axios`.
3. Workspace packages — `@hapi/protocol/types`, `@hapi/protocol/schemas`, `@hapi/protocol/messages`.
4. Internal path-aliased imports — `@/api/client`, `@/lib/utils`, `@/components/...`.
5. Relative imports (siblings/parents) — `./errorUtils`, `../store`, `./sessionCache`.

Type-only imports use `import type { ... }` (see `cli/src/agent/permissionAdapter.test.ts`, `hub/src/sync/messageService.test.ts`).

**Path aliases:**
- `@/*` → `./src/*` in every package's `tsconfig.json` and Vitest/Vite config. Use `@/...` for any intra-package import deeper than the current directory.
- `@hapi/protocol/*` → workspace package `shared/` via package `exports` (`./messages`, `./modes`, `./schemas`, `./types`, `./voice`).

## Runtime Validation

- **Zod (v4)** is the runtime validation library across all packages. Schemas live in `shared/src/schemas.ts` and are imported via `@hapi/protocol/schemas`.
- Parse external/IPC payloads with `*.parse(...)` or `*.safeParse(...)` before trusting them. See `hub/src/sync/sessionCache.ts` import of `AgentStateSchema`, `MetadataSchema`, `TeamStateSchema`.
- Hono routes use `fastify-type-provider-zod` / Hono Zod adapter for request validation; Zod issues are surfaced to clients in the response body (see `hub/src/web/routes/messages.ts`).

## Error Handling

- Throw native `Error` with a descriptive message; attach extra fields via `Object.assign(new Error(msg), { extra: value })` or cast through `unknown` to add a property (see `apiValidationError` in `cli/src/utils/errorUtils.ts`).
- Centralized error introspection helpers live in `cli/src/utils/errorUtils.ts`:
  - `extractErrorInfo(error: unknown): ErrorInfo` — narrows `unknown` and surfaces `httpStatus`, `axiosCode`, `responseErrorText`, `serverProtocolVersion`.
  - `isRetryableConnectionError(error: unknown): boolean` — single source of truth for retry policy (ECONNREFUSED / ETIMEDOUT / ENOTFOUND / ENETUNREACH / ECONNRESET / 5xx).
- Always narrow `unknown` before access: `error instanceof Error ? error.message : 'Unknown error'`. Do not `catch (e: any)`; let `catch` infer `unknown`.
- Return-shape result tagging is used for control-flow errors instead of throwing (see `resolveSessionAccess` in `hub/src/sync/sessionCache.ts`):

```typescript
type Result =
    | { ok: true; sessionId: string; session: Session }
    | { ok: false; reason: 'not-found' | 'access-denied' }
```

Prefer discriminated-union results for any operation whose "failure" is expected/recoverable (auth, lookup, validation).

## Logging

- CLI uses a project logger: `import { logger } from '@/ui/logger'`. Levels seen: `logger.debug(...)`, `logger.error(...)`. Tag log messages with a bracketed module prefix (`[MessageQueue2]`, `[HAPIBot]`) so terminal output stays greppable.
- Hub side mostly uses `console.error`/`console.log` directly. When testing log output, spy on `console.error` rather than the logger module.
- Never log secrets, tokens, or full message bodies; logs are tailed to `~/.hapi*` directories and can be uploaded with `doctor`.

## Function & Module Design

- **Small, single-responsibility functions.** `cli/src/utils/errorUtils.ts` keeps each concern (validation-error factory, info extractor, retry classifier) in its own exported function.
- **Class for stateful services.** Long-lived components are classes with `private readonly` dependencies injected via the constructor (`SessionCache`, `MessageService`, `MessageQueue2`, `PermissionAdapter`). Avoid module-level mutable singletons; pass dependencies in.
- **Exports:** named exports only. No `export default` for app modules. (Vitest config files do `export default defineConfig(...)` — that is the only acceptable default-export pattern.)
- **Barrel files:** `shared/src/index.ts` is the only intentional barrel; do not add `index.ts` re-export files inside `cli/`, `hub/`, `web/` packages — import the leaf module directly.
- **Async APIs:** prefer `async`/`await` over raw `.then()`. Functions that may not resolve (e.g., long polling loops) return `Promise<never>`-shaped values explicitly or never resolve.

## React-Specific Conventions (web/)

- React 19 + TanStack Router + TanStack Query + assistant-ui.
- Components are typed function components, props declared inline or as a named `type FooProps = { ... }` just above the component.
- Hooks live in `web/src/hooks/` (`queries/`, `mutations/`, plus standalone hooks). One hook per file, file name matches the hook name.
- Styling uses Tailwind v4 utility classes plus CSS variables `var(--app-bg)`, `var(--app-fg)`, `var(--app-button)` for theming. Use the `cn(...)` helper from `@/lib/utils` to merge class names.
- i18n: never hardcode user-facing strings. Use `useTranslation()` from `@/lib/use-translation` and route through `I18nProvider`.

## Comments & JSDoc

- Use JSDoc-style block comments above exported functions/classes to describe purpose, parameters, and return shape — required when the call is non-obvious (see `apiValidationError`, `extractErrorInfo`, `isRetryableConnectionError`).
- Inline `//` comments only for non-obvious intent, invariants, or trade-offs. Do not narrate the code (`// increment i`).
- Test files often start with a top-of-file block comment summarizing the race/scenario matrix being covered (see `hub/src/sync/messageService.test.ts`, `hub/src/web/routes/messages.test.ts`). Keep these in sync with the cases below.

## Code Style Summary

| Concern | Convention |
|---------|------------|
| Indentation | 4 spaces |
| Quotes | Single `'` |
| Semicolons | Match existing file; lean off in new `hub/`/`web/`, on in older `cli/` |
| Trailing commas | Yes, on multi-line literals |
| Exports | Named only (default reserved for config files) |
| Path alias | `@/*` for intra-package, `@hapi/protocol/*` for shared |
| Types | `type` for shapes, `interface` for extension |
| Validation | Zod (v4) at every external boundary |
| Errors | Narrow `unknown`, prefer discriminated-union results |
| Logging | `logger` in cli; `console` in hub; bracketed tag prefix |

---

*Convention analysis: 2026-05-20*
