import { describe, expect, it } from 'vitest'

import persistedLibrary from '../../data/characters/generated-50-v0.1-candidate.json'
import persistedSampleLibrary from '../../data/characters/sample-12-v0.1-draft.json'
import {
  createCharacterSampleLibrary,
  validateCharacterSampleLibrary,
} from '../src/characters/sample-library'
import type { CharacterLibrary } from '../src/characters/model'

const sourceLibrary = persistedLibrary as unknown as CharacterLibrary

function result(
  subject: unknown,
  validationId: string,
): string | undefined {
  return validateCharacterSampleLibrary(subject, sourceLibrary).find(
    (finding) => finding.validation_id === validationId,
  )?.result
}

describe('12-person character sample library', () => {
  it('rebuilds the persisted sample artifact byte-for-structure', () => {
    const rebuilt = createCharacterSampleLibrary(sourceLibrary)

    expect(persistedSampleLibrary).toEqual(rebuilt)
    expect(
      validateCharacterSampleLibrary(persistedSampleLibrary, sourceLibrary),
    ).toEqual(rebuilt.validation.findings)
  })

  it('builds six same-MBTI contrast pairs with balanced dimensions', () => {
    const library = createCharacterSampleLibrary(sourceLibrary)

    expect(library.samples).toHaveLength(12)
    expect(library.validation.machine_structure_passed).toBe(true)
    expect(validateCharacterSampleLibrary(library, sourceLibrary)).toEqual(
      library.validation.findings,
    )

    const counts = library.samples.reduce<Record<string, number>>(
      (all, sample) => {
        all[sample.internal_mbti_type] =
          (all[sample.internal_mbti_type] ?? 0) + 1
        return all
      },
      {},
    )
    expect(counts).toEqual({
      ISTJ: 2,
      INTJ: 2,
      ISFP: 2,
      ENFP: 2,
      ESFJ: 2,
      ENTP: 2,
    })
  })

  it('covers all eight broad skills without defining present-day jobs', () => {
    const library = createCharacterSampleLibrary(sourceLibrary)
    const covered = new Set(
      library.samples.flatMap((sample) => sample.primary_skills),
    )

    expect([...covered].sort()).toEqual(
      ['生产', '工程', '医疗', '后勤', '侦察', '防卫', '交涉', '研究'].sort(),
    )
    expect(JSON.stringify(library)).not.toMatch(
      /"current_job"|"fixed_role"|"profession_role"/,
    )
  })

  it('keeps human gates open and hides MBTI codes from player cards', () => {
    const library = createCharacterSampleLibrary(sourceLibrary)

    expect(library.status).toBe('DRAFT_BEFORE_A1')
    expect(library.gate_dependency.formal_a1_status).toBe('NOT_STARTED')
    expect(
      Object.values(library.validation.manual_reviews),
    ).toEqual(Array(7).fill('not_run'))
    expect(
      library.samples.every(
        (sample) =>
          sample.mbti_display_policy ===
            'HIDDEN_IN_PLAYER_CARD_UNTIL_VALIDATED' &&
          Object.values(sample.manual_review_status).every(
            (status) => status === 'not_run',
          ),
      ),
    ).toBe(true)
  })

  it('blocks a forged source binding', () => {
    const library = structuredClone(
      createCharacterSampleLibrary(sourceLibrary),
    )
    library.samples[0].formal_name = '伪造姓名'

    expect(result(library, 'S02-SOURCE-BINDING')).toBe('blocked')

    const forgedBiography = structuredClone(
      createCharacterSampleLibrary(sourceLibrary),
    )
    forgedBiography.samples[0].source_biography_summary = '协调伪造的来源履历'
    expect(result(forgedBiography, 'S02-SOURCE-BINDING')).toBe('blocked')
  })

  it('blocks a missing same-type counterpart', () => {
    const library = structuredClone(
      createCharacterSampleLibrary(sourceLibrary),
    )
    library.samples[0].counterpart_source_character_id =
      library.samples[2].source_character_id

    expect(result(library, 'S03-SAME-TYPE-PAIRS')).toBe('blocked')
  })

  it('blocks missing editorial content or nickname-like fields', () => {
    const missingContent = structuredClone(
      createCharacterSampleLibrary(sourceLibrary),
    )
    missingContent.samples[0].decision_scene.setup = ''
    expect(result(missingContent, 'S06-CONTENT-COMPLETENESS')).toBe(
      'blocked',
    )

    const withNickname = structuredClone(
      createCharacterSampleLibrary(sourceLibrary),
    ) as unknown as {
      samples: (Record<string, unknown> & { nickname?: string })[]
    }
    withNickname.samples[0].nickname = '旧代号'
    expect(result(withNickname, 'S01-SCHEMA')).toBe('blocked')
    expect(result(withNickname, 'S06-CONTENT-COMPLETENESS')).toBe(
      'blocked',
    )
  })

  it('blocks forged manual review completion and validation summaries', () => {
    const library = structuredClone(
      createCharacterSampleLibrary(sourceLibrary),
    ) as unknown as {
      samples: {
        manual_review_status: Record<string, string>
      }[]
      validation: {
        machine_structure_passed: boolean
        manual_reviews: Record<string, string>
      }
    }
    library.samples[0].manual_review_status.E01_naming = 'passed'
    library.validation.manual_reviews.E01 = 'passed'
    library.validation.machine_structure_passed = true

    expect(result(library, 'S07-GATE-HONESTY')).toBe('blocked')
    expect(result(library, 'S01-SCHEMA')).toBe('blocked')
  })

  it('blocks undeclared nested authority fields', () => {
    const library = structuredClone(
      createCharacterSampleLibrary(sourceLibrary),
    ) as unknown as {
      gate_dependency: Record<string, unknown>
      samples: {
        decision_scene: Record<string, unknown>
        manual_review_status: Record<string, unknown>
      }[]
      validation: Record<string, unknown> & {
        manual_reviews: Record<string, unknown>
      }
    }
    library.gate_dependency.a1_passed = true
    library.samples[0].decision_scene.release_status = 'approved'
    library.samples[0].manual_review_status.release_status = 'approved'
    library.validation.release_status = 'approved'
    library.validation.manual_reviews.release_status = 'approved'

    expect(result(library, 'S01-SCHEMA')).toBe('blocked')
  })
})
