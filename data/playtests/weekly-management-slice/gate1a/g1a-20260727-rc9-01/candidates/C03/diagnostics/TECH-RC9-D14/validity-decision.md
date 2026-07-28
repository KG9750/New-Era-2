# TECH-RC9-D14 诊断有效性与人工裁定

## 结论

`VALIDITY=VALID_DIAGNOSTIC`

- candidate attempt：`C03`
- sample：`TECH-RC9-D14`
- Issue：#57；Issue body 明确分配 C03、P05/P06 与 D11–D15
- 两周完整完成：是
- 诊断用途：只用于 C03 盲诊断，永久排除 Gate 1A 与 Gate 1H 正式分母
- 编号永久保留，不复用
- 裁定者：`/root`
- 裁定 UTC：`2026-07-28T17:52:33Z`

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

- agent task：`/root/c03_d14_player`
- `fork_turns=none`：是
- 应用会话：只创建一个固定初态 Session
  `7e1b245d-65a5-4f57-bb4e-e48dd15d419d`
- browser/context/page 丢失、刷新、重开或重置：无
- 上下文污染、前序 candidate 或其他样本暴露：无
- 与其他 RC9 player 场次重叠：无；D14 在 D13 证据提交并推送后独立运行
- 主持提示：两次只询问同 Session 技术连续性、周次、进度与阻断；无策略提示或
  代操作
- 统一访谈：服务端保存、浏览器下载、四方核验和清空之后才发放

## Capture 与 validator 证据

- `captureKind`：`complete`
- `finalTick`：`2010`
- `isComplete`：`true`
- completed week：`2`
- recap / week recap：`2 / 2`
- 服务端 raw：
  `captures/g1-rc-20260727.rc9-c03-TECH-RC9-D14-7e1b245d-65a5-4f57-bb4e-e48dd15d419d.json`
- 服务端 raw 实际 SHA-256 / bytes：
  `1e24d27b2caa5843d18b56131d17da4b86e9cc8cc74bee3756ad8c5393068ad4`
  / `97,580`
- SHA sidecar、canonical receipt、浏览器下载：均声明或实测相同 SHA-256 /
  `97,580` bytes
- 浏览器下载与服务端 raw：逐字节相同
- 冻结 `validateCapturedExport`：`true`
- 冻结 `validateCanonicalManagementLedger`：
  `ok=true`、terminal commitments=`2`、owned effects=`5`
- 保存成功后才清空：是
- agent 原文：`agent-verbatim-output.md`

机器计时：

- started：`1785260440950`
- ended：`1785260806943`
- elapsed：`365,970 ms`
- Week 1 raw：`245,862 ms`
- Week 2 raw：`85,291 ms`

## Legacy 编辑人工裁定

| Week | action IDs | 数量 | 证据/理由 |
|---|---|---:|---|
| 1 | `action-0004` | 1 | 第一周主动开启南侧短通路 |
| 2 | — | 0 | 第二周拒绝学习请求不在 legacy 白名单 |

机器 legacy 候选与人工裁定一致。普通维修日程尝试已撤销，且不在 legacy 白名单。

## V2 管理承诺人工裁定

| intent | Week | machine disposition | 人工有效 | choice set 合格 | 持久后果 | 证据/理由 |
|---|---:|---|---:|---:|---:|---|
| `w0:preventive-capacity:pump` | 1 | `committed` | 是 | 是 | 是 | `action-0001` 明确选择保护性恢复，并原子兑现容量、恢复与准备度 |
| `w0:repair-responsibility:pump-incident-day-3` | 1 | `committed` | 是 | 是 | 是 | `action-0003` 确认乔磐维修日程 |
| `w0:transport-route` | 1 | `committed` | 是 | 是 | 是 | `action-0004` 开启短通路 |
| `w0:asset-use:fertilizer` | 1 | `committed` | 是 | 是 | 是 | `action-0006` 在第一周使用唯一化肥 |
| `w1:recovery-allocation:pump-vs-food` | 2 | `committed` | 是 | 是 | 是 | `action-0011` 把唯一应急班次分配给维修备件 |
| `w1:character-request:lin-he-study` | 2 | `committed` | 是 | 是 | 是 | `action-0012` 拒绝林禾请求并保留农务 |

人工计数：

- Week 1：`4`
- Week 2：`2`

机器与人工六个 candidate group 一致，均有合格 choice set、明确选择、持久投影
和已兑现后果；无 CTA、默认焦点、同意图拆分或重复刷数。玩家曾做一次普通维修
日程修改并立即整笔撤销；该动作没有独立合格 choice set，也没有存活终态，未被
人工补计。

## C03 terminal ledger 人工裁定

| intent | Week | candidate | action | required consequences | owned effects | settled | 人工有效 |
|---|---:|---|---|---:|---:|---:|---:|
| `w0:preventive-capacity:pump` | 1 | `retain-rest-capacity` | `action-0001` | 3 | 3 | 是 | 是 |
| `w1:recovery-allocation:pump-vs-food` | 2 | `allocate-repair-buffer` | `action-0011` | 2 | 2 | 是 | 是 |

C03 人工计数：

- Week 1：`1`
- Week 2：`1`

两个 opportunity 均绑定同一 diagnosis/Session/build authority；具体候选 action、
projection、revision、commitment、required consequences、effect ownership、
terminal、settlement 与 recap 相互闭合。普通排班试错没有生成 C03 count。

## 产品与流程证据

- 初始观察：在首次改变状态前识别粮食、水泵风险、预防容量冲突和维修责任。
- 两周流程：完整。
- 预测解释：能说明乔磐责任、短通路、周三停机、化肥和普通排班试错对预测的
  逐步影响。
- 人物影响：林禾恢复与学习请求、乔磐维修效率影响两周选择。
- 地图动作：开启短通路，能说明距离、时间、损耗与维修成本。
- 第二周完整检查 / 重排：均否；只处理应急班次与人物请求。
- comparison 中立性：未报告默认选择或推荐。
- 必须点完全部卡片：否。
- 主持策略泄漏：无。
- 原型阻断或浏览器工具故障：无。

## 症状

| 症状 ID | 复现 | 建议 | 根因 cluster | 是否影响 validity |
|---|---|---|---|---|
| `D14-SYM-01` | 第一周周一提交保护性恢复后，锁定结果短暂使用“水泵事件已发生”的过去时，但脚本事件实际到周三才触发 | P2 | `PRE_EVENT_TERMINAL_COPY_USES_POST_EVENT_TENSE` | 否 |

本场 `P0=0 / P1=0 / P2=1`，无原型阻断。时间文案错位未改变事件 tick、
authority、选择或结算。

## Frozen guards 与 host 收口

- RC8 tree：`c5714f7ca7adb5e8fe052d4d00f27c545b988347`
- RC8 inventory：
  `e6990ddc8acd6ff4dbacfec975c06e4d0b9bbc7f6a2fc1324f5023caec1b96ee`
- C01 tree：`55f661518c7ed8a2cc99f0fc0f25fabecd24c286`
- C02 tree：`9b7dbae2c0c5d1bba45399e77dac65766911d3b3`
- D11 tree：`2a19954ad3aa2004ae1b9de7c2c1ce635c8b9164`
- D12 tree：`2b501eab138332634575e7b898ff8bf1d5cd31c0`
- D13 tree：`eeaec6fb6f81f1d7b858fb60d722ad939481b145`
- C03 core git object：`f2f1018efe9e5ce4143c8b1f0628c6c584692a70`
- C03 `rc-dist` tree：`330b67df1e7e9771ca816bbf433d498f07f09ece`
- P05 tree：`b6691311e87113ba5448ce0502d262107c5a3d82`
- P06 tree：`599d02a21770c5ccbdf428cf1637fa68c4763bc6`
- core、manifest、archive、P05/P06、D11–D13 与全部旧证据均无工作树差异
- D14 证据验证完成后停止 launchctl label
  `codex.newera.rc9.c03.d14.host` 与 PID `92888`
- `4200` 必须释放，且不得残留对应 `playtest-host.mjs`

## 最终理由

该样本由全新盲 agent 在一个且仅一个 C03 应用会话中连续完成。会话未丢失、刷新、
重开或重置；冻结 host 与 ledger validator 通过；raw、sidecar、canonical
receipt 与浏览器下载形成同字节证据链；统一访谈在清空后发放。W1/W2 的
`4/2` 是本场真实策略结果，不改变技术有效性，也不得按诊断门槛改写。

## 状态边界

- `Gate 1A=PRE_DIAGNOSTIC`
- `Gate 1H=PENDING`
- `Gate 2=LOCKED`
