# 候选物品库

这里保存《新纪元 2》R1 候选物品与制造内容。当前累计 196 个库存物品、24 个非库存定义、90 个工艺和 24 个转换流程，共 220 个目录定义。

## 从哪里开始

- 系统规则：`../design-docs/item-and-manufacturing-system-v0.1.md`
- R1 冻结决议：`../design-docs/item-and-manufacturing-system-v0.1-freeze-decision-2026-07-26.md`
- 内容配额：`item-library-content-quota-plan-v0.1.md`
- 基线与消费合同：`item-library-r1-candidate-baseline-contract-v0.1.md`
- 最新累计报告：`../../data/item-library/coverage-report.c7.md`
- 统一候选包：`../../data/item-library/item-library-r1-candidate-bundle.json`
- 最新内容审查：`reviews/item-library-c7-independent-review-2026-07-27.md`
- R1 基线审查：`reviews/item-library-r1-candidate-baseline-independent-review-2026-07-27.md`
- R2-A 语义审计合同：`item-library-semantic-audit-contract-v0.1.md`
- R2-A 机器可读审计：`../../data/item-library/semantic-audit-r2a.json`
- R2-A 审计摘要：`../../data/item-library/semantic-audit-r2a.md`
- R2-A 复审状态：`reviews/item-library-r2a-review-status-2026-07-30.md`（独立 subagent 三轮审查完成，`R2A_REVIEW_PASS`）
- R2-B 制造流审计合同：`item-library-flow-audit-contract-v0.1.md`
- R2-B 机器可读审计：`../../data/item-library/flow-audit-r2b.json`
- R2-B 审计摘要：`../../data/item-library/flow-audit-r2b.md`
- R2-B 复审状态：`reviews/item-library-r2b-review-status-2026-07-30.md`（独立 subagent 三轮审查完成，`R2B_REVIEW_PASS`）
- R2-C 校准提案合同：`item-library-calibration-contract-v0.1.md`
- R2-C 机器可读提案：`../../data/item-library/calibration-proposals-r2c.json`
- R2-C 提案摘要：`../../data/item-library/calibration-proposals-r2c.md`
- R2-C 审查状态：`reviews/item-library-r2c-review-status-2026-07-30.md`（首审两项 P2 已修正，第二轮独立 subagent 审查完成，`R2C_REVIEW_PASS`）
- R2-D 主题选择包合同：`item-library-selection-pack-contract-v0.1.md`
- R2-D 机器可读选择包：`../../data/item-library/selection-packs-r2d.json`
- R2-D 选择包摘要：`../../data/item-library/selection-packs-r2d.md`
- R2-D 审查状态：`reviews/item-library-r2d-review-status-2026-07-31.md`（两轮 P1 已修正，第三轮独立 subagent 复审完成，`R2D_REVIEW_PASS`）
- R2-E 主干消费交接合同：`item-library-consumer-handoff-contract-v0.1.md`
- R2-E 机器可读交接清单：`../../data/item-library/consumer-handoff-r2e.json`
- R2-E 交接摘要：`../../data/item-library/consumer-handoff-r2e.md`
- R2-E 审查状态：`reviews/item-library-r2e-review-status-2026-07-31.md`（首审 P1 与第二轮 P2 已修正，第三轮独立 subagent 复审完成，`R2E_REVIEW_PASS`）
- R2-F 采纳记录合同：`item-library-adoption-record-contract-v0.1.md`
- R2-F 结构 schema：`../../data/item-library/adoption-record-schema-r2f.json`
- R2-F 空白模板：`../../data/item-library/adoption-record-templates-r2f.json`
- R2-F 模板摘要：`../../data/item-library/adoption-record-templates-r2f.md`
- R2-F 审查状态：`reviews/item-library-r2f-review-status-2026-07-31.md`（两轮各一项 P1 已修正，第三轮独立 subagent 复审完成，`R2F_REVIEW_PASS`）
- R2-G 支干冻结合同：`item-library-branch-baseline-contract-v0.1.md`
- R2-G 机器可读冻结入口：`../../data/item-library/branch-baseline-r2g.json`
- R2-G 冻结摘要：`../../data/item-library/branch-baseline-r2g.md`
- R2-G 审查状态：`reviews/item-library-r2g-review-status-2026-07-31.md`（首审 P1=3 / P2=1、第二轮与第三轮各 P1=1 已修正，当前 `R2G_RECHECK_PENDING`）

## 数据布局

- `controlled-vocabulary*.yaml`：累计受控词表；
- `items*.yaml`：可库存候选物品；
- `catalog.c3.yaml`：放置、生长、角色和权利记录等非库存定义；
- `recipes*.yaml`：制造、维修和拆解工艺；
- `transitions.c3.yaml`：库存或外部交接到非库存形态的转换流程；
- `coverage-report*.md`：各档位确定性覆盖报告；
- `item-library-r1-candidate-bundle.json`：C1–C7 合并后的只读生成物。
- `semantic-audit-r2a.json`：220 项逐项语义分类和 334 节点依赖图；
- `semantic-audit-r2a.md`：R2-A 人工审查摘要。
- `flow-audit-r2b.json`：90 张工艺的制造流、循环、候选价值和共享瓶颈机器报告；
- `flow-audit-r2b.md`：R2-B 人工审查摘要；
- `calibration-proposals-r2c.json`：90 张工艺的基线与内存 overlay 质量/候选价值画像，以及逐字段校准提案；
- `calibration-proposals-r2c.md`：R2-C 人工审查摘要；
- `selection-packs-r2d.json`：四个主题包的根集合、推荐生产路径、完整语义审计上下文与风险绑定；
- `selection-packs-r2d.md`：R2-D 人工审查摘要；
- `consumer-handoff-r2e.json`：供未来主干评估的四份显式稳定 ID allowlist、默认排除面、供应接口和阻塞式采纳队列；
- `consumer-handoff-r2e.md`：R2-E 人工审查摘要；
- `adoption-record-schema-r2f.json`：采纳决策记录的结构 schema，不是运行时 schema；
- `adoption-record-templates-r2f.json`：逐项绑定 R2-E manifest 的四份未填写 draft 模板；
- `adoption-record-templates-r2f.md`：R2-F 人工审查摘要；
- `branch-baseline-r2g.json`：R1 与 R2-A–R2-F 的单一支干冻结入口、文件 SHA 和审查链；
- `branch-baseline-r2g.md`：R2-G 人工交接摘要。

分批文件是编辑源，bundle 是候选消费入口。R2-C 只生成提案，R2-D 只生成选择规划参考，R2-E 只生成主干交接参考，R2-F 只生成空白决策模板，R2-G 只汇总支干冻结来源；这些都不是运行时补丁。不要手工修改 bundle 与确定性报告。

## 验证

```bash
for profile in c1 c2 c3 c4 c5 c6 c7; do
  ruby scripts/validate_item_library.rb --profile "$profile"
done
ruby scripts/audit_item_library_semantics.rb
ruby scripts/audit_item_library_flows.rb
ruby scripts/propose_item_library_calibration.rb
ruby scripts/build_item_library_selection_packs.rb
ruby scripts/build_item_library_consumer_handoff.rb
ruby scripts/validate_item_library_adoption_records.rb
ruby scripts/build_item_library_branch_baseline.rb
```

计算稳定 ID 的确定性依赖闭包：

```bash
ruby scripts/audit_item_library_semantics.rb \
  --select item.agriculture.compound_fertilizer,item.furniture.field_bed
```

## 当前边界

- 全部内容仍为 `candidate_only`；
- 统一候选包默认禁止整包运行时导入；
- R2-C 数值只存在于 `proposal_only` 内存 overlay，未修改 R1；
- R2-D 四个主题包均为 `reference_only`，完整语义闭包不等于推荐导入清单；
- R2-E 四份交接 manifest 均为 `reference_only / not_adopted`，`consumer_decisions` 为空且运行时就绪保持阻塞；
- R2-F 四份记录均为 `template_only / draft / submission_ready=false`，171 个决策槽全部 unresolved；
- R2-G 冻结入口为 `reference_only / not_adopted / blocked`，只绑定来源、计数、SHA 与审查状态；
- 未来主干必须按稳定 ID 显式选取并另行获得阶段授权；
- 当前没有运行时 Def、UI、正式数值、存档迁移或 Gate 授权；
- Gate 1A、Gate 1H 与 Gate 2 状态不因本目录改变。
