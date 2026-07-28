# TECH-RC9-D11 诊断有效性与人工裁定

## 结论

`VALIDITY=VALID_DIAGNOSTIC`

- candidate attempt：`C03`
- sample：`TECH-RC9-D11`
- Issue：#57；Issue body 明确分配 C03、P05/P06 与 D11–D15
- 两周完整完成：是
- 诊断用途：只用于 C03 盲诊断，永久排除 Gate 1A 与 Gate 1H 正式分母
- 编号永久保留，不复用
- 裁定者：`/root/c03_d11_seal`
- 裁定 UTC：`2026-07-28T15:54:46Z`

## Candidate 与 authority

- source SHA：`cd2fc9716d98c160fe530c593347992f18bf96e4`
- dependency integration SHA：`2bfe859824093001be2f2452bec0d6706edad6e2`
- source prototype tree：
  `5dea3df621fa7ddf782d235f30f08fd6ca2a4954`
- candidate core SHA-256：
  `640d3f807aa3d52bef7e7ecc4c9975c5bb714672c99a9895adb4b4bc4914ec95`
- build：`g1-rc-20260727.rc9-c03`
- artifact SHA-256：
  `9a7ddde0234d82798b2625c050710143f8f4b94bd6d14bd121910a76831abb65`
- archive SHA-256：
  `68e1e68d94bbc2ea48ffb5fd048a19998955aed124f95d6053b2af25e394c886`
- candidate build manifest SHA-256：
  `e134c52777b4515f81e2b98c0f4c6bf1c1d552512039b4f7a4f329a269ae7261`
- scenario：`gate1-two-week-management@0.5.1`
- protocol：`weekly-management-slice-playtest-v0.3`
- schema：`gate1-playtest-v2`
- 初态：`fnv1a32-1f72f2d0`
- authority tuple：diagnosis、Session、candidate build authority、opportunity、
  action、commitment、consequence、settlement 与 effect owner 全部一致

C03 仍处于 pre-diagnostic；本场不是 diagnostics manifest、candidate acceptance、
CM、IR 或正式 seal。

## 隔离、连续性与只读

- agent task：`/root/c03_d11_player`
- `fork_turns=none`：是
- 应用会话：只创建一个固定初态 Session
  `b8724483-d214-4f3d-b28b-1e29db0ddcec`
- browser/context/page 丢失、刷新或重开：无
- 上下文污染、前序 candidate 或其他样本暴露：无
- 与其他 RC9 player 场次重叠：无；D11 在 C03 pre-diagnostic seal 推送后独立运行
- 主持提示：两次都只询问同 Session 技术连续性与进度；无策略提示或代操作
- 第一次询问得到 `CONTINUITY_OK`；第二次询问在 agent 工具调用中排队，没有形成
  独立玩家回复，下一条实际收到的消息为 `SAVE_READY`
- 统一访谈：服务端保存、浏览器下载、四方核验和清空之后才发放
- seal agent 在场次完成后请求重发原文时收到的一句迟发补充，并非 `/root` 实时
  收到的 checkpoint，也不属于冻结访谈；已从 agent 原文正文、计数和 validity
  依据中排除

## Capture 与 validator 证据

- `captureKind`：`complete`
- `finalTick`：`2010`
- `isComplete`：`true`
- completed week：`2`
- recap / week recap：`2 / 2`
- 服务端 raw：
  `captures/g1-rc-20260727.rc9-c03-TECH-RC9-D11-b8724483-d214-4f3d-b28b-1e29db0ddcec.json`
- 服务端 raw 实际 SHA-256 / bytes：
  `159cb208056139803a108e02e046f3f646502c065a0bba2ce217e779eccc23b1`
  / `99,106`
- SHA sidecar、canonical receipt、浏览器下载：均声明或实测相同 SHA-256 /
  `99,106` bytes
- 浏览器下载与服务端 raw：逐字节相同
- 冻结 `validateCapturedExport`：`true`
- 冻结 `validateCanonicalManagementLedger`：
  `ok=true`、terminal commitments=`2`、owned effects=`5`
- 保存成功后才清空：是
- agent 原文：`agent-verbatim-output.md`

## Legacy 编辑人工裁定

| Week | action IDs | 数量 | 证据/理由 |
|---|---|---:|---|
| 1 | `action-0004` | 1 | 第一周主动开启南侧短通路 |
| 2 | `action-0009` | 1 | 第二周主动接受林禾学习请求 |

机器 legacy 候选与人工裁定一致。维修日程不在 legacy 白名单。

## V2 管理承诺人工裁定

| intent | Week | machine disposition | 人工有效 | choice set 合格 | 持久后果 | 证据/理由 |
|---|---:|---|---:|---:|---:|---|
| `w0:preventive-capacity:pump` | 1 | `committed` | 是 | 是 | 是 | `action-0001` 明确选择第二次预防检修，并原子兑现日程、设备暴露和恢复负荷 |
| `w0:repair-responsibility:pump-incident-day-3` | 1 | `committed` | 是 | 是 | 是 | `action-0003` 确认苏霁跨岗维修日程 |
| `w0:transport-route` | 1 | `committed` | 是 | 是 | 是 | `action-0004` 开启短通路 |
| `w1:recovery-allocation:pump-vs-food` | 2 | `committed` | 是 | 是 | 是 | `action-0008` 把唯一应急班次分配给维修备件 |
| `w1:character-request:lin-he-study` | 2 | `committed` | 是 | 是 | 是 | `action-0009` 接受林禾请求 |
| `w1:asset-use:fertilizer` | 2 | `committed` | 是 | 是 | 是 | `action-0010` 在第二周使用唯一化肥 |

人工计数：

- Week 1：`3`
- Week 2：`3`

机器与人工六个 candidate group 一致，均有合格 choice set、明确选择、持久投影
和已兑现后果；无 CTA、默认焦点、同意图拆分或重复刷数。

`action-0011:1`、`action-0011:2` 的两格额外维修先由
`action-0012:1`、`action-0012:2` 完整撤销，随后只以 `action-0013` 保留一格。
这组普通日程操作没有导出的独立 candidate group 或合格 choice set，人工不能
补计。

## C03 terminal ledger 人工裁定

| intent | Week | candidate | action | required consequences | owned effects | settled | 人工有效 |
|---|---:|---|---|---:|---:|---:|---:|
| `w0:preventive-capacity:pump` | 1 | `schedule-preventive-maintenance` | `action-0001` | 3 | 3 | 是 | 是 |
| `w1:recovery-allocation:pump-vs-food` | 2 | `allocate-repair-buffer` | `action-0008` | 2 | 2 | 是 | 是 |

C03 人工计数：

- Week 1：`1`
- Week 2：`1`

两个 opportunity 均绑定同一 diagnosis/Session/build authority；玩家通过具体候选
按钮提交，action、choice、projection、revision、commitment、required
consequences、effect ownership、terminal、settlement 与 recap 相互闭合。没有
从 CTA、底层编辑或复盘文案反推 C03 count。

## 产品与流程证据

- 初始观察：在首次改变状态前识别粮食、水泵风险、路线损耗、预防容量冲突和维修
  责任。
- 两周流程：完整。
- 预测解释：能说明预防检修移除 8 单位停机下探，也能说明短通路以 1 点维修换
  4 点粮食。
- 人物影响：林禾学习请求与乔磐维修效率、加班边界影响实际选择。
- 地图动作：开启短通路，能说明距离、时间、损耗与维修成本。
- 第二周完整检查 / 重排：均否；只展开日程定位并修改少量格子。
- comparison 中立性：未报告默认选择或推荐。
- 必须点完全部卡片：否。
- 主持策略泄漏：无。

## 技术中断

`/root/c03_d11_preclear_verify` 为导入 validator 意外短暂启动
`127.0.0.1:4186`，并创建了空的 `candidates/C03/captures` 目录。该 verifier：

- 没有调用 session-authority；
- 没有创建应用 Session、raw、sidecar、receipt 或 browser download；
- 没有打开或操作玩家 UI；
- 没有与 D11 的 `4197` host、browser/context/page 或玩家操作重叠；
- 立即停止 `4186`，精确空目录已删除。

因此该中断没有改变 authority、玩家状态或 D11 四方证据链，不构成协议列出的
技术无效原因。裁定时 `4186`、`4195`、`4196` 均无监听。

## 症状

| 症状 ID | 复现 | 建议 | 根因 cluster | 是否影响 validity |
|---|---|---|---|---|
| `D11-SYM-01` | 点击“查看粮食取舍”后没有感知独立 comparison，主要只定位到既有粮食区 | P2 | `FOOD_TRADEOFF_CTA_NO_DISCERNIBLE_PANEL_CHANGE` | 否 |

本场 `P0=0 / P1=0 / P2=1`，无原型阻断。玩家对两个维修补班的容量预估偏差属于
实际管理判断，随后通过正常撤销/重做纠正，不是技术无效或产品阻断。

## Frozen guards 与 host 收口

- RC8 tree：
  `c5714f7ca7adb5e8fe052d4d00f27c545b988347`
- RC8 inventory：
  `e6990ddc8acd6ff4dbacfec975c06e4d0b9bbc7f6a2fc1324f5023caec1b96ee`
- C01 tree：`55f661518c7ed8a2cc99f0fc0f25fabecd24c286`
- C02 tree：`9b7dbae2c0c5d1bba45399e77dac65766911d3b3`
- C03 core git object：
  `f2f1018efe9e5ce4143c8b1f0628c6c584692a70`
- C03 `rc-dist` tree：
  `330b67df1e7e9771ca816bbf433d498f07f09ece`
- P05 tree：`b6691311e87113ba5448ce0502d262107c5a3d82`
- P06 tree：`599d02a21770c5ccbdf428cf1637fa68c4763bc6`
- core、manifest、archive、P05/P06 与全部旧证据均无工作树差异
- D11 证据验证完成后停止 launchctl label
  `codex.newera.rc9.c03.d11.host` 与 PID `28073`
- `4197` 已释放，且无残留 `playtest-host.mjs` 进程
- host 的 `/tmp` log 与 pid 文件只作运行审计参考，不提交

## 最终理由

该样本由全新盲 agent 在一个且仅一个 C03 应用会话中连续完成。会话未丢失、刷新
或重开；冻结 host 与 ledger validator 通过；raw、sidecar、canonical receipt 与
浏览器下载形成同字节证据链；统一访谈在清空后发放。隔离的 preclear verifier
中断未触碰玩家、Session、authority 或证据。因此本场裁定为
`VALID_DIAGNOSTIC`。

## 状态边界

- `Gate 1A=PRE_DIAGNOSTIC`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
