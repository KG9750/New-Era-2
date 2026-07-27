import { evaluateDominance } from '../scenario/gate1-week-one'
import {
  RECOVERY_ALLOCATION_RESOURCE_LOT_ID,
  RECOVERY_ALLOCATION_TICK_COUNT,
  RECOVERY_ALLOCATION_TICK_INTERVAL,
  infrastructurePressure,
} from './management-choices'
import type {
  EquipmentExposure,
  RecoveryAllocationCandidateId,
} from './model'

export const RECOVERY_ALLOCATION_OUTCOME_AXES = [
  { id: 'endingFood', direction: 'higher' },
  { id: 'endingRepair', direction: 'higher' },
  { id: 'equipmentRecoveryLoad', direction: 'lower' },
  { id: 'personnelReadiness', direction: 'higher' },
] as const

export interface RecoveryAllocationFixture {
  fixtureId:
    | 'repair-favored'
    | 'food-favored'
    | 'w1-exposure-weighting-low'
    | 'w1-exposure-weighting-high'
  endingFood: number
  endingRepair: number
  equipmentRecoveryLoad: 0 | 1 | 2
  equipmentExposure: EquipmentExposure
  personnelReadiness: number
}

export const RECOVERY_ALLOCATION_FIXTURES: readonly RecoveryAllocationFixture[] =
  [
    {
      fixtureId: 'repair-favored',
      endingFood: 14,
      endingRepair: 4,
      equipmentRecoveryLoad: 2,
      equipmentExposure: 'high',
      personnelReadiness: 1,
    },
    {
      fixtureId: 'food-favored',
      endingFood: 11,
      endingRepair: 6,
      equipmentRecoveryLoad: 1,
      equipmentExposure: 'low',
      personnelReadiness: 0,
    },
    {
      fixtureId: 'w1-exposure-weighting-low',
      endingFood: 13,
      endingRepair: 5,
      equipmentRecoveryLoad: 1,
      equipmentExposure: 'low',
      personnelReadiness: 0,
    },
    {
      fixtureId: 'w1-exposure-weighting-high',
      endingFood: 13,
      endingRepair: 5,
      equipmentRecoveryLoad: 2,
      equipmentExposure: 'high',
      personnelReadiness: 0,
    },
  ]

export function recoveryAllocationOutcome(
  fixture: RecoveryAllocationFixture,
  candidateId: RecoveryAllocationCandidateId,
) {
  return {
    endingFood:
      fixture.endingFood +
      (candidateId === 'allocate-food-production' ? 1 : 0),
    endingRepair:
      fixture.endingRepair +
      (candidateId === 'allocate-repair-buffer' ? 1 : 0),
    equipmentRecoveryLoad: fixture.equipmentRecoveryLoad,
    personnelReadiness: fixture.personnelReadiness,
  }
}

function outcomeVector(
  outcome: ReturnType<typeof recoveryAllocationOutcome>,
) {
  return RECOVERY_ALLOCATION_OUTCOME_AXES.map(
    (axis) => outcome[axis.id],
  )
}

export function buildRecoveryAllocationBranchMatrix() {
  const candidateIds = [
    'allocate-repair-buffer',
    'allocate-food-production',
  ] as const
  const policyIds = [
    'infrastructure-resilience',
    'food-security',
  ] as const
  const contexts = RECOVERY_ALLOCATION_FIXTURES.map(
    (fixture) => {
      const options = candidateIds.map((candidateId) => ({
        optionId: candidateId,
        resultsByPolicy: Object.fromEntries(
          policyIds.map((policyId) => [
            policyId,
            outcomeVector(
              recoveryAllocationOutcome(fixture, candidateId),
            ),
          ]),
        ),
      }))
      const dominance = evaluateDominance({
        continuationPolicyIds: policyIds,
        axes: RECOVERY_ALLOCATION_OUTCOME_AXES,
        options,
      })
      const outcomes = Object.fromEntries(
        candidateIds.map((candidateId) => [
          candidateId,
          recoveryAllocationOutcome(fixture, candidateId),
        ]),
      )
      return {
        fixture,
        resource: {
          scarceResourceLotId:
            RECOVERY_ALLOCATION_RESOURCE_LOT_ID,
          resourceUnit: 'schedule-block',
          resourceQuantity: 1,
          resourceOwner: 'chen-du',
          dayIndex: 10,
          blockIndex: 2,
          resourceTimeWindow:
            'day-index-10:block-index-2',
          resourceTickInterval:
            RECOVERY_ALLOCATION_TICK_INTERVAL,
          resourceTickCount:
            RECOVERY_ALLOCATION_TICK_COUNT,
          originalActivity: 'rest',
        },
        outcomes,
        dominance,
        preferredByPolicy: {
          'infrastructure-resilience':
            fixture.endingRepair < 5 ||
            fixture.equipmentRecoveryLoad === 2
              ? 'allocate-repair-buffer'
              : 'allocate-food-production',
          'food-security':
            fixture.endingFood < 12
              ? 'allocate-food-production'
              : 'allocate-repair-buffer',
        },
        infrastructurePressure:
          infrastructurePressure(
            fixture.endingRepair,
            fixture.equipmentRecoveryLoad,
          ),
      }
    },
  )
  return {
    scenarioVersion: '0.5.1',
    protocolVersion:
      'weekly-management-slice-playtest-v0.3',
    axes: RECOVERY_ALLOCATION_OUTCOME_AXES,
    contexts,
  }
}
