# 候选物品库 R1 基线与消费合同 V0.1

**项目：** Project-004-New Era 2
**基线 ID：** `new-era-2.item-library.r1-c7-candidate`
**内容状态：** `candidate_only`
**运行时授权：** 无
**上位设计 SHA-256：** `24f0d4f69322c78f6d52fd1504afa8ffbfe953b4557513bd3a3a77393af583eb`

## 1. 目的

本合同把 C1–C7 的分批候选源文件汇总为一个确定性生成的只读候选包，供未来主干检索、筛选、比较和编写导入提案。

候选包不是运行时 Def，不允许被整包加载到游戏。未来主干只能在获得对应阶段授权后，显式选择稳定 ID，并为所选内容补齐当期运行时 schema、数值、UI、迁移、测试和 Gate 证据。

## 2. 权威关系

- C1–C7 YAML 是候选内容的编辑源；
- `scripts/validate_item_library.rb` 负责合并词表、跨批接口和累计内容；
- `data/item-library/item-library-r1-candidate-bundle.json` 是生成物，不得手工编辑；
- bundle 中的 `source_files` 保存编辑源与合同的 SHA-256；
- bundle 中的 `payload_sha256` 覆盖合并后的词表、库存物品、非库存定义、工艺和转换流程；
- 源文件、合同或合并结果发生变化时，旧 bundle 必须判定为过期。

编辑源优先于生成物。出现差异时，不允许以手工修改 bundle 的方式绕过源文件和校验器。

## 3. Bundle 固定结构

```text
schema_version
baseline_id
status
runtime_authorization
authority
counts
selection_policy
source_files
payload_sha256
payload
  enums
  inventory_items
  non_inventory_definitions
  recipes
  transitions
```

固定累计计数：

- 库存物品：196；
- 非库存定义：24；
- 目录定义：220；
- 工艺：90；
- 转换流程：24。

## 4. 未来主干消费规则

1. 默认拒绝整包运行时导入；
2. 以稳定 ID 选择内容，不以中文名称、数组位置或文件批次选择；
3. 选择库存物品时同时解析其 `interfaces`，检查关联工艺、上游输入和副产物；
4. 选择非库存定义时同时选择其一一对应的 `transition_id`；
5. 选择工艺时必须包含全部直接输入、替代项、主产出和库存型副产物；
6. 不把 `base_value`、时间区间、产量区间或防护职责直接视为最终平衡数值；
7. 不把 `deployment_profile`、`knowledge_profile`、`equipment_profile`、`protection_profile` 或稀有物品说明直接视为运行时能力；
8. 每次导入提案必须记录候选基线 ID、`payload_sha256`、选择的稳定 ID、授权 Gate、运行时 schema 版本和测试证据。

## 5. 生成与验证

刷新 C7 报告与 bundle：

```bash
ruby scripts/validate_item_library.rb --profile c7 --write-report --write-bundle
```

日常只读验证：

```bash
ruby scripts/validate_item_library.rb --profile c7
```

只读验证会逐字重算报告和 bundle。任一生成物缺失或过期都必须失败。

## 6. 变更边界

- 显示名称或说明变化仍需重建 bundle；
- 稳定 ID 一旦被引用不得复用给其他概念；
- 删除或替换稳定 ID 需要单独迁移说明；
- 改变 C7 计数、R1 内容组配额、形态边界或运行时授权需要新的合同版本和独立审查；
- 本合同不改变 Gate 1A、Gate 1H 或 Gate 2。
