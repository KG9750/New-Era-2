import { describe, expect, it } from 'vitest'

import persistedLibrary from '../../data/characters/generated-50-v0.1-candidate.json'
import { ATTRIBUTE_KEYS } from '../src/characters/model'
import {
  validateCharacter,
  validateCharacterLibraryContent,
} from '../src/characters/validator'

const library = persistedLibrary as unknown as {
  characters: Record<string, unknown>[]
  validation: Record<string, unknown>
}

function persistedCharacter(index = 0): Record<string, unknown> {
  return structuredClone(library.characters[index])
}

function result(subject: unknown, validationId: string): string | undefined {
  return validateCharacter(subject).find(
    (finding) => finding.validation_id === validationId,
  )?.result
}

describe('independent character contract validator', () => {
  it('scopes aggregate validation to implemented contracts and exposes not-run IDs', () => {
    expect(library.validation).not.toHaveProperty('machine_passed')
    expect(library.validation.implemented_machine_contracts_passed).toBe(true)
    expect(library.validation.not_run_ids).toEqual(['M12'])
    expect(library.validation.scope).toBe(
      'TECHNICAL_CHARACTER_LIBRARY_IMPLEMENTED_CONTRACTS_ONLY',
    )
  })

  it('accepts the persisted candidate library without calling the generator', () => {
    expect(
      library.characters.flatMap(validateCharacter).some(
        (finding) => finding.result === 'blocked',
      ),
    ).toBe(false)
    expect(
      validateCharacterLibraryContent(library.characters).some(
        (finding) => finding.result === 'blocked',
      ),
    ).toBe(false)
  })

  it('blocks missing required fields and dangling redline references', () => {
    for (const field of [
      'name_parts',
      'address_rules',
      'traits',
      'stress_response',
      'core_values',
      'redlines',
    ]) {
      const character = persistedCharacter()
      delete character[field]
      expect(result(character, 'M03'), field).toBe('blocked')
    }

    const danglingSource = persistedCharacter()
    const redline = (
      danglingSource.redlines as Record<string, unknown>[]
    )[0]
    redline.source_ids = ['missing-source-id']
    expect(result(danglingSource, 'M03')).toBe('blocked')
  })

  it('blocks invalid biography prerequisites and unbridged origins', () => {
    const invalidPrerequisite = persistedCharacter()
    const biographyNodes =
      invalidPrerequisite.biography_nodes as Record<string, unknown>[]
    biographyNodes[1].prerequisites = ['missing-node-id']
    expect(result(invalidPrerequisite, 'M04')).toBe('blocked')

    const unbridgedOrigin = persistedCharacter()
    unbridgedOrigin.origin = '没有履历桥接的异地出身'
    expect(result(unbridgedOrigin, 'M04')).toBe('blocked')
  })

  it('does not accept free-form context tags as migration provenance', () => {
    const character = persistedCharacter()
    character.origin = '伪造迁移目的地'
    const biographyNodes =
      character.biography_nodes as Record<string, unknown>[]
    biographyNodes[1].context_tags = [
      'education',
      'migration',
      character.origin,
    ]

    expect(result(character, 'M04')).toBe('blocked')
  })

  it('blocks a biography that omits a required life stage', () => {
    const character = persistedCharacter()
    const biographyNodes =
      character.biography_nodes as Record<string, unknown>[]
    biographyNodes[1].stage = 'work'

    expect(result(character, 'M03')).toBe('blocked')
  })

  it('blocks an MBTI type that disagrees with its four dimension poles', () => {
    const character = persistedCharacter()
    const mbti = character.mbti as {
      type: string
      dimensions: Record<string, { pole: string }>
    }
    const derivedType = [
      mbti.dimensions.energy.pole,
      mbti.dimensions.information.pole,
      mbti.dimensions.decision.pole,
      mbti.dimensions.structure.pole,
    ].join('')
    mbti.type = derivedType === 'ENTJ' ? 'INTJ' : 'ENTJ'

    expect(result(character, 'M09')).toBe('blocked')
  })

  it('blocks forged seeded variation provenance', () => {
    const character = persistedCharacter()
    const variation = character.seeded_variation as Record<string, unknown>
    variation.variation_source_id = 'bogus'
    variation.person_seed = 'bogus'
    variation.algorithm_version = 'bogus'
    variation.applicability_condition = 'bogus'

    expect(result(character, 'M05')).toBe('blocked')
  })

  it('blocks a coordinated alternative seeded-variation attribute pair', () => {
    const character = persistedCharacter()
    const attributes = character.attributes as Record<string, number>
    const variation = character.seeded_variation as Record<string, unknown>
    const originalPositive = variation.positive_attribute as string
    const originalNegative = variation.negative_attribute as string
    const attributesBeforeVariation = { ...attributes }
    attributesBeforeVariation[originalPositive] -= 1
    attributesBeforeVariation[originalNegative] += 1
    const alternativePositive = ATTRIBUTE_KEYS.find(
      (attribute) =>
        attribute !== originalPositive &&
        attribute !== originalNegative &&
        attributesBeforeVariation[attribute] < 8,
    )
    expect(alternativePositive).toBeDefined()

    Object.assign(attributes, attributesBeforeVariation)
    attributes[alternativePositive!] += 1
    attributes[originalNegative] -= 1
    variation.positive_attribute = alternativePositive

    expect(result(character, 'M05')).toBe('blocked')
  })

  it('blocks coordinated character and variation person-seed forgery', () => {
    const character = persistedCharacter()
    const forgedPersonSeed = '1'.repeat(32)
    character.person_seed = forgedPersonSeed
    const variation = character.seeded_variation as Record<string, unknown>
    variation.person_seed = forgedPersonSeed

    expect(result(character, 'M05')).toBe('blocked')
  })

  it('blocks skills and qualifications that exceed their biography evidence', () => {
    const invalidSkill = persistedCharacter()
    const skills = invalidSkill.skills as Record<string, number>
    skills.生产 += 1
    expect(result(invalidSkill, 'M06')).toBe('blocked')

    const invalidQualification = persistedCharacter()
    const qualifications =
      invalidQualification.qualifications as Record<string, unknown>[]
    qualifications[0].rank = 3
    expect(result(invalidQualification, 'M07')).toBe('blocked')
  })

  it('blocks qualification evidence that differs from its source node', () => {
    for (const forgedEvidence of ['', '与来源节点无关的任意资格说明']) {
      const character = persistedCharacter()
      const qualifications =
        character.qualifications as Record<string, unknown>[]
      qualifications[0].evidence = forgedEvidence

      expect(result(character, 'M07'), forgedEvidence).toBe('blocked')
    }
  })

  it('blocks a forged stored distinction fingerprint', () => {
    const characters = structuredClone(library.characters)
    characters[0].distinction_fingerprint = 'forged-but-unique'

    expect(
      validateCharacterLibraryContent(characters).find(
        (finding) => finding.validation_id === 'M10',
      )?.result,
    ).toBe('blocked')
  })

  it('matches a fixed distinction fingerprint known-answer value', () => {
    expect(library.characters[0].distinction_fingerprint).toBe(
      'distinction-v2:[["growth-watch-quarter","education-community-teaching","work-council-facilitator","turn-ledger-falsification","motivation-water-restoration"],["交涉"],"ESFP",["moderate","light","light","light"],["公共账目必须可核验","短缺不能通过删除记录消失"],["拒绝删除或伪造公共资源的权威记录"],"相信附近一套废弃供水设施仍有恢复价值"]',
    )
  })

  it('blocks duplicate fingerprint semantics with different stored values', () => {
    const characters = structuredClone(library.characters)
    for (const field of [
      'biography_nodes',
      'primary_skills',
      'mbti',
      'core_values',
      'redlines',
      'current_motivation',
    ]) {
      characters[1][field] = structuredClone(characters[0][field])
    }
    characters[1].distinction_fingerprint = 'forged-but-unique'

    expect(
      validateCharacterLibraryContent(characters).find(
        (finding) => finding.validation_id === 'M10',
      )?.result,
    ).toBe('blocked')
  })
})
