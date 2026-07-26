import {
  AFFILIATION_CANDIDATES,
  EDUCATION_TEMPLATES,
  FAMILY_NAMES,
  GIVEN_NAMES,
  GROWTH_TEMPLATES,
  MOTIVATION_TEMPLATES,
  STRESS_RESPONSES,
  TURNING_TEMPLATES,
  WORK_TEMPLATES,
} from './content'
import {
  ATTRIBUTE_KEYS,
  CHARACTER_SCHEMA_VERSION,
  CONTENT_PACK_VERSIONS,
  CULTURE_PACK_VERSION,
  GENERATOR_SCHEMA_VERSION,
  LIBRARY_SCHEMA_VERSION,
  MBTI_TYPES,
  SKILL_KEYS,
  type AttributeKey,
  type AttributeModifier,
  type AttributeValues,
  type BiographyNode,
  type CharacterGenerationInput,
  type CharacterLibrary,
  type GeneratedCharacter,
  type InclinationStrength,
  type MbtiProfile,
  type MbtiType,
  type Qualification,
  type SkillExperience,
  type SkillKey,
  type SkillValues,
  type ValidationFinding,
} from './model'
import {
  computeDistinctionFingerprint,
} from './fingerprint'
import { selectSeededVariationAttributes } from './seeded-variation'
import {
  machineFinding as finding,
  validateCharacter,
  validateCharacterLibraryContent,
} from './validator'
import { deriveSeedV1 } from './seed'

export { validateCharacter, validateCharacterLibraryContent } from './validator'
export { deriveSeedV1 } from './seed'

const MASK_64 = (1n << 64n) - 1n

class SeededRandom {
  private left: bigint
  private right: bigint

  constructor(seedHex: string) {
    this.left = BigInt(`0x${seedHex.slice(0, 16)}`)
    this.right = BigInt(`0x${seedHex.slice(16, 32)}`)
    if (this.left === 0n && this.right === 0n) {
      this.right = 1n
    }
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error('maxExclusive must be a positive safe integer')
    }

    let working = this.left
    const previousRight = this.right
    this.left = previousRight
    working ^= (working << 23n) & MASK_64
    this.right =
      (working ^ previousRight ^ (working >> 17n) ^ (previousRight >> 26n)) & MASK_64
    const next = (this.right + previousRight) & MASK_64
    return Number(next % BigInt(maxExclusive))
  }
}

function emptyAttributes(): AttributeValues {
  return {
    体能: 5,
    协调: 5,
    思维: 5,
    感知: 5,
    沟通: 5,
    意志: 5,
    健康: 5,
  }
}

function emptySkills(): SkillValues {
  return {
    生产: 0,
    工程: 0,
    医疗: 0,
    后勤: 0,
    侦察: 0,
    防卫: 0,
    交涉: 0,
    研究: 0,
  }
}

function modifiers(
  nodeId: string,
  entries: readonly (readonly [AttributeKey, -1 | 1])[],
): readonly AttributeModifier[] {
  return entries.map(([attribute, value]) => ({
    attribute,
    value,
    modifier_source_id: nodeId,
  }))
}

function pickAttribute(
  startIndex: number,
  excluded: ReadonlySet<AttributeKey>,
): AttributeKey {
  for (let offset = 0; offset < ATTRIBUTE_KEYS.length; offset += 1) {
    const candidate = ATTRIBUTE_KEYS[(startIndex + offset) % ATTRIBUTE_KEYS.length]
    if (!excluded.has(candidate)) {
      return candidate
    }
  }
  throw new Error('no attribute remains after exclusions')
}

function skillExperience(
  entries: readonly (
    readonly [SkillKey, 1 | 2 | 4 | 6 | 8, SkillExperience['intensity']]
  )[],
): readonly SkillExperience[] {
  return entries.map(([skill, points, intensity]) => ({ skill, points, intensity }))
}

function strengths(random: SeededRandom): readonly [
  InclinationStrength,
  InclinationStrength,
  InclinationStrength,
  InclinationStrength,
] {
  const values: readonly InclinationStrength[] = ['light', 'moderate', 'strong']
  return [
    values[random.nextInt(values.length)],
    values[random.nextInt(values.length)],
    values[random.nextInt(values.length)],
    values[random.nextInt(values.length)],
  ]
}

function createMbti(
  worldSeedHex: string,
  characterIndex: number,
  random: SeededRandom,
): MbtiProfile {
  const orderSeed = deriveSeedV1('library-mbti-order', [worldSeedHex])
  const offset = Number.parseInt(orderSeed.slice(0, 2), 16) % MBTI_TYPES.length
  const strides = [1, 3, 5, 7, 9, 11, 13, 15] as const
  const stride = strides[Number.parseInt(orderSeed.slice(2, 4), 16) % strides.length]
  const blockIndex = Math.floor(characterIndex / MBTI_TYPES.length)
  const positionInBlock = characterIndex % MBTI_TYPES.length
  const type =
    MBTI_TYPES[
      (offset + positionInBlock * stride + blockIndex * 4) % MBTI_TYPES.length
    ]
  const [energy, information, decision, structure] = strengths(random)
  const [energyPole, informationPole, decisionPole, structurePole] = type

  const energyText = energyPole === 'E' ? '更愿意通过交谈整理状态' : '更愿意先独处整理状态'
  const informationText =
    informationPole === 'S' ? '先核对现场细节' : '先寻找变化模式'
  const structureText =
    structurePole === 'J' ? '偏好预先约定检查点' : '偏好保留可调整余量'

  return {
    type,
    dimensions: {
      energy: { pole: energyPole as 'E' | 'I', strength: energy },
      information: { pole: informationPole as 'S' | 'N', strength: information },
      decision: { pole: decisionPole as 'T' | 'F', strength: decision },
      structure: { pole: structurePole as 'J' | 'P', strength: structure },
    },
    behavior_summary: `${energyText}，${informationText}，并${structureText}；这只描述表达和普通偏好。`,
  }
}

function selectPrimarySkills(skills: SkillValues): readonly SkillKey[] {
  return [...SKILL_KEYS]
    .filter((skill) => skills[skill] >= 6)
    .sort((left, right) => {
      const difference = skills[right] - skills[left]
      return difference === 0
        ? SKILL_KEYS.indexOf(left) - SKILL_KEYS.indexOf(right)
        : difference
    })
    .slice(0, 2)
}

function recognizedTitle(skill: SkillKey, familyName: string): string {
  const titles: Record<SkillKey, string> = {
    生产: '师傅',
    工程: '师傅',
    医疗: '医生',
    后勤: '管事',
    侦察: '向导',
    防卫: '教官',
    交涉: '老师',
    研究: '先生',
  }
  return `${familyName}${titles[skill]}`
}

function assertInput(input: CharacterGenerationInput): void {
  if (!/^[0-9a-f]{64}$/.test(input.worldSeedHex)) {
    throw new Error('worldSeedHex must be 64 lowercase hexadecimal characters')
  }
  if (!Number.isSafeInteger(input.characterIndex) || input.characterIndex < 0) {
    throw new Error('characterIndex must be a non-negative safe integer')
  }
  if (
    input.attemptIndex !== undefined &&
    (!Number.isSafeInteger(input.attemptIndex) ||
      input.attemptIndex < 0 ||
      input.attemptIndex > 31)
  ) {
    throw new Error('attemptIndex must be an integer from 0 to 31')
  }
}

export function generateCharacter(input: CharacterGenerationInput): GeneratedCharacter {
  assertInput(input)
  const attemptIndex = input.attemptIndex ?? 0
  const personSeed = deriveSeedV1('library-character', [
    input.worldSeedHex,
    input.characterIndex,
    GENERATOR_SCHEMA_VERSION,
    CONTENT_PACK_VERSIONS,
    CULTURE_PACK_VERSION,
  ])
  const attemptSeed = deriveSeedV1('candidate-attempt', [
    input.worldSeedHex,
    personSeed,
    attemptIndex,
  ])
  const random = new SeededRandom(attemptSeed)
  const characterId = `char_${deriveSeedV1('character-id', [
    input.worldSeedHex,
    input.characterIndex,
  ]).slice(0, 16)}`

  const nameSeed = deriveSeedV1('library-name-order', [input.worldSeedHex])
  const nameSpace = FAMILY_NAMES.length * GIVEN_NAMES.length
  const nameOffset = Number.parseInt(nameSeed.slice(0, 8), 16) % nameSpace
  const nameIndex = (nameOffset + input.characterIndex * 37) % nameSpace
  const familyName = FAMILY_NAMES[nameIndex % FAMILY_NAMES.length]
  const givenName = GIVEN_NAMES[Math.floor(nameIndex / FAMILY_NAMES.length)]
  const formalName = `${familyName}${givenName}`

  const lifeHistorySeed = deriveSeedV1('library-life-history-order', [
    input.worldSeedHex,
  ])
  const growthOffset =
    Number.parseInt(lifeHistorySeed.slice(0, 8), 16) %
    GROWTH_TEMPLATES.length
  const workOffset =
    Number.parseInt(lifeHistorySeed.slice(8, 16), 16) %
    WORK_TEMPLATES.length
  const motivationOffset =
    Number.parseInt(lifeHistorySeed.slice(16, 24), 16) %
    MOTIVATION_TEMPLATES.length
  const workCycle = Math.floor(input.characterIndex / WORK_TEMPLATES.length)
  const growthIndex =
    (growthOffset + input.characterIndex * 3 + workCycle) %
    GROWTH_TEMPLATES.length
  const workIndex =
    (workOffset + input.characterIndex * 5) %
    WORK_TEMPLATES.length
  const motivationIndex =
    (motivationOffset + input.characterIndex * 7 + workCycle * 3) %
    MOTIVATION_TEMPLATES.length
  const growth = GROWTH_TEMPLATES[growthIndex]
  const work = WORK_TEMPLATES[workIndex]
  const compatibleEducation = EDUCATION_TEMPLATES.filter(
    (template) => template.primary === work.primary,
  )
  const education =
    compatibleEducation[(input.characterIndex + random.nextInt(compatibleEducation.length)) %
      compatibleEducation.length]

  const turnOffset =
    Number.parseInt(deriveSeedV1('library-turn-order', [input.worldSeedHex]).slice(0, 8), 16) %
    TURNING_TEMPLATES.length
  const turn =
    TURNING_TEMPLATES[
      (turnOffset + input.characterIndex * 7 + Math.floor(input.characterIndex / 12)) %
        TURNING_TEMPLATES.length
    ]

  const motivation = MOTIVATION_TEMPLATES[motivationIndex]

  const age = 29 + random.nextInt(30)
  const turningAge = age - 3
  const nodeIds = {
    growth: `${characterId}:bio:growth`,
    education: `${characterId}:bio:education`,
    work: `${characterId}:bio:work`,
    turn: `${characterId}:bio:turn`,
    motivation: `${characterId}:bio:motivation`,
  }
  const educationQualification: Qualification = {
    qualification_id: education.qualificationId,
    rank: 1,
    source_node_id: nodeIds.education,
    evidence: education.qualificationEvidence,
  }
  const qualification: Qualification =
    input.characterIndex % 4 === 0
      ? {
          qualification_id: education.qualificationId,
          rank: 2,
          source_node_id: nodeIds.work,
          evidence: `${education.qualificationEvidence}，并在长期主要职责中独立使用`,
        }
      : educationQualification
  const attributeProfile = input.characterIndex % 5
  const educationModifierEntries: [AttributeKey, -1 | 1][] =
    attributeProfile <= 1 ? [] : [[education.attribute, 1]]
  if (attributeProfile === 4) {
    educationModifierEntries.push([
      pickAttribute(input.characterIndex + 1, new Set([education.attribute])),
      1,
    ])
  }
  const workModifierEntries: [AttributeKey, -1 | 1][] = [
    [work.positive, 1],
    [work.negative, -1],
  ]
  if (attributeProfile >= 3) {
    workModifierEntries.push([
      pickAttribute(input.characterIndex + 3, new Set([work.positive, work.negative])),
      1,
    ])
  }
  const turnModifierEntries: [AttributeKey, -1 | 1][] = [
    [turn.positive, 1],
    [turn.negative, -1],
  ]
  if (attributeProfile === 0) {
    turnModifierEntries.push([
      pickAttribute(
        input.characterIndex + 5,
        new Set([turn.positive, turn.negative, growth.negative, work.negative]),
      ),
      -1,
    ])
  }

  const biographyNodes: readonly BiographyNode[] = [
    {
      node_id: nodeIds.growth,
      template_id: growth.id,
      stage: 'growth',
      age_start: 0,
      age_end: 16,
      context_tags: [growth.context, 'growth'],
      prerequisites: [],
      attribute_modifiers: modifiers(nodeIds.growth, [
        [growth.positive, 1],
        [growth.negative, -1],
      ]),
      skill_experience: skillExperience([[growth.skill, 2, 'repeated']]),
      qualifications: [],
      personality_candidates: [growth.trait],
      value_and_redline_candidates: [],
      relationship_outputs: ['家庭与成长地关系'],
      motivation_and_hooks: [],
      evidence_text: growth.evidence,
    },
    {
      node_id: nodeIds.education,
      template_id: education.id,
      stage: 'education',
      age_start: 16,
      age_end: 20,
      context_tags: ['education', education.primary],
      prerequisites: [nodeIds.growth],
      attribute_modifiers: modifiers(nodeIds.education, educationModifierEntries),
      skill_experience: skillExperience([
        [education.primary, 4, 'regular'],
        [education.secondary, 2, 'repeated'],
      ]),
      qualifications: [educationQualification],
      personality_candidates: ['愿意按训练流程复核基础动作'],
      value_and_redline_candidates: [],
      relationship_outputs: ['师徒或同学关系'],
      motivation_and_hooks: [],
      evidence_text: education.evidence,
    },
    {
      node_id: nodeIds.work,
      template_id: work.id,
      stage: 'work',
      age_start: 20,
      age_end: turningAge,
      context_tags: ['work', work.primary, work.secondary],
      prerequisites: [nodeIds.education],
      attribute_modifiers: modifiers(nodeIds.work, workModifierEntries),
      skill_experience: skillExperience([
        [work.primary, 6, 'major_duty'],
        [work.secondary, 4, 'regular'],
      ]),
      qualifications: qualification.rank === 2 ? [qualification] : [],
      personality_candidates: [work.trait],
      value_and_redline_candidates: [],
      relationship_outputs: [work.relationship],
      motivation_and_hooks: [`曾任${work.experienceTitle}`],
      evidence_text: work.evidence,
    },
    {
      node_id: nodeIds.turn,
      template_id: turn.id,
      stage: 'turning_point',
      age_start: turningAge,
      age_end: turningAge,
      context_tags: ['turning_point', turn.redline.scope],
      prerequisites: [nodeIds.work],
      attribute_modifiers: modifiers(nodeIds.turn, turnModifierEntries),
      skill_experience: [],
      qualifications: [],
      personality_candidates: ['遇到相似情境时会提前说明边界'],
      value_and_redline_candidates: [...turn.values, turn.redline.summary],
      relationship_outputs: [turn.hook],
      motivation_and_hooks: [turn.hook],
      evidence_text: turn.evidence,
    },
    {
      node_id: nodeIds.motivation,
      template_id: motivation.id,
      stage: 'current_motivation',
      age_start: turningAge,
      age_end: age,
      context_tags: ['current_motivation'],
      prerequisites: [nodeIds.turn],
      attribute_modifiers: [],
      skill_experience: [],
      qualifications: [],
      personality_candidates: [],
      value_and_redline_candidates: [],
      relationship_outputs: [motivation.hook],
      motivation_and_hooks: [motivation.motivation, motivation.goal, motivation.hook],
      evidence_text: `${motivation.motivation}；希望${motivation.goal}。`,
    },
  ]

  const attributes = emptyAttributes()
  const skills = emptySkills()
  for (const node of biographyNodes) {
    for (const modifier of node.attribute_modifiers) {
      attributes[modifier.attribute] += modifier.value
    }
    for (const experience of node.skill_experience) {
      skills[experience.skill] = Math.min(20, skills[experience.skill] + experience.points)
    }
  }

  const { positiveAttribute, negativeAttribute } =
    selectSeededVariationAttributes(attributes)
  attributes[negativeAttribute] -= 1
  attributes[positiveAttribute] += 1

  const mbti = createMbti(input.worldSeedHex, input.characterIndex, random)
  const primarySkills = selectPrimarySkills(skills)
  const redlineId = `${characterId}:redline:${turn.id}`
  const fingerprint = computeDistinctionFingerprint({
    biographyTemplateIds: biographyNodes.map((node) => node.template_id),
    primarySkills,
    mbtiType: mbti.type,
    mbtiStrengths: Object.values(mbti.dimensions).map(
      (dimension) => dimension.strength,
    ),
    coreValueSummaries: turn.values,
    redlineSummaries: [turn.redline.summary],
    currentMotivation: motivation.motivation,
  })
  const affiliationOffset = random.nextInt(AFFILIATION_CANDIDATES.length)
  const affiliations = [0, 1, 2].map(
    (offset) =>
      AFFILIATION_CANDIDATES[
        (affiliationOffset + offset) % AFFILIATION_CANDIDATES.length
      ],
  )
  const gender = (['女', '男', '非二元'] as const)[random.nextInt(3)]
  const experienceAddress = recognizedTitle(work.primary, familyName)
  const addressPattern = input.characterIndex % 4
  const addressRules: GeneratedCharacter['address_rules'] =
    addressPattern === 0
      ? [
          { relationship: 'default', form: formalName },
          { relationship: 'familiar', form: givenName },
        ]
      : addressPattern === 1
        ? [
            { relationship: 'default', form: formalName },
            { relationship: 'recognized_experience', form: experienceAddress },
          ]
        : addressPattern === 2
          ? [
              { relationship: 'default', form: formalName },
              { relationship: 'familiar', form: givenName },
              { relationship: 'recognized_experience', form: experienceAddress },
            ]
          : [
              { relationship: 'default', form: givenName },
              { relationship: 'recognized_experience', form: experienceAddress },
          ]
  const coreValues: GeneratedCharacter['core_values'] = [
    {
      value_id: `${characterId}:value:0`,
      summary: turn.values[0],
      source_ids: [nodeIds.turn],
    },
    {
      value_id: `${characterId}:value:1`,
      summary: turn.values[1],
      source_ids: [nodeIds.turn],
    },
  ]

  return {
    schema_version: CHARACTER_SCHEMA_VERSION,
    character_id: characterId,
    person_seed: personSeed,
    generation_attempt: attemptIndex,
    library_generation_evidence: {
      evidence_schema_version: 'technical-library-provenance-v1',
      world_seed_hex: input.worldSeedHex,
      character_index: input.characterIndex,
      generator_schema_version: GENERATOR_SCHEMA_VERSION,
      content_pack_versions: CONTENT_PACK_VERSIONS,
      culture_pack_version: CULTURE_PACK_VERSION,
    },
    formal_name: formalName,
    name_parts: {
      family_name: familyName,
      given_name: givenName,
      culture_pack_version: CULTURE_PACK_VERSION,
    },
    age,
    gender,
    origin: growth.context,
    affiliation_candidates: affiliations,
    address_rules: addressRules,
    biography_nodes: biographyNodes,
    biography_summary: biographyNodes.map((node) => node.evidence_text).join(' '),
    attributes,
    seeded_variation: {
      variation_source_id: `seed_variation:${characterId}:seeded-variation-v1`,
      person_seed: personSeed,
      algorithm_version: 'seeded-variation-v1',
      applicability_condition: 'positive_below_8_and_negative_at_least_5',
      positive_attribute: positiveAttribute,
      negative_attribute: negativeAttribute,
      positive_value: 1,
      negative_value: -1,
    },
    skills,
    primary_skills: primarySkills,
    qualifications: [qualification],
    mbti,
    traits: [growth.trait, work.trait],
    stress_response: STRESS_RESPONSES[random.nextInt(STRESS_RESPONSES.length)],
    core_values: coreValues,
    redlines: [
      {
        redline_id: redlineId,
        summary: turn.redline.summary,
        trigger_action_tags: turn.redline.trigger,
        forbidden_action_tags: turn.redline.forbidden,
        allowed_alternative_tags: turn.redline.alternatives,
        threshold: turn.redline.threshold,
        scope: turn.redline.scope,
        source_ids: [
          nodeIds.turn,
          coreValues[0].value_id,
          coreValues[1].value_id,
        ],
        disclosed_at: 'character_join_preview',
      },
    ],
    current_motivation: motivation.motivation,
    relationship_hooks: [work.relationship],
    long_term_goal: motivation.goal,
    request_seed: motivation.hook,
    distinction_fingerprint: fingerprint,
    review_status: {
      implemented_character_contracts: 'not_evaluated',
      E01_naming_review: 'not_run',
      E02_to_E06_content_review: 'not_run',
    },
  }
}
export interface CharacterLibraryGenerationInput {
  worldSeedHex: string
  count: number
}

function frozenSeedKatFinding(): ValidationFinding {
  const worldSeed =
    '0000000000000000000000000000000000000000000000000000000000000001'
  const candidateSequenceSeed = deriveSeedV1('replacement-seat', [
    worldSeed,
    'seat:test',
    'loss:test',
    'standard_12m_p01',
  ])
  const cycleSeed = deriveSeedV1('replacement-cycle', [
    candidateSequenceSeed,
    0,
    0,
    0,
    'rc:loss:test',
    'char-gen-v1',
    { biography: '1.0.0', traits: '1.0.0' },
    'culture-v1',
  ])
  const personSeed = deriveSeedV1('candidate-person', [cycleSeed])
  const attemptSeed = deriveSeedV1('candidate-attempt', [
    worldSeed,
    personSeed,
    0,
  ])
  const expected = [
    '964ea7a1c6840d36b9f49f4df75e546b',
    '1d50b638e9001a77e19abe3fd4b2c88a',
    'cc00ead317e30f3a279f232891782066',
    '8a0ac8633dc448667567910ae27ca29d',
  ]
  const actual = [candidateSequenceSeed, cycleSeed, personSeed, attemptSeed]

  return finding(
    'SEED-KAT',
    'library_build',
    'seed_derivation_v1',
    '冻结的席位、周期、人物与attempt已知答案向量逐项一致',
    `actual=${actual.join(',')}; expected=${expected.join(',')}`,
    actual.every((value, index) => value === expected[index]),
  )
}

export function generateCharacterLibrary(
  input: CharacterLibraryGenerationInput,
): CharacterLibrary {
  if (!/^[0-9a-f]{64}$/.test(input.worldSeedHex)) {
    throw new Error('worldSeedHex must be 64 lowercase hexadecimal characters')
  }
  if (!Number.isSafeInteger(input.count) || input.count <= 0 || input.count > 500) {
    throw new Error('count must be an integer from 1 to 500')
  }

  const rawCharacters = Array.from({ length: input.count }, (_, characterIndex) =>
    generateCharacter({ worldSeedHex: input.worldSeedHex, characterIndex }),
  )
  const characterFindings = rawCharacters.flatMap(validateCharacter)
  const libraryContentFindings = validateCharacterLibraryContent(rawCharacters)

  const replayPassed = rawCharacters.every((character, characterIndex) => {
    const replay = generateCharacter({
      worldSeedHex: input.worldSeedHex,
      characterIndex,
    })
    return JSON.stringify(replay) === JSON.stringify(character)
  })
  const replayFinding = finding(
    'LIBRARY-REPLAY-PARTIAL',
    'library_build',
    'character-library',
    '相同世界种子、人物索引与attempt在当前候选库接口中生成逐字段相同人物',
    `replayed=${rawCharacters.length}; mismatches=${replayPassed ? 0 : 'one_or_more'}`,
    replayPassed,
  )
  const m12Finding: ValidationFinding = {
    ...finding(
      'M12',
      'library_build',
      'character-library',
      '完整GenerationContextSnapshot、generation_context_hash与席位到attempt派生证据可重放',
      'not_implemented=GenerationContextSnapshot,generation_context_hash,seat_cycle_attempt_chain,retry_evidence',
      true,
    ),
    result: 'not_run',
  }

  const mbtiCounts = rawCharacters.reduce<Record<MbtiType, number>>(
    (counts, character) => {
      counts[character.mbti.type] += 1
      return counts
    },
    Object.fromEntries(MBTI_TYPES.map((type) => [type, 0])) as Record<MbtiType, number>,
  )
  const mbtiDistributionPassed =
    input.count < 50 ||
    MBTI_TYPES.every((type) => mbtiCounts[type] >= 2 && mbtiCounts[type] <= 5)
  const mbtiFinding = finding(
    'DIST-MBTI',
    'library_build',
    'character-library',
    '50人候选库覆盖16种MBTI，每型2-5人',
    MBTI_TYPES.map((type) => `${type}=${mbtiCounts[type]}`).join(';'),
    mbtiDistributionPassed,
  )
  const highestSkillCounts = rawCharacters.reduce<
    Record<MbtiType, Partial<Record<SkillKey, number>>>
  >(
    (counts, character) => {
      const highestSkill = character.primary_skills[0]
      counts[character.mbti.type][highestSkill] =
        (counts[character.mbti.type][highestSkill] ?? 0) + 1
      return counts
    },
    Object.fromEntries(MBTI_TYPES.map((type) => [type, {}])) as Record<
      MbtiType,
      Partial<Record<SkillKey, number>>
    >,
  )
  const mbtiSkillShares = MBTI_TYPES.map((type) => {
    const typeTotal = mbtiCounts[type]
    const highestSharedCount = Math.max(0, ...Object.values(highestSkillCounts[type]))
    return {
      type,
      share: typeTotal === 0 ? 0 : highestSharedCount / typeTotal,
      counts: highestSkillCounts[type],
    }
  })
  const mbtiSkillDiversityPassed =
    input.count < 50 || mbtiSkillShares.every(({ share }) => share <= 0.6)
  const mbtiSkillFinding: ValidationFinding = {
    ...finding(
      'DIST-MBTI-SKILL',
      'library_build',
      'character-library',
      '同一MBTI类型共享同一最高技能的人数不超过该类型的60%',
      mbtiSkillShares
        .map(
          ({ type, share, counts }) =>
            `${type}:max_share=${share.toFixed(3)},counts=${JSON.stringify(counts)}`,
        )
        .join(';'),
      true,
    ),
    result: mbtiSkillDiversityPassed ? 'passed' : 'warned',
  }
  const mbtiContentDiversity = rawCharacters.reduce<
    Record<
      MbtiType,
      {
        growth: Set<string>
        work: Set<string>
        turningPoint: Set<string>
        motivation: Set<string>
        values: Set<string>
        redlines: Set<string>
      }
    >
  >(
    (groups, character) => {
      const group = groups[character.mbti.type]
      for (const node of character.biography_nodes) {
        if (node.stage === 'growth') {
          group.growth.add(node.template_id)
        } else if (node.stage === 'work') {
          group.work.add(node.template_id)
        } else if (node.stage === 'turning_point') {
          group.turningPoint.add(node.template_id)
        } else if (node.stage === 'current_motivation') {
          group.motivation.add(node.template_id)
        }
      }
      group.values.add(
        character.core_values.map((value) => value.summary).join('|'),
      )
      group.redlines.add(character.redlines.map((redline) => redline.summary).join('|'))
      return groups
    },
    Object.fromEntries(
      MBTI_TYPES.map((type) => [
        type,
        {
          growth: new Set<string>(),
          work: new Set<string>(),
          turningPoint: new Set<string>(),
          motivation: new Set<string>(),
          values: new Set<string>(),
          redlines: new Set<string>(),
        },
      ]),
    ) as Record<
      MbtiType,
      {
        growth: Set<string>
        work: Set<string>
        turningPoint: Set<string>
        motivation: Set<string>
        values: Set<string>
        redlines: Set<string>
      }
    >,
  )
  const mbtiContentDiversityPassed =
    input.count < 50 ||
    MBTI_TYPES.every((type) => {
      const minimumDistinct = Math.min(3, mbtiCounts[type])
      const group = mbtiContentDiversity[type]
      return Object.values(group).every(
        (values) => values.size >= minimumDistinct,
      )
    })
  const mbtiContentFinding: ValidationFinding = {
    ...finding(
      'DIST-MBTI-CONTENT',
      'library_build',
      'character-library',
      '同一MBTI类型至少保留三种成长、工作、转折、动机、价值观和红线组合',
      MBTI_TYPES.map((type) => {
        const group = mbtiContentDiversity[type]
        return `${type}:growth=${group.growth.size},work=${group.work.size},turn=${group.turningPoint.size},motivation=${group.motivation.size},values=${group.values.size},redlines=${group.redlines.size}`
      }).join(';'),
      true,
    ),
    result: mbtiContentDiversityPassed ? 'passed' : 'warned',
  }
  const addressStructureCounts = rawCharacters.reduce<Record<string, number>>(
    (counts, character) => {
      const structure = character.address_rules
        .map(
          (rule) =>
            `${rule.relationship}:${rule.form === character.formal_name ? 'formal' : 'contextual'}`,
        )
        .join('+')
      counts[structure] = (counts[structure] ?? 0) + 1
      return counts
    },
    {},
  )
  const largestAddressStructureCount = Math.max(...Object.values(addressStructureCounts))
  const addressDiversityPassed =
    largestAddressStructureCount / rawCharacters.length <= 0.5
  const addressFinding: ValidationFinding = {
    ...finding(
      'DIST-ADDRESS',
      'library_build',
      'character-library',
      '相同聚落内部称呼结构不超过当前批次的50%',
      Object.entries(addressStructureCounts)
        .map(([structure, count]) => `${structure}=${count}`)
        .join(';'),
      true,
    ),
    result: addressDiversityPassed ? 'passed' : 'warned',
  }

  const findings = [
    ...characterFindings,
    ...libraryContentFindings,
    frozenSeedKatFinding(),
    replayFinding,
    m12Finding,
    mbtiFinding,
    mbtiSkillFinding,
    mbtiContentFinding,
    addressFinding,
  ]
  const implementedMachineContractsPassed = findings.every(
    (item) => item.result !== 'blocked',
  )
  const notRunIds = findings
    .filter((item) => item.result === 'not_run')
    .map((item) => item.validation_id)
  const characters = rawCharacters.map((character) => ({
    ...character,
    review_status: {
      ...character.review_status,
      implemented_character_contracts: implementedMachineContractsPassed
        ? ('passed' as const)
        : ('blocked' as const),
    },
  }))

  return {
    schema_version: LIBRARY_SCHEMA_VERSION,
    library_id: `character-library-${deriveSeedV1('library-id', [
      input.worldSeedHex,
      input.count,
      GENERATOR_SCHEMA_VERSION,
      CONTENT_PACK_VERSIONS,
      CULTURE_PACK_VERSION,
    ]).slice(0, 16)}`,
    status: 'CANDIDATE_NOT_FROZEN',
    development_stage: 'TECHNICAL_SPIKE_BEFORE_A1',
    world_seed_hex: input.worldSeedHex,
    generator_schema_version: GENERATOR_SCHEMA_VERSION,
    seed_derivation_version: 'seed_derivation_v1',
    content_pack_versions: CONTENT_PACK_VERSIONS,
    culture_pack_version: CULTURE_PACK_VERSION,
    characters,
    validation: {
      scope: 'TECHNICAL_CHARACTER_LIBRARY_IMPLEMENTED_CONTRACTS_ONLY',
      implemented_machine_contracts_passed:
        implementedMachineContractsPassed,
      not_run_ids: notRunIds,
      findings,
      manual_reviews: {
        E01: 'not_run',
        E02: 'not_run',
        E03: 'not_run',
        E04: 'not_run',
        E05: 'not_run',
        E06: 'not_run',
      },
    },
  }
}

export function validatePopulationLimit(
  settlementType: 'player' | 'npc',
  permanentPopulation: number,
): ValidationFinding {
  const limit = settlementType === 'player' ? 10 : 15
  const valid =
    Number.isSafeInteger(permanentPopulation) &&
    permanentPopulation >= 0 &&
    permanentPopulation <= limit
  return finding(
    'M01',
    'library_build',
    `${settlementType}-settlement`,
    settlementType === 'player'
      ? '玩家聚落永久人口不超过10'
      : '单个NPC聚落永久人口不超过15',
    `permanent_population=${permanentPopulation}; limit=${limit}`,
    valid,
  )
}
