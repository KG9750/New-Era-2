# 候选物品库 R2-D 审查状态

**日期：** 2026-07-31
**范围：** 四个主题根集合、推荐生产路径、完整语义审计上下文、R2-B/R2-C 风险绑定、确定性报告与接受边界
**实现验证：** `PASS`
**独立 subagent 首审：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=0`）
**独立 subagent 第二轮：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=0`）
**独立 subagent 第三轮：** `REVIEW_PASS`（`P0=0 / P1=0 / P2=0`）
**最终状态：** `R2D_REVIEW_PASS`
**运行时授权：** `NONE`

## 1. 当前结论

R2-D 已生成四个 `reference_only` 主题选择包，并在本地通过生成器自检。独立 subagent 首审发现一项 P1，上游 R2-C 审查状态门禁只做全文 token 搜索，可能被历史 PASS 文本绕过；第二轮复审发现首次修正仍未限定状态必须来自顶部权威元数据块。两项均已按最小范围修正，第三轮全新 subagent 在提交 `f81108a1837e4e6c559745f3fb13ea9572128c14` 上完成只读复审，未发现真实缺陷。

R2-D 没有修改 R1 或采纳 R2-C 数值，也没有生成运行时导入包、改变 Gate 状态或替代真人试玩。

## 2. 本地实现结果

```text
SELECTION_PACKS=PASS
PACK_COUNT=4
UNIQUE_ROOT_COUNT=23
RECOMMENDED_UNION_NODE_COUNT=107
SEMANTIC_CONTEXT_UNION_NODE_COUNT=133
REPORT_SHA256=31fd6fe6d0ba1ec2901b053ed341e7d08ee5c83eeb2549e7d198b950df1edbec
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

第二轮复审结论：

```text
P0=0
P1=1
P2=0
REVIEW_FAIL
```

新增修正：

- 只解析 H1 后、第一个 H2 前的连续顶部元数据块，不再全文搜索状态；
- 要求元数据字段集合、字段唯一性和 `实现验证 / 第二轮审查 / 最终状态 / 运行时授权` 的值精确匹配；
- 新增重复状态、伪说明 token 和 fenced 伪状态三个负向变异回归。

## 4. 第三轮独立复审

第三轮全新 subagent 只读检查了：

1. 推荐生产路径是否始终是对应 R2-A 闭包的子集；
2. 推荐路径是否排除了 `repair` 与 `dismantle`；
3. 指定供应工艺与顺带共生产者是否被正确区分；
4. 安防包是否避免把长矛、破障锤等共生产者拉入推荐路径；
5. `contained_cycle`、`cycle_touchpoint` 和上下文新增风险的含义是否正确；
6. R2-B/R2-C 风险传播、哈希绑定和确定性重建是否完整；
7. `candidate_only / reference_only / runtime_authorization=NONE` 边界是否不可绕过。

复审结果：

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

其中，真实 R2-C PASS 状态被接受；PENDING、FAIL-with-history、重复最终状态、伪说明 token、fenced 伪状态、元数据未知/缺失/重复、错误第二轮状态、非精确或重复结论块均被拒绝。

## 5. 接受边界

最终状态：

```text
R2D_REVIEW_PASS
```

`R2D_REVIEW_PASS` 只表示选择包满足当前合同并可确定性复算，不表示 R1 已修改、R2-C 数值已采纳、运行时已授权、Gate 已解锁或真人试玩已完成。
