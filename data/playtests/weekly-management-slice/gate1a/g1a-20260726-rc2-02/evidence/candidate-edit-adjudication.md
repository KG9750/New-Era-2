# TECH-P00 候选编辑人工裁定

## 用途

本记录验证“浏览器只导出候选编辑组，最终有效编辑数由测试运营负责人逐项裁定”的证据链。`TECH-P00` 是冻结前技术审计，不是 A01–A07 正式样本，其数值不得进入 Gate 1A 中位数或任何计数阈值。

原始导出：

- 文件：`TECH-P00-export.json`
- sample ID：`P00`
- session ID：`919ec394-dfad-4da1-8165-dc996c34c784`
- final tick：`54`
- 浏览器导出第一周候选编辑组数：`2`
- 浏览器导出第二周候选编辑组数：`0`

## 逐动作证据

| 候选组 | 动作与受影响对象 | 撤销链 | 可见影响 | 运营裁定 |
|---|---|---|---|---|
| `action-0001` | 一次批量 `EDIT_SCHEDULE`；`lin-he:d0:b1`、`qiao-pan:d0:b2` 两格统一改为学习 | `action-0002.undoOfActionId = action-0001` | 粮食预测 3–11 → 1–9；撤销后恢复 3–11 | 技术链有效，但不计正式有效编辑。该动作是预定 RC 审计步骤，撤销理由是测试撤销能力，不是代理玩家的经营决策理由。 |
| `action-0003` | `OPEN_TRANSPORT_SHORTCUT`；`map:transport-route` | 无 | 路线 860 米 → 470 米；粮食损耗 6 → 2；粮食 3–11 → 7–15；维修保障 3–5 → 2–4 | 若只按动作结果机械裁定，可构成 1 次有效地图编辑；但本场是预定技术审计，正式 Gate 计数仍为 `not_applicable`。 |

## 裁定结果

```json
{
  "sampleKind": "technical-audit",
  "browserCandidateEditCount": {
    "week1": 2,
    "week2": 0
  },
  "technicalRuleMatchCount": {
    "week1": 1,
    "week2": 0
  },
  "gateEffectiveEditCount": "not_applicable",
  "includedInGate1A": false
}
```

这证明：

1. 批量两格只形成一个稳定动作 ID，而不是两次候选编辑；
2. 撤销动作通过 `undoOfActionId` 指向原事务；
3. 地图动作与日程动作都能形成候选组并携带可见因果；
4. JSON 只提供候选组计数，没有替运营负责人生成“最终有效编辑数”；
5. 运营裁定能够依据动作 ID、受影响格子、撤销链、界面证据和 agent 原始输出给出独立判断。

正式样本必须采用同一裁定规则，但不得因为策略、结果好坏或是否满足预期阈值改变判法。
