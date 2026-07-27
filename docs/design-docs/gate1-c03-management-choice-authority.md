# Gate 1 C03 管理选择与 Branch Matrix Authority

| 字段 | 内容 |
|---|---|
| 状态 | C03 源码与测试 authority；非候选证据 |
| 场景 | `gate1-two-week-management@0.5.1` |
| 协议 | `weekly-management-slice-playtest-v0.3` |
| 领域实现 | `prototype/src/sim/management-choices.ts` |
| W2 matrix | `prototype/src/sim/management-branch-matrix.ts` |
| 导出/校验 | `prototype/src/telemetry/export.ts` / `prototype/scripts/playtest-host.mjs` |
| 边界 | Gate 1H=`PENDING`；Gate 2=`LOCKED` |

## 1. 设计问题

RC8 证明玩家能完成两周流程，但“底层编辑数量”无法稳定表达玩家是否理解并承担了
一个管理取舍。C03 不增加第三套经营系统，而是在两个已有资源冲突上建立最小的
显式责任链：

```text
authority-bound opportunity
  → 同层级候选比较
  → 明确候选激活
  → 原子兑现真实 mutation
  → required consequences
  → 唯一 effect ownership
  → terminal ledger
```

打开界面、定位日程、直接改格子或读到好结果，都不能替代这条链。

## 2. W1 可见结果空间

两个候选争用同一个 `lin-he:d1:b1` 休息格：

| 候选 | 日程 | 设备暴露 | W2 恢复负荷 | 林禾恢复 | 人员准备度 |
|---|---|---|---:|---:|---:|
| `schedule-preventive-maintenance` | `rest→repair` | `high→low` | `2→1` | `0` | `0` |
| `retain-rest-capacity` | 保持 `rest` | `high` | `2` | `0→1` | `+1` |

这不是“维修必胜”的二选一。前者降低设施风险，后者保存人物恢复与终局准备度；
comparison 不合并成隐藏总分，也不显示系统推荐。

W1 的已提交、`omitted` 或 `unqualified-direct-edit` terminal 会成为 W2 context。
W2 只能读取，不能回购 W1。

## 3. W2 规范 resource lot

唯一稀缺资源为：

```text
schedule-slot:chen-du:d10:b2
owner: chen-du
dayIndex: 10
blockIndex: 2
tick interval: [1536, 1554)
tick count: 18
original activity: rest
```

它是一个专用应急班次，不是额外库存：

- `allocate-repair-buffer` 只让 ending repair `+1`；
- `allocate-food-production` 只让 ending food `+1`；
- 未选轴必须保持 `0` delta；
- 任一直接底层编辑仍改变真实经济状态，但不能被事后分类为 C03 commitment。

## 4. Branch matrix

机器 oracle 固定四种输入 context：

| fixture | ending food | ending repair | recovery load | exposure | readiness |
|---|---:|---:|---:|---|---:|
| `repair-favored` | 14 | 4 | 2 | high | 1 |
| `food-favored` | 11 | 6 | 1 | low | 0 |
| `w1-exposure-weighting-low` | 13 | 5 | 1 | low | 0 |
| `w1-exposure-weighting-high` | 13 | 5 | 2 | high | 0 |

支配轴：

| 轴 | 方向 |
|---|---|
| `endingFood` | higher |
| `endingRepair` | higher |
| `equipmentRecoveryLoad` | lower |
| `personnelReadiness` | higher |

每个 context 都用同一组 continuation policy：

- `infrastructure-resilience`；
- `food-security`。

两个候选在全部四个 context 都是 `non-dominated`。`repair-favored` 中维修路线得到
`endingRepair=5`，粮食路线得到 `endingFood=15`；`food-favored` 中粮食路线得到
`endingFood=12`，维修路线得到 `endingRepair=7`。两条 continuation policy
分别为两个候选提供可审查的理性路径，但 production UI 不显示“推荐”。

W1 exposure weighting 还必须满足：

```text
infrastructurePressure(high) =
infrastructurePressure(low) + 1
```

改变 W1 exposure、W2 资源格、预测增量、结果轴或 continuation policy，都必须先
更新 machine oracle、测试和本文，不能只改 digest。

## 5. 原子性与 effect ownership

每个真实 consequence 产生：

```text
effect:sha256(canonical-json({
  objectRef,
  resourceLotId,
  stateRevisionBefore,
  stateRevisionAfter,
  scheduleSlot,
  beforeValue,
  afterValue
}))
```

同一 fingerprint 在整个 Session 中只能有一个 decision intent owner。no-op 不得
生成 consequence；required consequence 缺失、authority/revision/projection
错配、资源已占用或 W2 delta 不精确时，事务全部失败。

因此 W1 retain-rest 只记录三个真实变化，不用 `high→high` 或 `2→2` 填满字段；
W2 则只记录一个 schedule consequence 和一个所选经济轴的 `+1` consequence。

## 6. 与 RC9 legacy matrix 的关系

`gate1-rc9-branch-matrix.md` 继续冻结原有 288 条两周轨迹与 132 个 legacy choice
context；C03 将 `choice:w0:preventive-capacity` 和
`choice:w1:recovery-allocation` 加入 production oracle，但不把底层 schedule
action 反推成 terminal ledger。

两个 oracle 必须分别通过：

```bash
npm run test:run -- tests/branch-matrix.test.ts
npm run test:run -- tests/management-branch-matrix.test.ts
```

前者防止既有两周数值/轨迹漂移，后者防止 C03 resource lot、W1 weighting 和
W2 `+1/0` 经济合同漂移。

## 7. Gate 边界

本文只冻结 C03 源码行为和可审查结果空间：

- 不证明 Gate 1A 已通过；
- 不生成 C03 candidate 或 evidence；
- 不替代 viewport、capture、determinism、anti-pass、盲诊断、独立 review 或 seal；
- 不替代 Gate 1H 真人测试；
- 不解锁 Gate 2。
