# 候选物品库 R1 基线独立审查报告

**日期：** 2026-07-27
**方式：** `claude-code-review` 外部只读审查 + Codex 证据复核
**基线 ID：** `new-era-2.item-library.r1-c7-candidate`
**累计内容：** 196 个库存物品 / 24 个非库存定义 / 220 个目录定义 / 90 个工艺 / 24 个转换流程
**最终裁定：** `P0=0 / P1=0 / P2=0 / REVIEW_PASS`
**运行时授权：** 无

## 1. 审查证据

外部原始输出 SHA-256：

`dbeed570e48a841bab0603f40cdaf9cb98a9ae2da21831f0950bc2f4075bd7fe`

审查覆盖候选库 README、完成态配额计划、R1 基线与消费合同、C1–C7 校验器、统一候选 bundle、C7 累计报告和 C7 内容审查报告。Claude Code 只读运行，没有修改文件。

## 2. 外部审查结论

```text
P0=0
P1=0
P2=0
REVIEW_PASS
```

确认：

- bundle 顶层状态为 `candidate_only`，运行时授权为 `NONE`；
- `default_runtime_import=deny`、`whole_bundle_import_allowed=false`；
- 未来消费必须按稳定 ID 显式选择，并另行取得运行时 schema 与 Gate 授权；
- payload 精确包含 196 个库存物品、24 个非库存定义、90 个工艺和 24 个转换流程；
- 合并后的物品—工艺、定义—转换流程引用闭合；
- 32 个合同与数据源路径存在，逐文件 SHA-256 与 bundle 清单一致；
- `payload_sha256` 可从规范化 payload 独立重算；
- 重复生成得到相同 bundle 文件；
- 普通 C7 校验会逐字比对报告与 bundle；
- `--write-bundle` 在非 C7 档位被拒绝；
- C1–C7 七档回归独立通过；
- 配额计划已经从陈旧 C3 状态更新为 C7 完成，并继续否认运行时完成；
- 文档路径、命令、基线 ID、上位设计 SHA 和字段名一致。

## 3. Codex 裁定

Codex 接受最终 `REVIEW_PASS`，并对两处外审概括作证据限缩：

1. `coverage-report.c7.md` 不包含 `baseline_id`；基线 ID 的权威位置是基线合同和 bundle。覆盖报告只负责累计结构、计数和配额。
2. “32 个源文件无遗漏”限缩为“合同列出的 32 个权威源文件全部存在且哈希匹配”。源集合是否完整由基线合同、分批合同和校验器清单共同定义，不能仅凭哈希匹配推断。

两处均不构成实现缺陷，也不需要修改生成物。

## 4. 完整性证据

```text
BUNDLE_INTEGRITY=PASS
SOURCE_FILE_COUNT=32
PAYLOAD_SHA256=02918459ef17e42ed5e2151660873f6a4e88e12dff29730a013f1d062fe554ad
BUNDLE_DETERMINISTIC_SHA256=32f9d9c41e7271e4da0f037167ad94023d050ee1b7471fdec98495393d9ff361
WRITE_BUNDLE_NON_C7_REJECT=PASS
README_LINK_TARGETS=PASS
```

累计计数：

```text
ITEM_COUNT=196
NON_INVENTORY_DEFINITION_COUNT=24
CATALOG_DEFINITION_COUNT=220
RECIPE_COUNT=90
TRANSITION_COUNT=24
RUNTIME_AUTHORIZATION=NONE
```

## 5. 最终回归

```text
PROFILE=c1 PASS
PROFILE=c2 PASS
PROFILE=c3 PASS
PROFILE=c4 PASS
PROFILE=c5 PASS
PROFILE=c6 PASS
PROFILE=c7 PASS
R1_SHA256=24f0d4f69322c78f6d52fd1504afa8ffbfe953b4557513bd3a3a77393af583eb
```

Ruby 语法、JSON 解析、payload 哈希、32 个源文件哈希、确定性重建、文档目标和作用域空白检查均通过。

## 6. 接受边界

本次 `REVIEW_PASS` 证明 R1 候选内容已经形成可重算、可检索、可供未来主干按稳定 ID 选取的只读基线。它不授权整包运行时导入，不冻结正式数值、UI、存档迁移或运行时能力，也不改变 Gate 1A、Gate 1H 或 Gate 2。
