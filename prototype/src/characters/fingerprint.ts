import type {
  GeneratedCharacter,
  InclinationStrength,
  MbtiType,
  SkillKey,
} from './model'

interface DistinctionFingerprintInput {
  biographyTemplateIds: readonly string[]
  primarySkills: readonly SkillKey[]
  mbtiType: MbtiType
  mbtiStrengths: readonly InclinationStrength[]
  coreValueSummaries: readonly string[]
  redlineSummaries: readonly string[]
  currentMotivation: string
}

export function computeDistinctionFingerprint(
  input: DistinctionFingerprintInput,
): string {
  return `distinction-v2:${JSON.stringify([
    input.biographyTemplateIds,
    input.primarySkills,
    input.mbtiType,
    input.mbtiStrengths,
    input.coreValueSummaries,
    input.redlineSummaries,
    input.currentMotivation,
  ])}`
}

export function recomputeDistinctionFingerprint(
  character: GeneratedCharacter,
): string {
  return computeDistinctionFingerprint({
    biographyTemplateIds: character.biography_nodes.map(
      (node) => node.template_id,
    ),
    primarySkills: character.primary_skills,
    mbtiType: character.mbti.type,
    mbtiStrengths: Object.values(character.mbti.dimensions).map(
      (dimension) => dimension.strength,
    ),
    coreValueSummaries: character.core_values.map((value) => value.summary),
    redlineSummaries: character.redlines.map((redline) => redline.summary),
    currentMotivation: character.current_motivation,
  })
}

export function lifeHistoryChassisKey(character: GeneratedCharacter): string {
  return character.biography_nodes
    .filter((node) =>
      ['growth', 'work', 'current_motivation'].includes(node.stage),
    )
    .map((node) => node.template_id)
    .join('|')
}
