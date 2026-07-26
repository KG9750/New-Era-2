import { describe, expect, it } from 'vitest'

import persistedLibrary from '../../data/characters/generated-50-v0.1-candidate.json'
import {
  validateCharacter,
  validateCharacterLibraryContent,
} from '../src/characters/validator'

const library = persistedLibrary as unknown as {
  characters: Record<string, unknown>[]
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

  it('blocks forged seeded variation provenance', () => {
    const character = persistedCharacter()
    const variation = character.seeded_variation as Record<string, unknown>
    variation.variation_source_id = 'bogus'
    variation.person_seed = 'bogus'
    variation.algorithm_version = 'bogus'
    variation.applicability_condition = 'bogus'

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

  it('blocks a forged stored distinction fingerprint', () => {
    const characters = structuredClone(library.characters)
    characters[0].distinction_fingerprint = 'forged-but-unique'

    expect(
      validateCharacterLibraryContent(characters).find(
        (finding) => finding.validation_id === 'M10',
      )?.result,
    ).toBe('blocked')
  })
})
