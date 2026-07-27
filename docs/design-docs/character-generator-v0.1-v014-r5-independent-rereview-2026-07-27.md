# 人物生成器 V0.1.4 R5 Codex 独立复审

**受审提交：** `6c3b9ba1ed76353ce63b88c2c37277808369c683`

**直接比较基线：** `3fe3c59b36c0a39b5ce5b201a3fbce65cf63d917`

**初始问题回归基线：** `97fa486db5b576dc58db4b68a36687cca2509ecd`

**审查方式：** 另一名全新上下文 Codex agent，只读审查，不使用 Claude Code

**结论：** `P0=0 / P1=0 / P2=0 / P3=0 / REVIEW_PASS`

## 命令证据

- `npm run test:run`：9 files / 97 tests 通过；
- `npm run lint`：通过；
- `npm run build`：通过；
- 连续两次 `npm run characters:generate`：输出逐字节稳定；
- 独立绕过探针：`vite-node /private/tmp/new-era-v014-r5-audit.mts`；
- 审查结束时工作树 clean，reviewer 未修改、提交或推送仓库。

## 持续时间—技能经历

- 最低年限映射为 exposure=0、repeated=1、regular=2、major_duty=5、
  long_profession=10；
- 0/2/4 年 `+6 major_duty` 均 blocked；
- 5/10/29 年均 passed；
- 所有 work 节点均独立重建模板输出；
- 仓库合法双 work 测试通过；
- reviewer 独立构造持续 `5,5,19` 年的合法三 work 人物，全部人物 finding
  均无 blocked；
- 整数年龄粒度处理保持诚实：repeated 保守要求至少 1 个整数年；较长履历节点
  只证明责任持续时间下限，不会自动把 +6 升为 +8。

## 闭合 schema

以下额外字段均被独立探针阻断：

- library 根 `release_status`；
- `content_pack_versions.extra`；
- `diagnostics.extra`；
- `diagnostics.current_generator_replay.extra`；
- `validation.machine_passed`；
- `validation.release_status`；
- `manual_reviews.extra`；
- `findings[0].extra`。

将 replay diagnostic 改为 `result=blocked` 不影响权威 aggregate；该对象仍固定
`authoritative=false`，符合其非权威边界。

## 聚合与 artifact

- 保存 finding：308；独立复算：308；完整数组逐字段、逐顺序一致；
- M03–M07、M09 各 50 条；其余 8 个 ID 各 1 条；
- 307 条 `passed`，唯一 M12 为 `not_run`；
- 固定库 `warned_ids=[]`、`not_run_ids=["M12"]`；
- 单人库得到 `passed_with_warnings`、
  `implemented_machine_contracts_passed=false`、
  `warned_ids=["DIST-ADDRESS"]`；协调擦除 warning 会被阻断；
- JSON SHA256：
  `9f1bf2efb47fb944b494c851585a38547498a18f88415290664d9f67f559e09a`；
- roster SHA256：
  `d931089e38ec389c465aa70f769da773094437e3728ce2750ea689f50b0c242d`。

## 仍开放的门禁

- 完整 M12：`NOT_RUN`；
- E01–E06：全部 `NOT_RUN`；
- 文化命名包：draft，未审核；
- A1 的 12 名高完成度样板、人工区分度和 MBTI 玩家验证：未完成；
- PartyValidation、人口状态机、NPC 完整—简化往返等阶段 C 合同：未实现。

本次 `REVIEW_PASS` 仅代表受审提交的代码复审通过，不代表人物内容冻结、阶段
A1/B/C、运行时发布或玩家测试门禁通过。
