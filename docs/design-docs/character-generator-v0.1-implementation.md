# 人物生成器 V0.1 候选实现

**状态：** `CANDIDATE / MACHINE_PASS / MANUAL_REVIEW_NOT_RUN`
**对应规则：** `character-generation-rules-v0.1.md` V0.1-r8
**实现位置：** `prototype/src/characters/`
**生成数据：** `data/characters/generated-50-v0.1-candidate.json`

## 目标

本实现先闭合“完整人物内容生成”最小链路：

```text
固定 world seed + 人物 index
  → 稳定人物 seed 与 ID
  → 姓名、年龄、出身
  → 时间顺序履历
  → 属性、技能与资格来源
  → MBTI、特质、价值、红线
  → 动机、关系钩子、长期请求
  → 单人和 50 人批次机器校验
  → 可重放 JSON 与 Markdown roster
```

这不是完整人口运行时。两月加入、紧急补员、替代链、关系 reducer、NPC dormant
store 和开局四人选择器仍按规则阶段 C 单独实现。

## 公共接口

`prototype/src/characters/generator.ts` 提供：

- `deriveSeedV1(label, parts)`：实现规则 §12.3，并通过冻结 KAT；
- `generateCharacter({ worldSeedHex, characterIndex, attemptIndex? })`：生成单人；
- `validateCharacter(character)`：执行 M03–M07、M09；
- `generateCharacterLibrary({ worldSeedHex, count })`：生成并校验批次；
- `validatePopulationLimit(type, count)`：执行玩家 10 / NPC 15 人 M01 上限。

生成器不调用 `Math.random()`，不根据 MBTI 修改属性或技能，不生成外号、旧代号或
全局呼号字段。

## 内容包

候选内容包位于 `prototype/src/characters/content.ts`，当前包含：

- 30 个姓氏、50 个名字；
- 8 个成长环境；
- 12 个教育与资格节点；
- 16 个长期工作经历；
- 12 个转折与机器可读红线；
- 16 个当前动机与长期目标；
- 8 种压力应对表达；
- 5 个聚落归属候选。

这些都是 `candidate` 内容。文化包版本为 `cn-frontier-draft-v0.1`，尚未完成 E01
命名审核。

## 固定批次

首个固定批次：

- world seed：
  `9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1`；
- 50 名人物；
- Library ID：`character-library-1436b281554198cc`；
- 50 个稳定人物 ID、正式姓名与区分度指纹全部唯一；
- 16 种 MBTI 全覆盖，每型 3–4 人；
- 七项属性总和覆盖 34–38 五档，每档 10 人，单项当前落在 2–8；
- 同一 MBTI 内最高技能占比不超过 60%，未形成“人格类型＝职业”映射；
- 四种关系型内部称呼结构均未超过批次的 50%；
- M03–M07、M09、M10、M12 全部通过；
- E01–E06 均明确保存为 `not_run`。

完整机器证据保存在生成 JSON 的 `validation.findings` 中。

## 复算

```bash
cd prototype
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm ci
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run characters:generate
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:run -- tests/character-generator.test.ts
```

连续两次执行 `characters:generate` 必须产生逐字节相同的 JSON 与 roster。

## 冻结边界

当前不得将候选库改为正式人物库，原因是：

1. E01 文化命名审核尚未执行；
2. E02–E06 人工内容审核尚未执行；
3. 规则要求的 12 名样板人物 MBTI 专项玩家验证尚未执行；
4. 本实现未包含 `PartyValidation`、人口事件状态机或 NPC 往返校验。

下一步应从 50 人中选出 12 名不同能力与 MBTI 的样板，逐人执行 E01–E06，
修订内容包后再重生整批，而不是直接把机器 PASS 当作内容冻结。
