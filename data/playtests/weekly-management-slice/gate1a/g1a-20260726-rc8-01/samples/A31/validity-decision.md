# A31 有效性最终裁定

## 结论

`VALIDITY=VALID_COMPLETE_CAPTURE_AND_PROTOCOL_COMPLIANCE_AFTER_HANDOFF_RECONCILIATION`

- 主样本编号：`A31`
- Issue：#33
- cohort：`g1a-20260726-rc8-01`
- Batch：`Batch 1`
- 纳入当前七个有效样本分母
- 当前正式计数：`1/7 valid`
- A31 编号永久保留，不复用

## 交接对账

交接摘要曾把 A31 描述为“paused”，且当前 collaboration tree 一度看不到
A31 player，因此仅凭当时可见证据曾给出
`INVALID_TECHNICAL_UNAUTHORIZED_OR_UNATTRIBUTED_SESSION`。随后共享工作树出现
本地提交 `3fdbc2fad583c84d47514e4b8b1a7ec33f47c5d7`，补齐：

- 独立 player task `/root/gate1a_a31`；
- `fork_turns=none` 和冻结玩家包 V6；
- 首次操作前 `INITIAL_OBSERVATION`；
- 两周完整动作和同一 Session；
- host 中断期间同页冻结、未刷新、未重开、未改状态；
- host 恢复后只重试原终局保存；
- 服务端三件套与浏览器下载逐字节一致；
- 保存后清空与统一访谈 V4。

A31 的机器区间为 `2026-07-26T16:12:09.332Z–16:19:00.884Z`，A30/M-C
最晚于 `16:04:19.103Z` 结束，不存在应用会话重叠。未知 PID `57755` 可合理
归因于旧运营流程恢复仍在等待保存的同一 A31 场次。

因此先前临时无效裁定的事实前提已被新证据推翻，现由独立测试运营负责人
正式 supersede 为 `VALID`。“paused”是交接可见性缺口，不足以推翻干净上下文
与同场连续性。

## 协议核验

- agent 使用 `fork_turns=none` 的全新上下文；
- 只收到冻结玩家包 V6 和自己的编号，未读取仓库、Issue、设计、阈值或 A30；
- 只通过 `1440×900` 浏览器玩家界面操作；
- 首次操作前保留 `INITIAL_OBSERVATION`；
- RC SHA、build、artifact、场景、种子和初态均与 RC8 manifest 一致；
- 完成两周，终局 tick 为 `2010`，`isComplete=true`，有两份连续 recap；
- 唯一 `export-created`，不存在 `blocked-capture-created`；
- 服务端 raw、SHA sidecar、canonical receipt 与浏览器下载的 64,904 bytes
  和 SHA-256 `c6f1ca46…` 完全一致；
- 保存成功后清空，并回到“开始匿名新会话”；
- 结束访谈只在保存、浏览器下载与清空均核验后发放。

## host 技术中断

两周完成后，原 4197 loopback host 异常退出，A31 的前两次保存显示
`Failed to fetch`。A31 没有清空、刷新、重开或改变任何游戏状态。恢复完全
相同的冻结 host 后，A31 只重试原终局保存；同一 Session 成功生成可验证三件套
和浏览器下载。

中断发生在所有玩法决策结束后，没有重玩、策略干预或不可验证状态，故不构成
技术无效。记录为 `A31-TECH-01`。

## 编辑裁定与产品症状

机器导出将四个 candidate edit 全计入第一周，显示 `4 / 0`。其中
`action-0008` 位于 `week-1-ended` 和 `CONTINUE_TO_NEXT_WEEK` 之后，目标为
第 8 日 `qiao-pan:d7:b2`，agent 访谈确认是第二周维修块。因此运营裁定有效
编辑为 Week 1=`3`、Week 2=`1`，并登记
`A31-SYM-01 / CANDIDATE_EDIT_WEEK_ATTRIBUTION_AT_BOUNDARY`，单场建议 P2。

## 代理指标原始值

- 完成两周：是；
- 首次观察识别问题数：2；访谈整体能复述 3 个问题；
- 可见预测变化及原因：是；
- 人物与决策影响：是，林禾；
- 地图进入决策并执行动作：是；
- 第二周完整检查：否；
- 第二周完整重排：否。

上述是单场原始值，不提前计算 Gate 1A 最终结论。

## 状态边界

- `Gate 1A=IN_PROGRESS_1_OF_7_VALID_A37_PENDING`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`

## Post-seal aggregate adjudication

`2026-07-26T18:52:21Z`，聚合审计者 `/root` 依据玩家测试协议 §8.1 复核 raw
动作。机器原始候选计数保持 `4/0`；最终人工有效编辑为：

- Week 1：`action-0001`、`action-0002`、`action-0003`，共 `3`；
- Week 2：`action-0007`、`action-0008`，共 `2`。

`action-0007 / RESOLVE_LIN_HE_REQUEST` 改变第 8 日人物活动，产生可见供需与
人物后果并进入确认计划，故应计为有效编辑。聚合归入
`REQUEST_ACTION_CANDIDATE_CLASSIFICATION` 的 request omission P1；同时
`action-0008` 的错周归属归入 `WEEK_BOUNDARY_PHASE_AT_TICK_1002` 的
week-attribution P1。历史字段、`1/7` 快照和原 adjudicator 保留；
`VALID` 不变。
