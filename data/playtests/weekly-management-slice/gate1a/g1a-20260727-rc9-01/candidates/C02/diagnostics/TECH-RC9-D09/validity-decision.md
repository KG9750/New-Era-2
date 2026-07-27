# TECH-RC9-D09 诊断有效性与人工裁定

## 结论

`VALIDITY=VALID_DIAGNOSTIC`

- candidate attempt：`C02`
- sample：`TECH-RC9-D09`
- Issue：#56
- 两周完整完成：是
- 诊断用途：只用于 C02 盲诊断，永久排除 Gate 1A 与 Gate 1H 正式分母
- 编号永久保留，不复用
- 裁定者：`/root`
- 裁定 UTC：`2026-07-27T15:12:21Z`

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
- authority hashes：与 C02 candidate-build manifest 完全一致

C02 尚处于 pre-diagnostic，未生成 CM、IR 或正式 seal；本场不提前声称 candidate
freeze 完成。

## 隔离、连续性与只读

- agent task：`/root/rc9_d09_player`
- `fork_turns=none`：是
- 应用会话：只创建一个固定初态 Session
  `87365f53-3eb5-4564-8594-d5181930fb08`
- browser/context/page 丢失或重开：无
- 上下文污染或前序 candidate 暴露：无
- 与其他 RC9 player 场次重叠：无；D09 在 D08 提交并停止 host 后单独运行
- 主持提示：两次仅询问会话连续性与进度；无策略提示或代操作
- 统一访谈：服务端保存、下载、四方核验和清空之后才发放

## Capture 证据

- `captureKind`：`complete`
- `finalTick`：`2010`
- `isComplete`：`true`
- recap：`2`
- 服务端 raw：
  `captures/g1-rc-20260727.rc9-c02-TECH-RC9-D09-87365f53-3eb5-4564-8594-d5181930fb08.json`
- 服务端 raw 实际 SHA-256 / bytes：
  `31308a7426c570d2f477c5e559dced449651732a05cd5e849d231677ce988b6f`
  / `69,435`
- SHA sidecar、canonical receipt、浏览器下载：均声明或实测相同 SHA-256 /
  `69,435` bytes
- 浏览器下载与服务端 raw：逐字节相同
- 保存成功后才清空：是
- agent 原文：`agent-verbatim-output.md`

## Legacy 编辑人工裁定

| Week | action IDs | 数量 | 证据/理由 |
|---|---|---:|---|
| 1 | `action-0004` | 1 | 第一周开启南侧短通路 |
| 2 | `action-0008` | 1 | 第二周接受林禾学习请求 |

机器 legacy 候选与人工裁定一致。维修日程不在 legacy 白名单。

## V2 管理承诺人工裁定

| intent | Week | machine disposition | 人工有效 | choice set 合格 | 持久后果 | 证据/理由 |
|---|---:|---|---:|---:|---:|---|
| `w0:repair-responsibility:pump-incident-day-3` | 1 | `committed` | 是 | 是 | 是 | `action-0002` 确认乔磐维修活动块 |
| `w0:transport-route` | 1 | `committed` | 是 | 是 | 是 | `action-0004` 开启短通路 |
| `w1:character-request:lin-he-study` | 2 | `committed` | 是 | 是 | 是 | `action-0008` 接受林禾请求 |
| `w1:asset-use:fertilizer` | 2 | `committed` | 是 | 是 | 是 | `action-0009` 使用唯一化肥 |

人工计数：

- Week 1：`2`
- Week 2：`2`

机器与人工四个 candidate group 一致，均有合格 choice set、明确选择、持久投影
和已兑现后果；无 undo/redo 或同意图堆数。

`action-0003` 的预防检修块与 `action-0010` 的第二周额外维修块没有独立合格
choice set/candidate group，不能人工补计。

## 产品与流程证据

- 初始观察：识别水泵检修、维修责任和粮食轻度缺口。
- 两周流程：完整。
- 预测解释：能说明短通路导致粮食 `8→12`、维修 `7→6`。
- 人物影响：乔磐维修效率和加班边界影响两次维修选择。
- 地图动作：开启短通路，能说明距离、时间、损耗和维修成本。
- 第二周完整检查 / 重排：均否；只展开计划定位一格。
- comparison 中立性：未报告默认选择或推荐。
- 主持策略泄漏：无。
- 技术中断：无。

## 症状

| 症状 ID | 复现 | 建议 | 根因 cluster | 是否影响 validity |
|---|---|---|---|---|
| `D09-SYM-01` | “查看粮食取舍”主要定位现有粮食区，没有类似其他方案比较的独立面板 | P2 | `FOOD_TRADEOFF_CTA_NO_DISCERNIBLE_PANEL_CHANGE` | 否 |

本场无 P0、无 P1、无原型阻断。单场 legacy `1/1` 与 v2 `2/2` 只作当前诊断事实。

## 最终理由

该样本由全新盲 agent 在一个且仅一个 C02 应用会话中连续完成。会话未丢失、刷新
或重开；raw、sidecar、canonical receipt 与浏览器下载形成同字节证据链；统一访谈
在清空后发放。因此本场裁定为 `VALID_DIAGNOSTIC`。

## 状态边界

- `Gate 1A=PRE_DIAGNOSTIC`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
