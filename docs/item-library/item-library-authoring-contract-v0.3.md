# 候选物品库编写合同 V0.3

**项目：** Project-004-New Era 2  
**适用范围：** C1+C2 基线之上的 C3 目录定义、非库存形态与转换流程  
**状态：** C3 增量合同  
**继承合同：** `item-library-authoring-contract-v0.1.md`、`item-library-authoring-contract-v0.2.md`  
**上位设计：** `../design-docs/item-and-manufacturing-system-v0.1.md`  
**上位设计核验 SHA-256：** `24f0d4f69322c78f6d52fd1504afa8ffbfe953b4557513bd3a3a77393af583eb`  
**运行时授权：** 无

---

## 1. C3 目标

C3 在不修改 C1、C2 数据文件的前提下新增：

- 30 个候选目录定义，使累计目录定义达到 90；
- 其中 6 个是可库存物品，24 个是非库存实体或记录；
- 24 个显式转换流程，每个非库存定义恰好对应一个入口流程；
- 4 个 `growing_entity`、6 个 `placed_entity`、8 个 `character_entity`、6 个 `rights_record`；
- “伙伴与役用动物”分类的首批 8 个角色实体；
- 全部 18 个一级分类和 6 种存在形态的样本覆盖。

C3 的“目录定义”是数据设计术语，不表示所有定义都是库存物品。累计数量必须分别报告：

```text
可库存物品：66
非库存实体/记录：24
累计目录定义：90
制造/维修/拆解工艺：30
形态转换流程：24
```

转换流程不计入 C1/C2 的制造工艺数量，不能用来虚增制作系统完成度。

---

## 2. C3 边界

C3 只冻结：

- 库存来源、外部活体交接与目标定义的引用关系；
- 库存移出、播种、活体接收、证据关联等来源处置；
- 转换所需设施、工具、人物资格、有效时间和地图物流；
- 非库存形态的最小静态职责；
- 可逆性、撤回结果和失败风险；
- 物理文件与权利记录、家具与放置实体、种源与生长实体、外部动物与角色实体的分离。

C3 不冻结：

- 地图占格、寻路、碰撞、供电或容量数值；
- 作物季节、基因、品质概率、精确产量或完整生长模拟；
- 动物属性、需求数值、信任、训练、繁殖、战斗参与或关系系统；
- 权利系统的正式法域、AI 裁决、声望公式或自动执行；
- 运行时类、导入器、UI、存档迁移或 Gate 范围。

所有 C3 内容保持 `candidate_only`。C3 通过不改变 Gate 1A、Gate 1H 或 Gate 2 状态。

---

## 3. 增量文件

| 文件 | 职责 |
|---|---|
| `data/item-library/controlled-vocabulary.c3.yaml` | 只包含 C3 新增受控值 |
| `data/item-library/catalog.c3.yaml` | 30 个 C3 目录定义 |
| `data/item-library/transitions.c3.yaml` | 24 个形态转换流程 |
| `data/item-library/coverage-report.c3.md` | C1+C2+C3 累计覆盖报告 |

叠加顺序：

```text
C1 词表 + C2 词表扩展 + C3 词表扩展
C1 物品 + C2 物品 + C3 六个库存物品
C3 二十四个非库存实体/记录
C1 工艺 + C2 工艺
C3 转换流程
```

C3 不得覆盖已有枚举、物品 ID、工艺 ID 或定义 ID。

---

## 4. 统一转换模型

### 4.1 库存来源

家具、种源和物理凭证使用：

```text
库存来源物品
→ 部署、播种或激活流程
→ 放置实体、生长实体或权利记录
```

来源必须声明数量、处置方式和是否建立排他链接：

- `installed`：原实例移出库存，成为放置实体；
- `sown`：对应批量数量被消耗，进入生长周期；
- `retained_and_linked`：物理载体仍存在，但被排他关联到权利记录；
- 同一个独立实例不得同时存在于库存、已部署位置和多个权利记录中。

### 4.2 外部活体交接

动物不是由普通库存物品制造出来的。动物流程使用：

```text
外部活体交接
→ 接收、检疫与建立归属
→ 伙伴或役用动物角色实体
```

饲料、设施和人物时间是接收投入，不是动物本体来源。`external_intake` 必须声明交接类型和 `accepted_to_custody`，不得填写虚假的库存动物 ID。

### 4.3 目标唯一性

- 每个非库存定义必须声明一个 `transition_id`；
- 每个转换流程必须指向一个存在的非库存定义；
- 每个非库存定义只能被一个 C3 入口流程创建；
- 转换目标不得是 `bulk_material` 或 `independent_item`；
- 转换过程不使用制造工艺的 `outputs` 伪造第二份库存物品。

---

## 5. 可库存物品合同

C3 的 6 个库存物品继续完整遵守 V0.1 物品字段合同：

- 物理属性、堆叠、储存、价值、获得与流失路径完整；
- `bulk_material` 必须可堆叠；
- `interfaces` 仍只描述 C1/C2 制造工艺，不混入转换流程；
- 转换流程通过 `source.item` 或 `additional_inputs[].item` 引用库存；
- 不修改 C1/C2 物品来增加反向接口。

C3 新增库存物品固定为：

- 专业谷物种源；
- 纤维作物种源；
- 药草种源；
- 饲料作物种源；
- 干燥药草；
- 饲料捆。

---

## 6. 非库存形态合同

所有非库存定义都必须包含统一公共字段：

```yaml
id: entity.example.name
name: 示例
description: 具体职责
status: candidate_only
category: furniture
form: placed_entity
tags: [placed]
resource_chains: [survival, industry]
availability: common
legal_profile: default_legal
exposure_profile:
  visibility: medium
  traceability: none
  wealth_signal: low
actions: [operate, uninstall]
decision_role: 为什么会形成取舍
transition_id: transition.deploy.example
```

它们不得填写 `unit`、`mass`、`volume`、`stack_rule`、`storage_rule`、`base_value`、库存获得/流失路径或制造接口。

### 6.1 放置实体

`placed_profile` 必须声明：

- `source_item`；
- `capability`；
- `ongoing_input_items`，允许为空；
- `uninstall_result`；
- `effect_note`。

库存有一件家具不等于地图已获得能力。能力只在转换流程完成、位置有效且持续条件满足后成立。

### 6.2 生长实体

`growing_profile` 必须声明：

- `source_item`；
- 完整离散 `growth_stages`；
- `care_input_items`；
- `harvest_output_items`；
- `effect_note`。

种子库存不产生被动产量。C3 只声明阶段和输入/产出引用，不冻结天数、品质、季节或概率。

### 6.3 角色实体

`character_profile` 必须声明：

- `species`；
- 一个或多个 `service_roles`；
- `upkeep_items`；
- `autonomy_note`；
- `loss_note`。

角色实体不得出现重量、堆叠、基础售价、品质、耐久或拆解字段。服务角色只表示候选用途，不代表接受任务、已训练或获得战斗能力。

### 6.4 权利记录

`rights_profile` 必须声明：

- `bearer_scope`；
- `issuer_class`；
- 一个或多个 `validity_states`；
- `revocable`；
- `physical_evidence_item`；
- `effect_note`。

物理文件、令牌或种源匣不等于有效权利。权利记录可以失效、暂停、撤销或争议，而物理载体仍可能留存。

---

## 7. 转换流程合同

每个转换流程必须包含：

```yaml
id: transition.deploy.example
name: 示例部署
description: 转换职责
status: candidate_only
kind: deploy
source:
  kind: inventory_item
  item: item.example.source
  amount: 1.0
  disposition: installed
  link_exclusive: true
target:
  definition: entity.placed.example
additional_inputs: []
facilities: [settlement_space]
tools: [placement_tools]
qualification:
  minimum_role: installer
  skill: maintenance
  specialty: placement
  missing_effect: prohibited
effective_time_hours: {min: 1.0, max: 2.0}
logistics:
  input_staging: 来源如何到场
  output_location: 目标在哪里成立
rollback:
  allowed: true
  result: source_returned
  note: 如何撤回且避免复制
risks:
  - id: bad_site
    condition: 触发条件
    effect: 可见结果
```

规则：

- `deploy` 必须使用 `inventory_item + installed`，目标为 `placed_entity`；
- `cultivate` 必须使用 `inventory_item + sown`，目标为 `growing_entity`；
- `live_intake` 必须使用 `external_intake + accepted_to_custody`，目标为 `character_entity`；
- `right_activation` 必须使用 `inventory_item + retained_and_linked`，目标为 `rights_record`；
- 库存来源必须存在；外部活体来源不得填写 `item`；
- `additional_inputs` 可以为空，但列出的物品必须存在且说明是否消耗；
- 设施、工具、资格、有效时间、物流、撤回和风险都必须显式填写；
- 播种开始后不得通过回滚无损返还种源；
- 权利撤销只改变记录状态，不自动销毁物理载体；
- 动物退出归属必须走后续照护交接，不得“返还为库存物品”。

---

## 8. C3 校验门禁

```bash
ruby scripts/validate_item_library.rb
ruby scripts/validate_item_library.rb --profile c2
ruby scripts/validate_item_library.rb --profile c3 --write-report
ruby scripts/validate_item_library.rb --profile c3
```

C3 必须满足：

- C1 和 C2 继续独立通过；
- C3 恰好新增 30 个目录定义；
- 累计恰好 66 个库存物品、24 个非库存定义、90 个目录定义；
- C1+C2 仍为 30 个制造/维修/拆解工艺；
- C3 恰好 24 个转换流程，类型分布为 6/4/8/6；
- 18/18 一级分类和 6/6 存在形态均有样本；
- 每个非库存定义与转换流程一一闭合；
- 所有来源、投入、放置来源、种源、收获物、照护物和物理证据引用存在；
- 形态专用字段完整，禁用库存字段不泄漏到非库存定义；
- 所有新增内容保持 `candidate_only`；
- 三份覆盖报告都未漂移；
- R1 哈希未变化；
- 运行时授权仍为 `NONE`。

---

## 9. 接受边界

C3 `REVIEW_PASS` 只表示目录形态和转换边界可以作为后续内容编写基线。它不表示：

- 非库存对象已经有运行时实现；
- 地图、作物、动物或权利玩法已经可玩；
- 约 220 项完整候选库已经完成；
- 制造、维修、拆解或装备系统已完整；
- 任何 Gate 已通过、解锁或被替代；
- agent 代理验证可以替代真人 Gate 1H。
