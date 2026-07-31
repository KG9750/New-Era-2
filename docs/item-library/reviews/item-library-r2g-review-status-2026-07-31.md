# 候选物品库 R2-G 审查状态

**日期：** 2026-07-31
**范围：** R1 与 R2-A–R2-F 支干冻结入口、来源文件 SHA、审查状态门禁、跨阶段绑定、计数与授权边界
**实现验证：** `PASS`
**独立 subagent 首审：** `REVIEW_FAIL`（`P0=0 / P1=3 / P2=1`）
**独立 subagent 复审：** `PENDING`
**当前状态：** `R2G_RECHECK_PENDING`
**运行时授权：** `NONE`

## 1. 当前结论

R2-G 已生成 `reference_only` 机器清单与人工摘要，并在本地完成确定性自校验。独立 subagent 首审发现三项 P1 与一项 P2：实际计数/逻辑 SHA 可被声明值洗白、上游边界可被输出常量洗白、跨阶段来源字段绑定不完整，以及新增文档行尾空白。四项均已按最小范围修正，尚待全新 subagent 复审，因此当前不得写为 `R2G_REVIEW_PASS`。

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
MANIFEST_SHA256=413878a67b5d3b874e5928ba7e98a600559b6baf14b6ab5f2af7421de41f1ac0
R1_BUNDLE_FILE_SHA256=32f9d9c41e7271e4da0f037167ad94023d050ee1b7471fdec98495393d9ff361
ADOPTION_STATE=not_adopted
RUNTIME_AUTHORIZATION=NONE
```

## 3. 首审发现与修正

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

## 4. 待独立复审

独立 subagent 必须只读检查：

1. R1 与 R2-A–R2-F 的顶部审查状态门禁能否抵抗正文 token、重复字段和过期状态伪造；
2. 7 个阶段的文件 SHA、逻辑 SHA 与跨阶段来源绑定是否完整；
3. R1 的 32 个嵌套来源和 R2-G 的 41 个支干来源是否存在、唯一且 SHA 可复算；
4. 220/90/24、4/4/4、151/171/171/0 等计数是否来自权威 artifacts；
5. JSON 与 Markdown 是否可确定性重建且 manifest SHA 可独立复算；
6. R1、R2-C 提案、R2-F 决策槽、runtime、Gate 与主干是否保持不变；
7. `reference_only / not_adopted / blocked / NONE` 边界是否不可被解释为采纳或授权。

## 5. 接受边界

在独立审查给出 `P0=0 / P1=0` 且不存在冻结阻断项之前，状态保持：

```text
R2G_RECHECK_PENDING
```

未来即使改为 `R2G_REVIEW_PASS`，也只表示支干冻结入口完整、可重算且边界清晰，不表示主干采纳、运行时/Gate 授权或真人试玩完成。
