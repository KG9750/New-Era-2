import {
  lifeHistoryChassisKey,
  recomputeDistinctionFingerprint,
} from './fingerprint'
import {
  EDUCATION_TEMPLATES,
  GROWTH_TEMPLATES,
  MOTIVATION_TEMPLATES,
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
  type AttributeValues,
  type GeneratedCharacter,
  type MbtiType,
  type SkillExperience,
  type SkillKey,
  type SkillValues,
  type ValidationFinding,
} from './model'
import { deriveSeedV1 } from './seed'
import { selectSeededVariationAttributes } from './seeded-variation'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function hasSafeIntegerValues(
  value: unknown,
  keys: readonly string[],
): boolean {
  return (
    isRecord(value) &&
    keys.every((key) => Number.isSafeInteger(value[key]))
  )
}

function isQualification(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.qualification_id === 'string' &&
    [1, 2, 3].includes(value.rank as number) &&
    typeof value.source_node_id === 'string' &&
    typeof value.evidence === 'string'
  )
}

function isValidationFinding(value: unknown): value is ValidationFinding {
  if (!isRecord(value)) {
    return false
  }
  const expectedKeys = [
    'evidence',
    'executor',
    'phase',
    'predicate',
    'result',
    'reviewer',
    'subject_id',
    'timestamp',
    'validation_id',
  ]
  return (
    sameData(Object.keys(value).sort(), expectedKeys) &&
    typeof value.validation_id === 'string' &&
    value.validation_id.length > 0 &&
    value.executor === 'machine' &&
    ['character_generation', 'library_build'].includes(
      value.phase as string,
    ) &&
    typeof value.subject_id === 'string' &&
    value.subject_id.length > 0 &&
    typeof value.predicate === 'string' &&
    value.predicate.length > 0 &&
    typeof value.evidence === 'string' &&
    ['passed', 'blocked', 'warned', 'not_run'].includes(
      value.result as string,
    ) &&
    value.reviewer === 'character-generator-v0.1' &&
    value.timestamp === 'deterministic-build'
  )
}

function isInclinationDimension(
  value: unknown,
  allowedPoles: readonly string[],
): boolean {
  return (
    isRecord(value) &&
    allowedPoles.includes(value.pole as string) &&
    ['light', 'moderate', 'strong'].includes(value.strength as string)
  )
}

function isBiographyNode(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.node_id === 'string' &&
    typeof value.template_id === 'string' &&
    [
      'growth',
      'education',
      'work',
      'turning_point',
      'current_motivation',
    ].includes(value.stage as string) &&
    Number.isSafeInteger(value.age_start) &&
    Number.isSafeInteger(value.age_end) &&
    isStringArray(value.context_tags) &&
    isStringArray(value.prerequisites) &&
    Array.isArray(value.attribute_modifiers) &&
    value.attribute_modifiers.every(
      (modifier) =>
        isRecord(modifier) &&
        ATTRIBUTE_KEYS.includes(modifier.attribute as AttributeKey) &&
        (modifier.value === 1 || modifier.value === -1) &&
        typeof modifier.modifier_source_id === 'string',
    ) &&
    Array.isArray(value.skill_experience) &&
    value.skill_experience.every(
      (experience) =>
        isRecord(experience) &&
        SKILL_KEYS.includes(
          experience.skill as (typeof SKILL_KEYS)[number],
        ) &&
        [1, 2, 4, 6, 8].includes(experience.points as number) &&
        ['exposure', 'repeated', 'regular', 'major_duty', 'long_profession'].includes(
          experience.intensity as string,
        ),
    ) &&
    Array.isArray(value.qualifications) &&
    value.qualifications.every(isQualification) &&
    isStringArray(value.personality_candidates) &&
    isStringArray(value.value_and_redline_candidates) &&
    isStringArray(value.relationship_outputs) &&
    isStringArray(value.motivation_and_hooks) &&
    typeof value.evidence_text === 'string'
  )
}

function isGeneratedCharacterShape(value: unknown): value is GeneratedCharacter {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.schema_version === CHARACTER_SCHEMA_VERSION &&
    typeof value.character_id === 'string' &&
    typeof value.person_seed === 'string' &&
    /^[0-9a-f]{32}$/.test(value.person_seed) &&
    Number.isSafeInteger(value.generation_attempt) &&
    (value.generation_attempt as number) >= 0 &&
    (value.generation_attempt as number) <= 31 &&
    isRecord(value.library_generation_evidence) &&
    value.library_generation_evidence.evidence_schema_version ===
      'technical-library-provenance-v1' &&
    typeof value.library_generation_evidence.world_seed_hex === 'string' &&
    /^[0-9a-f]{64}$/.test(
      value.library_generation_evidence.world_seed_hex as string,
    ) &&
    Number.isSafeInteger(
      value.library_generation_evidence.character_index,
    ) &&
    (value.library_generation_evidence.character_index as number) >= 0 &&
    value.library_generation_evidence.generator_schema_version ===
      GENERATOR_SCHEMA_VERSION &&
    isRecord(value.library_generation_evidence.content_pack_versions) &&
    value.library_generation_evidence.content_pack_versions.biography ===
      CONTENT_PACK_VERSIONS.biography &&
    value.library_generation_evidence.content_pack_versions.traits ===
      CONTENT_PACK_VERSIONS.traits &&
    value.library_generation_evidence.content_pack_versions
      .values_and_redlines === CONTENT_PACK_VERSIONS.values_and_redlines &&
    value.library_generation_evidence.culture_pack_version ===
      CULTURE_PACK_VERSION &&
    typeof value.formal_name === 'string' &&
    isRecord(value.name_parts) &&
    typeof value.name_parts.family_name === 'string' &&
    typeof value.name_parts.given_name === 'string' &&
    value.name_parts.culture_pack_version === 'cn-frontier-draft-v0.1' &&
    Number.isSafeInteger(value.age) &&
    ['女', '男', '非二元'].includes(value.gender as string) &&
    typeof value.origin === 'string' &&
    isStringArray(value.affiliation_candidates) &&
    Array.isArray(value.address_rules) &&
    value.address_rules.every(
      (rule) =>
        isRecord(rule) &&
        ['default', 'familiar', 'recognized_experience'].includes(
          rule.relationship as string,
        ) &&
        typeof rule.form === 'string',
    ) &&
    Array.isArray(value.biography_nodes) &&
    value.biography_nodes.every(isBiographyNode) &&
    typeof value.biography_summary === 'string' &&
    hasSafeIntegerValues(value.attributes, ATTRIBUTE_KEYS) &&
    isRecord(value.seeded_variation) &&
    typeof value.seeded_variation.variation_source_id === 'string' &&
    typeof value.seeded_variation.person_seed === 'string' &&
    typeof value.seeded_variation.algorithm_version === 'string' &&
    typeof value.seeded_variation.applicability_condition === 'string' &&
    ATTRIBUTE_KEYS.includes(
      value.seeded_variation.positive_attribute as AttributeKey,
    ) &&
    ATTRIBUTE_KEYS.includes(
      value.seeded_variation.negative_attribute as AttributeKey,
    ) &&
    typeof value.seeded_variation.positive_value === 'number' &&
    typeof value.seeded_variation.negative_value === 'number' &&
    hasSafeIntegerValues(value.skills, SKILL_KEYS) &&
    Array.isArray(value.primary_skills) &&
    value.primary_skills.every(
      (skill) => typeof skill === 'string' && SKILL_KEYS.includes(skill as SkillKey),
    ) &&
    Array.isArray(value.qualifications) &&
    value.qualifications.every(isQualification) &&
    isRecord(value.mbti) &&
    MBTI_TYPES.includes(value.mbti.type as (typeof MBTI_TYPES)[number]) &&
    isRecord(value.mbti.dimensions) &&
    isInclinationDimension(value.mbti.dimensions.energy, ['E', 'I']) &&
    isInclinationDimension(value.mbti.dimensions.information, ['S', 'N']) &&
    isInclinationDimension(value.mbti.dimensions.decision, ['T', 'F']) &&
    isInclinationDimension(value.mbti.dimensions.structure, ['J', 'P']) &&
    typeof value.mbti.behavior_summary === 'string' &&
    isStringArray(value.traits) &&
    typeof value.stress_response === 'string' &&
    Array.isArray(value.core_values) &&
    value.core_values.every(
      (coreValue) =>
        isRecord(coreValue) &&
        typeof coreValue.value_id === 'string' &&
        typeof coreValue.summary === 'string' &&
        isStringArray(coreValue.source_ids),
    ) &&
    Array.isArray(value.redlines) &&
    value.redlines.every(
      (redline) =>
        isRecord(redline) &&
        typeof redline.redline_id === 'string' &&
        typeof redline.summary === 'string' &&
        isStringArray(redline.trigger_action_tags) &&
        isStringArray(redline.forbidden_action_tags) &&
        isStringArray(redline.allowed_alternative_tags) &&
        typeof redline.threshold === 'string' &&
        ['daily', 'medical', 'defense', 'diplomacy', 'logistics'].includes(
          redline.scope as string,
        ) &&
        isStringArray(redline.source_ids) &&
        redline.disclosed_at === 'character_join_preview',
    ) &&
    typeof value.current_motivation === 'string' &&
    isStringArray(value.relationship_hooks) &&
    typeof value.long_term_goal === 'string' &&
    typeof value.request_seed === 'string' &&
    typeof value.distinction_fingerprint === 'string' &&
    isRecord(value.review_status) &&
    ['not_evaluated', 'passed', 'blocked'].includes(
      value.review_status.implemented_character_contracts as string,
    ) &&
    value.review_status.E01_naming_review === 'not_run' &&
    value.review_status.E02_to_E06_content_review === 'not_run'
  )
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

const MINIMUM_SKILL_DURATION_YEARS: Record<
  SkillExperience['intensity'],
  number
> = {
  exposure: 0,
  repeated: 1,
  regular: 2,
  major_duty: 5,
  long_profession: 10,
}

function recomputePrimarySkills(skills: SkillValues): readonly SkillKey[] {
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

function pickAvailableAttribute(
  startIndex: number,
  excluded: ReadonlySet<AttributeKey>,
): AttributeKey {
  for (let offset = 0; offset < ATTRIBUTE_KEYS.length; offset += 1) {
    const candidate =
      ATTRIBUTE_KEYS[(startIndex + offset) % ATTRIBUTE_KEYS.length]
    if (!excluded.has(candidate)) {
      return candidate
    }
  }
  throw new Error('no attribute remains after exclusions')
}

function expectedModifiers(
  nodeId: string,
  entries: readonly (readonly [AttributeKey, -1 | 1])[],
): readonly {
  attribute: AttributeKey
  value: -1 | 1
  modifier_source_id: string
}[] {
  return entries.map(([attribute, value]) => ({
    attribute,
    value,
    modifier_source_id: nodeId,
  }))
}

function sameData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => sameData(item, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) {
    return false
  }
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return (
    sameData(leftKeys, rightKeys) &&
    leftKeys.every((key) => sameData(left[key], right[key]))
  )
}

export function machineFinding(
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

export function validateCharacter(
  subject: unknown,
): readonly ValidationFinding[] {
  if (!isGeneratedCharacterShape(subject)) {
    const subjectId =
      isRecord(subject) && typeof subject.character_id === 'string'
        ? subject.character_id
        : 'unknown-character'
    return [
      machineFinding(
        'M03',
        'character_generation',
        subjectId,
        '稳定身份、正式姓名、履历和必填人物字段存在，且无外号或旧代号字段',
        'required_character_field_or_nested_shape_missing=true',
        false,
      ),
    ]
  }

  const character = subject
  const nodeIds = new Set(character.biography_nodes.map((node) => node.node_id))
  const valueIds = new Set(character.core_values.map((value) => value.value_id))
  const stableSourceIds = new Set([...nodeIds, ...valueIds])
  const workNodes = character.biography_nodes.slice(2, -2)
  const stageSequenceValid =
    character.biography_nodes[0]?.stage === 'growth' &&
    character.biography_nodes[1]?.stage === 'education' &&
    workNodes.length >= 1 &&
    workNodes.length <= 3 &&
    workNodes.every((node) => node.stage === 'work') &&
    character.biography_nodes.at(-2)?.stage === 'turning_point' &&
    character.biography_nodes.at(-1)?.stage === 'current_motivation'
  const sourceReferencesValid =
    valueIds.size === character.core_values.length &&
    character.core_values.every(
      (value) =>
        value.value_id.length > 0 &&
        value.summary.length > 0 &&
        value.source_ids.length > 0 &&
        value.source_ids.every((sourceId) => nodeIds.has(sourceId)),
    ) &&
    character.redlines.every(
      (redline) =>
        redline.source_ids.length > 0 &&
        redline.source_ids.every((sourceId) => stableSourceIds.has(sourceId)),
    )
  const requiredFieldsPresent =
    character.character_id.length > 0 &&
    character.person_seed.length === 32 &&
    character.formal_name.length > 0 &&
    character.name_parts.family_name.length > 0 &&
    character.name_parts.given_name.length > 0 &&
    character.age >= 0 &&
    character.origin.length > 0 &&
    character.affiliation_candidates.length > 0 &&
    character.address_rules.length > 0 &&
    stageSequenceValid &&
    character.biography_summary.length > 0 &&
    character.primary_skills.length > 0 &&
    character.traits.length >= 1 &&
    character.traits.length <= 2 &&
    character.traits.every((trait) => trait.length > 0) &&
    character.stress_response.length > 0 &&
    character.core_values.length >= 1 &&
    character.core_values.length <= 2 &&
    sourceReferencesValid &&
    character.redlines.length >= 1 &&
    character.current_motivation.length > 0 &&
    character.relationship_hooks.length > 0 &&
    character.long_term_goal.length > 0 &&
    character.request_seed.length > 0 &&
    character.distinction_fingerprint.length > 0
  const forbiddenFieldsAbsent = ![
    'nickname',
    'alias',
    'codename',
    'old_codename',
  ].some((key) => key in character)

  const chronologyValid = character.biography_nodes.every(
    (node, index, nodes) => {
      if (
        node.age_start < 0 ||
        node.age_end < node.age_start ||
        node.age_end > character.age
      ) {
        return false
      }
      if (index === 0) {
        return node.age_start === 0
      }
      return nodes[index - 1].age_end <= node.age_start
    },
  )
  const skillExperienceDurationsValid = character.biography_nodes.every(
    (node) => {
      const durationYears = node.age_end - node.age_start
      return node.skill_experience.every(
        (experience) =>
          durationYears >=
          MINIMUM_SKILL_DURATION_YEARS[experience.intensity],
      )
    },
  )
  const prerequisitesValid =
    nodeIds.size === character.biography_nodes.length &&
    character.biography_nodes.every((node, index, nodes) => {
      const earlierNodeIds = new Set(
        nodes.slice(0, index).map((earlierNode) => earlierNode.node_id),
      )
      return node.prerequisites.every((prerequisite) =>
        earlierNodeIds.has(prerequisite),
      )
    })
  const growthNode = character.biography_nodes.find(
    (node) => node.stage === 'growth',
  )
  const growthTemplate = GROWTH_TEMPLATES.find(
    (template) => template.id === growthNode?.template_id,
  )
  const educationNode = character.biography_nodes.find(
    (node) => node.stage === 'education',
  )
  const educationTemplate = EDUCATION_TEMPLATES.find(
    (template) => template.id === educationNode?.template_id,
  )
  const workNode = workNodes[0]
  const workTemplate = WORK_TEMPLATES.find(
    (template) => template.id === workNode?.template_id,
  )
  const turningNode = character.biography_nodes.find(
    (node) => node.stage === 'turning_point',
  )
  const turningTemplate = TURNING_TEMPLATES.find(
    (template) => template.id === turningNode?.template_id,
  )
  const motivationNode = character.biography_nodes.find(
    (node) => node.stage === 'current_motivation',
  )
  const motivationTemplate = MOTIVATION_TEMPLATES.find(
    (template) => template.id === motivationNode?.template_id,
  )
  const versionedTemplateIds = {
    growth: new Set(GROWTH_TEMPLATES.map((template) => template.id)),
    education: new Set(EDUCATION_TEMPLATES.map((template) => template.id)),
    work: new Set(WORK_TEMPLATES.map((template) => template.id)),
    turning_point: new Set(
      TURNING_TEMPLATES.map((template) => template.id),
    ),
    current_motivation: new Set(
      MOTIVATION_TEMPLATES.map((template) => template.id),
    ),
  }
  const biographyTemplateIdsVersioned = character.biography_nodes.every(
    (node) => versionedTemplateIds[node.stage].has(node.template_id),
  )
  const biographyTemplateEvidenceValid = character.biography_nodes.every(
    (node) => {
      if (node.stage === 'growth') {
        return (
          GROWTH_TEMPLATES.find(
            (template) => template.id === node.template_id,
          )?.evidence === node.evidence_text
        )
      }
      if (node.stage === 'education') {
        return (
          EDUCATION_TEMPLATES.find(
            (template) => template.id === node.template_id,
          )?.evidence === node.evidence_text
        )
      }
      if (node.stage === 'work') {
        return (
          WORK_TEMPLATES.find(
            (template) => template.id === node.template_id,
          )?.evidence === node.evidence_text
        )
      }
      if (node.stage === 'turning_point') {
        return (
          TURNING_TEMPLATES.find(
            (template) => template.id === node.template_id,
          )?.evidence === node.evidence_text
        )
      }
      const motivation = MOTIVATION_TEMPLATES.find(
        (template) => template.id === node.template_id,
      )
      return (
        motivation !== undefined &&
        node.evidence_text ===
          `${motivation.motivation}；希望${motivation.goal}。`
      )
    },
  )
  const biographySummaryValid =
    character.biography_summary ===
    character.biography_nodes.map((node) => node.evidence_text).join(' ')
  const originProvenanceValid =
    growthNode !== undefined &&
    growthTemplate !== undefined &&
    character.origin === growthTemplate.context &&
    growthNode.context_tags[0] === growthTemplate.context &&
    growthNode.context_tags.includes('growth')
  const growthTemplateOutputsValid =
    growthNode !== undefined &&
    growthTemplate !== undefined &&
    sameData(growthNode.context_tags, [growthTemplate.context, 'growth']) &&
    sameData(growthNode.attribute_modifiers, [
        {
          attribute: growthTemplate.positive,
          value: 1,
          modifier_source_id: growthNode.node_id,
        },
        {
          attribute: growthTemplate.negative,
          value: -1,
          modifier_source_id: growthNode.node_id,
        },
      ]) &&
    sameData(growthNode.skill_experience, [
        {
          skill: growthTemplate.skill,
          points: 2,
          intensity: 'repeated',
        },
      ]) &&
    growthNode.qualifications.length === 0 &&
    sameData(growthNode.personality_candidates, [growthTemplate.trait]) &&
    growthNode.value_and_redline_candidates.length === 0 &&
    sameData(growthNode.relationship_outputs, ['家庭与成长地关系']) &&
    growthNode.motivation_and_hooks.length === 0 &&
    growthNode.evidence_text === growthTemplate.evidence &&
    character.traits[0] === growthTemplate.trait
  const characterIndex =
    character.library_generation_evidence.character_index
  const attributeProfile = characterIndex % 5
  const educationTemplateOutputsValid = (() => {
    if (educationNode === undefined || educationTemplate === undefined) {
      return false
    }
    const modifierEntries: [AttributeKey, -1 | 1][] =
      attributeProfile <= 1 ? [] : [[educationTemplate.attribute, 1]]
    if (attributeProfile === 4) {
      modifierEntries.push([
        pickAvailableAttribute(
          characterIndex + 1,
          new Set([educationTemplate.attribute]),
        ),
        1,
      ])
    }
    return (
      sameData(educationNode.context_tags, [
        'education',
        educationTemplate.primary,
      ]) &&
      sameData(
        educationNode.attribute_modifiers,
        expectedModifiers(educationNode.node_id, modifierEntries),
      ) &&
      sameData(educationNode.skill_experience, [
        {
          skill: educationTemplate.primary,
          points: 4,
          intensity: 'regular',
        },
        {
          skill: educationTemplate.secondary,
          points: 2,
          intensity: 'repeated',
        },
      ]) &&
      sameData(educationNode.qualifications, [
        {
          qualification_id: educationTemplate.qualificationId,
          rank: 1,
          source_node_id: educationNode.node_id,
          evidence: educationTemplate.qualificationEvidence,
        },
      ]) &&
      sameData(educationNode.personality_candidates, [
        '愿意按训练流程复核基础动作',
      ]) &&
      educationNode.value_and_redline_candidates.length === 0 &&
      sameData(educationNode.relationship_outputs, ['师徒或同学关系']) &&
      educationNode.motivation_and_hooks.length === 0
    )
  })()
  const workTemplateOutputsValid =
    workNodes.length > 0 &&
    workNodes.every((candidateWorkNode, workIndex) => {
      const candidateWorkTemplate = WORK_TEMPLATES.find(
        (template) => template.id === candidateWorkNode.template_id,
      )
      if (candidateWorkTemplate === undefined) {
        return false
      }
      const modifierEntries: [AttributeKey, -1 | 1][] = [
        [candidateWorkTemplate.positive, 1],
        [candidateWorkTemplate.negative, -1],
      ]
      if (workIndex === 0 && attributeProfile >= 3) {
        modifierEntries.push([
          pickAvailableAttribute(
            characterIndex + 3,
            new Set([
              candidateWorkTemplate.positive,
              candidateWorkTemplate.negative,
            ]),
          ),
          1,
        ])
      }
      const expectedWorkQualifications =
        workIndex === 0 &&
        characterIndex % 4 === 0 &&
        educationTemplate !== undefined
          ? [
              {
                qualification_id: educationTemplate.qualificationId,
                rank: 2,
                source_node_id: candidateWorkNode.node_id,
                evidence: `${educationTemplate.qualificationEvidence}，并在长期主要职责中独立使用`,
              },
            ]
          : []
      return (
        sameData(candidateWorkNode.context_tags, [
          'work',
          candidateWorkTemplate.primary,
          candidateWorkTemplate.secondary,
        ]) &&
        sameData(
          candidateWorkNode.attribute_modifiers,
          expectedModifiers(candidateWorkNode.node_id, modifierEntries),
        ) &&
        sameData(candidateWorkNode.skill_experience, [
          {
            skill: candidateWorkTemplate.primary,
            points: 6,
            intensity: 'major_duty',
          },
          {
            skill: candidateWorkTemplate.secondary,
            points: 4,
            intensity: 'regular',
          },
        ]) &&
        sameData(
          candidateWorkNode.qualifications,
          expectedWorkQualifications,
        ) &&
        sameData(candidateWorkNode.personality_candidates, [
          candidateWorkTemplate.trait,
        ]) &&
        candidateWorkNode.value_and_redline_candidates.length === 0 &&
        sameData(candidateWorkNode.relationship_outputs, [
          candidateWorkTemplate.relationship,
        ]) &&
        sameData(candidateWorkNode.motivation_and_hooks, [
          `曾任${candidateWorkTemplate.experienceTitle}`,
        ])
      )
    })
  const turningTemplateOutputsValid = (() => {
    if (
      turningNode === undefined ||
      turningTemplate === undefined ||
      growthTemplate === undefined ||
      workTemplate === undefined
    ) {
      return false
    }
    const modifierEntries: [AttributeKey, -1 | 1][] = [
      [turningTemplate.positive, 1],
      [turningTemplate.negative, -1],
    ]
    if (attributeProfile === 0) {
      modifierEntries.push([
        pickAvailableAttribute(
          characterIndex + 5,
          new Set([
            turningTemplate.positive,
            turningTemplate.negative,
            growthTemplate.negative,
            workTemplate.negative,
          ]),
        ),
        -1,
      ])
    }
    return (
      sameData(turningNode.context_tags, [
        'turning_point',
        turningTemplate.redline.scope,
      ]) &&
      sameData(
        turningNode.attribute_modifiers,
        expectedModifiers(turningNode.node_id, modifierEntries),
      ) &&
      turningNode.skill_experience.length === 0 &&
      turningNode.qualifications.length === 0 &&
      sameData(turningNode.personality_candidates, [
        '遇到相似情境时会提前说明边界',
      ]) &&
      sameData(turningNode.value_and_redline_candidates, [
        ...turningTemplate.values,
        turningTemplate.redline.summary,
      ]) &&
      sameData(turningNode.relationship_outputs, [turningTemplate.hook]) &&
      sameData(turningNode.motivation_and_hooks, [turningTemplate.hook])
    )
  })()
  const motivationTemplateOutputsValid =
    motivationNode !== undefined &&
    motivationTemplate !== undefined &&
    sameData(motivationNode.context_tags, ['current_motivation']) &&
    motivationNode.attribute_modifiers.length === 0 &&
    motivationNode.skill_experience.length === 0 &&
    motivationNode.qualifications.length === 0 &&
    motivationNode.personality_candidates.length === 0 &&
    motivationNode.value_and_redline_candidates.length === 0 &&
    sameData(motivationNode.relationship_outputs, [
      motivationTemplate.hook,
    ]) &&
    sameData(motivationNode.motivation_and_hooks, [
      motivationTemplate.motivation,
      motivationTemplate.goal,
      motivationTemplate.hook,
    ])
  const topLevelTemplateOutputsValid = (() => {
    if (
      growthTemplate === undefined ||
      educationNode === undefined ||
      educationTemplate === undefined ||
      workNode === undefined ||
      workTemplate === undefined ||
      turningNode === undefined ||
      turningTemplate === undefined ||
      motivationTemplate === undefined
    ) {
      return false
    }
    const expectedQualification =
      characterIndex % 4 === 0
        ? {
            qualification_id: educationTemplate.qualificationId,
            rank: 2,
            source_node_id: workNode.node_id,
            evidence: `${educationTemplate.qualificationEvidence}，并在长期主要职责中独立使用`,
          }
        : {
            qualification_id: educationTemplate.qualificationId,
            rank: 1,
            source_node_id: educationNode.node_id,
            evidence: educationTemplate.qualificationEvidence,
          }
    const expectedCoreValues = turningTemplate.values.map(
      (summary, index) => ({
        value_id: `${character.character_id}:value:${index}`,
        summary,
        source_ids: [turningNode.node_id],
      }),
    )
    return (
      sameData(character.traits, [growthTemplate.trait, workTemplate.trait]) &&
      sameData(character.qualifications, [expectedQualification]) &&
      sameData(character.core_values, expectedCoreValues) &&
      sameData(character.redlines, [
        {
          redline_id: `${character.character_id}:redline:${turningTemplate.id}`,
          summary: turningTemplate.redline.summary,
          trigger_action_tags: turningTemplate.redline.trigger,
          forbidden_action_tags: turningTemplate.redline.forbidden,
          allowed_alternative_tags: turningTemplate.redline.alternatives,
          threshold: turningTemplate.redline.threshold,
          scope: turningTemplate.redline.scope,
          source_ids: [
            turningNode.node_id,
            expectedCoreValues[0].value_id,
            expectedCoreValues[1].value_id,
          ],
          disclosed_at: 'character_join_preview',
        },
      ]) &&
      character.current_motivation === motivationTemplate.motivation &&
      sameData(character.relationship_hooks, [workTemplate.relationship]) &&
      character.long_term_goal === motivationTemplate.goal &&
      character.request_seed === motivationTemplate.hook
    )
  })()
  const biographyTemplateOutputsValid =
    growthTemplateOutputsValid &&
    educationTemplateOutputsValid &&
    workTemplateOutputsValid &&
    turningTemplateOutputsValid &&
    motivationTemplateOutputsValid &&
    topLevelTemplateOutputsValid

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
  const attributesBeforeVariation = { ...recomputedAttributes }
  const expectedSeededVariation =
    selectSeededVariationAttributes(attributesBeforeVariation)
  const expectedPersonSeed = deriveSeedV1('library-character', [
    character.library_generation_evidence.world_seed_hex,
    character.library_generation_evidence.character_index,
    character.library_generation_evidence.generator_schema_version,
    character.library_generation_evidence.content_pack_versions,
    character.library_generation_evidence.culture_pack_version,
  ])
  const expectedCharacterId = `char_${deriveSeedV1('character-id', [
    character.library_generation_evidence.world_seed_hex,
    character.library_generation_evidence.character_index,
  ]).slice(0, 16)}`
  const librarySeedProvenanceValid =
    character.person_seed === expectedPersonSeed &&
    character.character_id === expectedCharacterId
  recomputedAttributes[character.seeded_variation.positive_attribute] +=
    character.seeded_variation.positive_value
  recomputedAttributes[character.seeded_variation.negative_attribute] +=
    character.seeded_variation.negative_value
  const seededVariationValid =
    character.seeded_variation.variation_source_id ===
      `seed_variation:${character.character_id}:seeded-variation-v1` &&
    librarySeedProvenanceValid &&
    character.seeded_variation.person_seed === expectedPersonSeed &&
    character.seeded_variation.algorithm_version === 'seeded-variation-v1' &&
    character.seeded_variation.applicability_condition ===
      'positive_below_8_and_negative_at_least_5' &&
    character.seeded_variation.positive_attribute !==
      character.seeded_variation.negative_attribute &&
    character.seeded_variation.positive_attribute ===
      expectedSeededVariation.positiveAttribute &&
    character.seeded_variation.negative_attribute ===
      expectedSeededVariation.negativeAttribute &&
    character.seeded_variation.positive_value === 1 &&
    character.seeded_variation.negative_value === -1 &&
    attributesBeforeVariation[
      character.seeded_variation.positive_attribute
    ] < 8 &&
    attributesBeforeVariation[
      character.seeded_variation.negative_attribute
    ] >= 5
  const attributeTotal = Object.values(character.attributes).reduce(
    (sum, value) => sum + value,
    0,
  )
  const attributesValid =
    modifierSourcesValid &&
    seededVariationValid &&
    ATTRIBUTE_KEYS.every(
      (attribute) =>
        character.attributes[attribute] === recomputedAttributes[attribute] &&
        character.attributes[attribute] >= 0 &&
        character.attributes[attribute] <= 10,
    ) &&
    attributeTotal >= 32 &&
    attributeTotal <= 40 &&
    ATTRIBUTE_KEYS.filter(
      (attribute) => character.attributes[attribute] >= 8,
    ).length <= 2 &&
    ATTRIBUTE_KEYS.some((attribute) => character.attributes[attribute] <= 4)

  const extremeSourcesValid =
    ATTRIBUTE_KEYS.every((attribute) => {
      const value = character.attributes[attribute]
      if (value > 2 && value < 9) {
        return true
      }
      return character.biography_nodes.some((node) =>
        node.attribute_modifiers.some(
          (modifier) => modifier.attribute === attribute,
        ),
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
  const recomputedSkills = emptySkills()
  for (const node of character.biography_nodes) {
    for (const experience of node.skill_experience) {
      recomputedSkills[experience.skill] = Math.min(
        20,
        recomputedSkills[experience.skill] + experience.points,
      )
    }
  }
  const recomputedPrimarySkills = recomputePrimarySkills(recomputedSkills)
  const skillsDerivedValid =
    SKILL_KEYS.every(
      (skill) => character.skills[skill] === recomputedSkills[skill],
    ) &&
    character.primary_skills.length === recomputedPrimarySkills.length &&
    character.primary_skills.every(
      (skill, index) => skill === recomputedPrimarySkills[index],
    )

  const qualificationsValid =
    educationTemplate !== undefined &&
    character.qualifications.every((qualification) => {
      const expectedEvidence =
        qualification.rank === 1
          ? educationTemplate.qualificationEvidence
          : qualification.rank === 2
            ? `${educationTemplate.qualificationEvidence}，并在长期主要职责中独立使用`
            : undefined
      const expectedSourceStage =
        qualification.rank === 1 ? 'education' : 'work'
      return (
        expectedEvidence !== undefined &&
        qualification.qualification_id ===
          educationTemplate.qualificationId &&
        qualification.evidence === expectedEvidence &&
        nodeIds.has(qualification.source_node_id) &&
        character.biography_nodes.some(
          (node) =>
            node.stage === expectedSourceStage &&
            node.node_id === qualification.source_node_id &&
            node.qualifications.some(
              (nodeQualification) =>
                nodeQualification.qualification_id ===
                  qualification.qualification_id &&
                nodeQualification.rank === qualification.rank &&
                nodeQualification.source_node_id ===
                  qualification.source_node_id &&
                nodeQualification.evidence === qualification.evidence,
            ),
        )
      )
    })

  const mbtiHasNoNumericEffects =
    !('attribute_modifiers' in character.mbti) &&
    !('skill_modifiers' in character.mbti) &&
    !('profession' in character.mbti) &&
    !('morality' in character.mbti)
  const derivedMbtiType = [
    character.mbti.dimensions.energy.pole,
    character.mbti.dimensions.information.pole,
    character.mbti.dimensions.decision.pole,
    character.mbti.dimensions.structure.pole,
  ].join('')
  const mbtiConfigurationValid = character.mbti.type === derivedMbtiType

  return [
    machineFinding(
      'M03',
      'character_generation',
      character.character_id,
      '稳定身份、正式姓名、履历和必填人物字段存在，引用可解且无外号或旧代号字段',
      `required=${requiredFieldsPresent}; stage_sequence_valid=${stageSequenceValid}; source_references_valid=${sourceReferencesValid}; forbidden_fields_absent=${forbiddenFieldsAbsent}`,
      requiredFieldsPresent && forbiddenFieldsAbsent,
    ),
    machineFinding(
      'M04',
      'character_generation',
      character.character_id,
      '履历年龄区间、技能经历最低持续时间与前置节点合法；所有履历模板属于当前内容包，且出身与成长模板一致',
      `${character.biography_nodes
        .map(
          (node) =>
            `${node.node_id}:${node.age_start}-${node.age_end},prerequisites=${node.prerequisites.join(',') || 'none'}`,
        )
        .join(';')}; skill_durations_valid=${skillExperienceDurationsValid}; prerequisites_valid=${prerequisitesValid}; template_ids_versioned=${biographyTemplateIdsVersioned}; template_evidence_valid=${biographyTemplateEvidenceValid}; biography_summary_valid=${biographySummaryValid}; origin_provenance_valid=${originProvenanceValid}; template_outputs_valid=${biographyTemplateOutputsValid}`,
      chronologyValid &&
        skillExperienceDurationsValid &&
        prerequisitesValid &&
        biographyTemplateIdsVersioned &&
        biographyTemplateEvidenceValid &&
        biographySummaryValid &&
        originProvenanceValid &&
        biographyTemplateOutputsValid,
    ),
    machineFinding(
      'M05',
      'character_generation',
      character.character_id,
      '属性来源可追溯，种子差异来源与适用条件合法，值域合法且标准成年人物总和为32-40',
      `attribute_total=${attributeTotal}; modifiers_sourced=${modifierSourcesValid}; library_seed_provenance_valid=${librarySeedProvenanceValid}; seeded_variation_valid=${seededVariationValid}`,
      attributesValid,
    ),
    machineFinding(
      'M06',
      'character_generation',
      character.character_id,
      '技能与主要技能可从履历复算，极端属性和14以上技能具有长期经历来源',
      `skills_derived=${skillsDerivedValid}; extreme_attributes=${ATTRIBUTE_KEYS.filter((key) => character.attributes[key] <= 2 || character.attributes[key] >= 9).join(',') || 'none'}; expert_skills=${SKILL_KEYS.filter((key) => character.skills[key] >= 14).join(',') || 'none'}`,
      skillsDerivedValid && extremeSourcesValid,
    ),
    machineFinding(
      'M07',
      'character_generation',
      character.character_id,
      '每项专业资格的ID、rank与训练或实践履历节点完全一致',
      character.qualifications
        .map(
          (qualification) =>
            `${qualification.qualification_id}:rank${qualification.rank}@${qualification.source_node_id}`,
        )
        .join(';'),
      qualificationsValid,
    ),
    machineFinding(
      'M09',
      'character_generation',
      character.character_id,
      'MBTI类型由四维pole派生，且仅表达偏好，不写入属性、技能、职业或道德修正',
      `mbti_type=${character.mbti.type}; derived_type=${derivedMbtiType}; numeric_effect_fields=none`,
      mbtiConfigurationValid && mbtiHasNoNumericEffects,
    ),
  ]
}

export function validateCharacterLibraryContent(
  subjects: readonly unknown[],
): readonly ValidationFinding[] {
  const characters = subjects.filter(isGeneratedCharacterShape)
  const allCharactersValid = characters.length === subjects.length
  const uniqueIds = new Set(characters.map((character) => character.character_id))
  const uniqueNames = new Set(characters.map((character) => character.formal_name))
  const recomputedFingerprints = characters.map(recomputeDistinctionFingerprint)
  const uniqueRecomputedFingerprints = new Set(recomputedFingerprints)
  const storedFingerprintsMatch =
    allCharactersValid &&
    characters.every(
      (character, index) =>
        character.distinction_fingerprint === recomputedFingerprints[index],
    )
  const uniquenessPassed =
    allCharactersValid &&
    uniqueIds.size === subjects.length &&
    uniqueNames.size === subjects.length &&
    uniqueRecomputedFingerprints.size === subjects.length &&
    storedFingerprintsMatch

  const chassisKeys = characters.map(lifeHistoryChassisKey)
  const uniqueChassis = new Set(chassisKeys)
  const workBindings = characters.reduce<
    Record<string, { growth: Set<string>; goals: Set<string> }>
  >((bindings, character) => {
    const growthId =
      character.biography_nodes.find((node) => node.stage === 'growth')
        ?.template_id ?? ''
    const workId =
      character.biography_nodes.find((node) => node.stage === 'work')
        ?.template_id ?? ''
    bindings[workId] ??= { growth: new Set(), goals: new Set() }
    bindings[workId].growth.add(growthId)
    bindings[workId].goals.add(character.long_term_goal)
    return bindings
  }, {})
  const workBindingsDiverse = Object.values(workBindings).every(
    ({ growth, goals }) => growth.size >= 2 && goals.size >= 2,
  )
  const lifeHistoryDiversityPassed =
    allCharactersValid &&
    (subjects.length < 50 ||
      (uniqueChassis.size === subjects.length && workBindingsDiverse))

  return [
    machineFinding(
      'M10',
      'library_build',
      'character-library',
      '人物ID、正式姓名和从人物内容重新计算的区分度指纹均唯一，且保存值与复算值一致',
      `count=${subjects.length}; unique_ids=${uniqueIds.size}; unique_names=${uniqueNames.size}; unique_recomputed_fingerprints=${uniqueRecomputedFingerprints.size}; stored_fingerprints_match=${storedFingerprintsMatch}`,
      uniquenessPassed,
    ),
    machineFinding(
      'DIST-LIFE-HISTORY',
      'library_build',
      'character-library',
      '50人候选库的成长、工作与当前动机组合不重复，且同一工作连接多种成长背景和长期目标',
      `count=${subjects.length}; unique_life_history_chassis=${uniqueChassis.size}; work_bindings_diverse=${workBindingsDiverse}`,
      lifeHistoryDiversityPassed,
    ),
  ]
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

  return machineFinding(
    'SEED-KAT',
    'library_build',
    'seed_derivation_v1',
    '冻结的席位、周期、人物与attempt已知答案向量逐项一致',
    `actual=${actual.join(',')}; expected=${expected.join(',')}`,
    actual.every((value, index) => value === expected[index]),
  )
}

function m12NotRunFinding(): ValidationFinding {
  return {
    ...machineFinding(
      'M12',
      'library_build',
      'character-library',
      '完整GenerationContextSnapshot、generation_context_hash与席位到attempt派生证据可重放',
      'not_implemented=GenerationContextSnapshot,generation_context_hash,seat_cycle_attempt_chain,retry_evidence',
      true,
    ),
    result: 'not_run',
  }
}

function validateCharacterLibraryDistributions(
  subjects: readonly GeneratedCharacter[],
): readonly ValidationFinding[] {
  const mbtiCounts = subjects.reduce<Record<MbtiType, number>>(
    (counts, character) => {
      counts[character.mbti.type] += 1
      return counts
    },
    Object.fromEntries(MBTI_TYPES.map((type) => [type, 0])) as Record<
      MbtiType,
      number
    >,
  )
  const mbtiDistributionPassed =
    subjects.length < 50 ||
    MBTI_TYPES.every((type) => mbtiCounts[type] >= 2 && mbtiCounts[type] <= 5)
  const mbtiFinding = machineFinding(
    'DIST-MBTI',
    'library_build',
    'character-library',
    '50人候选库覆盖16种MBTI，每型2-5人',
    MBTI_TYPES.map((type) => `${type}=${mbtiCounts[type]}`).join(';'),
    mbtiDistributionPassed,
  )

  const highestSkillCounts = subjects.reduce<
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
    const highestSharedCount = Math.max(
      0,
      ...Object.values(highestSkillCounts[type]),
    )
    return {
      type,
      share: typeTotal === 0 ? 0 : highestSharedCount / typeTotal,
      counts: highestSkillCounts[type],
    }
  })
  const mbtiSkillDiversityPassed =
    subjects.length < 50 ||
    mbtiSkillShares.every(({ share }) => share <= 0.6)
  const mbtiSkillFinding: ValidationFinding = {
    ...machineFinding(
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

  const mbtiContentDiversity = subjects.reduce<
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
      group.redlines.add(
        character.redlines.map((redline) => redline.summary).join('|'),
      )
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
    subjects.length < 50 ||
    MBTI_TYPES.every((type) => {
      const minimumDistinct = Math.min(3, mbtiCounts[type])
      const group = mbtiContentDiversity[type]
      return Object.values(group).every(
        (values) => values.size >= minimumDistinct,
      )
    })
  const mbtiContentFinding: ValidationFinding = {
    ...machineFinding(
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

  const addressStructureCounts = subjects.reduce<Record<string, number>>(
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
  const largestAddressStructureCount = Math.max(
    0,
    ...Object.values(addressStructureCounts),
  )
  const addressDiversityPassed =
    subjects.length > 0 &&
    largestAddressStructureCount / subjects.length <= 0.5
  const addressFinding: ValidationFinding = {
    ...machineFinding(
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

  return [
    mbtiFinding,
    mbtiSkillFinding,
    mbtiContentFinding,
    addressFinding,
  ]
}

export function recomputeCharacterLibraryFindings(
  subjects: readonly GeneratedCharacter[],
): readonly ValidationFinding[] {
  return [
    ...subjects.flatMap(validateCharacter),
    ...validateCharacterLibraryContent(subjects),
    frozenSeedKatFinding(),
    m12NotRunFinding(),
    ...validateCharacterLibraryDistributions(subjects),
  ]
}

export function validateCharacterLibrary(
  subject: unknown,
): readonly ValidationFinding[] {
  if (!isRecord(subject) || !Array.isArray(subject.characters)) {
    return [
      machineFinding(
        'LIBRARY-SCHEMA',
        'library_build',
        'character-library',
        '候选人物库必须是包含 characters 数组的对象',
        'library_object_or_characters_array_missing=true',
        false,
      ),
    ]
  }

  const contentPackVersions = isRecord(subject.content_pack_versions)
    ? subject.content_pack_versions
    : undefined
  const diagnostics = isRecord(subject.diagnostics)
    ? subject.diagnostics
    : undefined
  const replayDiagnostic =
    diagnostics && isRecord(diagnostics.current_generator_replay)
      ? diagnostics.current_generator_replay
      : undefined
  const validation = isRecord(subject.validation)
    ? subject.validation
    : undefined
  const worldSeedHex =
    typeof subject.world_seed_hex === 'string' ? subject.world_seed_hex : ''
  const libraryShapeValid =
    sameData(Object.keys(subject).sort(), [
      'characters',
      'content_pack_versions',
      'culture_pack_version',
      'development_stage',
      'diagnostics',
      'generator_schema_version',
      'library_id',
      'schema_version',
      'seed_derivation_version',
      'status',
      'validation',
      'world_seed_hex',
    ]) &&
    subject.schema_version === LIBRARY_SCHEMA_VERSION &&
    typeof subject.library_id === 'string' &&
    subject.status === 'CANDIDATE_NOT_FROZEN' &&
    subject.development_stage === 'TECHNICAL_SPIKE_BEFORE_A1' &&
    /^[0-9a-f]{64}$/.test(worldSeedHex) &&
    subject.generator_schema_version === GENERATOR_SCHEMA_VERSION &&
    subject.seed_derivation_version === 'seed_derivation_v1' &&
    contentPackVersions !== undefined &&
    sameData(Object.keys(contentPackVersions).sort(), [
      'biography',
      'traits',
      'values_and_redlines',
    ]) &&
    contentPackVersions?.biography === CONTENT_PACK_VERSIONS.biography &&
    contentPackVersions?.traits === CONTENT_PACK_VERSIONS.traits &&
    contentPackVersions?.values_and_redlines ===
      CONTENT_PACK_VERSIONS.values_and_redlines &&
    subject.culture_pack_version === CULTURE_PACK_VERSION &&
    diagnostics !== undefined &&
    sameData(Object.keys(diagnostics).sort(), ['current_generator_replay']) &&
    replayDiagnostic !== undefined &&
    sameData(Object.keys(replayDiagnostic).sort(), [
      'authoritative',
      'evidence',
      'result',
      'scope',
    ]) &&
    replayDiagnostic.authoritative === false &&
    replayDiagnostic.scope === 'CURRENT_GENERATOR_SELF_REPLAY_ONLY' &&
    ['passed', 'blocked'].includes(replayDiagnostic.result as string) &&
    typeof replayDiagnostic.evidence === 'string' &&
    validation !== undefined &&
    sameData(Object.keys(validation).sort(), [
      'findings',
      'implemented_machine_contracts_passed',
      'implemented_machine_contracts_status',
      'manual_reviews',
      'not_run_ids',
      'scope',
      'warned_ids',
    ]) &&
    subject.characters.length >= 1 &&
    subject.characters.length <= 500

  const characters = subject.characters.filter(isGeneratedCharacterShape)
  const allCharactersValid = characters.length === subject.characters.length
  const characterRootBindingsValid =
    allCharactersValid &&
    characters.every((character, index) => {
      const evidence = character.library_generation_evidence
      return (
        evidence.world_seed_hex === worldSeedHex &&
        evidence.character_index === index &&
        evidence.generator_schema_version === subject.generator_schema_version &&
        sameData(
          evidence.content_pack_versions,
          subject.content_pack_versions,
        ) &&
        evidence.culture_pack_version === subject.culture_pack_version
      )
    })
  const expectedLibraryId = libraryShapeValid
    ? `character-library-${deriveSeedV1('library-id', [
        worldSeedHex,
        subject.characters.length,
        GENERATOR_SCHEMA_VERSION,
        CONTENT_PACK_VERSIONS,
        CULTURE_PACK_VERSION,
      ]).slice(0, 16)}`
    : ''
  const libraryIdValid =
    libraryShapeValid && subject.library_id === expectedLibraryId
  const rootBindingValid =
    libraryShapeValid &&
    characterRootBindingsValid &&
    libraryIdValid &&
    characters.every(
      (character) =>
        !validateCharacter(character).some(
          (finding) => finding.result === 'blocked',
        ),
    )
  const storedFindings =
    validation && Array.isArray(validation.findings)
      ? validation.findings.filter(isValidationFinding)
      : []
  const allStoredFindingsValid =
    validation !== undefined &&
    Array.isArray(validation.findings) &&
    storedFindings.length === validation.findings.length
  const independentlyRecomputedFindings = allCharactersValid
    ? recomputeCharacterLibraryFindings(characters)
    : []
  const expectedNotRunIds = independentlyRecomputedFindings
    .filter((finding) => finding.result === 'not_run')
    .map((finding) => finding.validation_id)
  const expectedWarnedIds = independentlyRecomputedFindings
    .filter((finding) => finding.result === 'warned')
    .map((finding) => finding.validation_id)
  const expectedImplementedMachineContractsStatus =
    !allCharactersValid ||
    independentlyRecomputedFindings.some(
      (finding) => finding.result === 'blocked',
    )
      ? 'blocked'
      : expectedWarnedIds.length > 0
        ? 'passed_with_warnings'
        : 'passed'
  const implementedMachineContractsPassed =
    expectedImplementedMachineContractsStatus === 'passed'
  const storedFindingsMatchRecomputation =
    allStoredFindingsValid &&
    sameData(storedFindings, independentlyRecomputedFindings)
  const manualReviews =
    validation && isRecord(validation.manual_reviews)
      ? validation.manual_reviews
      : undefined
  const manualReviewIds = ['E01', 'E02', 'E03', 'E04', 'E05', 'E06']
  const manualReviewsValid =
    manualReviews !== undefined &&
    Object.keys(manualReviews).length === manualReviewIds.length &&
    manualReviewIds.every((reviewId) => manualReviews[reviewId] === 'not_run')
  const notRunIdsValid =
    validation !== undefined &&
    Array.isArray(validation.not_run_ids) &&
    sameData(validation.not_run_ids, expectedNotRunIds)
  const warnedIdsValid =
    validation !== undefined &&
    Array.isArray(validation.warned_ids) &&
    sameData(validation.warned_ids, expectedWarnedIds)
  const envelopeValid =
    validation !== undefined &&
    validation.scope ===
      'TECHNICAL_CHARACTER_LIBRARY_IMPLEMENTED_CONTRACTS_ONLY' &&
    validation.implemented_machine_contracts_status ===
      expectedImplementedMachineContractsStatus &&
    validation.implemented_machine_contracts_passed ===
    implementedMachineContractsPassed &&
    warnedIdsValid &&
    notRunIdsValid &&
    manualReviewsValid &&
    storedFindingsMatchRecomputation

  return [
    machineFinding(
      'LIBRARY-SCHEMA',
      'library_build',
      'character-library',
      '候选人物库根字段、版本和characters数组满足固定schema',
      `schema=${String(subject.schema_version)}; characters=${subject.characters.length}`,
      libraryShapeValid,
    ),
    machineFinding(
      'LIBRARY-ROOT-BINDING',
      'library_build',
      'character-library',
      '每名人物的候选库生成证据绑定根seed、版本、数组位置与library ID',
      `character_root_bindings=${characterRootBindingsValid}; library_id=${String(subject.library_id)}; expected_library_id=${expectedLibraryId || 'unavailable'}`,
      rootBindingValid,
    ),
    machineFinding(
      'LIBRARY-ENVELOPE',
      'library_build',
      'character-library',
      '保存的聚合门禁仅覆盖已实现机器合同，完整M12与E01-E06保持未运行',
      `stored_findings_valid=${allStoredFindingsValid}; stored_findings=${storedFindings.length}; expected_findings=${independentlyRecomputedFindings.length}; recomputed_findings_match=${storedFindingsMatchRecomputation}; aggregate_status=${expectedImplementedMachineContractsStatus}; warned_ids_valid=${warnedIdsValid}; not_run_ids_valid=${notRunIdsValid}; manual_reviews_valid=${manualReviewsValid}`,
      envelopeValid,
    ),
  ]
}
