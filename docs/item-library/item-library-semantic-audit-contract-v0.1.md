# 候选物品库 R2-A 语义审计与依赖闭包合同 V0.1

**项目：** Project-004-New Era 2
**上游基线：** `new-era-2.item-library.r1-c7-candidate`
**内容状态：** `candidate_only`
**运行时授权：** 无
**适用范围：** R1 的 196 个库存物品、24 个非库存定义、90 个工艺和 24 个转换流程

## 1. 目的

R1 已证明候选库的数量、结构、引用和生成过程可验证。R2-A 在不增加物品、不修改正式数值、不接入运行时的前提下，进一步回答：

1. 每个库存物品是否具备获得、使用或分配、损耗和决策语义；
2. 制造、维修、拆解、部署、生长、角色接收与权利激活引用是否双向闭合；
3. 未来主干选择稳定 ID 时，是否能确定性计算必需依赖；
4. 不依赖工艺的书籍、凭证、服饰、家具、贵重品和稀有物品是否仍有明确的非战斗用途；
5. 哪些候选内容只有叙事说明、尚缺结构化互动入口。

R2-A 是候选内容质量与消费准备度审计，不是运行时 schema、平衡、UI、存档迁移或 Gate 证据。

## 2. 权威输入与生成物

权威输入：

- `data/item-library/item-library-r1-candidate-bundle.json`
- `docs/item-library/item-library-r1-candidate-baseline-contract-v0.1.md`
- 本合同

工具与生成物：

- `scripts/audit_item_library_semantics.rb`
- `data/item-library/semantic-audit-r2a.json`
- `data/item-library/semantic-audit-r2a.md`

JSON 是机器可读审计与图数据；Markdown 是供设计审查使用的摘要。两者都由工具生成，不得手工修改。

## 3. 库存物品语义要求

每个库存物品必须具备：

- 非空 `decision_role`；
- 至少一条 `acquisition_paths`；
- 至少一条 `consumption_loss_paths`；
- 非空 `actions`、`resource_chains` 和 `logistics_note`；
- 完整的 `interfaces.produced_by`、`used_by`、`repair_recipes`、`dismantle_recipes` 数组；
- 所有接口引用存在，并与工艺输入、产出或工艺种类互相证明；
- 至少一个实际互动动作，或至少一条结构化工艺、转换、成长、照护或权利关系。

`reserve`、`trade`、`deliver`、`store` 和 `inspect` 只表示保管、流通或观察。一个物品若只有这些动作且没有结构化关系，记为“叙事候选”，进入警告清单，但不自动判为缺陷；稀有物品可能有意等待对应玩法 Gate。

没有制造配方不等于语义孤儿。阅读、穿戴、治疗、展示、认证、演奏、清洁、安装、种植、照护和权利交接均可构成有效用途。

## 4. 非库存定义、工艺与转换要求

非库存定义必须：

- 具有非空 `decision_role`；
- 精确引用一个存在的 `transition_id`；
- 与对应转换的 `target.definition` 双向一致；
- 其 profile 中引用的库存物品全部存在。

工艺必须：

- 普通制造工艺至少有一个库存输入和一个库存主产出；
- 维修与拆解工艺可以用 `target.item` 表示目标实例；维修可以不生成新库存产出，拆解可以不再把目标重复列入 `inputs`；
- 输入、主产出和库存副产物引用全部存在；
- 替代规则中的库存物品引用存在，并与 `used_by` 接口互相证明；
- 与库存物品的四组 `interfaces` 互相证明；
- 具有设施、工具、资格、有效时间、物流、资源链和至少一个风险。

转换必须：

- 精确指向一个存在的非库存定义；
- 库存来源及额外输入引用全部存在；
- 具有工具、资格、有效时间、物流、回滚说明和至少一个风险。

## 5. 依赖图

图节点分为：

- `inventory_item`
- `non_inventory_definition`
- `recipe`
- `transition`

结构化边至少包括：

- `recipe_input`
- `recipe_substitute_input`
- `recipe_output`
- `recipe_byproduct`
- `transition_source`
- `transition_additional_input`
- `transition_target`
- `definition_profile_input`
- `definition_profile_output`
- `ammo_compatibility`

图只描述候选内容引用，不表示运行时已经实现对应能力。

装备兼容关系补充要求：

- `equipment_profile.role=weapon_platform` 且 `ammo_family` 不是 `none` 时，候选库中必须至少存在一个同族弹药或信号耗材；
- 同族弹药与平台生成 `ammo_compatibility` 边；
- 有弹药族但没有平台的耗材进入警告，未来选择时必须绑定明确平台或拒绝导入；
- `protection_profile` 只证明防护职责和取舍说明存在，不把覆盖范围转化为正式护甲数值。

## 6. 稳定 ID 选择闭包

工具接受一个或多个稳定 ID，并生成确定性选择闭包：

1. 选择库存物品时，纳入生产、维修和拆解工艺、以该物品为库存来源的转换，以及明确同族的弹药或武器平台；
2. 纳入工艺后，纳入其全部库存输入、替代输入、主产出和库存副产物；
3. 选择非库存定义时，纳入其对应转换和 profile 中的库存依赖；
4. 纳入转换后，纳入来源、额外输入和目标定义；
5. 只有作为根、直接输入、替代输入、转换输入或 profile 输入抵达的库存物品，才继续反向解析其生产工艺，直到集合稳定；
6. 主产出、副产物、目标实例与 profile 输出只纳入节点，不反向解析其其他生产工艺；同一物品若后来又以输入身份抵达，仍须首次反向解析生产工艺；
7. `used_by` 只作为下游使用情境报告，不自动扩展为必需依赖，避免选择一种基础材料时吸入整个候选库。

闭包输出必须按类型和稳定 ID 排序，并记录来源基线 ID、`payload_sha256`、选择根、适用于已选节点的警告和闭包 SHA-256。闭包 SHA-256 必须覆盖来源基线与 Payload，不能只覆盖稳定 ID 集合。

## 7. 严重度与通过标准

`ERROR`：

- 稳定 ID 重复；
- 引用不存在；
- 接口与工艺或转换不互证；
- 必需语义字段缺失；
- 生成物过期或无法确定性重建；
- 闭包包含未知节点。

`WARNING`：

- 只有保管、流通或观察动作，且没有结构化关系；
- 决策角色或说明文本完全重复；

图中不存在结构化边、但具有治疗、阅读、穿戴、展示、认证等明确直接动作的物品，单列为 `direct_use_only` 信息，不记为警告。

R2-A 通过条件：

- `ERROR_COUNT=0`；
- JSON 与 Markdown 可逐字重建；
- 同一组选择根重复计算得到相同闭包 SHA-256；
- R1 C1–C7 回归继续通过；
- 状态仍为 `candidate_only` 且 `runtime_authorization=NONE`。

警告不自动阻止 R2-A，但必须逐项裁定为真实缺口、刻意延期或直接用途候选。

R2-A 初始警告裁定：

| 稳定 ID | 裁定 | 理由 |
|---|---|---|
| `item.rare.offline_sensor_core` | `defer_until_relevant_gate` | 条目明确只保留未来离线诊断或预警升级潜力；当前添加安装、研究或制造入口会越过对应玩法与运行时授权。进入相关 Gate 时必须明确导入、补齐互动，或拒绝导入。 |
| `item.ammunition.training_blank_batch` | `bind_platform_on_selection` | 当前 `ammo_family=blank` 没有对应平台，表示训练用途尚未绑定具体口径。未来选择该条目时必须同时选定兼容平台并细化口径，或拒绝导入。 |

## 8. 使用方式

生成或刷新审计：

```bash
ruby scripts/audit_item_library_semantics.rb --write
```

日常只读验证：

```bash
ruby scripts/audit_item_library_semantics.rb
```

计算稳定 ID 选择闭包：

```bash
ruby scripts/audit_item_library_semantics.rb \
  --select item.agriculture.compound_fertilizer,item.furniture.field_bed
```

## 9. 边界

- 不增加、删除或重命名 R1 稳定 ID；
- 不把 `base_value`、产量、耗时、防护职责或稀有物品说明冻结为正式数值；
- 不允许整包运行时导入；
- 不修改 Gate 1A、Gate 1H 或 Gate 2；
- R2-A 通过只表示候选库更易审计和选择，不表示玩家测试或运行时完成。
