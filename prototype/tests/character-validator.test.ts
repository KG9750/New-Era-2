import { describe, expect, it } from 'vitest'

import persistedLibrary from '../../data/characters/generated-50-v0.1-candidate.json'
import {
  GROWTH_TEMPLATES,
  WORK_TEMPLATES,
} from '../src/characters/content'
import { recomputeDistinctionFingerprint } from '../src/characters/fingerprint'
import { generateCharacterLibrary } from '../src/characters/generator'
import { ATTRIBUTE_KEYS } from '../src/characters/model'
import { deriveSeedV1 } from '../src/characters/seed'
import {
  validateCharacter,
  validateCharacterLibrary,
  validateCharacterLibraryContent,
  recomputeCharacterLibraryFindings,
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
  it('returns a blocked library finding for malformed unknown JSON', () => {
    for (const subject of [null, {}, 'not-a-library']) {
      expect(() => validateCharacterLibrary(subject)).not.toThrow()
      expect(
        validateCharacterLibrary(subject).find(
          (finding) => finding.validation_id === 'LIBRARY-SCHEMA',
        )?.result,
      ).toBe('blocked')
    }
  })

  it('blocks coordinated character evidence that conflicts with the library root', () => {
    const forgedLibrary = structuredClone(persistedLibrary) as unknown as {
      characters: {
        character_id: string
        person_seed: string
        seeded_variation: {
          person_seed: string
          variation_source_id: string
        }
        library_generation_evidence: {
          world_seed_hex: string
          character_index: number
          generator_schema_version: string
          content_pack_versions: {
            biography: string
            traits: string
            values_and_redlines: string
          }
          culture_pack_version: string
        }
      }[]
    }
    const character = forgedLibrary.characters[0]
    const evidence = character.library_generation_evidence
    evidence.world_seed_hex = 'a'.repeat(64)
    evidence.character_index = 777
    character.person_seed = deriveSeedV1('library-character', [
      evidence.world_seed_hex,
      evidence.character_index,
      evidence.generator_schema_version,
      evidence.content_pack_versions,
      evidence.culture_pack_version,
    ])
    character.character_id = `char_${deriveSeedV1('character-id', [
      evidence.world_seed_hex,
      evidence.character_index,
    ]).slice(0, 16)}`
    character.seeded_variation.person_seed = character.person_seed
    character.seeded_variation.variation_source_id =
      `seed_variation:${character.character_id}:seeded-variation-v1`

    expect(
      validateCharacterLibrary(forgedLibrary).find(
        (finding) => finding.validation_id === 'LIBRARY-ROOT-BINDING',
      )?.result,
    ).toBe('blocked')
  })

  it('blocks coordinated forgery of persisted aggregate gate fields', () => {
    const forgedLibrary = structuredClone(persistedLibrary) as unknown as {
      validation: {
        scope: string
        implemented_machine_contracts_passed: boolean
        not_run_ids: string[]
        findings: { validation_id: string; result: string }[]
        manual_reviews: Record<string, string>
      }
    }
    forgedLibrary.validation.scope = 'ALL_RELEASE_GATES_PASSED'
    forgedLibrary.validation.implemented_machine_contracts_passed = true
    forgedLibrary.validation.not_run_ids = []
    const m12Finding = forgedLibrary.validation.findings.find(
      (finding) => finding.validation_id === 'M12',
    )
    expect(m12Finding).toBeDefined()
    m12Finding!.result = 'passed'
    for (const reviewId of Object.keys(
      forgedLibrary.validation.manual_reviews,
    )) {
      forgedLibrary.validation.manual_reviews[reviewId] = 'passed'
    }

    expect(
      validateCharacterLibrary(forgedLibrary).find(
        (finding) => finding.validation_id === 'LIBRARY-ENVELOPE',
      )?.result,
    ).toBe('blocked')
  })

  it('blocks forged stored findings that disagree with independent recomputation', () => {
    const forgedLibrary = structuredClone(persistedLibrary) as unknown as {
      validation: {
        findings: {
          validation_id: string
          result: string
          evidence: string
        }[]
      }
    }
    const storedM03 = forgedLibrary.validation.findings.find(
      (finding) => finding.validation_id === 'M03',
    )
    expect(storedM03).toBeDefined()
    storedM03!.evidence = 'forged_stored_evidence=true'

    expect(
      validateCharacterLibrary(forgedLibrary).find(
        (finding) => finding.validation_id === 'LIBRARY-ENVELOPE',
      )?.result,
    ).toBe('blocked')
  })

  it('blocks a validation envelope with any missing aggregate finding', () => {
    for (const validationId of [
      'DIST-LIFE-HISTORY',
      'SEED-KAT',
      'M12',
      'DIST-MBTI',
      'DIST-MBTI-SKILL',
      'DIST-MBTI-CONTENT',
      'DIST-ADDRESS',
    ]) {
      const forgedLibrary = structuredClone(persistedLibrary) as unknown as {
        validation: {
          findings: { validation_id: string }[]
        }
      }
      forgedLibrary.validation.findings =
        forgedLibrary.validation.findings.filter(
          (finding) => finding.validation_id !== validationId,
        )

      expect(
        validateCharacterLibrary(forgedLibrary).find(
          (finding) => finding.validation_id === 'LIBRARY-ENVELOPE',
        )?.result,
        validationId,
      ).toBe('blocked')
    }
  })

  it('blocks an aggregate finding with incomplete metadata', () => {
    const forgedLibrary = structuredClone(persistedLibrary) as unknown as {
      validation: {
        findings: Record<string, unknown>[]
      }
    }
    const finding = forgedLibrary.validation.findings.find(
      (candidate) => candidate.validation_id === 'DIST-MBTI',
    )
    expect(finding).toBeDefined()
    delete finding!.reviewer

    expect(
      validateCharacterLibrary(forgedLibrary).find(
        (candidate) => candidate.validation_id === 'LIBRARY-ENVELOPE',
      )?.result,
    ).toBe('blocked')
  })

  it('blocks duplicate aggregate finding multiplicity', () => {
    const forgedLibrary = structuredClone(persistedLibrary) as unknown as {
      validation: {
        findings: Record<string, unknown>[]
      }
    }
    const finding = forgedLibrary.validation.findings.find(
      (candidate) => candidate.validation_id === 'DIST-MBTI',
    )
    expect(finding).toBeDefined()
    forgedLibrary.validation.findings.push(structuredClone(finding!))

    expect(
      validateCharacterLibrary(forgedLibrary).find(
        (candidate) => candidate.validation_id === 'LIBRARY-ENVELOPE',
      )?.result,
    ).toBe('blocked')
  })

  it('blocks coordinated forgery of a distorted MBTI distribution', () => {
    const forgedLibrary = structuredClone(persistedLibrary) as unknown as {
      characters: Record<string, unknown>[]
      validation: {
        implemented_machine_contracts_status: string
        implemented_machine_contracts_passed: boolean
        warned_ids: string[]
        findings: {
          validation_id: string
          evidence: string
          result: string
        }[]
      }
    }
    for (const character of forgedLibrary.characters.slice(0, 8)) {
      const mbti = character.mbti as {
        type: string
        dimensions: Record<string, { pole: string }>
      }
      mbti.type = 'ENTJ'
      mbti.dimensions.energy.pole = 'E'
      mbti.dimensions.information.pole = 'N'
      mbti.dimensions.decision.pole = 'T'
      mbti.dimensions.structure.pole = 'J'
      character.distinction_fingerprint =
        recomputeDistinctionFingerprint(character as never)
    }
    const forgedFindings = recomputeCharacterLibraryFindings(
      forgedLibrary.characters as never,
    ).map((finding) => ({ ...finding }))
    const forgedDistribution = forgedFindings.find(
      (finding) => finding.validation_id === 'DIST-MBTI',
    )
    expect(forgedDistribution?.result).toBe('blocked')
    forgedDistribution!.result = 'passed'
    forgedDistribution!.evidence = 'forged_distribution_passed=true'
    forgedLibrary.validation.findings = forgedFindings
    forgedLibrary.validation.warned_ids = forgedFindings
      .filter((finding) => finding.result === 'warned')
      .map((finding) => finding.validation_id)
    forgedLibrary.validation.implemented_machine_contracts_status =
      forgedLibrary.validation.warned_ids.length > 0
        ? 'passed_with_warnings'
        : 'passed'
    forgedLibrary.validation.implemented_machine_contracts_passed =
      forgedLibrary.validation.warned_ids.length === 0

    expect(
      validateCharacterLibrary(forgedLibrary).find(
        (finding) => finding.validation_id === 'LIBRARY-ENVELOPE',
      )?.result,
    ).toBe('blocked')
  })

  it('blocks coordinated erasure of a recomputed warning', () => {
    const warningLibrary = generateCharacterLibrary({
      worldSeedHex:
        '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
      count: 1,
    })
    const forgedLibrary = structuredClone(warningLibrary) as unknown as {
      validation: {
        implemented_machine_contracts_status: string
        implemented_machine_contracts_passed: boolean
        warned_ids: string[]
        findings: { validation_id: string; result: string }[]
      }
    }
    expect(forgedLibrary.validation.warned_ids).toEqual(['DIST-ADDRESS'])
    const addressFinding = forgedLibrary.validation.findings.find(
      (finding) => finding.validation_id === 'DIST-ADDRESS',
    )
    expect(addressFinding?.result).toBe('warned')
    addressFinding!.result = 'passed'
    forgedLibrary.validation.warned_ids = []
    forgedLibrary.validation.implemented_machine_contracts_status = 'passed'
    forgedLibrary.validation.implemented_machine_contracts_passed = true

    expect(
      validateCharacterLibrary(forgedLibrary).find(
        (finding) => finding.validation_id === 'LIBRARY-ENVELOPE',
      )?.result,
    ).toBe('blocked')
  })

  it('scopes aggregate validation to implemented contracts and exposes not-run IDs', () => {
    expect(library.validation).not.toHaveProperty('machine_passed')
    expect(library.validation.implemented_machine_contracts_status).toBe(
      'passed',
    )
    expect(library.validation.implemented_machine_contracts_passed).toBe(true)
    expect(library.validation.warned_ids).toEqual([])
    expect(library.validation.not_run_ids).toEqual(['M12'])
    expect(library.validation.scope).toBe(
      'TECHNICAL_CHARACTER_LIBRARY_IMPLEMENTED_CONTRACTS_ONLY',
    )
  })

  it('accepts the persisted candidate library without calling the generator', () => {
    expect(
      validateCharacterLibrary(persistedLibrary).some(
        (finding) => finding.result === 'blocked',
      ),
    ).toBe(false)
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

  it('blocks coordinated qualification evidence forgery in both stored copies', () => {
    const character = persistedCharacter()
    const qualifications =
      character.qualifications as Record<string, unknown>[]
    const qualification = qualifications[0]
    const biographyNodes =
      character.biography_nodes as Record<string, unknown>[]
    const sourceNode = biographyNodes.find(
      (node) => node.node_id === qualification.source_node_id,
    )
    expect(sourceNode).toBeDefined()
    const sourceQualifications =
      sourceNode!.qualifications as Record<string, unknown>[]
    const sourceQualification = sourceQualifications.find(
      (candidate) =>
        candidate.qualification_id === qualification.qualification_id,
    )
    expect(sourceQualification).toBeDefined()
    qualification.evidence = '协调伪造但非空的资格说明'
    sourceQualification!.evidence = qualification.evidence

    expect(result(character, 'M07')).toBe('blocked')
  })

  it('blocks an unversioned template ID in every biography stage', () => {
    for (let index = 0; index < 5; index += 1) {
      const character = persistedCharacter()
      const biographyNodes =
        character.biography_nodes as Record<string, unknown>[]
      biographyNodes[index].template_id = `forged-unversioned-${index}`

      expect(
        validateCharacter(character).some(
          (finding) => finding.result === 'blocked',
        ),
        `stage index ${index}`,
      ).toBe(true)
    }
  })

  it('blocks forged outputs attached to a registered growth template', () => {
    const character = persistedCharacter()
    const biographyNodes =
      character.biography_nodes as Record<string, unknown>[]
    const growth = biographyNodes[0]
    const replacementTemplate = GROWTH_TEMPLATES.find(
      (template) => template.id !== growth.template_id,
    )
    expect(replacementTemplate).toBeDefined()
    growth.template_id = replacementTemplate!.id
    growth.context_tags = [replacementTemplate!.context, 'growth']
    growth.attribute_modifiers = [
      {
        attribute: '健康',
        value: 1,
        modifier_source_id: growth.node_id,
      },
      {
        attribute: '意志',
        value: -1,
        modifier_source_id: growth.node_id,
      },
    ]
    growth.skill_experience = [
      { skill: '医疗', points: 2, intensity: 'repeated' },
    ]
    growth.personality_candidates = ['协调伪造的成长人格输出']
    growth.evidence_text = '协调伪造的成长模板结构输出'
    character.origin = replacementTemplate!.context
    const traits = character.traits as string[]
    traits[0] = '协调伪造的成长人格输出'

    expect(result(character, 'M04')).toBe('blocked')
  })

  it('blocks forged evidence text attached to any registered biography template', () => {
    for (let index = 0; index < 5; index += 1) {
      const character = persistedCharacter()
      const biographyNodes =
        character.biography_nodes as Record<string, unknown>[]
      biographyNodes[index].evidence_text =
        `forged evidence for registered template ${index}`
      character.biography_summary = biographyNodes
        .map((node) => node.evidence_text)
        .join(' ')

      expect(result(character, 'M04'), `stage index ${index}`).toBe('blocked')
    }
  })

  it('blocks forged structured outputs attached to registered biography templates', () => {
    const mutations: ((nodes: Record<string, unknown>[]) => void)[] = [
      (nodes) => {
        nodes[1].skill_experience = [
          { skill: '防卫', points: 4, intensity: 'regular' },
        ]
      },
      (nodes) => {
        nodes[2].personality_candidates = ['协调伪造的工作性格输出']
      },
      (nodes) => {
        nodes[3].value_and_redline_candidates = ['协调伪造的转折价值输出']
      },
      (nodes) => {
        nodes[4].motivation_and_hooks = ['协调伪造的当前动机输出']
      },
    ]

    for (const [index, mutate] of mutations.entries()) {
      const character = persistedCharacter()
      const biographyNodes =
        character.biography_nodes as Record<string, unknown>[]
      mutate(biographyNodes)

      expect(result(character, 'M04'), `mutation index ${index}`).toBe(
        'blocked',
      )
    }
  })

  it('blocks forged structured outputs on a second registered work node', () => {
    const character = persistedCharacter()
    const biographyNodes =
      character.biography_nodes as Record<string, unknown>[]
    const firstWork = biographyNodes[2]
    const turningPoint = biographyNodes[3]
    const originalWorkEnd = firstWork.age_end as number
    const secondWorkStart = Math.max(
      (firstWork.age_start as number) + 1,
      originalWorkEnd - 4,
    )
    firstWork.age_end = secondWorkStart
    const secondWork = structuredClone(firstWork)
    secondWork.node_id = `${String(firstWork.node_id)}:second`
    secondWork.age_start = secondWorkStart
    secondWork.age_end = originalWorkEnd
    secondWork.prerequisites = [firstWork.node_id]
    secondWork.context_tags = ['work', '协调改写的领域']
    secondWork.attribute_modifiers = []
    secondWork.skill_experience = []
    secondWork.qualifications = []
    secondWork.personality_candidates = ['协调改写的第二工作性格']
    secondWork.relationship_outputs = ['协调改写的第二工作关系']
    secondWork.motivation_and_hooks = ['协调改写的第二工作钩子']
    biographyNodes.splice(3, 0, secondWork)
    turningPoint.prerequisites = [secondWork.node_id]
    character.biography_summary = biographyNodes
      .map((node) => node.evidence_text)
      .join(' ')

    expect(result(character, 'M04')).toBe('blocked')
  })

  it('accepts a complete character with two registered work nodes', () => {
    const character = persistedCharacter()
    const biographyNodes =
      character.biography_nodes as Record<string, unknown>[]
    const firstWork = biographyNodes[2]
    const turningPoint = biographyNodes[3]
    const originalWorkEnd = firstWork.age_end as number
    const secondWorkStart = Math.max(
      (firstWork.age_start as number) + 1,
      originalWorkEnd - 4,
    )
    firstWork.age_end = secondWorkStart
    const secondWorkTemplate = WORK_TEMPLATES.find(
      (template) => template.id === 'work-rehab-ward',
    )
    expect(secondWorkTemplate).toBeDefined()
    const secondWorkId = `${String(firstWork.node_id)}:second`
    biographyNodes.splice(3, 0, {
      node_id: secondWorkId,
      template_id: secondWorkTemplate!.id,
      stage: 'work',
      age_start: secondWorkStart,
      age_end: originalWorkEnd,
      context_tags: [
        'work',
        secondWorkTemplate!.primary,
        secondWorkTemplate!.secondary,
      ],
      prerequisites: [firstWork.node_id],
      attribute_modifiers: [
        {
          attribute: secondWorkTemplate!.positive,
          value: 1,
          modifier_source_id: secondWorkId,
        },
        {
          attribute: secondWorkTemplate!.negative,
          value: -1,
          modifier_source_id: secondWorkId,
        },
      ],
      skill_experience: [
        {
          skill: secondWorkTemplate!.primary,
          points: 6,
          intensity: 'major_duty',
        },
        {
          skill: secondWorkTemplate!.secondary,
          points: 4,
          intensity: 'regular',
        },
      ],
      qualifications: [],
      personality_candidates: [secondWorkTemplate!.trait],
      value_and_redline_candidates: [],
      relationship_outputs: [secondWorkTemplate!.relationship],
      motivation_and_hooks: [
        `曾任${secondWorkTemplate!.experienceTitle}`,
      ],
      evidence_text: secondWorkTemplate!.evidence,
    })
    turningPoint.prerequisites = [secondWorkId]
    character.biography_summary = biographyNodes
      .map((node) => node.evidence_text)
      .join(' ')

    character.attributes = {
      体能: 7,
      协调: 3,
      思维: 6,
      感知: 4,
      沟通: 6,
      意志: 4,
      健康: 4,
    }
    const variation = character.seeded_variation as Record<string, unknown>
    variation.negative_attribute = '健康'
    character.skills = {
      生产: 0,
      工程: 0,
      医疗: 6,
      后勤: 0,
      侦察: 0,
      防卫: 2,
      交涉: 14,
      研究: 6,
    }
    character.primary_skills = ['交涉', '医疗']

    expect(
      validateCharacter(character).filter(
        (finding) => finding.result === 'blocked',
      ),
    ).toEqual([])
  })

  it('blocks forged structured outputs on a third registered work node', () => {
    const character = persistedCharacter()
    const biographyNodes =
      character.biography_nodes as Record<string, unknown>[]
    const firstWork = biographyNodes[2]
    const turningPoint = biographyNodes[3]
    const workEnd = firstWork.age_end as number
    let previousWorkId = String(firstWork.node_id)

    for (const suffix of ['second', 'third']) {
      const extraWork = structuredClone(firstWork)
      const extraWorkId = `${String(firstWork.node_id)}:${suffix}`
      extraWork.node_id = extraWorkId
      extraWork.age_start = workEnd
      extraWork.age_end = workEnd
      extraWork.prerequisites = [previousWorkId]
      extraWork.attribute_modifiers = (
        extraWork.attribute_modifiers as Record<string, unknown>[]
      ).slice(0, 2)
      for (const modifier of extraWork.attribute_modifiers as Record<
        string,
        unknown
      >[]) {
        modifier.modifier_source_id = extraWorkId
      }
      extraWork.qualifications = []
      biographyNodes.splice(biographyNodes.length - 2, 0, extraWork)
      previousWorkId = extraWorkId
    }
    const thirdWork = biographyNodes[4]
    thirdWork.personality_candidates = ['协调伪造的第三工作性格']
    turningPoint.prerequisites = [previousWorkId]
    character.biography_summary = biographyNodes
      .map((node) => node.evidence_text)
      .join(' ')

    expect(result(character, 'M04')).toBe('blocked')
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
      'distinction-v2:[["growth-watch-quarter","education-mediation","work-council-facilitator","turn-ledger-falsification","motivation-water-restoration"],["交涉","研究"],"ESFP",["moderate","light","moderate","light"],["公共账目必须可核验","短缺不能通过删除记录消失"],["拒绝删除或伪造公共资源的权威记录"],"相信附近一套废弃供水设施仍有恢复价值"]',
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
