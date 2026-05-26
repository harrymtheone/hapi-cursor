---
phase: 02
slug: skills-visibility-and-session-policy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (cli, web); `bun:test` (hub) |
| **Config file** | `cli/vitest.config.ts`, `web/vitest.config.ts`, hub inline |
| **Quick run command** | `cd cli && bun run test -- skills` / `cd hub && bun test skill` |
| **Full suite command** | `bun run test` (repo root) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd cli && bun run test -- skills.test.ts` (or focused hub/web path from task map)
- **After every plan wave:** Run `bun run test` at repo root
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SKIL-01 | T-02-01 | pathHint redacts home paths | unit | `cd cli && bun run test -- skills.test` | ✅ extend | ⬜ pending |
| 02-01-02 | 01 | 1 | SKIL-01 | — | Invalid skills visible in list | unit | `cd cli && bun run test -- skills.test` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | SKIL-02 | T-02-02 | Zod max keys on skillPolicy write | unit | `cd hub && bun test skillPolicy` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | SKIL-02 | — | Policy persist + SSE strict patch | unit | `cd hub && bun test skillPolicy` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | SKIL-02 | — | Resume retains skillPolicy | unit | `cd hub && bun test sessionMergeService` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | SKIL-03 | — | Badge shows HAPI session policy | component | `cd web && bun run test -- SkillsPolicy` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 3 | SKIL-03 | — | `$` autocomplete omits disabled | unit | `cd web && bun run test -- useSkills` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `cli/src/modules/common/skills.test.ts` — nested `.cursor/skills`, invalid frontmatter, pathHint
- [ ] `hub/src/web/routes/sessions/__tests__/skillPolicy.test.ts` — metadata persist + version mismatch
- [ ] `hub/src/sync/sessionMergeService.test.ts` — skillPolicy merge on resume
- [ ] `web/src/hooks/queries/useSkills.test.ts` — disabled filter
- [ ] `shared/src/schemas.skill.test.ts` — strict parse rejects unknown metadata keys (if applicable)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session skills sheet tri-state UX | SKIL-02 | Touch target / sheet layout | Open session on phone PWA; toggle inherited/enabled/disabled; confirm badge copy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
