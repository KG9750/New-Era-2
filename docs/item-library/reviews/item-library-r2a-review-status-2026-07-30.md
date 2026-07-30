# 候选物品库 R2-A 复审状态

**日期：** 2026-07-30
**范围：** 220 项语义审计、依赖图、装备兼容与稳定 ID 选择闭包
**实现验证：** `PASS`
**独立 subagent 首审：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=1`）
**独立 subagent 复审：** `PENDING`
**最终状态：** `R2A_RECHECK_PENDING`
**运行时授权：** 无

## 1. 当前结论

R2-A 已由独立、只读、全新上下文 subagent 完成首审。首审发现一项 P1 和一项 P2，因此结论为 `REVIEW_FAIL`。

两项发现均已按最小范围修正，并通过定向复现和完整本地回归；当前等待同一独立 subagent 对修正后的远端干净快照复审。在复审给出 `P0=0 / P1=0 / REVIEW_PASS` 前，不能宣称 R2-A 通过。

候选内容继续保持 `candidate_only`、`runtime_authorization=NONE`，不允许整包导入，也不改变 Gate。

## 2. 已完成的内部对抗性检查

内部检查发现并修正：

1. 替代输入不能按普通直接输入判断。`item.clothing.work_clothes` 是 `recipe.hygiene.prepare_cleaning_rags` 的合法替代项；审计器现单独生成 `recipe_substitute_input` 边并验证 `used_by` 反向接口。
2. 选择闭包 SHA-256 原先只覆盖节点集合，没有绑定来源基线与 Payload。现已把 `source_baseline_id`、`source_payload_sha256`、状态、授权和适用警告纳入哈希。
3. 选择训练空包弹或离线传感核心时，原先闭包不会主动带出对应警告。现闭包输出 `applicable_warnings`。
4. 语义审计器原先依赖 R1 校验器保证 Bundle 完整性。现会独立重算规范化 `payload_sha256`、数量与拒绝默认导入策略。
5. 武器与弹药原先只靠 `ammo_family` 文本并列。现生成 `ammo_compatibility` 边，并要求所有需要弹药的平台至少有一个同族候选耗材。
6. 首审 P1：选择闭包把工艺输入、产出和副产物放进同一种反向生产者扩展路径，选择猎弓工艺会经锯末副产物错误吸入公共长凳工艺。现按“输入可反向展开、输出只纳入节点”区分队列身份；同一物品后来以输入身份抵达时仍允许首次展开生产者。
7. 首审 P2：`--select ''` 和 `--select ','` 会生成空闭包。现两种调用均以非零状态退出并输出 `SELECTION_CLOSURE=FAIL`。

以上修正没有修改 R1 物品、工艺、转换或统一 Bundle。

## 3. 本地验证证据

```text
PROFILE=c1 PASS
PROFILE=c2 PASS
PROFILE=c3 PASS
PROFILE=c4 PASS
PROFILE=c5 PASS
PROFILE=c6 PASS
PROFILE=c7 PASS

SEMANTIC_AUDIT=PASS
ERROR_COUNT=0
WARNING_COUNT=2
STRUCTURED_LINKED_ITEM_COUNT=141
DIRECT_USE_ONLY_ITEM_COUNT=54
NARRATIVE_CANDIDATE_ITEM_COUNT=1
GRAPH_NODE_COUNT=334
GRAPH_EDGE_COUNT=476
RUNTIME_AUTHORIZATION=NONE
```

额外通过：

- Ruby 语法检查；
- JSON 与 Markdown 逐字确定性重建；
- 稳定 ID 根顺序无关；
- 未知稳定 ID 拒绝；
- 栓动步枪闭包自动包含步枪弹药；
- 训练空包弹闭包主动携带平台绑定警告；
- 闭包 SHA-256 绑定来源基线与 Payload；
- 猎弓工艺闭包不再包含 `recipe.c7_furniture.make_communal_bench` 或 `item.furniture.communal_bench`；
- 空字符串和纯逗号选择均拒绝并输出 `SELECTION_CLOSURE=FAIL`；
- Bundle、合同和审计工具源哈希回读匹配；
- 差异空白检查。

## 4. 已裁定警告

| 稳定 ID | 裁定 |
|---|---|
| `item.rare.offline_sensor_core` | `defer_until_relevant_gate`：当前不得凭候选说明新增诊断、研究或安装能力。 |
| `item.ammunition.training_blank_batch` | `bind_platform_on_selection`：未来导入时必须绑定明确平台和口径，或拒绝导入。 |

两项均会随稳定 ID 选择闭包显式输出，不是静默豁免。

## 5. 解除阻塞条件

需要由同一独立 subagent 对修正后的远端干净快照进行一次非空、只读、可引用文件与行号的复审，至少覆盖：

- `scripts/audit_item_library_semantics.rb`
- `docs/item-library/item-library-semantic-audit-contract-v0.1.md`
- `data/item-library/semantic-audit-r2a.json`
- `data/item-library/semantic-audit-r2a.md`

复审必须给出 P0/P1/P2 数量与 `REVIEW_PASS` 或 `REVIEW_FAIL`。只有 `P0=0 / P1=0`，并且所有真实发现完成修正与回归后，R2-A 才能从 `R2A_RECHECK_PENDING` 转为复审通过。
