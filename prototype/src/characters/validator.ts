import {
  lifeHistoryChassisKey,
  recomputeDistinctionFingerprint,
} from './fingerprint'
import {
  ATTRIBUTE_KEYS,
  MBTI_TYPES,
  SKILL_KEYS,
  type AttributeKey,
  type AttributeValues,
  type GeneratedCharacter,
  type SkillKey,
  type SkillValues,
  type ValidationFinding,
} from './model'

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
    value.schema_version === 'character-v0.1.1-candidate' &&
    typeof value.character_id === 'string' &&
    typeof value.person_seed === 'string' &&
    /^[0-9a-f]{32}$/.test(value.person_seed) &&
    Number.isSafeInteger(value.generation_attempt) &&
    (value.generation_attempt as number) >= 0 &&
    (value.generation_attempt as number) <= 31 &&
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
    ['pending', 'passed'].includes(
      value.review_status.machine_validation as string,
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
    character.biography_nodes.length >= 5 &&
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
  const originBridgeValid =
    growthNode?.context_tags.includes(character.origin) === true ||
    character.biography_nodes.some(
      (node) =>
        node.context_tags.includes('migration') &&
        node.context_tags.includes(character.origin),
    )

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
  recomputedAttributes[character.seeded_variation.positive_attribute] +=
    character.seeded_variation.positive_value
  recomputedAttributes[character.seeded_variation.negative_attribute] +=
    character.seeded_variation.negative_value
  const seededVariationValid =
    character.seeded_variation.variation_source_id ===
      `seed_variation:${character.character_id}:seeded-variation-v1` &&
    character.seeded_variation.person_seed === character.person_seed &&
    character.seeded_variation.algorithm_version === 'seeded-variation-v1' &&
    character.seeded_variation.applicability_condition ===
      'positive_below_8_and_negative_at_least_5' &&
    character.seeded_variation.positive_attribute !==
      character.seeded_variation.negative_attribute &&
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

  const qualificationsValid = character.qualifications.every(
    (qualification) =>
      qualification.rank >= 1 &&
      qualification.rank <= 3 &&
      nodeIds.has(qualification.source_node_id) &&
      character.biography_nodes.some(
        (node) =>
          (node.stage === 'education' || node.stage === 'work') &&
          node.node_id === qualification.source_node_id &&
          node.qualifications.some(
            (nodeQualification) =>
              nodeQualification.qualification_id ===
                qualification.qualification_id &&
              nodeQualification.rank === qualification.rank &&
              nodeQualification.source_node_id ===
                qualification.source_node_id &&
              nodeQualification.evidence.length > 0,
          ),
      ),
  )

  const mbtiHasNoNumericEffects =
    !('attribute_modifiers' in character.mbti) &&
    !('skill_modifiers' in character.mbti) &&
    !('profession' in character.mbti) &&
    !('morality' in character.mbti)

  return [
    machineFinding(
      'M03',
      'character_generation',
      character.character_id,
      '稳定身份、正式姓名、履历和必填人物字段存在，引用可解且无外号或旧代号字段',
      `required=${requiredFieldsPresent}; source_references_valid=${sourceReferencesValid}; forbidden_fields_absent=${forbiddenFieldsAbsent}`,
      requiredFieldsPresent && forbiddenFieldsAbsent,
    ),
    machineFinding(
      'M04',
      'character_generation',
      character.character_id,
      '履历年龄区间与前置节点合法；出身与成长地一致或存在迁移桥接',
      `${character.biography_nodes
        .map(
          (node) =>
            `${node.node_id}:${node.age_start}-${node.age_end},prerequisites=${node.prerequisites.join(',') || 'none'}`,
        )
        .join(';')}; prerequisites_valid=${prerequisitesValid}; origin_bridge_valid=${originBridgeValid}`,
      chronologyValid && prerequisitesValid && originBridgeValid,
    ),
    machineFinding(
      'M05',
      'character_generation',
      character.character_id,
      '属性来源可追溯，种子差异来源与适用条件合法，值域合法且标准成年人物总和为32-40',
      `attribute_total=${attributeTotal}; modifiers_sourced=${modifierSourcesValid}; seeded_variation_valid=${seededVariationValid}`,
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
      'MBTI仅表达偏好，不写入属性、技能、职业或道德修正',
      `mbti_type=${character.mbti.type}; numeric_effect_fields=none`,
      mbtiHasNoNumericEffects,
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
