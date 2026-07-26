import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateCharacterLibrary } from '../src/characters/generator'

const WORLD_SEED =
  '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1'
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(
  scriptDirectory,
  '../../data/characters/generated-50-v0.1-candidate.json',
)
const rosterPath = resolve(
  scriptDirectory,
  '../../data/characters/character-roster-50-v0.1-candidate.md',
)
const library = generateCharacterLibrary({
  worldSeedHex: WORLD_SEED,
  count: 50,
})

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(library, null, 2)}\n`, 'utf8')

const mbtiCounts = library.characters.reduce<Record<string, number>>((counts, character) => {
  counts[character.mbti.type] = (counts[character.mbti.type] ?? 0) + 1
  return counts
}, {})
const rosterRows = library.characters.map((character, index) => {
  const values = character.core_values.join('；')
  return `| ${index + 1} | ${character.formal_name} | ${character.age} | ${character.mbti.type} | ${character.primary_skills.join(' / ')} | ${character.biography_nodes[2].evidence_text} | ${values} | ${character.redlines[0].summary} | ${character.long_term_goal} |`
})
const roster = `# 50 人角色候选库 V0.1

> 状态：\`CANDIDATE_NOT_FROZEN\`。机器校验通过；E01–E06 人工审核尚未执行。
> 完整结构化数据见 \`generated-50-v0.1-candidate.json\`。

| # | 正式姓名 | 年龄 | MBTI | 主要技能 | 过往经历 | 核心价值 | 重要红线 | 长期目标 |
|---:|---|---:|---|---|---|---|---|---|
${rosterRows.join('\n')}

## 批次摘要

- Library ID：\`${library.library_id}\`
- World seed：\`${library.world_seed_hex}\`
- 人数：${library.characters.length}
- 机器校验：\`${library.validation.machine_passed ? 'PASS' : 'BLOCKED'}\`
- MBTI 分布：${Object.entries(mbtiCounts)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([type, count]) => `${type}=${count}`)
  .join('、')}
- 人工审核：E01–E06 均为 \`NOT_RUN\`
`
await writeFile(rosterPath, roster, 'utf8')

process.stdout.write(
  `${JSON.stringify({
    outputPath,
    rosterPath,
    libraryId: library.library_id,
    characters: library.characters.length,
    machinePassed: library.validation.machine_passed,
    mbtiCounts,
    manualReviews: library.validation.manual_reviews,
  })}\n`,
)
