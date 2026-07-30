import type { CharacterSampleLibrary } from './sample-library'

export function renderInternalCharacterSampleLibrary(
  sampleLibrary: CharacterSampleLibrary,
): string {
  const pairRows = sampleLibrary.samples.map(
    (sample) =>
      `| ${sample.sample_id} | ${sample.formal_name} | ${sample.internal_mbti_type} | ${sample.primary_skills.join(' / ')} | ${sample.first_impression} | ${sample.decision_scene.title} |`,
  )
  const profiles = sampleLibrary.samples
    .map(
      (sample) => `## ${sample.formal_name}

> 内部验证类型：\`${sample.internal_mbti_type}\`；玩家卡默认不显示四字母代码。来源：\`${sample.source_character_id}\`。

- **聚落称呼：** ${sample.address_rules.map((rule) => `${rule.relationship}=${rule.form}`).join('；')}
- **重写履历：** ${sample.revised_biography}
- **日常表现：** ${sample.ordinary_behavior}
- **压力表现：** ${sample.stress_behavior}
- **一句话：** “${sample.voice_line}”
- **可见请求：** ${sample.visible_request}
- **红线预告：** ${sample.redline_preview}
- **去掉 MBTI 后仍成立：** ${sample.identity_without_mbti}
- **同类型对照：** ${sample.same_type_contrast}

### 决策场景：${sample.decision_scene.title}

${sample.decision_scene.setup}

- 接受：${sample.decision_scene.accept_choice} ${sample.decision_scene.accept_consequence}
  - 即时代价：${sample.decision_scene.accept_immediate_cost}
  - 长期风险：${sample.decision_scene.accept_long_term_risk}
- 拒绝：${sample.decision_scene.decline_choice} ${sample.decision_scene.decline_consequence}
  - 即时代价：${sample.decision_scene.decline_immediate_cost}
  - 长期风险：${sample.decision_scene.decline_long_term_risk}

### 待验证问题

${sample.review_questions.map((question) => `- ${question}`).join('\n')}
`,
    )
    .join('\n')
    .trimEnd()

  return `# 12 人高完成度样板库 V0.1

> 状态：\`DRAFT_BEFORE_A1 / A1_INPUT_PREPARATION_ONLY\`。本包从已通过机器合同的 50 人候选池中选取六组同 MBTI 对照，重写为可测试人物卡；不是阶段 A1 通过，也不是正式人物库。
>
> Gate 1H 人物记忆度证据、文化命名 E01、E02–E06、MBTI 玩家验证均为 \`NOT_RUN\`。玩家卡默认隐藏 MBTI 四字母代码。

| 样板 | 正式姓名 | 内部 MBTI | 主要技能 | 第一印象 | 决策场景 |
|---|---|---|---|---|---|
${pairRows.join('\n')}

## 结构摘要

- Sample library ID：\`${sampleLibrary.sample_library_id}\`
- 来源候选库：\`${sampleLibrary.source_library_id}\`
- 样板人数：${sampleLibrary.samples.length}
- 对照类型：ISTJ、INTJ、ISFP、ENFP、ESFJ、ENTP，各 2 人
- 四维平衡：I/E、S/N、T/F、J/P 均为 6:6
- 技能覆盖：生产、工程、医疗、后勤、侦察、防卫、交涉、研究
- 机器结构校验：\`${sampleLibrary.validation.machine_structure_passed ? 'PASS' : 'BLOCKED'}\`
- 人工审核：E01–E06 与 MBTI 玩家验证均为 \`NOT_RUN\`

${profiles}
`
}

export function renderPlayerCharacterSampleCards(
  sampleLibrary: CharacterSampleLibrary,
): string {
  const profiles = sampleLibrary.samples
    .map(
      (sample) => `## ${sample.formal_name}

- **聚落称呼：** ${sample.address_rules.map((rule) => `${rule.relationship}=${rule.form}`).join('；')}
- **人物经历：** ${sample.revised_biography}
- **第一印象：** ${sample.first_impression}
- **日常表现：** ${sample.ordinary_behavior}
- **压力表现：** ${sample.stress_behavior}
- **一句话：** “${sample.voice_line}”
- **可见请求：** ${sample.visible_request}
- **红线预告：** ${sample.redline_preview}

### 决策场景：${sample.decision_scene.title}

${sample.decision_scene.setup}

- 方案一：${sample.decision_scene.accept_choice} ${sample.decision_scene.accept_consequence}
  - 即时代价：${sample.decision_scene.accept_immediate_cost}
  - 长期风险：${sample.decision_scene.accept_long_term_risk}
- 方案二：${sample.decision_scene.decline_choice} ${sample.decision_scene.decline_consequence}
  - 即时代价：${sample.decision_scene.decline_immediate_cost}
  - 长期风险：${sample.decision_scene.decline_long_term_risk}
`,
    )
    .join('\n')
    .trimEnd()

  return `# 12 人人物卡 V0.1（玩家隐藏版）

> 状态：\`DRAFT_BEFORE_A1 / PLAYER_VALIDATION_INPUT_ONLY\`。本文件只供后续玩家验证，不代表阶段 A1、E01–E06 或 Gate 1H 已通过。

${profiles}
`
}
