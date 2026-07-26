import { describe, expect, it } from 'vitest'

import {
  deriveSeedV1,
  generateCharacter,
  generateCharacterLibrary,
  validateCharacter,
  validateCharacterLibraryContent,
  validatePopulationLimit,
} from '../src/characters/generator'

describe('character generator', () => {
  it('matches the frozen seed_derivation_v1 known-answer chain', () => {
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
    const attemptSeed = deriveSeedV1('candidate-attempt', [worldSeed, personSeed, 0])

    expect(candidateSequenceSeed).toBe('964ea7a1c6840d36b9f49f4df75e546b')
    expect(cycleSeed).toBe('1d50b638e9001a77e19abe3fd4b2c88a')
    expect(personSeed).toBe('cc00ead317e30f3a279f232891782066')
    expect(attemptSeed).toBe('8a0ac8633dc448667567910ae27ca29d')
  })

  it('replays one complete character from the same seed and index', () => {
    const worldSeed =
      '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1'

    const first = generateCharacter({ worldSeedHex: worldSeed, characterIndex: 0 })
    const replay = generateCharacter({ worldSeedHex: worldSeed, characterIndex: 0 })

    expect(replay).toEqual(first)
    expect(first.character_id).toMatch(/^char_[0-9a-f]{16}$/)
    expect(first.formal_name.length).toBeGreaterThanOrEqual(2)
    expect(first.biography_nodes.map((node) => node.stage)).toEqual([
      'growth',
      'education',
      'work',
      'turning_point',
      'current_motivation',
    ])
    expect(Object.values(first.attributes).reduce((sum, value) => sum + value, 0)).toBeGreaterThanOrEqual(32)
    expect(Object.values(first.attributes).reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(40)
    expect(Object.keys(first)).not.toContain('nickname')
    expect(Object.keys(first)).not.toContain('alias')
  })

  it('blocks M03 when required identity or personality fields are missing', () => {
    const original = generateCharacter({
      worldSeedHex:
        '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
      characterIndex: 0,
    })

    for (const requiredField of [
      'name_parts',
      'address_rules',
      'traits',
      'stress_response',
      'core_values',
      'redlines',
    ]) {
      const character = structuredClone(original) as unknown as Record<
        string,
        unknown
      >
      delete character[requiredField]

      expect(
        validateCharacter(character).find(
          (finding) => finding.validation_id === 'M03',
        )?.result,
        requiredField,
      ).toBe('blocked')
    }
  })

  it('blocks M04 when a biography prerequisite does not reference an earlier node', () => {
    const character = structuredClone(
      generateCharacter({
        worldSeedHex:
          '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
        characterIndex: 0,
      }),
    )

    character.biography_nodes[1].prerequisites = ['missing-node-id']

    expect(
      validateCharacter(character).find(
        (finding) => finding.validation_id === 'M04',
      )?.result,
    ).toBe('blocked')
  })

  it('blocks M04 when origin differs from growth context without a migration bridge', () => {
    const character = structuredClone(
      generateCharacter({
        worldSeedHex:
          '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
        characterIndex: 1,
      }),
    )

    character.origin = '没有履历桥接的异地出身'

    expect(
      validateCharacter(character).find(
        (finding) => finding.validation_id === 'M04',
      )?.result,
    ).toBe('blocked')
  })

  it('blocks M05 when seeded variation provenance is forged', () => {
    const character = structuredClone(
      generateCharacter({
        worldSeedHex:
          '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
        characterIndex: 0,
      }),
    )
    const variation = character.seeded_variation as unknown as Record<string, unknown>

    variation.variation_source_id = 'bogus'
    variation.person_seed = 'bogus'
    variation.algorithm_version = 'bogus'
    variation.applicability_condition = 'bogus'

    expect(
      validateCharacter(character).find(
        (finding) => finding.validation_id === 'M05',
      )?.result,
    ).toBe('blocked')
  })

  it('blocks M07 when a qualification rank exceeds its source node evidence', () => {
    const character = JSON.parse(
      JSON.stringify(
        generateCharacter({
          worldSeedHex:
            '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
          characterIndex: 0,
        }),
      ),
    ) as ReturnType<typeof generateCharacter>

    character.qualifications[0].rank = 3

    expect(
      validateCharacter(character).find(
        (finding) => finding.validation_id === 'M07',
      )?.result,
    ).toBe('blocked')
  })

  it('blocks M06 when a skill value cannot be recomputed from biography nodes', () => {
    const character = structuredClone(
      generateCharacter({
        worldSeedHex:
          '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
        characterIndex: 0,
      }),
    )

    character.skills.生产 += 1

    expect(
      validateCharacter(character).find(
        (finding) => finding.validation_id === 'M06',
      )?.result,
    ).toBe('blocked')
  })

  it('generates origins that are explained by the biography', () => {
    const library = generateCharacterLibrary({
      worldSeedHex:
        '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
      count: 50,
    })

    expect(
      library.characters.every((character) =>
        character.biography_nodes.some(
          (node) =>
            node.stage === 'growth' &&
            node.context_tags.includes(character.origin),
        ),
      ),
    ).toBe(true)
  })

  it('generates redline sources that resolve to biography nodes or value records', () => {
    const character = generateCharacter({
      worldSeedHex:
        '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
      characterIndex: 0,
    })
    const sourceIds = new Set([
      ...character.biography_nodes.map((node) => node.node_id),
      ...character.core_values.map((value) =>
        typeof value === 'string' ? value : (value as { value_id: string }).value_id,
      ),
    ])

    expect(
      character.redlines.every((redline) =>
        redline.source_ids.every((sourceId) => sourceIds.has(sourceId)),
      ),
    ).toBe(true)
  })

  it('blocks M03 when a redline source cannot be resolved', () => {
    const character = structuredClone(
      generateCharacter({
        worldSeedHex:
          '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
        characterIndex: 0,
      }),
    )

    character.redlines[0].source_ids = ['missing-source-id']

    expect(
      validateCharacter(character).find(
        (finding) => finding.validation_id === 'M03',
      )?.result,
    ).toBe('blocked')
  })

  it('builds 50 distinct life-history chassis instead of cycling 16 fixed combinations', () => {
    const library = generateCharacterLibrary({
      worldSeedHex:
        '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
      count: 50,
    })
    const chassis = library.characters.map((character) =>
      [
        character.biography_nodes.find((node) => node.stage === 'growth')
          ?.template_id,
        character.biography_nodes.find((node) => node.stage === 'work')
          ?.template_id,
        character.biography_nodes.find(
          (node) => node.stage === 'current_motivation',
        )?.template_id,
      ].join('|'),
    )
    const workBindings = library.characters.reduce<
      Record<string, { growth: Set<string>; goals: Set<string> }>
    >((bindings, character) => {
      const workId =
        character.biography_nodes.find((node) => node.stage === 'work')
          ?.template_id ?? ''
      const growthId =
        character.biography_nodes.find((node) => node.stage === 'growth')
          ?.template_id ?? ''
      bindings[workId] ??= { growth: new Set(), goals: new Set() }
      bindings[workId].growth.add(growthId)
      bindings[workId].goals.add(character.long_term_goal)
      return bindings
    }, {})

    expect(new Set(chassis)).toHaveLength(50)
    expect(
      Object.values(workBindings).every(
        ({ growth, goals }) => growth.size >= 2 && goals.size >= 2,
      ),
    ).toBe(true)
  })

  it('blocks M10 when a stored distinction fingerprint is forged', () => {
    const library = generateCharacterLibrary({
      worldSeedHex:
        '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
      count: 50,
    })
    const characters = JSON.parse(
      JSON.stringify(library.characters),
    ) as typeof library.characters

    ;(characters[0] as { distinction_fingerprint: string }).distinction_fingerprint =
      'forged-but-unique'

    expect(
      validateCharacterLibraryContent(characters).find(
        (finding) => finding.validation_id === 'M10',
      )?.result,
    ).toBe('blocked')
  })

  it('builds a validated 50-person candidate library with all 16 MBTI types', () => {
    const library = generateCharacterLibrary({
      worldSeedHex:
        '9f4d6b571b07f0036b63f7d56d1b2e8c90f561f52f35db779b03e6c0a83cb9b1',
      count: 50,
    })
    const mbtiCounts = library.characters.reduce<Record<string, number>>((counts, character) => {
      counts[character.mbti.type] = (counts[character.mbti.type] ?? 0) + 1
      return counts
    }, {})
    const attributeTotals = library.characters.map((character) =>
      Object.values(character.attributes).reduce((sum, value) => sum + value, 0),
    )
    const highestSkillsByMbti = library.characters.reduce<Record<string, string[]>>(
      (groups, character) => {
        groups[character.mbti.type] ??= []
        groups[character.mbti.type].push(character.primary_skills[0])
        return groups
      },
      {},
    )
    const addressStructureCounts = library.characters.reduce<Record<string, number>>(
      (counts, character) => {
        const structure = character.address_rules
          .map((rule) => `${rule.relationship}:${rule.form === character.formal_name ? 'formal' : 'contextual'}`)
          .join('+')
        counts[structure] = (counts[structure] ?? 0) + 1
        return counts
      },
      {},
    )
    const advancedQualificationsTraceToWork = library.characters.every((character) =>
      character.qualifications
        .filter((qualification) => qualification.rank >= 2)
        .every((qualification) =>
          character.biography_nodes.some(
            (node) =>
              node.stage === 'work' &&
              node.node_id === qualification.source_node_id &&
              node.qualifications.some(
                (nodeQualification) =>
                  nodeQualification.qualification_id ===
                    qualification.qualification_id &&
                  nodeQualification.rank === qualification.rank,
              ),
          ),
        ),
    )

    expect(library.status).toBe('CANDIDATE_NOT_FROZEN')
    expect(library.development_stage).toBe('TECHNICAL_SPIKE_BEFORE_A1')
    expect(library.generator_schema_version).toBe('char-gen-v0.1.2-candidate')
    expect(library.characters).toHaveLength(50)
    expect(new Set(library.characters.map((character) => character.character_id))).toHaveLength(50)
    expect(new Set(library.characters.map((character) => character.formal_name))).toHaveLength(50)
    expect(
      new Set(library.characters.map((character) => character.distinction_fingerprint)),
    ).toHaveLength(50)
    expect(Object.keys(mbtiCounts)).toHaveLength(16)
    expect(Object.values(mbtiCounts).every((count) => count >= 2 && count <= 5)).toBe(true)
    expect(new Set(attributeTotals)).toHaveLength(5)
    expect(Math.min(...attributeTotals)).toBe(34)
    expect(Math.max(...attributeTotals)).toBe(38)
    expect(
      Object.values(highestSkillsByMbti).every((skills) => {
        const counts = skills.reduce<Record<string, number>>((group, skill) => {
          group[skill] = (group[skill] ?? 0) + 1
          return group
        }, {})
        return Math.max(...Object.values(counts)) / skills.length <= 0.6
      }),
    ).toBe(true)
    expect(Math.max(...Object.values(addressStructureCounts)) / library.characters.length).toBeLessThanOrEqual(0.5)
    expect(advancedQualificationsTraceToWork).toBe(true)
    expect(library.validation.implemented_machine_contracts_passed).toBe(true)
    expect(library.validation.not_run_ids).toEqual(['M12'])
    expect(library.validation.scope).toBe(
      'TECHNICAL_CHARACTER_LIBRARY_IMPLEMENTED_CONTRACTS_ONLY',
    )
    expect(library.validation.findings.some((finding) => finding.result === 'blocked')).toBe(false)
    expect(
      library.validation.findings.find(
        (finding) => finding.validation_id === 'DIST-MBTI-SKILL',
      )?.result,
    ).toBe('passed')
    expect(
      library.validation.findings.find(
        (finding) => finding.validation_id === 'DIST-MBTI-CONTENT',
      )?.result,
    ).toBe('passed')
    expect(
      library.validation.findings.find(
        (finding) => finding.validation_id === 'DIST-ADDRESS',
      )?.result,
    ).toBe('passed')
    expect(
      library.validation.findings.find(
        (finding) => finding.validation_id === 'SEED-KAT',
      )?.result,
    ).toBe('passed')
    expect(
      library.validation.findings.find(
        (finding) => finding.validation_id === 'LIBRARY-REPLAY-PARTIAL',
      )?.result,
    ).toBe('passed')
    expect(
      library.validation.findings.find(
        (finding) => finding.validation_id === 'M12',
      )?.result,
    ).toBe('not_run')
    expect(library.validation.manual_reviews).toEqual({
      E01: 'not_run',
      E02: 'not_run',
      E03: 'not_run',
      E04: 'not_run',
      E05: 'not_run',
      E06: 'not_run',
    })
  })

  it('enforces player and NPC permanent-population hard caps', () => {
    expect(validatePopulationLimit('player', 10).result).toBe('passed')
    expect(validatePopulationLimit('player', 11).result).toBe('blocked')
    expect(validatePopulationLimit('npc', 15).result).toBe('passed')
    expect(validatePopulationLimit('npc', 16).result).toBe('blocked')
  })
})
