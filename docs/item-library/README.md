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
- R2-A 复审状态：`reviews/item-library-r2a-review-status-2026-07-30.md`（独立 subagent 首审发现已修正，远端干净快照复审待完成）

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

分批文件是编辑源，bundle 是消费入口。不要手工修改 bundle。

## 验证

```bash
for profile in c1 c2 c3 c4 c5 c6 c7; do
  ruby scripts/validate_item_library.rb --profile "$profile"
done
ruby scripts/audit_item_library_semantics.rb
```

计算稳定 ID 的确定性依赖闭包：

```bash
ruby scripts/audit_item_library_semantics.rb \
  --select item.agriculture.compound_fertilizer,item.furniture.field_bed
```

## 当前边界

- 全部内容仍为 `candidate_only`；
- 统一候选包默认禁止整包运行时导入；
- 未来主干必须按稳定 ID 显式选取并另行获得阶段授权；
- 当前没有运行时 Def、UI、正式数值、存档迁移或 Gate 授权；
- Gate 1A、Gate 1H 与 Gate 2 状态不因本目录改变。
