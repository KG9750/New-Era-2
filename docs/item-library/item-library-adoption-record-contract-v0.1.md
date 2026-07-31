# 候选物品库 R2-F 采纳决策记录合同 V0.1

**项目：** Project-004-New Era 2
**上游状态：** `R2E_REVIEW_PASS`
**记录状态：** `template_only`
**模板阶段：** `draft`
**提交就绪：** `false`
**运行时授权：** `NONE`

## 1. 目的

R2-F 为未来主干提供可审计的采纳决策记录结构、四份空白 draft 模板和只读校验器。它解决以下问题：

1. 决策记录必须绑定哪一份已审查的 R2-E manifest；
2. 每个候选稳定 ID、R2-C 提案和人工复核项如何逐项表达决定；
3. draft 与 submitted 记录的就绪条件如何区分；
4. 哪些运行时、Gate、迁移和试玩证据必须由未来消费者提供；
5. 如何阻止缺项、越权 ID、伪造来源 SHA 或部分决策被写成可提交。

R2-F 不替主干作出任何采纳决定，不创建运行时 schema，也不授予运行时或 Gate 权限。

## 2. 权威输入与生成物

权威输入：

- `data/item-library/consumer-handoff-r2e.json`
- `docs/item-library/reviews/item-library-r2e-review-status-2026-07-31.md`
- 本合同

确定性工具与生成物：

- `scripts/validate_item_library_adoption_records.rb`
- `data/item-library/adoption-record-schema-r2f.json`
- `data/item-library/adoption-record-templates-r2f.json`
- `data/item-library/adoption-record-templates-r2f.md`

Schema、模板和 Markdown 必须由工具确定性生成，不得手工修改。

## 3. Schema 角色

`adoption-record-schema-r2f.json` 是规划记录的结构 schema，不是游戏运行时 schema。它定义字段、基本类型、枚举与禁止额外字段；以下跨字段规则由 Ruby 校验器负责：

- manifest ID 与 SHA 必须匹配已审查 R2-E；
- 候选 ID 与决策项必须逐字覆盖 manifest，不得缺失、重复或新增；
- draft 必须保留未解决项，且不能声称提交就绪；
- submitted 必须解析全部决定并提供全部证据；
- 派生的采纳、拒绝/延后列表必须与逐项决定一致；
- 校验通过不等于授权通过。

## 4. Draft 模板

每份 R2-E manifest 对应一份 R2-F draft 模板，预填且冻结：

- `source_manifest_id`
- `source_manifest_sha256`
- `source_handoff_report_sha256`
- `candidate_stable_ids`
- 所有待决策项的稳定 ID

以下字段必须保持空白或未解决：

- `consumer_id=null`
- `target_branch=null`
- 所有 `stable_id_decisions[].decision=unresolved`
- 所有校准、异常与人工复核决定为 `unresolved`
- 所有 rationale 与 evidence 为 `null`
- `selected_stable_ids=[]`
- `rejected_or_deferred_stable_ids=[]`
- `submission_ready=false`

模板状态固定为 `template_only / draft / runtime_authorization=NONE`。

## 5. 稳定 ID 决策

每个候选稳定 ID 必须恰好出现一次。draft 允许：

```text
unresolved
```

未来 submitted 记录只允许：

```text
adopt / reject / defer
```

`selected_stable_ids` 必须等于所有 `decision=adopt` 的 ID；`rejected_or_deferred_stable_ids` 必须等于所有 `reject/defer` 的 ID。

## 6. 校准与人工复核决定

- `calibration_decisions` 对应 R2-C 数值提案，submitted 允许 `adopt / reject / rework`；
- `accepted_outlier_decisions` 对应暂时接受异常，submitted 允许 `confirm / reject / rework`；
- `mass_review_decisions` 对应质量人工复核，submitted 允许 `approve / reject / rework`。

draft 中全部为 `unresolved`。任何非 unresolved 决定都必须提供非空 rationale；模板不得预填理由。

## 7. Evidence 槽

submitted 记录必须提供非空字符串：

- `runtime_schema_version`
- `target_gate_authorization`
- `external_supply_policy`
- `save_migration_assessment`
- `runtime_validation_evidence`
- `human_playtest_evidence`

这些只是证据引用，不由 R2-F验证外部证据真实性或授予权限。draft 中必须全部为 `null`。

## 8. Draft 与 Submitted

### 8.1 Draft

- 可以保留 `unresolved`；
- `submission_ready=false`；
- `adoption_state=not_adopted`；
- `runtime_authorization=NONE`；
- 只证明模板结构和来源绑定正确。

### 8.2 Submitted

- 不得包含 `unresolved` 或 null 必填证据；
- 所有候选和风险决定必须完整；
- `submission_ready=true`；
- 仍不自动把 `runtime_authorization` 改为授权状态；
- 只能进入后续人工/主干审批流程。

R2-F 本轮不生成任何 submitted 记录。

## 9. 只读校验接口

重建和验证冻结 artifacts：

```bash
ruby scripts/validate_item_library_adoption_records.rb --write
ruby scripts/validate_item_library_adoption_records.rb
```

未来只读验证一份消费者记录：

```bash
ruby scripts/validate_item_library_adoption_records.rb --record path/to/record.json
```

`--record` 不修改输入文件，也不把结构有效写成已授权。

## 10. 确定性与通过标准

- R2-E 报告、manifest、来源文件与报告 SHA 可复算；
- R2-E 审查状态顶部元数据必须为 `R2E_REVIEW_PASS / NONE`；
- R2-E 审查文档认证的报告、R1 和 R2-D SHA 必须与当前输入一致；
- 四份模板与四份 manifest 一一对应，来源 SHA 精确匹配；
- 候选与决策 ID 完整、唯一、排序稳定；
- 所有模板决定均为 `unresolved`，证据均为 `null`；
- `selected_stable_ids` 和 `rejected_or_deferred_stable_ids` 为空；
- `submission_ready=false / adoption_state=not_adopted / runtime_authorization=NONE`；
- Schema、模板、Markdown 和所有 SHA 可逐字重建；
- R1、R2-C、R2-D、R2-E、运行时和 Gate 均不变化。

## 11. 接受边界

- 不允许把 draft 模板解释为采纳请求；
- 不允许把结构校验 PASS 解释为内容、运行时、Gate 或发布批准；
- 不允许 R2-F 写入主干、运行时加载路径或外部审批系统；
- 不替代人工决策、运行时验证或真人试玩。
