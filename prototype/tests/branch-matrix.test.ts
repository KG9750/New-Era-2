import { describe, expect, it } from 'vitest'
import {
  GATE1_CHOICE_SET_ORACLE,
  evaluateDominance,
  gate1WeekOneScenario as scenario,
} from '../src/scenario/gate1-week-one'
import {
  buildGate1BranchMatrixOracle,
  simulateGate1Branch,
} from '../src/sim/engine'
import {
  GATE1_FOOD_TARGET,
  GATE1_REPAIR_TARGET,
} from '../src/sim/forecast'

describe('Gate 1 RC9 branch-matrix oracle', () => {
  it('marks every option unverified when continuation policies are incomplete', () => {
    const result = evaluateDominance({
      continuationPolicyIds: ['preserve-reserves', 'invest-in-people'],
      axes: [{ id: 'weekTwoFood', direction: 'higher' }],
      options: [
        {
          optionId: 'complete',
          resultsByPolicy: {
            'preserve-reserves': [12],
            'invest-in-people': [9],
          },
        },
        {
          optionId: 'missing-policy',
          resultsByPolicy: {
            'preserve-reserves': [11],
          },
        },
      ],
    })

    expect(result).toEqual({
      complete: 'unverified',
      'missing-policy': 'unverified',
    })
  })

  it('rejects empty dominance inputs instead of treating them as verified', () => {
    expect(
      evaluateDominance({
        continuationPolicyIds: [],
        axes: [],
        options: [
          { optionId: 'first', resultsByPolicy: {} },
          { optionId: 'second', resultsByPolicy: {} },
        ],
      }),
    ).toEqual({
      first: 'unverified',
      second: 'unverified',
    })
  })

  it('compares options under the same continuation policies before declaring dominance', () => {
    const result = evaluateDominance({
      continuationPolicyIds: ['food-first', 'repair-first'],
      axes: [
        { id: 'food', direction: 'higher' },
        { id: 'repairDebt', direction: 'lower' },
      ],
      options: [
        {
          optionId: 'balanced',
          resultsByPolicy: {
            'food-first': [14, 0],
            'repair-first': [11, 0],
          },
        },
        {
          optionId: 'strictly-worse',
          resultsByPolicy: {
            'food-first': [13, 1],
            'repair-first': [10, 0],
          },
        },
        {
          optionId: 'different-tradeoff',
          resultsByPolicy: {
            'food-first': [16, 2],
            'repair-first': [13, 2],
          },
        },
      ],
    })

    expect(result).toEqual({
      balanced: 'non-dominated',
      'strictly-worse': 'dominated',
      'different-tradeoff': 'non-dominated',
    })
  })

  it('simulates a complete two-week outcome for paired food options', () => {
    const continuation = {
      pumpPlan: 'protect',
      repair: 'schedule-su',
      transport: 'south-week-two',
      fertilizer: 'use-week-two',
      linHe: 'decline-study',
    } as const
    const shifted = simulateGate1Branch(
      {
        ...continuation,
        food: 'food-shift-qiao',
      },
      scenario,
    )
    const acceptedGap = simulateGate1Branch(
      {
        ...continuation,
        food: 'accept-food-gap',
      },
      scenario,
    )

    expect(shifted.isComplete).toBe(true)
    expect(acceptedGap.isComplete).toBe(true)
    expect(shifted.weekOneFood).toBeGreaterThan(acceptedGap.weekOneFood)
    expect(shifted.weekOneRepair).toBeLessThan(
      acceptedGap.weekOneRepair,
    )
  })

  it('freezes one production oracle entry for every Gate-counting choice set', () => {
    expect(Object.keys(GATE1_CHOICE_SET_ORACLE).sort()).toEqual([
      'choice:w0:fertilizer',
      'choice:w0:food-plan',
      'choice:w0:pump-repair',
      'choice:w0:transport-route',
      'choice:w1:fertilizer',
      'choice:w1:lin-he-study',
      'choice:w1:transport-route',
    ])

    for (const choiceSet of Object.values(GATE1_CHOICE_SET_ORACLE)) {
      expect(choiceSet.options.length).toBeGreaterThanOrEqual(2)
      expect(
        choiceSet.options.filter(
          (option) => option.dominanceStatus === 'non-dominated',
        ),
      ).toHaveLength(choiceSet.options.length)
    }
  })

  it('enumerates every complete trajectory into policy-complete choice contexts', () => {
    const matrix = buildGate1BranchMatrixOracle(scenario)

    expect(matrix.completeTrajectoryCount).toBe(288)
    expect(matrix.contexts).toHaveLength(132)
    expect(
      Object.fromEntries(
        Object.keys(GATE1_CHOICE_SET_ORACLE).map((choiceSetId) => [
          choiceSetId,
          matrix.contexts.filter(
            (context) => context.choiceSetId === choiceSetId,
          ).length,
        ]),
      ),
    ).toEqual({
      'choice:w0:food-plan': 1,
      'choice:w0:pump-repair': 1,
      'choice:w0:transport-route': 1,
      'choice:w1:transport-route': 32,
      'choice:w0:fertilizer': 1,
      'choice:w1:fertilizer': 32,
      'choice:w1:lin-he-study': 64,
    })

    for (const context of matrix.contexts) {
      const expectedPolicies = [...context.continuationPolicyIds].sort()
      expect(expectedPolicies.length).toBeGreaterThan(0)
      for (const option of context.options) {
        expect(Object.keys(option.resultsByPolicy).sort()).toEqual(
          expectedPolicies,
        )
      }
    }
  })

  it('proves every frozen Gate option is non-dominated in every reachable context', () => {
    const matrix = buildGate1BranchMatrixOracle(scenario)
    const invalid = matrix.contexts.flatMap((context) =>
      context.options
        .filter(
          (option) =>
            option.dominanceStatus !== 'non-dominated',
        )
        .map((option) => ({
          choiceContextId: context.choiceContextId,
          optionId: option.optionId,
          status: option.dominanceStatus,
        })),
    )

    expect(invalid).toEqual([])
  })

  it('keeps production option families aligned with the concrete matrix options', () => {
    const matrix = buildGate1BranchMatrixOracle(scenario)

    for (const [choiceSetId, choiceSet] of Object.entries(
      GATE1_CHOICE_SET_ORACLE,
    )) {
      const matrixOptionIds = [
        ...new Set(
          matrix.contexts
            .filter(
              (context) => context.choiceSetId === choiceSetId,
            )
            .flatMap((context) =>
              context.options.map((option) => option.optionId),
            ),
        ),
      ].sort()
      const productionOptionIds = choiceSet.options
        .flatMap((option) =>
          option.implementationOptionIds ?? [option.optionId],
        )
        .sort()

      expect(productionOptionIds).toEqual(matrixOptionIds)
      for (const option of choiceSet.options) {
        expect(option.visibleConsequenceRefs.length).toBeGreaterThan(0)
      }
    }
  })

  it('gives every major week-one outcome two week-two responses and turns good outcomes into opportunities', () => {
    const matrix = buildGate1BranchMatrixOracle(scenario)

    expect(matrix.weekOneOutcomes.length).toBeGreaterThan(1)
    for (const outcome of matrix.weekOneOutcomes) {
      expect(['protected', 'failed']).toContain(outcome.pumpStatus)
      expect([
        'qiao-pan',
        'chen-du',
        'su-ji',
        'debt',
      ]).toContain(outcome.repairResolution)
      expect(outcome.responseOptionIds.length).toBeGreaterThanOrEqual(2)
    }

    const goodOutcomes = matrix.weekOneOutcomes.filter(
      (outcome) =>
        outcome.food >= GATE1_FOOD_TARGET.low &&
        outcome.repair >= GATE1_REPAIR_TARGET.low,
    )
    expect(goodOutcomes.length).toBeGreaterThan(0)
    for (const outcome of goodOutcomes) {
      expect(outcome.improvementOpportunityIds.length).toBeGreaterThan(0)
    }
  })

  it('freezes the auditable matrix summary used by the design note', () => {
    const matrix = buildGate1BranchMatrixOracle(scenario)
    const choiceSetIds = Object.keys(GATE1_CHOICE_SET_ORACLE)
    const summary = {
      completeTrajectoryCount: matrix.completeTrajectoryCount,
      contextCount: matrix.contexts.length,
      contextAndPolicyRanges: Object.fromEntries(
        choiceSetIds.map((choiceSetId) => {
          const contexts = matrix.contexts.filter(
            (context) => context.choiceSetId === choiceSetId,
          )
          const policyCounts = contexts.map(
            (context) => context.continuationPolicyIds.length,
          )
          return [
            choiceSetId,
            {
              contexts: contexts.length,
              minPolicies: Math.min(...policyCounts),
              maxPolicies: Math.max(...policyCounts),
            },
          ]
        }),
      ),
      weekOneOutcomeCount: matrix.weekOneOutcomes.length,
      goodWeekOneOutcomeCount: matrix.weekOneOutcomes.filter(
        (outcome) =>
          outcome.food >= GATE1_FOOD_TARGET.low &&
          outcome.repair >= GATE1_REPAIR_TARGET.low,
      ).length,
      weekOneFoodRange: [
        Math.min(...matrix.weekOneOutcomes.map((outcome) => outcome.food)),
        Math.max(...matrix.weekOneOutcomes.map((outcome) => outcome.food)),
      ],
      weekOneRepairRange: [
        Math.min(...matrix.weekOneOutcomes.map((outcome) => outcome.repair)),
        Math.max(...matrix.weekOneOutcomes.map((outcome) => outcome.repair)),
      ],
    }

    expect(summary).toEqual({
      completeTrajectoryCount: 288,
      contextCount: 132,
      contextAndPolicyRanges: {
        'choice:w0:food-plan': {
          contexts: 1,
          minPolicies: 144,
          maxPolicies: 144,
        },
        'choice:w0:pump-repair': {
          contexts: 1,
          minPolicies: 72,
          maxPolicies: 72,
        },
        'choice:w0:transport-route': {
          contexts: 1,
          minPolicies: 192,
          maxPolicies: 192,
        },
        'choice:w0:fertilizer': {
          contexts: 1,
          minPolicies: 192,
          maxPolicies: 192,
        },
        'choice:w1:lin-he-study': {
          contexts: 64,
          minPolicies: 1,
          maxPolicies: 4,
        },
        'choice:w1:transport-route': {
          contexts: 32,
          minPolicies: 2,
          maxPolicies: 4,
        },
        'choice:w1:fertilizer': {
          contexts: 32,
          minPolicies: 2,
          maxPolicies: 4,
        },
      },
      weekOneOutcomeCount: 64,
      goodWeekOneOutcomeCount: 11,
      weekOneFoodRange: [1, 21],
      weekOneRepairRange: [-5, 7],
    })
  })

  it('freezes the complete option-by-policy result vectors by digest', async () => {
    const matrix = buildGate1BranchMatrixOracle(scenario)
    const bytes = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(matrix)),
    )
    const digest = [...new Uint8Array(bytes)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')

    expect(digest).toBe(
      'c400755ff33e8497ae7e5c35e1cd6845c2f4b7c5de255ba91f5d7771ca412578',
    )
  })
})
