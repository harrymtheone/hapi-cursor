# Debug: Tool cards show "Tool" placeholder except read_file

**Symptoms (UAT tests 2 & 3):** After pagination/reload/reconnect, tool activity cards show title "Tool" with empty `{}` input/result — except ReadFile (`read_file`) which renders correctly.

**Root cause:** `cli/src/cursor/utils/cursorEventConverter.ts` only extracts tool identity from three Cursor stream shapes:
- `readToolCall` → `read_file` ✓
- `writeToolCall` → `write_file`
- `function.name` → raw name

All other native Cursor `*ToolCall` variants (`editToolCall`, `grepToolCall`, `globToolCall`, `lsToolCall`, `shellToolCall`, `todoToolCall`, etc.) fall through to `return 'unknown'`. Empty input defaults to `{}`.

**Downstream effect:** CLI emits wire `tool-call` messages with `name: 'unknown'`. Hub projection upsert/reconcile faithfully persists `name: 'unknown'`. Web `ensureToolBlock` treats `'unknown'` as placeholder (`reducerTools.ts:73-76`) and displays generic "Tool" card with empty fields.

**Why Read works:** `readToolCall` is the only commonly-used tool type explicitly handled → `read_file` is not a placeholder → `isReadFileToolCall` / fallback presentation renders correctly.

**Evidence:**
- `cursorEventConverter.ts:52-59` — only read/write/function branches
- Cursor docs + community parsers list editToolCall, grepToolCall, globToolCall, lsToolCall, etc.
- Phase 01.2 Hub/Web projection pipeline verified with synthetic `CursorBash` names in tests — never exercised real Cursor NDJSON shapes
- D-13 scoped Hub-only, but bug originates upstream in CLI conversion before Hub ingest

**Fix direction:**
1. Generic parser: iterate `tool_call` object keys matching `*ToolCall`, extract args/result
2. Map Cursor tool keys → HAPI `knownTools` names (grepToolCall→Grep, editToolCall→Edit, etc.)
3. Tests with real Cursor NDJSON fixtures per tool type
4. Optional: Hub reconcile pass to re-derive names from result payloads for legacy `unknown` rows (existing sessions)

**Files involved:**
- `cli/src/cursor/utils/cursorEventConverter.ts` (primary fix)
- `cli/src/cursor/utils/cursorEventConverter.test.ts` (fixtures)
- Possibly `hub/src/sync/toolCallProjection.ts` (legacy recovery, optional)
