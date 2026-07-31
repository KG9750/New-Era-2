# 候选物品库 R2-D 审查状态

**日期：** 2026-07-31
**范围：** 四个主题根集合、推荐生产路径、完整语义审计上下文、R2-B/R2-C 风险绑定、确定性报告与接受边界
**实现验证：** `PASS`
**独立 subagent 首审：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=0`）
**独立 subagent 复审：** `PENDING`
**当前状态：** `R2D_RECHECK_PENDING`
**运行时授权：** `NONE`

## 1. 当前结论

R2-D 已生成四个 `reference_only` 主题选择包，并在本地通过生成器自检。独立 subagent 首审发现一项 P1，上游 R2-C 审查状态门禁只做全文 token 搜索，可能被历史 PASS 文本绕过。该项已按最小范围修正，尚待全新 subagent 复审，因此当前不得写为 `R2D_REVIEW_PASS`。

R2-D 没有修改 R1 或采纳 R2-C 数值，也没有生成运行时导入包、改变 Gate 状态或替代真人试玩。

## 2. 本地实现结果

```text
SELECTION_PACKS=PASS
PACK_COUNT=4
UNIQUE_ROOT_COUNT=23
RECOMMENDED_UNION_NODE_COUNT=107
SEMANTIC_CONTEXT_UNION_NODE_COUNT=133
REPORT_SHA256=d38fb26ba5345b832ed579435d5d82b5664e010db256c6649278942f54a18e0b
R1_BUNDLE_FILE_SHA256=32f9d9c41e7271e4da0f037167ad94023d050ee1b7471fdec98495393d9ff361
R1_PAYLOAD_SHA256=02918459ef17e42ed5e2151660873f6a4e88e12dff29730a013f1d062fe554ad
RUNTIME_AUTHORIZATION=NONE
```

四个主题包：

- `pack.r2d.survival_medical`；
- `pack.r2d.industry_maintenance`；
- `pack.r2d.security_low_tech`；
- `pack.r2d.civic_domestic`。

## 3. 首审发现与修正

首审结论：

```text
P0=0
P1=1
P2=0
REVIEW_FAIL
```

修正内容：

- 严格要求权威“最终状态”字段唯一，且其值为 `R2C_REVIEW_PASS`；
- 严格要求“最终结论”节只包含一个 `P0=0 / P1=0 / P2=0 / REVIEW_PASS` 结论块；
- 内建 `R2C_REVIEW_PENDING` 和 `R2C_REVIEW_FAIL` 两个负向变异回归，历史 PASS token 不再能绕过门禁。

## 4. 待独立复审

独立 subagent 必须只读检查：

1. 推荐生产路径是否始终是对应 R2-A 闭包的子集；
2. 推荐路径是否排除了 `repair` 与 `dismantle`；
3. 指定供应工艺与顺带共生产者是否被正确区分；
4. 安防包是否避免把长矛、破障锤等共生产者拉入推荐路径；
5. `contained_cycle`、`cycle_touchpoint` 和上下文新增风险的含义是否正确；
6. R2-B/R2-C 风险传播、哈希绑定和确定性重建是否完整；
7. `candidate_only / reference_only / runtime_authorization=NONE` 边界是否不可绕过。

## 5. 接受边界

在独立审查给出 `P0=0 / P1=0` 且不存在冻结阻断项之前，状态保持：

```text
R2D_RECHECK_PENDING
```

即使未来改为 `R2D_REVIEW_PASS`，也只表示选择包满足当前合同并可确定性复算，不表示 R1 已修改、R2-C 数值已采纳、运行时已授权、Gate 已解锁或真人试玩已完成。
