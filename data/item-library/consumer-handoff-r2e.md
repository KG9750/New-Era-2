# 候选物品库 R2-E 主干消费交接清单

**来源基线：** `new-era-2.item-library.r1-c7-candidate`
**来源 R2-D 报告：** `31fd6fe6d0ba1ec2901b053ed341e7d08ee5c83eeb2549e7d198b950df1edbec`
**内容状态：** `candidate_only`
**交接状态：** `reference_only`
**采纳状态：** `not_adopted`
**运行时授权：** `NONE`
**报告 SHA-256：** `06abd80d014ddbbeefb61e28464d27a6005b4b94097ee1e9ec52d613c639de6c`

## 1. 结论

- `CONSUMER_HANDOFF=PASS`
- `MANIFEST_COUNT=4`
- `UNIQUE_EXPLICIT_ID_COUNT=107`
- `RUNTIME_AUTHORIZATION=NONE`

这些 manifest 是未来主干的显式稳定 ID 评估入口，不是运行时导入包；所有采纳决定和证据槽仍为空或阻塞。

## 2. Manifest 概览

| Manifest | 根 | 显式 ID | 默认排除 | 外部来源 | 数值决定 | 人工复核 | 状态 |
|---|---:|---:|---:|---:|---:|---:|---|
| `handoff.r2e.civic_domestic` | 7 | 30 | 7 | 5 | 3 | 1 | `blocked` |
| `handoff.r2e.industry_maintenance` | 4 | 48 | 16 | 12 | 3 | 1 | `blocked` |
| `handoff.r2e.security_low_tech` | 7 | 32 | 27 | 7 | 3 | 3 | `blocked` |
| `handoff.r2e.survival_medical` | 5 | 41 | 9 | 10 | 4 | 2 | `blocked` |

## 3. 公共生活、家居与权利记录（`handoff.r2e.civic_domestic`）

- 来源包：`pack.r2d.civic_domestic`
- Manifest SHA-256：`7deab3989b60acfa4bead3a2232a3cf22063bd1f78dc21bdd92173e485847beb`
- 显式选择：30 个稳定 ID
- 默认排除：7 个审计上下文 ID
- 采纳状态：`not_adopted`
- 运行时就绪：`blocked`

根稳定 ID：

- `item.daily.sewing_mending_kit`
- `item.decoration.carved_wooden_figure`
- `item.decoration.cloth_toy`
- `item.furniture.communal_bench`
- `item.furniture.modular_storage_shelf`
- `record.right.ration_entitlement`
- `record.right.workshop_position_qualification`

待决策：

- R2-C 数值提案：3
- 暂时接受异常：1
- 质量人工复核：0
- R2-B 循环触点：1

## 4. 工业维修与离线电气（`handoff.r2e.industry_maintenance`）

- 来源包：`pack.r2d.industry_maintenance`
- Manifest SHA-256：`77fe03ac3106819f31241d8978b2bcb7bae77a3c9b9796ab9d826d3daa16583a`
- 显式选择：48 个稳定 ID
- 默认排除：16 个审计上下文 ID
- 采纳状态：`not_adopted`
- 运行时就绪：`blocked`

根稳定 ID：

- `item.electronic.rechargeable_task_lantern`
- `item.electronic.wired_field_telephone`
- `item.tool.field_repair_kit`
- `item.tool.mechanic_hand_tool_set`

待决策：

- R2-C 数值提案：3
- 暂时接受异常：1
- 质量人工复核：0
- R2-B 循环触点：2

## 5. 低技术安防与预警（`handoff.r2e.security_low_tech`）

- 来源包：`pack.r2d.security_low_tech`
- Manifest SHA-256：`85d7a1f2a2ec8aea210d56d2129b9a02fd0e359c3807f59e2e213e5f8659f212`
- 显式选择：32 个稳定 ID
- 默认排除：27 个审计上下文 ID
- 采纳状态：`not_adopted`
- 运行时就绪：`blocked`

根稳定 ID：

- `item.ammunition.crossbow_bolt_bundle`
- `item.ammunition.hunting_arrow_bundle`
- `item.armor.padded_vest`
- `item.armor.reinforced_plate`
- `item.electronic.wired_alarm_unit`
- `item.weapon.hunting_bow`
- `item.weapon.light_crossbow`

待决策：

- R2-C 数值提案：3
- 暂时接受异常：2
- 质量人工复核：1
- R2-B 循环触点：2

## 6. 生存、医疗与基础安置（`handoff.r2e.survival_medical`）

- 来源包：`pack.r2d.survival_medical`
- Manifest SHA-256：`56ba2321d2107697f07d3e48b75acea702a70a461f7eb22cff085c845a2202c3`
- 显式选择：41 个稳定 ID
- 默认排除：9 个审计上下文 ID
- 采纳状态：`not_adopted`
- 运行时就绪：`blocked`

根稳定 ID：

- `item.clothing.insulated_coat`
- `item.food.travel_biscuit`
- `item.furniture.field_bed`
- `item.medical.field_wound_care_pack`
- `item.medical.wound_irrigation_saline`

待决策：

- R2-C 数值提案：4
- 暂时接受异常：1
- 质量人工复核：1
- R2-B 循环触点：1

## 7. 消费边界

- `consumer_decisions` 全部为空；
- `adoption_state=not_adopted`；
- `runtime_readiness=blocked`；
- 不允许整包运行时导入；
- 不改变 R1、R2-C、R2-D 或 Gate；
- 不替代真人试玩。

## 8. 重建命令

    ruby scripts/build_item_library_consumer_handoff.rb --write
    ruby scripts/build_item_library_consumer_handoff.rb
