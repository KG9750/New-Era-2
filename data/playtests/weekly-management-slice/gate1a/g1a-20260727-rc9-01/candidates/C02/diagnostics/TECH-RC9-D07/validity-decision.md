# TECH-RC9-D07 诊断有效性与人工裁定

## 结论

`VALIDITY=VALID_DIAGNOSTIC`

- candidate attempt：`C02`
- sample：`TECH-RC9-D07`
- Issue：#56
- 两周完整完成：是
- 诊断用途：只用于 C02 盲诊断，永久排除 Gate 1A 与 Gate 1H 正式分母
- 编号永久保留，不复用
- 裁定者：`/root`
- 裁定 UTC：`2026-07-27T14:42:20Z`

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
- protocol hash：
  `194f83d9cbfb7dc64e4795e7c84666d54bcbdb3a4cc899a6e508a286ec396aa3`
- player packet hash：
  `ca01f407c0d2e7f0db9dc07699251190bcc55ef5c946b9a86bac17d8f24dd2ad`
- interview hash：
  `f10c6294edf5776dc426f90228e3030f328a80d823c23a65280d60721467c12c`
- capture host hash：
  `a670411afaec37fff51d52924ad6e9b85efa19fe628371bfc0448f76c177c03b`

C02 尚处于 pre-diagnostic，未生成 CM、IR 或正式 seal；本场只核对已经封存的
candidate-build manifest 与 anti-pass 核心，不提前声称 candidate freeze 完成。

## 隔离、连续性与只读

- agent task：`/root/rc9_d07_player`
- `fork_turns=none`：是
- 前序 candidate 暴露：无
- 应用会话：只创建一个固定初态 Session
  `df93957b-aad2-483b-bdcf-653cddef3f90`
- browser/context/page 丢失或重开：无
- 上下文污染：无
- 与其他 RC9 player 场次重叠：无；D07 在 D06 提交并停止 host 后单独运行
- 只读纪律：agent 未读取源码、协议、阈值、Issue、anti-pass 或其他样本
- 主持提示：只发中性玩家包、会话连续性询问、下载核验与清空授权；无策略提示或
  代操作
- 统一访谈：服务端保存、下载、四方核验和清空之后才发放

## Capture 证据

- `captureKind`：`complete`
- `finalTick`：`2010`
- `isComplete`：`true`
- recap：`2`
- 服务端 raw：
  `captures/g1-rc-20260727.rc9-c02-TECH-RC9-D07-df93957b-aad2-483b-bdcf-653cddef3f90.json`
- 服务端 raw 实际 SHA-256 / bytes：
  `a69a6f6a300117ef8e691e853328b29132410a3f59cc9e72437e8dac165a3792`
  / `68,670`
- SHA sidecar：声明相同 raw SHA-256
- canonical receipt：声明相同 raw SHA-256 / `68,670` bytes
- 浏览器下载：`browser-download.json`，实际为相同 SHA-256 / `68,670` bytes
- raw、sidecar claim、receipt claim 与浏览器下载：全部匹配
- 浏览器下载与服务端 raw：逐字节相同
- 保存成功后才清空：是
- agent 原文：`agent-verbatim-output.md`

## Legacy 编辑人工裁定

| Week | action IDs | 数量 | 证据/理由 |
|---|---|---:|---|
| 1 | `action-0004` | 1 | `legacy:w0:transport-route`；南侧短通路持久改变路线、粮食损耗与预测 |
| 2 | `action-0008` | 1 | `legacy:w1:lin-he-study`；接受请求持久改变林禾日程、人物记录与粮食预测 |

机器 legacy 候选与人工裁定一致。乔磐和林禾的维修日程不在 legacy 白名单内，
不得补记。

## V2 管理承诺人工裁定

| intent | Week | machine disposition | 人工有效 | choice set 合格 | 持久后果 | 证据/理由 |
|---|---:|---|---:|---:|---:|---|
| `w0:repair-responsibility:pump-incident-day-3` | 1 | `committed` | 是 | 是 | 是 | `action-0002` 明确确认乔磐维修活动块；维修预测、水泵风险和日程后果均兑现 |
| `w0:transport-route` | 1 | `committed` | 是 | 是 | 是 | `action-0004` 明确选择短通路；路线、粮食损耗和维修成本持续可见 |
| `w1:character-request:lin-he-study` | 2 | `committed` | 是 | 是 | 是 | `action-0008` 明确接受请求；日程、人物记录和粮食后果持续可见 |
| `w1:asset-use:fertilizer` | 2 | `committed` | 是 | 是 | 是 | `action-0009` 明确使用唯一化肥；库存归零且粮食预测改变 |

人工计数：

- Week 1：`2`
- Week 2：`2`

核对结果：

- 四个 intent 均有至少两个可达、后果可见的 `non-dominated` option；
- 都是 agent 明确选择，不是 CTA、默认焦点或机械提交；
- before/final decision hashes 与最终状态相符；
- 无 undo/redo，无同 intent 重复堆数；
- required consequences 在预测、日程、人物记录、库存、地图或 recap 中兑现；
- raw 中有对应动作，未人工补造。

第一周 `action-0003` 虽补足第二个预防检修块，但没有独立合格的 v2 candidate
group，运营负责人不补记。机器和人工没有差异。

## 产品与流程证据

- 初始观察：主动识别粮食缺口、水泵检修缺块和责任未落实，并能说出不处理的
  粮食、维修和跨周后果。
- 两周流程：完整。
- 预测解释：能说明短通路使粮食 `8→12`、维修 `7→6` 的路线与成本原因。
- 人物影响：乔磐 `200%` 维修效率和连续加班边界影响责任选择。
- 地图动作：开启南侧短通路，并说明距离、时间、粮食损耗和维修成本。
- 第二周完整检查：否。
- 第二周完整重排：否。
- comparison 中立性：未报告默认选择或推荐。
- 持续后果：人物请求、化肥、短通路和乔磐责任均在后续摘要、人物记录、库存、
  地图或 recap 可见。
- 主持策略泄漏：无。
- 技术中断：一次只读 locator deadline；发生在点击已经成功之后，未改变或丢失
  应用状态，继续使用原会话。

## 症状

| 症状 ID | 复现 | 建议 | 根因 cluster | 是否影响 validity |
|---|---|---|---|---|
| `D07-SYM-01` | 接受学习请求后，方案对话框在第二周运行时仍保持打开，但未遮挡或阻断 | P2 | `POST_COMMIT_COMPARISON_REMAINS_VISIBLE` | 否 |

本场无 P0、无 P1、无原型阻断。单场 legacy `1/1` 与 v2 `2/2` 只作当前诊断
事实，不提前判定五场中位数。

## 最终理由

该样本由全新盲 agent 在一个且仅一个 C02 应用会话中连续完成。一次 locator
deadline 发生在运行按钮已经成功生效之后，只影响只读状态定位；原
browser/context/page 与 Session 始终保留，没有刷新、重开或重放。raw、sidecar、
canonical receipt 与浏览器下载形成同字节证据链；统一访谈在清空后发放。产品
表现或承诺数不用于决定技术有效性。因此本场裁定为 `VALID_DIAGNOSTIC`。

## 状态边界

- `Gate 1A=PRE_DIAGNOSTIC`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
