export const ATTRIBUTE_KEYS = [
  '体能',
  '协调',
  '思维',
  '感知',
  '沟通',
  '意志',
  '健康',
] as const

export const SKILL_KEYS = [
  '生产',
  '工程',
  '医疗',
  '后勤',
  '侦察',
  '防卫',
  '交涉',
  '研究',
] as const

export const MBTI_TYPES = [
  'ISTJ',
  'ISFJ',
  'INFJ',
  'INTJ',
  'ISTP',
  'ISFP',
  'INFP',
  'INTP',
  'ESTP',
  'ESFP',
  'ENFP',
  'ENTP',
  'ESTJ',
  'ESFJ',
  'ENFJ',
  'ENTJ',
] as const

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]
export type SkillKey = (typeof SKILL_KEYS)[number]
export type MbtiType = (typeof MBTI_TYPES)[number]
export type InclinationStrength = 'light' | 'moderate' | 'strong'
export type BiographyStage =
  | 'growth'
  | 'education'
  | 'work'
  | 'turning_point'
  | 'current_motivation'

export type AttributeValues = Record<AttributeKey, number>
export type SkillValues = Record<SkillKey, number>

export interface AttributeModifier {
  attribute: AttributeKey
  value: -1 | 1
  modifier_source_id: string
}

export interface SkillExperience {
  skill: SkillKey
  points: 1 | 2 | 4 | 6 | 8
  intensity: 'exposure' | 'repeated' | 'regular' | 'major_duty' | 'long_profession'
}

export interface Qualification {
  qualification_id: string
  rank: 1 | 2 | 3
  source_node_id: string
  evidence: string
}

export interface BiographyNode {
  node_id: string
  template_id: string
  stage: BiographyStage
  age_start: number
  age_end: number
  context_tags: readonly string[]
  prerequisites: readonly string[]
  attribute_modifiers: readonly AttributeModifier[]
  skill_experience: readonly SkillExperience[]
  qualifications: readonly Qualification[]
  personality_candidates: readonly string[]
  value_and_redline_candidates: readonly string[]
  relationship_outputs: readonly string[]
  motivation_and_hooks: readonly string[]
  evidence_text: string
}

export interface MbtiProfile {
  type: MbtiType
  dimensions: {
    energy: { pole: 'E' | 'I'; strength: InclinationStrength }
    information: { pole: 'S' | 'N'; strength: InclinationStrength }
    decision: { pole: 'T' | 'F'; strength: InclinationStrength }
    structure: { pole: 'J' | 'P'; strength: InclinationStrength }
  }
  behavior_summary: string
}

export interface Redline {
  redline_id: string
  summary: string
  trigger_action_tags: readonly string[]
  forbidden_action_tags: readonly string[]
  allowed_alternative_tags: readonly string[]
  threshold: string
  scope: 'daily' | 'medical' | 'defense' | 'diplomacy' | 'logistics'
  source_ids: readonly string[]
  disclosed_at: 'character_join_preview'
}

export interface AddressRule {
  relationship: 'default' | 'familiar' | 'recognized_experience'
  form: string
}

export interface SeededVariation {
  variation_source_id: string
  person_seed: string
  algorithm_version: 'seeded-variation-v1'
  positive_attribute: AttributeKey
  negative_attribute: AttributeKey
  positive_value: 1
  negative_value: -1
}

export interface GeneratedCharacter {
  schema_version: 'character-v0.1-candidate'
  character_id: string
  person_seed: string
  generation_attempt: number
  formal_name: string
  name_parts: {
    family_name: string
    given_name: string
    culture_pack_version: 'cn-frontier-draft-v0.1'
  }
  age: number
  gender: '女' | '男' | '非二元'
  origin: string
  affiliation_candidates: readonly string[]
  address_rules: readonly AddressRule[]
  biography_nodes: readonly BiographyNode[]
  biography_summary: string
  attributes: AttributeValues
  seeded_variation: SeededVariation
  skills: SkillValues
  primary_skills: readonly SkillKey[]
  qualifications: readonly Qualification[]
  mbti: MbtiProfile
  traits: readonly [string, string]
  stress_response: string
  core_values: readonly [string, string]
  redlines: readonly [Redline]
  current_motivation: string
  relationship_hooks: readonly [string]
  long_term_goal: string
  request_seed: string
  distinction_fingerprint: string
  review_status: {
    machine_validation: 'pending' | 'passed'
    E01_naming_review: 'not_run'
    E02_to_E06_content_review: 'not_run'
  }
}

export interface CharacterGenerationInput {
  worldSeedHex: string
  characterIndex: number
  attemptIndex?: number
}

export interface ValidationFinding {
  validation_id: string
  executor: 'machine'
  phase: 'character_generation' | 'library_build'
  subject_id: string
  predicate: string
  evidence: string
  result: 'passed' | 'blocked' | 'warned' | 'not_run'
  reviewer: 'character-generator-v0.1'
  timestamp: 'deterministic-build'
}

export interface CharacterLibrary {
  schema_version: 'character-library-v0.1-candidate'
  library_id: string
  status: 'CANDIDATE_NOT_FROZEN'
  world_seed_hex: string
  generator_schema_version: 'char-gen-v0.1-candidate'
  seed_derivation_version: 'seed_derivation_v1'
  content_pack_versions: {
    biography: 'candidate-0.1.0'
    traits: 'candidate-0.1.0'
    values_and_redlines: 'candidate-0.1.0'
  }
  culture_pack_version: 'cn-frontier-draft-v0.1'
  characters: readonly GeneratedCharacter[]
  validation: {
    machine_passed: boolean
    findings: readonly ValidationFinding[]
    manual_reviews: {
      E01: 'not_run'
      E02: 'not_run'
      E03: 'not_run'
      E04: 'not_run'
      E05: 'not_run'
      E06: 'not_run'
    }
  }
}
