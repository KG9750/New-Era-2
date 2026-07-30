# 候选物品库编写合同 V0.1

**项目：** Project-004-New Era 2
**适用范围：** 候选物品与代表工艺的数据编写、静态校验和内容审查
**状态：** C1 编写合同
**上位设计：** `../design-docs/item-and-manufacturing-system-v0.1.md`
**上位设计核验 SHA-256：** `24f0d4f69322c78f6d52fd1504afa8ffbfe953b4557513bd3a3a77393af583eb`
**运行时授权：** 无

---

## 1. 目的与边界

本合同把冻结的《物品与制造系统设计 V0.1》转化为可持续扩写、可机器校验的候选内容格式。它只回答“候选内容如何写得一致”，不回答“哪些内容已经获准进入游戏”。

本轮固定边界：

- R1 上位设计只引用，不修改；
- 首批只编写 30 项种子物品与 15 个代表工艺；
- 种子内容优先形成农业与食品、金属回收与维修/防护、纺织与医疗/服饰、基础化学与卫生/医疗、电气与通信五条交叉链；
- 不要求 18 个一级分类在首批平均覆盖；
- 所有条目必须标记为 `candidate_only`；
- 不生成运行时 Def、资源文件、界面或数值平衡承诺；
- 不把静态校验或文档审查结果当作 Gate、运行时或真人测试证据。

约 220 项是完整候选库的规划检查目标，不是本轮完成定义，也不是运行时内容承诺。

---

## 2. 权威文件

| 文件 | 职责 |
|---|---|
| `data/item-library/controlled-vocabulary.yaml` | 唯一允许的枚举值、标签、设施、工具与风险标识 |
| `data/item-library/items.seed.yaml` | 首批候选物品定义 |
| `data/item-library/recipes.seed.yaml` | 独立于物品定义的代表工艺 |
| `scripts/validate_item_library.rb` | 结构、词表、引用与覆盖校验 |
| `data/item-library/coverage-report.md` | 由校验器根据当前数据生成的覆盖快照 |

显示名称可以修改，稳定 ID 一旦被引用就不得复用给另一概念。

---

## 3. 三轴合同

每项物品必须同时声明：

1. `category`：玩家如何理解和筛选它；
2. `form`：它在库存、地图或角色层以何种形态存在；
3. `tags`：它可参与哪些用途、风险、技术、物流或社会判断。

一级分类不等于程序类型。武器、家具、药品和材料可以共享同一种库存形态；同一件电子设备也可以同时带有通信、维修、受控和可追踪标签。

`resource_chains` 独立表达物品可能服务的四条主链：

- `survival`
- `industry`
- `security`
- `politics`

映射表示潜在用途，不允许同一库存被多条链重复计数。

---

## 4. 物品必需字段

每个 `items` 元素必须包含：

| 字段 | 合同 |
|---|---|
| `id` | `item.<domain>.<name>` 格式的稳定唯一 ID |
| `name` | 中文玩家可见名称 |
| `description` | 同时说明用途与主要限制，不能只写外观 |
| `status` | 本阶段固定为 `candidate_only` |
| `category` | 受控一级分类 |
| `form` | 受控存在形态 |
| `tags` | 至少一个受控标签 |
| `resource_chains` | 至少一条受控资源主链 |
| `availability` | 受控可获得性 |
| `legal_profile` | 受控合法性 |
| `exposure_profile` | `visibility`、`traceability`、`wealth_signal` 三项暴露特征 |
| `actions` | 至少一个受控行为 |
| `acquisition_paths` | 至少一种获得路径，每项含 `type` 与具体 `note` |
| `consumption_loss_paths` | 至少一种使用、消耗或流失路径 |
| `logistics_note` | 说明搬运、容器、位置或交接的决策要点 |
| `interfaces` | 与工艺的双向引用 |
| `decision_role` | 说明它在现有内容中承担的独特取舍 |

`description`、路径说明、物流说明和 `decision_role` 不得使用空字符串或“待定”占位。

### 4.1 可库存与可运输对象

首批使用的 `bulk_material` 与 `independent_item` 还必须包含：

| 字段 | 合同 |
|---|---|
| `unit` | 受控的玩家可理解计量单位 |
| `mass` | 每单位千克，正数 |
| `volume` | 每单位升，正数 |
| `stack_rule` | `stackable` 布尔值与阻止合并的 `merge_keys` |
| `storage_rule` | 至少一项受控仓储条件 |
| `base_value` | 非负相对价值点，仅用于候选内容比较 |

`bulk_material` 必须可堆叠；`independent_item` 不得堆叠。相对价值点不是最终货币、售价或经济平衡结论。

其他形态进入候选库时，必须在合同升级中为其增加专用校验，不得伪造无意义的重量、堆叠或仓储值。

### 4.2 获得与流失

`acquisition_paths` 描述内容如何进入聚落控制，例如回收、种植、生产、贸易或任务交付。

`consumption_loss_paths` 描述内容如何离开可用库存，例如被工艺消耗、直接使用、安装、损坏、腐坏、交付或被查扣。

每项路径都必须使用受控 `type`，并用 `note` 说明本物品的具体条件。只有“交易”而没有条件的条目不合格。

跨字段语义必须一致：

- `salvage_only` 表示所有获得路径都只能是 `salvage`；只要允许贸易或其他路径就不得使用；
- `exposure_profile.traceability` 为 `regulated_batch` 或 `networked` 时必须带 `traceable`，其他追踪等级不得带该标签；
- `exposure_profile.wealth_signal` 为 `high` 时必须带 `high_wealth_exposure`，其他等级不得带该标签。

结构化的 `exposure_profile` 是暴露强度的权威值；对应标签用于筛选和 AI 查询，必须由校验器保证同步。

### 4.3 工艺接口

`interfaces` 固定包含四个数组：

```yaml
interfaces:
  produced_by: []
  used_by: []
  repair_recipes: []
  dismantle_recipes: []
```

- `produced_by`：把该物品列为主产出或库存型副产物的工艺；
- `used_by`：把该物品列为输入的工艺；
- `repair_recipes`：以该物品为维修对象的工艺；
- `dismantle_recipes`：以该物品为拆解对象的工艺。

本轮没有维修与拆解工艺时也必须保留空数组，避免把漏填误认为“不适用”。校验器会核对输入与产出的双向引用。

---

## 5. 代表工艺必需字段

每个 `recipes` 元素必须包含：

| 字段 | 合同 |
|---|---|
| `id` | `recipe.<domain>.<name>` 格式的稳定唯一 ID |
| `name` | 中文玩家可见名称 |
| `description` | 说明工艺目的与主要限制 |
| `status` | 本阶段固定为 `candidate_only` |
| `kind` | 受控工艺类型 |
| `resource_chains` | 本工艺实际服务的主链 |
| `inputs` | 精确物品 ID、正数数量与是否消耗 |
| `substitution_policy` | 明确允许与否；允许时列出受控替代规则 |
| `facilities` | 至少一个受控设施能力 |
| `tools` | 至少一个受控工具能力 |
| `qualification` | 最低岗位、广义技能、专业经验与缺资格后果 |
| `effective_time_hours` | 正数最小值与最大值 |
| `logistics` | 输入集结和产出入库要求 |
| `outputs` | 物品 ID、正数最小与最大产量 |
| `byproducts` | 库存物品或抽象处理负担；可以为空数组 |
| `risks` | 至少一个受控风险、触发条件与可解释后果 |

工艺数据独立于物品定义，不能把制造时间、资格或产量藏进物品条目。

### 5.1 输入与替代

`inputs` 默认使用精确物品。替代规则必须显式写成：

```yaml
substitution_policy:
  allowed: true
  rules:
    - input: item.example.primary
      alternatives:
        - item.example.alternative
      consequence: quality_cap_reduced
      note: 替代的可见后果
```

若不允许替代，使用：

```yaml
substitution_policy:
  allowed: false
  rules: []
```

不允许以自由文本“类似材料均可”绕过词表和引用校验。

### 5.2 人物时间与资格

`qualification` 必须声明：

- `minimum_role`：最低可执行岗位；
- `skill`：所用广义技能；
- `specialty`：可提高品质上限的专业经验，没有时使用 `none`；
- `missing_effect`：缺少最低资格时是禁止、降低品质上限还是扩大失败风险。

`effective_time_hours` 是人物有效时间区间，不是设施经过时间。它必须能进入周计划与产能推演。

### 5.3 设施、工具与物流

设施和工具使用“能力 ID”，不是假定已经存在的运行时建筑或物品 ID。例如 `facility.basic_workshop` 只表示该工艺需要基础工坊能力。

`logistics` 至少包含：

- `input_staging`：原料在开工前如何集结；
- `output_storage`：产出需要送往何种库存或地点。

物流说明不能用“自动完成”替代路径条件。

### 5.4 产出、副产物与风险

主产出使用区间：

```yaml
outputs:
  - item: item.example.output
    min: 1
    max: 2
```

库存型副产物使用 `type: item` 并引用候选物品；污水、烟尘、污染等不值得逐件入库的负担使用 `type: burden` 与受控 `burden` ID。

风险不采用与已知条件无关的随机灾难。每项风险必须说明：

- 受控 `id`；
- 玩家可知的 `condition`；
- 可解释的 `effect`。

---

## 6. 首批种子内容策略

30 项种子内容不是按分类平均撒点，而是检查五条链能否交叉：

1. 农业投入能否转化为食品并进入保存食品；
2. 回收金属能否在维修、工具和基础防护之间形成竞争；
3. 织物能否在服饰、清洁、医疗和防护之间形成竞争；
4. 酒精、盐、碱和植物油能否连接卫生、医疗与食品保存；
5. 铜线和回收电子件能否连接工业维修与安全预警。

允许部分上游物品只能通过回收、贸易或任务获得。首批不以“所有物品都能制造”为目标，而以“所有引用闭合、每项有进入和离开路径”为目标。

---

## 7. 校验门禁

候选库必须通过：

首次生成或刷新覆盖报告：

```bash
ruby scripts/validate_item_library.rb --write-report
```

之后执行只读校验，并同时检查覆盖报告是否与数据一致：

```bash
ruby scripts/validate_item_library.rb
```

校验至少覆盖：

- YAML 可解析；
- 必需字段存在且类型正确；
- ID 唯一并符合格式；
- 所有枚举、标签、单位和能力来自受控词表；
- 物品与工艺引用闭合；
- `interfaces` 与工艺输入/产出双向一致；
- 数量、质量、体积、时间和产量区间有效；
- 所有条目均为 `candidate_only`；
- 30 项物品和 12–15 个代表工艺的本轮规模约束；
- 四条资源主链至少各有一个物品；
- 覆盖报告能列出已覆盖和暂未覆盖的一级分类。

校验通过只代表“候选数据结构一致”，不代表：

- 数值平衡正确；
- 玩法已经实现；
- 内容已通过玩家测试；
- Gate 1A、Gate 1H 或 Gate 2 状态改变；
- 任何条目可以进入运行时。

---

## 8. 变更与升级

以下改动需要提高合同版本，而不是静默扩写：

- 修改字段语义或形态规则；
- 增加新的存在形态校验；
- 让候选数据进入运行时导入流程；
- 把相对价值点转成正式经济；
- 冻结品质、战斗、护甲或植物数值；
- 引入维修、拆解、自动补货或伙伴动物工艺。

普通新增候选条目可以保持合同版本，但必须通过校验并更新覆盖报告。任何运行时导入都需要独立授权与新的阶段门禁。
