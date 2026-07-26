# A31 有效性裁定

## 结论

`VALIDITY=VALID`

- 主样本编号：`A31`
- Issue：#33
- cohort：`g1a-20260726-rc8-01`
- Batch：`Batch 1`
- 纳入当前七个有效样本分母
- A31 编号永久保留，不复用

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
- 结束访谈只在保存、浏览器下载与清空均由运营核验后发放。

## host 技术中断

两周完成后，原 4197 loopback host 异常退出，A31 的前两次保存显示
`Failed to fetch`。A31 按协议没有清空、刷新、重开或改变任何游戏状态。
运营恢复完全相同的冻结 host 后，A31 只重试原终局保存；同一 Session 成功
生成可验证三件套和浏览器下载。

中断发生在所有玩法决策结束后，没有重玩、策略干预或不可验证状态，故不构成
技术无效。记录为 `A31-TECH-01`。

## 编辑裁定与产品症状

机器导出将四个 candidate edit 全计入第一周，显示 `4 / 0`。其中
`action-0008`：

- 位于 `week-1-ended` 和 `CONTINUE_TO_NEXT_WEEK` 之后；
- 目标为第 8 日 `qiao-pan:d7:b2`；
- agent 访谈确认是第二周乔磐维修块。

因此运营裁定有效编辑为：

- Week 1：`3`
- Week 2：`1`

并登记：

`A31-SYM-01 / CANDIDATE_EDIT_WEEK_ATTRIBUTION_AT_BOUNDARY`

单场建议为 P2。该问题没有影响玩法完成，且 host 仍可凭 action ID、顺序和
目标格作人工裁定；当前只影响 A31，尚不构成 Gate 1A 定义的独立 P1。

## 代理指标原始值

- 完成两周：是；
- 首次观察识别问题数：2；访谈整体能复述 3 个问题；
- 可见预测变化及原因：是；
- 人物与决策影响：是，林禾；
- 地图进入决策：是；
- 地图动作执行：是；
- 第二周完整检查：否；
- 第二周完整重排：否。

上述是单场原始值，不提前计算 Gate 1A 最终结论。

## 状态边界

- `Gate 1A=IN_PROGRESS_2_OF_7_VALID`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
