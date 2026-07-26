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
- D0-A 的开发前提已 `READY`：双轨基线为 `2550617be5eff4226e9e140be741d619fcb6f5a3`；独立 agent `/root/gate1_test_coordinator`（Planck）担任测试运营负责人，Gate 1A 汇总为 #9。
- Gate 1 两周 RC5 已固定为 `refs/heads/codex/gate1-rc-20260726.5`，指向提交 `2d40aa102bd51107c07cbe176f798a93a37663f3`；artifact 为 `ec09284f9dfb7976356a510b1039092f85dc91dd6eb94e649ca138040431d65f`，cohort `g1a-20260726-rc5-01` 已取得双 reviewer 的 `P0=0 / P1=0 / P2=0 / RC_FREEZE=YES`。
- `g1a-20260726-rc2-01` 因玩家包诱导风险被否决；rc2-02 因 Vite 7 基线偏差被替代；rc3-01 因独立审查发现两项状态一致性 P1 被替代。三者均未产生正式样本。
- `M-A`–`M-C` 已完成且不进入正式分母；#7 已在 RC5 独立复核通过后关闭。
- RC4 已永久作废：A01 完成两周、导出回执和清空，但匿名 JSON 不可核验，按冻结规则判为 `INVALID_TECHNICAL` 并永久保留；A02–A08 均不迁入 RC5。
- TECH-P98 已完成真实 Chrome loopback capture 技术验证，服务端 raw、SHA sidecar、receipt 与浏览器下载一致；`P98` 永久保留为技术编号，不得分配给 Gate 1H 真人。
- Gate 1A 当前为 `READY_NOT_STARTED`：正式样本 A09–A15 对应 #18–#24，按 `A09–A11 / A12–A14 / A15` 执行，替补从 A16 开始；七个正式 player agent 会话尚未创建。
- React + TypeScript + Vite 是 Gate 1 实施介质；Node `v24.18.0` 已在 `/opt/homebrew/opt/node@24/bin/` 验证并由 `.node-version` 固定，实施 shell 仍需优先使用该路径。
- Gate 1 当前估算为 15–18 个净开发工作日；D0、里程碑代理试玩、正式 Gate 1A 运营和报告时间另计，Gate 1H 真人运营时间暂不排期。
- Gate 2 仍为 `LOCKED`；只有 Gate 1H 获得真人 `PASS` 后才允许编写 Gate 2 规格，不提前实现主题、NPC、排名或豁免。
- 人物规则 V0.1-r8 已通过 Codex 独立终审；首个固定种子生成内核和 50 人候选库属于 `TECHNICAL_SPIKE_BEFORE_A1`。首次整改复审的 `P1=2 / P2=1` 已按 v0.1.2 逐项落地，聚合结果只覆盖 `TECHNICAL_CHARACTER_LIBRARY_IMPLEMENTED_CONTRACTS_ONLY`；完整 M12、文化命名与 E01–E06 人工内容审核均未执行，状态保持 `CANDIDATE_NOT_FROZEN`，不代表阶段 B/C 完成，也不接入 Gate 1 RC。当前代码仍需新的独立复审，不提前宣称门禁通过。
