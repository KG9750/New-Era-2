# 候选物品库 R2-A 语义审计与依赖闭包报告

**来源基线：** `new-era-2.item-library.r1-c7-candidate`
**来源 Payload SHA-256：** `02918459ef17e42ed5e2151660873f6a4e88e12dff29730a013f1d062fe554ad`
**审计合同 SHA-256：** `93988442c174de210b133a67efc5b1c9ea3db9965dcfc00df3031a35b10de08e`
**审计工具 SHA-256：** `7b8367177b6e9b7080a01f990d46d81eebf7dc6f64abbae1d6847bb69277bf68`
**状态：** `candidate_only`
**运行时授权：** `NONE`
**审计 SHA-256：** `2116338a6900b303e7bae2d6f9c73ce65fe6de14eac57bd8f2332f3f5d2ce433`

## 1. 结论

- `SEMANTIC_AUDIT=PASS`
- `ERROR_COUNT=0`
- `WARNING_COUNT=2`
- `CATALOG_DEFINITION_COUNT=220`
- `RECIPE_COUNT=90`
- `TRANSITION_COUNT=24`

本报告验证候选内容语义与引用闭包，不构成运行时、正式数值、UI、存档迁移、Gate 或玩家测试授权。

## 2. 库存物品逐项分类

| 分类 | 数量 | 说明 |
|---|---:|---|
| `structured_linked` | 141 | 至少连接工艺、转换、成长、照护或权利记录 |
| `direct_use_only` | 54 | 无结构化边，但具有明确直接动作 |
| `narrative_candidate` | 1 | 只有保管、流通或观察动作，等待后续玩法结构 |

机器可读 JSON 的 `inventory_items` 为全部 196 个库存物品保存逐项分类、动作、获得/损耗路径数量、结构化边和下游使用情境。

## 3. 依赖图

- 节点：334
- 边：476
- 连通分量：68
- 最大连通分量：245

| 边类型 | 数量 |
|---|---:|
| `ammo_compatibility` | 9 |
| `definition_profile_input` | 39 |
| `definition_profile_output` | 8 |
| `recipe_byproduct` | 32 |
| `recipe_input` | 216 |
| `recipe_output` | 96 |
| `recipe_substitute_input` | 1 |
| `recipe_target` | 12 |
| `transition_additional_input` | 23 |
| `transition_source` | 16 |
| `transition_target` | 24 |

装备兼容审计覆盖 12 个武器平台和 11 个弹药或信号耗材。所有需要弹药的平台均有候选供给；未绑定平台的耗材进入警告清单。

## 4. 直接用途候选

以下物品没有结构化工艺或转换边，但具有治疗、阅读、穿戴、展示、认证等明确直接动作，因此不视为孤儿：

- `item.ammunition.smoke_marker_canister_batch`：activate
- `item.ammunition.training_blank_batch`：fire
- `item.armor.ballistic_vest`：equip、maintain、wear
- `item.armor.forearm_guard_pair`：clean、maintain、wear
- `item.armor.knee_pad_pair`：clean、maintain、wear
- `item.armor.metal_helmet`：equip、maintain、wear
- `item.armor.riot_shield`：equip、maintain
- `item.book.agricultural_manual`：read
- `item.book.electrical_safety_handbook`：read
- `item.book.field_medicine_manual`：read
- `item.book.food_preservation_manual`：read
- `item.book.machine_maintenance_ledger`：read
- `item.clothing.chemical_apron`：clean、maintain、wear
- `item.clothing.cold_weather_cap`：clean、maintain、wear
- `item.clothing.firefighter_coat`：clean、maintain、wear
- `item.clothing.leather_jacket`：clean、maintain、wear
- `item.clothing.medical_isolation_gown`：disinfect、maintain、wear
- `item.clothing.respirator_mask`：clean、maintain、wear
- `item.clothing.sun_hat`：clean、maintain、wear
- `item.component.food_grade_seal_set`：install、repair
- `item.component.medical_instrument_spares`：disinfect、repair
- `item.daily.mess_tin_set`：clean、consume、maintain
- `item.daily.personal_hygiene_pack`：clean、consume
- `item.daily.stationery_pack`：audit、read
- `item.decoration.memorial_photo_frame`：display、install
- `item.document.armory_issue_logbook`：audit、authenticate、present、read
- `item.document.emergency_medical_supply_ledger`：audit、authenticate、present、read
- `item.electronic.analog_weather_station`：maintain、measure
- `item.electronic.offline_inventory_terminal`：maintain、operate
- `item.electronic.portable_multimeter`：maintain、measure
- `item.furniture.washstand_cabinet`：clean、install、maintain、uninstall
- `item.instrument.hand_drum`：maintain、play、present
- `item.instrument.harmonica`：maintain、play
- `item.medical.antibiotic_course`：treat
- `item.medical.fever_relief_course`：treat
- `item.medical.hemostatic_dressing`：treat
- `item.medical.pain_relief_tablet_batch`：treat
- `item.rare.disputed_ceremonial_sword`：display、equip、maintain、present
- `item.rare.high_density_battery_sample`：charge、discharge
- `item.rare.offline_machine_controller`：install、maintain
- `item.rare.prewar_optical_rangefinder`：maintain、measure
- `item.rare.readonly_violation_archive`：authenticate、present、read
- `item.rare.sterile_surgical_instrument_chest`：maintain、treat
- `item.seed.edible_mushroom_spawn`：sow
- `item.seed.orchard_cutting_bundle`：sow
- `item.tool.field_medical_instrument_kit`：disinfect、maintain、treat
- `item.tool.food_preservation_kit`：clean、cook、maintain
- `item.tool.manual_transfer_pump`：maintain、pump
- `item.tool.precision_soldering_kit`：maintain、repair
- `item.valuable.copper_pendant`：display、present、wear
- `item.valuable.engraved_brooch`：authenticate、display、present、wear
- `item.valuable.family_ring`：wear
- `item.valuable.silver_trade_token`：authenticate
- `item.weapon.utility_machete`：dismantle、equip、maintain、repair

## 5. 警告与裁定

- `ammo_family_without_platform` / `item.ammunition.training_blank_batch`：弹药族 blank 没有候选武器平台；裁定 `bind_platform_on_selection`——当前 ammo_family=blank 没有对应平台；未来选择时必须绑定兼容平台并细化口径，或拒绝导入。
- `narrative_candidate` / `item.rare.offline_sensor_core`：只有保管、流通或观察动作，且没有结构化关系；裁定 `defer_until_relevant_gate`——条目只保留未来离线诊断或预警升级潜力；当前添加结构化入口会越过对应玩法与运行时授权。

警告不改变候选状态。进入相关玩法 Gate 前，必须把叙事候选转换为明确互动、研究、开启、照护或权利规则，或明确拒绝导入。

## 6. 重建命令

```bash
ruby scripts/audit_item_library_semantics.rb --write
ruby scripts/audit_item_library_semantics.rb
ruby scripts/audit_item_library_semantics.rb --select item.agriculture.compound_fertilizer,item.furniture.field_bed
```

## 7. 接受边界

- 全部内容仍为 `candidate_only`；
- `runtime_authorization` 仍为 `NONE`；
- 不允许整包运行时导入；
- Gate 1A、Gate 1H 与 Gate 2 状态不因本报告改变。
