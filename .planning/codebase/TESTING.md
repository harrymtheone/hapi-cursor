# Testing Patterns

**Analysis Date:** 2026-05-20

## Test Frameworks

The monorepo uses **two different runners**, split by package. This is intentional — pick the right one when adding tests.

| Package | Runner | Import | Why |
|---------|--------|--------|-----|
| `cli/` | Vitest 4 | `from 'vitest'` | Needs `vi.mock` hoisting + module mocking for axios/socket.io |
| `web/` | Vitest 4 (jsdom) | `from 'vitest'` | Needs DOM + `@testing-library/react` + jsdom |
| `hub/` | Bun test | `from 'bun:test'` | Runs natively under Bun runtime (`bun test`), zero-config |
| `shared/` | Bun test | `from 'bun:test'` | Pure TS utilities, fastest under Bun |

- **Vitest version:** `^4.0.16` (dev dep in `cli/` and `web/`).
- **Bun version:** `bun@1.3.14` (declared `packageManager` in `cli/package.json`).
- **Assertion API:** `expect(...).toBe / toEqual / toHaveLength / toBeUndefined / toBeInTheDocument` — Vitest and `bun:test` share this surface, so most tests are visually identical.

## Run Commands

```bash
# Repo root — runs all three suites sequentially
bun run test                # cli + hub + web

# Per package
bun run test:cli            # cd cli && vitest run (after `tools:unpack`)
bun run test:hub            # cd hub && bun test
bun run test:web            # cd web && vitest run

# Watch mode (per package, not wired into root scripts)
cd cli && bun run vitest    # vitest watch
cd web && bun run vitest    # vitest watch
cd hub && bun test --watch  # bun watch
```

`cli` test command is `bun run tools:unpack && vitest run` — embedded binaries (`ripgrep`, `difftastic`, `tunwg`) must be unpacked before tests run. Windows variant: `test:win` skips the unpack step.

## Test File Organization

**Location:** Tests are **co-located** next to the source file under test. There is no separate `tests/` or `__tests__/` directory convention (one exception: `cli/src/codex/__tests__/emitReadyIfIdle.test.ts`).

**Naming:**
- Unit: `<sourceFile>.test.ts` or `<sourceFile>.test.tsx` (when JSX is rendered).
- Integration: `<sourceFile>.integration.test.ts` — e.g., `cli/src/runner/runner.integration.test.ts`. Requires `.env.integration-test`.
- Seam tests (boundary-isolated): `<sourceFile>.seam.test.ts` — e.g., `cli/src/claude/claudeRemote.seam.test.ts`.
- Scenario-specific suffixes are allowed: `SessionList.directory-action.test.tsx`, `api.extraHeaders.test.ts`.

**Glob includes (from vitest configs):**
- `cli/vitest.config.ts`: `include: ['src/**/*.test.ts']`
- `web/vitest.config.ts`: `include: ['src/**/*.test.{ts,tsx}']`
- `hub`: `bun test` auto-discovers `**/*.test.ts` under the package.

## Vitest Configuration

### CLI (`cli/vitest.config.ts`)

- `globals: false` — must import `describe`/`it`/`expect` from `'vitest'`.
- `environment: 'node'`.
- Loads `.env.integration-test` via `dotenv` and merges into `process.env` for test runs.
- Coverage: provider `v8`, reporters `text`/`json`/`html`, excludes `node_modules/**`, `dist/**`, `**/*.d.ts`, `**/*.config.*`, `**/mockData/**`.
- `resolve.alias['@'] = './src'` — mirror of tsconfig path alias.

### Web (`web/vitest.config.ts`)

- Merges with `vite.config.ts` (Vite + React plugin).
- `globals: false`, `environment: 'jsdom'`.
- `setupFiles: ['./src/test/setup.ts']` — see below.

### Web setup file (`web/src/test/setup.ts`)

Installs jsdom polyfills that production browsers have but jsdom lacks:

- `@testing-library/jest-dom/vitest` — extends `expect` with `toBeInTheDocument`, `toHaveTextContent`, etc.
- In-memory `localStorage` shim (`Map`-backed) if the global is missing.
- Mock `IntersectionObserver` class when not present.
- Mock `window.matchMedia` when not present.

Any test that touches storage, observers, or media queries can rely on these defaults; no per-test setup needed.

## Test Structure

### Vitest pattern (cli / web)

```typescript
import { describe, expect, it } from 'vitest'
import { extractErrorInfo, apiValidationError } from './errorUtils'

describe('extractErrorInfo', () => {
    it('extracts serverProtocolVersion from axios-style response header', () => {
        const error = { /* ... */ }
        const info = extractErrorInfo(error)
        expect(info.serverProtocolVersion).toBe(2)
    })
})
```

### Bun test pattern (hub / shared)

```typescript
import { describe, expect, it } from 'bun:test'
import { MessageService } from './messageService'

describe('MessageService goal status filtering', () => {
    it('hides stored redundant goal status events', () => {
        const store = makeStore()
        const session = makeSession(store, 'goal-status-filter')
        // ...
    })
})
```

**Common conventions for both:**
- `describe(<ClassOrFunctionName>, ...)` at the top; sub-`describe` for distinct behaviors (e.g., `MessageService.cancelQueuedMessage race scenarios`).
- `it('verb-first sentence', ...)` — describe behavior in plain English (`'returns cancelled and emits message-cancelled SSE after CLI confirms removal'`).
- One assertion focus per `it`, multiple `expect()` calls OK.
- Use `async`/`await` for promise-returning code under test; no `done` callbacks.

## Test Helpers & Factories

Pattern: define module-local `make*` helpers at the top of the test file rather than sharing across files. Keeps the helper next to the assertions that exercise it.

**Store factory (hub):**

```typescript
function makeStore(): Store {
    return new Store(':memory:')
}

function makeSession(store: Store, tag: string) {
    return store.sessions.getOrCreateSession(tag, { path: `/tmp/${tag}` }, null, 'default')
}
```

Always use `:memory:` SQLite for `hub/` store tests — never touch the real `~/.hapi/` DB. The hub `Store` class accepts `:memory:` directly.

**Fake collaborators via `as unknown as T`:**

```typescript
function makeIo(onEmit: (ack: AckCallback) => void, socketCount = 1): Server {
    return {
        of: (_ns: string) => ({
            to: (_room: string) => broadcastRoom,
            adapter: { rooms: { get: (_roomName: string) => socketSet } }
        })
    } as unknown as Server
}
```

Type-cast partial mocks via `unknown` rather than implementing the full interface. Comment why the partial is safe ("Only the subset the route under test uses").

**React component factories (web):**

```typescript
function makeSession(overrides: Partial<SessionSummary> & { id: string }): SessionSummary {
    return {
        active: false, thinking: false, activeAt: 0, updatedAt: 0,
        metadata: null, todoProgress: null, pendingRequestsCount: 0,
        model: null, effort: null,
        ...overrides
    }
}
```

Defaults first, spread `...overrides` last so tests express only the fields that matter.

## Mocking

### Vitest mocking (cli / web)

Use `vi.mock` with `vi.hoisted` for top-of-file module mocks. The mock declarations must precede the `import` of the module under test:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

const axiosPostMock = vi.hoisted(() => vi.fn())
const ioMock = vi.hoisted(() => vi.fn())

vi.mock('axios', () => ({
    default: { post: axiosPostMock }
}))

vi.mock('socket.io-client', () => ({ io: ioMock }))

vi.mock('@/api/auth', () => ({
    getAuthToken: () => 'cli-token'
}))

// Imports of mocked modules come AFTER vi.mock calls
import { ApiClient } from './api'

beforeEach(() => {
    axiosPostMock.mockReset()
    ioMock.mockReset()
})
```

Reset mocks in `beforeEach` to avoid cross-test bleed.

### Bun test mocking (hub)

```typescript
import { describe, expect, it, mock, spyOn } from 'bun:test'

innerBot.start = mock((): Promise<void> => Promise.reject(new Error('Network failure')))

const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
// ...
errorSpy.mockRestore()
```

- `mock(impl)` replaces a function/method in place.
- `spyOn(obj, 'method')` wraps for assertions; always `.mockRestore()` in cleanup so other tests see real behavior.

### What to mock

- External I/O: `axios`, `socket.io-client`, `fs` writes against the real home dir, network calls.
- Time-sensitive code: use `vi.useFakeTimers()` (vitest) when testing timeouts; restore in cleanup.
- Heavy collaborators that aren't under test (RPC handler managers, terminal managers — see `cli/src/api/api.extraHeaders.test.ts`).

### What NOT to mock

- The SUT itself or its direct collaborators that are cheap to construct (Store with `:memory:`, MessageQueue2, simple classes).
- Zod schemas — let them validate real shapes.
- Workspace `@hapi/protocol` types/schemas — import them.

## React Component Testing (web)

Stack: `@testing-library/react` + `@testing-library/jest-dom` + jsdom.

```typescript
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { CodeBlock } from '@/components/CodeBlock'

describe('CodeBlock', () => {
    it('renders a header label and truncation badge for long content', () => {
        render(
            <I18nProvider>
                <CodeBlock code={longCode} language="typescript" title="TypeScript" collapseLongContent />
            </I18nProvider>
        )
        expect(screen.getByText('TypeScript')).toBeInTheDocument()
    })
})
```

**Rules:**
- **Always wrap with `<I18nProvider>`** if the component (or any descendant) calls `useTranslation()`. Otherwise i18n keys leak into assertions.
- Prefer role/text queries (`getByText`, `getByRole`, `getByTitle`) over CSS selectors. Fall back to `container.querySelector(...)` only for visual structure checks (e.g., grid template assertions in `CodeBlock.test.tsx`).
- Use `fireEvent` for synthetic events; `userEvent` is not currently in dependencies, do not introduce it without discussion.
- For TanStack Query hooks, wrap with a fresh `QueryClient` per test (see `web/src/hooks/mutations/useSendMessage.test.tsx`).

## Integration Tests

- Live in `cli/src/runner/runner.integration.test.ts` and a handful of other `*.integration.test.ts` files.
- Require **`.env.integration-test`** (loaded automatically by `cli/vitest.config.ts`) which sets `HAPI_HOME=~/.hapi-dev-test`, `HAPI_API_URL=http://localhost:3006`, `CLI_API_TOKEN`.
- Spawn real child processes (`spawn`, `execSync`, `spawnHappyCLI`). Use `waitFor(condition, timeout)` helpers (defined in-file) to poll until ready instead of hard-coded sleeps.
- Clean up state in `afterEach` — kill processes, `unlinkSync` runner state, `clearRunnerState()`.

## Coverage

- Configured only for `cli/` (`v8` provider, `text/json/html` reporters). Run via `vitest run --coverage` from `cli/`.
- No enforced thresholds. No coverage gate in CI.
- `hub/` and `web/` have no coverage configuration — measure via `bun test --coverage` ad hoc if needed.

## E2E

- **No browser-driven E2E suite at present.** `playwright` is declared at the repo root devDependencies (`playwright@1.49.1`) but no `*.e2e.ts` or `playwright.config.*` exists.
- Manual smoke testing via `bun run dev` (hub + web concurrently).

## Common Patterns

### Async + timers

```typescript
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

await bot.start()
await sleep(10)  // allow microtask (.catch handler) to run
expect(errorSpy).toHaveBeenCalledWith(...)
```

### Race-scenario tables

Top-of-file block comment enumerates the cases the suite covers (Race-A / Race-B / Race-C ...). See `hub/src/sync/messageService.test.ts`. Each case gets its own nested `describe` so output reads like a checklist.

### Error-path testing

For `extractErrorInfo`-style narrowing functions, build malformed inputs (missing fields, wrong types, non-Error throwables) and assert the function degrades gracefully — see `cli/src/utils/errorUtils.test.ts`.

### Round-trip testing

When a pair of functions are inverses (encode/decode, build/parse, apiValidationError ↔ extractErrorInfo), include a `'round-trips through X'` test that pipes output from one into the other and asserts the original fields survive.

## Anti-patterns to Avoid

- Touching the real `~/.hapi/` directory or real SQLite file. Use `:memory:` Store or `mkdtempSync(tmpdir() + '/...')` and `rmSync` in cleanup.
- `setTimeout`-based "wait for state" assertions. Use `waitFor(condition, timeout)` helpers or Vitest `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()`.
- Importing `bun:test` in `cli/` or `web/` (they run under Vitest) or importing `vitest` in `hub/` or `shared/` (they run under Bun test).
- Cross-test state leakage. Always `beforeEach` reset mocks, `:memory:` stores, and module-local maps.
- `as any` to bypass typing. Prefer `as unknown as T` and document why the partial is safe.

---

*Testing analysis: 2026-05-20*
