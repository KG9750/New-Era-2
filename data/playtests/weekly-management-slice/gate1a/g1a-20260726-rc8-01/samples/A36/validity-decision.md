# A36 有效性裁定

## 结论

`VALIDITY=VALID_COMPLETE_CAPTURE_AND_PROTOCOL_COMPLIANCE`

- 主样本编号：`A36`
- Issue：#38
- cohort：`g1a-20260726-rc8-01`
- Batch：`Batch 3`
- 纳入当前七个有效样本分母
- 当前正式计数：`6/7 valid`
- A36 编号永久保留，不复用

## 协议核验

- agent 使用 `fork_turns=none` 的全新上下文；
- 未收到前序样本结果、已知缺陷或 Gate 阈值；
- 首次操作前保留 `INITIAL_OBSERVATION`；
- RC SHA、build、artifact、场景、种子和初态与 RC8 manifest 一致；
- 完成两周，tick `2010`、`isComplete=true`、两份 recap；
- 服务端 raw、SHA sidecar、canonical receipt 与浏览器下载均为 62,752 bytes，
  SHA-256 `a8e5250e4de3b6737c2de560296f9e0bb00de3c21607b34f0f79d63920f97a2d`，
  `cmp` 逐字节一致；
- 单次保存成功，保存与下载核验后清空，清空后才发 V4。

## 编辑裁定

- Week 1：`2`，`action-0001` 补足第 2 个水泵检修块，`action-0002`
  开启南侧短通路；
- Week 2：`0`。

机器计数与运营裁定一致，无需 override。

## 症状

`A36-SYM-01 / WEEK2_PRESTART_TIME_LABEL_TRANSITION`

第二周页面已经切换，但开始运行前时钟仍显示“周日 23:00”，运行后进入连续
日序。它与 A33、A34 同根因，是第三个有效独立复现，因此聚类确认为
`CONFIRMED_SYSTEMATIC_P2`。三场均未造成阻断、误判、错误操作、数据损坏或
保存失败，严重度仍为 P2，不上调 P1；三个 P2 复现不触发“三个独立 P1”
根因聚类规则。

## 代理指标原始值

- 完成两周：是；
- 首次观察识别问题数：2；访谈整体能复述 3 个问题；
- 可见预测变化及原因：是；
- 人物与决策影响：是，林禾；
- 地图进入决策：是；地图动作执行：是；
- 第二周展开完整周计划：否；
- 第二周逐格完整检查：否；
- 第二周完整重排：否。

上述是单场原始值，不提前计算 Gate 1A 最终结论。

## 状态边界

- `Gate 1A=RUNNING_6_OF_7_VALID_A37_PENDING`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
