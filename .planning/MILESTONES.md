# Milestones

Shipped milestones for HAPI Cursor Edition. Full archives live in `.planning/milestones/`.

---

## v1.0 — Refactor & Slim-Down (shipped 2026-05-23)

**Theme:** Brownfield fork shrunk to a Cursor-only, single-user, Tailscale-internal codebase with the abstractions Milestone 2 will build on.

**Stats:**

- Phases: 12 (sequential, no decimal insertions)
- Plans: 60
- Requirements: 33 / 33 (100% — REFA-01..05, REFH-01..04, REFW-01..03, REFC-01..02, REFT-01..03, CUT-01..12, VRFY-01..04)
- Timeline: 2026-05-20 → 2026-05-23 (4 days)
- Commits: 318 (range `a61af67` → `8e60ab1`)
- Diff: 917 files, +60,520 / −72,559 (≈ −12k LOC net)

**Key accomplishments:**

1. **Deleted 4 non-Cursor agent runtimes** (Claude, Codex, Gemini+ACP, OpenCode) and 3 external integration surfaces (Telegram bot, ElevenLabs voice route, ServerChan push channel) — `cli/src/{claude,codex,gemini,opencode}/`, `hub/src/{telegram,serverchan}/`, voice/bind routes, and `@anthropic-ai/*` + `grammy` + `@elevenlabs/react` deps all gone
2. **Collapsed multi-user namespacing + built-in tunnel infrastructure** — `CLI_API_TOKEN:<namespace>` syntax, JWT `ns` field, `users.platform` column, `hub/src/tunnel/` + `tunwg`, `HAPI_RELAY_*` env vars, and the `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` remote log stream all removed
3. **Rebuilt the core abstractions** — populated `FLAVOR_CAPS` capability table (cursor-only), shared agent runtime kit (`SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy`), `shared/` as the single source for `Session / Machine / Message / RunnerState` + strict `SessionPatchSchema / MachinePatchSchema`, frozen `loadConfig()` + DI replacing mutable singleton setters
4. **Decomposed the giants** — `SessionCache` (796 LOC) → `sessionRepository / Liveness / Config / Merge`; `SyncEngine` (854 LOC) → 4 sub-facades; `SessionList` (953→229), `message-window-store` (1088→28 facade), `settings/index` (758→47), `HappyComposer` (669→178), `_results` (687→175 dispatcher); central `KeepaliveScheduler` with SIGINT-tested timer cleanup
5. **0 circular dependencies** across `cli/` + `hub/` + `web/` (intra-package and cross-package) — enforced by `madge:check` in push-gated `.github/workflows/verify.yml` and per-phase `check-no-circular-{hub,web}.sh` guards
6. **Test coverage closure** — Cursor permission-mode → CLI flag contract matrix (type-exhaustive + per-row deep-equal), SSE reconnect / patch-loss convergence test (bounded backoff + TanStack cache), auth route + middleware negative cases (16 tests, `assertNoSecretLeak` helper)
7. **Documentation rewrite** — `README.md` / `AGENTS.md` / `cli/README.md` / `hub/README.md` / `web/README.md` rewritten from zero as Cursor-only Tailscale quickstart (364 lines total, AGENTS.md ≤ 100); `website/` + `docs/` deleted; repo-wide ripgrep guard (`scripts/check-no-cut-agents.sh`) enforces zero-residue of `claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|tunwg|namespace` outside whitelisted paths
8. **End-to-end Tailscale verification PASS** — manual phone scenario (new Cursor session → 1 round → kill hub → restart → state recovers → continue) on commit `e492044` (see `.planning/milestones/v1.0-phases/12-docs-cleanup-milestone-verification/12-VERIFICATION.md`)

**Archive:**

- `milestones/v1.0-ROADMAP.md` (full phase details + decisions + deferred items + tech debt)
- `milestones/v1.0-REQUIREMENTS.md` (33 / 33 with traceability)

**Tag:** `v1.0`

**Carry-forward to Milestone 2:**

- M2-BL-01..10 backlog items (see `.planning/milestones/v1.0-phases/12-docs-cleanup-milestone-verification/12-04-SUMMARY.md`)
- `reducerTimeline.ts` decomposition (925 LOC) — non-blocking
- Cursor permission-mode helper promotion to `shared/` — non-blocking
- Lint enforcement in CI — non-blocking
