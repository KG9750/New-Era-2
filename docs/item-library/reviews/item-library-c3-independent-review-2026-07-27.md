# 候选物品库 C3 独立审查报告

**日期：** 2026-07-27  
**审查方式：** `claude-code-review` 外部只读首审 + Codex 证据裁定 + Claude 针对性只读复审  
**审查范围：** R1、C1/C2 基线、C3 合同与数据、三档校验器、三份覆盖报告  
**累计内容：** 66 个可库存物品 / 24 个非库存实体或记录 / 90 个目录定义 / 30 个制造工艺 / 24 个转换流程  
**最终裁定：** `P0=0 / P1=0 / P2=0 / REVIEW_PASS`  
**运行时授权：** 无

---

## 1. 审查合同

独立审查使用：

- `docs/design-docs/item-and-manufacturing-system-v0.1.md`；
- `docs/item-library/item-library-authoring-contract-v0.1.md`；
- `docs/item-library/item-library-authoring-contract-v0.2.md`；
- `docs/item-library/item-library-authoring-contract-v0.3.md`。

重点检查：

1. C1、C2 是否继续独立通过且未被 C3 覆盖；
2. C3 是否恰好新增 6 个库存物品和 24 个非库存定义；
3. 累计 66/24/90 和转换流程 6/4/8/6 是否精确；
4. 四种非库存形态是否使用专用字段，且不伪造库存属性；
5. 每个非库存定义是否与一个转换流程双向闭合；
6. 家具部署、种源播种、动物外部交接和权利证据关联是否避免复制或概念混同；
7. 制造工艺与形态转换是否分别计数；
8. ID、受控词、跨文件引用、覆盖报告和校验器是否有可绕过门禁；
9. 是否偷渡运行时、战斗数值、完整植物、动物或权利系统；
10. R1 哈希、schema、authority 和报告漂移是否真实受校验。

两次 Claude Code 调用均为只读审查，没有授权外部审查器修改项目文件。

外部首审原始输出 SHA-256：

`48d427b58e27d037b1fc1e4ff72b08708db7e9899168c008e13f40d7a9e6334f`

针对性复审原始输出 SHA-256：

`b1e52accd8bb7ba99d8b9d36c1c881807b6f7cabe8908a143ff1a610fc355cc4`

---

## 2. 外部首审

Claude 首审结论：

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

首审确认：

- `c1`、`c2`、`c3` 三档均通过；
- C3 计数为 66 个库存物品、24 个非库存定义、90 个目录定义和 24 个转换流程；
- 18/18 一级分类与 6/6 存在形态完整覆盖；
- 6 个部署、4 个栽培、8 个活体接收和 6 个权利激活流程全部双向闭合；
- 动物来源正确使用 `external_intake`，饲料只是接收与照护投入；
- 权利使用 `retained_and_linked`，物理证据没有被错误消耗；
- 制造工艺与转换流程使用不同命名空间和计数；
- 非库存定义没有重量、体积、堆叠、售价、耐久或拆解字段；
- 没有运行时或 Gate 授权。

---

## 3. Codex 复核发现与修正

### 3.1 已修正 P1：R1 实际文件哈希未由校验器计算

**首审遗漏：** 原校验器只比较各 YAML 中声明的固定哈希，没有读取 R1 文件并计算真实 SHA-256。

**影响：** 如果 R1 文件发生漂移而 YAML 声明保持不变，旧校验器仍可能输出 PASS。这违反 C1–C3 合同中的上位设计冻结门禁。

**修正：**

- 引入 Ruby 标准库 `Digest`；
- 直接读取 `docs/design-docs/item-and-manufacturing-system-v0.1.md`；
- 使用 `Digest::SHA256.file` 计算实际哈希；
- 文件缺失、读取失败或实际哈希不等于冻结值时进入 `errors` 并最终 `exit 1`；
- 同时验证 C1/C2/C3 九个 YAML 文档的 `schema_version`；
- 验证各文档 `authority.contract`、`authority.design` 或 `authority.document` 路径。

当前真实 R1 文件 SHA-256：

`24f0d4f69322c78f6d52fd1504afa8ffbfe953b4557513bd3a3a77393af583eb`

**状态：** 已修正，三档回归通过，针对性外部复审确认门禁闭合。

---

## 4. 针对性复审与裁定

针对性复审确认四项修正均成立：

| 检查 | 结果 |
|---|---|
| 对真实 R1 文件计算 SHA-256 | PASS |
| 文件缺失或哈希漂移进入 FAIL | PASS |
| C1/C2/C3 schema 与 authority 路径验证 | PASS |
| 三档回归与报告逐字节漂移检查 | PASS |

### 4.1 驳回：R1 第 11 行应改成当前文件哈希

复审提出 R1 第 11 行的“受审内容 SHA-256”是旧值，建议改成当前文件 SHA。

**裁定：驳回，不修改 R1。**

证据：

1. `item-and-manufacturing-system-v0.1-freeze-decision-2026-07-26.md` 明确分别记录：
   - 受审内容 SHA：`3ebe68f7097ca849de2a0c42809f2894aaaa01899b572d4669449cbb2013e54b`；
   - 冻结后文档 SHA：`24f0d4f69322c78f6d52fd1504afa8ffbfe953b4557513bd3a3a77393af583eb`。
2. 冻结决议说明：冻结时只修改状态元数据，必须区分“受审语义快照”和“用户冻结后的文档载体”。
3. C1 独立审查报告第 2.3 节已经对同一意见完成裁定并由第二轮外部复审接受。
4. 要求包含哈希文本的文件等于其自身最终 SHA 会形成不可复算的自指合同。
5. 本支干边界要求 R1 只引用、不修改。

因此第 11 行不是过时的“当前文件自哈希”，而是复审绑定快照。当前文件的真实冻结后哈希由冻结决议、C1–C3 合同、数据 authority 和校验器共同核验。

---

## 5. 最终验证

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

ITEM_LIBRARY_VALIDATION=PASS
PROFILE=c3
ITEM_COUNT=66
RECIPE_COUNT=30
NON_INVENTORY_DEFINITION_COUNT=24
CATALOG_DEFINITION_COUNT=90
TRANSITION_COUNT=24
RUNTIME_AUTHORIZATION=NONE
```

C3 累计覆盖：

- 一级分类：18 / 18；
- 存在形态：6 / 6；
- 库存物品：66；
- 非库存实体或记录：24；
- 目录定义：90；
- 制造、维修与拆解工艺：30；
- 形态转换流程：24；
- 每个非库存定义都有唯一入口流程；
- R1 实际文件哈希由校验器直接计算；
- 三份覆盖报告均未漂移。

最终结论：

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

---

## 6. 接受边界

`REVIEW_PASS` 表示 C3 的目录形态与转换边界可以作为后续候选内容编写基线，不表示：

- 约 220 项完整候选库已经完成；
- 地图放置、作物、动物或权利对象已经进入运行时；
- 动物需求、训练、繁殖、战斗或关系系统已经冻结；
- 作物季节、精确产量或品质已经冻结；
- 权利法域、自动执行或争议裁决已经实现；
- Gate 1A、Gate 1H 或 Gate 2 状态改变；
- agent 代理验证可以替代真人 Gate 1H。
