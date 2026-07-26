import {
  AFFILIATION_CANDIDATES,
  EDUCATION_TEMPLATES,
  FAMILY_NAMES,
  GIVEN_NAMES,
  GROWTH_TEMPLATES,
  MOTIVATION_TEMPLATES,
  ORIGINS,
  STRESS_RESPONSES,
  TURNING_TEMPLATES,
  WORK_TEMPLATES,
} from './content'
import {
  ATTRIBUTE_KEYS,
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

type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJson[]
  | { readonly [key: string]: CanonicalJson }

function canonicalStringify(value: CanonicalJson): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error('seed_derivation_v1 only accepts safe JSON integers')
    }
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`
  }

  const entries = Object.entries(value).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )
  return `{${entries
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalStringify(child)}`)
    .join(',')}}`
}

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count))
}

function sha256(bytes: Uint8Array): Uint8Array {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const bitLength = bytes.length * 8
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(paddedLength - 4, bitLength >>> 0)

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const words = new Uint32Array(64)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4)
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15]
      const right = words[index - 2]
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3)
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10)
      words[index] =
        (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = hash
    for (let index = 0; index < 64; index += 1) {
      const choice = (e & f) ^ (~e & g)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const bigSigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const bigSigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const temporary1 = (h + bigSigma1 + choice + constants[index] + words[index]) >>> 0
      const temporary2 = (bigSigma0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }

    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }

  const output = new Uint8Array(32)
  const outputView = new DataView(output.buffer)
  hash.forEach((value, index) => outputView.setUint32(index * 4, value))
  return output
}

export function deriveSeedV1(label: string, parts: readonly CanonicalJson[]): string {
  const encoder = new TextEncoder()
  const labelBytes = encoder.encode(label)
  const partsBytes = encoder.encode(canonicalStringify(parts))
  const input = new Uint8Array(labelBytes.length + 1 + partsBytes.length)
  input.set(labelBytes)
  input[labelBytes.length] = 0
  input.set(partsBytes, labelBytes.length + 1)

  return Array.from(sha256(input).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

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
    'char-gen-v0.1-candidate',
    {
      biography: 'candidate-0.1.0',
      traits: 'candidate-0.1.0',
      values_and_redlines: 'candidate-0.1.0',
    },
    'cn-frontier-draft-v0.1',
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

  const growthOffset =
    Number.parseInt(deriveSeedV1('library-growth-order', [input.worldSeedHex]).slice(0, 8), 16) %
    GROWTH_TEMPLATES.length
  const growth =
    GROWTH_TEMPLATES[(growthOffset + input.characterIndex * 3) % GROWTH_TEMPLATES.length]

  const workOffset =
    Number.parseInt(deriveSeedV1('library-work-order', [input.worldSeedHex]).slice(0, 8), 16) %
    WORK_TEMPLATES.length
  const work = WORK_TEMPLATES[(workOffset + input.characterIndex * 5) % WORK_TEMPLATES.length]
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

  const motivationOffset =
    Number.parseInt(
      deriveSeedV1('library-motivation-order', [input.worldSeedHex]).slice(0, 8),
      16,
    ) % MOTIVATION_TEMPLATES.length
  const motivation =
    MOTIVATION_TEMPLATES[
      (motivationOffset + input.characterIndex * 5) % MOTIVATION_TEMPLATES.length
    ]

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

  const lowestAttributes = [...ATTRIBUTE_KEYS].sort(
    (left, right) => attributes[left] - attributes[right],
  )
  const negativeAttribute =
    lowestAttributes.find((attribute) => attributes[attribute] >= 5) ??
    lowestAttributes[lowestAttributes.length - 1]
  const positiveAttribute =
    [...ATTRIBUTE_KEYS]
      .filter((attribute) => attribute !== negativeAttribute && attributes[attribute] < 8)
      .sort((left, right) => attributes[right] - attributes[left])[0] ?? lowestAttributes[1]
  attributes[negativeAttribute] -= 1
  attributes[positiveAttribute] += 1

  const mbti = createMbti(input.worldSeedHex, input.characterIndex, random)
  const primarySkills = selectPrimarySkills(skills)
  const redlineId = `${characterId}:redline:${turn.id}`
  const fingerprint = deriveSeedV1('distinction-fingerprint', [
    biographyNodes.map((node) => node.template_id),
    primarySkills,
    mbti.type,
    Object.values(mbti.dimensions).map((dimension) => dimension.strength),
    turn.values,
    turn.redline.summary,
    motivation.motivation,
  ])
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

  return {
    schema_version: 'character-v0.1-candidate',
    character_id: characterId,
    person_seed: personSeed,
    generation_attempt: attemptIndex,
    formal_name: formalName,
    name_parts: {
      family_name: familyName,
      given_name: givenName,
      culture_pack_version: 'cn-frontier-draft-v0.1',
    },
    age,
    gender,
    origin: random.nextInt(4) === 0 ? ORIGINS[random.nextInt(ORIGINS.length)] : growth.context,
    affiliation_candidates: affiliations,
    address_rules: addressRules,
    biography_nodes: biographyNodes,
    biography_summary: biographyNodes.map((node) => node.evidence_text).join(' '),
    attributes,
    seeded_variation: {
      variation_source_id: `seed_variation:${characterId}:seeded-variation-v1`,
      person_seed: personSeed,
      algorithm_version: 'seeded-variation-v1',
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
    core_values: turn.values,
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
          `${characterId}:value:0`,
          `${characterId}:value:1`,
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
      machine_validation: 'pending',
      E01_naming_review: 'not_run',
      E02_to_E06_content_review: 'not_run',
    },
  }
}
function finding(
  validationId: string,
  phase: ValidationFinding['phase'],
  subjectId: string,
  predicate: string,
  evidence: string,
  passed: boolean,
): ValidationFinding {
  return {
    validation_id: validationId,
    executor: 'machine',
    phase,
    subject_id: subjectId,
    predicate,
    evidence,
    result: passed ? 'passed' : 'blocked',
    reviewer: 'character-generator-v0.1',
    timestamp: 'deterministic-build',
  }
}

export function validateCharacter(character: GeneratedCharacter): readonly ValidationFinding[] {
  const nodeIds = new Set(character.biography_nodes.map((node) => node.node_id))
  const requiredFieldsPresent =
    character.character_id.length > 0 &&
    character.formal_name.length > 0 &&
    character.biography_nodes.length >= 5 &&
    character.current_motivation.length > 0 &&
    character.relationship_hooks.length > 0 &&
    character.long_term_goal.length > 0
  const forbiddenFieldsAbsent = !['nickname', 'alias', 'codename', 'old_codename'].some(
    (key) => key in character,
  )

  const chronologyValid = character.biography_nodes.every((node, index, nodes) => {
    if (node.age_start < 0 || node.age_end < node.age_start || node.age_end > character.age) {
      return false
    }
    if (index === 0) {
      return node.age_start === 0
    }
    return nodes[index - 1].age_end <= node.age_start
  })

  const recomputedAttributes = emptyAttributes()
  const modifierSourcesValid = character.biography_nodes.every((node) =>
    node.attribute_modifiers.every(
      (modifier) =>
        modifier.modifier_source_id === node.node_id &&
        (modifier.value === 1 || modifier.value === -1),
    ),
  )
  for (const node of character.biography_nodes) {
    for (const modifier of node.attribute_modifiers) {
      recomputedAttributes[modifier.attribute] += modifier.value
    }
  }
  recomputedAttributes[character.seeded_variation.positive_attribute] +=
    character.seeded_variation.positive_value
  recomputedAttributes[character.seeded_variation.negative_attribute] +=
    character.seeded_variation.negative_value
  const attributeTotal = Object.values(character.attributes).reduce(
    (sum, value) => sum + value,
    0,
  )
  const attributesValid =
    modifierSourcesValid &&
    ATTRIBUTE_KEYS.every(
      (attribute) =>
        character.attributes[attribute] === recomputedAttributes[attribute] &&
        character.attributes[attribute] >= 0 &&
        character.attributes[attribute] <= 10,
    ) &&
    attributeTotal >= 32 &&
    attributeTotal <= 40 &&
    ATTRIBUTE_KEYS.filter((attribute) => character.attributes[attribute] >= 8).length <= 2 &&
    ATTRIBUTE_KEYS.some((attribute) => character.attributes[attribute] <= 4)

  const extremeSourcesValid =
    ATTRIBUTE_KEYS.every((attribute) => {
      const value = character.attributes[attribute]
      if (value > 2 && value < 9) {
        return true
      }
      return character.biography_nodes.some((node) =>
        node.attribute_modifiers.some((modifier) => modifier.attribute === attribute),
      )
    }) &&
    SKILL_KEYS.every((skill) => {
      if (character.skills[skill] < 14) {
        return true
      }
      return character.biography_nodes.some((node) =>
        node.skill_experience.some(
          (experience) =>
            experience.skill === skill &&
            (experience.intensity === 'major_duty' ||
              experience.intensity === 'long_profession'),
        ),
      )
    })

  const qualificationsValid = character.qualifications.every(
    (qualification) =>
      qualification.rank >= 1 &&
      qualification.rank <= 3 &&
      nodeIds.has(qualification.source_node_id) &&
      character.biography_nodes.some((node) =>
        node.qualifications.some(
          (nodeQualification) =>
            nodeQualification.qualification_id === qualification.qualification_id &&
            nodeQualification.source_node_id === qualification.source_node_id,
        ),
      ),
  )

  const mbtiHasNoNumericEffects =
    !('attribute_modifiers' in character.mbti) &&
    !('skill_modifiers' in character.mbti) &&
    !('profession' in character.mbti) &&
    !('morality' in character.mbti)

  return [
    finding(
      'M03',
      'character_generation',
      character.character_id,
      '稳定身份、正式姓名、履历和必填人物字段存在，且无外号或旧代号字段',
      `required=${requiredFieldsPresent}; forbidden_fields_absent=${forbiddenFieldsAbsent}`,
      requiredFieldsPresent && forbiddenFieldsAbsent,
    ),
    finding(
      'M04',
      'character_generation',
      character.character_id,
      '履历年龄区间按时间排列、不冲突且不超过当前年龄',
      character.biography_nodes
        .map((node) => `${node.node_id}:${node.age_start}-${node.age_end}`)
        .join(';'),
      chronologyValid,
    ),
    finding(
      'M05',
      'character_generation',
      character.character_id,
      '属性来源可追溯、值域合法且标准成年人物总和为32-40',
      `attribute_total=${attributeTotal}; modifiers_sourced=${modifierSourcesValid}`,
      attributesValid,
    ),
    finding(
      'M06',
      'character_generation',
      character.character_id,
      '极端属性和14以上技能具有长期经历来源',
      `extreme_attributes=${ATTRIBUTE_KEYS.filter((key) => character.attributes[key] <= 2 || character.attributes[key] >= 9).join(',') || 'none'}; expert_skills=${SKILL_KEYS.filter((key) => character.skills[key] >= 14).join(',') || 'none'}`,
      extremeSourcesValid,
    ),
    finding(
      'M07',
      'character_generation',
      character.character_id,
      '每项专业资格均引用训练或实践履历节点',
      character.qualifications
        .map(
          (qualification) =>
            `${qualification.qualification_id}@${qualification.source_node_id}`,
        )
        .join(';'),
      qualificationsValid,
    ),
    finding(
      'M09',
      'character_generation',
      character.character_id,
      'MBTI仅表达偏好，不写入属性、技能、职业或道德修正',
      `mbti_type=${character.mbti.type}; numeric_effect_fields=none`,
      mbtiHasNoNumericEffects,
    ),
  ]
}

export interface CharacterLibraryGenerationInput {
  worldSeedHex: string
  count: number
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
  const uniqueIds = new Set(rawCharacters.map((character) => character.character_id))
  const uniqueNames = new Set(rawCharacters.map((character) => character.formal_name))
  const uniqueFingerprints = new Set(
    rawCharacters.map((character) => character.distinction_fingerprint),
  )
  const uniquenessPassed =
    uniqueIds.size === input.count &&
    uniqueNames.size === input.count &&
    uniqueFingerprints.size === input.count
  const uniquenessFinding = finding(
    'M10',
    'library_build',
    'character-library',
    '人物ID、正式姓名与区分度指纹在候选库内无重复',
    `count=${input.count}; unique_ids=${uniqueIds.size}; unique_names=${uniqueNames.size}; unique_fingerprints=${uniqueFingerprints.size}`,
    uniquenessPassed,
  )

  const replayPassed = rawCharacters.every((character, characterIndex) => {
    const replay = generateCharacter({
      worldSeedHex: input.worldSeedHex,
      characterIndex,
    })
    return JSON.stringify(replay) === JSON.stringify(character)
  })
  const replayFinding = finding(
    'M12',
    'library_build',
    'character-library',
    '相同世界种子、人物索引与attempt生成逐字段相同人物',
    `replayed=${rawCharacters.length}; mismatches=${replayPassed ? 0 : 'one_or_more'}`,
    replayPassed,
  )

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
    uniquenessFinding,
    replayFinding,
    mbtiFinding,
    mbtiSkillFinding,
    addressFinding,
  ]
  const machinePassed = findings.every((item) => item.result !== 'blocked')
  const characters = rawCharacters.map((character) => ({
    ...character,
    review_status: {
      ...character.review_status,
      machine_validation: machinePassed ? ('passed' as const) : ('pending' as const),
    },
  }))

  return {
    schema_version: 'character-library-v0.1-candidate',
    library_id: `character-library-${deriveSeedV1('library-id', [
      input.worldSeedHex,
      input.count,
    ]).slice(0, 16)}`,
    status: 'CANDIDATE_NOT_FROZEN',
    world_seed_hex: input.worldSeedHex,
    generator_schema_version: 'char-gen-v0.1-candidate',
    seed_derivation_version: 'seed_derivation_v1',
    content_pack_versions: {
      biography: 'candidate-0.1.0',
      traits: 'candidate-0.1.0',
      values_and_redlines: 'candidate-0.1.0',
    },
    culture_pack_version: 'cn-frontier-draft-v0.1',
    characters,
    validation: {
      machine_passed: machinePassed,
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
