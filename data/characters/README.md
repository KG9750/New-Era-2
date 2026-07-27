# 人物候选库数据

`generated-50-v0.1-candidate.json` 是人物生成规则 V0.1-r8 的技术 spike，
`development_stage=TECHNICAL_SPIKE_BEFORE_A1`。它用于验证确定性、独立结构
合同和批次组合，不是阶段 B 的正式人物库，也不是阶段 C 的完整生成器。便于
人工浏览的摘要表见 `character-roster-50-v0.1-candidate.md`。

## 生成

```bash
cd prototype
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm ci
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run characters:generate
```

固定输入：

- 人数：50；
- world seed：
  `9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1`；
- character schema：`character-v0.1.4-candidate`；
- library schema：`character-library-v0.1.4-candidate`；
- generator schema：`char-gen-v0.1.4-candidate`；
- culture pack：`cn-frontier-draft-v0.1`。

相同版本和输入必须逐字节生成相同 JSON。

## 已实现范围

- 单人人物固定种子生成；
- 正式姓名与关系型内部称呼规则；
- 时间顺序履历及属性、技能、资格来源；
- 技能经历按强度校验最低持续时间，零时长或过短 work 不能领取多年熟练度；
- 七项属性、八项技能；
- MBTI 四维倾向、强度和自然语言偏好；
- 特质、压力反应、核心价值、机器可读红线；
- 当前动机、关系钩子和长期请求；
- 独立 validator 执行 M03–M07、M09、M10 和生活骨架重复度校验，1–3 个
  `work` 节点会逐节点从登记模板重建全部结构化输出；
- 单人人物保存候选库生成证据，validator 可重算人物 seed、ID、属性修正选择、
  MBTI 派生类型和资格 evidence；
- `validateCharacterLibrary()` 校验 library 根 seed/版本/人物索引绑定，重算
  library ID，并从人物数组独立重建全部 308 条权威 finding；保存集合的 ID、
  顺序、数量、metadata、result、warning 与复算结果必须逐项一致；
- library 根、content pack 与 `validation` 使用闭合字段集合，未声明的权威
  状态字段会被阻断；
- 五类履历模板的 ID、证据与结构化输出均从版本化内容包重建，资格 ID/evidence
  由教育模板决定；
- 聚合结果使用 `passed / passed_with_warnings / blocked` 三态，并显式保存
  `warned_ids`；
- `SEED-KAT` 纳入权威聚合；当前生成器自重放只保存在
  `diagnostics.current_generator_replay`，明确 `authoritative=false`，不计入聚合；
- 玩家聚落 10 人、NPC 聚落 15 人静态人口上限校验。

## 尚未完成

- `E01` 文化命名审核；
- `E02`–`E06` 人工内容审核；
- 12 名样板人物的 MBTI 玩家验证；
- 开局四人 `PartyValidation` 与选择器；
- 两月加入、紧急补员、替代链和人口事件状态机；
- NPC dormant character store、关系 reducer 和简化模拟往返。
- 完整 M12 所需的 `GenerationContextSnapshot`、上下文 hash、席位到 attempt
  派生链和重试证据。

因此 JSON 状态固定为 `CANDIDATE_NOT_FROZEN`，阶段固定为
`TECHNICAL_SPIKE_BEFORE_A1`。聚合机器结果仅覆盖
`TECHNICAL_CHARACTER_LIBRARY_IMPLEMENTED_CONTRACTS_ONLY`，完整 `M12` 由
`not_run_ids` 明示未运行，人工审核字段固定为 `not_run`。当前 50 人批次的
`implemented_machine_contracts_status=passed`、`warned_ids=[]`；这仍不包含
完整 M12 或人工审核。
