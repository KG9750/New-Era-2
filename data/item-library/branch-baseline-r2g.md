# 候选物品库 R2-G 支干冻结基线

**基线 ID：** `new-era-2.item-library.r2-reviewed-branch-baseline`
**状态：** `reference_only`
**采纳状态：** `not_adopted`
**运行时就绪：** `blocked`
**运行时授权：** `NONE`
**Manifest SHA-256：** `18eb7584621c5446e83fb65edd2c2c1af52bb46e227d3f75198ebfaba468deee`

## 1. 冻结内容

- 目录定义：220（196 个库存物品 + 24 个非库存定义）
- 工艺：90
- 转换流程：24
- 主题选择包 / 消费 manifest / 空白采纳模板：4 / 4 / 4
- 决策槽：171，全部 unresolved；真实 submitted：0

## 2. 审查链

| 阶段 | 角色 | 审查状态 | 逻辑 SHA-256 |
|---|---|---|---|
| R1 | candidate_baseline | `REVIEW_PASS` | `02918459ef17e42ed5e2151660873f6a4e88e12dff29730a013f1d062fe554ad` |
| R2A | semantic_audit | `R2A_REVIEW_PASS` | `dad942c1e12f274abc2691c5f2d6a2b615ab76c6224e98afb8146ac513f9eeee` |
| R2B | flow_audit | `R2B_REVIEW_PASS` | `b11ac7a39e9839f33bffe5375e7d9f5c3e827c89e70de0743f26defa45939f3d` |
| R2C | calibration_proposals | `R2C_REVIEW_PASS` | `2df2685395614af967a57feaebdb99ba3cf5b8f50ed17f0574abd999f980384f` |
| R2D | selection_packs | `R2D_REVIEW_PASS` | `31fd6fe6d0ba1ec2901b053ed341e7d08ee5c83eeb2549e7d198b950df1edbec` |
| R2E | consumer_handoff | `R2E_REVIEW_PASS` | `4ad843af92c46409189f93258c6ca0eb319f19e97d2dc32b6361c099d50e3e3d` |
| R2F | adoption_record_templates | `R2F_REVIEW_PASS` | `2a0eaafcac2d400d864f1f541fe2c1c3ba814c00599d3fe7e37d0143b05c42f3` |

## 3. 来源完整性

- R1 嵌套来源文件：32
- 支干冻结来源文件：41
- R1 Bundle 文件 SHA-256：`32f9d9c41e7271e4da0f037167ad94023d050ee1b7471fdec98495393d9ff361`
- R1 Payload SHA-256：`02918459ef17e42ed5e2151660873f6a4e88e12dff29730a013f1d062fe554ad`

## 4. 验证

```bash
ruby scripts/build_item_library_branch_baseline.rb --write
ruby scripts/build_item_library_branch_baseline.rb
```

## 5. 边界

本基线只提供 `reference_only` 支干交接入口。它不代表主干采纳、运行时 schema、Gate 授权、真人试玩或合并完成。
