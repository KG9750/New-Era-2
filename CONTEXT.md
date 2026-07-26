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
- D0-A 的开发前提已 `READY`：双轨基线为 `2550617be5eff4226e9e140be741d619fcb6f5a3`；根 agent `/root` 执行样本调度与证据保存，独立 agent `/root/gate1a_test_ops_lead` 负责有效性和最终汇总裁定，Gate 1A 汇总为 #9。
- Gate 1 两周 RC8 已固定为 `refs/heads/codex/gate1-rc-20260726.8`，指向提交 `03973fcfc0c244555e7e4a4c623eec3fb8b8e032`；artifact 为 `e0cf7c78251642a54f88845c61aa214e9e91076b3e432fb8399bd873ef0fe49b`。cohort `g1a-20260726-rc8-01` 已取得独立 `P0=0 / P1=0 / P2=0 / RC_FREEZE=YES`。
- `g1a-20260726-rc2-01` 因玩家包诱导风险被否决；rc2-02 因 Vite 7 基线偏差被替代；rc3-01 因独立审查发现两项状态一致性 P1 被替代。三者均未产生正式样本。
- `M-A`–`M-C` 里程碑试玩已完成且不进入正式分母；RC8 独立冻结复核证据已形成，#7 已关闭。
- RC4 已永久作废：A01 完成两周、导出回执和清空，但匿名 JSON 不可核验，按冻结规则判为 `INVALID_TECHNICAL` 并永久保留；A02–A08 均不迁入 RC5。
- TECH-P98 已完成真实 Chrome loopback capture 技术验证，服务端 raw、SHA sidecar、receipt 与浏览器下载一致；`P98` 永久保留为技术编号，不得分配给 Gate 1H 真人。
- RC5 因无法保存中途产品阻断的三件套而撤回开跑许可：A09 固定为 `SUPERSEDED_RC_REVOKED_AFTER_SESSION` 并排除，A10–A15 未启动，#18–#24 已历史化。
- RC6 因拒绝 `tick=2010 / isComplete=false` 的合法终局阻断而作废：A16–A22 未启动，#25–#31 已历史化，编号不复用。
- RC7 因冻结 tar 的 UTC 配方不一致及随后出现的第二周化肥证据修复而预启动作废：A23–A29 未创建 Issue、未启动 player agent，编号不复用。
- Gate 1A RC8 最终结论为 `AGENT_PROXY_FAIL`：A30 因并发 A30/M-C 身份污染而技术无效，A37 完成对 A30 的替补；A31–A37 共七个有效样本全部完成两周、导出和清空。流程与因果指标通过，但 Week 1 / Week 2 有效编辑中位数为 `2 / 0`，同时低于冻结目标 `3–5`，且超出 conditional 范围。A33、A34、A36、A37 四个有效独立样本还确认系统性 P2 `WEEK2_PRESTART_TIME_LABEL_TRANSITION`；完整报告见 RC8 cohort 的 `gate1a-final-report.md`。
- React + TypeScript + Vite 是 Gate 1 实施介质；Node `v24.18.0` 已在 `/opt/homebrew/opt/node@24/bin/` 验证并由 `.node-version` 固定，实施 shell 仍需优先使用该路径。
- Gate 1 当前估算为 15–18 个净开发工作日；D0、里程碑代理试玩、正式 Gate 1A 运营和报告时间另计，Gate 1H 真人运营时间暂不排期。
- Gate 2 仍为 `LOCKED`；只有 Gate 1H 获得真人 `PASS` 后才允许编写 Gate 2 规格，不提前实现主题、NPC、排名或豁免。
