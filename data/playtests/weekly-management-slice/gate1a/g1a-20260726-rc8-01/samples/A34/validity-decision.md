# A34 有效性裁定

## 结论

`VALIDITY=VALID_COMPLETE_CAPTURE_AND_PROTOCOL_COMPLIANCE`

- 主样本编号：`A34`
- Issue：#36
- cohort：`g1a-20260726-rc8-01`
- Batch：`Batch 2`
- 纳入当前七个有效样本分母
- 当前正式计数：`4/7 valid`
- A34 编号永久保留，不复用

## 协议核验

- agent 使用 `fork_turns=none` 的全新上下文；
- 未收到前序样本结果、已知缺陷或 Gate 阈值；
- 首次操作前保留 `INITIAL_OBSERVATION`；
- RC SHA、build、artifact、场景、种子和初态与 RC8 manifest 一致；
- 完成两周，tick `2010`、`isComplete=true`、两份 recap；
- 服务端 raw、SHA sidecar、canonical receipt 与浏览器下载均为 64,483 bytes，
  SHA-256 `ae6a42443270c17fe92cbdcd85384ff7ee58a3e7d7c234b36196273ece101115`，
  `cmp` 逐字节一致；
- 单次保存成功，保存与下载核验后清空，清空后才发 V4。

## 编辑裁定

- Week 1：`2`，`action-0001` 补足第 2 个水泵检修块，`action-0002`
  开启南侧短通路；
- Week 2：`1`，`action-0008` 将乔磐第 8 日 B3 从休息改为维修。

机器将 `action-0008` 归入 Week 1，导致导出计数 `3/0`。该动作发生在
`CONTINUE_TO_NEXT_WEEK` 之后，且目标是第 8 日格子
`qiao-pan:d7:b2`，运营裁定覆盖为 Week 2，最终有效编辑数为 `2/1`。

## 症状

`A34-SYM-01 / WEEK2_PRESTART_TIME_LABEL_TRANSITION`

第二周页面已经切换，但开始运行前时钟仍显示“周日 23:00”，运行后正常进入
第 8–14 日。它与 A33 为同根因的第二个独立复现；两场均未造成阻断、误判或
错误操作，当前仍建议 P2，不构成独立 P1。

`A34-SYM-02 / CANDIDATE_EDIT_WEEK_ATTRIBUTION_AT_BOUNDARY`

换周后 tick 仍为 1002，导致第 8 日编辑被机器归入 Week 1。本场通过动作顺序
与目标格完成运营 override；这是继 A31 后第二个有效独立复现，建议 P2，不
影响玩法完成或样本有效性。

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

- `Gate 1A=RUNNING_4_OF_7_VALID_A37_PENDING`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
