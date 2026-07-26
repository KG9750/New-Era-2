# A32 有效性裁定

## 结论

`VALIDITY=VALID_COMPLETE_CAPTURE_AND_PROTOCOL_COMPLIANCE`

- 主样本编号：`A32`
- Issue：#34
- cohort：`g1a-20260726-rc8-01`
- Batch：`Batch 1`
- 纳入当前七个有效样本分母
- 当前正式计数：`2/7 valid`
- A32 编号永久保留，不复用

## 协议核验

- agent 使用 `fork_turns=none` 的全新上下文；
- 只收到冻结玩家包 V6 和自己的编号，未收到 A30/A31 结果、已知缺陷或阈值；
- 只通过 `1440×900` 浏览器玩家界面操作；
- 首次操作前保留 `INITIAL_OBSERVATION`；
- RC SHA、build、artifact、场景、种子和初态均与 RC8 manifest 一致；
- 完成两周，终局 tick 为 `2010`，`isComplete=true`，有两份连续 recap；
- 唯一 `export-created`，不存在 `blocked-capture-created`；
- 服务端 raw、SHA sidecar、canonical receipt 与本机浏览器下载均为
  63,246 bytes，SHA-256
  `c379be96dff1989bb8c9de03cda1f911fdbf4f68b3d3b0eeb9517d88ad5e5414`，
  `cmp` 逐字节一致；
- 保存成功后才清空，并回到“开始匿名新会话”；
- 结束访谈只在保存、下载与清空核验后发放。

## 编辑裁定

机器 candidate edit 为 Week 1=`1`、Week 2=`0`，与动作链一致：

- `action-0001`：第一周把林禾周二 B2 改为维修，补足第 2 个水泵检修块；
- 接受轻度粮食缺口、接受学习请求和使用化肥属于有效经营决策，但不是候选
  日程编辑，不计入候选编辑数。

最终有效编辑：

- Week 1：`1`
- Week 2：`0`

## 症状与代理指标

本场未发现可独立封存的产品或技术症状：

- `P0=0 / P1=0 / P2=0`
- 完成两周：是；
- 首次观察识别问题数：2；访谈整体能复述 3 个问题；
- 可见预测变化及原因：是；
- 人物与决策影响：是，林禾；
- 地图进入决策：是；地图动作执行：否；
- 第二周完整检查：否；
- 第二周完整重排：否。

这些是单场原始值，不提前计算 Gate 1A 最终结论。

## 状态边界

- `Gate 1A=RUNNING_2_OF_7_VALID_A37_PENDING`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`

## Post-seal aggregate adjudication

`2026-07-26T18:52:21Z`，聚合审计者 `/root` 依据玩家测试协议 §8.1 复核 raw
动作。机器原始候选计数保持 `1/0`；最终人工有效编辑为：

- Week 1：`action-0001`，共 `1`；
- Week 2：`action-0006`，共 `1`。

`action-0006 / RESOLVE_LIN_HE_REQUEST` 应计为有效编辑，归入
`REQUEST_ACTION_CANDIDATE_CLASSIFICATION` 的 request omission P1。A32
逐字输出第 10 节还明确记录第二周页面切换后时钟短暂显示“周日 23:00”，
归入 `WEEK_BOUNDARY_PHASE_AT_TICK_1002` 的 systematic prestart-label P2；
该来源为 verbatim 补证，不改写原 `symptoms=[]`。历史字段、`2/7` 快照和原
adjudicator 保留；`VALID` 不变。
