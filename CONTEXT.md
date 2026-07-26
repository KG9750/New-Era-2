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
- D0-A 已 `READY`：双轨基线为 `2550617be5eff4226e9e140be741d619fcb6f5a3`，当前主 agent `/root` 担任测试运营负责人；Gate 1A 汇总为 #9，A01–A07 七个独立测试席位为 #10–#16。
- Gate 1 两周正式 RC 已固定为 `refs/heads/codex/gate1-rc-20260726.2`，指向提交 `eeaa5fe2c1b4cfd68d8be73ba26b463feeed08d6`；首个 cohort `g1a-20260726-rc2-01` 在开跑前因玩家包诱导风险被否决，未产生正式样本。
- 新 cohort `g1a-20260726-rc2-02` 采用“中性试玩包 → 完成并清空 → 统一结束访谈”的两阶段协议，manifest 与 detached archive 已重新冻结。
- #2–#6 与 `M-A`–`M-C` 已完成；#7 的代码候选和技术证据已经齐备。A01–A07 仍须等待独立冻结复核给出 `RC_FREEZE=YES`，随后只按 `3 + 3 + 1` 分批实例化。
- React + TypeScript + Vite 是 Gate 1 实施介质；Node `v24.18.0` 已在 `/opt/homebrew/opt/node@24/bin/` 验证并由 `.node-version` 固定，实施 shell 仍需优先使用该路径。
- Gate 1 当前估算为 15–18 个净开发工作日；D0、里程碑代理试玩、正式 Gate 1A 运营和报告时间另计，Gate 1H 真人运营时间暂不排期。
- Gate 2 仍为 `LOCKED`；只有 Gate 1H 获得真人 `PASS` 后才允许编写 Gate 2 规格，不提前实现主题、NPC、排名或豁免。
