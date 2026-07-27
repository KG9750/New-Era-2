# Gate 1 两周经营切片玩家测试协议 V0.2

| 字段 | 内容 |
|---|---|
| 项目 | Project-004-New Era 2 |
| 状态 | RC9 协议权威；尚未开跑 |
| 协议版本 | `weekly-management-slice-playtest-v0.2` |
| 场景版本 | `0.5.0` |
| 导出版本 | `gate1-playtest-v2` |
| 适用 cohort | `g1a-20260727-rc9-01` |
| 上位设计 | `../design-docs/weekly-plan-production-forecast-slice-v0.2.md` |

V0.2 只适用于 RC9。V0.1 继续解释 RC8 的有效编辑指标与
`AGENT_PROXY_FAIL`，两者不可直接同比。

## 0. 双轨与锁

- Gate 1A：七个独立 agent 的代理预检；
- Gate 1H：真人首次测试，当前 `PENDING`；
- Gate 2：只有 Gate 1H 正式 `PASS` 后才能解锁，当前 `LOCKED`。

Gate 1A 只能验证代理可完成性、因果证据、候选分类和明显机械刷数风险，不能
证明真人理解、节奏、兴趣或认知负担。

本协议不自动改写 Gate 1H 的真人合同。未来恢复 Gate 1H 前必须单独复审真人目标、
指标和玩家包；未经 Owner 明确授权，仍沿用原 `Pxx` 命名空间并保持 `PENDING`。

## 1. RC9 构念

RC8 的主指标是“有效编辑”。RC9 的主指标是“有效管理承诺”：

> 玩家在至少两个可达、后果可见、经穷举为未被严格支配的方案之间明确选择，
> 并使选择在日程、库存、风险、人物记录或 recap 中形成持久、可核验的后果。

RC9 报告必须双报：

- `legacyEffectiveEdits`：按 V0.1 人工裁定，只作诊断；
- `effectiveManagementCommitmentsV2`：按本协议人工裁定，作为 RC9 主指标。

机器导出只允许 `candidate*`，不得自动声明 `effective*`。

## 2. 样本与编号

| 类型 | 编号 | 是否进入正式分母 |
|---|---|---:|
| 主样本 | A38–A44 | 是 |
| 替补 | A45、A46 起递增 | 仅替代技术无效样本 |
| 盲诊断 | TECH-RC9-D01 起 | 否 |
| anti-pass | TECH-RC9-P01 起 | 否 |
| Gate 1H 真人 | Pxx | 当前不创建、不运行 |

七个正式有效样本必须来自七个全新独立 agent 上下文和七个全新应用会话。诊断、
anti-pass、旧 cohort 或接触过答案材料的 agent 永远不能转为正式样本。

## 3. 开跑前置

正式样本开始前必须存在同一 sealed candidate：

- source、dependency integration 与 build 精确 SHA；
- `scenarioVersion=0.5.0`；
- `schemaVersion=gate1-playtest-v2`；
- artifact 与确定性 UTC archive；
- 本协议、运营合同、中性玩家包、访谈和 schema hashes；
- capture host 与完整 manifest；
- anti-pass 两条轨迹；
- 五个盲诊断样本；
- 独立 review `P0=0 / P1=0`；
- 独立 seal；
- RC8 tree ID 与逐文件 SHA-256 guard 均通过。

任一 authority 或构建内容变化都使未完成 cohort 作废，不能只补测受影响场次。

## 4. 主持原则

主持人必须：

- 使用完全相同的中性开场、玩家包和访谈；
- 只记录实际可见行为、raw 和 agent 原文；
- 不纠正策略，不把失败结果判成技术无效；
- 对无法取得的字段写 `null` 和原因，不猜测。

主持人不得透露：

- 每周承诺目标；
- 问题类别数量；
- 方案指纹目标；
- anti-pass 轨迹；
- 所谓正确人物、格子、路线或资产策略；
- 前序样本的动作、缺陷或结论。

## 5. 单场流程

1. 核验 sealed candidate、空白 agent 上下文、全新浏览器状态和分配编号。
2. 发放 `player-packet-v0.2.md`，不发本协议或设计文档。
3. 玩家在首次权威操作前提交 `INITIAL_OBSERVATION`。
4. 玩家自行完成第一周比较、计划、运行与 recap。
5. 玩家自行进入第二周，处理继承状态、人物请求、资产和其他可见问题。
6. 完成时下载匿名 JSON，等待服务端 raw、SHA sidecar、canonical receipt 与
   浏览器下载一致。
7. 原型阻断时保存 blocked capture；tick 2010 且 `isComplete=false` 也必须走
   blocked。
8. 只有保存与下载均成功后才能清空会话。
9. 清空后才发放统一 `post-session-interview-v0.2.md`。
10. 保存 agent 原文、sample record 和 validity decision，提交并封存后才能开始
    下一场。

正式 cohort 严格串行。不得让两个正式样本或正式样本与其他 RC9 浏览器场次重叠。

## 6. complete 与 blocked capture

### complete

- `captureKind=complete`；
- `finalTick=2010`；
- `finalState.isComplete=true`；
- 两份 recap；
- 首次保存失败只能重试相同字节，不得继续改变游戏状态。

### blocked

- `captureKind=blocked`；
- `blockedAtTick=finalTick`；
- `finalState.isComplete=false`；
- 1–240 字非空原因；
- tick 不得位于 1003–1061；
- 保存失败同样只能重试相同字节。

原型自身可复现阻断是有效负面样本，通常形成 P0；不能因为没有完成而自动判无效。

## 7. 机器候选

每个 `candidateManagementCommitmentGroup` 至少包含：

```ts
{
  decisionIntentId: string
  choiceSetId: string
  weekIndex: 0 | 1
  problemCategory:
    | 'food'
    | 'repair'
    | 'character-request'
    | 'transport'
    | 'asset-use'
  actionIds: string[]
  consequenceRefs: Array<{
    kind:
      | 'forecast'
      | 'schedule'
      | 'inventory'
      | 'risk'
      | 'character-record'
      | 'recap'
    id: string
  }>
  beforeDecisionStateHash: string
  finalDecisionStateHash: string
  finalOutcomeCode: string
  finalDisposition: 'committed' | 'reverted' | 'default-maintained'
}
```

每组引用的 `choiceSet` 至少包含稳定 ID、全部 options、reachable、
`visibleConsequenceRefs`、`dominanceStatus` 和最终选择。`unverified` 不能当作
`non-dominated`。

oracle 还必须按 `decisionIntentId + optionId` 冻结以下 option 级合同：

- 唯一允许声明该 option 已提交的 action type 及必要 payload；
- 完整、无增删的 `visibleConsequenceRefs`；
- committed group 必须完整包含的 `requiredConsequenceRefs`；
- before/final 语义投影必须满足的变化谓词；
- 该 option 当前是否允许进入 `committed`。

所有 `EDIT_SCHEDULE`，以及会兑现日程的 accepted study action，必须至少记录
`memberId`、`dayIndex`、规范 `blockId`、`fromActivity` 与 `toActivity`；维修确认还
必须记录 `responsibility=scheduled`。成员、日期、格子、前后活动、option、
projection 和 schedule consequence 必须指向同一个对象，不能各自只在类型层面
成立。

当前对象级规范为：

- `food-shift-lin`：`lin-he:d1:b2` 从 `baseline` 变为 `food`；
- `schedule-repair`：`qiao-pan:d3:b2` 从 `baseline` 变为 `repair`，且
  `repairResponsibility=scheduled`；
- `accept-study`：`lin-he:d7:b2` 从 `food` 变为 `study`。

仅有同一意图允许的 action type 不够。例如 `EDIT_SCHEDULE` 不能证明玩家接受维修
欠账，`SET_FOOD_SHORTFALL_ACCEPTED` 不能证明玩家调过粮食日程，
`RESOLVE_LIN_HE_REQUEST(resolution=accepted)` 不能包装成 declined。

`requiredConsequenceRefs` 是 committed 的下限，不是展示全集。仅保留一个虽可见但
非核心的 forecast 不构成承诺；存在 schedule consequence 时，其 ID 必须精确等于
typed action 与 projection 的 `blockId`。

若 `finalOutcomeCode` 使用 `committed:schedule:<hash>`，`<hash>` 必须精确等于
`finalDecisionStateHash`，不能只满足 64 位十六进制外形。

当前 `north-loop` 和 `keep-fertilizer` 是无显式非默认 action 的默认分支，不得
声明为 `committed`；只有后续设计新增可观察、可校验的主动保留 action 并同步
升级协议与 fixtures 后，才能改变该约束。

legacy candidate edit group 只允许 oracle 明列的稳定 group ID 与 action type
组合。当前不授权 repair legacy group，因为通用 `EDIT_SCHEDULE` 无法仅凭 raw
payload 证明它属于 food 还是 repair；维修日程只进入 v2 管理承诺候选。未知 ID、
伪造 split 后缀或用两个 group 拆分同一意图必须拒绝。

## 8. 分类决策表

| 行为 | legacy 候选 | v2 候选 | 人工可能有效的必要条件 |
|---|---:|---:|---|
| 白名单粮食日程事务最终保留 | 是 | 是 | 合格 choice set，且改变可见供需 |
| 维修日程事务最终保留 | 否 | 是 | 合格 choice set，且改变可见维修保障或风险 |
| 白名单粮食日程事务完全撤销 | 保留轨迹 | 是，`reverted` | 永不有效 |
| 维修日程事务完全撤销 | 否 | 是，`reverted` | 永不有效 |
| accepted 林禾请求 | 是 | 是 | 日程和人物记录均兑现 |
| declined 林禾请求 | 否 | 条件式 | 持久、非默认人物后果 |
| 选择维修人员但未确认日程 | 否 | 否 | 未形成承诺 |
| 接受维修欠账 | 否 | 是 | 期限、累积代价和兑现点写入状态 |
| 打开运输捷径 | 是 | 是 | 与保留路线的反事实并列，且改变路线或供需 |
| 使用化肥 | 否 | 是 | 与保留资产并列，施用周唯一，终局资产减少 |
| 显式保留化肥 | 否 | 当前否 | 尚无显式非默认保留 action，不能提交 |
| 打开、定位、暂停、倍速、继续 | 否 | 否 | 永不计数 |

同一 `decisionIntentId + weekIndex` 最多人工计 1。完全恢复原投影为 `reverted`；
其他意图后续变化不得污染当前组的 final hash。

## 9. 人工裁定

运营负责人逐组核对：

1. raw 中是否存在对应动作；
2. choice set 是否至少有两个可达、后果可见的 `non-dominated` option；
3. 玩家是否明确选择，而非 CTA、默认焦点或键盘误提交；
4. 最终投影是否相对 before 持久改变；
5. consequence refs 是否在界面、状态或 recap 中兑现；
6. 撤销、重做与同意图聚合是否正确；
7. 周次是否由唯一 tick 规则得出。

人工可以否决机器候选，不能补记 raw 不存在的动作或状态。每个差异必须写明候选
ID、证据与理由。

## 10. 有效、无效与替补

有效样本须满足：

- sealed candidate 指纹一致；
- agent 与应用会话全新且相互隔离；
- 未接触答案、其他样本或开发材料；
- 只通过玩家界面操作；
- 主持无策略泄漏或代操作；
- complete 或原型可复现 blocked 的证据链完整；
- raw、sidecar、receipt、download 和记录可核验。

只允许以下技术无效原因：

- candidate、场景、协议或初态错误/无法确认；
- 上下文污染、样本泄漏或提前接触答案；
- 主持泄漏策略或代操作；
- agent 读取源码/测试或违反只读纪律；
- 不可恢复的工具故障导致核心证据无法核验；
- agent 服务退出且证据丢失。

差策略、负面评价、理解失败、指标失败、P0/P1、没有完成设计者偏好方案，都不是
技术无效理由。替补只按无效发生顺序从 A45 递增，编号不复用。

## 11. Gate 1A 结论

### `AGENT_PROXY_PASS`

必须同时满足：

- 七个有效样本均有完整证据链；
- 至少 6/7 能复述关键问题并完成两周核心流程；
- Week 1 与 Week 2 的人工 `effectiveManagementCommitmentsV2` 中位数分别为
  3–5，不把 14 个 agent-week 混成一组；
- 至少 6/7 在第二周既不完整检查也不完整重排；
- 至少 6/7 能解释一次界面可见的预测变化；
- 至少 6/7 能复述一名人物及其决策影响；
- 至少 5/7 通过可观察动作让地图进入决策；
- 无未解决 P0；
- 不存在同一根因聚类包含三个或以上独立 P1；
- anti-pass 两条轨迹都不能机械刷出有效承诺。

`legacyEffectiveEdits` 不参与 RC9 PASS。

### `AGENT_PROXY_CONDITIONAL`

只有一个比例指标恰好差一个 agent、两周承诺中位数均在 3–5、无 P0、且问题只需
局部修复时才可使用。任一周中位数不在 3–5 时禁止 conditional。

### `AGENT_PROXY_FAIL`

任一项成立即 FAIL：

- 阈值差距超过 conditional 或两项以上失败；
- 任一周承诺中位数不在 3–5；
- 未解决 P0；
- 同一根因聚类至少三个独立 P1；
- 多数样本无法完成、理解继承或解释预测；
- anti-pass 能机械刷数；
- 需要再次改变基本模型或大型系统；
- 全局阻断使七个有效样本无法取得。

无论结论如何：

```text
Gate 1H = PENDING
Gate 2  = LOCKED
```

## 12. Fixture oracle

`prototype/tests/fixtures/fixture-expectations.json` 是 Phase 0 的统一预期入口；
`npm run schema:fixtures` 必须拒绝未登记 fixture。

fixture 可使用仅供 conformance oracle 的 `oracleDecisionProjections`，按
`weekIndex:decisionIntentId` 保存 before/final 权威语义投影。oracle 必须从投影
重算 SHA-256 并与候选组 hashes 对账；该辅助字段不是 production export 的新增
authority，生产侧仍须从 raw action/state 重算同一投影。

脚本内的固定 outcome 矩阵与 `fixture-expectations.json` 必须逐项一致，且完整覆盖
全部 fixture。删除 fixture、删除 expectation 或同时篡改 fixture 与 expectation
都必须使 `schema:fixtures` 失败。

candidate manifest 另含 `priorManifests`，每项保存先前 CM ID、对应 C ID、
manifest hash 与拒绝状态。历史不变量为：

- 当前 `CMxx` 之前的 `CM01..CM(n-1)` 必须按序完整出现且 CM ID 不重复；
- `rejectedAttempts` 必须精确覆盖当前 `Cxx` 之前的 `C01..C(n-1)`；
- prior manifest 使用过的 C 必须唯一，且是 `rejectedAttempts` 的子集；
- current C 不得出现在 prior manifest 或 `rejectedAttempts`；
- 第一份 manifest 可以是 `CM01 + C02`，此时 `C01` 只在
  `rejectedAttempts`；合法的 `CM02 + C02` 则允许 `C01` 同时出现在
  `priorManifests` 与 `rejectedAttempts`；
- prior CM 已使用的 C 不得由后续 CM 重新包装。

最低覆盖：

- v1 complete/blocked；
- accepted/declined request、未确认维修方向、维修欠账；
- edit→undo→redo 与完全撤销；
- v1/v2 混合、不可达 tick；
- CTA/comparison 中性与偏置反例；
- housekeeping；
- decision hash 稳定/分歧与 outcome fingerprint；
- dominance 完整/不完整；
- 化肥 W1/W2/未使用/重复生效反例；
- candidate manifest 正反例。
- option/action/payload/projection/consequence 正反例与默认分支不可提交反例；
- food 误投 repair、repair 误投 food/unresolved、学习排给其他人物、schedule
  consequence 对象错配、只保留非核心 consequence 的反例；
- schedule outcome hash 与 final decision hash 精确绑定的正例；
- manifest 首份跳过已拒绝 C、正常 CM/C 历史及重新包装旧 C 的反例；
- fake legacy group 与同意图拆组反例。

Phase 0 只冻结独立 oracle；production export 与 capture host 在后续 Phase 4
必须通过同一套 fixtures。
