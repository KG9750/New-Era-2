import { describe, expect, it } from 'vitest'
import {
  RECOVERY_ALLOCATION_FIXTURES,
  buildRecoveryAllocationBranchMatrix,
  recoveryAllocationOutcome,
} from '../src/sim/management-branch-matrix'

describe('C03 recovery-allocation branch matrix', () => {
  it('freezes the same canonical lot and both reachable candidates in every context', () => {
    const matrix = buildRecoveryAllocationBranchMatrix()
    expect(matrix).toMatchObject({
      scenarioVersion: '0.5.1',
      protocolVersion:
        'weekly-management-slice-playtest-v0.3',
    })
    for (const context of matrix.contexts) {
      expect(context.resource).toEqual({
        scarceResourceLotId:
          'schedule-slot:chen-du:d10:b2',
        resourceUnit: 'schedule-block',
        resourceQuantity: 1,
        resourceOwner: 'chen-du',
        dayIndex: 10,
        blockIndex: 2,
        resourceTimeWindow:
          'day-index-10:block-index-2',
        resourceTickInterval: [1536, 1554],
        resourceTickCount: 18,
        originalActivity: 'rest',
      })
      expect(Object.keys(context.outcomes).sort()).toEqual([
        'allocate-food-production',
        'allocate-repair-buffer',
      ])
      expect(Object.values(context.dominance)).toEqual([
        'non-dominated',
        'non-dominated',
      ])
    }
  })

  it('matches the frozen repair-favored and food-favored outcomes', () => {
    const repair = RECOVERY_ALLOCATION_FIXTURES.find(
      (fixture) => fixture.fixtureId === 'repair-favored',
    )!
    expect(
      recoveryAllocationOutcome(
        repair,
        'allocate-repair-buffer',
      ),
    ).toEqual({
      endingFood: 14,
      endingRepair: 5,
      equipmentRecoveryLoad: 2,
      personnelReadiness: 1,
    })
    expect(
      recoveryAllocationOutcome(
        repair,
        'allocate-food-production',
      ),
    ).toEqual({
      endingFood: 15,
      endingRepair: 4,
      equipmentRecoveryLoad: 2,
      personnelReadiness: 1,
    })

    const food = RECOVERY_ALLOCATION_FIXTURES.find(
      (fixture) => fixture.fixtureId === 'food-favored',
    )!
    expect(
      recoveryAllocationOutcome(
        food,
        'allocate-food-production',
      ),
    ).toEqual({
      endingFood: 12,
      endingRepair: 6,
      equipmentRecoveryLoad: 1,
      personnelReadiness: 0,
    })
    expect(
      recoveryAllocationOutcome(
        food,
        'allocate-repair-buffer',
      ),
    ).toEqual({
      endingFood: 11,
      endingRepair: 7,
      equipmentRecoveryLoad: 1,
      personnelReadiness: 0,
    })
  })

  it('changes infrastructure pressure by exactly one for W1 exposure weighting', () => {
    const matrix = buildRecoveryAllocationBranchMatrix()
    const low = matrix.contexts.find(
      ({ fixture }) =>
        fixture.fixtureId === 'w1-exposure-weighting-low',
    )!
    const high = matrix.contexts.find(
      ({ fixture }) =>
        fixture.fixtureId === 'w1-exposure-weighting-high',
    )!
    expect(high.infrastructurePressure).toBe(
      low.infrastructurePressure + 1,
    )
    expect(Object.values(low.dominance)).not.toContain(
      'dominated',
    )
    expect(Object.values(high.dominance)).not.toContain(
      'dominated',
    )
  })

  it('provides one rational continuation policy for each candidate without a system recommendation', () => {
    const matrix = buildRecoveryAllocationBranchMatrix()
    const repair = matrix.contexts.find(
      ({ fixture }) => fixture.fixtureId === 'repair-favored',
    )!
    const food = matrix.contexts.find(
      ({ fixture }) => fixture.fixtureId === 'food-favored',
    )!
    expect(
      repair.preferredByPolicy['infrastructure-resilience'],
    ).toBe('allocate-repair-buffer')
    expect(food.preferredByPolicy['food-security']).toBe(
      'allocate-food-production',
    )
  })
})
