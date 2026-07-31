# 候选物品库 R2-D 主题选择包

**来源基线：** `new-era-2.item-library.r1-c7-candidate`
**来源 Payload SHA-256：** `02918459ef17e42ed5e2151660873f6a4e88e12dff29730a013f1d062fe554ad`
**内容状态：** `candidate_only`
**选择包状态：** `reference_only`
**运行时授权：** `NONE`
**报告 SHA-256：** `31fd6fe6d0ba1ec2901b053ed341e7d08ee5c83eeb2549e7d198b950df1edbec`

## 1. 结论

- `SELECTION_PACKS=PASS`
- `PACK_COUNT=4`
- `UNIQUE_ROOT_COUNT=23`
- `RECOMMENDED_UNION_NODE_COUNT=107`
- `SEMANTIC_CONTEXT_UNION_NODE_COUNT=133`

推荐生产路径是未来采纳候选；完整语义闭包只用于审计。上下文节点不会自动进入推荐导入面。

## 2. 主题包概览

| 主题包 | 根 | 推荐物品 | 推荐工艺 | 审计上下文节点 | 数值提案 | 暂时接受异常 | 人工复核 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `pack.r2d.civic_domestic` | 7 | 17 | 9 | 7 | 3 | 1 | 0 |
| `pack.r2d.industry_maintenance` | 4 | 32 | 16 | 16 | 3 | 1 | 0 |
| `pack.r2d.security_low_tech` | 7 | 21 | 11 | 27 | 3 | 2 | 1 |
| `pack.r2d.survival_medical` | 5 | 28 | 13 | 9 | 4 | 1 | 1 |

## 3. 公共生活、家居与权利记录（`pack.r2d.civic_domestic`）

提供公共家具、修补、装饰和两类可审计权利记录的候选路径。

### 根稳定 ID

- `item.daily.sewing_mending_kit`
- `item.decoration.carved_wooden_figure`
- `item.decoration.cloth_toy`
- `item.furniture.communal_bench`
- `item.furniture.modular_storage_shelf`
- `record.right.ration_entitlement`
- `record.right.workshop_position_qualification`

### 推荐生产路径

- 库存物品：17
- 工艺：9
- 转换：2
- 非库存定义：2
- Path SHA-256：`061de63dd974ee2250dc54bc95014e67493b02c25fb8f74f6cd4281a4f59f598`

推荐工艺：

- `recipe.c4_wood.saw_lumber`
- `recipe.c7_daily.assemble_sewing_kit`
- `recipe.c7_decoration.carve_wooden_figure`
- `recipe.c7_decoration.sew_cloth_toy`
- `recipe.c7_furniture.make_communal_bench`
- `recipe.c7_furniture.make_storage_shelf`
- `recipe.metal.form_fasteners`
- `recipe.metal.reclaim_steel_plate`
- `recipe.textile.weave_cloth`

### 校准与复核

- 数值提案：`r2c.numeric.08_fastener_batch`、`r2c.numeric.13_communal_bench_lumber`、`r2c.numeric.14_storage_shelf_lumber`
- 暂时接受异常：`r2c.accepted.01_fastener_value_premium`
- 质量人工复核：无

### 审计上下文与排除

完整语义闭包包含 37 个节点，其中 7 个只用于审计上下文。

- `item.rare.disputed_ceremonial_sword`：争议礼仪物需要独立产权、仪式和安全裁定。
- `item.weapon.bolt_rifle`：只可能因公共材料的拆解来源进入审计上下文，不属于公共生活推荐路径。
- `item.weapon.pump_shotgun`：枪械不属于家居与权利记录的推荐采纳面。

## 4. 工业维修与离线电气（`pack.r2d.industry_maintenance`）

提供机械维修、现场备件、可充电照明和有线通信的候选生产路径。

### 根稳定 ID

- `item.electronic.rechargeable_task_lantern`
- `item.electronic.wired_field_telephone`
- `item.tool.field_repair_kit`
- `item.tool.mechanic_hand_tool_set`

### 推荐生产路径

- 库存物品：32
- 工艺：16
- 转换：0
- 非库存定义：0
- Path SHA-256：`0b4c1e79c76bcbfb520e2888bdcb2849eaa6a6340f682c76768ca8758e5d0944`

推荐工艺：

- `recipe.c4_battery.assemble_module`
- `recipe.c4_glass.melt_sheet`
- `recipe.c4_nonferrous.sort_stock`
- `recipe.c4_rubber.reclaim_strip`
- `recipe.c4_wood.saw_lumber`
- `recipe.c5_component.assemble_connectors`
- `recipe.c5_component.assemble_power_regulator`
- `recipe.c5_component.assemble_protected_relay`
- `recipe.c5_electronic.assemble_field_telephone`
- `recipe.c5_electronic.assemble_task_lantern`
- `recipe.c5_tool.assemble_mechanic_set`
- `recipe.hygiene.prepare_cleaning_rags`
- `recipe.metal.assemble_field_repair_kit`
- `recipe.metal.form_fasteners`
- `recipe.metal.reclaim_steel_plate`
- `recipe.textile.weave_cloth`

### 校准与复核

- 数值提案：`r2c.numeric.04_battery_module_casing`、`r2c.numeric.08_fastener_batch`、`r2c.numeric.09_field_repair_kit_packaging`
- 暂时接受异常：`r2c.accepted.01_fastener_value_premium`
- 质量人工复核：无

### 审计上下文与排除

完整语义闭包包含 64 个节点，其中 16 个只用于审计上下文。

- `item.rare.high_density_battery_sample`：样品不等于可制造电池模块，不能替代 R2-C 电池外壳提案。
- `item.rare.offline_machine_controller`：稀有机床控制器缺少目标设施和运行时维护 Gate。
- `item.rare.offline_sensor_core`：R2-A 已裁定延后到离线诊断或预警升级 Gate。

## 5. 低技术安防与预警（`pack.r2d.security_low_tech`）

提供可制造弓弩、配套弹药、软硬防护和有线预警的候选生产路径。

### 根稳定 ID

- `item.ammunition.crossbow_bolt_bundle`
- `item.ammunition.hunting_arrow_bundle`
- `item.armor.padded_vest`
- `item.armor.reinforced_plate`
- `item.electronic.wired_alarm_unit`
- `item.weapon.hunting_bow`
- `item.weapon.light_crossbow`

### 推荐生产路径

- 库存物品：21
- 工艺：11
- 转换：0
- 非库存定义：0
- Path SHA-256：`b8097dc61c5fa7619d62f0a9770d1fcd3cca5341e07889f38cf3f76a4fdcf79d`

推荐工艺：

- `recipe.c4_wood.saw_lumber`
- `recipe.c6_ammo.make_crossbow_bolts`
- `recipe.c6_ammo.make_hunting_arrows`
- `recipe.c6_weapon.make_hunting_bow`
- `recipe.c6_weapon.make_light_crossbow`
- `recipe.electrical.assemble_wired_alarm_unit`
- `recipe.metal.assemble_reinforced_plate`
- `recipe.metal.form_fasteners`
- `recipe.metal.reclaim_steel_plate`
- `recipe.textile.sew_padded_vest`
- `recipe.textile.weave_cloth`

### 校准与复核

- 数值提案：`r2c.numeric.08_fastener_batch`、`r2c.numeric.10_wired_alarm_housing`、`r2c.numeric.15_reinforced_plate_offcuts`
- 暂时接受异常：`r2c.accepted.01_fastener_value_premium`、`r2c.accepted.02_reinforced_plate_value_premium`
- 质量人工复核：`recipe.metal.assemble_reinforced_plate`

### 审计上下文与排除

完整语义闭包包含 59 个节点，其中 27 个只用于审计上下文。

- `item.armor.ballistic_vest`：受控弹道防具没有候选制造路径，必须结合正式伤害与耐久系统。
- `item.armor.riot_shield`：防暴装备属于更高阶秩序与战斗 Gate，不纳入低技术包。
- `item.weapon.bolt_rifle`：枪械无候选制造路径，可能只作为拆解来源进入审计上下文。
- `item.weapon.pump_shotgun`：枪械运行时、弹药经济和战斗平衡尚未授权。

## 6. 生存、医疗与基础安置（`pack.r2d.survival_medical`）

提供行粮、基础伤口护理、保温衣物和可部署床位的候选生产路径。

### 根稳定 ID

- `item.clothing.insulated_coat`
- `item.food.travel_biscuit`
- `item.furniture.field_bed`
- `item.medical.field_wound_care_pack`
- `item.medical.wound_irrigation_saline`

### 推荐生产路径

- 库存物品：28
- 工艺：13
- 转换：0
- 非库存定义：0
- Path SHA-256：`7821708fc9c379c1afe564664e10524f47e9febce63570763c022cbe977c8e72`

推荐工艺：

- `recipe.agriculture.mixed_field_crop_cycle`
- `recipe.c2_assembly.field_bed`
- `recipe.c4_wood.split_firewood`
- `recipe.c5_food.mill_flour`
- `recipe.c6_food.bake_travel_biscuit`
- `recipe.c6_medical.pack_field_wound_care`
- `recipe.c6_medical.prepare_irrigation_saline`
- `recipe.c7_clothing.sew_insulated_coat`
- `recipe.chemistry.prepare_basic_antiseptic`
- `recipe.medical.sterilize_bandage`
- `recipe.metal.form_fasteners`
- `recipe.metal.reclaim_steel_plate`
- `recipe.textile.weave_cloth`

### 校准与复核

- 数值提案：`r2c.numeric.01_flour_unit_mass`、`r2c.numeric.06_sterile_bandage_unit`、`r2c.numeric.07_field_bed_frame`、`r2c.numeric.08_fastener_batch`
- 暂时接受异常：`r2c.accepted.01_fastener_value_premium`
- 质量人工复核：`recipe.c6_medical.prepare_irrigation_saline`

### 审计上下文与排除

完整语义闭包包含 50 个节点，其中 9 个只用于审计上下文。

- `item.rare.sterile_surgical_instrument_chest`：稀有外科器械没有当前候选制造路径，需要独立医疗 Gate。
- `item.weapon.bolt_rifle`：只可能作为回收钢板的替代拆解来源进入审计上下文，不属于生存包推荐路径。
- `item.weapon.pump_shotgun`：只可能作为回收材料上下文出现；枪械运行时与战斗平衡未授权。

## 7. 包间重叠

| 左包 | 右包 | 共享根 | 推荐路径共享节点 | 语义上下文共享节点 |
|---|---|---:|---:|---:|
| `pack.r2d.civic_domestic` | `pack.r2d.industry_maintenance` | 0 | 14 | 21 |
| `pack.r2d.civic_domestic` | `pack.r2d.security_low_tech` | 0 | 14 | 21 |
| `pack.r2d.civic_domestic` | `pack.r2d.survival_medical` | 0 | 12 | 19 |
| `pack.r2d.industry_maintenance` | `pack.r2d.security_low_tech` | 0 | 18 | 37 |
| `pack.r2d.industry_maintenance` | `pack.r2d.survival_medical` | 0 | 12 | 19 |
| `pack.r2d.security_low_tech` | `pack.r2d.survival_medical` | 0 | 12 | 19 |

## 8. 重建命令

    ruby scripts/build_item_library_selection_packs.rb --write
    ruby scripts/build_item_library_selection_packs.rb

## 9. 接受边界

- 四个包均为 `reference_only`；
- R1 与 R2-C 数值均未修改或采纳；
- `runtime_authorization` 仍为 `NONE`；
- 不允许整包运行时导入；
- Gate 1A、Gate 1H 与 Gate 2 状态不变；
- 不替代真人试玩。
