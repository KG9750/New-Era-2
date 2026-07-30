# 候选物品库 C5 独立审查报告

**日期：** 2026-07-27  
**审查方式：** `claude-code-review` 外部只读审查 + Codex 证据裁定  
**审查范围：** R1、配额计划、C5 合同、受控词表、物品、工艺、累计覆盖报告与五档校验器  
**累计内容：** 126 个可库存物品 / 24 个非库存实体或记录 / 150 个目录定义 / 60 个制造工艺 / 24 个转换流程  
**最终裁定：** `P0=0 / P1=0 / P2=0 / REVIEW_PASS`  
**运行时授权：** 无

---

## 1. 审查合同

外部只读审查重点检查：

1. C1–C4 是否继续独立通过；
2. C5 是否恰好新增 30 个物品和 15 个工艺；
3. 分类增量 8/4/4/8/6 与形态增量 22/8 是否精确；
4. 累计 126/24/150、60 个工艺和 24 个转换流程是否真实；
5. 组件、工具、电子设备、食品和医疗语义是否符合存在形态；
6. 食品安全、污染、储存、保质期与医疗专业使用边界是否诚实；
7. 物品、工艺、副产物和跨批接口是否双向闭合；
8. 独立物品耐久、离线技术和 `candidate_only` 边界是否成立；
9. 校验器是否存在可绕过门禁。

Claude Code 只读审查没有获得文件修改权限。

外部审查原始输出 SHA-256：

`cd3f6c2dcfbcf108c7776be0d47f7743ff0ed6743747a74a90c6285977bf007a`

---

## 2. 外部审查结论

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

外部审查确认：

- C5 新增 30 个物品和 15 个工艺；
- 分类为零部件 8、工具 4、电子用具 4、食品 8、医疗 6；
- 形态为 22 个批量物资、8 个独立物品；
- 累计 126 个库存物品、24 个非库存定义、150 个目录定义、60 个工艺、24 个转换流程；
- 零部件、工具与电子用具达到 28/28；
- 食品、饮料、药品与医疗用品达到 20/28；
- 8 个独立物品均有完整耐久职责；
- 食品、药品和医疗用品的污染、储存、批次与专业使用边界成立；
- 15 个工艺及库存型副产物的双向接口闭合；
- 离线电子、无运行时授权和 Gate 隔离边界成立；
- 校验器没有发现可绕过的计数、词表、接口、哈希或报告漂移路径。

---

## 3. Codex 裁定

### 3.1 接受：最终无缺陷结论

Codex 重新运行五档校验、Ruby 语法、R1 实际哈希和工作树差异检查，并逐项核对 C5 ID、分类、形态、耐久、追踪标签与工艺接口。没有发现外部审查遗漏的冻结阻断项。

### 3.2 纠正：医疗用品不要求全部使用受控批次

外部报告概括为“全部 6 项医疗用品都有 `traceable` 标签和 `regulated_batch`”，实际并非如此：

- 清洁夹板组使用 `local_markings`，不带 `traceable`；
- 其他需要药品批次、无菌批次或受控来源的医疗用品使用 `regulated_batch` 与 `traceable`。

该差异是正确的风险分层，不是缺陷。校验器要求 `traceable` 与 `regulated_batch/networked` 精确一致，当前所有条目均通过。

### 3.3 驳回：校验器只对 C1 做哈希检查

外部报告把“C1 只检查 SHA”列为潜在改进。实际每个 profile 都会把 C1 物品和工艺纳入完整字段、词表、引用、接口和覆盖校验，R1 SHA 是额外的上位设计冻结门禁，不是唯一检查。

因此该观察基于不完整描述，不形成缺陷或后续债务。

---

## 4. 最终验证

```text
PROFILE=c1 ITEM_COUNT=30 RECIPE_COUNT=15 PASS
PROFILE=c2 ITEM_COUNT=60 RECIPE_COUNT=30 PASS
PROFILE=c3 ITEM_COUNT=66 RECIPE_COUNT=30 CATALOG_DEFINITION_COUNT=90 TRANSITION_COUNT=24 PASS
PROFILE=c4 ITEM_COUNT=96 RECIPE_COUNT=45 CATALOG_DEFINITION_COUNT=120 TRANSITION_COUNT=24 PASS
PROFILE=c5 ITEM_COUNT=126 RECIPE_COUNT=60 CATALOG_DEFINITION_COUNT=150 TRANSITION_COUNT=24 PASS
R1_SHA256=24f0d4f69322c78f6d52fd1504afa8ffbfe953b4557513bd3a3a77393af583eb
RUBY_SYNTAX=OK
RUNTIME_AUTHORIZATION=NONE
```

最终结论：

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

---

## 5. 接受边界

`REVIEW_PASS` 只表示 C5 可以作为 C6 候选内容编写基线，不表示：

- 食品营养、精确保质期、配餐或自动补货已经实现；
- 药品剂量、治疗概率、伤病或自动诊疗系统已经冻结；
- 工具效率、通信距离、照明强度或终端容量已经冻结；
- 候选数据已经接入运行时、UI 或存档；
- Gate 1A、Gate 1H 或 Gate 2 状态改变。
