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
- Gate 1 采用双轨：Gate 1A 已授权使用 7 个独立 agent 样本，Gate 1H=`PENDING`、真人验证暂缓；Gate 1A 不能替代 Gate 1H，也不能解锁 Gate 2。
- D0-A 的开发前提已 `READY`：双轨基线为 `2550617be5eff4226e9e140be741d619fcb6f5a3`；根 agent `/root` 执行样本调度与证据保存，独立 agent `/root/gate1a_test_ops_lead` 负责有效性和最终汇总裁定，Gate 1A 汇总为 #9。
- Gate 1 两周 RC8 已固定为 `refs/heads/codex/gate1-rc-20260726.8`，指向提交 `03973fcfc0c244555e7e4a4c623eec3fb8b8e032`；artifact 为 `e0cf7c78251642a54f88845c61aa214e9e91076b3e432fb8399bd873ef0fe49b`。cohort `g1a-20260726-rc8-01` 已取得独立 `P0=0 / P1=0 / P2=0 / RC_FREEZE=YES`。
- `g1a-20260726-rc2-01` 因玩家包诱导风险被否决；rc2-02 因 Vite 7 基线偏差被替代；rc3-01 因独立审查发现两项状态一致性 P1 被替代。三者均未产生正式样本。
- `M-A`–`M-C` 里程碑试玩已完成且不进入正式分母；RC8 独立冻结复核证据已形成，#7 已关闭。
- RC4 已永久作废：A01 完成两周、导出回执和清空，但匿名 JSON 不可核验，按冻结规则判为 `INVALID_TECHNICAL` 并永久保留；A02–A08 均不迁入 RC5。
- TECH-P98 已完成真实 Chrome loopback capture 技术验证，服务端 raw、SHA sidecar、receipt 与浏览器下载一致；`P98` 永久保留为技术编号，不得分配给 Gate 1H 真人。
- RC5 因无法保存中途产品阻断的三件套而撤回开跑许可：A09 固定为 `SUPERSEDED_RC_REVOKED_AFTER_SESSION` 并排除，A10–A15 未启动，#18–#24 已历史化。
- RC6 因拒绝 `tick=2010 / isComplete=false` 的合法终局阻断而作废：A16–A22 未启动，#25–#31 已历史化，编号不复用。
- RC7 因冻结 tar 的 UTC 配方不一致及随后出现的第二周化肥证据修复而预启动作废：A23–A29 未创建 Issue、未启动 player agent，编号不复用。
- Gate 1A RC8 最终结论为 `AGENT_PROXY_FAIL`：post-seal provenance 确认正式 A30 与 M-C 来自两个 agent，A30 capture 可归属，但同 host 重叠 `119,458 ms` 仍违反串行隔离合同，故 A30 保持技术无效，A37 完成替补；A31–A37 共七个有效样本全部完成两周、导出和清空。按协议 §8.1 补计七场人物请求动作后，Week 1 / Week 2 有效编辑数组为 `3,1,1,2,3,2,2` / `2,1,1,2,2,1,1`，中位数 `2 / 1`，仍同时低于目标 `3–5` 且超出 conditional 范围。聚合问题为 `P0=0 / P1=2 / P2=1`：`REQUEST_ACTION_CANDIDATE_CLASSIFICATION` 包含影响 A31–A37 的 request omission P1；`WEEK_BOUNDARY_PHASE_AT_TICK_1002` 包含影响 A31/A34/A35 的 week-attribution P1，以及影响 A32/A33/A34/A36/A37 的 systematic prestart-label P2。完整报告见 RC8 cohort 的 `gate1a-final-report.md`。
- RC9 是 RC8 失败后获准的“责任承诺模型”受控转向，与原有效编辑指标不可直接同比；基础修复与 C01–C03 历史 attempts 已完成，但尚无 candidate 获准进入 CMxx。原 remediation plan 仍是上位历史合同；当前执行入口见下一条 C04 恢复计划。正式样本仍预留 A38–A44 与 A45/A46 替补；RC8 证据与失败结论保持只读。
- RC9 C01 因 D02 重启同一诊断编号被拒绝；C02 因 W1/W2 人工 v2 中位数均为 `2` 被拒绝；C03 虽达到原诊断数值门槛，但在 freeze preparation 因 manifest verifier 仍硬编码 v0.2/`0.5.0`，且 D15 的 standalone Codex CLI 未获场前合同授权，最终以 `REJECTED_FREEZE_PREPARATION` 拒绝。C01–C03、P01–P06、D01–D15 永久只读，`CM01` 未创建、未分配、未消耗。当前权威入口为 `docs/exec-plans/active/2026-07-29-gate1a-rc9-c04-recovery-plan.md`，当前 `plan_ref=441f7d96635e9176c8aea3ff21454d596c287c49`，并 supersede `52eb452a5ffec167a3809d3f372e62b9d8524124`；更早父权威只保留为历史版本限定。C04 只修复 versioned manifest authority、真实 hash 复算、预授权的 `standalone-codex-cli-v2` 隔离证据、Node 24 wrapper defect 及第三次 amendment 精确授权的 integration-safe test-context defect；P07/P08、D16–D20 与 CM01 仍未获授权。
- C04 standalone CLI 唯一 binary 为 `/Applications/ChatGPT.app/Contents/Resources/codex`，版本 `codex-cli 0.146.0-alpha.3.1`，SHA-256 `6d8be49e49751554df16572369e636cbe02c84b208cad3dc35528c846eeca223`，codesign `TeamIdentifier=2DC432GLL2`、`Authority=Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)`。Node identity 固定为 `/opt/homebrew/opt/node@24/bin/node`、`v24.18.0`、SHA-256 `72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f`；不得改用 PATH 解析出的其他 binary。
- C04 isolation grammar amendment 已由 discovery、recapture v3 与 external review receipt 三组不可变 artifact pair 冻结；grammar ID 为 `codex-0.146.0-alpha.3.1-persisted-rollout-v2` / `codex-0.146.0-alpha.3.1-exec-events-v2`。该 receipt 的 `PASS` 只授权 grammar 迁移，不代表 C04、Gate 1A 或 Gate 1H 已通过。
- C04 首次 integration Phase 6 A01 因 manifest fixtures 的 repo-relative output 被错误解析到 `prototype/data/**` 而 fail-closed；provisional I `3cc6de4f6c8458f51936a893b95ea08e62bb0883` 与 preservation `bbda54826dc529ad3b93c55c4fd164463c842401` 永久排除。A02 在 failed I `b027ad8019d8fa46eaf7596c40eb28f470cc8c06` 首项 lint 因 wrapper 解析到损坏的 Node 25，以 exit `134` 失败；preservation 为 `6752c3b4f73a17fadcfc2420c9b9c6ededeeceb9`，失败评论为 `5119276886`，`phase6-retry-01/lint.txt` 固定为 `720` bytes / `3` lines / SHA-256 `331c2275772bed740553fd3f886b533e537138d0a671f1cb1931bf2d9c12fd61`。A01/A02 namespace 均永久只读；第二次 amendment 唯一新 integration root 为 create-new `evidence/phase6-retry-02/**`，且不授权 P07/P08、D16–D20、CM01 或任何 Gate。
- C04 A03 在 failed I `4d93ea5aa42bf6fb34fa0109c6bc66af82145b50` 的 retry-02 依次完成 lint、test 后以 Vitest `381/387` fail-closed；preservation 为 `09c3b88ee0f9092788a974c95c4aec01de09df2e`，失败评论为 `5123668371`。retry-02 仅含 `lint.txt` 与 `test.txt`，永久只读并排除最终 lineage。第三次 amendment 只允许在新 I 完成未消耗 authority 的 Node 24 lint + `387/387` 预检后启动一次字面量 `phase6-retry-03`；失败即停止，禁止 retry-04。
- React + TypeScript + Vite 是 Gate 1 实施介质；Node `v24.18.0` 已由 `.node-version` 固定，实施 shell 必须使用 `/opt/homebrew/opt/node@24/bin`。
- Gate 1 当前估算为 15–18 个净开发工作日；D0、里程碑代理试玩、正式 Gate 1A 运营和报告时间另计，Gate 1H 真人运营时间暂不排期。
- Gate 2 仍为 `LOCKED`；只有 Gate 1H 获得真人 `PASS` 后才允许编写 Gate 2 规格，不提前实现主题、NPC、排名或豁免。
