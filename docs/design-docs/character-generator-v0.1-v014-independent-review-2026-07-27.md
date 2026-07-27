# 人物生成器 V0.1.4 Codex 独立复审

**受审提交：** `3fe3c59b36c0a39b5ce5b201a3fbce65cf63d917`

**比较基线：** `97fa486db5b576dc58db4b68a36687cca2509ecd`

**审查方式：** 全新上下文 Codex agent，只读审查，不使用 Claude Code

**结论：** `P0=0 / P1=2 / P2=0 / P3=0 / REVIEW_FAIL`

## 可复现证据

- `npm run test:run`：9 files / 95 tests 通过；
- `npm run lint`：通过；
- `npm run build`：通过；
- 连续两次生成的 JSON 与 roster 逐字节一致；
- JSON SHA256：
  `06b9248e66e0ffa7efc8fc76c8afedc55538060d71ed2a87941e0df981a7194f`；
- roster SHA256：
  `d931089e38ec389c465aa70f769da773094437e3728ce2750ea689f50b0c242d`；
- 固定库为 50 人、308 条权威 finding：M03–M07、M09 各 50 条，其余
  8 条各 1 条；其中 307 条 `passed`、唯一 M12 为 `not_run`；
- `warned_ids=[]`、`not_run_ids=["M12"]`，E01–E06 均为 `not_run`；
- 当前生成器自重放位于 `diagnostics.current_generator_replay`，并明确
  `authoritative=false`。

## P1-1：零时长 work 可领取完整技能经历

### 复现

1. 复制第 1 人的首个 work 作为第二节点；
2. 令新节点 `age_start=age_end=第一段结束年龄`；
3. 保留登记模板的属性、`+6 major_duty`、`+4 regular`、性格、关系和 hook；
4. 清空后续节点资格，并同步重算 attributes、skills、primary skills、
   seeded variation 和 summary；
5. 调用 `validateCharacter()`。

实际结果：全部人物 finding 通过。

### 影响

原整改已能逐节点重建第二、第三个 work 的模板输出，但未把技能点与持续时间绑定。
零游戏年节点仍可叠加属性和 10 点技能经历，不符合规则 §10.2.2 的持续时间—
责任强度合同。

### 修复要求

- 对 `skill_experience` 建立版本化的最低持续时间派生；
- 至少覆盖 0、2、4、5、10 和大于 10 年边界；
- 合法双/三 work 测试不得再使用零时长节点。

## P1-2：validation 可夹带未声明的权威通过字段

### 复现

在所有合法字段保持不变时加入：

```text
library.validation.machine_passed = true
library.validation.release_status = "ALL_GATES_PASSED"
```

实际结果：`validateCharacterLibrary()` 没有返回 blocked。

### 影响

308 条 finding、顺序、metadata、multiplicity、aggregate 三态、warning 与
not-run 的复算本身正确，但开放式 `validation` 对象仍允许旧式或更宽作用域的
权威字段混入。下游若优先读取这些字段，可能绕过已收紧的 envelope。

### 修复要求

- library 根、`content_pack_versions` 与 `validation` 使用闭合 schema；
- 未声明字段一律阻断，不维护危险字段黑名单；
- 加入额外 `machine_passed`、`release_status` 和未知根字段反例。

## 已确认关闭

- 1–3 个 work 的模板 ID、evidence、context、属性、技能、资格、性格、关系和
  hook 已逐节点重建；
- 权威 findings 已按完整数组深比较，缺失、重复、乱序、残缺 metadata、
  result 伪造和 warning 擦除均会阻断；
- aggregate 三态、`warned_ids` 与 `not_run_ids` 由复算结果推导；
- 不可独立复算的当前生成器自重放已退出权威 envelope。

## 保持开放的门禁

- 完整 M12：`NOT_RUN`；
- E01–E06：全部 `NOT_RUN`；
- 文化命名包：draft，未审核；
- A1 的 12 名高完成度样板与 MBTI 玩家验证：未完成；
- PartyValidation、人口状态机、NPC 完整—简化往返：未实现。

本轮不能宣称通过；只有修复两个 P1 并在新稳定提交上再次独立复审后，才能更新
代码复审结论。
