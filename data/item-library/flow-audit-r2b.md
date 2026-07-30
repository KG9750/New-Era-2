# 候选物品库 R2-B 制造流、循环与候选经济审计

**来源基线：** `new-era-2.item-library.r1-c7-candidate`
**来源 Payload SHA-256：** `02918459ef17e42ed5e2151660873f6a4e88e12dff29730a013f1d062fe554ad`
**状态：** `candidate_only`
**运行时授权：** `NONE`
**审计 SHA-256：** `b11ac7a39e9839f33bffe5375e7d9f5c3e827c89e70de0743f26defa45939f3d`

## 1. 结论

- `FLOW_AUDIT=PASS`
- `ERROR_COUNT=0`
- `WARNING_COUNT=7`
- `RECIPE_COUNT=90`
- `TRANSFORMATION_CYCLE_COUNT=2`
- `SHARED_BOTTLENECK_COUNT=33`

本报告使用候选数值筛查制造流风险，不构成正式价格、产能、市场或运行时平衡。

## 2. 来源与终端去向

| 指标 | 数量 |
|---|---:|
| 非制造起点物品 | 191 |
| 可从起点抵达的物品 | 196 |
| 可执行工艺 | 90 |
| 存在不可达必需输入位的工艺 | 0 |
| 外部来源物品 | 108 |
| 断裂来源 | 0 |
| 制造终端产出 | 56 |
| 缺少终端去向 | 0 |

制造终端产出可以通过食用、治疗、装备、安装、交付、损坏或拆解结束链条，不要求继续成为另一工艺的输入。

## 3. 转化循环

| 循环物品 | 工艺 | 最小人物时间 | 最大拆解回收比 | 有损边界 |
|---|---|---:|---:|---|
| `item.component.cable_harness`<br>`item.component.recovered_electronics`<br>`item.furniture.task_lamp`<br>`item.material.copper_wire` | `recipe.c2_assembly.task_lamp`<br>`recipe.dismantle.task_lamp` | 1.5 | 0.423913 | 是 |
| `item.component.fastener_set`<br>`item.furniture.field_bed`<br>`item.material.reclaimed_steel_plate`<br>`item.material.woven_cloth` | `recipe.c2_assembly.field_bed`<br>`recipe.dismantle.field_bed`<br>`recipe.metal.form_fasteners` | 1.5 | 0.222143 | 是 |

## 4. 候选价值校准警告

| 工艺 | 最大返回比 | 候选输入值 | 候选最大产出值 | 裁定 |
|---|---:|---:|---:|---|
| `recipe.c4_wood.compress_briquette` | 4.25 | 2.0 | 8.5 | 进入运行时前校准 |
| `recipe.c7_furniture.make_communal_bench` | 0.087765 | 344.1 | 30.2 | 进入运行时前校准 |
| `recipe.c7_furniture.make_storage_shelf` | 0.079946 | 442.8 | 35.4 | 进入运行时前校准 |
| `recipe.c7_furniture.make_workshop_stool` | 0.107546 | 172.95 | 18.6 | 进入运行时前校准 |
| `recipe.medical.sterilize_bandage` | 11.290323 | 6.2 | 70.0 | 进入运行时前校准 |
| `recipe.metal.assemble_reinforced_plate` | 4.866667 | 15.0 | 73.0 | 进入运行时前校准 |
| `recipe.metal.form_fasteners` | 11.384615 | 6.5 | 74.0 | 进入运行时前校准 |

极端比值只提示单位、数量或 `base_value` 可能需要复核；人物时间、设施、风险与品质尚未折价。

### 4.1 拆解

| 工艺 | 目标候选值 | 最大回收值 | 最大回收比 |
|---|---:|---:|---:|
| `recipe.dismantle.bolt_rifle` | 95.0 | 31.12 | 0.327579 |
| `recipe.dismantle.field_bed` | 42.0 | 9.33 | 0.222143 |
| `recipe.dismantle.mechanical_watch` | 130.0 | 4.96 | 0.038154 |
| `recipe.dismantle.offline_archive_drive` | 120.0 | 28.8 | 0.24 |
| `recipe.dismantle.pump_shotgun` | 88.0 | 27.0 | 0.306818 |
| `recipe.dismantle.task_lamp` | 46.0 | 19.5 | 0.423913 |

### 4.2 维修

| 工艺 | 目标候选值 | 材料候选值 | 材料比 |
|---|---:|---:|---:|
| `recipe.repair.bolt_rifle_service` | 95.0 | 18.0 | 0.189474 |
| `recipe.repair.field_bed` | 42.0 | 7.55 | 0.179762 |
| `recipe.repair.mechanical_watch_service` | 130.0 | 7.1 | 0.054615 |
| `recipe.repair.offline_archive_drive` | 120.0 | 21.2 | 0.176667 |
| `recipe.repair.pump_shotgun_service` | 88.0 | 18.0 | 0.204545 |
| `recipe.repair.task_lamp` | 46.0 | 18.9 | 0.41087 |

## 5. 共享瓶颈候选

| 物品 | 使用工艺数 | 覆盖主链 | 候选基础价值 |
|---|---:|---|---:|
| `item.component.fastener_set` | 24 | industry、politics、security、survival | 9 |
| `item.material.woven_cloth` | 21 | industry、politics、security、survival | 20 |
| `item.material.reclaimed_lumber` | 14 | industry、politics、security、survival | 24 |
| `item.material.plant_fiber` | 13 | industry、politics、security、survival | 8 |
| `item.water.clean_water` | 13 | industry、politics、security、survival | 1 |
| `item.material.reclaimed_steel_plate` | 11 | industry、politics、security、survival | 26 |
| `item.material.dry_firewood` | 9 | industry、politics、security、survival | 11 |
| `item.material.reclaimed_rubber_strip` | 8 | industry、politics、security、survival | 16 |
| `item.component.mechanical_spares` | 7 | industry、politics、security、survival | 32 |
| `item.material.copper_wire` | 7 | industry、politics、security、survival | 24 |
| `item.chemical.mineral_salt` | 7 | politics、security、survival | 3 |
| `item.component.recovered_electronics` | 6 | industry、politics、security、survival | 36 |
| `item.daily.cleaning_rags` | 5 | industry、politics、security、survival | 4 |
| `item.component.cable_harness` | 4 | industry、politics、security、survival | 30 |
| `item.chemical.alkaline_base` | 3 | industry、politics、security、survival | 7 |

这些物品是未来选择主题—军备共享瓶颈的候选，不表示 Gate 2 已解锁。

## 6. 产能集中度

### 设施

- `basic_workshop`：18 张工艺
- `textile_bench`：15 张工艺
- `carpentry_bench`：11 张工艺
- `electrical_bench`：11 张工艺
- `clean_workbench`：8 张工艺
- `basic_kitchen`：7 张工艺
- `precision_bench`：6 张工艺
- `archery_bench`：5 张工艺
- `armory_bench`：5 张工艺
- `kiln`：5 张工艺

### 工具

- `measuring_tools`：56 张工艺
- `sewing_tools`：19 张工艺
- `woodworking_tools`：16 张工艺
- `metalworking_tools`：14 张工艺
- `electrical_testing_tools`：12 张工艺
- `metal_sorting_tools`：8 张工艺
- `cooking_set`：7 张工艺
- `chemical_measuring_tools`：6 张工艺
- `sterilization_tools`：6 张工艺
- `archery_tools`：5 张工艺

### 最低岗位

- `tailor`：14 张工艺
- `carpenter`：11 张工艺
- `mechanic`：10 张工艺
- `cook`：9 张工艺
- `electrician`：9 张工艺
- `armorer`：8 张工艺
- `medic`：7 张工艺
- `recycler`：4 张工艺
- `energy_technician`：3 张工艺
- `lumber_worker`：3 张工艺
- `mason`：3 张工艺
- `water_technician`：3 张工艺
- `archivist`：2 张工艺
- `sanitation_worker`：2 张工艺
- `farm_worker`：1 张工艺
- `general_worker`：1 张工艺

## 7. 重建命令

```bash
ruby scripts/audit_item_library_flows.rb --write
ruby scripts/audit_item_library_flows.rb
```

## 8. 接受边界

- R1 物品、工艺、转换和候选数值未修改；
- 全部内容仍为 `candidate_only`；
- `runtime_authorization` 仍为 `NONE`；
- 不允许整包运行时导入；
- Gate 1A、Gate 1H 与 Gate 2 状态不因本报告改变。
