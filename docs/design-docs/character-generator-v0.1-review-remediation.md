# 人物生成器 V0.1 独立审查逐项整改

**审查基线：** `0aa2608dc8b90f36dacdf74fdea26fba82c5d242`
**首次整改提交：** `a7c3f09132915587b502c0598d1e21b7b7190ed3`
**首次整改复审：** `P0=0 / P1=2 / P2=1 / REVIEW_FAIL`
**当前整改状态：** `R4_CODE_FIXED_PENDING_REREVIEW / HUMAN_GATES_OPEN`

## P1-1：机器门禁 false negative

状态：`R2_CODE_FIXED_PENDING_REREVIEW`

- 新增独立 `prototype/src/characters/validator.ts`，不依赖 generator；
- `validateCharacter()` 接收任意反序列化数据并安全阻断结构缺失；
- M03 校验固定阶段顺序：成长、教育、1–3 个工作节点、转折、当前动机；
- M04 校验更早 prerequisite，并从受版本控制的成长模板反查出身；
- M05 校验 seed variation ID、人物 seed、算法、适用条件、唯一属性对和净修正；
- M06 独立复算技能及 `primary_skills`；
- M07 精确比较资格 ID、rank、source、evidence 和训练/实践节点；
- M09 从四维 pole 独立派生 MBTI type 后核对保存值；
- M10 从人物内容复算 fingerprint，不信任保存值；
- `character-validator.test.ts` 直接读取落盘 JSON，覆盖字段删除、悬空引用、
  prerequisite、origin、seed provenance、技能、资格、MBTI 和 fingerprint 变异。

## P1-2：完整 M12 被误报为通过

状态：`FIXED`

- 冻结 KAT 单列为 `SEED-KAT=passed`；
- 当前候选库自重放只保留为非权威 diagnostics，不再计入机器合同聚合；
- 完整 `M12=not_run`；
- 未实现项明确记录为 `GenerationContextSnapshot`、`generation_context_hash`、
  席位到 attempt 派生链和重试证据。

## P2-1：50 人只有 16 个固定生活骨架

状态：`MACHINE_DUPLICATION_FIXED / E06_OPEN`

- 50 人现有 50 个不同的成长—工作—当前动机组合；
- 同一种工作分别连接 3–4 种成长背景和 3–4 种长期目标；
- 新增 `DIST-LIFE-HISTORY` 与 `DIST-MBTI-CONTENT`；
- E06 叙事区分度仍为 `not_run`，机器组合不同不等于人工人物感通过。

## P2-2：出身桥接与价值来源断裂

状态：`FIXED`

- 当前无迁移节点的人物统一令 `origin` 由成长节点直接解释；
- validator 阻断无迁移桥接的异地出身；
- `core_values` 改为带稳定 `value_id` 和 `source_ids` 的记录；
- 红线只引用真实履历节点和价值记录；
- 当前 50 人 `origin` 断裂为 0，悬空红线来源为 0。

## P2-3：越过阶段 A1

状态：`BOUNDARY_FIXED / A1_OPEN`

- JSON 新增 `development_stage=TECHNICAL_SPIKE_BEFORE_A1`；
- CONTEXT、实现说明、README 和 roster 均明确不代表阶段 B/C 完成；
- 完整 M12、PartyValidation、人口状态机与 NPC 往返不在本轮实现；
- 下一步仍需重写并冻结 12 名高完成度样板，执行 E01–E06 和 MBTI 玩家验证。

## 首次整改复审新增 P1-1：派生字段合同漏检

状态：`R2_CODE_FIXED_PENDING_REREVIEW`

- 顶层资格 evidence 必须非空，并与来源节点资格 evidence 逐字一致；
- 当前 schema 明确限制为成长、教育、1–3 段工作、转折、当前动机的阶段序列；
- MBTI `type` 必须等于四维 pole 直接派生结果；
- 三类独立 persisted-JSON mutation 已加入仓库测试。

## 首次整改复审新增 P1-2：provenance 只验证自洽

状态：`R2_CODE_FIXED_PENDING_REREVIEW / FULL_M12_OPEN`

- 当前内容包没有正式迁移模板，因此自由 `migration` 标签不再构成迁移证据；
- origin 必须与受版本控制的 growth 模板 context 一致；
- seed variation 的唯一正负属性对由履历修正前属性重新计算；
- 单人人物新增 `library_generation_evidence`，保存 world seed、人物 index、生成器、
  内容包和文化包版本；
- validator 从上述证据独立重算 `person_seed` 与 `character_id`；
- 完整席位、周期、attempt 与上下文 hash 仍属于 M12，保持 `not_run`。

## 首次整改复审新增 P2-1：无作用域 machine pass

状态：`R2_CODE_FIXED_PENDING_REREVIEW`

- 删除无作用域的 `validation.machine_passed`；
- 改为 `implemented_machine_contracts_passed`；
- 固定 scope 为
  `TECHNICAL_CHARACTER_LIBRARY_IMPLEMENTED_CONTRACTS_ONLY`；
- 显式保存 `not_run_ids=["M12"]`；
- 人物级状态改名为 `implemented_character_contracts`，不再暗示完整发布门禁通过。

## 首次整改复审未验证风险：fingerprint 共用 helper

状态：`REGRESSION_EVIDENCE_ADDED`

- 增加不调用 fingerprint helper 的固定已知答案测试；
- 增加两人复制完整 M10 语义投影并伪造不同保存值的阻断测试。

## 再次独立复审 P1：内容模板 provenance 可协调伪造

状态：`R3_CODE_FIXED_PENDING_REREVIEW`

- 五类履历节点的 `template_id` 必须属于当前版本化内容包；
- validator 从模板重建 evidence、属性修正、技能经历、资格、性格、关系、价值、
  红线和当前动机结构，不再只比较人物 JSON 内可同步改写的两份数据；
- 顶层资格 ID/evidence 由 `EDUCATION_TEMPLATES` 和 rank 规则重建；
- 新增协调改写资格 evidence、未登记模板、合法成长模板 ID 搭配伪造输出等反例。

## 再次独立复审 P1：人物证据未绑定 library envelope

状态：`R3_CODE_FIXED_PENDING_REREVIEW`

- 新增公开 `validateCharacterLibrary(unknown)`，畸形 JSON 安全返回 blocked；
- 每名人物的 world seed、index、生成器/内容/文化版本必须与 library 根一致；
- library ID 从根 seed、人物数和版本重新计算；
- 人物自报另一套 seed/index 并协调重算人物 ID、person seed 时仍被根绑定阻断。

## 再次独立复审 P2：保存的聚合门禁缺少 full-library validator

状态：`R3_CODE_FIXED_PENDING_REREVIEW`

- 固定 scope、`not_run_ids=["M12"]`、唯一 `M12=not_run` 和 E01–E06 `not_run`；
- 保存的 M03–M07、M09、M10 finding 与独立复算结果逐项对齐；
- 协调伪造 scope、M12、人工审核或 finding evidence 会返回
  `LIBRARY-ENVELOPE=blocked`。

## 再次独立复审 P3：warned 被计为完整通过

状态：`R3_CODE_FIXED_PENDING_REREVIEW`

- 新增 `implemented_machine_contracts_status` 三态：
  `passed / passed_with_warnings / blocked`；
- `implemented_machine_contracts_passed` 只在无 warning、无 blocked 时为 true；
- 新增 `warned_ids`；单人库的 `DIST-ADDRESS=warned` 回归用例固定返回
  `passed_with_warnings` 和 `implemented_machine_contracts_passed=false`。

## 新一轮独立复审 P1：只校验第一段工作履历

状态：`R4_CODE_FIXED_PENDING_REREVIEW`

- 权威规则允许 1–3 段工作或生活经历，schema 未收紧为单段；
- validator 改为遍历全部 `work` 节点，逐节点按各自 `WORK_TEMPLATES`
  重建 context、属性修正、技能经历、资格、性格、关系和经历钩子；
- 第一段工作继续承担当前生成器定义的 profile extra modifier、rank-2
  qualification 和顶层特质/关系绑定；后续工作只使用模板基础输出，不凭空授予
  当前内容包未定义的资格；
- 新增第二段伪造反例、合法双工作完整人物正例和第三段伪造反例。

## 新一轮独立复审 P1：聚合 envelope 未覆盖全部 finding

状态：`R4_CODE_FIXED_PENDING_REREVIEW`

- `recomputeCharacterLibraryFindings()` 从人物数组独立重建全部权威 finding；
- 50 人批次固定为 308 条：每人 M03–M07、M09 共 300 条，加 M10、
  `DIST-LIFE-HISTORY`、`SEED-KAT`、M12 和四项 `DIST-*` 共 8 条；
- 保存集合必须在顺序、ID、数量、multiplicity、完整 metadata、evidence 和
  result 上与复算结果完全一致；aggregate 三态、`warned_ids` 与
  `not_run_ids` 也只从复算结果推导；
- 无法由独立 validator 复算的当前生成器自重放从 `validation.findings` 移到
  `diagnostics.current_generator_replay`，固定 `authoritative=false`；
- 新增缺失 finding、残缺 metadata、重复 finding、协调伪造 MBTI 分布和擦除
  warning 的回归反例。

## 版本与验证

- character schema：`character-v0.1.4-candidate`
- library schema：`character-library-v0.1.4-candidate`
- generator schema：`char-gen-v0.1.4-candidate`
- Library ID：`character-library-e990760a870ff576`
- JSON SHA256：
  `06b9248e66e0ffa7efc8fc76c8afedc55538060d71ed2a87941e0df981a7194f`
- roster SHA256：
  `d931089e38ec389c465aa70f769da773094437e3728ce2750ea689f50b0c242d`
- Vitest：9 files / 95 tests
- TypeScript：通过
- Vite production build：通过
- Node 20.20.2 / 22.23.1 / 24.18.0 与 `LANG=C` / `zh_CN.UTF-8`：
  JSON 与 roster 输出 SHA 全部一致

以上结果只证明本轮代码和候选数据整改，不替代 E01–E06 或后续独立复审。
