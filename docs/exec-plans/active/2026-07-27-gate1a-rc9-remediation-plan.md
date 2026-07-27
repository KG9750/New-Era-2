# Gate 1A RC9 修复与复测计划

| 字段 | 内容 |
|---|---|
| 项目 | Project-004-New Era 2 |
| 状态 | `PLANNED / NOT_STARTED` |
| 日期 | 2026-07-27 |
| 失败基线 | `c0f4269bc3fef56962199629bad8db041aafc5f0` |
| RC8 结论 | `AGENT_PROXY_FAIL` |
| RC9 性质 | RC8 失败后获准的“责任承诺模型”受控转向 |
| RC9 cohort | `g1a-20260727-rc9-01` |
| 当前边界 | Gate 1H=`PENDING`；Gate 2=`LOCKED` |
| 目标 | 修复周结转、换周相位和证据准确性，验证新的日常管理交互构念，再冻结全新 RC9 cohort |

---

## 0. 决策摘要

RC8 七个有效样本经协议 §8.1 人工复核后，第一周与第二周有效编辑中位数为 `2 / 1`，低于冻结目标 `3–5`。这不是只补一个遥测白名单就能改写的结果。

RC9 同时处理四类根因：

1. **证据准确性：** accepted `RESOLVE_LIN_HE_REQUEST` 实际改变日程，却未进入 `candidateEditGroups`。
2. **周相位一致性：** `CONTINUE_TO_NEXT_WEEK` 后 tick 停在 `1002`，使时钟、地图、运输、遥测周归属互相矛盾。
3. **跨周经营因果：** 粮食和维修库存固定为 `18 / 9`，第一周实际结果没有成为第二周初态；一次性化肥还可能跨周重复生效。
4. **交互构念：** 摘要卡直接指定人物和格子，玩家更像执行答案，而不是经由“例外责任 → 日程方案 → 供需反事实 → 持续后果”作出管理判断。

RC9 的推荐闭环是：

```text
真实周结转
  + 单一 tick 周相位真值
  + 摘要只暴露问题与责任方向
  + 人员责任必须兑现到日程表
  + 可审计的责任承诺候选
  + 运营人工最终裁定
```

### 0.1 明确承认构念转向

RC9 不声称“原有效编辑密度已被修好”。它是 V0.1 在 FAIL 后允许评估的“责任承诺模型”：

- RC8 指标：有效编辑；
- RC9 主指标：有效管理承诺；
- 两者被计数对象不同，不可直接同比；
- RC8 的 `2 / 1`、失败结论和全部证据永久只读；
- RC9 报告必须同时给出：
  - `legacyEffectiveEdits`：按 V0.1 人工裁定，仅作诊断；
  - `effectiveManagementCommitmentsV2`：按 RC9 新协议人工裁定，作为 RC9 主指标；
- 浏览器只输出机器候选，不自动宣告“有效”；
- 即使 RC9 代理预检通过，也只说明责任承诺模型通过 Gate 1A 候选验证。

Gate 1H 的真人合同不随 RC9 自动改变。未来恢复 Gate 1H 前，必须单独复审真人目标、指标和玩家包；未经 Owner 明确授权，仍使用原 `Pxx` 命名空间且状态保持 `PENDING`。

### 0.2 不变边界

- 不降低数字门槛来制造通过；
- 不增加无后果按钮或强迫逐卡处理；
- 不引入 RimWorld 式“人物 × 工作类型数字优先级”；
- 不开发主题、豁免、NPC 排名、战斗或其他 Gate 2 内容；
- 不在正式 cohort 期间修改源码、数值、协议、玩家包、访谈或判定规则。

---

## 1. 权威输入、隔离与成功标准

### 1.1 实施前必读

1. `AGENTS.md`
2. `CONTEXT.md`
3. `DESIGN.md`
4. `FRONTEND.md`
5. `data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01/gate1a-final-report.md`
6. `docs/product-specs/weekly-management-slice-playtest-v0.1.md`
7. `docs/exec-plans/active/2026-07-26-gate1-agent-test-operations.md`
8. `docs/design-docs/weekly-plan-production-forecast-slice-v0.1.md`

### 1.2 隔离合同

- 所有实施从失败基线 `c0f4269bc3fef56962199629bad8db041aafc5f0` 的干净克隆开始。
- RC8 cohort 整个目录在实施前后都做 Git tree 与逐文件 SHA-256 guard，不只检查 raw 或 manifest。
- RC9 只新增 v0.2 文档和新 cohort，不覆写 v0.1、RC8 运营合同或任何旧 cohort。
- 默认 Node 损坏时，命令显式使用：

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
```

- 每个实施 Issue 的 `input_ref` 必须替换为本计划最终提交的精确 SHA；不得填写分支名、`HEAD` 或占位符后直接开工。

### 1.3 计划通过标准

本计划进入 Issue 创建前必须满足：

- 三名独立 agent 分别完成 verification、adversarial、evidence/plan-quality 审查；
- 三路均给出 PASS，且 `P0=0 / P1=0`；
- `git diff --check` 通过；
- RC8 cohort tree/hash guard 通过；
- 只提交本计划与三个入口文件；
- 计划提交以 compare-and-swap 方式推送，不覆盖远端新增提交。

---

## 2. RC9 产品与领域合同

### 2.1 两张表仍是日常玩法核心

RC9 保留：

- 所有成员的周日程表；
- 当前安排下的粮食与维修供需表；
- 周初摘要只暴露问题、后果和责任方向；
- 完整 112 格计划仍是审计和批量调整工具，但不要求每周完整检查或重排。

摘要不能直接给出唯一人物、格子或最优答案。

### 2.2 真实库存与双供需 recap

最小状态合同：

- 初始粮食库存 `18`、维修库存 `9`；
- forecast 从 `SimulationState` 读取当前库存；
- 每周 recap 同时保存粮食与维修的 planned、actual、原因与期末值；
- 第一周 recap 生成时只冻结结算结果，不立刻覆盖当前库存；
- `CONTINUE_TO_NEXT_WEEK` 才原子提交两条 actual 到 state；
- 第二周 forecast 直接读取结转值；
- 终局 recap 显示两条供需与未消耗关键资产。

不得在 recap 生成和换周两个位置重复提交库存。

### 2.3 一次性化肥生命周期

删除以 `fertilizerUsed:boolean` 表示全部生命周期的做法。最小状态应能区分：

- 初始库存：1 份；
- 尚未施用；
- 施用周：Week 1 或 Week 2；
- 终局剩余资产。

硬规则：

- Week 1 使用只给 Week 1 `+6`；
- Week 2 使用只给 Week 2 `+6`；
- Week 1 使用后 Week 2 不得再次加成；
- 未使用时终局资产为 1，使用后为 0；
- 化肥决定只有在玩家看得到“当前风险 vs 期末保留资产”的取舍且最终状态保持时，才可能被人工裁定为有效承诺。

### 2.4 单一周相位真值

新增共享周边界模块，建议 API：

```ts
weekIndexForTick(tick: number, scenario: ScenarioDefinition): 0 | 1
```

场景 `0.5.0` 显式声明：

```text
weekStartTicks = [54, 1062]
weekEndTicks   = [1002, 2010]
```

边界合同：

| tick | 含义 | weekIndex |
|---:|---|---:|
| `54` | Week 1 起点 | `0` |
| `1002` | Week 1 recap 的源 tick | `0` |
| `1062` | Week 2 起点 | `1` |
| `2010` | Week 2 终点 | `1` |
| `1003–1061` | 不可达间隙 | 必须拒绝，不得猜测周次 |

`CONTINUE_TO_NEXT_WEEK` 的 action envelope 保留源 tick `1002`，随后 state 原子跳到 `1062`。App、forecast、transport、selectors、engine 与 export 必须调用共享函数，不复制边界常量，不新增 `activeWeekIndex` 第二真值。

### 2.5 维修责任不是剧情菜单

周初维修例外只允许选择责任方向：

1. 乔磐承担；
2. 陈渡或苏霁交接；
3. 接受维修欠账。

人员承担与交接不能由摘要按钮直接加数值，必须：

```text
选择责任方向
→ 打开相应日程方案
→ 由玩家确认具体格子/范围
→ applyScheduleTransaction()
→ 粮食或维修供需即时变化
→ recap 与人物记录兑现
```

至少一种责任方向必须存在两个可完成、非严格劣势的日程实现，避免一个按钮对应唯一答案。

“接受维修欠账”是唯一可不改日程的方向，但必须写入简单场景状态并显示：

- 欠账期限；
- 每周累积代价；
- 兑现 tick 或 recap；
- 当前风险和下一次后果。

该状态只做 RC9 场景字段或窄 enum，不扩展为通用任务、义务或多月承诺引擎。

### 2.6 良好结果不强行复活危机

周结转正确性和决策密度分开验证：

- **正确性：** W2 初态必须精确来自 W1 actual；
- **玩法性：** W1 不同结果必须改变 W2 问题形态；
- W1 做得好时，W2 可以出现学习、储备或改善机会，不强制重新生成三场危机；
- 每种主要 W1 结果在 W2 至少有两个可完成响应；
- 不要求玩家每周覆盖固定数量的问题类别；
- 不处理某张卡也允许继续，但其持续后果必须可见。

---

## 3. RC9 协议、schema 与反作弊合同

### 3.1 新文档与版本

新增而不覆盖：

- `docs/product-specs/weekly-management-slice-playtest-v0.2.md`
- `docs/design-docs/weekly-plan-production-forecast-slice-v0.2.md`，声明 `derivedFrom` 为同目录 v0.1；v0.2 只适用于 RC9，v0.1 继续作为 RC8 authority
- `docs/exec-plans/active/2026-07-27-gate1a-rc9-test-operations.md`
- `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/player-packet-v0.2.md`
- `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/post-session-interview-v0.2.md`
- `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/templates/sample-record-v2.json`
- `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/templates/validity-decision-v2.md`

冻结字段：

- `scenarioVersion=0.5.0`
- `schemaVersion=gate1-playtest-v2`
- `protocolVersion=weekly-management-slice-playtest-v0.2`
- `playerPacketVersion=gate1a-rc9-player-packet-v0.2`
- `postSessionInterviewVersion=gate1a-rc9-interview-v0.2`

玩家包、UI 和 agent 指令不得透露 `3–5`、问题类别数量、方案指纹目标、anti-pass 轨迹或所谓正确策略。

`g1a-20260727-rc9-01` 是本计划在 2026-07-27 预先分配的批次身份，不声称是未来实际开跑时间；开跑时间另记 UTC 时间戳。若该 ID 在 Issue 创建前发生冲突，必须先修订并重新审查本计划，不能由实施者临场改名。

### 3.2 机器候选与人工权威

浏览器 v2 导出：

- 保留 `candidateEditGroups`，供 legacy 编辑诊断；
- 新增 `candidateManagementCommitmentGroups`；
- 不输出名为 `effective*` 的机器结论。

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
    kind: 'forecast' | 'schedule' | 'inventory' | 'risk' | 'character-record' | 'recap'
    id: string
  }>
  beforeDecisionStateHash: string
  finalDecisionStateHash: string
  finalOutcomeCode: string
  finalDisposition: 'committed' | 'reverted' | 'default-maintained'
}
```

导出还必须包含该组引用的 `choiceSet`：

```ts
{
  choiceSetId: string
  decisionIntentId: string
  options: Array<{
    optionId: string
    reachable: boolean
    visibleConsequenceRefs: string[]
    dominanceStatus: 'non-dominated' | 'dominated' | 'unverified'
  }>
  selectedOptionId: string | null
}
```

一个意图只有在当前状态下存在至少两个**可达、后果可见且经穷举验证为 `non-dominated`** 的方案时，才可能被人工裁定为管理承诺；`unverified` 不得按未支配处理。只有唯一合理/可行方案的动作归为 housekeeping，不进入有效承诺。摘要主 CTA 只能打开 choice comparison 或定位日程，不得直接改变权威状态或生成 `committed` candidate。

comparison 首次展示还必须满足：

- 所有当前可行方案在首次 authority mutation 前同时可见；
- 无 `recommended`、默认选中、绿色 primary 或 primary/secondary 视觉权重；
- 初始焦点落在中性标题/容器或关闭控件，不落在提交方案的控件；
- 未显式选择方案时，Enter/Space 不得提交；
- 选项使用同层级 class、ARIA role 与说明结构，差异只来自真实后果内容。

权威关系：

1. 浏览器候选负责完整、可重算地保留轨迹；
2. 运营负责人依据 raw、候选组、recap、访谈与观察逐项人工裁定；
3. `sample-record.json` 分别保存 `legacyEffectiveEdits` 与 `effectiveManagementCommitmentsV2`；
4. 人工裁定可以否决机器候选，但不能补记 raw 中不存在的动作或状态；
5. 人工与机器不一致必须写明候选 ID、证据与理由；
6. Gate 汇总只使用人工裁定后的 `effectiveManagementCommitmentsV2`。

### 3.3 决策语义投影

`beforeDecisionStateHash` 与 `finalDecisionStateHash` 禁止直接复用包含历史噪声的 `stableStateHash()`。新增 `decisionRelevantStateProjection(state, decisionIntentId)`，只投影由该意图直接控制的权威语义：

- resolved schedule layers 的相关格；
- 该意图直接改变的粮食/维修库存字段；
- 化肥意图的库存和施用周；
- pump、维修责任与欠账状态；
- 林禾请求的最终决定和 resolution source；
- 运输路线；
- 相关人物记录。

forecast、recap 与其他意图共享的派生结果只进入 `consequenceRefs` 作为后果证据，不进入 disposition hash；否则化肥等后续动作会污染早先的日程意图。

明确排除：

- `actionLog`、`timeline`、`scheduleTransactions` 历史；
- UUID、sequence、墙钟/monotonic 时间；
- pause、speed、焦点、展开状态；
- telemetry 与 capture metadata。

投影采用键名排序的 canonical JSON，再做 SHA-256。同一意图完全恢复其投影时为 `reverted`，即使历史日志仍保留；其他意图后续变化不得污染该组的最终比较。

快照时点：

- before hash 在该 intent 第一次 authority-mutating action 应用前封存；
- final hash 在该 intent 每次 commit/undo/redo 完成后更新为当时的 intent-specific projection；
- 后续其他 intent 不得回算或覆盖旧组 hash；
- 同一 intent 后续再次编辑时才允许更新自身 final hash，并保留完整 action IDs；
- fixture 必须覆盖“两个意图共享 forecast，但互不污染 disposition hash”。

### 3.4 稳定意图与 undo/redo 聚合

`decisionIntentId` 必须由周次与领域问题实例稳定生成，不由 UI 按钮或随机 UUID 决定。例如：

```text
w0:food-plan
w0:repair-responsibility:pump-incident-day-3
w1:character-request:lin-he-study
w1:transport-route
w1:asset-use:fertilizer
```

聚合算法：

1. 以 `decisionIntentId + weekIndex` 分组；
2. action 按 sequence 排序；
3. 保存所有原动作、撤销引用和重做动作；
4. 由最终权威状态计算 `finalDisposition`；
5. 完全恢复原状态为 `reverted`，人工有效数为 0；
6. 明确拒绝或保持默认只有产生持久、非默认后果时，才可成为 `committed`；
7. 同一意图无论修改多少格、撤销或重做多少次，最多人工计 1；
8. 不同意图不得仅因同属一个问题类别而合并。

accepted 人物请求必须进入 `candidateEditGroups` 和相应管理承诺候选；declined 不进入 legacy 编辑候选，且仅在确实写入非默认人物记录或持续后果时，才进入管理承诺候选。

### 3.5 分类决策表

| 行为 | legacy 候选 | 管理承诺候选 | 人工可能有效的必要条件 |
|---|---:|---:|---|
| 日程事务最终保留 | 是 | 是 | choice set 合格，且改变可见供需、人物或风险 |
| 日程事务完全撤销 | 保留轨迹 | 是，`reverted` | 否 |
| accepted 林禾请求 | 是 | 是 | 日程与人物记录均兑现 |
| declined 林禾请求 | 否 | 条件式 | 存在持久、非默认后果 |
| 选择维修人员但未确认日程 | 否 | 否 | 未形成承诺 |
| 接受维修欠账 | 否 | 是 | choice set 合格，且期限、累积代价与兑现点已写入状态 |
| 打开运输捷径 | 是 | 是 | 与保留原路线的可见反事实并列，且路线、损耗或供需改变 |
| 使用化肥 | 否 | 是 | 与保留资产的可见反事实并列，生效周唯一且终局资产减少 |
| 保留化肥不使用 | 否 | 条件式 | 玩家有显式非默认保留决定且终局资产可见 |
| 打开卡、定位、暂停、倍速、继续 | 否 | 否 | 永不计数 |

### 3.6 schema fixture 与 oracle 最低集

Phase 0 必须先冻结不少于 20 个 JSON fixtures：

1. v1 合法 complete；
2. v1 合法 blocked；
3. v2 accepted request 正例；
4. v2 declined 且有持久后果正例；
5. v2 declined/默认但无持久后果反例；
6. v2 维修人员方向已选但未提交日程反例；
7. v2 接受欠账正例；
8. v2 化肥 W1 使用且 W2 不重复生效正例；
9. v2 同一意图 edit → undo → redo 聚合正例；
10. v2 完全撤销反例；
11. v1/v2 混合字段拒绝；
12. 不可达 tick `1003–1061` 拒绝。
13. 摘要主 CTA 只打开比较界面、零 committed candidate；
14. 只有一个可行方案时归 housekeeping；
15. 相同最终语义、不同动作顺序与历史日志得到相同 decision hash；
16. 不同最终选择得到不同 decision hash。
17. 两个意图共享 forecast 字段但 decision hash 互不污染；
18. comparison 无预选/推荐/提交焦点，打开时零 authority mutation。
19. 相同 continuation policy 配对得到唯一 dominance 结果；
20. policy 集不完整或不一致时标记 `unverified` 且不计数。

Phase 0 同时冻结 `fixture-expectations.json` 和独立 conformance oracle，逐项声明 `accept/reject`、expected groups、decision hashes 与失败码。fixture 必须同时被 export 单元测试与 capture host validator 使用；分类器与 host 不得各自发明第二套字段规则。Phase 0 只冻结 oracle，Phase 4 才要求 production export 与 host 分别通过同一 fixture 集。

### 3.7 方案指纹与 anti-pass

`finalOutcomeCode` 使用稳定生成规则：

- 预定义 choice 使用 `finalDisposition + ":" + selectedOptionId`；
- 自定义日程方案使用 `finalDisposition + ":schedule:" + SHA-256(activity, scope, sorted affected cells)`；
- `reverted/default-maintained` 使用固定字面值，不使用 UI 文案。

方案指纹只作诊断数据，不作为“没有统治路线”的 PASS 证明。每周诊断指纹定义为按 `decisionIntentId` 排序的 `decisionIntentId + finalOutcomeCode` canonical JSON 的 SHA-256；排除动作顺序、UUID、时间和撤销噪声。fixtures 必须证明：

- 不同操作顺序、相同最终结果 → 相同指纹；
- 任一最终 choice 改变 → 指纹改变。

是否存在严格统治由 branch matrix 和 UI 选项显著性审查裁定，不由样本中偶然出现两个指纹替代。

冻结前必须运行两条确定性反作弊路径，不进入正式分母：

1. **显眼 CTA 路径：** 每张摘要卡只点最显眼按钮，不查看反事实、不确认所需日程；
2. **最小干预路径：** 不逐卡处理，让问题自然结算，只做完成流程必需操作。

机械断言：

- 摘要主 CTA 自身不得改变 simulation authority state；
- 摘要主 CTA 自身不得生成 `committed` candidate；
- comparison 打开后所有可行选项同时显示，class/ARIA 层级一致，无 `recommended`、无预选、无提交型初始焦点；
- 未显式选项时 Enter/Space 不提交，首次 authority mutation 只能发生于玩家明确选择具体方案后；
- 只有进入比较/日程界面并确认一个合格 choice set 的最终方案，才可能生成候选；
- 不增加“展开—比较—确认”之外的形式摩擦来冒充决策。

若显眼 CTA 路径可以机械获得 3 个“有效”管理承诺，或未形成持久后果/合格 choice set 的按钮被计入，候选构建不得冻结。

---

## 4. RC9 Gate 1A 判定合同

### 4.1 正式样本

- 主样本：`A38–A44`；
- 替补：从 `A45` 递增，至少预留 `A45/A46`；
- 诊断样本：`TECH-RC9-D01` 起；anti-pass 样本：`TECH-RC9-P01` 起；
- 诊断样本永久排除 Gate 1A、Gate 1H 正式分母；
- host、SessionGate 与 fixtures 必须显式允许 `TECH-RC9-Dxx` 与 `TECH-RC9-Pxx`，但不得放宽其他非法 ID。

### 4.2 `AGENT_PROXY_PASS`

必须同时满足：

- 7 个有效样本均有独立 raw、SHA sidecar、canonical receipt、浏览器下载、sample record、validity decision 和 verbatim output；
- 无 cohort 指纹或隔离违规；
- 至少 6/7 能从摘要复述三个关键问题并完成两周核心流程；
- Week 1 与 Week 2 的人工 `effectiveManagementCommitmentsV2` 中位数分别为 `3–5`，不合并 14 个“agent—周”样本；
- 至少 6/7 在第二周既不完整检查，也不完整重排；
- 至少 6/7 能依据界面解释一次预测变化；
- 至少 6/7 能复述一名人物及其决策影响；
- 至少 5/7 通过可观察动作让地图进入决策；
- 无未解决 P0；
- 不存在同一根因聚类包含 3 个或以上独立 P1；
- anti-pass 两条轨迹均通过。

`legacyEffectiveEdits` 只做诊断，不参与 RC9 PASS。

### 4.3 `AGENT_PROXY_CONDITIONAL`

仅当以下条件全部满足：

- 核心“计划—预测—事件—复盘”因果成立；
- 只有以下 agent 比例指标中的一项仅差 1 个 agent：摘要/完成 `6/7`、第二周无完整检查与重排 `6/7`、预测解释 `6/7`、人物复述 `6/7`、地图参与 `5/7`；
- W1/W2 人工承诺中位数任一不在 `3–5` 时不得使用 conditional；
- 无未解决 P0；
- 问题可由局部信息架构、反馈或数值调整解决；
- 不需要再次改变构念或引入大型系统。

一旦修改 RC、协议、数值或玩家包，旧 cohort 不能局部补测升级为 PASS，必须重开完整七样本 cohort。

### 4.4 `AGENT_PROXY_FAIL`

出现任一条件即 FAIL：

- 任一代理阈值差距超过 conditional 范围；
- 两项或以上阈值失败；
- 存在未解决 P0；
- 同一根因聚类包含 3 个或以上独立 P1；
- 多数 agent 无法完成核心流程、理解继承或解释预测；
- anti-pass 轨迹可以机械刷出有效承诺；
- 需要再次改变基本模型或引入大型系统；
- cohort 因全局阻断无法取得七个有效样本。

无论 Gate 1A 结论如何：

```text
Gate 1H = PENDING
Gate 2  = LOCKED
```

---

## 5. 实施阶段与退出条件

依赖顺序固定为：

```text
协议/schema
→ 库存与化肥
→ 周相位
→ 维修责任领域动作
→ classifier/host
→ UI 与平衡
→ E2E/capture/determinism
→ 候选封存与 anti-pass
→ 五个诊断样本
→ candidate manifest
→ 独立冻结审查
→ 独立 seal
→ 正式 cohort
```

### Phase 0 — 协议与 schema 冻结

输入：失败基线与本计划精确 SHA。

输出：

- v0.2 切片规格、playtest 协议、RC9 运营合同；
- v2 schema、分类决策表、fixtures；
- 新玩家包、访谈和 sample/validity 模板的源模板；
- RC8 cohort tree/hash guard 基线。

退出条件：

- v1/v2 fixtures 均可解析，且每个 fixture 标明预期接受或拒绝结果；
- 决策表能唯一判断 v2 正反 fixture 和 v1/v2 混合字段；
- `npm run schema:fixtures` 以独立 conformance oracle 得到全部预期结果；
- 人工—机器权威关系无歧义；
- RC8 全目录零变化。

production export 与 host 对这些 fixtures 的真实通过/拒绝验证在 Phase 4 完成；Phase 0 不修改运行时代码。

失败回退：只修协议/schema；不得启动生产代码。

### Phase 1 — 库存、化肥与双供需 recap

输入：Phase 0 已审查合同。

输出：

- state 中可结转粮食、维修库存；
- 化肥库存/施用周/终局资产；
- 双供需 recap；
- 确定性领域测试。

退出条件：

- W2 current stock 精确等于 W1 actual；
- recap 不双重结算；
- W1/W2 施肥边界与终局资产测试通过；
- 相同初态与动作得到相同 state、forecast、recap。

失败回退：回到 Phase 1 状态模型，不以 UI 补偿错误。

### Phase 2 — 周相位与 tick 1062

输入：Phase 1 状态模型。

输出：

- 共享 `weekIndexForTick()`；
- `weekStartTicks=[54,1062]`；
- 换周原子跳转；
- App、forecast、transport、selectors、engine、export 统一周归属。

退出条件：

- `54 / 1002 / 1062 / 2010` 边界表通过；
- `1003–1061` 拒绝；
- 第二周编辑、短路成本、地图、时钟、forecast、recap、export 全部归 W2；
- action envelope 的换周源 tick 仍是 `1002`。

失败回退：不得新增第二个 current-week 状态。

### Phase 3 — 维修责任领域动作

输入：Phase 2 周相位。

输出：

- 责任方向状态；
- 人员承担/交接经 `applyScheduleTransaction()` 落入日程；
- 欠账期限、代价与兑现；
- 对应领域事件、人物记录和测试。

退出条件：

- 三条路径都能完成两周；
- 至少一条人员路径有两个可行日程实现；
- 三条路径至少在粮食、维修、人物记录或终局资产之一不同；
- 没有一条在全部可见指标严格占优；
- 只选方向不确认日程不会获得数值或候选承诺。

失败回退：回到领域动作；不得用摘要按钮直接改 forecast。

### Phase 4 — classifier、recorder 与 capture host

输入：Phase 0 schema + Phase 3 最终领域动作。

输出：

- accepted request 补入 legacy candidate；
- v2 candidate management classifier；
- 稳定 intent、before/after hash、undo/redo 聚合；
- v1/v2 严格 validator；
- `TECH-RC9-Dxx` 命名支持。

退出条件：

- accepted request 恰好一个 legacy group；
- declined 为零 legacy group；
- 管理承诺正反 fixtures 全部匹配决策表；
- blocked/complete 两种 v2 均可保存；
- `npm run schema:fixtures` 通过；
- `npm run test:run -- tests/export.test.ts tests/playtest-host.test.ts` 证明 production export 与 host 分别通过同一 fixture oracle。

失败回退：不得先改 UI 绕过 classifier 缺口。

### Phase 5 — 摘要 UI、反事实与数值分支

输入：Phase 3/4 已冻结领域接口。

输出：

- 摘要只显示问题、后果和责任方向；
- 责任方向进入可选择的日程方案；
- 粮食/维修即时反事实；
- branch matrix 与数值说明。

branch matrix 必须覆盖：

- 三条维修责任路径；
- accepted/declined 人物请求；
- north-loop/south-shortcut；
- 化肥 W1/W2/未使用边界；
- W1 主要结果到 W2 响应。

对所有可能进入 `effectiveManagementCommitmentsV2` 的 choice set，必须由冻结的 `branch-matrix-oracle` 列出：

- `choiceContextId`：选择发生前的权威状态投影；
- 具体、可执行的 `optionId`；若一个责任方向有两种日程实现，它们使用两个 option ID；
- 所有后续 `continuationPolicyId`：对剩余 choice set 的确定性选择组合；
- 每个 `optionId × continuationPolicyId` 到 `tick=2010` 的结果向量。

只有 oracle 中明确列出的 option 才可获得 `non-dominated`；完整周表仍允许任意自定义编辑，但未映射到 oracle 的自定义实现标记 `unverified`，只能进入 legacy 编辑诊断，不进入 v2 Gate 计数。

支配比较使用从选择时点到 `tick=2010` 的玩家可见结果向量：

- W1/W2 粮食期末值：越高越好；
- W1/W2 维修保障期末值：越高越好；
- 未偿维修欠账与累计代价：越低越好；
- 人物负荷/状态代价：越低越好；
- 运输损耗：越低越好；
- 终局保留化肥：越高越好；
- 林禾学习/人物承诺兑现：已兑现优于未兑现。

唯一算法：

1. A 与 B 必须拥有完全相同且完整的 `continuationPolicyId` 集；不同则两者为 `unverified`。
2. 对每个相同 policy，配对比较 `V(A, policy)` 与 `V(B, policy)`，禁止把 A 的最优未来与 B 的最差未来比较。
3. 若对所有 policy、所有结果轴 A 都不差于 B，且至少一个 `policy × axis` 严格更优，则 A 严格支配 B。
4. 一个 option 被任一其他 option 严格支配时为 `dominated`；完整穷举且未被支配时为 `non-dominated`；缺少状态、option、policy 或结果时为 `unverified`。
5. choice set 至少有两个 `non-dominated` option 才可能形成有效管理承诺。

每个轴的数值或序数及方向必须在 UI/recap 可见，不能使用隐藏分数。穷举测试与 conformance oracle 计算 `dominanceStatus`，production export 只引用 oracle 结果，不得自行声明。无法穷举的 choice set 标记 `unverified`，不得计入 Gate 主指标。

pairwise 只允许覆盖不影响 Gate 计数的诊断分支，并必须列出未覆盖组合和理由；本两周固定场景的主指标 choice set 不接受 pairwise 替代穷举。

退出条件：

- W1 不同结果改变 W2 问题形态；
- 每种主要 W1 结果在 W2 至少两个可行响应；
- 良好 W1 可转为学习、储备或改善机会；
- 未处理卡片不锁运行；
- UI 状态单测与静态布局约束通过；真实 1440×900/1280×720 Playwright viewport 由 Phase 6/RC9-08 验收。

失败回退：任何数值或 UI 修改都使后续 Phase 6–11 证据失效并重跑。

### Phase 6 — 自动化与证据链验证

输入：Phase 5 候选源码。

必跑：

```bash
cd prototype
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npm run lint
npm run test:run
npm run build
npm run rc:build -- --build-id <candidate-build-id> --git-sha <source-sha>
npm run rc:verify
npm run e2e:rc
npm run rc:archive -- --input dist --output <archive-path> --source-date-epoch <fixed-epoch>
npm run rc:verify-archive -- --input dist --archive <archive-path> --source-date-epoch <fixed-epoch>
npm run guard:rc8 -- --baseline c0f4269bc3fef56962199629bad8db041aafc5f0 --path ../data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01
npm run manifest:verify -- --manifest tests/fixtures/manifests/candidate-valid.json
npm run rc:repro -- --git-sha <source-sha> --build-id <candidate-build-id> --source-date-epoch <fixed-epoch>
```

验证矩阵：

| 维度 | 必须验证 |
|---|---|
| Determinism | 同动作序列的 state、forecast、双 recap、candidate groups 一致；导出比较排除 UUID/时间字段；两个 clean clone 的 artifact 与 UTC archive 逐字节一致 |
| Complete capture | v2 完整场；首次保存失败后的 same-bytes retry；raw/sidecar/receipt/download 一致；成功保存后才允许清空 |
| Blocked capture | 中途阻断；`tick=2010/isComplete=false` 终局阻断；失败后 same-bytes retry；complete/blocked 模式矛盾拒绝 |
| Schema | v1 complete/blocked 继续通过；v2 通过；v1/v2 混合字段拒绝；非法 sample ID 拒绝 |
| Week boundary | `54/1002/1062/2010` 与不可达间隙；第二周短路成本、请求与日程归属一致 |
| Inventory | W1 actual→W2 stock；双供需 recap；W1/W2/未使用化肥 |
| Branch | 所有 Gate 计数 choice set 在全部可达状态下穷举并验证 dominance；非计数诊断分支可 pairwise；主要 W1 结果各有两个 W2 响应 |
| Choice comparison | 同时展示、同层级 class/ARIA、无 recommended/预选/提交焦点；未选择时 Enter/Space 零提交；首次 mutation 发生在明确选项提交后 |
| Viewport | 1440×900、1280×720 下的周初摘要、责任展开、完整周表、两次 recap、保存/阻断面板 |
| RC8 guard | RC8 cohort 全目录前后 Git tree 与逐文件 SHA-256 一致 |

RC9-01 先新增并冻结：

- `scripts/verify-tree-guard.mjs` → `guard:rc8`，同时比较 Git subtree tree ID 和逐文件 SHA-256 inventory。

RC9-08 再新增并在 `package.json` 暴露：

- `scripts/create-deterministic-archive.mjs` → `rc:archive`
- `scripts/verify-deterministic-archive.mjs` → `rc:verify-archive`
- `scripts/verify-playtest-manifest.mjs` → `manifest:verify`
- `scripts/verify-reproducible-rc.mjs` → `rc:repro`

UTC archive 使用固定排序、owner/group、mode、mtime、locale 和 `SOURCE_DATE_EPOCH`；`rc:repro` 从同一 source SHA 创建两个独立 clean clone，分别构建并逐字节比较 dist manifest 与 UTC archive。`guard:rc8` 同时比较 Git subtree tree ID 与逐文件 SHA-256。所有真实命令与输出进入候选证据。

退出条件：矩阵全部 PASS，无跳过项。

失败回退：回到产生差异的最早 Phase；修复后重跑 Phase 6 全矩阵。

### Phase 7 — 不可变 candidate attempt 与 anti-pass

候选尝试使用不可复用的递增命名空间：

```text
candidateAttempt=C01, C02, ...
data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C01/
```

每个 attempt 独立固定：

- source SHA 与 dependency integration SHA；
- 带 attempt 后缀的 candidate build ID；
- rc-dist artifact 与 UTC archive；
- 协议、运营合同、玩家包、访谈与 schema hashes；
- capture inventory；
- `candidate-build-manifest.json/.sha256`；
- 两条 anti-pass 的 raw、receipt、sidecar 与裁定。

anti-pass 技术编号独立递增：C01 使用 `TECH-RC9-P01/P02`，C02 使用 `P03/P04`，后续类推。host 只额外接受 `TECH-RC9-Pxx` 与 `TECH-RC9-Dxx` 两类严格格式。

退出条件：

- 摘要 CTA 的零 authority mutation / 零 committed candidate 机械断言通过；
- 两条轨迹不能机械刷出 3 个有效承诺；
- candidate build 与 source SHA 一致；
- `rc:repro`、`rc:verify-archive`、`guard:rc8`、`manifest:verify` 全通过；
- attempt core 封存后不可变：source/build、`rc-dist/**`、archive、authority hashes、player packet、candidate-build manifest 及 anti-pass 既有文件不得覆盖或改写；
- 封存后只允许向此前不存在的 `diagnostics/**`、`evidence/**` 或 `rejection-record.*` 路径追加文件；任何既有文件仍不可覆盖。

失败时在该 attempt 内新增 `rejection-record.json/.sha256`，状态 `REJECTED_PRE_DIAGNOSTIC`；该 attempt 永久只读。回 Phase 3–6 后必须创建下一 attempt、新 build ID 和新的 P/D 编号，绝不覆盖 C01。

### Phase 8 — 每 attempt 五个盲诊断样本

编号按 attempt 连续分配：

```text
C01 → TECH-RC9-D01 ... TECH-RC9-D05
C02 → TECH-RC9-D06 ... TECH-RC9-D10
C03 → TECH-RC9-D11 ... TECH-RC9-D15
```

合同：

- 五个全新独立 agent，`fork_turns=none`；
- 串行运行同一 attempt 的 candidate build；
- 不读取设计、阈值、其他样本或 anti-pass 路径；
- 每场导出、下载、保存 raw/sidecar/receipt、清空；
- 诊断写入对应 `candidates/Cxx/diagnostics/`，汇总清单位于 `diagnostics/manifest.json/.sha256`；
- 永久排除正式分母。

诊断通过只表示“未发现明显反证”，不表示证明有效或 Gate PASS。最低条件：

- 无 P0；
- 五场均能完成两周；
- W1 与 W2 的人工 `effectiveManagementCommitmentsV2` 中位数分别都在 `3–5`；
- 同时人工报告两周 `legacyEffectiveEdits`，确认责任模型没有退化为更多排班劳动；
- 没有必须点完卡片才能运行；
- 承诺不由重复改同一意图堆出；
- 方案指纹分布只记录为诊断数据，不作为通过阈值。

任一周中位数低于 3 或高于 5、CTA 刷数、P0 或流程阻断，都在该 attempt 内生成 `rejection-record.json/.sha256` 并拒绝。任何 Phase 3–7 改动后，原 attempt 与全部诊断永久保留但作废，重跑 Phase 6、anti-pass 与新的五个诊断样本。

### Phase 9 — 递增 RC9 candidate manifest

选中一个诊断通过的 attempt 后，分配不可复用的 `candidateManifestId=CM01, CM02, ...`，在下列目录生成只读 manifest：

```text
candidate-manifests/CM01/candidate-manifest.json
candidate-manifests/CM01/candidate-manifest.sha256
```

状态：

```text
PENDING_INDEPENDENT_REVIEW
```

manifest 固定：

- 被选 `candidateAttempt` 与其 manifest hash；
- source、dependency integration、build、scenario、schema；
- artifact、UTC archive；
- authority documents；
- 玩家包、访谈、capture host；
- diagnostic manifest 与五场结果；
- anti-pass 结果；
- RC8 guard；
- Phase 6 命令与输出摘要；
- 所有先前 rejected attempt 的 ID 与 rejection hash。
- 同目录 `freeze-preparation-audit.md`。

生成后不得原地改写。任何内容变化都使该 CMxx 作废；修复后从新 Cxx 重新构建、测试、诊断，并生成新 CMxx。IRxx 必须引用具体 CMxx。失败 CMxx 永久保留，不能由根目录固定文件覆盖。

### Phase 10 — 独立冻结审查

由未承担候选制备的独立 review agent 只读审查：

- source 与 artifact 一致；
- candidate manifest ID 与 hash；
- schema/host/capture；
- anti-pass 与五场诊断；
- 玩家包无诱导；
- RC8 不变；
- `P0=0 / P1=0`。

审核使用递增且不复用的 `review-id=IR01, IR02, ...`。输出位于 candidate manifest 外部的 `evidence/reviews/IRxx/`，保存 review record 与 hash。

审查重试纪律：

- 任一已经形成实质 `P0` 或 `P1` 的 IR，立即永久拒绝对应 CMxx 和其引用的 Cxx；
- 被拒 Cxx 不得重新包装为新 CMxx，也不得通过更换 reviewer 获得第二个实质结论；
- 修复必须创建新 source SHA → 新 Cxx → 新诊断 → 新 CMxx → 新 IRxx；
- 只有 review 文件损坏、agent/tool 中断、没有形成任何实质结论时，才可记为 `INVALID_TECHNICAL` 并对同一 CMxx 分配新 IRxx；
- 技术无效记录必须先保存原因与 hash，seal 必须读取该 CM/C 的全部 IR 历史，不能选择性忽略失败审查。

实质审查失败时在同目录保存 `rejection-record.json/.sha256`，状态 `REJECTED_INDEPENDENT_REVIEW`；不得回写 candidate manifest，也不得进入 seal。

### Phase 11 — 独立 seal

由不同于 freeze-preparation agent 和 review agent 的 seal agent，在 review record 已提交并哈希固定后分配不可复用的 `sealAttemptId=S01, S02, ...`，并在 `seals/Sxx/` 生成 seal record。seal 只引用：

- 获准 candidate manifest ID 与 hash；
- independent review hash；
- source SHA；
- artifact/archive hashes；
- freeze、review、seal 三个 agent task ID；
- seal 状态。

seal record 不反向改写 candidate manifest 或 review。重试纪律：

- 只有纯技术写入失败、且 CM/review/artifact/archive 引用 hash 全部不变时，才可递增 Sxx 重试；
- 任一 authority/hash 不匹配都永久拒绝对应 CMxx/Cxx，不得直接返回 RC9-12 更换 reviewer；
- 修复后必须从新 Cxx → 新 CMxx → 新 IRxx → 新 Sxx 完整重走；
- seal 必须枚举同一 CM/C 的全部 IR 记录，并证明不存在任何实质失败 IR；
- 任何失败都在该 Sxx 写外置 rejection record，不生成成功 seal。

若需要根级入口，只能在 seal 成功时一次性生成 `sealed-candidate-index.json/.sha256`，只引用获准 CMxx 与 seal hash；不得作为可变 “latest” 指针，也不得覆盖历史 manifest。

根级 sealed index 一旦生成后若发现 seal 无效，本 cohort 立即作废并保留全部证据；不得在同 cohort 生成第二个 index，必须分配新的 cohort ID。

### Phase 12 — A38–A44 正式 cohort

- 创建 A38–A44 七个正式样本 Issue，A45/A46 只预留；
- `/root` 担任测试运营负责人；
- 冻结制备、独立审查、seal 和正式运营由不同责任单元承担；
- 七名独立 player agent；
- 严格串行：前一场 evidence、validity 和 Git 提交完成后才启动下一场；
- 技术无效只使用递增替补，不复用编号；
- 正式样本只收到中性玩家包。

最终输出：

- 七个有效样本；
- 逐场访谈；
- `legacyEffectiveEdits` 与 `effectiveManagementCommitmentsV2` 人工裁定及机器对账；
- 两周中位数、诊断性方案指纹、完整检查/重排；
- 预测、人物、地图证据；
- P0/P1/P2、症状与根因聚类；
- 唯一 `AGENT_PROXY_PASS / AGENT_PROXY_CONDITIONAL / AGENT_PROXY_FAIL`；
- 明确声明 Gate 1H=`PENDING`、Gate 2=`LOCKED`。

---

## 6. Issue 拆分与领取合同

所有 Issue 创建时必须把 `input_ref=<PLAN_COMMIT_SHA>` 替换为本计划最终提交 SHA，并在正文写入以下三类不可省略的 Git 引用：

- `plan_ref`：本计划最终提交 SHA，创建 Issue 时固定且永不变化；
- `base_ref`：所有 `depends_on` 已整合并通过验收后的精确 integration SHA；
- `output_ref`：该 Issue 完成时的精确提交 SHA 与验证 evidence 路径。

创建时：

- RC9-01 的 `base_ref` 就是计划提交 SHA；
- 其余 Issue 的 `base_ref=PENDING_DEPENDENCY_INTEGRATION`，并保持 blocked，不得领取；
- 前置完成后，由运营负责人生成单一 verified integration SHA，将正文中的 `base_ref` 替换为该 SHA 后才可改为 `ready-for-agent`；
- 多依赖时必须先集成全部 dependency output，不得任取一个 output SHA；
- 禁止从分支名、裸 `HEAD` 或工作树未提交状态开工；
- close Issue 前必须填写 `output_ref`，附验收命令输出，下一 Issue 的 `base_ref` 只允许引用该已验收整合提交。

每个 Issue 正文还必须保留：`depends_on`、允许修改、禁止修改、输出/交接物、验收命令、失败回退。以下各节中的 `input_ref` 等同固定 `plan_ref`；上述 `base_ref/output_ref` 模板自动进入每一个实际 GitHub Issue，遗漏即不得领取。

路径中的 `Cxx/Dyy/CMxx/IRxx/Sxx` 是计划级命名公式；RC9-09、RC9-10、RC9-11、RC9-12、RC9-13 在进入 `ready-for-agent` 前，Issue 正文必须由运营负责人替换为台账分配的具体编号，禁止实施者自行选号或保留占位符开工。

### RC9-01 — 协议、schema 与 RC9 运营合同

- `depends_on`: none
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `docs/product-specs/weekly-management-slice-playtest-v0.2.md`
  - `docs/design-docs/weekly-plan-production-forecast-slice-v0.2.md`
  - `docs/product-specs/index.md`
  - `docs/design-docs/index.md`
  - `docs/exec-plans/active/2026-07-27-gate1a-rc9-test-operations.md`
  - `prototype/tests/fixtures/playtest-v1/**`
  - `prototype/tests/fixtures/playtest-v2/**`
  - `prototype/tests/fixtures/fixture-expectations.json`
  - `prototype/tests/fixtures/manifests/candidate-valid.json`
  - `prototype/tests/fixtures/manifests/candidate-invalid-*.json`
  - `prototype/scripts/check-playtest-fixtures.mjs`
  - `prototype/scripts/verify-tree-guard.mjs`
  - `prototype/package.json`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/player-packet-v0.2.md`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/post-session-interview-v0.2.md`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/templates/**`
- 禁止修改：`prototype/src/**`、除 `check-playtest-fixtures.mjs` 与 `verify-tree-guard.mjs` 外的 `prototype/scripts/**`、所有既有 cohort
- 输出：协议/schema 决策表、至少 20 个 playtest fixtures、candidate manifest 正反 fixtures、运营模板、可运行的 RC8 tree + SHA-256 inventory guard
- 验收：
  - `git diff --check`
  - `cd prototype && npm run schema:fixtures`
  - `cd prototype && npm run guard:rc8 -- --baseline c0f4269bc3fef56962199629bad8db041aafc5f0 --path ../data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01`
- 失败回退：保持 `NOT_STARTED`，不得启动 RC9-02

### RC9-02 — 库存、化肥与双供需 recap

- `depends_on`: RC9-01
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `prototype/src/sim/model.ts`
  - `prototype/src/sim/forecast.ts`
  - `prototype/src/sim/engine.ts`
  - `prototype/src/scenario/gate1-week-one.ts`
  - `prototype/tests/engine.test.ts`
  - `prototype/tests/forecast.test.ts`
- 禁止修改：UI、telemetry、host、E2E、文档协议、旧 cohort
- 输出：状态迁移、双 recap、化肥生命周期与领域测试提交
- 验收：`npm run test:run -- tests/engine.test.ts tests/forecast.test.ts`；`npm run lint`
- 失败回退：回退本 Issue 自身提交，不改变协议

### RC9-03 — tick 1062 与共享周相位

- `depends_on`: RC9-02
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `prototype/src/sim/week-phase.ts`
  - `prototype/src/sim/model.ts`
  - `prototype/src/sim/engine.ts`
  - `prototype/src/sim/forecast.ts`
  - `prototype/src/sim/transport.ts`
  - `prototype/src/sim/selectors.ts`
  - `prototype/src/scenario/gate1-week-one.ts`
  - `prototype/src/telemetry/export.ts`
  - `prototype/src/app/App.tsx`（仅迁移周相位读取）
  - `prototype/src/app/MapPanel.tsx`（仅迁移周相位读取）
  - `prototype/tests/week-phase.test.ts`
  - `prototype/tests/App.test.tsx`
  - `prototype/tests/engine.test.ts`
  - `prototype/tests/forecast.test.ts`
  - `prototype/tests/transport.test.ts`
- 禁止修改：UI 文案、host、协议、旧 cohort
- 输出：共享周边界 API、调用点迁移、边界表测试
- 验收：`npm run lint`；`npm run test:run`
- 失败回退：不得新增 `activeWeekIndex`；回到 RC9-02 状态

### RC9-04 — 维修责任领域动作

- `depends_on`: RC9-03
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `prototype/src/sim/model.ts`
  - `prototype/src/sim/engine.ts`
  - `prototype/src/sim/schedule.ts`
  - `prototype/src/sim/forecast.ts`
  - `prototype/src/scenario/gate1-week-one.ts`
  - `prototype/tests/engine.test.ts`
  - `prototype/tests/forecast.test.ts`
  - `prototype/tests/repair-responsibility.test.ts`
- 禁止修改：`App.tsx`、CSS、telemetry、host、E2E、旧 cohort
- 输出：三责任路径、日程事务、欠账兑现、人物记录测试
- 验收：`npm run lint`；`npm run test:run`
- 失败回退：不得以魔法数值按钮替代日程事务

### RC9-05 — commitment classifier、recorder 与 host

- `depends_on`: RC9-04
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `prototype/src/telemetry/session.ts`
  - `prototype/src/telemetry/export.ts`
  - `prototype/src/app/SessionGate.tsx`
  - `prototype/scripts/playtest-host.mjs`
  - `prototype/tests/session.test.ts`
  - `prototype/tests/export.test.ts`
  - `prototype/tests/playtest-host.test.ts`
- 禁止修改：RC9-01 schema/fixtures、领域数值、摘要 UI、旧 cohort
- 输出：v2 classifier、choice set/intent 聚合、v1/v2 validator、TECH-RC9-Dxx/Pxx 支持
- 验收：`npm run lint`；`npm run schema:fixtures`；`npm run test:run -- tests/session.test.ts tests/export.test.ts tests/playtest-host.test.ts`
- 失败回退：不得让 host 静默接受未知字段

### RC9-06 — 摘要、责任日程 UI 与 viewport

- `depends_on`: RC9-05
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `prototype/src/app/App.tsx`
  - `prototype/src/app/ScheduleBoard.tsx`
  - `prototype/src/app/MapPanel.tsx`
  - `prototype/src/styles/app.css`
  - `prototype/tests/App.test.tsx`
- 禁止修改：领域计算、classifier、host、协议、旧 cohort
- 输出：不泄露答案的摘要、责任方向到日程确认、UI 状态单测；真实 1440×900/1280×720 viewport 由 RC9-08 Playwright 验收
- 验收：`npm run lint`；`npm run test:run`
- 失败回退：UI 不得直接写供需结果

### RC9-07 — branch matrix 与数值

- `depends_on`: RC9-06
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `docs/design-docs/gate1-rc9-branch-matrix.md`
  - `prototype/src/scenario/gate1-week-one.ts`
  - `prototype/src/sim/forecast.ts`
  - `prototype/src/sim/engine.ts`
  - `prototype/tests/branch-matrix.test.ts`
- 禁止修改：classifier、host、协议阈值、旧 cohort
- 输出：Gate 计数 choice set 的全可达状态穷举、可见结果向量与支配检查；非计数分支 pairwise；W1→W2 响应证明
- 验收：`npm run lint`；`npm run test:run`
- 失败回退：一种路线严格统治时回调数值，不增加强制事件

### RC9-08 — E2E、capture 与 determinism

- `depends_on`: RC9-07
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `prototype/e2e/**`
  - `prototype/tests/**`
  - `prototype/package.json`
  - `prototype/scripts/rc-build.mjs`
  - `prototype/scripts/verify-rc-build.mjs`
  - `prototype/scripts/playtest-host.mjs`
  - `prototype/scripts/create-deterministic-archive.mjs`
  - `prototype/scripts/verify-deterministic-archive.mjs`
  - `prototype/scripts/verify-playtest-manifest.mjs`
  - `prototype/scripts/verify-reproducible-rc.mjs`
- 禁止修改：`prototype/tests/fixtures/**`、`prototype/scripts/verify-tree-guard.mjs`、产品数值、协议阈值、旧 cohort 证据
- 输出：Phase 6 完整验证矩阵与可运行命令
- 验收：完整执行 Phase 6 命令，包括 `rc:archive`、`rc:verify-archive`、`guard:rc8`、`manifest:verify`、`rc:repro`，且 `npm run lint/test:run/build/rc:verify/e2e:rc` 全部通过
- 失败回退：定位到最早失败阶段；不得只更新 snapshot

### RC9-09 — candidate build 与 anti-pass

- `depends_on`: RC9-08
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/Cxx/rc-dist/**`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/Cxx/rc-dist.tar`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/Cxx/candidate-build-manifest.json`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/Cxx/candidate-build-manifest.sha256`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/Cxx/anti-pass/**`
  - 失败时同 attempt 的 `rejection-record.json/.sha256`
- 禁止修改：`prototype/src/**`、协议、玩家包、访谈、模板、旧 cohort
- 输出：声明实际 `candidateAttempt` 的 source/build/artifact/archive/authority hashes、两条 anti-pass raw 与裁定
- 验收：`rc:verify`、`rc:verify-archive`、`rc:repro`、`guard:rc8`、`manifest:verify` 与 anti-pass 全 PASS
- 失败回退：attempt 内写 `REJECTED_PRE_DIAGNOSTIC` 外置记录；递增到新 Cxx/Pxx，旧 attempt 不覆盖

### RC9-10 — 五个盲诊断样本

- `depends_on`: RC9-09
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/Cxx/diagnostics/TECH-RC9-Dyy/**`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/Cxx/diagnostics/manifest.json`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/Cxx/diagnostics/manifest.sha256`
  - 失败时同 attempt 的 `rejection-record.json/.sha256`
- 禁止修改：源码、构建、协议、玩家包、candidate manifest、旧 cohort
- 输出：该 attempt 连续 D 编号的五场 raw/sidecar/receipt/download、verbatim、人工 v2/legacy 裁定
- 验收：同 build/authority；严格串行；五场完整；无 P0；W1/W2 v2 中位数均为 `3–5`；legacy 双报；反刷检查
- 失败回退：保留并拒绝该 attempt；任何实现变化后从 RC9-08 开始新 Cxx/Pxx/Dxx

### RC9-11 — 冻结制备与 candidate manifest

- `depends_on`: RC9-10
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 允许修改：
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidate-manifests/CMxx/candidate-manifest.json`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidate-manifests/CMxx/candidate-manifest.sha256`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidate-manifests/CMxx/freeze-preparation-audit.md`
- 禁止修改：源码、artifact、协议、玩家包、诊断记录、旧 cohort
- 输出：具体 CMxx、状态为 `PENDING_INDEPENDENT_REVIEW` 的只读 manifest
- 验收：`manifest:verify` 及 authority/hash/source-tree/archive/diagnostic/anti-pass 全量复算；只引用一个通过的 Cxx，并列出旧 attempt rejection hashes
- 失败回退：manifest 不原地修补；作废后重跑 RC9-09–11

### RC9-12 — 独立冻结审查

- `depends_on`: RC9-11
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 责任隔离：不得由 RC9-11 实施者审查
- 允许修改：
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/IRxx/independent-freeze-review.md`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/evidence/reviews/IRxx/independent-freeze-review.sha256`
  - 审查失败时同目录 `rejection-record.json/.sha256`
- 禁止修改：candidate manifest、seal、源码、artifact、协议、玩家包、诊断、旧 cohort
- 输出：独立 `P0/P1/P2` 审查、review agent task ID、review hash；技术无效或实质拒绝的外置记录
- 验收：`P0=0 / P1=0`；所有 hash 复算；RC8 guard
- 失败回退：实质 P0/P1 永久拒绝 CMxx/Cxx，修复后从 RC9-09 新 attempt 重走；只有无实质结论的 `INVALID_TECHNICAL` 可对同一 CM 分配新 IR

### RC9-13 — 独立 seal record

- `depends_on`: RC9-12
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 责任隔离：seal agent 必须不同于 RC9-11 freeze agent 与 RC9-12 review agent
- 允许修改：
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/Sxx/seal-record.json`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/seals/Sxx/seal-record.sha256`
  - 失败时同 Sxx 的 `rejection-record.json/.sha256`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/sealed-candidate-index.json`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/sealed-candidate-index.sha256`
- 禁止修改：candidate manifest、review、源码、artifact、协议、玩家包、诊断、旧 cohort
- 输出：具体 Sxx 下仅引用获准 CMxx、该 CM/C 全部 IR 历史、review/artifact/archive hashes 与三个 agent task ID 的 seal，以及一次性 sealed index
- 验收：`manifest:verify`；全部 IR hash 已提交且无实质失败；`P0=0 / P1=0`；RC8 guard
- 失败回退：纯技术写入失败且引用不变可递增 Sxx；authority/hash 不匹配永久拒绝 CM/C 并从 RC9-09 新 attempt 重走；根 index 已生成后发现无效则本 cohort 作废、另开 cohort

### RC9-14 — A38–A44 正式 cohort 运营

- `depends_on`: RC9-13
- `input_ref`: `<PLAN_COMMIT_SHA>`
- 责任隔离：不得由 RC9-11 冻结者、RC9-12 审查者或 RC9-13 seal agent 代替 player agent
- 允许修改：
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/captures/**`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/samples/**`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/operations-ledger.md`
  - `data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/gate1a-final-report.md`
- 禁止修改：源码、artifact、manifest、协议、玩家包、阈值、旧 cohort
- 输出：A38–A44 七个有效样本；必要时 A45/A46 替补；最终唯一代理结论
- 验收：每场 complete/blocked 合同、串行 isolation、人工/机器对账、§4 决策表
- 失败回退：技术无效用下一编号；产品负面结果保留并进入最终结论，不得改判技术无效

---

## 7. 两阶段封存和不可变规则

### 7.1 候选封存

RC9-09 固定 candidate source/build/artifact/archive/authority 与 candidate-build manifest；诊断只能使用这一候选。

### 7.2 正式 seal

RC9-10 诊断通过后，RC9-11 生成 `PENDING_INDEPENDENT_REVIEW` candidate manifest；RC9-12 生成外置独立审查记录，RC9-13 再由不同 agent 生成 seal record。

以下任一变化都使 candidate、诊断、审查和 seal 失效：

- 源码；
- 数值；
- schema；
- 协议或运营合同；
- 玩家包或访谈；
- capture host；
- candidate manifest 内容；
- artifact 或 archive。

失效后必须重新构建、运行 Phase 6、anti-pass、五个诊断样本和独立审查，不能只补一个 hash。

---

## 8. 风险与停止条件

### 8.1 主要风险

- **构念粉饰：** 保留 `3–5` 数字但不承认被计数对象已改变。
- **逐卡刷数：** 每张卡点一个 CTA 即获得承诺。
- **剧情菜单：** 维修责任绕过日程表和供需反事实。
- **双重结算：** recap 与换周重复写库存。
- **一次资产重复生效：** Week 1 化肥在 Week 2 再加成。
- **双周真值：** tick 与另一 phase 字段再次分裂。
- **固定危机：** 为决策密度否定优秀 W1 带来的改善。
- **agent 过拟合：** agent 能解释不代表真人有趣或易用。
- **范围膨胀：** 借责任/欠账扩展为通用任务系统或 Gate 2。

### 8.2 必须停止

- v2 无法给出稳定意图、后果引用和人工裁定例子；
- 显眼 CTA 可以机械得到 3 个有效承诺；
- 人员责任不经 `applyScheduleTransaction()`；
- 一条维修路径在全部可见指标严格占优；
- W2 库存不能唯一由 W1 actual 推导；
- 化肥跨周重复生效；
- RC8 任一文件发生变化；
- candidate manifest 需要在独立审查后原地改写；
- 正式 cohort 开始后仍需修改源码、协议、玩家包或阈值。

---

## 9. 完成定义

只有同时满足以下条件，本计划才完成：

- 协议/schema、状态、相位、领域动作、classifier、UI、数值和证据链均已实现并通过验证；
- 两条 anti-pass 轨迹通过；
- 五个盲诊断样本只得出“未发现明显反证”，且候选不变；
- candidate manifest、独立 review 与 seal record 三者哈希闭环；
- A38–A44 七个新的正式独立 agent 样本完成，或用递增替补补足七个有效样本；
- 最终报告同时列出 legacy 编辑诊断与 v2 责任承诺主指标；
- 发布唯一 Gate 1A 代理结论；
- Gate 1H 明确仍为 `PENDING`；
- Gate 2 明确仍为 `LOCKED`。

在此之前不得声称 Gate 1 已通过，也不得编写或实现 Gate 2。
