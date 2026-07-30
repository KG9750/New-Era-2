# 候选物品库 R2-C 审查状态

**日期：** 2026-07-30
**范围：** 90 张工艺的单位质量画像、R2-B 七项候选价值异常、内存 overlay、逐字段数值提案与影响范围
**实现验证：** `PASS`
**独立 subagent 首审：** `REVIEW_FAIL`（`P0=0 / P1=0 / P2=2`）
**独立 subagent 第二轮：** `REVIEW_PASS`（`P0=0 / P1=0 / P2=0`）
**最终状态：** `R2C_REVIEW_PASS`
**运行时授权：** `NONE`

## 1. 当前结论

R2-C 已生成确定性的单位与候选价值校准提案。独立 subagent 首审发现两项 P2，均已按最小范围修正；第二轮在提交 `4ed5d48e22d6c2f154dca3ffed88bb310bf2a2c9` 上完成只读复审，结论为 `P0=0 / P1=0 / P2=0 / REVIEW_PASS`。

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

## 4. 首审发现与修正

1. `P2`：分类曾使用已舍入到六位小数的比值，可能漏报极靠近严格阈值的越界。现保留未舍入内部比值用于分类，只在序列化报告时舍入，并内建五个近边界回归断言。
2. `P2`：`from` 前置条件曾允许小于 `1e-7` 的漂移。现改为精确数值相等，不再使用 epsilon 容差。

第二轮使用新的完整复制夹具确认：

- `1.2500004`、`1.0500004`、质量比 `0.2499996`、价值比 `4.0000004` 和 `0.2499996` 均按未舍入值正确分类；
- 报告显示仍稳定舍入到六位；
- 精确 `from=10.0` 可以重建，`from=10.00000005` 会以 `from 漂移` 失败；
- 15 个提案、90 个画像、2 个暂时接受异常和全部影响列表可独立复算；
- JSON、Markdown、来源哈希、Overlay SHA-256 与报告 SHA-256 均可独立复算；
- C1–C7、R2-A、R2-B、R2-C 全部回归通过。

## 5. 最终结论

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

`R2C_REVIEW_PASS` 只表示校准提案满足当前合同并可确定性复算，不表示 R1 已修改、正式数值已冻结、运行时已授权、Gate 已解锁或真人试玩已完成。
