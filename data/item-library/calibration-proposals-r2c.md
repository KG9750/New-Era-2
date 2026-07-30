# 候选物品库 R2-C 单位与候选价值校准提案

**来源基线：** `new-era-2.item-library.r1-c7-candidate`
**来源 Payload SHA-256：** `02918459ef17e42ed5e2151660873f6a4e88e12dff29730a013f1d062fe554ad`
**状态：** `candidate_only`
**运行时授权：** `NONE`
**提案模式：** `proposal_only`
**Overlay SHA-256：** `2e1cfcf1e5421b915e92715cf204830ca097ad674af339e84d58be71a6841df1`
**报告 SHA-256：** `bb2aea80fa6fa7c10f0f4aeeb235d1e9adb30bd2330fc7590b3f5f7a6eacf09c`

## 1. 结论

- `CALIBRATION_PROPOSALS=PASS`
- `RECIPES_PROFILED=90`
- `BASELINE_SEVERE_MASS_COUNT=11`
- `BASELINE_MASS_REVIEW_COUNT=7`
- `BASELINE_VALUE_OUTLIER_COUNT=7`
- `NUMERIC_PATCH_PROPOSAL_COUNT=15`
- `ACCEPTED_OUTLIER_COUNT=2`
- `OVERLAY_UNADJUDICATED_SEVERE_MASS_COUNT=0`
- `OVERLAY_UNADJUDICATED_VALUE_OUTLIER_COUNT=0`

全部修改只应用于内存 overlay；R1 Bundle、分片 YAML 和运行时数据均未修改。

## 2. 数值提案

| 提案 | 目标工艺 | 基线最大质量比 | Overlay 最大质量比 | 基线最大价值比 | Overlay 最大价值比 |
|---|---|---:|---:|---:|---:|
| `r2c.numeric.01_flour_unit_mass` | `recipe.c5_food.mill_flour` | 9.0 | 0.9 | 2.1 | 2.1 |
| `r2c.numeric.02_watch_dismantle_yield` | `recipe.dismantle.mechanical_watch` | 4.55 | 0.825 | 0.038154 | 0.006462 |
| `r2c.numeric.03_biomass_briquette_units` | `recipe.c4_wood.compress_briquette` | 2.55 | 0.96 | 4.25 | 1.6 |
| `r2c.numeric.04_battery_module_casing` | `recipe.c4_battery.assemble_module` | 2.285714 | 1.0 | 1.400966 | 1.210856 |
| `r2c.numeric.05_archive_drive_recovery` | `recipe.dismantle.offline_archive_drive` | 2.15 | 0.85 | 0.24 | 0.1 |
| `r2c.numeric.06_sterile_bandage_unit` | `recipe.medical.sterilize_bandage` | 2.083333 | 0.833333 | 11.290323 | 3.225806 |
| `r2c.numeric.07_field_bed_frame` | `recipe.c2_assembly.field_bed` | 1.764706 | 1.034483 | 2.282609 | 1.779661 |
| `r2c.numeric.08_fastener_batch` | `recipe.metal.form_fasteners` | 1.644444 | 0.916667 | 11.384615 | 6.25 |
| `r2c.numeric.09_field_repair_kit_packaging` | `recipe.metal.assemble_field_repair_kit` | 1.315789 | 1.0 | 1.288889 | 1.137255 |
| `r2c.numeric.10_wired_alarm_housing` | `recipe.electrical.assemble_wired_alarm_unit` | 1.304348 | 0.993377 | 1.333333 | 1.300544 |
| `r2c.numeric.11_bolt_rifle_recovery` | `recipe.dismantle.bolt_rifle` | 1.27619 | 0.890476 | 0.327579 | 0.240842 |
| `r2c.numeric.12_workshop_stool_lumber` | `recipe.c7_furniture.make_workshop_stool` | 0.042745 | 0.942408 | 0.107546 | 1.530864 |
| `r2c.numeric.13_communal_bench_lumber` | `recipe.c7_furniture.make_communal_bench` | 0.054645 | 0.982906 | 0.087765 | 1.157088 |
| `r2c.numeric.14_storage_shelf_lumber` | `recipe.c7_furniture.make_storage_shelf` | 0.048041 | 0.921986 | 0.079946 | 1.092593 |
| `r2c.numeric.15_reinforced_plate_offcuts` | `recipe.metal.assemble_reinforced_plate` | 1.052632 | 1.0 | 4.866667 | 4.826667 |

### `r2c.numeric.01_flour_unit_mass`

面粉以 bag 计量，但 10 kg/bag 会让 1 kg 原粮产出最多 9 kg 面粉，并使两张下游烘焙工艺把一袋面粉按 10 kg 计入。把候选袋质量改为 1 kg，可同时校正磨粉和下游画像。

- `replace_item_field` / `item.food.grain_flour` / mass：10.0 → 1.0
- 下游受影响工艺：`recipe.c5_food.bake_flatbread`、`recipe.c6_food.bake_travel_biscuit`

### `r2c.numeric.02_watch_dismantle_yield`

0.1 kg 腕表的回收上限不应超过目标质量。按精密小件比例缩小机械备件和金属边角料区间。

- `replace_recipe_output_field` / `item.component.mechanical_spares` / min：0.05 → 0.01
- `replace_recipe_output_field` / `item.component.mechanical_spares` / max：0.15 → 0.025
- `replace_recipe_output_field` / `item.waste.metal_offcuts` / min：0.02 → 0.005
- `replace_recipe_output_field` / `item.waste.metal_offcuts` / max：0.08 → 0.02
- 下游受影响工艺：`recipe.c2_assembly.weapon_cleaning_kit`、`recipe.c5_component.assemble_bearing_kit`、`recipe.c6_ammo.make_crossbow_bolts`、`recipe.c6_ammo.make_hunting_arrows`、`recipe.c6_weapon.make_light_crossbow`、`recipe.metal.assemble_field_repair_kit`、`recipe.repair.bolt_rifle_service`、`recipe.repair.mechanical_watch_service`、`recipe.repair.pump_shotgun_service`

### `r2c.numeric.03_biomass_briquette_units`

当前一袋 4 kg 木屑会产出最多 10.2 kg 压块。提高木屑批量并略收紧产出上限，使最大质量返回比低于 1，候选价值比回到筛查区间。

- `replace_recipe_input_amount` / `item.waste.sawdust` / amount：1.0 → 2.5
- `replace_recipe_output_field` / `item.material.biomass_briquette` / max：0.85 → 0.8
- 下游受影响工艺：无

### `r2c.numeric.04_battery_module_casing`

8 kg 电池模块的既有输入只有 3.5 kg，描述中缺少可审计的结构外壳。提案增加 0.25 bundle 回收金属板作为候选壳体材料。

- `add_recipe_input` / `item.material.reclaimed_steel_plate` / 新增输入 `item.material.reclaimed_steel_plate`，amount=0.25
- 下游受影响工艺：`recipe.c5_electronic.assemble_field_telephone`、`recipe.c5_electronic.assemble_task_lantern`

### `r2c.numeric.05_archive_drive_recovery`

0.6 kg 档案盘的电子件与铜线最大回收质量达到 1.29 kg。缩小两项回收区间，使最大库存回收质量为 0.51 kg。

- `replace_recipe_output_field` / `item.component.recovered_electronics` / min：0.3 → 0.2
- `replace_recipe_output_field` / `item.component.recovered_electronics` / max：0.7 → 0.3
- `replace_recipe_output_field` / `item.material.copper_wire` / min：0.05 → 0.03
- `replace_recipe_output_field` / `item.material.copper_wire` / max：0.15 → 0.05
- 下游受影响工艺：`recipe.c2_assembly.task_lamp`、`recipe.c5_component.assemble_connectors`、`recipe.c5_component.assemble_power_regulator`、`recipe.c5_component.assemble_protected_relay`、`recipe.c5_electronic.assemble_task_lantern`、`recipe.electrical.assemble_wired_alarm_unit`、`recipe.repair.offline_archive_drive`、`recipe.repair.task_lamp`

### `r2c.numeric.06_sterile_bandage_unit`

单包绷带的 0.3 kg 与 14 候选价值同时放大产出。改为 0.12 kg、4 候选价值后，最大质量返回比和候选价值比都回到筛查区间。

- `replace_item_field` / `item.medical.sterile_bandage` / mass：0.3 → 0.12
- `replace_item_field` / `item.medical.sterile_bandage` / base_value：14.0 → 4.0
- 下游受影响工艺：`recipe.c6_medical.pack_field_wound_care`

### `r2c.numeric.07_field_bed_frame`

9 kg 野战床只有 5.1 kg 已消耗库存输入。把回收金属板从 0.15 提高到 0.35 bundle，为折叠框架补足候选结构质量。

- `replace_recipe_input_amount` / `item.material.reclaimed_steel_plate` / amount：0.15 → 0.35
- 下游受影响工艺：`recipe.dismantle.field_bed`、`recipe.repair.field_bed`

### `r2c.numeric.08_fastener_batch`

紧固件工艺同时存在质量放大与高候选价值比。提高板材输入并收紧紧固件上限，先修正质量；剩余价值溢价单独作为暂时接受异常。

- `replace_recipe_input_amount` / `item.material.reclaimed_steel_plate` / amount：0.25 → 0.4
- `replace_recipe_output_field` / `item.component.fastener_set` / max：8.0 → 7.0
- 下游受影响工艺：`recipe.c2_assembly.field_bed`、`recipe.c2_assembly.task_lamp`、`recipe.c5_component.assemble_hose`、`recipe.c5_medical.assemble_clean_splint`、`recipe.c5_tool.assemble_mechanic_set`、`recipe.c6_ammo.make_crossbow_bolts`、`recipe.c6_ammo.make_hunting_arrows`、`recipe.c6_weapon.make_capture_net`、`recipe.c6_weapon.make_hunting_spear`、`recipe.c6_weapon.make_weighted_staff`、`recipe.c7_clothing.make_welding_apron`、`recipe.c7_clothing.make_work_boots`、`recipe.c7_clothing.sew_insulated_coat`、`recipe.c7_clothing.sew_padded_trousers`、`recipe.c7_clothing.sew_rain_shell`、`recipe.c7_daily.assemble_sewing_kit`、`recipe.c7_furniture.make_communal_bench`、`recipe.c7_furniture.make_storage_shelf`、`recipe.c7_furniture.make_workshop_stool`、`recipe.electrical.assemble_wired_alarm_unit`、`recipe.metal.assemble_field_repair_kit`、`recipe.metal.assemble_reinforced_plate`、`recipe.repair.field_bed`、`recipe.textile.sew_padded_vest`、`recipe.textile.sew_work_clothes`

### `r2c.numeric.09_field_repair_kit_packaging`

5 kg 现场维修包的既有内容物只有 3.8 kg。增加 0.3 roll 通用织物，代表工具卷、隔层与封装材料。

- `add_recipe_input` / `item.material.woven_cloth` / 新增输入 `item.material.woven_cloth`，amount=0.3
- 下游受影响工艺：无

### `r2c.numeric.10_wired_alarm_housing`

6 kg 有线预警单元的既有电子与线束输入只有 4.6 kg。增加 0.08 bundle 回收金属板作为候选外壳和安装底板。

- `add_recipe_input` / `item.material.reclaimed_steel_plate` / 新增输入 `item.material.reclaimed_steel_plate`，amount=0.08
- 下游受影响工艺：无

### `r2c.numeric.11_bolt_rifle_recovery`

4.2 kg 步枪的最大库存回收质量为 5.36 kg。收紧机械件、板材和边角料上限，使最大回收质量低于目标质量。

- `replace_recipe_output_field` / `item.component.mechanical_spares` / max：0.8 → 0.6
- `replace_recipe_output_field` / `item.material.reclaimed_steel_plate` / max：0.12 → 0.08
- `replace_recipe_output_field` / `item.waste.metal_offcuts` / max：1.2 → 0.8
- 下游受影响工艺：`recipe.c2_assembly.field_bed`、`recipe.c2_assembly.weapon_cleaning_kit`、`recipe.c5_component.assemble_bearing_kit`、`recipe.c5_component.assemble_hose`、`recipe.c5_tool.assemble_mechanic_set`、`recipe.c6_ammo.make_crossbow_bolts`、`recipe.c6_ammo.make_hunting_arrows`、`recipe.c6_weapon.make_breaching_sledge`、`recipe.c6_weapon.make_hunting_spear`、`recipe.c6_weapon.make_light_crossbow`、`recipe.c7_clothing.make_work_boots`、`recipe.metal.assemble_field_repair_kit`、`recipe.metal.assemble_reinforced_plate`、`recipe.metal.form_fasteners`、`recipe.repair.bolt_rifle_service`、`recipe.repair.field_bed`、`recipe.repair.mechanical_watch_service`、`recipe.repair.pump_shotgun_service`

### `r2c.numeric.12_workshop_stool_lumber`

工艺把 24 kg/bundle 的整形木板按七个 bundle 使用，明显混淆了 bundle 与单块木板。改为 0.30 bundle。

- `replace_recipe_input_amount` / `item.material.reclaimed_lumber` / amount：7.0 → 0.3
- 下游受影响工艺：`recipe.c4_wood.compress_briquette`

### `r2c.numeric.13_communal_bench_lumber`

公共长凳把 24 kg/bundle 的木板按 14 个 bundle 使用。改为 0.75 bundle，使质量与候选价值同时回到筛查区间。

- `replace_recipe_input_amount` / `item.material.reclaimed_lumber` / amount：14.0 → 0.75
- 下游受影响工艺：`recipe.c4_wood.compress_briquette`

### `r2c.numeric.14_storage_shelf_lumber`

储物架把 24 kg/bundle 的木板按 18 个 bundle 使用。改为 0.90 bundle，使质量与候选价值同时回到筛查区间。

- `replace_recipe_input_amount` / `item.material.reclaimed_lumber` / amount：18.0 → 0.9
- 下游受影响工艺：`recipe.c4_wood.compress_briquette`

### `r2c.numeric.15_reinforced_plate_offcuts`

粗制防护插板只轻微超重，先把金属边角料最大值从 1.5 kg 收紧到 1.2 kg，使最大库存输出质量等于输入质量；剩余候选价值溢价单独裁定。

- `replace_recipe_byproduct_field` / `item.waste.metal_offcuts` / max：1.5 → 1.2
- 下游受影响工艺：`recipe.c6_ammo.make_crossbow_bolts`、`recipe.c6_ammo.make_hunting_arrows`

## 3. 暂时接受的残余异常

| 裁定 | 工艺 | Overlay 最大价值比 | 状态 |
|---|---|---:|---|
| `r2c.accepted.01_fastener_value_premium` | `recipe.metal.form_fasteners` | 6.25 | provisional |
| `r2c.accepted.02_reinforced_plate_value_premium` | `recipe.metal.assemble_reinforced_plate` | 4.826667 | provisional |

- `r2c.accepted.01_fastener_value_premium`：质量修正后仍有标准化、精密加工与 3–5 小时人物时间溢价。当前 base_value 继续保留，以免在没有运行时维修需求数据时同时改写 24 张下游工艺的价值关系。 任何包含紧固件的稳定 ID 子集进入运行时前，必须用实际维修消耗、人物时间与下游订单数据重新校准。
- `r2c.accepted.02_reinforced_plate_value_premium`：质量修正后剩余候选价值溢价可暂由受控装配、品质检查、安全用途和 4–7 小时人物时间解释；没有足够证据直接降低防护件价值。 选择防护插板进入运行时前，必须与伤害、防护、耐久和制造失败率一起校准。

## 4. 质量人工复核队列

| 工艺 | 基线最大质量比 | Overlay 最大质量比 | 复核提示 |
|---|---:|---:|---|
| `recipe.c2_assembly.task_lamp` | 1.162791 | 1.162791 | 复核外壳、包装、装配辅料与成品单位。 |
| `recipe.c2_assembly.weapon_cleaning_kit` | 1.074627 | 1.074627 | 复核外壳、包装、装配辅料与成品单位。 |
| `recipe.c5_medical.prepare_oral_rehydration` | 1.06486 | 1.06486 | 复核容器、密度、含水率与区间取整。 |
| `recipe.c6_medical.prepare_irrigation_saline` | 1.090188 | 1.090188 | 复核容器、密度、含水率与区间取整。 |
| `recipe.chemistry.mix_cleaning_solution` | 1.089109 | 1.089109 | 复核容器、密度、含水率与区间取整。 |
| `recipe.dismantle.pump_shotgun` | 1.197368 | 1.197368 | 复核目标质量、回收单位和最大回收区间。 |
| `recipe.metal.assemble_reinforced_plate` | 1.052632 | 1.0 | 复核外壳、包装、装配辅料与成品单位。 |

该队列不自动改数值；容器、含水率、燃料、外壳和回收区间必须结合未来 Gate 子集判断。

## 5. 重建命令

```bash
ruby scripts/propose_item_library_calibration.rb --write
ruby scripts/propose_item_library_calibration.rb
```

## 6. 接受边界

- 本文件是 `proposal_only`，不是 R1 修订版；
- 全部内容仍为 `candidate_only`；
- `runtime_authorization` 仍为 `NONE`；
- 不允许整包运行时导入；
- Gate 1A、Gate 1H 与 Gate 2 状态不因本提案改变。
