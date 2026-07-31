# 候选物品库 R2-G 支干冻结基线合同 V0.1

**项目：** Project-004-New Era 2  
**上游状态：** `R1 / R2A–R2F REVIEW_PASS`  
**基线状态：** `reference_only`  
**采纳状态：** `not_adopted`  
**运行时就绪：** `blocked`  
**运行时授权：** `NONE`

## 1. 目的

R2-G 为已经审查通过的物品库支干提供单一冻结入口。它把 R1 候选库以及 R2-A–R2-F 的审计、校准提案、选择包、消费交接和空白采纳模板整理为一份可重算清单，供未来主干定位正确文件和校验来源。

R2-G 只汇总既有事实，不新增、修改或裁定任何物品、工艺、数值、稳定 ID 或采纳决定。

## 2. 权威输入

- R1 统一候选包、C7 累计报告、基线合同与独立审查报告；
- R2-A–R2-F 的合同、生成器、机器可读报告、人工摘要与最终审查状态；
- `docs/design-docs/item-and-manufacturing-system-v0.1.md` 与 R1 冻结决议；
- 本合同与 `scripts/build_item_library_branch_baseline.rb`。

R1 bundle 内列出的 32 个嵌套来源文件仍由 R1 自身负责定义；R2-G 必须逐项复核这些路径与 SHA，但不复制一套新的内容权威定义。

## 3. 生成物

- `data/item-library/branch-baseline-r2g.json`：机器可读冻结入口；
- `data/item-library/branch-baseline-r2g.md`：人工交接摘要；
- `scripts/build_item_library_branch_baseline.rb`：确定性生成与验证工具。

JSON 与 Markdown 必须由工具生成，不得手工修改。

## 4. 必须绑定的事实

- R1：196 个库存物品、24 个非库存定义、220 个目录定义、90 个工艺、24 个转换流程；
- R2-D：4 个主题选择包；
- R2-E：4 个消费 manifest，仍为 `reference_only / not_adopted / blocked`；
- R2-F：4 个空白模板、151 个稳定 ID 决策槽、171 个总决策槽、171 个 unresolved、0 个 submitted；
- R1、R2-A–R2-F 的文件 SHA、逻辑报告 SHA 和审查状态；
- `runtime_authorization=NONE` 与 `whole_bundle_runtime_import_allowed=false`。

任何计数、来源、状态或 SHA 漂移都必须导致 R2-G 校验失败。

## 5. 审查状态门禁

审查状态只能从各报告 H1 之后、第一个二级标题之前的顶部元数据读取。不得通过正文历史记录、代码块、说明文字或重复字段伪造 PASS。

R2-G 只接受：

- R1 顶部最终裁定包含 `P0=0 / P1=0 / P2=0 / REVIEW_PASS`；
- R2-A–R2-F 顶部最终或当前状态分别为 `R2A_REVIEW_PASS` 至 `R2F_REVIEW_PASS`；
- 对应最新独立审查字段为 `REVIEW_PASS（P0=0 / P1=0 / P2=0）`；
- 全部顶部运行时授权为 `无` 或 `NONE`，不得出现授权值。

## 6. 确定性与验证

生成冻结清单：

```bash
ruby scripts/build_item_library_branch_baseline.rb --write
```

只读验证：

```bash
ruby scripts/build_item_library_branch_baseline.rb
```

R2-G 通过前仍必须执行完整上游回归：

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

## 7. 接受边界

- 不创建真实 submitted 记录；
- 不替未来主干填写 171 个决定槽；
- 不把 R2-C 提案写回 R1；
- 不生成运行时 schema、Def、UI 或存档迁移；
- 不改变 Gate 1A、Gate 1H 或 Gate 2；
- 不把静态审查当成真人试玩或主干批准；
- 不合并主干。

`R2G_REVIEW_PASS` 未来若成立，也只表示该支干冻结入口完整、可重算且边界清晰。
