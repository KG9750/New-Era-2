# Gate 1 两周经营切片玩家测试协议 V0.3

| 字段 | 内容 |
|---|---|
| 项目 | Project-004-New Era 2 |
| 状态 | C03 实现 authority；不构成 candidate、seal 或 Gate 证据 |
| 协议版本 | `weekly-management-slice-playtest-v0.3` |
| 场景版本 | `0.5.1` |
| 导出版本 | `gate1-playtest-v2`，增加 V0.3 ledger 字段 |
| 派生自 | `weekly-management-slice-playtest-v0.2.md` |
| 上位设计 | `../design-docs/gate1-c03-management-choice-authority.md` |

V0.3 只增加 C03 的两个显式管理选择及其原子证据合同。V0.2 继续作为
RC9-01A/C02 与既有 fixtures 的只读 authority；V0.1 继续解释 RC8 的
`AGENT_PROXY_FAIL`。三个版本不可互相回填或改写历史结论。

## 0. Gate 与运行边界

- 本文件不授权生成 C03 candidate、anti-pass、诊断样本、seal 或 cohort 证据。
- Gate 1A 仍未取得新结论；Gate 1H=`PENDING`；Gate 2=`LOCKED`。
- C03 计数只能来自本协议的 terminal ledger，不能从 `CHANGE_ACTIVITY`、
  `EDIT_SCHEDULE`、UI 焦点、CTA 或 recap 文案反推。
- capture host 继续接受冻结的 V1 与 V0.2 导出；V0.3 走额外严格校验后，再投影到
  V0.2 validator 验证其余公共合同。

## 1. Authority tuple 与 revision

每个 C03 opportunity、commitment 和 consequence 必须绑定同一个：

```ts
{
  diagnosisId: string
  sessionId: string
  candidateBuildAuthorityHash: string
}
```

`diagnosisId` 等于当前 `sampleId`，`candidateBuildAuthorityHash` 等于当前
artifact hash。authority 一经绑定不可跨 Session 重绑或重放。

`stateRevision` 只在会改变 C03 authority projection 的 mutation 后递增；暂停、
倍速和纯时间推进不递增。提交使用 compare-and-swap：

1. request revision 必须等于当前 state revision；
2. opportunity、authority、projection base 和 candidate projection 必须全部匹配；
3. terminal 只能从 `open` 转移一次；
4. 选择、日程 mutation、全部 required consequences、effect ownership 和 terminal
   必须在同一个事务内成功，否则状态保持原样。

投影和 effect fingerprint 统一使用 canonical JSON（对象键排序、数组保序）和
SHA-256；禁止 production export、validator 与 domain 各自维护不同哈希规则。

## 2. W1：预防容量分配

| 字段 | 固定值 |
|---|---|
| `decisionIntentId` | `w0:preventive-capacity:pump` |
| `choiceSetId` | `choice:w0:preventive-capacity` |
| 唯一资源格 | `lin-he:d1:b1` |
| resource claim | `schedule-slot:lin-he:d1:b1` |
| 截止 tick | `240`（不含） |

同层级候选：

### `schedule-preventive-maintenance`

- `lin-he:d1:b1`：`rest → repair`；
- equipment exposure：`high → low`；
- equipment recovery load：`2 → 1`；
- 以上三项都是 required consequences。

### `retain-rest-capacity`

- preventive capacity allocation：`unallocated → rest`；
- Lin He recovery：`0 → 1`；
- personnel readiness：`+1`；
- equipment exposure 保持 `high`、recovery load 保持 `2`，二者是继承上下文，
  不能用 `high→high` 或 `2→2` no-op consequence 凑数。

在 tick 240 前没有显式候选提交时，terminal 为：

- 目标格未被底层编辑：`omitted`；
- 目标格被非 C03 动作直接修改：`unqualified-direct-edit`。

两种情况都不产生 C03 commitment count；底层编辑造成的真实日程和经济变化仍保留。

## 3. W2：恢复资源分配

| 字段 | 固定值 |
|---|---|
| `decisionIntentId` | `w1:recovery-allocation:pump-vs-food` |
| `choiceSetId` | `choice:w1:recovery-allocation` |
| 唯一 resource lot | `schedule-slot:chen-du:d10:b2` |
| owner / 日程格 | `chen-du` / `chen-du:d10:b2` |
| 人类时间窗 | 第 11 日 B3（16:00–19:00） |
| tick interval | `[1536, 1554)` |
| tick count | `18` |
| 原活动 | `rest` |

W2 opportunity 在进入第二周时创建，并读取 W1 已冻结的 terminal、equipment
exposure 与 equipment recovery load；它不能撤销、重买或重算 W1。

同一个 18-tick 班次只能提交一个候选：

- `allocate-repair-buffer`：目标格 `rest → repair`，维修期末预测的 low/high
  都必须精确 `+1`，粮食 delta 必须为 `0`；
- `allocate-food-production`：目标格 `rest → food`，粮食期末预测的 low/high
  都必须精确 `+1`，维修 delta 必须为 `0`。

任一选中轴不是精确 `+1`、另一轴不是 `0`、资源格不是规范 lot 或原活动已变化，
整个提交必须拒绝。底层直接修改这个格子不会生成 C03 commitment。

## 4. Terminal ledger

V0.3 在 `gate1-playtest-v2` 顶层增加：

```ts
{
  protocolVersion: 'weekly-management-slice-playtest-v0.3'
  scenarioVersion: '0.5.1'
  managementChoiceOpportunitiesV03: ManagementChoiceOpportunity[]
  managementChoiceCommitmentsV03: ManagementChoiceCommitment[]
  effectOwnershipV03: Record<EffectFingerprint, DecisionIntentId>
}
```

`meta` 同步增加 `diagnosisId`、`candidateBuildAuthorityHash` 和
`protocolVersion`；`finalState` 增加 equipment exposure/recovery load、
preventive allocation、Lin He recovery 与 personnel readiness。

每个 commitment 必须：

- 精确对应一个 opportunity 和一个 `COMMIT_MANAGEMENT_CHOICE` action；
- authority、choice set、intent、revision、projection hashes、idempotency key、
  resource claim 和 terminal 全部一致；
- `requiredConsequenceIds` 与实际 consequences 按顺序完全相等；
- 每个 consequence 都是非 no-op；
- 每个 effect fingerprint 在整个导出中只出现一次，且
  `effectOwnershipV03` 的唯一 owner 等于该 commitment 的 intent；
- 同一 `diagnosisId + week + decisionIntentId` 最多一个 terminal commitment。

summary 只从 ledger 映射：

```ts
{
  week1C03TerminalCommitmentCount: number
  week2C03TerminalCommitmentCount: number
}
```

`candidateManagementCommitmentGroups` 可同时携带兼容投影，但不能成为 C03 count 的
来源。

## 5. UI 与输入合同

- 周初摘要 CTA 只打开 comparison，authority mutation 必须为 0。
- 首次打开时全部当前可达候选同时可见、同样式、无默认、无推荐、全部
  `aria-pressed=false`。
- comparison 容器或摘要 CTA 上的 Enter/Space 不提交。
- 只有具体候选按钮获得焦点后的键盘/指针激活可以提交。
- terminal 后两个候选都禁用；规范日程格、会覆盖它的 copy 和会撤销它的 undo
  都锁定。
- UI 只显示 domain 已计算的 consequence 和 forecast，不自行写供需结果。

## 6. Validator 与 fixture 最低覆盖

`npm run schema:fixtures` 至少覆盖：

- 一个有效 V0.3 ledger；
- no-op consequence；
- 同一 effect fingerprint 被重复拥有；
- commitment 跨 Session；
- W2 resource lot 错配。

production export/host tests 还必须覆盖 authority、effect owner、
required consequence、resource lot 和 economic delta 的独立篡改拒绝。

## 7. 验收命令

```bash
cd prototype
export PATH="/tmp/new-era-c02-node-bin:$PATH"
npm run lint
npm run test:run
npm run schema:fixtures
npm run e2e
```

通过以上命令只证明 C03 实现合同在当前源码树中成立，不生成 candidate/evidence，
不改变 Gate 状态。
