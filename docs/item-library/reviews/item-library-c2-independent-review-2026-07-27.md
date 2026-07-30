# 候选物品库 C2 独立审查报告

**日期：** 2026-07-27
**审查方式：** `claude-code-review` 外部只读审查 + Codex 证据裁定 + Claude 只读复审
**审查范围：** C1 基线、C2 增量、双档校验器和两份覆盖报告
**累计内容：** 60 项候选物品 / 30 个代表工艺
**最终裁定：** `P0=0 / P1=0 / P2=0 / REVIEW_PASS`
**运行时授权：** 无

---

## 1. 审查合同

独立审查以以下文件为约束：

- `docs/design-docs/item-and-manufacturing-system-v0.1.md`
- `docs/item-library/item-library-authoring-contract-v0.1.md`
- `docs/item-library/item-library-authoring-contract-v0.2.md`

重点检查：

1. C1 是否仍能独立验证；
2. C2 词表扩展和 `interface_extensions` 是否覆盖、污染或绕过 C1；
3. 累计 60 项物品和 30 个工艺是否全部保持 `candidate_only`；
4. 维修是否保留目标实例且不生成复制品；
5. 拆解是否消耗目标并进行有损回收；
6. 耐久声明、维修/拆解接口和工艺目标是否双向一致；
7. 武器弹药是否偷渡战斗数值；
8. 家具与凭证是否把库存物品误当放置实体或权利记录；
9. 书籍是否产生入库即生效的全局加成；
10. 校验器是否存在 profile、覆盖层、报告漂移或 Ruby 2.6 兼容问题；
11. 是否意外授权运行时、Gate 2 或替代真人 Gate 1H。

两轮 Claude Code 调用均为只读文件审查，未授权外部审查器修改项目文件。

---

## 2. 第一轮独立审查

第一轮结果：

| 严重度 | 数量 | 结论 |
|---|---:|---|
| P0 | 0 | 无 |
| P1 | 0 | 无 |
| P2 | 2 | 接受并修正 |

第一轮已达到 `REVIEW_PASS`，但为获得无遗留意见的 C2 基线，两项 P2 均进入修正。

### 2.1 C1 独立性

审查确认：

- `--profile c1` 只加载 C1 文件并独立通过；
- C2 词表只能追加新 ID，不能覆盖 C1 受控值；
- `interface_extensions` 只能扩展 C1 物品；
- 覆盖层只能引用 C2 工艺；
- 覆盖层不能删除、替换或重复 C1 接口；
- C2 当前只向 C1 原料追加 `produced_by` 和 `used_by`，没有把 C2 耐久职责泄漏给 C1 物品。

### 2.2 生命周期闭合

6 个维修工艺全部满足：

```text
target_consumed=false
outputs=[]
result_state=serviceable
```

因此维修只改变原实例状态，不生成第二件同 ID 实例，也不覆盖来源、所有权和持有记录。

6 个拆解工艺全部满足：

```text
target_consumed=true
result_state=dismantled
outputs 非空
```

折叠野战床和有线工作灯同时具有装配与拆解配方。人工对比确认它们的拆解最大产出均低于制造投入，不能形成无损循环。

### 2.3 分类边界

独立审查确认：

- 8 项武器与弹药只有平台角色、弹药族和使用约束，没有伤害、命中、射速、穿透或战斗力数值；
- 4 项家具仍是 `independent_item` 库存入口，必须安装后才转换为放置实体；
- 4 项文件凭证把物理载体与可撤销权利记录分开；
- 4 项书籍与数据载体都要求读者、阅读时间和具体应用条件；
- 贵重品与稀有物品都保留来源、所有权和意义字段；
- 未发现运行时、Gate 或自动全局效果偷渡。

---

## 3. 第一轮发现与修正

### 3.1 P2-1：武器清洁维护组 ID 域名易误导

**原状态：**

```yaml
id: item.tool.weapon_cleaning_kit
category: weapon_and_ammunition
```

虽然 ID 域不等于一级分类，但该条目是 C2 武器维护耗材，使用 `item.tool.*` 会给未来搜索、导出和内容编写造成不必要歧义。

**修正：**

```yaml
id: item.weapon.cleaning_kit
```

同步更新：

- 物品定义；
- 装配工艺产出；
- 栓动步枪维修输入；
- 泵动霰弹枪维修输入。

**状态：** 复审确认旧 ID 零残留，所有双向引用闭合。

### 3.2 P2-2：腕表与戒指使用 `equip`

**原状态：** 机械腕表和家族戒指使用 `equip`，可能让未来战斗装备槽误收个人饰品。

**修正：**

- `item.valuable.mechanical_watch`：`equip` 改为 `wear`；
- `item.valuable.family_ring`：`equip` 改为 `wear`；
- 工具砍刀、栓动步枪和泵动霰弹枪继续保留正确的 `equip`。

**状态：** 复审确认两项贵重品不再携带 `equip`，`wear` 来自 C1 受控词表。

---

## 4. 第二轮复审

第二轮逐项确认：

| 项目 | 结果 |
|---|---|
| 旧 `item.tool.weapon_cleaning_kit` 残留 | 0 |
| 新 `item.weapon.cleaning_kit` 定义与三处工艺引用 | 闭合 |
| 机械腕表 `equip` 残留 | 0 |
| 家族戒指 `equip` 残留 | 0 |
| 武器平台的 `equip` | 保持 |
| C1 独立校验 | PASS |
| C2 累计校验 | PASS |
| 新增 P0/P1/P2 | 0 |

复审最终结论：

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

---

## 5. 最终验证证据

```text
ITEM_LIBRARY_VALIDATION=PASS
PROFILE=c1
ITEM_COUNT=30
RECIPE_COUNT=15
RUNTIME_AUTHORIZATION=NONE

ITEM_LIBRARY_VALIDATION=PASS
PROFILE=c2
ITEM_COUNT=60
RECIPE_COUNT=30
RUNTIME_AUTHORIZATION=NONE
```

C2 累计覆盖：

- 一级分类：17 / 18；
- 存在形态：2 / 6；
- 维修工艺：6；
- 拆解工艺：6；
- C2 装配工艺：3；
- 四条资源主链均有候选内容；
- 唯一未覆盖一级分类：伙伴与役用动物。

---

## 6. 接受边界

`REVIEW_PASS` 表示 C2 可以作为下一批候选内容编写基线，不表示：

- 约 220 项完整候选库已经完成；
- 物品、战斗、家具放置或权利记录已经进入运行时；
- 武器和弹药数值已经冻结；
- 自动维修、维护计划或拆解队列已经实现；
- Gate 1A、Gate 1H 或 Gate 2 状态改变；
- 候选代理验证可以替代真人测试。
