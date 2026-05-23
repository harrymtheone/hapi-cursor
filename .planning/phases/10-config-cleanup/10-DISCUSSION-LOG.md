# Phase 10: Config cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 10-Config cleanup
**Areas discussed:** 旧配置残留的失败方式, 冻结配置形态, DI 边界, SQLite 迁移策略

---

## 旧配置残留的失败方式

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Legacy behavior | Hard fail + repair guidance | 遇到 `serverUrl` / `webapp*` / `hapi server` 直接报错，告诉用户改成 `apiUrl` / `publicUrl` / `hapi hub` | yes |
| Legacy behavior | Ignore old fields | 删除读取路径，但残留字段不报错 | |
| Legacy behavior | Delete behavior only | 只删除读取/解析路径，提示交给文档 | |
| Coverage | Settings + env + command | `settings.json` 旧字段、旧 env 名、`hapi server` 都给明确错误 | yes |
| Coverage | Settings + command only | 旧 env 名不额外扫描 | |
| Coverage | Source zero-read only | 不做运行时旧 env/字段检查 | |
| Remediation | Manual edit guidance | 列出旧字段到新字段映射，并提示修改 settings/env 后重启 | yes |
| Remediation | Delete/recreate settings | 让用户删除 settings.json 并重新初始化 | |
| Remediation | Future tool | 当前只报错，不给字段级说明 | |
| Tests | Runtime tests + guard | 测错误提示，guard 扫生产残留 | yes |
| Tests | Guard only | 源码零命中即可 | |
| Tests | Runtime tests only | 不额外扫文件名/标识符 | |

**User's choice:** Hard fail, full coverage, manual repair guidance, runtime tests plus guard.
**Notes:** This follows the project’s no-backward-compat policy and extends the existing Hub old-field rejection pattern.

---

## 冻结配置形态

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Return shape | Plain Readonly object + Object.freeze | 去掉运行期 setter，字段直接可读，strict-mode mutation throws | yes |
| Return shape | Frozen class | 保留 `Configuration` 类但冻结实例 | |
| Return shape | Deep frozen tree | 作为单独形态选择提出，但最终并入冻结深度决策 | |
| Freeze depth | Top-level + nested mutable collections | `extraHeaders`、`sources`、`corsOrigins` 都不能被调用方改动 | yes |
| Freeze depth | Top-level only | 嵌套对象只靠类型表达 | |
| Freeze depth | Top-level + arrays only | 对象字段不 deep freeze | |
| Public surface | `loadConfig()` + `Config` | 删除 `configuration`/`getConfiguration` production surface | yes |
| Public surface | Compatibility exports | 保留薄 wrapper 到阶段结束 | |
| Public surface | Package-specific names | `loadCliConfig()` / `loadHubConfig()` | |
| Invalid settings | Fail fast | 带路径和修复提示抛错 | yes |
| Invalid settings | Fallback defaults | 类似 CLI 当前 parse failure 返回默认 | |
| Invalid settings | Warn and continue | 能读多少读多少 | |

**User's choice:** Plain frozen `Readonly` config object, nested collections frozen, `loadConfig()` + `Config`, malformed settings fail fast.
**Notes:** CLI should stop swallowing malformed settings into defaults.

---

## DI 边界

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Scope | Startup chain + constructors | 入口 load config，一路显式传给服务/命令/API client | yes |
| Scope | Setter-only | 只替换 `_set*`，保留模块级读取 | |
| Scope | AppContext/container | 引入统一容器 | |
| CLI prompt flow | Bootstrap then freeze | prompt/write settings 先完成，再构造冻结最终 Config | yes |
| CLI prompt flow | Prompt inside loadConfig | `loadConfig()` 内部直接 prompt/write | |
| CLI prompt flow | Auth-only writes | 普通命令缺 token 就失败 | |
| Tests | Factory/fixture | 测试显式构造 test config，不暴露 reset/setter API | yes |
| Tests | Test reset API | 增加 `resetConfigForTests()` | |
| Tests | Env only | 测试只靠 env/process setup | |
| Cutover priority | All production consumers | 生产 `configuration`/`getConfiguration()` 调用点一次切干净 | yes |
| Cutover priority | CLI first | Hub 可短暂保留 singleton | |
| Cutover priority | Hub first | CLI prompt 另切 | |

**User's choice:** Explicit startup/constructor DI, bootstrap-before-freeze for prompts, test fixtures over reset APIs, production consumers cut over in one phase.
**Notes:** Do not introduce a broad service container in this phase.

---

## SQLite 迁移策略

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Runtime migrations | Delete runtime, keep offline tools | 删除 runtime `migration-vN` 路径，保留明确命名的离线迁移脚本/测试 | yes |
| Runtime migrations | Delete all migrations | 旧库只能重建 | |
| Runtime migrations | Keep tests only | 保留 `migration-vN` 测试作为历史 contract | |
| Error guidance | Offline migration or rebuild | 写 Expected/Found version、DB path，提示备份后迁移或重建 | yes |
| Error guidance | Rebuild only | 不维护离线迁移说明 | |
| Error guidance | Tool-specific manual | 错误信息承担完整操作手册 | |
| Version bump | Bump if strict decoding breaks old data | 旧持久化 JSON 可能被新 strict schema 拒绝就 bump | yes |
| Version bump | Table changes only | 表结构不变就不 bump | |
| Version bump | Always bump Phase 10 | 无条件 bump | |
| Tests/guard | Store tests + migration guard | mismatch/missing-table 测试 + runtime migration 文件/调用点 guard | yes |
| Tests/guard | Guard only | 只扫 runtime migration 残留 | |
| Tests/guard | Store tests only | 不额外扫文件名 | |

**User's choice:** Delete runtime migrations, keep explicit offline migration tools, clear mismatch errors, bump schema when strict persisted decoding would break old data, Store tests plus guard.
**Notes:** This builds on the current `Store` mismatch rejection behavior.

---

## Claude's Discretion

- Slice order and exact helper module names are left to researcher/planner, with the recommendation recorded in `10-CONTEXT.md`.
- Exact old env alias inventory should be discovered from current source/history by researcher.

## Deferred Ideas

None.
