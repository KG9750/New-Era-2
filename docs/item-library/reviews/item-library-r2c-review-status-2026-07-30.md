# 候选物品库 R2-C 审查状态

**日期：** 2026-07-30
**范围：** 90 张工艺的单位质量画像、R2-B 七项候选价值异常、内存 overlay、逐字段数值提案与影响范围
**实现验证：** `PASS`
**独立 subagent 审查：** `PENDING`
**当前状态：** `R2C_REVIEW_PENDING`
**运行时授权：** `NONE`

## 1. 当前结论

R2-C 已生成确定性的单位与候选价值校准提案，但独立审查尚未完成，因此不得标记为 `R2C_REVIEW_PASS`。

所有候选修正只应用于脚本内存中的 R1 深拷贝。R1 Bundle、C1–C7 YAML、稳定 ID、正式运行时数据和 Gate 状态均未修改。

## 2. 本地实现结果

```text
CALIBRATION_PROPOSALS=PASS
RECIPES_PROFILED=90
BASELINE_SEVERE_MASS_COUNT=11
BASELINE_MASS_REVIEW_COUNT=7
BASELINE_VALUE_OUTLIER_COUNT=7
NUMERIC_PATCH_PROPOSAL_COUNT=15
ACCEPTED_OUTLIER_COUNT=2
OVERLAY_UNADJUDICATED_SEVERE_MASS_COUNT=0
OVERLAY_UNADJUDICATED_VALUE_OUTLIER_COUNT=0
RUNTIME_AUTHORIZATION=NONE
```

R1 身份保持：

```text
baseline_id=new-era-2.item-library.r1-c7-candidate
payload_sha256=02918459ef17e42ed5e2151660873f6a4e88e12dff29730a013f1d062fe554ad
bundle_file_sha256=32f9d9c41e7271e4da0f037167ad94023d050ee1b7471fdec98495393d9ff361
```

## 3. 提案覆盖

- 11 张最大质量返回比 `> 1.25` 的工艺均具有显式数值提案；
- 7 张最大质量返回比位于 `1.05–1.25` 的工艺保留在人工复核队列；
- 34 张低质量比工艺只报告，不自动判错；
- R2-B 的 7 个候选价值异常全部具有数值提案；
- 紧固件与粗制防护插板在质量修正后仍高于价值筛查上限，暂时以 `accepted_outlier / provisional` 裁定，并保留进入运行时前重新校准要求；
- overlay 中没有未裁定的严重质量放大或候选价值异常。

## 4. 审查要求

独立 subagent 必须只读检查：

- `docs/item-library/item-library-calibration-contract-v0.1.md`
- `scripts/propose_item_library_calibration.rb`
- `data/item-library/calibration-proposals-r2c.json`
- `data/item-library/calibration-proposals-r2c.md`
- 本状态文档

审查至少覆盖：

1. 质量与候选价值公式；
2. 90 张工艺覆盖和 R2-B 七项异常身份；
3. 每个 `from` 值及新增输入不存在条件；
4. overlay 隔离与 R1 哈希不变；
5. 修改前后比值、影响工艺和下游消费者；
6. 残余异常裁定是否掩盖真实单位错误；
7. JSON、Markdown、overlay SHA-256 与报告 SHA-256 的确定性；
8. `candidate_only / runtime_authorization=NONE / proposal_only` 边界。

任何 P0、P1 或真实 P2 finding 都必须逐项修正、回归并复审。只有 `P0=0 / P1=0 / P2=0` 后，才可把当前状态更新为 `R2C_REVIEW_PASS`。
