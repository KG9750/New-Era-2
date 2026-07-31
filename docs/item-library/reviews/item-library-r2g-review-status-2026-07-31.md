# 候选物品库 R2-G 审查状态

**日期：** 2026-07-31
**范围：** R1 与 R2-A–R2-F 支干冻结入口、来源文件 SHA、审查状态门禁、跨阶段绑定、计数与授权边界
**实现验证：** `PASS`
**独立 subagent 首审：** `REVIEW_FAIL`（`P0=0 / P1=3 / P2=1`）
**独立 subagent 第二轮复审：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=0`）
**独立 subagent 第三轮复审：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=0`）
**独立 subagent 第四轮复审：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=0`）
**独立 subagent 第五轮复审：** `REVIEW_PASS`（`P0=0 / P1=0 / P2=0`）
**当前状态：** `R2G_REVIEW_PASS`
**运行时授权：** `NONE`

## 1. 当前结论

R2-G 已生成 `reference_only` 机器清单与人工摘要，并在本地完成确定性自校验。前四轮独立审查共发现六项 P1 与一项 P2，均已按最小范围修正。第五轮全新 subagent 在提交 `2aff1705a11702b4cc51fb763c85b8160a0dae14` 上完成只读复审，未发现真实缺陷。

R2-G 没有新增或修改候选内容，没有填写 R2-F 的任何决定槽，没有生成真实 submitted 记录、运行时 schema、Gate 授权、真人试玩证据或主干合并。

## 2. 本地实现结果

```text
BRANCH_BASELINE=PASS
STAGE_COUNT=7
CATALOG_DEFINITION_COUNT=220
RECIPE_COUNT=90
TRANSITION_COUNT=24
SELECTION_PACK_COUNT=4
CONSUMER_MANIFEST_COUNT=4
ADOPTION_TEMPLATE_COUNT=4
ALL_DECISION_SLOT_COUNT=171
UNRESOLVED_DECISION_SLOT_COUNT=171
SUBMITTED_RECORD_COUNT=0
R1_NESTED_SOURCE_FILE_COUNT=32
BRANCH_SOURCE_FILE_COUNT=41
MANIFEST_SHA256=9933e84ad0de774a0359bb1d9841e644a73a49583ec3868a05c6d42a4d688ea2
R1_BUNDLE_FILE_SHA256=32f9d9c41e7271e4da0f037167ad94023d050ee1b7471fdec98495393d9ff361
ADOPTION_STATE=not_adopted
RUNTIME_AUTHORIZATION=NONE
```

## 3. 四轮发现与修正

首审结论：

```text
P0=0
P1=3
P2=1
REVIEW_FAIL
```

修正内容：

- R2-G 只读运行 C1–C7 与 R2-A–R2-F 权威验证器，任何上游漂移都会阻断 `--write`；
- R1 内容计数、R2-D pack、R2-E manifest、R2-F template/decision 计数均从实际数组推导，并与声明及上游输出交叉核对；
- R1 payload 与 R2-A–R2-F 逻辑 SHA 均独立复算，R2-C overlay SHA 另行复算；
- 补齐 R2-D overlay、R2-E 报告文件/审查文件、R2-F handoff/审查/schema 文件绑定；
- 逐阶段验证 candidate/proposal/reference/template、adoption/readiness/authorization 与 acceptance boundary；R2-G 输出从已验证源值派生；
- 移除合同和状态文档的 10 处行尾空白。

第二轮复审结论：

```text
P0=0
P1=1
P2=0
REVIEW_FAIL
```

第二轮确认首审四项均已解决。针对新增 P1，当时先冻结了 R2-A–R2-F 中以 `独立 subagent` 开头的顶部字段序列，使该前缀内的新增、缺失、改名或顺序变化阻断 R2-G。

第三轮复审结论同为 `P0=0 / P1=1 / P2=0 / REVIEW_FAIL`。第三轮发现将字段改名为“第四轮独立 subagent 复审”可避开前缀筛选。现改为逐阶段冻结完整顶部元数据字段名及顺序，拒绝任何额外字段，不再猜测字段前缀。

第四轮复审结论同为 `P0=0 / P1=1 / P2=0 / REVIEW_FAIL`。第四轮确认前三轮问题均已解决，但发现 R1 损坏后 R2-G 继续执行 R2-B 并转发其 backtrace。现改为按依赖顺序在首个上游失败处停止，并只输出结构化失败摘要；失败时 JSON/Markdown 保持不变。

## 4. 第五轮独立复审

独立 subagent 必须只读检查：

1. R1 与 R2-A–R2-F 的顶部审查状态门禁能否抵抗正文 token、重复字段和过期状态伪造；
2. 7 个阶段的文件 SHA、逻辑 SHA 与跨阶段来源绑定是否完整；
3. R1 的 32 个嵌套来源和 R2-G 的 41 个支干来源是否存在、唯一且 SHA 可复算；
4. 220/90/24、4/4/4、151/171/171/0 等计数是否来自权威 artifacts；
5. JSON 与 Markdown 是否可确定性重建且 manifest SHA 可独立复算；
6. R1、R2-C 提案、R2-F 决策槽、runtime、Gate 与主干是否保持不变；
7. `reference_only / not_adopted / blocked / NONE` 边界是否不可被解释为采纳或授权。

实际结果：

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

第五轮实际执行 C1–C7、R2-A–R2-G、独立 SHA/计数/边界重算、archive 确定性重建，以及前四轮全部绕过夹具。九组依赖失败夹具均在首个失败阶段停止，下游 sentinel 未执行，无 Ruby backtrace，`--write` 未改变 JSON/Markdown；完整顶部元数据 allowlist 也拒绝标准/改名第四轮、任意额外字段、缺失和调序。

## 5. 接受边界

第五轮独立审查已满足 `P0=0 / P1=0` 且不存在冻结阻断项，当前状态为：

```text
R2G_REVIEW_PASS
```

`R2G_REVIEW_PASS` 只表示支干冻结入口完整、可重算且边界清晰，不表示主干采纳、运行时/Gate 授权或真人试玩完成。
