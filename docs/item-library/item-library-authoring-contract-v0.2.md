# 候选物品库编写合同 V0.2

**项目：** Project-004-New Era 2
**适用范围：** C1 基线之上的 C2 候选内容、耐久、维修、拆解与形态转换入口
**状态：** C2 增量合同
**继承合同：** `item-library-authoring-contract-v0.1.md`
**上位设计：** `../design-docs/item-and-manufacturing-system-v0.1.md`
**上位设计核验 SHA-256：** `24f0d4f69322c78f6d52fd1504afa8ffbfe953b4557513bd3a3a77393af583eb`
**运行时授权：** 无

---

## 1. C2 目标与边界

V0.2 完整继承 V0.1 的三轴、资源主链、候选状态、物理属性、获得与流失、工艺输入、人物有效时间、设施、工具、物流、产出、副产物和风险合同。

C2 只增加：

- 第二批 30 项候选物品，使累计候选数达到 60；
- 15 个维修、拆解和装配代表工艺，使累计代表工艺达到 30；
- 独立物品的静态耐久与可维修性声明；
- 家具库存物品向放置实体转换的入口声明；
- 物理文件向权利记录转换的入口声明；
- 武器弹药的用途边界，不定义战斗数值；
- 书籍与数据载体的知识领域，不定义技能经验曲线；
- 贵重品和稀有物品的来源与所有权说明。

C2 不增加：

- 伤害、命中、射速、护甲穿透或弹药威力数值；
- 正式人体部位和装备槽；
- 放置实体、权利记录或角色实体的运行时对象；
- 完整维修 UI、自动维护或拆解队列；
- 正式品质概率、价值货币或市场价格；
- 伙伴与役用动物；
- 运行时导入器或 Gate 授权。

---

## 2. 增量文件

| 文件 | 职责 |
|---|---|
| `data/item-library/controlled-vocabulary.c2.yaml` | 只包含 C2 新增受控值 |
| `data/item-library/items.c2.yaml` | 第二批 30 项物品和对 C1 物品接口的增量 |
| `data/item-library/recipes.c2.yaml` | C2 的 15 个代表工艺 |
| `data/item-library/coverage-report.c2.md` | C1+C2 累计覆盖报告 |

C1 文件保持可独立校验。C2 校验时按以下顺序叠加：

```text
C1 词表 + C2 词表扩展
C1 物品 + C2 物品 + C2 对 C1 的接口扩展
C1 工艺 + C2 工艺
```

C2 扩展不得覆盖或重定义 C1 已存在的枚举 ID、物品 ID 或工艺 ID。

---

## 3. 独立物品耐久合同

C2 中每个 `independent_item` 必须增加：

```yaml
durability_profile:
  tracked: true
  repairability: repairable
  dismantle_policy: allowed
  wear_sources: [use, impact, moisture]
  failure_consequence: 具体且可见的失效结果
```

字段职责：

| 字段 | 说明 |
|---|---|
| `tracked` | C2 独立物品固定为 `true`，表示实例需要记录完整度或状态 |
| `repairability` | `repairable`、`maintain_only` 或 `nonrepairable` |
| `dismantle_policy` | `allowed`、`restricted` 或 `none` |
| `wear_sources` | 受控磨损来源 |
| `failure_consequence` | 失效后对使用、分配或来源价值的可见影响 |

约束：

- `repairable` 必须至少有一个 `repair_recipes`；
- 非 `repairable` 不得伪造维修工艺；
- `dismantle_policy: allowed` 必须至少有一个 `dismantle_recipes`；
- `restricted` 表示设计上允许但本批次不授权通用拆解，必须在描述或决策职责中解释；
- `none` 表示拆解不会产生有意义库存，或会破坏必须保留的证据/权利。

本字段只冻结职责与离散状态边界，不冻结耐久数值、磨损速度或维修概率。

---

## 4. 维修与拆解工艺

C2 新增 `repair` 与 `dismantle` 两种工艺类型。

两者必须增加 `target`：

```yaml
target:
  item: item.example.target
  allowed_from: [worn, damaged]
  result_state: serviceable
  target_consumed: false
```

### 4.1 维修

维修工艺：

- `kind` 必须是 `repair`；
- `target.target_consumed` 必须是 `false`；
- `result_state` 必须是 `serviceable`；
- 主产出 `outputs` 必须为空，因为原实例被保留并改变状态；
- 材料、清洁耗材和替换零件继续列入 `inputs`；
- 物品的 `interfaces.repair_recipes` 必须双向引用该工艺。

维修不能消除来源、所有权、序列号、赠送记录或重要经历。

### 4.2 拆解

拆解工艺：

- `kind` 必须是 `dismantle`；
- `target.target_consumed` 必须是 `true`；
- `result_state` 必须是 `dismantled`；
- `outputs` 至少包含一项回收物；
- 可以没有额外材料输入；
- 物品的 `interfaces.dismantle_recipes` 必须双向引用该工艺。

拆解产量区间不得等于原始制造投入总量。它必须体现磨损、无法分离件、污染、来源保留或工艺损失，防止无损循环。

### 4.3 装配

C2 装配继续使用 V0.1 的 `assembly`，没有 `target`。它必须有非空输入和主产出。

---

## 5. 分类专用字段

### 5.1 武器与弹药

每项 `weapon_and_ammunition` 必须有：

```yaml
equipment_profile:
  role: weapon_platform
  ammo_family: rifle
  use_constraints: 需要匹配弹药、受训人员和明确安全授权
```

`role` 与 `ammo_family` 使用 C2 受控值。它们只表达匹配关系和用途边界，不表达战斗强度。

### 5.2 书籍与数据载体

每项 `book_and_data` 必须有：

```yaml
knowledge_profile:
  domain: agriculture
  requires_reader: true
  effect_note: 只有人物阅读、理解并用于工作时才影响决策
```

书籍入库不自动产生全局加成。

### 5.3 家具

每项 `furniture` 是可库存的独立物品入口，必须有：

```yaml
deployment_profile:
  converts_to_placed_entity: true
  installation_required: true
  footprint: medium
  uninstall_result: returns_item
```

库存数量不等于已经部署。安装需要搬运、位置、工作时间和可达性；地图实体仍留待运行时阶段定义。

### 5.4 文件与凭证

每项 `document_and_credential` 是物理载体，必须有：

```yaml
record_transition:
  creates_rights_record: true
  authority_scope: 边境通行
  revocation_note: 签发方撤销后，纸面仍存在但权利失效
```

物理文件与权利记录不得混为同一个库存对象。

### 5.5 珠宝、贵重品、稀有与特殊物品

`jewelry_and_valuable` 与 `rare_and_special` 必须有：

```yaml
provenance_profile:
  ownership: personal
  source: 已知来源
  significance: 为什么来源会改变交易、关系、证据或拆解决策
```

高基础价值不能取代来源、所有权和暴露风险。

---

## 6. C2 接口覆盖层

因为 C1 文件保持冻结，C2 工艺引用 C1 物品时，通过 `interface_extensions` 增量声明：

```yaml
interface_extensions:
  item.material.reclaimed_steel_plate:
    used_by:
      - recipe.c2_assembly.field_bed
```

覆盖层只允许向四个接口数组追加已有 C2 工艺 ID：

- `produced_by`
- `used_by`
- `repair_recipes`
- `dismantle_recipes`

不得删除、替换或重复 C1 接口。累计校验器在内存中合并后，仍要求所有物品—工艺引用精确双向一致。

---

## 7. C2 校验门禁

C1 独立校验：

```bash
ruby scripts/validate_item_library.rb
```

C2 首次生成或刷新累计覆盖报告：

```bash
ruby scripts/validate_item_library.rb --profile c2 --write-report
```

C2 只读校验：

```bash
ruby scripts/validate_item_library.rb --profile c2
```

C2 必须满足：

- C1 仍能单独通过；
- 累计恰好 60 项物品、30 个代表工艺；
- C2 恰好新增 30 项物品和 15 个工艺；
- C2 词表扩展没有覆盖 C1 ID；
- 所有维修、拆解、装配与接口覆盖层引用闭合；
- 独立物品耐久声明和维修/拆解接口一致；
- 分类专用字段完整；
- 四条资源主链继续覆盖；
- 累计一级分类覆盖至少 17/18；
- 所有新增内容保持 `candidate_only`；
- C1 覆盖报告与 C2 累计覆盖报告都未漂移；
- R1 哈希未变化；
- 运行时授权仍为 `NONE`。

---

## 8. C2 接受不代表运行时冻结

C2 的 `REVIEW_PASS` 仅表示第二批候选内容和生命周期接口可以作为后续内容编写基线。它不授权：

- 导入武器、弹药、家具、文件或稀有物品；
- 实现战斗、射击、装备或放置；
- 把纸面凭证直接转成权利状态；
- 给书籍、装饰或贵重品添加自动全局数值；
- 开始 Gate 2；
- 替代真人 Gate 1H。
