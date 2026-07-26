# A35 有效性裁定

## 结论

`VALIDITY=VALID_COMPLETE_CAPTURE_AND_PROTOCOL_COMPLIANCE`

- 主样本编号：`A35`
- Issue：#37
- cohort：`g1a-20260726-rc8-01`
- Batch：`Batch 2`
- 纳入当前七个有效样本分母
- 当前正式计数：`5/7 valid`
- A35 编号永久保留，不复用

## 协议核验

- agent 使用 `fork_turns=none` 的全新上下文；
- 未收到前序样本结果、已知缺陷或 Gate 阈值；
- 首次操作前保留 `INITIAL_OBSERVATION`；
- RC SHA、build、artifact、场景、种子和初态与 RC8 manifest 一致；
- 完成两周，tick `2010`、`isComplete=true`、两份 recap；
- 服务端 raw、SHA sidecar、canonical receipt 与浏览器下载均为 64,903 bytes，
  SHA-256 `4c676f24c2c576494ccb3e7f80fdca3cab1f0af4044e2e9d5861208d51270b7b`，
  `cmp` 逐字节一致；
- 单次保存成功，保存与下载核验后清空，清空后才发 V4。

## 编辑裁定

- Week 1：`3`，`action-0001` 补足第 2 个水泵检修块，`action-0002`
  开启南侧短通路，`action-0003` 将乔磐第 1 日 B4 改为维修；
- Week 2：`1`，`action-0008` 将乔磐第 8 日 B4 改为维修。

机器将 `action-0008` 归入 Week 1，导致导出计数 `4/0`。该动作发生在
`CONTINUE_TO_NEXT_WEEK` 之后，且目标是第 8 日格子
`qiao-pan:d7:b3`，运营裁定覆盖为 Week 2，最终有效编辑数为 `3/1`。

## 症状

`A35-SYM-01 / CANDIDATE_EDIT_WEEK_ATTRIBUTION_AT_BOUNDARY`

换周后 tick 仍为 1002，导致第 8 日编辑被机器归入 Week 1。本场通过动作顺序
与目标格完成运营 override；这是继 A31、A34 后第三个有效独立复现，聚类确认
为系统性 P2，不影响玩法完成或样本有效性。

A35 未报告 `WEEK2_PRESTART_TIME_LABEL_TRANSITION`，不增加该聚类的独立
样本数。

## 代理指标原始值

- 完成两周：是；
- 首次观察识别问题数：2；访谈整体能复述 3 个问题；
- 可见预测变化及原因：是；
- 人物与决策影响：是，乔磐；
- 地图进入决策：是；地图动作执行：是；
- 第二周展开完整周计划：是；
- 第二周逐格完整检查：否；
- 第二周完整重排：否。

上述是单场原始值，不提前计算 Gate 1A 最终结论。

## 状态边界

- `Gate 1A=RUNNING_5_OF_7_VALID_A37_PENDING`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`

## Post-seal aggregate adjudication

`2026-07-26T18:52:21Z`，聚合审计者 `/root` 依据玩家测试协议 §8.1 复核 raw
动作。机器原始候选计数保持 `4/0`；最终人工有效编辑为：

- Week 1：`action-0001`、`action-0002`、`action-0003`，共 `3`；
- Week 2：`action-0007`、`action-0008`，共 `2`。

`action-0007 / RESOLVE_LIN_HE_REQUEST` 应计为有效编辑，归入
`REQUEST_ACTION_CANDIDATE_CLASSIFICATION` 的 request omission P1；
`action-0008` 的错周归属归入 `WEEK_BOUNDARY_PHASE_AT_TICK_1002` 的
week-attribution P1。历史字段、`5/7` 快照和原 adjudicator 保留；
`VALID` 不变。
