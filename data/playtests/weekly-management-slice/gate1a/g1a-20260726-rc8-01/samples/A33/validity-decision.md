# A33 有效性裁定

## 结论

`VALIDITY=VALID_COMPLETE_CAPTURE_AND_PROTOCOL_COMPLIANCE`

- 主样本编号：`A33`
- Issue：#35
- cohort：`g1a-20260726-rc8-01`
- Batch：`Batch 2`
- 纳入当前七个有效样本分母
- 当前正式计数：`3/7 valid`
- A33 编号永久保留，不复用

## 协议核验

- agent 使用 `fork_turns=none` 的全新上下文；
- 未收到前序样本结果、已知缺陷或 Gate 阈值；
- 首次操作前保留 `INITIAL_OBSERVATION`；
- RC SHA、build、artifact、场景、种子和初态与 RC8 manifest 一致；
- 完成两周，tick `2010`、`isComplete=true`、两份 recap；
- 服务端 raw、SHA sidecar、canonical receipt 与浏览器下载均为 62,493 bytes，
  SHA-256 `d8f1130f977020eab71a49eda3b69b18461eeacf2a0db1c69d28ecb78f09a7d9`，
  `cmp` 逐字节一致；
- 单次保存成功，保存与下载核验后清空，清空后才发 V4。

## 编辑裁定

- Week 1：`1`，`action-0001` 补足第 2 个水泵检修块；
- Week 2：`0`；
- 接受学习请求和使用化肥是有效经营决策，但不是候选日程编辑。

## 症状

`A33-SYM-01 / WEEK2_PRESTART_TIME_LABEL_TRANSITION`

第二周标题已切换，但开始运行前时钟仍显示“周日 23:00”，运行后跳为
“第 9 日 03:00”。本场建议 P2；未影响决策、两周完成、保存或清空，尚不
构成独立 P1。

## 代理指标原始值

- 完成两周：是；
- 首次观察识别问题数：2；访谈整体能复述 3 个问题；
- 可见预测变化及原因：是；
- 人物与决策影响：是，林禾；
- 地图进入决策：是；地图动作执行：否；
- 第二周完整检查：否；
- 第二周完整重排：否。

上述是单场原始值，不提前计算 Gate 1A 最终结论。

## 状态边界

- `Gate 1A=RUNNING_3_OF_7_VALID_A37_PENDING`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
