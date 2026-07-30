# 候选物品库 R2-B 复审状态

**日期：** 2026-07-30  
**范围：** 制造来源与去向、转化循环、拆解/维修回收、候选价值异常、共享瓶颈与产能集中度  
**实现验证：** `PASS`  
**独立 subagent 审查：** `PENDING`  
**最终状态：** `R2B_REVIEW_PENDING`  
**运行时授权：** 无

## 1. 当前结论

R2-B 工具、机器报告和人工摘要已经完成本地实现与回归，但在独立 subagent 给出 `P0=0 / P1=0 / REVIEW_PASS` 前不能宣称 R2-B 通过。

当前实现没有修改 R1 物品、工艺、转换、产量、耗时或 `base_value`。全部内容继续保持 `candidate_only`、`runtime_authorization=NONE`，不允许整包导入，也不改变 Gate。

## 2. 本地实现结果

```text
FLOW_AUDIT=PASS
ERROR_COUNT=0
WARNING_COUNT=7
EXTERNAL_SOURCE_ITEM_COUNT=108
TERMINAL_OUTPUT_ITEM_COUNT=56
TRANSFORMATION_CYCLE_COUNT=2
SHARED_BOTTLENECK_COUNT=33
VALUE_RATIO_OUTLIER_COUNT=7
RUNTIME_AUTHORIZATION=NONE
```

来源与终端审计同时确认：

- 191 个物品具有非制造获得起点；
- 196 个库存物品均可从这些起点沿转化图抵达；
- 不可达已消耗输入为 0；
- 断裂来源为 0；
- 缺少终端去向为 0。

## 3. 已识别校准警告

七张普通工艺的最大候选价值返回比低于 `0.25` 或高于 `4.00`：

- `recipe.c4_wood.compress_briquette`
- `recipe.c7_furniture.make_communal_bench`
- `recipe.c7_furniture.make_storage_shelf`
- `recipe.c7_furniture.make_workshop_stool`
- `recipe.medical.sterilize_bandage`
- `recipe.metal.assemble_reinforced_plate`
- `recipe.metal.form_fasteners`

统一裁定为 `calibrate_before_runtime_selection`。这表示未来按稳定 ID 选择相关内容进入运行时前，必须复核单位、数量和候选价值；不在 R2-B 中擅自修改 R1 冻结数据。

## 4. 循环与回收

识别到两个制作—拆解强连通分量：

1. 任务灯、线束、回收电子件与铜线；
2. 野战床、紧固件、回收钢板与织物。

两者均具有正人物时间，且最大拆解候选回收比分别为 `0.423913` 和 `0.222143`，保持有损边界。六张拆解工艺均低于无损阈值，六张维修工艺均低于高材料比警告阈值。

## 5. 解除阻塞条件

独立 subagent 必须只读审查以下文件与生成关系：

- `scripts/audit_item_library_flows.rb`
- `docs/item-library/item-library-flow-audit-contract-v0.1.md`
- `data/item-library/flow-audit-r2b.json`
- `data/item-library/flow-audit-r2b.md`

审查至少覆盖来源可达性、终端去向、循环检测、拆解损耗、直接自增殖、候选价值阈值、共享瓶颈统计、确定性哈希和候选边界。只有 `P0=0 / P1=0` 且所有真实发现修正后，才能转为 `R2B_REVIEW_PASS`。
