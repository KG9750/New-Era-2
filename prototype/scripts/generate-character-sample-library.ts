import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateCharacterLibrary } from '../src/characters/generator'
import {
  createCharacterSampleLibrary,
  validateCharacterSampleLibrary,
} from '../src/characters/sample-library'

const WORLD_SEED =
  '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1'
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(
  scriptDirectory,
  '../../data/characters/sample-12-v0.1-draft.json',
)
const rosterPath = resolve(
  scriptDirectory,
  '../../data/characters/character-samples-12-v0.1-draft.md',
)

const sourceLibrary = generateCharacterLibrary({
  worldSeedHex: WORLD_SEED,
  count: 50,
})
const sampleLibrary = createCharacterSampleLibrary(sourceLibrary)
const findings = validateCharacterSampleLibrary(sampleLibrary, sourceLibrary)
if (findings.some((finding) => finding.result !== 'passed')) {
  throw new Error(
    `Sample library validation failed: ${JSON.stringify(findings)}`,
  )
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(
  outputPath,
  `${JSON.stringify(sampleLibrary, null, 2)}\n`,
  'utf8',
)

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
- 拒绝：${sample.decision_scene.decline_choice} ${sample.decision_scene.decline_consequence}

### 待验证问题

${sample.review_questions.map((question) => `- ${question}`).join('\n')}
`,
  )
  .join('\n')
  .trimEnd()

const roster = `# 12 人高完成度样板库 V0.1

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
await writeFile(rosterPath, roster, 'utf8')

process.stdout.write(
  `${JSON.stringify({
    outputPath,
    rosterPath,
    sampleLibraryId: sampleLibrary.sample_library_id,
    sourceLibraryId: sampleLibrary.source_library_id,
    samples: sampleLibrary.samples.length,
    machineStructurePassed:
      sampleLibrary.validation.machine_structure_passed,
    findings,
    manualReviews: sampleLibrary.validation.manual_reviews,
  })}\n`,
)
