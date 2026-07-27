# Gate 1A RC9 C03 恢复计划

| 字段 | 内容 |
|---|---|
| 状态 | `APPROVED_FOR_ISSUE / NOT_STARTED` |
| candidate attempt | `C03` |
| anti-pass | `TECH-RC9-P05`、`TECH-RC9-P06` |
| blind diagnostics | `TECH-RC9-D11`–`TECH-RC9-D15` |
| 产品源码基线 | `6837c7230806f2c5c218336668f9e201e3e6cca1` |
| C02 拒绝记录 | `ed69f3517c0c6d00631588c8cfe37998ca305723` |
| C02 拒绝原因 | `V2_MEDIANS_BELOW_FROZEN_RANGE`，W1/W2 均为 `2` |
| Gate 边界 | Gate 1H=`PENDING`；Gate 2=`LOCKED` |

## 1. 恢复目标

C02 的捕获、导出、anti-pass 和五场盲诊断均技术有效，但五场 W1/W2
人工管理承诺中位数都是 `2`，低于冻结区间 `3–5`。五名玩家反复进行了两个
未计数的真实操作：

- 第一周主动把第二个水泵预防检修块加入日程；
- 第二周继续在维修与其他生产目标之间调配活动块。

C03 不降低门槛，也不把低层点击事后补写为承诺。它把这两类自然行为分别做成
两个显式、持久、正交的管理取舍：

1. W1：预防容量分配；
2. W2：恢复资源分配。

两项都是可跳过机会。打开卡片、定位日程、默认值、Continue、直接编辑底层格子
和查看 recap 均不计数。

## 2. 设计裁决

### 2.1 三个 intent 的边界

| intent | 管理问题 | 主状态 | 每周最多计数 |
|---|---|---|---:|
| 维修责任 | 谁负责、谁跟进、由谁确认日程 | 负责人、治理归属、责任兑现 | 1 |
| W1 预防容量 | 是否用一个真实休息格购买第二次预防检修 | 休息格、预防容量、设备暴露 | 1 |
| W2 恢复资源 | 同一个应急班次投向维修备件还是粮食生产 | 维修/粮食供给；恢复负荷只作 W1 结果上下文 | 1 |

同一 action、schedule delta 或 consequence 只能归属一个 intent。维修责任确认、
W1 检修选择、W2 班次分配、日历显示和 recap 不得互相重复计数。

### 2.2 W1：预防容量分配

固定对象：

- `choiceSetId=choice:w0:preventive-capacity`
- `decisionIntentId=w0:preventive-capacity:pump`
- `pumpObjectId=water-pump`
- `restSlotId=lin-he:d1:b1`
- `maintenanceOrdinal=2`

两个中立、同时可见、互斥的候选：

1. `schedule-preventive-maintenance`
   - 把 `lin-he:d1:b1` 从休息改为维修；
   - 形成第二个预防检修块；
   - 将设备暴露从 `high` 降到 `low`；
   - `linHeRecoveryUnits=0`。
2. `retain-rest-capacity`
   - 保留 `lin-he:d1:b1` 的休息；
   - `linHeRecoveryUnits=1`，并使终局 `personnelReadiness +1`；
   - 设备暴露保持 `high`，并进入 W2 的恢复负荷初态。

维修责任在两条路线中都可正常选择和兑现。W1 不是再次选择负责人。
休息恢复和设备暴露由权威日程决定；是否可计数只由显式 choiceSet 资格决定。
因此，不经 choiceSet 的底层排程仍然改变真实游戏状态，但 W1 计数为 `0`。

### 2.3 W2：恢复资源分配

W2 必须读取 W1 终态，但不得再次购买、撤销或重计预防能力。

固定资源：

- `choiceSetId=choice:w1:recovery-allocation`
- `decisionIntentId=w1:recovery-allocation:pump-vs-food`
- `scarceResourceLotId=schedule-slot:chen-du:d10:b2`
- `resourceUnit=schedule-block`
- `resourceQuantity=1`
- `resourceOwner=chen-du`
- `dayIndex=10`（零基，对应界面“第11日”）
- `blockIndex=2`（零基，对应界面“B3 16–19”）
- `resourceTimeWindow=day-index-10:block-index-2`
- `resourceTickInterval=[1536,1554)`、`resourceTickCount=18`
- `originalActivity=rest`
- 原活动为休息；两条路线消耗同一个三小时应急班次。

出题前冻结的两个目标：

1. `allocate-repair-buffer`
   - 将该格改为维修；
   - 唯一经济效果为 `projectedEndingRepairDelta=+1`；
   - 不改变 W1 的设备暴露或恢复负荷。
2. `allocate-food-production`
   - 将该格改为农务；
   - 唯一经济效果为 `projectedEndingFoodDelta=+1`；
   - 保留当前设备恢复负荷到终局。

日程 mutation 是上述经济效果的权威来源；forecast 与 settlement 只能派生同一
`+1`，不得再写入额外库存奖励或生成第二个可独立归属的收益 consequence。

设备恢复负荷初值由 W1 终态决定：

- 权威日程已经形成第二次预防检修：`1`；
- 权威日程保留休息、没有第二次预防检修：`2`。

W1 未显式选择时，周切换必须冻结 `omitted` 终态；不经 choiceSet 的直接排程
冻结为 `unqualified-direct-edit`。两者都不能计入 W1，但 W2 仍读取其真实日程、
设备暴露和恢复负荷。游戏状态不得为了反作弊而忽略玩家已经执行的底层行为。

负荷范围固定为 `0–2`，持续到终局 recap。两条路线都产生真实日程、供需和
终局状态变化；recap 只解释状态，不能代替状态。

W2 的独立性由 branch matrix 验证：

- 同一个 W1 结果下，粮食库存不同能够改变 W2 的合理偏好；
- 相同粮食状态下，W1 的设备暴露会改变权衡强度；
- 两个 W1 分支中，两项 W2 候选均可达且非严格劣势；
- 维修负责人不会自动决定 W2。

冻结效用边界：

- 粮食目标下限沿用 `12`；维修目标下限沿用 `5`；
- `equipmentRecoveryLoad=0–1` 为稳定，`2` 为脆弱；
- W2 固定显示
  `infrastructurePressure=max(0,5-endingRepair)+equipmentRecoveryLoad`；
  W1 低/高暴露分别使同一供给前态的压力相差 `1`，但不自动提交任何路线；
- outcome axes 固定为 `endingFood`、`endingRepair`、`equipmentRecoveryLoad`
  与 `personnelReadiness`；前三者方向依次为高、高、低，人员准备度为高；
- `repair-favored` fixture：提交前 W2 预测为粮食 `14`、维修 `4`、
  恢复负荷 `2`。维修路线使维修到 `5`；粮食路线使粮食到 `15`，但维修仍为
  `4`；两条路线都保留恢复负荷 `2`；
- `food-favored` fixture：提交前 W2 预测为粮食 `11`、维修 `6`、
  恢复负荷 `1`。粮食路线使粮食到 `12`；维修路线使维修到 `7`，但粮食仍为
  `11`；两条路线都保留恢复负荷 `1`；
- 两个 fixture 使用完全相同的 canonical resource lot、候选、单位、数量、
  时窗与原活动，差异只来自冻结前态；
- `w1-exposure-weighting` fixture：固定相同粮食、维修供给与 W2 候选，只把
  W1 导出的 recovery load 从 `1` 改为 `2`，断言
  `infrastructurePressure` 精确增加 `1`，且两个候选仍可提交；
- branch matrix 必须证明两项在完整 outcome axes 上都非严格支配，并分别存在
  `infrastructure-resilience` 与 `food-security` continuation policy 使其成为
  合理优选；UI 不显示“系统推荐”。

## 3. 协议与版本

保留外层 `schemaVersion=gate1-playtest-v2`，新增：

- `protocolVersion=weekly-management-slice-playtest-v0.3`
- `scenarioVersion=0.5.1`

不得修改或重签 C01/C02 的 v0.2 authority、candidate build、anti-pass、capture、
diagnostics 或 rejection 文件。C03 从精确产品源码基线
`6837c7230806f2c5c218336668f9e201e3e6cca1` 开工；C01/C02 只作为新证据链中
引用的已拒绝历史。

每个新 opportunity/action/consequence 至少保存：

```text
opportunityId
decisionIntentId
choiceSetId
candidateId
objectRef
week
diagnosisId
sessionId
candidateBuildAuthorityHash
stateRevision
projectionBaseHash
candidateProjectionHash
idempotencyKey
commitCause
resourceClaimRef
requiredConsequenceIds
effectFingerprints
terminalState
committedAtSequence
```

只有 `commitCause=explicit-candidate-action` 可以进入候选承诺。唯一计分键为：

```text
diagnosisId + week + decisionIntentId
```

同一计分键在双击、重试、读档、重放、重复导出或改选历史下最多贡献 `1`。
`opportunityId` 仍是资格的一部分；错 opportunity 必须拒绝，不能仅靠计分键去重。

`diagnosisId`、`sessionId` 和 `candidateBuildAuthorityHash` 在 Session 创建时固定，
写入原始 opportunity/action，export 不得注入或重写。其他 diagnosis、Session
或 build 的旧 commitment 即使 intent、week 与 hash 相同，也不能进入当前样本。

### 3.1 原子提交与改选

两个 choiceSet 都使用 `stateRevision + opportunityId` 的原子 compare-and-swap：

- 同一 base revision 并发提交两个候选，恰好一个成功，另一个返回 conflict；
- decision record、完整 required consequences、effect ownership 和新 state
  revision 在一个 reducer transaction 中同时提交；
- 本灰盒不允许已生效后的改选或撤回；第二次提交统一返回
  `OPPORTUNITY_ALREADY_COMMITTED`；
- preview、hover 或仅打开表面不创建可撤回记录，也不计数；
- 提交前离开表面等于未选择，count delta=`0`；
- 提交后日程格锁定，底层 edit 不得免费回滚已兑现后果。

因此任一 opportunity 最终恰好处于 `omitted` 或一个 terminal candidate，不能同时
保留两边收益。

## 4. Projection 与 consequence

W1 projection 至少覆盖：

- protocol/scenario version；
- opportunity、intent、choiceSet、pump 和 slot 身份；
- `lin-he:d1:b1` 提交前用途；
- 第一次检修存在、第二次检修尚未存在；
- preventive capacity 与 equipment exposure；
- 两个候选及各自 required consequences。

W2 projection 至少覆盖：

- W1 terminal action/ref、result revision 与设备暴露；
- 若 W1 没有合格 action，则覆盖 `omitted` 或 `unqualified-direct-edit` 终态；
- `schedule-slot:chen-du:d10:b2` 的资源 lot、单位、数量、时窗和提交前用途；
- 当前维修恢复负荷与上界；
- 固定竞争目标 `food-production`；
- 两个候选及各自 required consequences。

提交时必须按当前 state revision 重算。旧 hash、错对象、错 slot、错周次、
资源 lot 不同、no-op consequence、仅 recap 或事后回填均拒绝。

每个 consequence 还必须生成 canonical `effectFingerprint`，至少覆盖：

```text
objectRef
resourceLotId
stateRevisionBefore
stateRevisionAfter
scheduleSlot
beforeValue
afterValue
```

effect ownership registry 强制：

```text
effectFingerprint -> exactly one decisionIntentId
```

即使两个 consequence 使用不同 ID，只要指向同一状态 mutation、resource claim
或 schedule delta，也不能被 W1/W2 或其他 intent 双重消费。

资格判定必须同时满足：

```text
selected candidate
= canonical terminal state
= complete applied required consequences
= unique effect ownership
= exported terminalState
= recap explanation
```

required consequences 只应用一部分、decision 与 domain state 分离、状态已更新但
export/recap 仍旧、recap 指向另一候选或 consequence 被回滚，均判为无效。

## 5. UI 合同

- 两个 choice set 都是可跳过、非必经表面；
- 摘要 CTA 只打开或定位，不改变 authority；
- 打开时无默认选中、无推荐、无绿色 primary、无提交型初始焦点；
- 两个候选同尺寸、同颜色、同信息密度、同提交协议；
- W1 文案使用“安排第二次预防检修 / 保留休息容量”；
- W2 文案使用“分配给维修备件 / 分配给粮食生产”；
- 每项同时展示同一资源成本、立即收益、放弃收益和遗留状态；
- 首次明确选择可原子提交，不增加独立确认按钮；
- 用户明确聚焦某个候选按钮后按 Enter/Space 属于合法显式选择；通用 CTA、容器、
  关闭控件或无候选焦点的 Enter/Space 不得提交；
- 日历块、recap 和结果视图不重复产生 action 或 commitment。

## 6. P05/P06 anti-pass

### P05：显眼 CTA 与重复提交

至少验证：

- 只打开/展开/定位 W1、W2：两周新增 `0/0`；
- 通用 CTA、容器、关闭控件、无候选焦点的 Enter/Space 以及 Continue 不代选；
  明确聚焦候选按钮后的 Enter/Space 仍是合法显式选择；
- 同一 base revision 并发提交两个方向：成功 `1` 个、conflict `1` 个，只应用
  成功方向的 consequences；
- 先提交 A 再提交 B，或相反：第二次返回
  `OPPORTUNITY_ALREADY_COMMITTED`，count delta=`0`，状态不变；
- 双击和网络重试：首次最多 `1`，后续 count delta=`0`；
- reload 可保留本 Session 已合法产生的既有总数，但不得重发 action/consequence，
  reload 引起的 count delta=`0`；
- 其他 diagnosis/Session/build 的读档、继承、迁移和重放：count delta=`0`；
- 重复 export 只复述 canonical state，count delta=`0`；
- 同一 intent 多个低层 action 不拆分计数；
- 直接把 W1 格改为维修或 W2 格改为维修/农务，不经 choiceSet 均为 `0`；
- 同一 consequenceId 不能同时归 W1/W2；
- 两个不同 consequenceId 指向同一个 canonical effect fingerprint 时拒绝双归属；
- 候选 A 使用 `schedule-slot:chen-du:d10:b2`、候选 B 使用任一不同 owner、
  dayIndex、blockIndex、quantity、timeWindow、originalActivity 或 base revision
  时，W2=`0`。

### P06：最小干预与错误后果

至少验证：

- 不处理两张卡仍可完成两周，新增 `0/0`；
- 未选择、超时、关闭和周切换只导出 omission；
- 旧 hash、错对象、错周、错资源 lot、no-op、仅 recap 均拒绝；
- W2 不读取 W1、竞争目标出题后改变、W2 回购预防能力均拒绝；
- 选择后任一 required consequence 缺失、失败或只完成一部分时不得计数；
- decision record 成功但 domain state 未应用，或 domain state 应用但 terminal
  decision 未成功，整个事务回滚且 count delta=`0`；
- candidate、canonical terminal state、effect ownership、export 与 recap 任一
  不一致时不得计数；
- consequence 应用后被回滚、上下文字段已写但主日程或供需没有兑现时不得计数；
- 跨 Session 重放旧显式记录、把旧 diagnosisId 改写为当前样本，均拒绝且
  count delta=`0`；
- `repair-favored` 与 `food-favored` 两个确定性 fixture 均通过，且各自保存完整
  before/after outcome axes。
- W1 正向 fixture 必须证明 `retain-rest-capacity` 的
  `linHeRecoveryUnits=1` 与 `personnelReadiness +1` 同时进入 canonical state、
  export 和 recap。

P05/P06 是技术路径，永久排除 Gate 1A 与 Gate 1H 正式分母。

## 7. C03 构建与诊断

顺序固定为：

```text
protocol/schema/fixture
→ runtime/domain state
→ UI
→ oracle/export/host
→ unit/integration/E2E
→ branch matrix
→ deterministic archive
→ P05
→ P06
→ C03 seal
→ D11
→ D12
→ D13
→ D14
→ D15
→ diagnostics adjudication
```

D11–D15 继续沿用冻结隔离合同：

- 每场使用全新 `fork_turns=none` agent；
- 每个 agent 只创建一个应用 Session；
- 严格串行；上一场证据与裁决提交后才启动下一场；
- 每场必须完成两周、`tick=2010`、两份 recap；
- raw、sidecar、receipt 与 browser download 同字节；
- 核验并清空后才释放统一访谈；
- 旧 D01–D10 永久只读且编号不复用。

诊断通过要求：

- 五场技术有效；
- W1/W2 人工 v2 中位数分别都在 `3–5`；
- 无 P0；
- 无 CTA/默认刷数、同意图拆数、必须点完全部卡片；
- 同时报 legacy；
- 通过后才允许为 #50 分配递增 CMxx。

失败时封存 C03 rejection record；不得原地修改 C03、复用 P05/P06 或 D11–D15。

## 8. Issue 切片

本计划发布为一个 AFK tracer-bullet Issue。该 Issue 从协议、状态、UI、oracle、
export、host、测试、candidate build、anti-pass 到五场盲诊断形成单一可验证纵向
闭环，避免在中间层完成时误报候选可接受。

Issue 关闭前必须填写：

- 精确 `plan_ref`、`base_ref`、`output_ref`；
- C03 build/artifact/archive/authority hashes；
- P05/P06 seals；
- D11–D15 seals；
- diagnostics manifest 与接受或拒绝记录 hash；
- Gate 1H=`PENDING`、Gate 2=`LOCKED`。

## 9. 独立审查裁决

三路只读审查已覆盖：

- 游戏设计：W1 为事前预防容量，W2 为事后资源配置；在资源与目标冻结后可视为
  两项真实且正交的管理承诺；
- 合同：继续使用 v2 envelope，以新 protocol/scenario version 落地；两个候选
  必须争夺完全相同的 resource lot；
- 对抗：只计已生效的显式决策记录，不从点击或最终格子状态反推 intent。

上述条件均已写入本计划；实现和冻结仍须由测试证明，计划通过不代表 C03 通过。
