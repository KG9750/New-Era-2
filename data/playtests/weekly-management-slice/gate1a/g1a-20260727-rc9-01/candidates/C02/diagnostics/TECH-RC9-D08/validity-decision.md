# TECH-RC9-D08 诊断有效性与人工裁定

## 结论

`VALIDITY=VALID_DIAGNOSTIC`

- candidate attempt：`C02`
- sample：`TECH-RC9-D08`
- Issue：#56
- 两周完整完成：是
- 诊断用途：只用于 C02 盲诊断，永久排除 Gate 1A 与 Gate 1H 正式分母
- 编号永久保留，不复用
- 裁定者：`/root`
- 裁定 UTC：`2026-07-27T14:55:09Z`

## Candidate 与 authority

- source SHA：`6837c7230806f2c5c218336668f9e201e3e6cca1`
- dependency integration SHA：`c9c207d7fb1cafc24301ef04c8d89afed3d87527`
- build：`g1-rc-20260727.rc9-c02`
- artifact SHA-256：
  `64e8ddc85d15502c3b2776f89b13d71fbb621d9f350682d6c71ec5c998998552`
- archive SHA-256：
  `9b2fbbffd7168f3bbd66eaf5c2c3b9d2872cf79da9d413771dd897014dc27c3d`
- candidate build manifest SHA-256：
  `a1756949810c87cc339c8d4184237ab776eca2bc98417b95e1feeda34b55b860`
- scenario：`0.5.0`
- schema：`gate1-playtest-v2`
- protocol / player packet / interview / capture host hashes：与 C02 candidate-build
  manifest 完全一致

C02 尚处于 pre-diagnostic，未生成 CM、IR 或正式 seal；本场只核对已经封存的
candidate-build manifest 与 anti-pass 核心，不提前声称 candidate freeze 完成。

## 隔离、连续性与只读

- agent task：`/root/rc9_d08_player`
- `fork_turns=none`：是
- 前序 candidate 暴露：无
- 应用会话：只创建一个固定初态 Session
  `b946a48e-a87d-47b7-8544-ee2587e2ded9`
- browser/context/page 丢失或重开：无
- 上下文污染：无
- 与其他 RC9 player 场次重叠：无；D08 在 D07 提交并停止 host 后单独运行
- 主持提示：只发中性玩家包、会话连续性询问、下载核验与清空授权；无策略提示或
  代操作
- 统一访谈：服务端保存、下载、四方核验和清空之后才发放

## Capture 证据

- `captureKind`：`complete`
- `finalTick`：`2010`
- `isComplete`：`true`
- recap：`2`
- 服务端 raw：
  `captures/g1-rc-20260727.rc9-c02-TECH-RC9-D08-b946a48e-a87d-47b7-8544-ee2587e2ded9.json`
- 服务端 raw 实际 SHA-256 / bytes：
  `f88f7c24c072f48939e0cb53dfc3ed3b31d919d8de5790051b90afe8f9458c1e`
  / `69,317`
- SHA sidecar、canonical receipt、浏览器下载：均声明或实测相同 SHA-256 /
  `69,317` bytes
- 浏览器下载与服务端 raw：逐字节相同
- 保存成功后才清空：是
- agent 原文：`agent-verbatim-output.md`

## Legacy 编辑人工裁定

| Week | action IDs | 数量 | 证据/理由 |
|---|---|---:|---|
| 1 | — | 0 | 第一周化肥不属于 legacy；维修日程不在 legacy 白名单 |
| 2 | `action-0008`, `action-0009` | 2 | 接受林禾请求与第二周开启短通路均形成 legacy 白名单内持久变化 |

机器 legacy 候选与人工裁定一致。

## V2 管理承诺人工裁定

| intent | Week | machine disposition | 人工有效 | choice set 合格 | 持久后果 | 证据/理由 |
|---|---:|---|---:|---:|---:|---|
| `w0:repair-responsibility:pump-incident-day-3` | 1 | `committed` | 是 | 是 | 是 | `action-0002` 确认乔磐维修活动块；维修预测、水泵风险和日程后果兑现 |
| `w0:asset-use:fertilizer` | 1 | `committed` | 是 | 是 | 是 | `action-0004` 使用唯一化肥；第一周库存和粮食预测持久改变 |
| `w1:character-request:lin-he-study` | 2 | `committed` | 是 | 是 | 是 | `action-0008` 接受请求；日程、人物记录和粮食后果兑现 |
| `w1:transport-route` | 2 | `committed` | 是 | 是 | 是 | `action-0009` 第二周开启短通路；路线、损耗和维修成本持续可见 |

人工计数：

- Week 1：`2`
- Week 2：`2`

机器与人工四个 candidate group 一致，均有至少两个可达、后果可见的
`non-dominated` option、明确选择、持久投影和已兑现后果；无 undo/redo 或同意图
堆数。

`action-0010 / SET_FOOD_SHORTFALL_ACCEPTED(true)` 确实存在于 raw，但发生在
Week 2，导出中没有相应 candidate group 或 choice set。冻结协议只允许逐组人工
核对，不能从孤立 action 补造管理承诺；因此该动作不计入 v2。第一周
`action-0003` 的检修块同样没有独立合格 v2 group，不补记。

## 产品与流程证据

- 初始观察：识别粮食、水泵检修和维修责任对共享劳动力的竞争。
- 两周流程：完整。
- 预测解释：能说明确认乔磐日程后的粮食、维修与劳动力超限变化。
- 人物影响：乔磐 `200%` 维修效率和加班边界影响责任选择。
- 地图动作：第二周开启短通路，能说明距离、时间、粮食损耗和维修成本。
- 第二周完整检查 / 重排：均否。
- comparison 中立性：未报告默认选择或推荐。
- 持续后果：风险接受、人物请求、化肥与短通路均有后续可见状态。
- 主持策略泄漏：无。
- 技术中断：无。

## 症状

`none`

本场无 P0、无 P1、无 P2、无原型阻断。单场 legacy `0/2` 与 v2 `2/2` 只作当前
诊断事实，不提前判定五场中位数。

## 最终理由

该样本由全新盲 agent 在一个且仅一个 C02 应用会话中连续完成。会话从创建、两周
运行、终局下载、运营核验到授权清空均未丢失或重开；raw、sidecar、canonical
receipt 与浏览器下载形成同字节证据链；统一访谈在清空后发放。产品表现或承诺数
不用于决定技术有效性。因此本场裁定为 `VALID_DIAGNOSTIC`。

## 状态边界

- `Gate 1A=PRE_DIAGNOSTIC`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
