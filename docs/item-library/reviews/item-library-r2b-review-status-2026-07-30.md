# 候选物品库 R2-B 复审状态

**日期：** 2026-07-30
**范围：** 制造来源与去向、转化循环、拆解/维修回收、候选价值异常、共享瓶颈与产能集中度
**实现验证：** `PASS`
**独立 subagent 首审：** `REVIEW_FAIL`（`P0=0 / P1=2 / P2=1`）
**独立 subagent 第二轮：** `REVIEW_FAIL`（`P0=0 / P1=1 / P2=0`）
**独立 subagent 第三轮：** `REVIEW_PASS`（`P0=0 / P1=0 / P2=0`）
**最终状态：** `R2B_REVIEW_PASS`
**运行时授权：** 无

## 1. 当前结论

R2-B 首轮独立 subagent 审查发现两项 P1 和一项 P2。第二轮确认首审三项均已修正，但补测又发现多输入槽共享同一替代物时的部分替代组合可绕过自增殖检查，因此仍为 `REVIEW_FAIL`。该项也已按最小范围修正。

第三轮在远端干净快照 `95e8683fd99f714b3c05ec18386d3d6cea350409`、Tree `60acafb7022b1eb2139f721ae72c4d035d18373e` 上完成独立只读复审，结论为 `P0=0 / P1=0 / P2=0 / REVIEW_PASS`。审查仓库始终保持只读，所有变异测试只在独立复制夹具中执行，也未调用 Claude 或 `claude-code-review`。

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
- 90 张工艺均满足 AND 输入槽与目标实例可达条件；
- 不可达工艺为 0；
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

## 4. 首审发现与修正

1. `P1`：多输入工艺的可达性曾按二元边传播，错误地把 AND 前置条件降为 OR。现改为 recipe-aware 超边闭包：每个必需输入位都要由主输入或其替代项之一满足，目标实例也必须可达，工艺才可执行。
2. `P1`：直接自增殖曾只比较同物品最大单条返还。现按物品累计全部主产出和库存副产物最大返还量，并与累计直接消耗量及替代场景消耗量比较。
3. `P2`：曾只核对 Payload，未核对 Bundle 与 R2-A 的基线身份。现要求两者共同指向 `new-era-2.item-library.r1-c7-candidate`。
4. 第二轮 `P1`：同一替代物可用于多个输入槽时，曾只检查所有相关槽同时选择该替代物的聚合消耗。现按输入槽计算每种物品在任一合法组合中的最小正消耗量，覆盖单槽、部分槽与全部槽替代场景。

## 5. 循环与回收

识别到两个制作—拆解强连通分量：

1. 任务灯、线束、回收电子件与铜线；
2. 野战床、紧固件、回收钢板与织物。

两者均具有正人物时间，且最大拆解候选回收比分别为 `0.423913` 和 `0.222143`，保持有损边界。六张拆解工艺均低于无损阈值，六张维修工艺均低于高材料比警告阈值。

## 6. 复审结论

第三轮独立 subagent 已只读审查以下文件与生成关系：

- `scripts/audit_item_library_flows.rb`
- `docs/item-library/item-library-flow-audit-contract-v0.1.md`
- `data/item-library/flow-audit-r2b.json`
- `data/item-library/flow-audit-r2b.md`

复审覆盖 AND 超边可达性、重复返还累计、部分替代组合自增殖、非消耗槽、基线身份、终端去向、循环检测、拆解损耗、候选价值阈值、共享瓶颈统计、确定性哈希和候选边界。首审及第二轮的真实发现均已修正，没有新增真实缺陷：

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

`R2B_REVIEW_PASS` 只表示候选制造流、循环和候选价值筛查满足当前合同，不构成运行时、正式价格或产能、Gate 2、人工试玩或整包导入授权。
