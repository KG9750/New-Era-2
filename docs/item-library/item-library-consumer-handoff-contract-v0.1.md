# 候选物品库 R2-E 主干消费交接合同 V0.1

**项目：** Project-004-New Era 2
**上游基线：** `new-era-2.item-library.r1-c7-candidate`
**上游状态：** `R2D_REVIEW_PASS`
**内容状态：** `candidate_only`
**交接状态：** `reference_only`
**采纳状态：** `not_adopted`
**运行时授权：** `NONE`

## 1. 目的

R2-E 把 R2-D 的四个主题选择包转换为未来主干可以明确读取和评估的消费交接清单。每份清单必须回答：

1. 消费者显式选择了哪些稳定 ID；
2. 哪些节点仅属于审计上下文，默认不得随包进入消费面；
3. 哪些输入依赖制造来源、外部来源或二者任选；
4. 哪些 R2-B/R2-C 风险必须在采纳前形成逐项决定；
5. 主干要补齐哪些运行时 schema、Gate 和验证证据；
6. 如何证明交接清单与已经审查的 R2-D 包逐字一致。

R2-E 只提供确定性的交接参考，不代表主干已经提出采纳请求，也不是运行时 Def、导入包或配置文件。

## 2. 权威输入与生成物

权威输入：

- `data/item-library/item-library-r1-candidate-bundle.json`
- `data/item-library/selection-packs-r2d.json`
- `docs/item-library/reviews/item-library-r2d-review-status-2026-07-31.md`
- 本合同

工具与确定性生成物：

- `scripts/build_item_library_consumer_handoff.rb`
- `data/item-library/consumer-handoff-r2e.json`
- `data/item-library/consumer-handoff-r2e.md`

JSON 与 Markdown 必须由工具确定性生成，不得手工修改。

## 3. 显式选择清单

每个 R2-D 包映射为一个 R2-E `handoff_manifest`，并逐字继承：

- `source_pack_id` 与 `source_pack_sha256`；
- `roots`；
- `explicit_selection`：R2-D `recommended_production_path.nodes` 的四类稳定 ID；
- `explicit_stable_ids`：四类稳定 ID 的去重排序联合；
- `default_excluded_audit_context`：R2-D `audit_context_only.nodes`；
- 必需输入供应解释；
- 推荐生产路径风险绑定。

`explicit_stable_ids` 是未来消费者评估时唯一允许默认进入选择面的 allowlist。不能根据名称前缀、分类标签、同类工艺或完整语义闭包自行扩张。

## 4. 默认排除面

`default_excluded_audit_context` 中的稳定 ID 只用于解释维修、拆解、兼容、替代生产者或转换关系，默认策略必须为：

```text
deny_unless_separately_selected_and_reaudited
```

默认排除面必须与显式选择面不相交。若未来主干希望采用其中某项，必须单独声明稳定 ID、重新建立推荐生产路径、重新绑定风险并独立审查，不能修改或绕过现有 manifest。

## 5. 供应接口

每个 manifest 必须保留 R2-D 的 `required_input_supply`，并额外汇总：

- `external_only_item_ids`：只有外部获得路径；
- `producer_only_item_ids`：只有指定制造来源；
- `producer_or_external_item_ids`：制造或外部来源均可；
- `incidental_co_production_item_ids`：存在路径内顺带共生产者，但不能替代指定供应来源。

供应汇总只是规划依赖，不生成库存、掉落、商店或生产队列配置。

## 6. 采纳前决策接口

每份 manifest 必须列出：

- `numeric_patch_proposal_ids`：逐项采纳、拒绝或重做；
- `accepted_outlier_ids`：重新确认暂时接受是否仍成立；
- `mass_review_recipe_ids`：完成质量人工复核；
- R2-B 价值异常、完整循环、循环触点与共享瓶颈；
- `semantic_warning_review`：是否需要审阅 R2-A 警告。

R2-E 不写入任何决定，所有 `consumer_decisions` 必须为空。未来采纳记录至少应包含消费者身份、目标分支、manifest ID 与 SHA、逐项稳定 ID、逐项数值决定、运行时 schema 版本、目标 Gate 授权和验证证据。

## 7. 阻塞式就绪条件

R2-E 的 `handoff_preparation` 可以为 `complete`，但 `adoption_state` 必须为 `not_adopted`，`runtime_readiness` 必须为 `blocked`。

每份 manifest 至少保留以下未解决要求：

- `runtime_schema_defined`
- `target_gate_authorized`
- `r2c_proposals_adjudicated`
- `manual_reviews_resolved`
- `external_supply_policy_defined`
- `save_migration_assessed`
- `runtime_validation_completed`
- `human_playtest_completed`

这些要求是未来消费者必须提供的证据槽，不是 R2-E 可以自动完成的任务。

## 8. 消费者提交合同

未来主干若决定采纳，必须另行提交 `consumer_adoption_record`，至少包含：

```yaml
consumer_id: <stable consumer identity>
target_branch: <mainline integration branch>
source_manifest_id: <R2-E manifest id>
source_manifest_sha256: <exact pinned hash>
selected_stable_ids: <explicit list>
rejected_or_deferred_stable_ids: <explicit list>
calibration_decisions: <proposal id -> adopt/reject/rework>
runtime_schema_version: <separate authorized schema>
target_gate_authorization: <evidence reference>
runtime_validation_evidence: <evidence reference>
human_playtest_evidence: <evidence reference>
```

本轮不创建该记录，也不为任何字段填入占位性 PASS。

## 9. 确定性与通过标准

R2-E 通过条件：

- R1 Bundle 文件与 Payload SHA-256 可复算且未变化；
- R2-D 报告、包、路径、上下文及源文件 SHA-256 可复算；
- R2-D 权威顶部元数据明确为 `R2D_REVIEW_PASS / NONE`，最终结论为 `P0=0 / P1=0 / P2=0 / REVIEW_PASS`；
- manifest 数量与 R2-D 包数量相同，ID 唯一；
- 每份 `explicit_selection` 与 R2-D 推荐生产路径逐字相等；
- 根全部属于显式选择面；
- 默认排除面与显式选择面不相交并逐字继承 R2-D；
- 供应行和风险决策逐字继承，无 `unsatisfied` 输入；
- 所有显式选择 ID 均存在于 R1 Bundle；
- `consumer_decisions` 为空，未解决要求完整；
- manifest SHA、总报告 SHA、JSON 与 Markdown 可确定性重建；
- `candidate_only / reference_only / not_adopted / runtime_authorization=NONE`；
- 不改变 R1、R2-C、R2-D、运行时或 Gate。

## 10. 使用方式

生成或刷新：

```bash
ruby scripts/build_item_library_consumer_handoff.rb --write
```

日常只读验证：

```bash
ruby scripts/build_item_library_consumer_handoff.rb
```

## 11. 接受边界

- 不允许把 R2-E JSON 放入运行时数据加载路径；
- 不允许把四个 manifest 合并成整包运行时导入；
- 不允许把 `handoff_preparation=complete` 写成采纳、运行时或 Gate 通过；
- 不修改 R1，不采纳 R2-C 数值，不改变 R2-D 选择；
- 不改变 Gate 1A、Gate 1H 或 Gate 2；
- 不替代真人试玩。
