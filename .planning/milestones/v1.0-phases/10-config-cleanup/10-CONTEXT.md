# Phase 10: Config cleanup - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers the config cleanup promised by REFC-01 and REFC-02: remove backward-compat config aliases (`serverUrl`, `webapp*`, legacy env/command surfaces), remove the `hapi server` alias, delete runtime SQLite migration paths in favor of explicit schema-version rejection plus offline migration tools, and replace mutable config singletons/setters with startup-loaded frozen config values passed through dependency injection.

**In scope:**

- Drop legacy config aliases in CLI and Hub:
  - CLI no longer reads `settings.serverUrl`; canonical field is `apiUrl`.
  - Hub no longer accepts old `webapp*` settings or old env aliases; canonical fields are `listenHost`, `listenPort`, `publicUrl`, and `corsOrigins`.
  - `hapi server` is removed as an alias for `hapi hub`.
- Replace mutable config surfaces:
  - Remove `_setApiUrl()`, `_setCliApiToken()`, `_setExtraHeaders()` and equivalent mutation-after-construction paths.
  - Replace module-level mutable singleton access with `loadConfig()` returning a deeply frozen `Readonly` config object.
  - Thread config explicitly through CLI/Hub startup and constructor boundaries.
- SQLite migration cleanup:
  - Remove runtime `migration-vN` source paths and runtime migration invocation.
  - Keep explicitly named offline migration tooling where it exists and is still needed.
  - Preserve/start from the existing Store behavior of rejecting schema-version mismatches at startup.
- Tests and guard:
  - Add runtime tests for legacy field errors, malformed settings errors, frozen config mutation, and schema mismatch/missing-table errors.
  - Add ripgrep guards for removed legacy fields, command alias, config setters, and runtime migration paths.

**Out of scope:**

- New config management UX beyond clear failure messages. No new config doctor or interactive migration wizard.
- New multi-user/token-rotation/rate-limiting work. The single-user Tailscale model remains unchanged.
- Phase 11 test-gap work: Cursor permission matrix, SSE reconnect invariants, and auth route negative cases.
- Phase 12 docs cleanup beyond any source/test error strings or guard messages needed for Phase 10.

</domain>

<decisions>
## Implementation Decisions

### 1. Legacy config and command residue

- **D-160: Legacy residue must fail hard with repair guidance.** If runtime startup sees old settings fields, old env names, or the removed `hapi server` command alias, it should fail with a clear message rather than silently ignoring the residue or preserving compatibility. Messages should name the old key/command, the new canonical replacement, and the file/env/command the user should edit.
- **D-161: Failure coverage includes settings, env, and command names.** The cleanup should cover `settings.json` fields like `serverUrl` and `webapp*`, old env aliases if any remain or can be detected, and command resolution for `hapi server`. This is broader than source-code deletion alone; the user should not get an ambiguous fallback.
- **D-162: Error messages should guide manual edits, not auto-migrate.** For `~/.hapi/settings.json`, list old-to-new mappings (`serverUrl` -> `apiUrl`, `webapp*` -> `publicUrl`/`listen*` as applicable) and tell the user to edit the file or env and restart. Do not delete/recreate settings automatically because the file may contain still-valid values like `machineId` or `cliApiToken`.
- **D-163: Guard + runtime tests are both required.** Add tests for the failure messages and a guard sweep that rejects legacy reads/aliases. The guard should be precise enough to allow tests/docs where intentionally asserted, but production source should not keep alias reads or command alias registration.

### 2. Frozen config shape

- **D-164: `loadConfig()` returns a plain frozen `Readonly` object.** Do not preserve the mutable `Configuration` class as the primary public surface. The resulting shape should be a plain object whose fields are directly readable and whose mutation throws in strict-mode tests.
- **D-165: Freeze nested mutable collections too.** Top-level freeze is not enough. Nested structures such as `extraHeaders`, `sources`, and `corsOrigins` should also be frozen or copied into immutable equivalents so consumers cannot mutate config after startup.
- **D-166: Public surface becomes `loadConfig()` + `Config` type.** Delete `configuration`/`getConfiguration()` as production access surfaces during this phase rather than leaving long-lived wrapper shims. Package-specific helper internals are fine, but downstream code should consume the explicit loaded config.
- **D-167: Malformed settings fail fast.** CLI should stop swallowing malformed `settings.json` into defaults. If settings JSON is unreadable or has invalid field types, `loadConfig()` should throw with the settings path and a clear repair message. This aligns CLI with the Hub-side `readSettingsOrThrow` pattern.

### 3. Dependency injection boundary

- **D-168: DI should cover startup chains and constructor boundaries.** Load config at the CLI/Hub entry point, then pass it explicitly to commands, API clients, stores, service constructors, and initialization helpers that need it. Do not introduce a broad AppContext/ServiceContainer in Phase 10.
- **D-169: CLI prompting is a bootstrap step before freeze.** CLI startup may still read settings, prompt for missing token when appropriate, and write updated settings, but that all happens before final `Config` construction. Once `loadConfig()` returns the final config, runtime mutation is forbidden.
- **D-170: Tests use factories/fixtures, not reset setters.** Replace singleton-reset patterns with explicit test config factories or fixtures. Do not add `resetConfigForTests()` or test-only setters as a new mutable backdoor.
- **D-171: Production config consumers should be cut over in one phase.** All direct production reads from `configuration` or `getConfiguration()` should be converted to explicit config passing. Tests can be updated alongside production changes, but Phase 10 should not leave production half on singleton and half on DI.

### 4. SQLite runtime migration policy

- **D-172: Delete runtime migrations; keep explicit offline migration tools.** Remove runtime `migration-vN` source and invocation paths. Keep explicitly named offline scripts/tests that are still relevant, such as namespace-isolation migration tooling, because those match the new “operator chooses migration” policy.
- **D-173: Schema mismatch errors point to offline migration or rebuild.** Startup failure should include DB path, expected version, found version, and a concise instruction: back up, then run the relevant offline migration tool or rebuild the database.
- **D-174: Bump schema version when strict decoding would reject old persisted data.** Do not limit version bumps only to table/column changes. If Phase 10 removes compatibility that makes old persisted JSON/message metadata fail under strict schemas, bump `SCHEMA_VERSION` and rely on mismatch rejection to prevent half-compatible startup.
- **D-175: SQLite cleanup needs Store tests and guard coverage.** Keep/add tests for version mismatch and missing required tables. Add guard coverage that rejects runtime `migration-v*.ts` files and runtime migration callsites, while allowing explicitly named offline migration scripts and their tests.

### Claude's Discretion

- Slice order is left to researcher/planner. Recommended order: (1) legacy residue + guard, (2) `loadConfig()` frozen object for CLI/Hub, (3) DI cutover for consumers, (4) SQLite runtime migration cleanup + final guard.
- Exact module names for helper functions are planner discretion, as long as the public surface is `loadConfig()` + `Config` and production consumers do not use mutable singletons.
- The exact old env alias list should be discovered by researcher from current source and historical settings code. The decision is to fail hard for any old alias that still has a detectable runtime surface.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and requirements

- `.planning/PROJECT.md` — Project rule: Cursor-only, single-user Tailscale, no backward compatibility, clear/correct refactor over compatibility shims.
- `.planning/REQUIREMENTS.md` — REFC-01 and REFC-02 define Phase 10: remove backward-compat config aliases/runtime migrations and replace mutable config singleton with frozen `loadConfig()` + DI.
- `.planning/ROADMAP.md` — Phase 10 success criteria: zero `serverUrl`/`webapp(Url|Host|Origin)` legacy reads, zero `hapi server` alias, zero `_setApiUrl()`/`_setCliApiToken()`/`_setExtraHeaders()` callsites, schema mismatch rejection, frozen config tests, `bun typecheck`, and `bun run test`.

### Prior phase decisions to carry forward

- `.planning/phases/07-wire-contracts-unification-sse-patch-contract/07-CONTEXT.md` — D-116/D-123 accept no compatibility period for old persisted wire data and defer old-data rejection to Phase 10 schema-version mismatch handling.
- `.planning/phases/08-hub-internal-decoupling/08-CONTEXT.md` — D-139 uses explicit constructor DI for `KeepaliveScheduler`; Phase 10 should continue that direction for config, without introducing a broad container.
- `.planning/phases/09-web-internal-decoupling/09-CONTEXT.md` — D-157/D-158 provide the recent 4-slice + guard pattern; Phase 10 should follow the same green-per-slice cadence and final guard sweep.

### Codebase maps

- `.planning/codebase/CONCERNS.md` — Direct source of Phase 10 concerns: backward-compat carry-over in CLI settings/DB and mutable configuration singletons/proxy.
- `.planning/codebase/ARCHITECTURE.md` — Configuration currently spans CLI, Hub, shared protocol, and SQLite store startup; notes existing module-level singleton constraints.
- `.planning/codebase/CONVENTIONS.md` — Established code style: TypeScript strict, named exports, constructor DI for stateful services, avoid module-level mutable singletons.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `hub/src/config/serverSettings.ts::rejectOldSettingsFields` already implements the preferred fail-fast shape for old Hub settings fields. Phase 10 can extend this pattern instead of inventing a new compatibility layer.
- `hub/src/config/settings.ts::readSettingsOrThrow` already fails fast on malformed Hub settings. CLI should move away from `cli/src/persistence.ts::readSettings()` silently returning defaults on parse failure.
- `hub/src/store/index.ts::Store` already rejects schema-version mismatches and missing required tables with explicit errors. Phase 10 should preserve and harden this behavior while deleting remaining runtime migration paths.
- `hub/scripts/migrate-namespace-isolation.*` appears to be the explicit offline migration pattern to preserve, not a runtime migration path to keep.

### Established Patterns

- Recent phases use “once cut cleanly + guard sweep” instead of compatibility shims. Phase 10 should not add temporary aliases, wrapper shims, dual command names, or mutable reset APIs.
- Explicit constructor dependency injection is already accepted in Hub after Phase 8. Config should follow the same pattern: load at entry, pass to dependents.
- Shared protocol remains for wire/types/cross-package semantics; do not move UI-only or package-local details into `shared/` just to satisfy cleanup.

### Integration Points

- `cli/src/configuration.ts` currently exposes mutable `_setApiUrl()`, `_setCliApiToken()`, and `_setExtraHeaders()` on a singleton `configuration`. This is the main CLI REFC-02 target.
- `cli/src/ui/apiUrlInit.ts` currently reads `settings.serverUrl` as a legacy alias and mutates `configuration._setApiUrl(...)`. This is the direct REFC-01 + REFC-02 overlap.
- `cli/src/ui/tokenInit.ts` currently mutates `configuration._setCliApiToken(...)` after prompting/writing settings. Replace with a bootstrap-then-freeze flow.
- `cli/src/commands/registry.ts` currently registers `{ ...hubCommand, name: 'server' }`. This should be removed and covered by a command-resolution test.
- `hub/src/configuration.ts` currently creates a `Configuration` instance, mutates `_setCliApiToken(...)`, and exposes `createConfiguration()`/`getConfiguration()` singleton access. This should become frozen config loading plus explicit passing.
- `hub/src/config/serverSettings.ts` already rejects several old `webapp*` and relay fields. Expand/verify coverage for Phase 10’s legacy field/env policy.
- `hub/src/store/index.ts` owns `SCHEMA_VERSION` and schema mismatch behavior. Any strict persisted-data incompatibility introduced in this phase should be reflected here.

</code_context>

<specifics>
## Specific Ideas

- Recommended guard phrases:
  - `serverUrl` production reads should be zero except allowed tests/error-message assertions.
  - `webappUrl|webappHost|webappOrigin|webappPort` production reads should be zero except old-field rejection tests.
  - `name: 'server'` / `hapi server` command alias should be zero in command registry source.
  - `_setApiUrl|_setCliApiToken|_setExtraHeaders` should be zero in production source.
  - runtime `migration-v*.ts` files and runtime migration dispatch should be zero, while explicitly named offline migration scripts may remain.
- Frozen config tests should run in strict mode and attempt mutation of both top-level and nested fields.
- CLI bootstrap should be allowed to prompt/write settings only before final config construction. After final config is returned, every consumer sees an immutable value.
- For SQLite, the error message should be operationally useful but not a full manual: DB path, expected version, found version, and “back up, then run offline migration or rebuild”.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-Config cleanup*
*Context gathered: 2026-05-23*
