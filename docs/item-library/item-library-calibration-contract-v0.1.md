# 候选物品库 R2-C 单位与候选价值校准提案合同 V0.1

**项目：** Project-004-New Era 2
**上游基线：** `new-era-2.item-library.r1-c7-candidate`
**上游审计：** `R2A_REVIEW_PASS`、`R2B_REVIEW_PASS`
**内容状态：** `candidate_only`
**运行时授权：** `NONE`
**提案模式：** `proposal_only`

## 1. 目的

R2-C 对全部 90 张候选工艺建立单位质量与候选价值画像，并为明显异常生成可复算的校准提案。它回答：

1. 已消耗库存输入与库存产出的候选质量是否存在明显放大；
2. R2-B 的七个候选价值异常分别应如何修数值，或为何暂时接受残余异常；
3. 每项数值提案会影响哪些物品、工艺和下游消费者；
4. 把全部数值提案应用到内存 overlay 后，异常是否收敛。

R2-C 不修改 R1 Bundle、分片 YAML、稳定 ID 或正式运行时数据。

## 2. 权威输入与生成物

权威输入：

- `data/item-library/item-library-r1-candidate-bundle.json`
- `data/item-library/semantic-audit-r2a.json`
- `data/item-library/flow-audit-r2b.json`
- 本合同

工具与确定性生成物：

- `scripts/propose_item_library_calibration.rb`
- `data/item-library/calibration-proposals-r2c.json`
- `data/item-library/calibration-proposals-r2c.md`

JSON 与 Markdown 必须由工具生成，不得手工修改。

## 3. 质量画像口径

### 3.1 输入质量

- 普通工艺与维修：所有 `consumed=true` 直接输入的 `amount × item.mass` 之和；
- 拆解：被永久消耗目标的 `item.mass`；
- `consumed=false` 输入不计入；
- 替代输入组合不在本轮自动提案中展开，画像使用工艺声明的主输入路径；
- 抽象负担不具有库存质量，不计入库存输出。

### 3.2 输出质量

库存输出质量为主产出与具有 `item` 的副产物之和：

```text
最小库存输出质量 = Σ(min × item.mass)
最大库存输出质量 = Σ(max × item.mass)
最大质量返回比 = 最大库存输出质量 / 已消耗库存输入质量
```

维修不创造新目标实例，因此不计算质量返回比。

该口径只筛查库存单位是否自洽。燃料燃烧、蒸发、切削、废弃、包装、含水率与未建模负担会使低质量比合理，因此低比值不得自动判错。

## 4. 质量筛查分级

| 最大质量返回比 | 分级 | 处理 |
|---:|---|---|
| `> 1.25` | `severe_amplification` | 必须有显式 `numeric_patch_proposal` |
| `> 1.05` 且 `<= 1.25` | `review_band` | 进入容器、含水率、装配外壳或回收区间人工复核队列 |
| `< 0.25` | `low_ratio_report_only` | 只报告，不自动判错 |
| 其他 | `within_screen` | 本轮不处理 |

阈值不是现实物理定律；它们用于把明显单位错误与合理损耗、容器误差分开。

阈值判定必须使用未舍入的内部比值；六位小数舍入只用于报告显示。生成器必须内建 `1.2500004`、`1.0500004`、`0.2499996`、`4.0000004` 和价值比 `0.2499996` 五个严格边界回归断言。

## 5. 候选价值口径

普通工艺沿用 R2-B 口径：

```text
最大候选产出值
  = 主产出最大数量 × base_value
  + 库存副产物最大数量 × base_value

最大候选价值返回比
  = 最大候选产出值 / 已消耗直接输入候选值
```

`< 0.25` 或 `> 4.00` 仍视为候选价值异常。R2-C 必须覆盖 R2-B 报告中的全部七项异常。

人物时间、技能、设施折旧、品质、安全用途、法律风险与市场稀缺仍未折价。数值修正后仍超阈值的项目，可以使用 `accepted_outlier` 暂时保留，但必须：

- 写明可审计理由；
- 标记为 `provisional`；
- 保留“选择进入运行时前重新校准”的要求；
- 不把接受异常解释为正式价格或利润冻结。

## 6. 提案与 overlay

机器报告中的每项 `numeric_patch_proposal` 必须包含：

- 稳定提案 ID 和目标工艺；
- 触发维度与触发值；
- 逐字段操作，以及修改前、修改后值；
- 目标工艺修改前后的质量比与候选价值比；
- 直接受影响物品、工艺与下游消费工艺；
- 修改后仍存在的筛查标记；
- 采用边界。

工具只能把提案应用于内存中的 R1 深拷贝，生成 `proposed_overlay` 画像。它不得：

- 写回 Bundle；
- 写回 C1–C7 YAML；
-改变 `baseline_id`、`payload_sha256`、状态或授权；
- 生成可直接导入运行时的补丁文件。

每个操作必须以精确数值相等校验 `from` 值与冻结基线一致。任何漂移都必须令生成失败，不能用 epsilon 容差静默套用。

## 7. 完整性与确定性

R2-C 通过条件：

- Bundle 的规范化 Payload SHA-256、数量、状态和拒绝默认导入策略可独立复核；
- R2-A、R2-B 与当前 Bundle 的基线、Payload、状态、授权和各自审计 SHA-256 一致；
- 90 张工艺全部具有基线与 overlay 画像；
- 所有 `severe_amplification` 都有数值提案；
- R2-B 七个价值异常都有数值提案或暂时接受的残余异常裁定；
- overlay 中不存在未裁定的严重质量放大；
- overlay 中不存在未裁定的候选价值异常；
- JSON、Markdown 可逐字重建；
- R1 Bundle 文件 SHA-256 与 Payload SHA-256 在生成前后保持不变；
- `status=candidate_only`、`runtime_authorization=NONE`。

## 8. 使用方式

生成或刷新：

```bash
ruby scripts/propose_item_library_calibration.rb --write
```

日常只读验证：

```bash
ruby scripts/propose_item_library_calibration.rb
```

## 9. 接受边界

- R2-C 产物是校准提案层，不是 R1 修订版；
- 任何未来采纳必须按稳定 ID 选择，并重新走运行时 schema、测试与 Gate 授权；
- 不允许整包运行时导入；
- 不合并主干，不改变 Gate 1A、Gate 1H 或 Gate 2；
- `R2C_REVIEW_PASS` 也只表示提案可审计，不表示正式平衡、玩家测试或运行时通过。
