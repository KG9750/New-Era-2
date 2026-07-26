# 人物生成器 V0.1 独立审查逐项整改

**审查基线：** `0aa2608dc8b90f36dacdf74fdea26fba82c5d242`
**整改状态：** `CODE_FIXED / HUMAN_GATES_OPEN / INDEPENDENT_REREVIEW_NOT_RUN`

## P1-1：机器门禁 false negative

状态：`CODE_FIXED`

- 新增独立 `prototype/src/characters/validator.ts`，不依赖 generator；
- `validateCharacter()` 接收任意反序列化数据并安全阻断结构缺失；
- M04 校验更早 prerequisite 与出身桥接；
- M05 校验 seed variation ID、人物 seed、算法、适用条件和净修正；
- M06 独立复算技能及 `primary_skills`；
- M07 精确比较资格 ID、rank、source 和训练/实践节点；
- M10 从人物内容复算 fingerprint，不信任保存值；
- `character-validator.test.ts` 直接读取落盘 JSON，覆盖字段删除、悬空引用、
  prerequisite、origin、seed provenance、技能、资格和 fingerprint 变异。

## P1-2：完整 M12 被误报为通过

状态：`FIXED`

- 冻结 KAT 单列为 `SEED-KAT=passed`；
- 当前候选库重放单列为 `LIBRARY-REPLAY-PARTIAL=passed`；
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

## 版本与验证

- character schema：`character-v0.1.1-candidate`
- generator schema：`char-gen-v0.1.1-candidate`
- Library ID：`character-library-589f6edb461c1d03`
- JSON SHA256：
  `41da217dddba1385dbb9f22fd5fca05637f2ff465ca4607f8166ffc825b5dba3`
- roster SHA256：
  `fad123efe5c94e5f1e0d80acea75fe5699409baa74a454e700ad7c6e33d7b40d`
- Vitest：9 files / 68 tests
- TypeScript：通过
- Vite production build：通过
- Node 20.20.2 / 22.23.1 / 24.18.0 与 `LANG=C` / `zh_CN.UTF-8`：
  输出 SHA 一致

以上结果只证明本轮代码和候选数据整改，不替代 E01–E06 或后续独立复审。
