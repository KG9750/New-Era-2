# Project-004-New Era 2 Context

This file is the top-level context entrypoint for the project.

## Purpose

以概念设计 V0.4 为基线，通过逐级、可证伪的原型 Gate 验证《新纪元 2》的日常经营、主题—豁免经济、自由意志日双战场和跨月后果。当前只准备 Gate 1 的两周纯经营 React Web 灰盒。

## Boundaries

- Source root: `/Users/leo/Library/Mobile Documents/com~apple~CloudDocs/Personal/M3U Codex Workspace/Projects/Project-004-New Era 2`
- Project-specific rules should live in this file or `AGENTS.md`.
- Generated files are orientation aids, not source of truth.

## Current Facts

- Gate 0 已 `PASS`：总控计划、两周切片规格和玩家测试协议已建立；这只证明验证合同成立，不代表玩法已被玩家证明。
- Gate 1 采用双轨：Gate 1A 已授权使用 7 个独立 agent 样本，Gate 1H 真人验证暂缓；Gate 1A 不能替代 Gate 1H，也不能解锁 Gate 2。
- React + TypeScript + Vite 两周经营灰盒已经形成；它是 Gate 1 的实施介质，不是尚待创建的未来目录。当前实现与证据分布在功能分支，尚未合入 `main`。
- RC2–RC4 与 C01–C03 均为历史尝试；相关样本、失败记录和技术试玩不得重包装为当前正式 Gate 1A cohort。
- C04 已于 2026-07-31 在唯一 P07 场次因 `PLAYWRIGHT_CHROMIUM_ICU_DATA_UNAVAILABLE` 被正式裁定为 `REJECTED_PRE_DIAGNOSTIC`。此前 Source/Integration Phase 6 的 `387/387` 与 E2E `26/26` 继续作为有效局部工程证据，但不构成 C04 admission、正式 RC 或 Gate 通过。
- C04 的 P07 已消费；P08 与 D16–D20 因 attempt failure 被连带消费且不得补跑。`CM01=UNALLOCATED`、`output_ref=UNSET`。
- C05 只完成 plan-only 发布：`plan_ref=8eff11ea4b5b9c6b017c690610d16a0574503300`。X5 可执行合同尚未通过零 finding 复审，也未发布；`C05/S5/I5/E5=UNSET`，P09/P10/D21–D25 未分配、未开始。
- `C05_CODEX_VERSION_DIAGNOSTIC_EXTERNAL_EVIDENCE_PREAUTH_V3` 已完成其唯一独立 pre-run review，结论为 `P0=0 / P1=2 / P2=0 / FAIL`。没有运行 capture、没有创建 `c05-codex-version-diagnostic-03`；该 V3 plan/script 不得执行或原地修补。
- 后继 `C05_CODEX_VERSION_DIAGNOSTIC_EXTERNAL_EVIDENCE_PREAUTH_V4` 的唯一 pre-run review 亦以 `P0=0 / P1=3 / P2=0 / FAIL` 结束，固定 Node 24 的 `node --check` 被审查沙箱拒绝。没有运行 V4 正文或创建 `c05-codex-version-diagnostic-04`；V4 plan/script 同样冻结为失败提案。
- 当前没有可启动正式样本的 RC 或 cohort manifest，统一结论为 `NOT_READY_FORMAL_COHORT`。GitHub #50–#53 的 CM01、独立复核、seal 与正式 cohort 工作均未满足前置条件。
- React + TypeScript + Vite 是 Gate 1 实施介质；Node `v24.18.0` 已在 `/opt/homebrew/opt/node@24/bin/` 验证并由 `.node-version` 固定，实施 shell 仍需优先使用该路径。
- Gate 1H 真人运营时间暂不排期。地图 H1 本轮已完成样本收集与正式裁定：`MH01=2 PASS / 32 FAIL`、经审计化行政纠正归入的`MH03=2 / 32`、替补`MH04=5 / 29`，三场均为`SESSION_FINDING`；`MH02`保持无效缺口，原误标`MH05`仅作作废审计证据。冻结校验器给出`RESULTS_VALID / MAP_H1_REVIEW_FAIL`；不得局部补答或追加本包样本，必须退回地图设计与视觉验证、生成新包并使用新的fresh真人。完整玩法 Gate 1H 仍为`PENDING`，Gate 2、地图运行时和生产素材继续锁定。
- Gate 2 仍为 `LOCKED`；只有 Gate 1H 获得真人 `PASS` 后才允许编写 Gate 2 规格，不提前实现主题、NPC、排名或豁免。
- Godot `ENGINE_EVALUATION_E0` / `ENGINE_GATE` 计划已形成 `PROPOSED_NOT_AUTHORIZED` 文档：只拟议 3–5 个净工作日、无插件、合成数据、默认废弃的技术评估。尚未创建或运行 E0 工程，`ENGINE_GATE=NOT_RUN`，Godot production foundation 仍未授权；该计划不改变 React/TypeScript 权威、C04/C05 或任何玩法/地图 Gate。

## Authority Order

发生状态冲突时，按以下顺序判断当前执行许可：

1. Owner 对精确 blob/hash/ref 的最新授权；
2. GitHub #58 的最新登记评论与已推送远端 ref；
3. `docs/exec-plans/evidence/2026-07-31-current-project-status.md`；
4. 本文件与 `PLANS.md`；
5. 旧 RC/C04 审计、历史计划和技术试玩记录。

局部 `PASS`、静态 `REVIEW_PASS`、agent 试玩或准备包均不得越级改写正式 RC、Gate 1A、Gate 1H 或 Gate 2 状态。
