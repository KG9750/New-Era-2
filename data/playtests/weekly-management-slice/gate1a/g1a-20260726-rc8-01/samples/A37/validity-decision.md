# A37 有效性裁定

## 结论

`VALIDITY=VALID_COMPLETE_CAPTURE_AND_PROTOCOL_COMPLIANCE`

- 替补样本编号：`A37`
- 替补对象：`A30`
- Issue：#39
- cohort：`g1a-20260726-rc8-01`
- 纳入当前七个有效样本分母
- 当前正式计数：`7/7 valid`
- A37 编号永久保留，不复用

## 协议核验

- agent 使用 `fork_turns=none` 的全新上下文；
- 未收到前序样本结果、已知缺陷或 Gate 阈值；
- 首次操作前保留 `INITIAL_OBSERVATION`；
- RC SHA、build、artifact、场景、种子和初态与 RC8 manifest 一致；
- 完成两周，tick `2010`、`isComplete=true`、两份 recap；
- 服务端 raw、SHA sidecar、canonical receipt 与浏览器下载均为 63,485 bytes，
  SHA-256 `7fc68d63d0691499022fe93ee1fe31ec070d8ea8cc86999451b5f01afe7107a1`，
  `cmp` 逐字节一致；
- 单次保存成功，保存与下载核验后清空，清空后才发 V4。

## 编辑裁定

- Week 1：`2`，`action-0001` 补足第 2 个水泵检修块，`action-0002`
  开启南侧短通路；
- Week 2：`0`。

机器计数与运营裁定一致，无需 override。接受人物请求和使用化肥是经营决策，
但不是候选日程编辑。

## 症状

`A37-SYM-01 / WEEK2_PRESTART_TIME_LABEL_TRANSITION`

第二周页面已经切换，但暂停时钟仍显示“周日 23:00”，运行后进入第 8 日。它
与 A33、A34、A36 同根因，是第四个有效独立复现。聚类维持
`CONFIRMED_SYSTEMATIC_P2`；四场均未造成阻断、误判、错误操作、数据损坏或
保存失败，不上调 P1，也不触发“三个独立 P1”根因规则。

## 代理指标原始值

- 完成两周：是；
- 首次观察识别问题数：2；访谈整体能复述 3 个问题；
- 可见预测变化及原因：是；
- 人物与决策影响：是，林禾；
- 地图进入决策：是；地图动作执行：是；
- 第二周展开完整周计划：是；
- 第二周逐格完整检查：否；
- 第二周完整重排：否。

上述是单场原始值。七个有效样本已齐，但本文件不提前发布 Gate 1A 结论。

## 状态边界

- `Gate 1A=SEALING_7_OF_7_VALID_PENDING_AGGREGATION`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
