# 人物生成器 V0.1 候选实现

**状态：** `TECHNICAL_SPIKE_BEFORE_A1 / CANDIDATE_NOT_FROZEN / IMPLEMENTED_MACHINE_CONTRACTS_PASS / MANUAL_REVIEW_NOT_RUN`
**对应规则：** `character-generation-rules-v0.1.md` V0.1-r8
**实现位置：** `prototype/src/characters/`
**生成数据：** `data/characters/generated-50-v0.1-candidate.json`

## 目标

本实现验证“候选人物内容生成”技术链路：

```text
固定 world seed + 人物 index
  → 稳定人物 seed 与 ID
  → 姓名、年龄、出身
  → 时间顺序履历
  → 属性、技能与资格来源
  → MBTI、特质、价值、红线
  → 动机、关系钩子、长期请求
  → 独立单人合同和 50 人批次校验
  → 可重放 JSON 与 Markdown roster
```

这不是规则阶段 B 的正式 50 人库，也不是阶段 C 的完整生成器。阶段 A1 的 12 人
样板、MBTI 专项验证和人工审查尚未完成；两月加入、紧急补员、替代链、关系
reducer、NPC dormant store 和开局四人选择器仍按规则阶段 C 单独实现。

## 公共接口

`prototype/src/characters/generator.ts` 提供：

- `deriveSeedV1(label, parts)`：实现规则 §12.3，并通过冻结 KAT；
- `generateCharacter({ worldSeedHex, characterIndex, attemptIndex? })`：生成单人；
- `validateCharacter(character)`：通过独立 `validator.ts` 接收任意反序列化数据，
  执行 M03–M07、M09，并复算履历阶段、资格 evidence、MBTI 派生类型、出身模板、
  seed variation selector、候选库 person seed 与人物 ID；1–3 个 `work` 节点
  均按各自登记模板逐节点重建结构化输出，技能经历按强度校验最低持续年限；
- `validateCharacterLibraryContent(characters)`：独立复算区分度指纹、引用和生活
  骨架，执行 M10 与候选库重复度门禁；
- `validateCharacterLibrary(library)`：接收任意反序列化 library，校验根 seed、
  版本、人物索引、library ID、聚合 envelope，并从人物数组独立重建完整权威
  finding 集合；library 根、content pack 与 `validation` 均拒绝未声明字段；
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

- character schema：`character-v0.1.4-candidate`；
- library schema：`character-library-v0.1.4-candidate`；
- generator schema：`char-gen-v0.1.4-candidate`；
- world seed：
  `9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1`；
- 50 名人物；
- Library ID：`character-library-e990760a870ff576`；
- JSON SHA256：
  `9f1bf2efb47fb944b494c851585a38547498a18f88415290664d9f67f559e09a`；
- roster SHA256：
  `d931089e38ec389c465aa70f769da773094437e3728ce2750ea689f50b0c242d`；
- 50 个稳定人物 ID、正式姓名与区分度指纹全部唯一；
- 50 个“成长—工作—当前动机”组合全部不同，每种重复工作连接至少两种成长背景
  和两种长期目标；
- 出身均由成长节点直接解释；跨地区出身只有在未来加入显式迁移节点后才允许；
- 核心价值观拥有稳定 ID，全部红线来源均可解引用；
- 16 种 MBTI 全覆盖，每型 3–4 人；
- 七项属性总和覆盖 34–38 五档，每档 10 人，单项当前落在 2–8；
- 同一 MBTI 内最高技能占比不超过 60%，未形成“人格类型＝职业”映射；
- 四种关系型内部称呼结构均未超过批次的 50%；
- M03–M07、M09、M10 和候选库生活骨架门禁通过；
- 五类履历模板的 ID、证据与结构化输出由 validator 从版本化内容包重建；
- `skill_experience` 的最低持续年限固定为 exposure=0、repeated=1、
  regular=2、major_duty=5、long_profession=10；节点年龄只记录整段履历，
  因此较长节点不会被强制升级为更高强度；
- library 根 seed/版本/人物索引与 ID 通过公开 validator 复算；保存的 308 条
  权威 finding 必须在 ID、顺序、数量、metadata、result 与 warning 上和复算
  结果完全一致；
- `SEED-KAT` 纳入权威聚合；当前生成器自重放诊断通过，但以
  `authoritative=false` 保存且不计入聚合；
- 聚合结果只表示当前已实现合同：
  `scope=TECHNICAL_CHARACTER_LIBRARY_IMPLEMENTED_CONTRACTS_ONLY`、
  `implemented_machine_contracts_status=passed`、
  `implemented_machine_contracts_passed=true`、`warned_ids=[]`、
  `not_run_ids=["M12"]`；
- 完整 `M12` 明确为 `not_run`：尚无 `GenerationContextSnapshot`、
  `generation_context_hash`、席位到 attempt 派生链和 32 次重试证据；
- E01–E06 均明确保存为 `not_run`。

完整权威机器证据保存在生成 JSON 的 `validation.findings` 中；无法由独立
validator 重建的当前生成器自重放只保存在顶层 `diagnostics`。

## 复算

```bash
cd prototype
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm ci
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run characters:generate
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:run -- tests/character-generator.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:run -- tests/character-validator.test.ts
```

连续两次执行 `characters:generate` 必须产生逐字节相同的 JSON 与 roster。
`character-validator.test.ts` 直接读取已落盘 JSON，不调用生成器，并通过字段删除、
伪造 prerequisite、履历阶段、MBTI、origin、seed provenance、模板 provenance、
聚合 envelope、缺失/残缺/重复 finding、分布伪造、warning 擦除、技能、资格
和 fingerprint 验证门禁负例；另覆盖 0/2/4/5/10/29 年 work 边界及 library
根、content pack、validation 的未知字段。当前候选批次已在
Node 20.20.2、22.23.1、24.18.0
以及 `LANG=C` / `zh_CN.UTF-8` 下复算为上述相同 SHA。

## 冻结边界

当前不得将候选库改为正式人物库，也不得称为阶段 B/C 完成，原因是：

1. 阶段 A1 的 12 名高完成度样板尚未冻结；
2. E01 文化命名审核尚未执行；
3. E02–E06 人工内容审核尚未执行；
4. 规则要求的 12 名样板人物 MBTI 专项玩家验证尚未执行；
5. 完整 M12、`PartyValidation`、人口事件状态机或 NPC 往返校验尚未实现。

下一步应把当前输出只当作选材池，从中重写并冻结 12 名不同能力与 MBTI 的
高完成度样板，逐人执行 E01–E06，修订内容包后再生成整批；阶段 A1 通过前，
不得把当前机器结果当作内容冻结。
