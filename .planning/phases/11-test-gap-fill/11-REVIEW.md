---
phase: 11-test-gap-fill
reviewed: 2026-05-23T13:05:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - cli/src/agent/permissionMatrix.test.ts
  - hub/src/web/middleware/auth.test.ts
  - hub/src/web/routes/auth.test.ts
  - hub/src/web/test-utils/assertNoSecretLeak.ts
  - scripts/check-no-cut-agents.sh
  - shared/package.json
  - web/src/hooks/useSSE.test.tsx
  - web/src/hooks/useSSE.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-23T13:05:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The Phase 11 test-gap-fill changes are well-structured. The new permission-matrix
contract test, the two-layer auth tests, and the REFT-02 reconnect-convergence
suite are clearly anchored to phase decisions (D-176/D-177, D-184–D-187,
D-180–D-183/D-190). The shared no-leak helper is small, pure, and defensively
skips falsy secrets.

No Critical (security/correctness) issues were found. Findings cluster around
test-quality smells (a dead assertion masking intent, a fixture edge-case that
could theoretically produce an unchanged signature, a console-spy ordering
question) plus a couple of small robustness / hygiene gaps in the guard script
and the shared package manifest. Nothing here blocks shipping, but the
WARNING-tier findings should be addressed before this phase is treated as the
contract pin it claims to be.

## Warnings

### WR-01: Dead assertion at end of parameterised loop masks intent

**File:** `web/src/hooks/useSSE.test.tsx:277`
**Issue:** Inside the `for (const [field, event, assertCase] of cases)` loop in
the `session-updated with each other patch field …` test, the body ends with:

```ts
expect(field).toBeTruthy()
```

`field` is always a non-empty string literal from the `cases` tuple (e.g.
`'active'`, `'activeAt'`, `'permissionMode'`), so this assertion can never fail
and contributes nothing. It is positioned where one would expect a
"this case actually ran" sentinel, but it can't serve that purpose: if
`waitFor(() => assertCase(queryClient), { timeout: 1_000 })` rejects, the loop
already throws before reaching this line; if `waitFor` resolves silently because
the assertion inside `assertCase` was never reached (e.g. `assertCase` itself
threw a non-`expect` error that `waitFor` swallows), `expect(field).toBeTruthy()`
still trivially passes. Net effect: a reviewer reading this file may assume the
loop is robustly covered when it isn't, and the line is pure noise to future
maintainers.
**Fix:** Either drop the line entirely or replace it with a counter-style
assertion that actually proves each case dispatched. For example:

```ts
let executedCases = 0
for (const [field, event, assertCase] of cases) {
    // ... existing setup + dispatch ...
    await waitFor(() => assertCase(queryClient), { timeout: 1_000 })
    executedCases += 1
}
expect(executedCases).toBe(cases.length)
```

This proves all `cases.length` iterations completed their `assertCase`, which is
the actual invariant the loop is trying to enforce.

### WR-02: `makeTamperedJwt` does not guarantee a tampered signature in degenerate cases

**File:** `hub/src/web/middleware/auth.test.ts:57-64`
**Issue:** The fixture builds a tampered token by replacing the last two chars
of the base64url signature with `'AA'`, with a fallback that switches to the
literal `'AAAA'` when the mangling happens to be a no-op:

```ts
const mangled = (sig.length > 2 ? sig.slice(0, -2) : sig) + 'AA'
parts[2] = mangled === sig ? 'AAAA' : mangled
```

Two latent issues:
1. If `sig.length <= 2` (defensive branch), `mangled = sig + 'AA'`, which has a
   different length than `sig`. It is then guaranteed to differ from `sig`, but
   the resulting string is not a tampered version of a real signature — it's an
   appended one. For HS256 the real signature is always 43 base64url chars, so
   this branch is dead in practice, but its presence muddies intent.
2. If the real signature happens to already end in `'AA'`, the mangling is a
   no-op (`mangled === sig`) and the code falls back to `'AAAA'`. Nothing
   guarantees that `'AAAA'` itself differs from the original signature — for
   sufficiently short or degenerate signatures (impossible for HS256, but the
   helper takes no explicit dependency on alg), the test could submit a
   *correctly signed* token and assert `Invalid token`, which would then fail
   silently for the wrong reason.

Because HS256 signatures are fixed-length and high-entropy, this is currently a
theoretical concern, not a live bug. But the helper reads as "robust against
edge cases" while not actually being so, which is exactly the trap REFT-03 is
trying to close.
**Fix:** Compare the last two characters and flip them deterministically; assert
the post-condition rather than relying on a static fallback:

```ts
async function makeTamperedJwt(uid: number = 1): Promise<string> {
    const valid = await makeValidJwt(uid)
    const parts = valid.split('.')
    const sig = parts[2] ?? ''
    if (sig.length < 2) throw new Error('unexpected JWS sig length')
    const last2 = sig.slice(-2)
    const flipped = last2 === 'AA' ? 'BB' : 'AA'
    parts[2] = sig.slice(0, -2) + flipped
    if (parts[2] === sig) throw new Error('tamper helper failed to mutate sig')
    return parts.join('.')
}
```

### WR-03: Guard script swallows ripgrep errors as "no match"

**File:** `scripts/check-no-cut-agents.sh:165-170, 174-180, 196-203, 408-411, 422-425`
**Issue:** Many sweeps use the bare pattern `if "$RG_BIN" -n PATTERN PATHS; then ... fail; fi`.
`rg` returns 0 on match, 1 on no match, and **2 on error** (e.g. a path doesn't
exist). The current pattern correctly fails-loud on exit 2 (a non-zero status
enters the `then` branch and `exit 1`), but the diagnostic that prints to the
user is identical to a real residue hit — there is no way to tell from the
output whether the guard tripped on real source residue or on a missing path /
permissions error. Example sites:

- Line 165: Phase-6 duplicate-helper sweep over `${PHASE6_SOURCE_DIRS[@]}`.
- Line 174: Phase-6 `permissionMode as string` cast sweep over
  `${PHASE6_LAUNCHER_FILES[@]}`. If either launcher file is renamed in a future
  refactor, the guard "fails" with an error message claiming a cast residue
  exists when it doesn't.
- Lines 408/422: Phase-9 `levenshteinDistance` / `estimateBase64Bytes` leak
  sweeps over `${PHASE9_NON_WEB[@]}` and `cli/src hub/src web/src`. Same trap.

Secondary concern: line 196 uses `npx --no-install madge ... > /dev/null 2>&1` —
if `npx` cannot locate madge (e.g. CI cache miss), the negated `if !` branch
fires and prints "madge circular dependency found", which is misleading.
**Fix:** Distinguish exit codes explicitly, e.g.:

```bash
if out=$("$RG_BIN" -n "$PATTERN" "${PATHS[@]}"); rc=$?; [ "$rc" -eq 0 ]; then
  echo "$out"
  echo "❌ real residue found"
  exit 1
elif [ "$rc" -ge 2 ]; then
  echo "❌ ripgrep error (exit $rc) while sweeping PATTERN; check paths"
  exit 1
fi
```

For madge, drop `--no-install` (or check the binary's presence first) and route
its stderr to the operator on failure so install/cache errors are
distinguishable from real cycles.

## Info

### IN-01: `patchSessionSummary` collapses explicit `undefined` to `null`

**File:** `web/src/hooks/useSSE.ts:232-233`
**Issue:** The summary-patch branch uses:

```ts
model: Object.prototype.hasOwnProperty.call(patch, 'model') ? patch.model ?? null : current.model,
effort: Object.prototype.hasOwnProperty.call(patch, 'effort') ? patch.effort ?? null : current.effort
```

This treats `{ model: undefined }` (key present, value `undefined`) as
"explicitly clear model to `null`". Given Phase 7's strict `SessionPatchSchema`,
the wire form should never produce `undefined` for a present key in practice;
in tests, however, hand-crafted patches (e.g. the loop in
`useSSE.test.tsx:235-279`) can do so silently. There is no test pinning the
"explicit clear" semantics, so a future schema change that makes `model`
nullable-optional could regress the cache without any test catching the
difference between "unset" and "clear".
**Fix:** Add one targeted test that dispatches `{ type: 'session-updated', data: { model: null } }`
and asserts the summary `model` becomes `null`, so the
`patch.model ?? null` line is pinned behavior rather than incidental.

### IN-02: `shared/package.json` has no `scripts` or `devDependencies`

**File:** `shared/package.json:1-20`
**Issue:** The manifest exposes zod as a runtime dep and several path-based
`exports`, but defines no `scripts` (no `test`, no `typecheck`) and no
`devDependencies`. Test files in `shared/src/**/*.test.ts` import from
`bun:test` (per the Phase-11 guard at lines 621-627 of `check-no-cut-agents.sh`),
which is supplied implicitly by the bun runtime. This works today but couples
the package to bun being globally available and means a fresh checkout cannot
run `shared/`'s tests through a normal `npm install && npm test` flow. There is
also no `bun test` script entry to document the convention.
**Fix:** Add at minimum:

```json
"scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit"
}
```

and consider listing `typescript` (and `@types/bun` if used) under
`devDependencies` so the package is self-describing.

### IN-03: `permissionMatrix.test.ts` duplicates ground-truth check against two sources

**File:** `cli/src/agent/permissionMatrix.test.ts:41-51`
**Issue:** Two assertions check that the local `MATRIX` keys equal
`CURSOR_PERMISSION_MODES` (D-176) and also equal `FLAVOR_CAPS.cursor.permissionModes`.
If `CURSOR_PERMISSION_MODES` and `FLAVOR_CAPS.cursor.permissionModes` ever
diverge (a refactor risk), this test reports both failures with the same
"matrix is wrong" framing, when in fact the underlying invariant being violated
is "the two SoT arrays must agree". No test in this file directly asserts
`CURSOR_PERMISSION_MODES === FLAVOR_CAPS.cursor.permissionModes` as a standalone
invariant.
**Fix:** Add a third assertion that pins the cross-SoT invariant directly:

```ts
it('CURSOR_PERMISSION_MODES === FLAVOR_CAPS.cursor.permissionModes (cross-SoT)', () => {
    expect([...CURSOR_PERMISSION_MODES].sort()).toEqual(
        [...FLAVOR_CAPS.cursor.permissionModes].sort()
    )
})
```

So that on a regression the failure points at the actual divergence rather than
implicating the matrix.

### IN-04: JSON-parse-failure assertion runs outside `waitFor`

**File:** `web/src/hooks/useSSE.test.tsx:376-393`
**Issue:** The "JSON.parse failure returns silently" test asserts cache
preservation inside `waitFor`, then immediately after the `waitFor` block runs:

```ts
expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('dropped malformed event'),
    expect.anything(),
)
```

Because `handleMessage` performs `JSON.parse` synchronously and returns before
reaching `console.error`, this is functionally correct today. But the test
relies on that synchrony as an implicit invariant — if `useSSE` ever switches
to async parsing or defers error logging via `queueMicrotask`/`setTimeout`,
this assertion would flake by checking too early without any wrapping
`waitFor` to give it a stable window.
**Fix:** Wrap the negative assertion in the same `waitFor` (or a short
`vi.waitFor`) so it remains valid under a future async-logging refactor:

```ts
await waitFor(() => {
    expect(queryClient.getQueryData(queryKeys.sessions)).toEqual(seeded)
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('dropped malformed event'),
        expect.anything(),
    )
})
```

---

_Reviewed: 2026-05-23T13:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
