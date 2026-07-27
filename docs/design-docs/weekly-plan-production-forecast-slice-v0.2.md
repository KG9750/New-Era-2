# 周计划—产能推演两周切片规格 V0.2

| 字段 | 内容 |
|---|---|
| 项目 | Project-004-New Era 2 |
| 状态 | RC9 实施权威；待 Gate 1A 代理复测 |
| 版本 | V0.2 |
| 日期 | 2026-07-27 |
| `derivedFrom` | `weekly-plan-production-forecast-slice-v0.1.md` |
| 场景版本 | `0.5.0` |
| 适用范围 | `g1a-20260727-rc9-01` 及其候选构建 |

V0.2 是 RC8 失败后的受控设计转向，只适用于 RC9。V0.1 继续作为 RC8
设计与失败证据的 authority，不被本文件覆盖或追溯改写。

## 1. 要验证的体验

玩家仍通过“成员日程表 + 聚落供需表”管理聚落，但周初摘要不再给出唯一人物、
格子或最优答案。RC9 验证的是：

```text
发现例外
→ 比较至少两个可行且后果可见的方向
→ 把责任落实为日程、状态或资产决定
→ 立即看见粮食/维修反事实
→ 承受持续到 recap 或下一周的结果
```

一次有意义的操作不是“按建议修正”，而是玩家在可见取舍中形成一项持久的
管理承诺。打开卡片、定位、暂停、倍速和继续运行都不是管理承诺。

本切片只验证两周日常经营，不验证主题、豁免、NPC 排名、战斗或月度循环。

## 2. 不变基础

以下 V0.1 规则保持：

- 四名具名成员：林禾、乔磐、苏霁、陈渡；
- 每人每天四个可编辑活动块；
- 基础计划、本周例外、即时调整三层；
- 粮食与维修保障两条供需；
- 农田、水泵、粮仓、维修工坊和一份化肥；
- 固定两周事件、地图运输瓶颈、人物请求和两次 recap；
- 完整 112 格日程可以展开，但不是每周必经清单；
- Gate 1H 未通过前不能解锁 Gate 2。

## 3. 周相位唯一真值

场景只声明一组边界：

```text
weekStartTicks = [54, 1062]
weekEndTicks   = [1002, 2010]
```

| tick | 语义 | `weekIndex` |
|---:|---|---:|
| 54 | 第一周起点 | 0 |
| 1002 | 第一周 recap 源状态 | 0 |
| 1062 | 第二周起点 | 1 |
| 2010 | 第二周终点 | 1 |
| 1003–1061 | 不可达换周间隙 | 拒绝 |

`CONTINUE_TO_NEXT_WEEK` 的 action envelope 保留源 tick `1002`，随后一次性把
权威状态跳到 `1062`。时钟、地图、运输、预测、候选分类和导出必须调用同一
`weekIndexForTick()`；不得维护第二个 `activeWeekIndex` 或复制边界常量。

## 4. 真实库存与两条 recap

初态固定：

- 粮食库存：18；
- 维修库存：9；
- 化肥：1 份。

forecast 必须从当前 `SimulationState` 读取库存。每周 recap 同时保存粮食与维修
的 planned、actual、具名偏差原因和期末值。

第一周 recap 生成时只冻结结果，不改当前库存；玩家执行
`CONTINUE_TO_NEXT_WEEK` 时才原子提交两条 actual 并进入 tick `1062`。第二周
forecast 直接读取这两个结转值。不得在 recap 和换周两个位置重复结转。

第一周结果必须改变第二周问题形态，但好结果不必被强行替换为危机。储备充足时
可以出现学习、恢复或进一步改善机会。每种主要第一周结果在第二周至少有两个
可完成响应。

## 5. 化肥生命周期

不得用单一 `fertilizerUsed:boolean` 同时代表库存、施用周和效果。最小状态为：

```ts
{
  initialUnits: 1
  appliedWeekIndex: 0 | 1 | null
  remainingUnits: 0 | 1
}
```

唯一规则：

- 第一周施用：第一周 `+6`，第二周 `+0`，终局剩余 0；
- 第二周施用：第一周 `+0`，第二周 `+6`，终局剩余 0；
- 未施用：两周均 `+0`，终局剩余 1；
- 同一份化肥不得跨周重复生效。

“现在降低风险”与“终局保留资产”必须同时可见。只有明确比较并保留最终决定，
才可能成为管理承诺。

## 6. 周初摘要与 choice comparison

摘要卡只回答：

- 当前发生了什么；
- 何时兑现后果；
- 受影响的人物、设施、供需或资产；
- 不处理会怎样；
- 可进一步比较哪些责任方向。

摘要主 CTA 只能打开比较界面或定位日程，点击本身必须保持：

```text
authority mutation = 0
committed candidate = 0
```

comparison 首次展示必须满足：

- 当前可行方案同时可见；
- 无推荐、默认选择、绿色 primary 或主次权重；
- 同层级 class、ARIA role 和说明结构；
- 初始焦点位于中性标题、容器或关闭控件；
- 未选择时 Enter/Space 不提交；
- 第一次权威变化只能来自玩家明确选择具体方案。

## 7. 五类责任决定

### 7.1 粮食计划

玩家可以调动日程、保留原计划并接受缺口，或通过其他已解锁方向改变结果。
至少两个方向必须可达、后果可见且不被严格支配。

### 7.2 水泵维修责任

摘要只允许选择责任方向：

1. 乔磐承担；
2. 陈渡或苏霁交接；
3. 接受维修欠账。

前两条必须进入日程方案，由玩家确认具体格子或范围，再经
`applyScheduleTransaction()` 改变供需。至少一个人员方向提供两个可完成、
非严格劣势的日程实现。

维修欠账是唯一可不改日程的方向，但必须写入：

- 到期 tick；
- 每周累积代价；
- 兑现位置；
- 当前风险；
- 是否已结清。

本字段只服务 RC9，不扩展为通用任务或多月义务引擎。

### 7.3 林禾请求

- 接受：必须同时落实到日程和人物记录，并进入 legacy 与 v2 候选；
- 拒绝：不进入 legacy；只有产生持久、非默认人物后果时才进入 v2 候选；
- 保持默认且无持续后果：不形成承诺。

### 7.4 运输路线

开启捷径必须与保留原路线的反事实并列展示，并真实改变路线、损耗或供需。
仅打开地图、聚焦设施或查看说明不计。

### 7.5 化肥

使用与保留资产必须并列。施用周唯一、效果只发生一次、终局资产可见。

## 8. 决策意图与撤销

`decisionIntentId` 由周次和领域问题稳定生成，例如：

```text
w0:food-plan
w0:repair-responsibility:pump-incident-day-3
w1:character-request:lin-he-study
w1:transport-route
w1:asset-use:fertilizer
```

同一意图无论改多少格或执行多少次 undo/redo，最多形成一个人工承诺。完全恢复
原状态时标记 `reverted`，人工有效数为 0；edit → undo → redo 后若最终语义
改变，则保留完整动作链并标记最终 `committed`。

## 9. 决策语义哈希

哈希只覆盖该意图直接控制的权威语义：

- 相关 resolved schedule cells；
- 直接改变的粮食/维修库存；
- 化肥库存与施用周；
- 水泵、维修责任与欠账；
- 林禾请求与 resolution source；
- 运输路线；
- 相关人物记录。

forecast、recap 等共享派生结果只进入 `consequenceRefs`。动作日志、时间、UUID、
焦点、展开状态、速度和 capture metadata 必须排除。

投影按键名排序为 canonical JSON 后计算 SHA-256。其他意图后续改变共享 forecast
时，不得污染本意图的 final hash。

## 10. 可行方案与 dominance

所有可能进入 Gate 主指标的 choice set 必须由 branch matrix 穷举：

- 选择前 `choiceContextId`；
- 每个具体 `optionId`；
- 相同且完整的 `continuationPolicyId` 集；
- 每个 option × policy 在 tick 2010 的玩家可见结果向量。

结果轴包括两周粮食、两周维修、维修欠账、人物代价、运输损耗、终局化肥和
人物承诺兑现，且方向必须在界面或 recap 可见。

若 A 在每个相同 continuation policy、每个轴都不差于 B，并至少一处严格更好，
则 A 严格支配 B。缺少 option、policy 或结果时标记 `unverified`，不得当作
`non-dominated`。choice set 至少有两个可达、后果可见的 `non-dominated`
option，才可能形成有效管理承诺。

## 11. 导出边界

RC9 使用：

```text
scenarioVersion = 0.5.0
schemaVersion   = gate1-playtest-v2
```

导出同时保留：

- `candidateEditGroups`：V0.1 legacy 诊断；
- `choiceSets`；
- `candidateManagementCommitmentGroups`；
- 两条库存/recap、化肥生命周期和终局资产；
- complete 或 blocked capture。

浏览器不得输出名为 `effective*` 的结论。机器只产生可重算候选，是否有效由测试
运营负责人依据 raw、recap、访谈和观察人工裁定。

## 12. 验收边界

RC9 切片实现至少满足：

- 周相位四个边界和不可达间隙有确定性测试；
- 第一周 actual 原子结转为第二周库存；
- 两条供需均有 planned/actual recap；
- 化肥 W1/W2/未使用与重复生效反例通过 oracle；
- accepted 请求进入 legacy 与 v2 候选；
- 未确认维修方向不形成候选，维修欠账状态可追踪；
- CTA 和中性 comparison 的零 mutation 断言通过；
- decision hash 与 outcome fingerprint 排除顺序、UUID 和日志噪声；
- 完整穷举才能获得 `non-dominated`；
- V0.1、RC8 cohort 和 `prototype/src/**` 在 Phase 0 保持不变。

通过以上验收只允许进入后续 RC9 实施，不等于 Gate 1A、Gate 1H 或 Gate 2 通过。
