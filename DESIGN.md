# Design

Design and product-experience entrypoint for `Project-004-New Era 2`.

## Read Order

1. `docs/design-docs/index.md`
2. `docs/design-docs/concept-design-v0.4.md` — 概念设计 V0.4（当前主线）
3. `docs/design-docs/map-style-and-tile-topology-v0.1.md` — 地图风格与方格拓扑设计 V0.1（静态规格独立复审通过）
4. `docs/design-docs/map-visual-spike-v0.1.md` — “断网地景”隔离视觉 Spike V0.1（agent视觉QA通过，等待用户确认）
5. `docs/design-docs/map-material-and-facility-spike-v0.1.md` — 材质、设施轮廓与真实atlas拼接样片（隔离视觉验证）
6. `docs/design-docs/map-visual-language-production-roadmap-v0.1.md` — 视觉语言、三尺度、生产manifest与阶段决策门（独立审查修正版）
7. `docs/design-docs/map-three-scale-readability-contract-v0.1.md` — D1–D4三尺度、区域、地标、设施与材质形态合同
8. `docs/design-docs/map-three-scale-readability-spike-v0.1.md` — V1单一母图、三档彩色/灰度派生与Agent视觉QA
9. `docs/design-docs/map-h1-failure-analysis-and-v2-revision-plan-v0.1.md` — 旧 H1 正式失败分析与 V2 最小修订计划
10. `docs/design-docs/map-h1-v2-live-readability-contract-v0.1.md` — V2 并发可读性不可变 contract core（静态终审通过，未激活）
11. `docs/design-docs/map-h1-v2-activation-preflight-v0.1.md` — V2 激活外部证据缺口与可继续工作
12. `docs/design-docs/map-visual-exploration-protocol-v0.1.md` — ImageGen 等地图视觉探索的隔离、记录与禁止晋级协议（preflight 待实现，run 未授权）
13. `docs/design-docs/character-generation-rules-v0.1.md` — 人物角色生成规则
14. `docs/design-docs/character-generation-rules-v0.2-runtime-development-amendment.md` — 人物运行时发展修正案（当前仅设计）
15. `docs/design-docs/item-and-manufacturing-system-v0.1.md` — 物品、制造、维修与装备系统提案
16. `docs/design-docs/character-causal-event-and-reward-system-v0.1.md` — 人物因果事件与正向结算专项设计（当前仅设计）
17. `docs/design-docs/character-causal-event-e0-prospective-authoring-test-kit-v0.1.md` — 人物事件 E0 空白编写与桌面推演工具包 V0.1-r1（未编写内容、未运行）
18. `docs/design-docs/weekly-plan-production-forecast-slice-v0.1.md` — 两周经营验证切片规格
19. `docs/product-specs/weekly-management-slice-playtest-v0.1.md` — Gate 1 玩家测试协议
20. `docs/design-docs/concept-design-v0.3.md` — V0.3 历史稿
21. `docs/design-docs/concept-design-discussion-v0.1.md` — V0.1 历史讨论稿
22. Relevant product specs under `docs/product-specs/`
23. Feature-specific design notes

地图阶段治理优先修正案：`docs/design-docs/map-p0a-provisional-tooling-amendment-v0.1.md` — 旧 H1 正式失败且 V2 未激活期间仍只授权 `P0A_PROVISIONAL_TOOLING`；此前无前缀 `P0` 统一解释为 `P0B_AUTHORITATIVE_FREEZE`。

## Notes

- 当前设计主线以概念设计 V0.4 为准；其中明确区分已确认规则、待原型验证假设与专项待办。
- 当前执行先验证两周纯经营切片；当前正式 cohort 尚未就绪，C04 已拒绝且 C05 尚未创建。在 Gate 1H 真人 `PASS` 前，不进入主题豁免、双战场或完整三个月开发。
- 地图 V0.1 当前为 `DESIGN_ONLY / SPEC_CLOSED / REVIEW_PASS / RUNTIME_LOCKED / HUMAN_TEST_OPEN`；通过只覆盖静态规格，110 个完整拓扑与29个首轮模板均未授权进入 Gate 1 RC。
- 地图视觉 Spike V0.1 当前为 `ISOLATED_VISUAL_SPIKE / AGENT_VISUAL_QA_PASS / HUMAN_REVIEW_OPEN / NOT_GATE_EVIDENCE`；style frame与atlas均未进入运行时。
- 地图材质与设施 Spike V0.1 已完成8个网络overlay的真实atlas拼接样片；两轮审查的法向/C1与双数据源P1均已逐项修正，最终独立终审为 `P0=0 / P1=0 / P2=0 / REVIEW_PASS`；当前仍为 `HUMAN_REVIEW_OPEN / MAP_RUNTIME_NOT_IMPLEMENTED / GATE_1_UNCHANGED`。
- 地图视觉语言与素材生产路线 V0.1 已将外部建议逐项修正：29/45保持隔离Spike口径，`256→47`只表示shape规范化；先做三尺度、区域、地标、设施与production manifest，再决定隔离生产pilot；最终独立复审为 `P0=0 / P1=0 / P2=0 / REVIEW_PASS`，编辑器和运行时继续独立defer。
- 地图三尺度V1-r3虽曾通过 agent 静态视觉复审，但后续旧 H1 真人包正式结果为 `9 PASS / 93 FAIL / 102`、`RESULTS_VALID / MAP_H1_REVIEW_FAIL`；该 source 与所有 pre-contract V2 候选均不得进入正式 V2。
- 旧地图 H1 包 `map-h1-20260731-v1-r3` 已完成 3 名有效 fresh 真人裁定（MH01、MH03、MH04），失败结果保持冻结；不得追加旧包样本、局部补测或复用旧参与者。Gameplay Gate 1H 仍 `PENDING`，Gate 2、地图 runtime 与 production asset 仍锁定。
- `MAP_H1_V2_LIVE_READABILITY` contract core 已完成多轮 fresh subagent 逐项修正，最终受审 SHA `a65a568a…46ead6`，终审 `P0=0 / P1=0 / P2=0 / REVIEW_PASS`；仅覆盖静态 core。`CONTRACT_ACTIVATION=NONE`，companion、可信 review receipt/inclusion、generation lineage、正式图像、manifest/package、视觉/truth 复审及真人场次均未完成或未授权。
- 地图视觉探索协议 V0.1 的初审、r1、r2 findings 已逐项关闭，第四名 fresh closure review 为 `P0=0 / P1=0 / P2=0 / REVIEW_PASS`；这只证明静态 pending 协议闭合。当前仍为 `EXPLORATION_PREFLIGHT_PENDING / EXPLORATION_RUNS_NOT_AUTHORIZED`，且现有 core 缺少 exposure denylist binding。未来输出仍固定为 `EXPLORATORY_ONLY / NO_FORMAL_LINEAGE / NOT_H1_STIMULUS / NOT_PRODUCTION_ASSET / NOT_GATE_EVIDENCE`。
- 地图 P0a 已以topology registry/golden、resolver、fixture manifest、manifest contract/CLI、25项测试和确定性validation report完成受限验证，当前仍为 `PARTIAL_FIXTURE_PASS / artifact_status=fixture_only / production_eligible=false / coverage_complete=false / P0B_NOT_AUTHORIZED / P1_NOT_AUTHORIZED / MAP_RUNTIME_LOCKED / GATE_UNCHANGED`；其旧 `H1_HUMAN_REVIEW_DEFERRED` 描述已被后续旧 H1 正式失败与 V2 未激活状态取代。详见 `docs/design-docs/map-p0a-provisional-tooling-amendment-v0.1.md` 与 `data/map/p0a/map-p0a-validation-report-v0.1.json`，这些 agent 与工具证据不能替代真人证据。
- 人物 V0.2 运行时发展修正案 amendment-6 当前为 `DESIGN_ONLY / SPEC_CLOSED / REVIEW_PASS / RUNTIME_LOCKED`；通过只覆盖静态联合规格。
- 物品与制造系统 V0.1 R1 已冻结为后续统一规则，但不授权扩大当前 Gate 1 实现范围。
- 人物因果事件与奖励系统 V0.1-r8 当前为 `DESIGN_ONLY / SPEC_CLOSED / REVIEW_PASS / RUNTIME_LOCKED`；不进入 Gate 1 运行时。
- 人物事件 E0 工具包 V0.1-r1 当前为 `DESIGN_ONLY / PROSPECTIVE_ONLY / CONTENT_NOT_AUTHORED / TABLETOP_NOT_RUN / RUNTIME_LOCKED`；只提供未来 E1 的空白证据工具。
- V0.4 尚未冻结为正式 GDD。
