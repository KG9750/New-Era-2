# Plans

Execution-plan entrypoint for `Project-004-New Era 2`.

## Current Active Plan

- `docs/exec-plans/active/2026-08-01-godot-engine-evaluation-e0-and-engine-gate.md` — Godot 4.7.1 的 3–5 日、无插件、合成数据、默认废弃技术评估计划；当前仅 `PROPOSED_NOT_AUTHORIZED`，不创建 Godot 工程、不改变 React/TypeScript 权威，不解锁 Gate 1H、Gate 2、地图 runtime 或生产开发。
- `docs/exec-plans/active/2026-08-01-godot-engine-evaluation-e0-fixture-and-measurement-annex-v0.1.md` — E0 的合成 TileMapLayer 负载、OS 注入动作轨迹、运行次数、统计公式和数值失败口径；必须与父计划一起由 Owner 绑定 SHA 后才可执行。
- `docs/exec-plans/active/2026-07-26-v0.4-prototype-validation-plan.md` — V0.4 分阶段原型验证总控计划；Gate 0 已通过，下一步是 Gate 1 两周经营原型，不直接开发完整三个月。
- `docs/exec-plans/active/2026-07-26-react-web-gate-1-2-development-plan.md` — Gate 1 React Web 灰盒的范围与实现合同；原型已形成，当前重点是冻结治理与验证，不是继续按“未开工”状态扩建。
- `docs/exec-plans/active/2026-07-26-gate1-agent-test-operations.md` — Gate 1 双轨测试运营合同；定义 `M-A`–`M-C`、`A01`–`A07`、同一 RC、隔离、替补和报告边界。
- `docs/exec-plans/active/2026-07-26-gate1-dual-track-independent-review.md` — 双轨合同独立复核；最终 P0=0 / P1=0 / P2=0 / REVIEW_PASS。
- `docs/exec-plans/active/2026-07-26-gate1-d0-readiness.md` — RC4 阶段的历史实时记录；其执行状态已被 RC9/C04/C05 链 supersede，不再提供当前开跑权限。
- `docs/design-docs/map-p0a-provisional-tooling-amendment-v0.1.md` — 地图阶段治理优先修正案；topology registry/golden、resolver、fixture manifest、manifest contract/CLI、测试与 `data/map/p0a/map-p0a-validation-report-v0.1.json` 已形成 `PARTIAL_FIXTURE_PASS`（25/25测试，fixture exit 0，production exit 1且同时因`PHASE_LOCKED`和`COVERAGE_INCOMPLETE`失败）；`artifact_status=fixture_only / production_eligible=false / coverage_complete=false`。旧 H1 已正式 `MAP_H1_REVIEW_FAIL`，V2 contract core 仅静态 `REVIEW_PASS` 且 `CONTRACT_ACTIVATION=NONE`；P0b、P1、正式素材、编辑器、运行时与Gate均未授权。
- `docs/design-docs/map-h1-v2-activation-preflight-v0.1.md` — V2 当前为 `STATIC_CORE_REVIEW_PASS / CONTRACT_ACTIVATION_NONE / EXTERNAL_EVIDENCE_BLOCKED`；正式 ImageGen 素材与真人 package 不可启动，下一项可执行工作为 `MAP_H1_V2_COMPANION_DRAFT`。
- `docs/design-docs/map-visual-exploration-protocol-v0.1.md` — 与正式 H1 轨隔离的非正式视觉探索支线；当前 `EXPLORATION_PREFLIGHT_PENDING / EXPLORATION_RUNS_NOT_AUTHORIZED`，下一步先实现 schema、validator、预建 registry、原子 finalize、exposure denylist 与测试向量，不解锁正式素材、真人、Gate 或 runtime。

## Current Execution Governance

- C04 已最终 `REJECTED_PRE_DIAGNOSTIC`，不得重跑、修补或复用 P07/P08/D16–D20。
- C05 plan-only 已发布到远端 `codex/rc9-08r3-c04-integration-preflight-20260731@8eff11ea4b5b9c6b017c690610d16a0574503300`。
- X5 尚未发布，C05 尚未创建；必须先完成精确 executable-contract blob 的双零 finding 复审，再由独立 `C05_IMPLEMENTATION_AUTHORITY` 绑定已发布 X5。
- 文件化 Codex version diagnostic V3 的唯一 pre-run review 已以 `P0=0 / P1=2 / P2=0 / FAIL` 结束；V3 未执行、输出根未创建。下一版必须使用全新 plan/script binding 与独立授权，不得复用或修改 V3 后直接执行。
- V4 后继提案的唯一 pre-run review 为 `P0=0 / P1=3 / P2=0 / FAIL`，且固定 Node 24 `node --check` 未获审查沙箱执行许可；V4 未执行、`-04` 根缺席，不得生成 Owner capture 命令。
- 当前状态快照：`docs/exec-plans/evidence/2026-07-31-current-project-status.md`。
- 权威远端登记：[GitHub #58](https://github.com/KG9750/New-Era-2/issues/58)。Issue 正文中的早期 C04 “can start immediately”描述已被后续登记 supersede。

## Directories

- `docs/exec-plans/active/`: active or pending plans.
- `docs/exec-plans/completed/`: completed plans and results.
- `docs/exec-plans/tech-debt-tracker.md`: cross-cutting technical debt.

## Plan Requirements

- Goal and success criteria.
- Step-by-step implementation.
- Verification for each step.
- Risks or assumptions.
