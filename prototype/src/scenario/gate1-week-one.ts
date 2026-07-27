import type { ScenarioDefinition, SimulationState } from '../sim/model'
import { createInitialBasePlan } from '../sim/schedule'

export const TICKS_PER_DAY = 144
export const START_TICK = 54
export const PUMP_EVENT_TICK = TICKS_PER_DAY * 2 + 54
export const WEEK_END_TICK = TICKS_PER_DAY * 6 + 138
export const SIMULATION_END_TICK = TICKS_PER_DAY * 13 + 138
export const LIN_HE_REQUEST_DEADLINE_TICK = TICKS_PER_DAY * 8 + 54
export const WEEK_START_TICKS = [
  START_TICK,
  TICKS_PER_DAY * 7 + START_TICK,
] as const
export const WEEKLY_TRANSPORT_START_TICKS = [
  78,
  TICKS_PER_DAY * 7 + 78,
] as const
export const GATE1_PROTOCOL_VERSION =
  'weekly-management-slice-playtest-v0.3' as const

export type DominanceStatus =
  | 'non-dominated'
  | 'dominated'
  | 'unverified'

export interface BranchMatrixAxis {
  id: string
  direction: 'higher' | 'lower'
}

export interface BranchMatrixOption {
  optionId: string
  resultsByPolicy: Readonly<Record<string, readonly number[]>>
}

export interface DominanceCase {
  continuationPolicyIds: readonly string[]
  axes: readonly BranchMatrixAxis[]
  options: readonly BranchMatrixOption[]
}

export interface Gate1BranchPlan {
  pumpPlan: 'protect' | 'expose'
  food: 'food-shift-qiao' | 'accept-food-gap'
  repair:
    | 'schedule-qiao'
    | 'schedule-chen'
    | 'schedule-su'
    | 'accept-debt'
  transport:
    | 'south-week-one'
    | 'south-week-two'
    | 'north-loop'
  fertilizer: 'use-week-one' | 'use-week-two' | 'keep'
  linHe: 'accept-study' | 'decline-study'
}

export interface Gate1BranchOutcome {
  isComplete: boolean
  weekOneFood: number
  weekOneRepair: number
  weekOneRepairDebtCost: number
  weekOneCharacterLoadCost: number
  weekOnePumpStatus: 'protected' | 'failed'
  weekOneRepairResolution:
    | 'qiao-pan'
    | 'chen-du'
    | 'su-ji'
    | 'debt'
  weekOneTransportRoute: 'north-loop' | 'south-shortcut'
  weekOneFertilizerRemaining: 0 | 1
  weekTwoFood: number
  weekTwoRepair: number
  repairDebtCost: number
  characterLoadCost: number
  transportFoodLoss: number
  fertilizerRemaining: number
  linHeCommitment: 0 | 1
}

export type Gate1ChoiceSetId =
  | 'choice:w0:food-plan'
  | 'choice:w0:pump-repair'
  | 'choice:w0:transport-route'
  | 'choice:w1:transport-route'
  | 'choice:w0:fertilizer'
  | 'choice:w1:fertilizer'
  | 'choice:w1:lin-he-study'
  | 'choice:w0:preventive-capacity'
  | 'choice:w1:recovery-allocation'

export interface Gate1ChoiceSetOracleOption {
  optionId: string
  visibleConsequenceRefs: readonly string[]
  dominanceStatus: DominanceStatus
  implementationOptionIds?: readonly string[]
}

export interface Gate1ChoiceSetOracleEntry {
  choiceSetId: Gate1ChoiceSetId
  decisionIntentId: string
  options: readonly Gate1ChoiceSetOracleOption[]
}

export const GATE1_CHOICE_SET_ORACLE: Readonly<
  Record<Gate1ChoiceSetId, Gate1ChoiceSetOracleEntry>
> = {
  'choice:w0:food-plan': {
    choiceSetId: 'choice:w0:food-plan',
    decisionIntentId: 'w0:food-plan',
    options: [
      {
        optionId: 'food-shift-qiao',
        visibleConsequenceRefs: [
          'forecast:w0:food',
          'forecast:w0:repair',
          'schedule:qiao-pan:d1:b1',
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'accept-food-gap',
        visibleConsequenceRefs: [
          'forecast:w0:food',
          'forecast:w0:repair',
        ],
        dominanceStatus: 'non-dominated',
      },
    ],
  },
  'choice:w0:pump-repair': {
    choiceSetId: 'choice:w0:pump-repair',
    decisionIntentId:
      'w0:repair-responsibility:pump-incident-day-3',
    options: [
      {
        optionId: 'schedule-repair',
        implementationOptionIds: [
          'schedule-qiao',
          'schedule-chen',
          'schedule-su',
        ],
        visibleConsequenceRefs: [
          'forecast:w0:repair',
          'risk:pump',
          'schedule:qiao-pan:d3:b2',
          'schedule:chen-du:d3:b0',
          'schedule:su-ji:d3:b0',
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'accept-debt',
        visibleConsequenceRefs: [
          'recap:w0:repair',
          'risk:repair-debt',
        ],
        dominanceStatus: 'non-dominated',
      },
    ],
  },
  'choice:w0:transport-route': {
    choiceSetId: 'choice:w0:transport-route',
    decisionIntentId: 'w0:transport-route',
    options: [
      {
        optionId: 'north-loop',
        visibleConsequenceRefs: [
          'forecast:w0:food',
          'risk:w0:transport-loss',
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'south-shortcut',
        visibleConsequenceRefs: [
          'forecast:w0:food',
          'risk:w0:transport-loss',
        ],
        dominanceStatus: 'non-dominated',
      },
    ],
  },
  'choice:w1:transport-route': {
    choiceSetId: 'choice:w1:transport-route',
    decisionIntentId: 'w1:transport-route',
    options: [
      {
        optionId: 'north-loop',
        visibleConsequenceRefs: [
          'forecast:w1:food',
          'risk:w1:transport-loss',
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'south-shortcut',
        visibleConsequenceRefs: [
          'forecast:w1:food',
          'risk:w1:transport-loss',
        ],
        dominanceStatus: 'non-dominated',
      },
    ],
  },
  'choice:w0:fertilizer': {
    choiceSetId: 'choice:w0:fertilizer',
    decisionIntentId: 'w0:asset-use:fertilizer',
    options: [
      {
        optionId: 'use-fertilizer',
        visibleConsequenceRefs: [
          'forecast:w0:food',
          'inventory:fertilizer',
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'keep-fertilizer',
        visibleConsequenceRefs: [
          'forecast:w0:food',
          'inventory:fertilizer',
        ],
        dominanceStatus: 'non-dominated',
      },
    ],
  },
  'choice:w1:fertilizer': {
    choiceSetId: 'choice:w1:fertilizer',
    decisionIntentId: 'w1:asset-use:fertilizer',
    options: [
      {
        optionId: 'use-fertilizer',
        visibleConsequenceRefs: [
          'forecast:w1:food',
          'inventory:fertilizer',
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'keep-fertilizer',
        visibleConsequenceRefs: [
          'forecast:w1:food',
          'inventory:fertilizer',
        ],
        dominanceStatus: 'non-dominated',
      },
    ],
  },
  'choice:w1:lin-he-study': {
    choiceSetId: 'choice:w1:lin-he-study',
    decisionIntentId: 'w1:character-request:lin-he-study',
    options: [
      {
        optionId: 'accept-study',
        visibleConsequenceRefs: [
          'forecast:w1:food',
          'schedule:lin-he:d8:b0',
          'character-record:lin-he-study',
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'decline-study',
        visibleConsequenceRefs: [
          'forecast:w1:food',
          'character-record:lin-he-study-declined',
        ],
        dominanceStatus: 'non-dominated',
      },
    ],
  },
  'choice:w0:preventive-capacity': {
    choiceSetId: 'choice:w0:preventive-capacity',
    decisionIntentId: 'w0:preventive-capacity:pump',
    options: [
      {
        optionId: 'schedule-preventive-maintenance',
        visibleConsequenceRefs: [
          'schedule:lin-he:d1:b1',
          'risk:equipment-exposure',
          'state:equipment-recovery-load',
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'retain-rest-capacity',
        visibleConsequenceRefs: [
          'schedule:lin-he:d1:b1',
          'state:lin-he-recovery-units',
          'state:personnel-readiness',
        ],
        dominanceStatus: 'non-dominated',
      },
    ],
  },
  'choice:w1:recovery-allocation': {
    choiceSetId: 'choice:w1:recovery-allocation',
    decisionIntentId:
      'w1:recovery-allocation:pump-vs-food',
    options: [
      {
        optionId: 'allocate-repair-buffer',
        visibleConsequenceRefs: [
          'schedule:chen-du:d10:b2',
          'forecast:w1:repair',
          'state:equipment-recovery-load',
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'allocate-food-production',
        visibleConsequenceRefs: [
          'schedule:chen-du:d10:b2',
          'forecast:w1:food',
          'state:equipment-recovery-load',
        ],
        dominanceStatus: 'non-dominated',
      },
    ],
  },
}

export function getGate1ChoiceSetOracle(
  choiceSetId: Gate1ChoiceSetId,
): Gate1ChoiceSetOracleEntry {
  return GATE1_CHOICE_SET_ORACLE[choiceSetId]
}

export const GATE1_BRANCH_MATRIX_AXES = [
  { id: 'weekOneFood', direction: 'higher' },
  { id: 'weekOneRepair', direction: 'higher' },
  { id: 'weekTwoFood', direction: 'higher' },
  { id: 'weekTwoRepair', direction: 'higher' },
  { id: 'repairDebtCost', direction: 'lower' },
  { id: 'characterLoadCost', direction: 'lower' },
  { id: 'transportFoodLoss', direction: 'lower' },
  { id: 'fertilizerRemaining', direction: 'higher' },
  { id: 'linHeCommitment', direction: 'higher' },
] as const satisfies readonly BranchMatrixAxis[]

export interface Gate1BranchMatrixContextOption
  extends BranchMatrixOption {
  dominanceStatus: DominanceStatus
}

export interface Gate1BranchMatrixContext {
  choiceContextId: string
  choiceSetId: Gate1ChoiceSetId
  continuationPolicyIds: readonly string[]
  options: readonly Gate1BranchMatrixContextOption[]
}

export interface Gate1BranchMatrixOracle {
  scenarioVersion: string
  completeTrajectoryCount: number
  axes: readonly BranchMatrixAxis[]
  contexts: readonly Gate1BranchMatrixContext[]
  weekOneOutcomes: readonly Gate1WeekOneOutcome[]
}

export interface Gate1WeekOneOutcome {
  outcomeId: string
  food: number
  repair: number
  repairDebtCost: number
  characterLoadCost: number
  pumpStatus: 'protected' | 'failed'
  repairResolution: 'qiao-pan' | 'chen-du' | 'su-ji' | 'debt'
  transportRoute: 'north-loop' | 'south-shortcut'
  fertilizerRemaining: 0 | 1
  responseOptionIds: readonly string[]
  improvementOpportunityIds: readonly string[]
}

export function gate1BranchOutcomeVector(
  outcome: Gate1BranchOutcome,
): readonly number[] {
  return GATE1_BRANCH_MATRIX_AXES.map((axis) => outcome[axis.id])
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

export function evaluateDominance(
  input: DominanceCase,
): Readonly<Record<string, DominanceStatus>> {
  const statuses: Record<string, DominanceStatus> = Object.fromEntries(
    input.options.map((option) => [option.optionId, 'unverified']),
  )
  if (
    input.continuationPolicyIds.length === 0 ||
    new Set(input.continuationPolicyIds).size !==
      input.continuationPolicyIds.length ||
    input.axes.length === 0 ||
    new Set(input.axes.map((axis) => axis.id)).size !==
      input.axes.length ||
    input.options.length < 2 ||
    new Set(input.options.map((option) => option.optionId)).size !==
      input.options.length
  ) {
    return statuses
  }
  const expectedPolicyIds = [...input.continuationPolicyIds].sort()
  const complete = input.options.every((option) => {
    const policyIds = Object.keys(option.resultsByPolicy).sort()
    return (
      sameStrings(policyIds, expectedPolicyIds) &&
      expectedPolicyIds.every((policyId) => {
        const vector = option.resultsByPolicy[policyId]
        return (
          vector.length === input.axes.length &&
          vector.every((value) => Number.isFinite(value))
        )
      })
    )
  })

  if (!complete) return statuses

  for (const option of input.options) {
    statuses[option.optionId] = 'non-dominated'
  }
  for (const candidate of input.options) {
    for (const other of input.options) {
      if (candidate.optionId === other.optionId) continue
      let noWorseEverywhere = true
      let strictlyBetterSomewhere = false
      for (const policyId of expectedPolicyIds) {
        const candidateVector = candidate.resultsByPolicy[policyId]
        const otherVector = other.resultsByPolicy[policyId]
        input.axes.forEach((axis, index) => {
          const difference =
            axis.direction === 'higher'
              ? candidateVector[index] - otherVector[index]
              : otherVector[index] - candidateVector[index]
          if (difference < 0) noWorseEverywhere = false
          if (difference > 0) strictlyBetterSomewhere = true
        })
      }
      if (noWorseEverywhere && strictlyBetterSomewhere) {
        statuses[other.optionId] = 'dominated'
      }
    }
  }
  return statuses
}

export const gate1WeekOneScenario: ScenarioDefinition = {
  id: 'gate1-two-week-management',
  version: '0.5.1',
  fixedSeed: 104729,
  startTick: START_TICK,
  weekStartTicks: WEEK_START_TICKS,
  weekEndTick: WEEK_END_TICK,
  weekEndTicks: [WEEK_END_TICK, SIMULATION_END_TICK],
  simulationEndTick: SIMULATION_END_TICK,
  pumpEventTick: PUMP_EVENT_TICK,
  linHeRequestDeadlineTick: LIN_HE_REQUEST_DEADLINE_TICK,
  weeklyTransportStartTicks: WEEKLY_TRANSPORT_START_TICKS,
  scriptedEvents: [
    {
      id: 'pump-incident-day-3',
      atTick: PUMP_EVENT_TICK,
      type: 'PUMP_INCIDENT',
    },
    {
      id: 'lin-he-request-deadline',
      atTick: LIN_HE_REQUEST_DEADLINE_TICK,
      type: 'LIN_HE_REQUEST_DEADLINE',
    },
  ],
  createInitialState(): SimulationState {
    return {
      stateRevision: 0,
      currentTick: START_TICK,
      isPaused: true,
      activity: 'rest',
      basePlan: createInitialBasePlan(),
      weeklyOverrides: {},
      immediateAdjustments: {},
      scheduleTransactions: [],
      pumpStatus: 'at-risk',
      processedScriptEventIds: [],
      actionLog: [],
      timeline: [],
      planSnapshot: null,
      supplyPlanSnapshot: null,
      recap: null,
      recaps: [],
      completedWeekIndexes: [],
      isComplete: false,
      inventory: {
        food: 18,
        repair: 9,
      },
      fertilizer: {
        initialUnits: 1,
        appliedWeekIndex: null,
        remainingUnits: 1,
      },
      fertilizerUsed: false,
      acceptedFoodShortfall: false,
      linHeRequestDecision: 'pending',
      linHeRequestResolutionSource: null,
      transportRouteId: 'north-loop',
      transportRouteOpenedAtTick: null,
      repairResponsibilitySelection: null,
      repairResponsibility: 'unresolved',
      repairResponsibilityAssignment: null,
      repairDebt: null,
      characterRecords: {
        'lin-he': ['第二周希望占用一个农务块学习，等待管理者答复。'],
        'qiao-pan': ['接受正常排班与连续不超过两日的短期加班。'],
        'su-ji': ['物流效率稳定，可承担基础岗位交接。'],
        'chen-du': ['泛用协作稳定，适合作为粮食与维修之间的调剂者。'],
      },
      managementChoices: {
        authority: null,
        opportunities: {
          preventiveCapacity: null,
          recoveryAllocation: null,
        },
        commitments: [],
        settledOutcomes: [],
        effectOwnership: {},
        equipmentExposure: 'high',
        equipmentRecoveryLoad: 2,
        preventiveCapacityAllocation: 'unallocated',
        linHeRecoveryUnits: 0,
        personnelReadiness: 0,
      },
    }
  },
}
