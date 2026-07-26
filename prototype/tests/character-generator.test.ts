import { describe, expect, it } from 'vitest'

import {
  deriveSeedV1,
  generateCharacter,
  generateCharacterLibrary,
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
    expect(library.validation.machine_passed).toBe(true)
    expect(library.validation.findings.some((finding) => finding.result === 'blocked')).toBe(false)
    expect(
      library.validation.findings.find(
        (finding) => finding.validation_id === 'DIST-MBTI-SKILL',
      )?.result,
    ).toBe('passed')
    expect(
      library.validation.findings.find(
        (finding) => finding.validation_id === 'DIST-ADDRESS',
      )?.result,
    ).toBe('passed')
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
