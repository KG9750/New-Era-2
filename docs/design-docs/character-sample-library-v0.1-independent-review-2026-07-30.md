# 12 人样板库 V0.1 独立 Codex 深刺报告

**受审提交：** `1360dd1243640b998ab8056728d64deae63ed1d0`

**比较基线：** `df5fc12f1ef0a18d740d37f6190a4bf3d003db31`

**审查方式：** 全新上下文 Codex agent，只读深度审查；未使用 Claude Code 或
任何外部 LLM

**结论：** `P0=0 / P1=4 / P2=3 / P3=0 / REVIEW_FAIL`

## 审查标准

以人物规则 §6.4–6.5、§18、§20 和
`character-sample-library-v0.1.md` 为合同：

- validator 对任意反序列化输入必须 fail-closed；
- 结构机器 PASS 不得冒充内容、玩家或阶段 A1 PASS；
- 玩家隐藏版不得泄露 MBTI 四字母代码；
- 12 人样板必须能够验证“同类型不同人物”，而不是把技能或道德答案映射到
  MBTI；
- Gate 1H、E01–E06、MBTI 玩家验证和阶段 A1 必须保持开放。

## 命令与独立证据

- 固定 SHA 与审查结束时工作树 clean；
- Node 24.18.0：
  - `npm run test:run`：10 files / 106 tests PASS；
  - `npm run lint`：PASS；
  - `npm run build`：PASS；
- `git diff --check df5fc12..1360dd1`：PASS；
- 固定产物：
  - JSON SHA-256：
    `cfa23a0a48dc0d93c5b7859d8809f66b4b6957f2236db76062292370dda221fa`；
  - Markdown SHA-256：
    `1ca455112e16c39045145d63a8b17c2395a364d8ad598254f7366644b9627753`；
- 从固定 SHA 的独立 `git archive` 在 `LANG=C` 和
  `LANG=zh_CN.UTF-8` 下重生，两种产物 SHA 均一致；
- 独立复算确认：12 个唯一来源、六种 MBTI 各 2 人、四维均 6:6、八项技能
  确实覆盖，实际产物无 nickname / alias / callsign / old_code 字段；
- 独立 `/private/tmp` 变异探针确认：
  - `reveal_mbti_policy`、`duplicate_sample_id`、`wrong_sample_schema`、
    `wrong_library_id`、`wrong_culture_pack`、`wrong_purpose`、
    `lying_gate_note`、`self_counterparts` 均仍得到 8/8 passed；
  - 未声明嵌套字段能正确 blocked；
  - 非字符串问题、null scene、null biography 会抛 TypeError；
  - 协调篡改 source snapshot 与 sample 可使样板 validator 8/8 passed，
    同时 `validateCharacterLibrary(forgedSource)` 已明确 blocked。

## P1 Findings

### P1-1：闭合 schema 只闭合键集合，关键值仍可伪造

**证据位置：**

- `prototype/src/characters/sample-library.ts:643`
- `prototype/src/characters/sample-library.ts:677`
- `prototype/src/characters/sample-library.ts:714`
- `prototype/src/characters/sample-library.ts:799`
- `prototype/src/characters/sample-library.ts:985`

**已复现：**

- 把 `mbti_display_policy` 改成 `SHOW_IN_PLAYER_CARD` 仍 8/8 passed；
- 重复 `sample_id`、错误 sample schema、错误 library ID、culture pack、
  purpose 或 gate note 均不阻断；
- 一组双方把 counterpart 指向自己，S03 仍通过；
- 协调篡改传入 source library 与 sample，可令样板 validator 全绿。

**根因：**

- `hasExactKeys` 只校验字段名；
- 未逐字段校验 enum、固定值、类型、ID 与数组位序；
- pair 没有要求 counterpart 与本人不同；
- sample validator 没有先验证 source library。

**影响：**

S01、S03、S07 的 predicate 超过实际可证明范围，落盘 artifact 可在破坏隐藏
MBTI、配对或门禁合同时继续宣称机器全绿。

**最小修复：**

1. 对所有声明字段执行 runtime type 与 exact enum/value 校验；
2. 强制 `sample_01`–`sample_12` 唯一并绑定数组位序；
3. 重算 sample library ID 并绑定文化包；
4. pair 必须是不同 source、双向互指、canonical pair ID/type；
5. 先验证 source library，source blocked 时样板库整体 blocked；
6. 为每个独立 probe 添加回归负例。

### P1-2：唯一阅读版直接泄露 MBTI，不存在真正的隐藏玩家包

**证据位置：**

- `prototype/scripts/generate-character-sample-library.ts:42`
- `prototype/tests/character-sample-library.test.ts:73`
- `data/characters/character-samples-12-v0.1-draft.md:7`
- `docs/design-docs/character-sample-library-v0.1.md:71`

脚本总表直接渲染 `internal_mbti_type`，逐人 profile 又显示“内部验证类型”；
测试只断言 JSON policy 字符串，没有验证玩家可见 artifact。

**影响：**

按当前阅读版执行“隐藏代码”第一轮会直接污染人物记忆度、职业推断与道德推断
数据。

**最小修复：**

- 拆分 `internal-review` 与 `player-card-hidden` 两个 renderer/artifact；
- 玩家版不得包含 MBTI 列、internal type 或明示同类型句；
- CI 扫描玩家版全部 16 型代码并做固定输出比较。

### P1-3：E/I 与技能大类绑定，MBTI 验证存在混杂变量

**证据位置：**

- `docs/design-docs/character-sample-library-v0.1.md:39`
- `data/characters/character-samples-12-v0.1-draft.md:9`
- `docs/design-docs/character-generation-rules-v0.1.md:282`

独立复算：

- 6 名 E 的主要技能并集只有工程、后勤、侦察、交涉；
- 6 名 I 的主要技能并集为医疗、生产、研究、防卫、后勤、侦察；
- 工程与交涉只在 E，医疗、生产、研究、防卫只在 I；
- 两极实际重叠主要是侦察与一次次要后勤。

**影响：**

玩家可从样板真实分布推断 “E=工程/后勤/交涉、I=医疗/研究/生产/防卫”；
测试无法区分刻板印象来自 MBTI 还是选样矩阵。

**最小修复：**

- 重选 3–4 人，让主要技能跨 E/I；
- 至少对工程、交涉、医疗、研究、防卫建立明确交叉；
- 新增 MBTI pole × skill contingency 报告，不只校验边际覆盖。

### P1-4：10/12 场景是“接受正确答案，拒绝直接触发红线”

**证据位置：**

- `data/characters/character-samples-12-v0.1-draft.md:74`
- `data/characters/character-samples-12-v0.1-draft.md:128`
- `data/characters/character-samples-12-v0.1-draft.md:155`
- `data/characters/character-samples-12-v0.1-draft.md:182`
- `data/characters/character-samples-12-v0.1-draft.md:209`
- `data/characters/character-samples-12-v0.1-draft.md:236`
- `data/characters/character-samples-12-v0.1-draft.md:263`
- `data/characters/character-samples-12-v0.1-draft.md:290`
- `data/characters/character-samples-12-v0.1-draft.md:317`
- `data/characters/character-samples-12-v0.1-draft.md:344`

玩家卡预先披露红线后，10 个 decline 正好违反该红线；接受通常同时是安全、
守信和保护弱者的方案，拒绝则伴随退队、停工或追责。

**影响：**

场景主要测量玩家是否愿意做明显恶事，而不是人物判断顺序、同类型差异或两个
可辩护方案之间的取舍；12 人会呈现为同一“程序正义角色”换技能。

**最小修复：**

- 至少重写 6 个场景为两个均可辩护、代价确定的方案；
- 红线直触场景只保留少数专用样本；
- 两个选项各包含一项即时成本和一项长期风险。

## P2 Findings

### P2-1：重复度越过规则软警告阈值，S08 仍宣称均可区分

- 陶穗宁、白清和、蒋书衡 3/12 共享完全相同的价值与未成年债务红线，
  同一转折占比 25%，超过规则的 20% 软警告阈值；
- 乔书衡与沈知遥共享平民诱饵价值/红线；
- 顾远帆与乔书衡共享长期目标与 visible request；
- 内部熟称存在两个“远帆”和两个“书衡”。

建议增加 turn/value/redline/request/内部称呼重复统计与 warning，并至少替换
一名 debt-turn 样板。

### P2-2：validator 对合法 JSON 类型错误会抛异常

已复现：

- `review_questions[0]=42` 抛 `.trim` TypeError；
- `decision_scene=null` 抛 null/undefined 错误；
- `revised_biography=null` 抛 `.trim` TypeError。

建议先做逐层 runtime guard，再执行语义校验；所有 malformed JSON 均应返回
blocked finding 而非中断验证。

### P2-3：Markdown 没有 persisted rebuild / golden test

当前独立重生证明 Markdown 确定，但常规测试只比较 JSON。未来玩家版泄露字段、
顺序漂移或 renderer 变化仍可能全绿。

建议导出纯 renderer，对 internal 与 hidden 玩家版分别做逐字节 golden test。

## 已确认的正面事实

- 12 人、唯一来源、六组各 2、四维 6:6 与八技能覆盖均真实；
- 当前未篡改 artifact 的来源字段与候选库一致；
- 当前产物没有外号、alias、callsign 或 old_code；
- JSON 与 Markdown 当前可确定重生；
- 现有 test、lint、build 全部通过；
- 状态仍为 `DRAFT_BEFORE_A1 / A1_INPUT_PREPARATION_ONLY`；
- A1=`NOT_STARTED`，E01–E06、MBTI 玩家验证与 Gate 1H 均未执行；
- 完整 M12、PartyValidation、人口状态机和 NPC 往返仍开放。

## 修复选项

### 选项 A：最小修复

补齐 exact-value/type/pair/source 校验；生成真正 redacted 玩家包；重选 3–4 人
打破 E/I × 技能混杂；重写至少 6 个假两难；加入重复度 warning。

### 选项 B：结构修复

建立统一 runtime codec 与 canonical content digest，串联验证 source/sample；
internal 与 player renderer 均使用纯函数和 golden test；重新设计实验矩阵。

### 选项 C：降级使用

只把当前包保留为内部编剧草案，删除“可直接测试”“玩家卡隐藏”和八项机器
结构已证明可用性的强表述，Gate 1H 后再重做。

**刺儿头推荐：选项 A。** 四个 P1 均可在现有结构上局部修复，不需要推倒
生成器；但必须在任何玩家材料发出前完成。

## 评分与结论

- 代码：`5.5/10`
- 内容：`5.0/10`
- 总计：`P0=0 / P1=4 / P2=3 / P3=0`
- 结论：`REVIEW_FAIL`

只有修复全部 P1 并由新的独立 Codex reviewer 复审达到 P0=0、P1=0，才允许
代码审查结论变为 `REVIEW_PASS`。即使届时通过，Gate 1H、E01–E06、MBTI 玩家
验证、阶段 A1、完整 M12 和阶段 C 仍须保持开放，直到真实执行。
