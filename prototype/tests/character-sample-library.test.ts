import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import persistedLibrary from '../../data/characters/generated-50-v0.1-candidate.json'
import { generateCharacterLibrary } from '../src/characters/generator'
import persistedSampleLibrary from '../../data/characters/sample-12-v0.1-draft.json'
import {
  createCharacterSampleLibrary,
  validateCharacterSampleLibrary,
} from '../src/characters/sample-library'
import {
  renderInternalCharacterSampleLibrary,
  renderPlayerCharacterSampleCards,
} from '../src/characters/sample-renderer'
import { MBTI_TYPES, type CharacterLibrary } from '../src/characters/model'
import { validateCharacterLibrary } from '../src/characters/validator'

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

  it('rebuilds both persisted Markdown views byte-for-byte', () => {
    const library = createCharacterSampleLibrary(sourceLibrary)
    const internalMarkdown = readFileSync(
      resolve(
        process.cwd(),
        '../data/characters/character-samples-12-v0.1-draft.md',
      ),
      'utf8',
    )
    const playerMarkdown = readFileSync(
      resolve(
        process.cwd(),
        '../data/characters/character-samples-12-v0.1-player-cards.md',
      ),
      'utf8',
    )

    expect(internalMarkdown).toBe(
      renderInternalCharacterSampleLibrary(library),
    )
    expect(playerMarkdown).toBe(renderPlayerCharacterSampleCards(library))
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

  it('crosses critical skills between E and I instead of encoding occupations', () => {
    const library = createCharacterSampleLibrary(sourceLibrary)
    const criticalSkills = ['工程', '交涉', '医疗', '研究', '防卫']

    for (const skill of criticalSkills) {
      expect(
        library.samples.some(
          (sample) =>
            sample.internal_mbti_type.startsWith('E') &&
            sample.primary_skills.includes(skill as any),
        ),
      ).toBe(true)
      expect(
        library.samples.some(
          (sample) =>
            sample.internal_mbti_type.startsWith('I') &&
            sample.primary_skills.includes(skill as any),
        ),
      ).toBe(true)
    }
    expect(
      library.validation.findings.find(
        (finding) =>
          finding.validation_id === 'S09-EI-SKILL-CONTINGENCY',
      )?.result,
    ).toBe('passed')
  })

  it('gives both decision options an explicit immediate cost and long-term risk', () => {
    const library = createCharacterSampleLibrary(sourceLibrary)
    const tradeoffFields = [
      'accept_immediate_cost',
      'accept_long_term_risk',
      'decline_immediate_cost',
      'decline_long_term_risk',
    ]

    for (const sample of library.samples) {
      const scene = sample.decision_scene as unknown as Record<string, unknown>
      for (const field of tradeoffFields) {
        expect(scene[field]).toEqual(expect.any(String))
        expect((scene[field] as string).trim().length).toBeGreaterThanOrEqual(
          8,
        )
      }
      expect(
        [
          scene.accept_choice,
          scene.accept_consequence,
          scene.decline_choice,
          scene.decline_consequence,
        ].join(''),
      ).not.toMatch(/处决投降者|劫掠无威胁|未成年.*扣走种子|平民.*诱饵|隐瞒.*感染/)
    }
  })

  it('persists content repetition above twenty percent as a warning', () => {
    const library = createCharacterSampleLibrary(sourceLibrary)
    const repetitionFinding = library.validation.findings.find(
      (finding) => finding.validation_id === 'S10-CONTENT-REPETITION',
    )

    expect(repetitionFinding?.result).toBe('warned')
    expect(repetitionFinding?.evidence).toContain('redline_max=3/12')
    expect(library.validation.machine_structure_passed).toBe(true)
  })

  it('keeps human gates open and hides MBTI codes from player cards', () => {
    const library = createCharacterSampleLibrary(sourceLibrary)
    const playerCards = renderPlayerCharacterSampleCards(library)

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
    for (const mbtiType of MBTI_TYPES) {
      expect(playerCards).not.toContain(mbtiType)
    }
    expect(playerCards).not.toContain('内部验证类型')
    expect(playerCards).not.toContain('同类型对照')
    expect(playerCards).not.toMatch(/同为 [A-Z]{4}/)
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

  it('blocks tampering with any fixed authority value', () => {
    const mutations: Array<(library: Record<string, any>) => void> = [
      (library) => {
        library.samples[0].mbti_display_policy = 'SHOW_IN_PLAYER_CARD'
      },
      (library) => {
        library.samples[1].sample_id = library.samples[0].sample_id
      },
      (library) => {
        library.samples[0].schema_version = 'forged-sample-schema'
      },
      (library) => {
        library.sample_library_id = 'forged-library-id'
      },
      (library) => {
        library.culture_pack_version = 'forged-culture-pack'
      },
      (library) => {
        library.purpose = 'A1_ALREADY_PASSED'
      },
      (library) => {
        library.gate_dependency.note = 'A1 与 E01-E06 已通过'
      },
      (library) => {
        library.samples[0].counterpart_source_character_id =
          library.samples[0].source_character_id
        library.samples[1].counterpart_source_character_id =
          library.samples[1].source_character_id
      },
      (library) => {
        library.samples[0].pair_id = 'pair-forged'
        library.samples[1].pair_id = 'pair-forged'
        library.validation.findings.find(
          (finding: Record<string, any>) =>
            finding.validation_id === 'S03-SAME-TYPE-PAIRS',
        ).evidence =
          'pair-enfp=2,pair-entp=2,pair-esfj=2,pair-forged=2,pair-intj=2,pair-isfp=2'
      },
      (library) => {
        const first = library.samples[0]
        library.samples[0] = library.samples[1]
        library.samples[1] = first
        library.samples[0].sample_id = 'sample_01'
        library.samples[1].sample_id = 'sample_02'
      },
      (library) => {
        library.samples[0].revised_biography =
          '这是一段长度足够、但没有绑定固定编修草案的协调伪造履历。'
      },
    ]

    for (const mutate of mutations) {
      const library = structuredClone(
        createCharacterSampleLibrary(sourceLibrary),
      ) as unknown as Record<string, any>
      mutate(library)

      expect(
        validateCharacterSampleLibrary(library, sourceLibrary).some(
          (finding) => finding.result === 'blocked',
        ),
      ).toBe(true)
    }
  })

  it('blocks a sample when its supplied source library is invalid', () => {
    const library = structuredClone(
      createCharacterSampleLibrary(sourceLibrary),
    )
    const forgedSource = structuredClone(sourceLibrary)
    forgedSource.characters[0].formal_name = '协调伪造姓名'
    const sourceCharacterId = forgedSource.characters[0].character_id
    const sample = library.samples.find(
      (candidate) => candidate.source_character_id === sourceCharacterId,
    )
    if (sample !== undefined) {
      sample.formal_name = '协调伪造姓名'
    }

    expect(
      validateCharacterSampleLibrary(library, forgedSource).some(
        (finding) => finding.result === 'blocked',
      ),
    ).toBe(true)
  })

  it('returns blocked findings instead of throwing for malformed JSON values', () => {
    const malformedLibraries = [
      (() => {
        const library = structuredClone(
          createCharacterSampleLibrary(sourceLibrary),
        ) as unknown as Record<string, any>
        library.samples[0].review_questions[0] = 42
        return library
      })(),
      (() => {
        const library = structuredClone(
          createCharacterSampleLibrary(sourceLibrary),
        ) as unknown as Record<string, any>
        library.samples[0].decision_scene = null
        return library
      })(),
      (() => {
        const library = structuredClone(
          createCharacterSampleLibrary(sourceLibrary),
        ) as unknown as Record<string, any>
        library.samples[0].revised_biography = null
        return library
      })(),
    ]

    for (const library of malformedLibraries) {
      expect(() =>
        validateCharacterSampleLibrary(library, sourceLibrary),
      ).not.toThrow()
      expect(
        validateCharacterSampleLibrary(library, sourceLibrary).some(
          (finding) => finding.result === 'blocked',
        ),
      ).toBe(true)
    }
  })

  it('returns blocked findings when the source library itself is malformed', () => {
    const library = createCharacterSampleLibrary(sourceLibrary)

    expect(() =>
      validateCharacterSampleLibrary(library, null),
    ).not.toThrow()
    expect(
      validateCharacterSampleLibrary(library, null).every(
        (finding) => finding.result === 'blocked',
      ),
    ).toBe(true)
  })

  it('never throws for a valid source library that lacks the bound roster', () => {
    const library = createCharacterSampleLibrary(sourceLibrary)
    const wrongSourceLibraries = [
      generateCharacterLibrary({
        worldSeedHex: sourceLibrary.world_seed_hex,
        count: 1,
      }),
      generateCharacterLibrary({
        worldSeedHex: '0'.repeat(64),
        count: 50,
      }),
    ]

    for (const wrongSource of wrongSourceLibraries) {
      expect(
        validateCharacterLibrary(wrongSource).some(
          (finding) => finding.result === 'blocked',
        ),
      ).toBe(false)
      expect(() =>
        validateCharacterSampleLibrary(library, wrongSource),
      ).not.toThrow()
      expect(
        validateCharacterSampleLibrary(library, wrongSource).every(
          (finding) => finding.result === 'blocked',
        ),
      ).toBe(true)
    }
  })
})
