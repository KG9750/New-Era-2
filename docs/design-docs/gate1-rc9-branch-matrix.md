# Gate 1 RC9 Branch Matrix 与数值冻结说明

| 字段 | 内容 |
|---|---|
| 状态 | C03 源码树中的 RC9 legacy matrix authority |
| 场景 | `gate1-two-week-management@0.5.1` |
| 适用范围 | Gate 1A RC9 两周经营切片 |
| 机器 oracle | `buildGate1BranchMatrixOracle()` |
| 完整矩阵 SHA-256 | `9139effdf753dc46dfaab03ce4d35907257079afc64c911cf377b0435a4be975` |
| 边界 | Gate 1H=`PENDING`；Gate 2=`LOCKED` |

## 1. 目的

本说明冻结 RC9 主指标 choiceSet 的可达状态、后续策略配对、玩家可见结果向量和
支配判断。它解决三个问题：

1. 不用单条理想路线证明一个选项“可行”；
2. 不把 A 的最优未来与 B 的最差未来错配；
3. production export 不再自行硬编码 `non-dominated`，只引用同一冻结 oracle。

机器可读的完整 option × continuation policy 向量由
`prototype/src/sim/engine.ts` 的 `buildGate1BranchMatrixOracle()` 返回。测试对完整
JSON 冻结 SHA-256，本文只保留可人工审查的结构和汇总，避免再维护一份会漂移的
数千行复制表。

## 2. 完整状态空间

每条轨迹从同一初态运行到 `tick=2010`，包含两个周末 recap。状态空间为：

| 决策维度 | 具体选项 | 数量 |
|---|---|---:|
| 水泵预防计划 | `protect` / `expose` | 2 |
| 第一周粮食取舍 | `food-shift-qiao` / `accept-food-gap` | 2 |
| 维修责任实现 | `schedule-qiao` / `schedule-chen` / `schedule-su` / `accept-debt` | 4 |
| 路线时点 | `south-week-one` / `south-week-two` / `north-loop` | 3 |
| 化肥时点 | `use-week-one` / `use-week-two` / `keep` | 3 |
| 林禾请求 | `accept-study` / `decline-study` | 2 |

总轨迹数：

```text
2 × 2 × 4 × 3 × 3 × 2 = 288
```

所有 288 条轨迹都必须完成两个 recap；任何动作不可达、结算缺失或第二周未完成都会
使矩阵测试失败。

## 3. 结果向量

支配比较使用以下九个玩家可见轴：

| 轴 | 方向 | 可见证据 |
|---|---|---|
| `weekOneFood` | 越高越好 | 第一周粮食 recap actual |
| `weekOneRepair` | 越高越好 | 第一周维修 recap actual |
| `weekTwoFood` | 越高越好 | 第二周粮食 recap actual |
| `weekTwoRepair` | 越高越好 | 第二周维修 recap actual |
| `repairDebtCost` | 越低越好 | 维修欠账 recap 与终局状态 |
| `characterLoadCost` | 越低越好 | 责任日程和人物负荷 recap |
| `transportFoodLoss` | 越低越好 | 两周路线 recap 的粮食损耗合计 |
| `fertilizerRemaining` | 越高越好 | 终局化肥资产 |
| `linHeCommitment` | 已兑现优于未兑现 | 林禾人物记录与第二周 recap |

没有隐藏总分。不同轴不会先加权合并，避免用一套不可见权重替玩家决定价值取舍。

## 4. Choice context 与 continuation policy

同一 `choiceContextId` 只包含选择发生前权威状态一致的方案。第一周 choiceSet 共享
初始 context；第二周 choiceSet 按第一周的水泵、粮食、维修、路线和化肥结果拆分
context。

| choiceSet | context 数 | 每个 context 的 policy 数 |
|---|---:|---:|
| `choice:w0:food-plan` | 1 | 144 |
| `choice:w0:pump-repair` | 1 | 72 |
| `choice:w0:transport-route` | 1 | 192 |
| `choice:w0:fertilizer` | 1 | 192 |
| `choice:w1:lin-he-study` | 64 | 1–4 |
| `choice:w1:transport-route` | 32 | 2–4 |
| `choice:w1:fertilizer` | 32 | 2–4 |
| **合计** | **132** | — |

policy 数变化只来自已结算资产或继承结果：

- 第一周已开南侧短通路时，第二周没有重复开路 choice；
- 第一周已使用化肥时，第二周没有重复使用 choice；
- 这类状态会形成不同 `choiceContextId`，不会在同一 context 内删掉某个 option 的
  policy。

同一 context 内所有 option 必须拥有完全相同的 `continuationPolicyId` 集。缺少
policy、多出 policy、向量长度错误或非有限数值时，该 context 的所有 option 都是
`unverified`。

## 5. 唯一 dominance 算法

对同一 context 中的 A、B：

1. 先确认 A、B 拥有相同且完整的 policy 集；
2. 对每个相同 policy，逐轴比较 `V(A, policy)` 与 `V(B, policy)`；
3. A 在所有 policy、所有轴都不差于 B，且至少一处严格更优时，A 严格支配 B；
4. 被任一其他 option 严格支配时为 `dominated`；
5. 完整穷举且未被支配时为 `non-dominated`；
6. 任一输入不完整时为 `unverified`，不得按未支配计数。

RC9 当前冻结数值下，132 个 context 内没有 Gate option 被严格统治。每个 production
choiceSet 至少有两个 `non-dominated` option。

## 6. 维修责任的聚合边界

冻结 schema 使用高层 option：

```text
schedule-repair
accept-debt
```

但 `schedule-repair` 不是用一条代表路线代替三种实现。branch matrix 分别穷举：

```text
schedule-qiao
schedule-chen
schedule-su
```

只有三种具体日程实现都在完整矩阵中保持 `non-dominated`，production oracle 才把
聚合 option `schedule-repair` 标为 `non-dominated`。具体 actor、block、人物负荷和
日程后果仍由 action、projection、人物记录和 recap 区分。

这样既保持 RC9-01A 已冻结的 host/schema 合同，又不把陈渡或苏霁藏在乔磐的结果
后面。

## 7. 第一周结果到第二周回应

288 条轨迹去重后形成 64 种第一周玩家可见结果：

| 指标 | 范围或数量 |
|---|---:|
| 第一周粮食 actual | `1–21` |
| 第一周维修 actual | `-5–7` |
| 同时满足粮食 ≥12、维修 ≥5 的良好结果 | 11 |
| 主要第一周结果总数 | 64 |

去重键同时包含水泵 `protected/failed` 状态和具体维修责任兑现人（乔磐、陈渡、
苏霁或欠账），不会把资源数值偶然相同但人物/设施后果不同的结果合并。

每一种结果都从实际可完成轨迹反推第二周回应，不靠静态宣称：

- 林禾请求始终有接受与拒绝两种回应；
- 北侧路线仍在使用时，第二周可继续北侧或开启南侧短通路；
- 化肥仍在库存时，第二周可使用或保留；
- 已在第一周消耗或落地的选择不会伪造为第二周可重复动作。

因此每种主要第一周结果至少有两个可执行回应。11 种良好结果均可转向至少一种
学习、储备或路线改善机会，不强制重新生成危机。

## 8. Production export 单一真值

`prototype/src/scenario/gate1-week-one.ts` 的
`GATE1_CHOICE_SET_ORACLE` 是 production 可引用的冻结摘要。它保存：

- choiceSet 与 decision intent；
- option ID；
- 玩家可见 consequence refs；
- dominance status；
- `schedule-repair` 的三个具体 implementation option。

`prototype/src/telemetry/export.ts` 只负责：

- 根据实际 action 选择 `selectedOptionId`；
- 根据选择发生时点填写动态 `reachable`；
- 从 oracle 复制 option、consequence refs 和 dominance。

export 不再自行声明 dominance。intent 聚合、projection、hash、host 与 schema
合同未在 RC9-07 中改变。

## 9. 验证合同

核心自动化：

```bash
cd prototype
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npm run test:run -- tests/branch-matrix.test.ts
npm run test:run -- tests/management-branch-matrix.test.ts
npm run test:run -- tests/export.test.ts tests/playtest-host.test.ts
npm run lint
npm run build
```

`branch-matrix.test.ts` 同时冻结：

- 288 条完成轨迹；
- 132 个 context；
- 每个 context 的完整且一致 policy 集；
- 所有可达 option 的 dominance；
- 64 种第一周结果及第二周回应；
- 完整矩阵 SHA-256。

任何产品数值、日程对象、结算、结果轴或可达性变化都会改变断言或矩阵 hash；必须
回到 RC9-07 重新审查，不得只更新 hash。

C03 新增的 `choice:w0:preventive-capacity` 与
`choice:w1:recovery-allocation` 已进入 production oracle；其唯一 resource lot、
四个 W2 context、两条 continuation policy、W1 exposure weighting 与精确
`+1/0` 经济增量由 `gate1-c03-management-choice-authority.md` 和
`management-branch-matrix.test.ts` 单独冻结。legacy 288 条轨迹与 132 个 context
仍保持本文件前述边界，不能用 C03 terminal ledger 反推或改写旧轨迹计数。

## 10. Gate 边界

本矩阵只证明当前两周 RC9 候选的分支完整性与数值非严格统治：

- 不证明 Gate 1A 已通过；
- 不替代 RC9-08 viewport、capture 和 determinism；
- 不替代五个盲诊断样本；
- 不替代 Gate 1H 真人测试；
- 不解锁 Gate 2。
