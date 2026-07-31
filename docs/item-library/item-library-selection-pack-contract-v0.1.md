# 候选物品库 R2-D 主题选择包合同 V0.1

**项目：** Project-004-New Era 2
**上游基线：** `new-era-2.item-library.r1-c7-candidate`
**上游状态：** `R2A_REVIEW_PASS / R2B_REVIEW_PASS / R2C_REVIEW_PASS`
**内容状态：** `candidate_only`
**选择包状态：** `reference_only`
**运行时授权：** `NONE`

## 1. 目的

R2-D 把完整候选库整理成四个面向未来主干调用的主题选择包。每个包回答：

1. 主题玩法希望选择哪些根稳定 ID；
2. 支撑这些根内容的推荐生产路径包含哪些物品、工艺、转换和非库存定义；
3. R2-A 为安全审计展开的完整语义闭包还包含哪些上下文节点；
4. R2-B 的流、循环、共享瓶颈和价值风险如何随包传播；
5. R2-C 的数值提案、暂时接受异常和人工复核项如何随包传播；
6. 哪些内容明确不属于本包的推荐采纳面。

R2-D 是选择规划层，不是运行时 schema、导入清单或 Gate 授权。

## 2. 权威输入与生成物

权威输入：

- `data/item-library/item-library-r1-candidate-bundle.json`
- `data/item-library/semantic-audit-r2a.json`
- `data/item-library/flow-audit-r2b.json`
- `data/item-library/calibration-proposals-r2c.json`
- `docs/item-library/reviews/item-library-r2c-review-status-2026-07-30.md`
- 本合同

工具与确定性生成物：

- `scripts/build_item_library_selection_packs.rb`
- `data/item-library/selection-packs-r2d.json`
- `data/item-library/selection-packs-r2d.md`

JSON 与 Markdown 必须由工具确定性生成，不得手工修改。

## 3. 四个主题包

### 3.1 生存、医疗与基础安置

`pack.r2d.survival_medical`

- `item.food.travel_biscuit`
- `item.medical.field_wound_care_pack`
- `item.medical.wound_irrigation_saline`
- `item.clothing.insulated_coat`
- `item.furniture.field_bed`

### 3.2 工业维修与离线电气

`pack.r2d.industry_maintenance`

- `item.tool.mechanic_hand_tool_set`
- `item.tool.field_repair_kit`
- `item.electronic.rechargeable_task_lantern`
- `item.electronic.wired_field_telephone`

### 3.3 低技术安防与预警

`pack.r2d.security_low_tech`

- `item.weapon.hunting_bow`
- `item.ammunition.hunting_arrow_bundle`
- `item.weapon.light_crossbow`
- `item.ammunition.crossbow_bolt_bundle`
- `item.armor.padded_vest`
- `item.armor.reinforced_plate`
- `item.electronic.wired_alarm_unit`

### 3.4 公共生活、家居与权利记录

`pack.r2d.civic_domestic`

- `item.furniture.communal_bench`
- `item.furniture.modular_storage_shelf`
- `item.daily.sewing_mending_kit`
- `item.decoration.carved_wooden_figure`
- `item.decoration.cloth_toy`
- `record.right.ration_entitlement`
- `record.right.workshop_position_qualification`

根集合是主题入口，不表示其所有依赖已获运行时授权。

## 4. 双层选择面

每个包必须同时保存两个不同用途的集合。

### 4.1 推荐生产路径

`recommended_production_path` 是未来主干选择时优先评估的候选面：

- 从根稳定 ID 出发；
- 库存成品优先递归选择把它列为主产出的非维修、非拆解生产者；
- 若必需输入只有副产来源，必须通过合同内显式首选来源选择一条生产路径，不得把所有共生产者拉入推荐面；
- 工艺递归纳入直接输入，并保留所有库存主产出与副产物节点；
- 替代输入不自动成为默认生产路径，只记录为替代上下文；
- 非库存定义纳入其转换，以及 profile 中的库存输入、输出；
- 转换纳入来源库存、附加输入和目标定义；
- 没有推荐生产者的输入必须具有非 `manufacture` 获得路径。

推荐生产路径不得包含 `repair` 或 `dismantle` 工艺。维修、拆解、弹药兼容和其他替代生产者属于审计上下文。

当前仅为两个无主产出废料声明首选来源：

- `item.waste.metal_offcuts` → `recipe.metal.reclaim_steel_plate`
- `item.waste.sawdust` → `recipe.c4_wood.saw_lumber`

### 4.2 完整语义审计上下文

`semantic_audit_context` 必须逐字复用 R2-A `--select` 的确定性闭包语义，包括：

- 所有候选生产者；
- 根物品的维修与拆解关系；
- 根物品的转换关系；
- 武器与弹药兼容关系；
- 非库存定义的 profile 关系；
- R2-A 适用警告。

`audit_context_only` 是完整语义闭包减去推荐生产路径后的差集。节点出现在这里不代表建议导入。例如，枪械拆解可能作为回收钢板的替代来源进入上下文，但不因此进入低技术安防包的推荐生产路径。

推荐路径同时记录必需输入的供应解释：

- `designated_supply_producer_recipe_ids`：按推荐生产者规则明确选中的供应工艺；
- `incidental_co_producer_recipe_ids`：已在路径内、但只是顺带产出该输入的工艺；
- `external_acquisition_types`：R1 已声明的非制造获得方式。

顺带共生产者不能替代指定供应来源，也不能据此把更多共生产工艺拉入推荐路径。

## 5. 明确排除

每个包必须列出少量 `explicit_exclusions`，说明为何某些相邻内容不作为根或推荐生产路径：

- 无候选制造路径、需要正式战斗平衡的枪械和受控防具；
- 缺少目标 Gate 的稀有物品；
- 与当前主题无关的高级设施、权利或宠物；
- 只作为替代拆解来源进入完整语义闭包的内容。

排除项可以出现在 `audit_context_only`，但不得出现在根集合或推荐生产路径。

## 6. R2-B 与 R2-C 风险绑定

每个包必须分别报告推荐生产路径和审计上下文中的：

- R2-B 普通工艺价值异常；
- R2-B 转化循环；
- R2-B 共享瓶颈；
- R2-C `numeric_patch_proposal`；
- R2-C `accepted_outlier / provisional`；
- R2-C 质量人工复核队列。

循环风险必须区分：

- `r2b_contained_cycle_ids`：该选择面同时包含循环的全部物品与全部工艺；
- `r2b_cycle_touchpoint_ids`：该选择面只接触循环的部分物品或工艺，尚未包含完整循环。

两者在同一选择面内互斥。“接触循环材料”不得写成“推荐路径包含完整循环”。

数值提案在以下任一条件成立时与集合关联：

- 提案目标工艺位于集合；
- 提案的 `metric_affected_recipe_ids` 与集合工艺相交。

不得仅因提案触及一个公共物品，就把与集合工艺无关的提案传播到该包。

`risk_binding.audit_context_only` 表示“完整语义审计上下文相对推荐生产路径新增的风险关系”，由两个选择面的风险集合做差得到；它不是对 `audit_context_only.nodes` 单独重算的自足风险集合。因此，若差集节点补全了推荐路径原先只接触的循环，新增风险可以列为 `contained_cycle`，但不表示仅靠差集节点就能独立形成该循环。

## 7. Readiness 口径

允许的规划状态：

- `selection_planning=complete`：根、推荐路径、审计上下文和风险绑定完整；
- `calibration_decision=required|not_required`：推荐路径是否依赖 R2-C 数值提案；
- `manual_review=required|not_required`：推荐路径是否包含质量复核项或暂时接受异常；
- `runtime_readiness=blocked`：始终保持阻塞。

`selection_planning=complete` 不等于内容已被采纳，更不等于运行时或 Gate 通过。

## 8. 确定性与通过标准

R2-D 通过条件：

- Bundle、R2-A、R2-B、R2-C 的基线、Payload、状态、授权和审计 SHA-256 可独立复算；
- R2-C 状态文档明确为 `R2C_REVIEW_PASS`；
- 四个包 ID、根 ID 唯一且全部已知；
- 四个 R2-A 语义闭包可由同一根集合逐字重建；
- 推荐生产路径全部是完整语义闭包子集；
- 推荐生产路径不含维修或拆解；
- 推荐路径的每个工艺引用完整，每个必需输入有推荐生产者或外部来源；
- 明确排除项不进入根或推荐生产路径；
- R2-B/R2-C 风险关联可独立重算，无漏项或误传播；
- 包内 SHA-256、总报告 SHA-256、JSON 与 Markdown 可确定性重建；
- R1 文件和 Payload SHA-256 不变；
- `candidate_only / reference_only / runtime_authorization=NONE`。

## 9. 使用方式

生成或刷新：

```bash
ruby scripts/build_item_library_selection_packs.rb --write
```

日常只读验证：

```bash
ruby scripts/build_item_library_selection_packs.rb
```

## 10. 接受边界

- R2-D 不修改 R1 或采纳 R2-C 数值；
- 不允许把完整语义闭包等同于推荐导入清单；
- 不允许整包运行时导入；
- 未来主干仍需按稳定 ID 选择、建立运行时 schema、逐项采纳校准值并获得目标 Gate 授权；
- 不改变 Gate 1A、Gate 1H 或 Gate 2；
- 不替代真人试玩。
