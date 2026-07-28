# TECH-RC9-D15 诊断有效性与人工裁定

## 结论

`VALIDITY=VALID_DIAGNOSTIC`

- candidate attempt：`C03`
- sample：`TECH-RC9-D15`
- Issue：#57；Issue body 明确分配 C03、P05/P06 与 D11–D15
- 两周完整完成：是
- 诊断用途：只用于 C03 盲诊断，永久排除 Gate 1A 与 Gate 1H 正式分母
- 编号永久保留，不复用
- 裁定者：`/root`
- 裁定 UTC：`2026-07-28T18:31:21Z`

## Candidate 与 authority

- source SHA：`cd2fc9716d98c160fe530c593347992f18bf96e4`
- dependency integration SHA：`2bfe859824093001be2f2452bec0d6706edad6e2`
- source prototype tree：`5dea3df621fa7ddf782d235f30f08fd6ca2a4954`
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

- 玩家进程：本机新启动的独立 Codex CLI，不是 Claude Code，也不是 collaboration
  subagent
- Codex CLI Session：
  `019fa9e9-6ac4-71f1-99aa-8b279cc044d3`
- rollout：
  `/Users/leo/.codex/sessions/2026/07/29/rollout-2026-07-29T02-07-54-019fa9e9-6ac4-71f1-99aa-8b279cc044d3.jsonl`
- model / reasoning：`gpt-5.6-sol` / `xhigh`
- CLI：`0.142.4`
- fresh-context 机制：全新独立 CLI 进程、全新 CLI Session、全新上下文，以及
  开始时为空的临时工作区 `/tmp/new-era-c03-d15-player.kHfZZe`
- 应用会话：只创建一个固定初态 Session
  `5e309a64-dfde-400a-b66e-c011ead110aa`
- browser/context/page 丢失、刷新、重开或重置：无
- 上下文污染、前序 candidate 或其他样本暴露：无
- 与其他 RC9 player 场次重叠：无；D15 在 D14 证据提交并推送后独立运行
- 主持提示：仅发放 `CONTINUE_PLAY`、保存后 `CLEAR_AUTHORIZED` 与清空后的统一
  访谈；无策略提示或代操作
- 统一访谈：服务端保存、浏览器下载、四方核验和清空之后才发放

本场不使用也不声称 `fork_turns=none`；隔离事实以独立 CLI rollout 的
`session_meta` 与 `turn_context` 为准。

## Capture 与 validator 证据

- `captureKind`：`complete`
- `finalTick`：`2010`
- completed week：`2`
- recap / week recap：`2 / 2`
- final state：`fnv1a32-4b268b0a`
- 服务端 raw：
  `captures/g1-rc-20260727.rc9-c03-TECH-RC9-D15-5e309a64-dfde-400a-b66e-c011ead110aa.json`
- 服务端 raw 实际 SHA-256 / bytes：
  `55d6833d7d1c02cc2b3b55c80c4ef768362b2edc95d311d5e7b6253346cd253d`
  / `96,708`
- SHA sidecar、canonical receipt、浏览器下载：均声明或实测相同 SHA-256 /
  `96,708` bytes
- 浏览器下载与服务端 raw：逐字节相同
- 冻结 `validateCapturedExport`：`true`
- 冻结 `validateCanonicalManagementLedger`：
  `ok=true`、terminal commitments=`2`、owned effects=`5`
- 保存成功后才清空：是
- agent 原文：`agent-verbatim-output.md`

机器计时：

- started：`1785262153139`
- ended：`1785262751434`
- elapsed：`598,292 ms`
- Week 1 raw：`370,962 ms`
- Week 2 raw：`182,335 ms`

机器计数：

- actions：`11`
- domain events：`14`
- telemetry：`260`
- choice sets：`6`
- legacy W1/W2：`1 / 1`
- V2 W1/W2：`4 / 2`
- C03 terminal W1/W2：`1 / 1`
- opportunity / commitment / settled：`2 / 2 / 2`
- owned effects：`5`

## Legacy 编辑人工裁定

| Week | action IDs | 数量 | 证据/理由 |
|---|---|---:|---|
| 1 | `action-0004` | 1 | 第一周主动开启南侧短通路 |
| 2 | `action-0010` | 1 | 第二周接受林禾学习请求并修改对应农务块 |

机器 legacy 候选与人工裁定一致。

## V2 管理承诺人工裁定

| intent | Week | machine disposition | 人工有效 | choice set 合格 | 持久后果 | 证据/理由 |
|---|---:|---|---:|---:|---:|---|
| `w0:repair-responsibility:pump-incident-day-3` | 1 | `committed` | 是 | 是 | 是 | `action-0002` 确认乔磐维修日程 |
| `w0:preventive-capacity:pump` | 1 | `committed` | 是 | 是 | 是 | `action-0003` 明确选择第二次预防检修并原子兑现日程、暴露与恢复负荷 |
| `w0:transport-route` | 1 | `committed` | 是 | 是 | 是 | `action-0004` 开启短通路 |
| `w0:asset-use:fertilizer` | 1 | `committed` | 是 | 是 | 是 | `action-0005` 在第一周使用唯一化肥 |
| `w1:recovery-allocation:pump-vs-food` | 2 | `committed` | 是 | 是 | 是 | `action-0009` 把唯一应急班次分配给维修备件 |
| `w1:character-request:lin-he-study` | 2 | `committed` | 是 | 是 | 是 | `action-0010` 接受林禾请求并把对应农务块改为学习 |

人工计数：

- Week 1：`4`
- Week 2：`2`

机器与人工六个 candidate group 一致，均有合格 choice set、明确选择、持久投影
和已兑现后果；无 CTA、默认焦点、同意图拆分、重复刷数、撤销重做或人工直接编辑
补计。

## C03 terminal ledger 人工裁定

| intent | Week | candidate | action | required consequences | owned effects | settled | 人工有效 |
|---|---:|---|---|---:|---:|---:|---:|
| `w0:preventive-capacity:pump` | 1 | `schedule-preventive-maintenance` | `action-0003` | 3 | 3 | 是 | 是 |
| `w1:recovery-allocation:pump-vs-food` | 2 | `allocate-repair-buffer` | `action-0009` | 2 | 2 | 是 | 是 |

C03 人工计数：

- Week 1：`1`
- Week 2：`1`

两个 opportunity 均绑定同一 diagnosis/Session/build authority；具体候选 action、
projection、revision、commitment、required consequences、effect ownership、
terminal、settlement 与 recap 相互闭合。

## 产品与流程证据

- 初始观察：在首次改变状态前识别粮食、水泵风险、预防容量冲突、维修责任和
  运输成本。
- 两周流程：完整。
- 预测解释：能说明乔磐日程使粮食下降、维修上升，并由共享劳动力 106 超过
  可持续上限 104 的界面解释消除困惑。
- 人物影响：林禾参与预防检修并在第二周提出学习请求；乔磐维修效率影响责任选择。
- 地图动作：开启短通路，能说明距离、时间、损耗与维修成本。
- 第二周完整检查 / 重排：均否；只处理应急班次与人物请求。
- comparison 中立性：未报告默认选择或推荐。
- 必须点完全部卡片：否。
- 主持策略泄漏：无。
- 原型阻断：无。

## 症状

| 症状 ID | 复现 | 建议 | 根因 cluster | 是否影响 validity |
|---|---|---|---|---|
| `D15-SYM-01` | Playwright 页面元信息持续报告 `Console: 1 errors`；玩家按限制未打开开发者控制台，无法核实错误内容或归属；游戏、保存、下载和清空均无可见阻断 | P2，未核实观察项 | `PLAYWRIGHT_REPORTED_UNINSPECTED_CONSOLE_ERROR` | 否 |

本场 `P0=0 / P1=0 / P2=1`。该 P2 只记录可见工具元信号，不虚构错误内容或产品
根因；不得把它升级为已确认 runtime 缺陷，也不得因其非阻断性质忽略记录。

## Frozen guards 与 host 收口

- RC8 tree：`c5714f7ca7adb5e8fe052d4d00f27c545b988347`
- RC8 inventory：
  `e6990ddc8acd6ff4dbacfec975c06e4d0b9bbc7f6a2fc1324f5023caec1b96ee`
- C01 tree：`55f661518c7ed8a2cc99f0fc0f25fabecd24c286`
- C02 tree：`9b7dbae2c0c5d1bba45399e77dac65766911d3b3`
- D11 tree：`2a19954ad3aa2004ae1b9de7c2c1ce635c8b9164`
- D12 tree：`2b501eab138332634575e7b898ff8bf1d5cd31c0`
- D13 tree：`eeaec6fb6f81f1d7b858fb60d722ad939481b145`
- D14 tree：`7c08a62daa123521bb4071301052c4f5230bca48`
- C03 core git object：`f2f1018efe9e5ce4143c8b1f0628c6c584692a70`
- C03 `rc-dist` tree：`330b67df1e7e9771ca816bbf433d498f07f09ece`
- P05 tree：`b6691311e87113ba5448ce0502d262107c5a3d82`
- P06 tree：`599d02a21770c5ccbdf428cf1637fa68c4763bc6`
- core、manifest、archive、P05/P06、D11–D14 与全部旧证据均无工作树差异
- D15 证据验证完成后已停止 launchctl label
  `codex.newera.rc9.c03.d15.host`
- `4201` 已释放，且无对应 `playtest-host.mjs`

## 最终理由

该样本由全新独立 Codex CLI 进程在全新上下文中，通过一个且仅一个 C03 应用会话
连续完成。会话未丢失、刷新、重开或重置；冻结 host 与 ledger validator 通过；
raw、sidecar、canonical receipt 与浏览器下载形成同字节证据链；统一访谈在清空
后发放。W1/W2 的 Legacy `1/1`、V2 `4/2` 与 C03 `1/1` 是本场真实策略结果，
不改变技术有效性，也不得按诊断门槛改写。

## 状态边界

- `Gate 1A=PRE_DIAGNOSTIC`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
