import {
  GATE1_PROTOCOL_VERSION,
  gate1WeekOneScenario as scenario,
} from '../scenario/gate1-week-one'
import { sha256Canonical } from './canonical-hash'
import {
  calculateFoodForecast,
  calculateRepairForecast,
} from './forecast'
import type {
  Activity,
  ManagementCandidateId,
  ManagementChoiceAuthority,
  ManagementChoiceCommitRequest,
  ManagementChoiceCommitment,
  ManagementChoiceConsequence,
  ManagementChoiceOpportunity,
  ManagementChoiceSetId,
  ManagementDecisionIntentId,
  ManagementTerminalState,
  SimulationState,
} from './model'
import {
  PUMP_MAINTENANCE_BLOCK_ID,
  RECOVERY_ALLOCATION_BLOCK_ID,
  applyScheduleTransaction,
  hasPreventiveMaintenance,
  resolveScheduleBlock,
} from './schedule'
import { weekIndexForTick } from './week-phase'

export { RECOVERY_ALLOCATION_BLOCK_ID }

export const PREVENTIVE_CAPACITY_CHOICE_SET_ID =
  'choice:w0:preventive-capacity' as const
export const PREVENTIVE_CAPACITY_INTENT_ID =
  'w0:preventive-capacity:pump' as const
export const RECOVERY_ALLOCATION_CHOICE_SET_ID =
  'choice:w1:recovery-allocation' as const
export const RECOVERY_ALLOCATION_INTENT_ID =
  'w1:recovery-allocation:pump-vs-food' as const
export const RECOVERY_ALLOCATION_RESOURCE_LOT_ID =
  'schedule-slot:chen-du:d10:b2' as const
export const RECOVERY_ALLOCATION_TICK_INTERVAL =
  [1536, 1554] as const
export const RECOVERY_ALLOCATION_TICK_COUNT = 18 as const
export const PREVENTIVE_CAPACITY_DEADLINE_TICK = 240 as const
export const RECOVERY_ALLOCATION_DEADLINE_TICK =
  RECOVERY_ALLOCATION_TICK_INTERVAL[1]

const W1_REQUIRED_CONSEQUENCES = {
  'schedule-preventive-maintenance': [
    'consequence:w0:preventive-capacity:schedule',
    'consequence:w0:preventive-capacity:equipment-exposure',
    'consequence:w0:preventive-capacity:recovery-load',
  ],
  'retain-rest-capacity': [
    'consequence:w0:preventive-capacity:allocation',
    'consequence:w0:preventive-capacity:rest-recovery',
    'consequence:w0:preventive-capacity:personnel-readiness',
  ],
} as const

const W2_REQUIRED_CONSEQUENCES = {
  'allocate-repair-buffer': [
    'consequence:w1:recovery-allocation:schedule',
    'consequence:w1:recovery-allocation:ending-repair',
  ],
  'allocate-food-production': [
    'consequence:w1:recovery-allocation:schedule',
    'consequence:w1:recovery-allocation:ending-food',
  ],
} as const

export type ManagementChoiceCommitFailureCode =
  | 'STATE_REVISION_CONFLICT'
  | 'OPPORTUNITY_ALREADY_COMMITTED'
  | 'OPPORTUNITY_MISMATCH'
  | 'AUTHORITY_MISMATCH'
  | 'STALE_PROJECTION'
  | 'CANDIDATE_NOT_IN_CHOICE_SET'
  | 'ORIGINAL_ACTIVITY_MISMATCH'
  | 'OPPORTUNITY_NOT_ACTIVE'
  | 'EFFECT_ALREADY_OWNED'
  | 'CANONICAL_DELTA_MISMATCH'

export type ManagementChoiceCommitResult =
  | {
      ok: true
      state: SimulationState
      commitment: ManagementChoiceCommitment
    }
  | {
      ok: false
      code: ManagementChoiceCommitFailureCode
      state: SimulationState
    }

function hash(value: unknown) {
  return sha256Canonical(value)
}

function opportunityKey(choiceSetId: ManagementChoiceSetId) {
  return choiceSetId === PREVENTIVE_CAPACITY_CHOICE_SET_ID
    ? 'preventiveCapacity'
    : 'recoveryAllocation'
}

function opportunityFor(
  state: SimulationState,
  choiceSetId: ManagementChoiceSetId,
) {
  return state.managementChoices.opportunities[
    opportunityKey(choiceSetId)
  ]
}

function candidateBelongsToChoiceSet(
  choiceSetId: ManagementChoiceSetId,
  candidateId: ManagementCandidateId,
) {
  return choiceSetId === PREVENTIVE_CAPACITY_CHOICE_SET_ID
    ? candidateId === 'schedule-preventive-maintenance' ||
        candidateId === 'retain-rest-capacity'
    : candidateId === 'allocate-repair-buffer' ||
        candidateId === 'allocate-food-production'
}

function requiredConsequenceIds(
  candidateId: ManagementCandidateId,
): readonly string[] {
  if (
    candidateId === 'schedule-preventive-maintenance' ||
    candidateId === 'retain-rest-capacity'
  ) {
    return W1_REQUIRED_CONSEQUENCES[candidateId]
  }
  return W2_REQUIRED_CONSEQUENCES[candidateId]
}

function allRequiredConsequenceIds(
  choiceSetId: ManagementChoiceSetId,
) {
  return choiceSetId === PREVENTIVE_CAPACITY_CHOICE_SET_ID
    ? [
        ...W1_REQUIRED_CONSEQUENCES[
          'schedule-preventive-maintenance'
        ],
        ...W1_REQUIRED_CONSEQUENCES['retain-rest-capacity'],
      ]
    : [
        ...W2_REQUIRED_CONSEQUENCES['allocate-repair-buffer'],
        ...W2_REQUIRED_CONSEQUENCES['allocate-food-production'],
      ]
}

function opportunityProjection(
  state: SimulationState,
  choiceSetId: ManagementChoiceSetId,
  issuedAuthority = state.managementChoices.authority,
) {
  if (issuedAuthority === null) {
    throw new Error('Management choice authority is unavailable')
  }
  const authorityTuple = {
    diagnosisId: issuedAuthority.diagnosisId,
    sessionId: issuedAuthority.sessionId,
    candidateBuildAuthorityHash:
      issuedAuthority.candidateBuildAuthorityHash,
    sessionAuthorityToken:
      issuedAuthority.sessionAuthorityToken,
  }
  if (choiceSetId === PREVENTIVE_CAPACITY_CHOICE_SET_ID) {
    return {
      protocolVersion: GATE1_PROTOCOL_VERSION,
      scenarioVersion: scenario.version,
      authorityTuple,
      choiceSetId,
      decisionIntentId: PREVENTIVE_CAPACITY_INTENT_ID,
      pumpObjectId: 'water-pump',
      restSlotId: PUMP_MAINTENANCE_BLOCK_ID,
      restSlotActivity: resolveScheduleBlock(
        state,
        PUMP_MAINTENANCE_BLOCK_ID,
      ).activity,
      firstMaintenancePresent:
        resolveScheduleBlock(state, 'qiao-pan:d1:b0')
          .activity === 'repair',
      secondMaintenancePresent: hasPreventiveMaintenance(state),
      preventiveCapacity: hasPreventiveMaintenance(state)
        ? 2
        : 1,
      preventiveCapacityAllocation:
        state.managementChoices.preventiveCapacityAllocation,
      equipmentExposure:
        state.managementChoices.equipmentExposure,
      candidates: [
        {
          candidateId: 'schedule-preventive-maintenance',
          requiredConsequenceIds:
            W1_REQUIRED_CONSEQUENCES[
              'schedule-preventive-maintenance'
            ],
        },
        {
          candidateId: 'retain-rest-capacity',
          requiredConsequenceIds:
            W1_REQUIRED_CONSEQUENCES['retain-rest-capacity'],
        },
      ],
    }
  }

  const food = calculateFoodForecast(state).endingStock
  const repair = calculateRepairForecast(state).endingStock
  const w1Opportunity =
    state.managementChoices.opportunities.preventiveCapacity
  return {
    protocolVersion: GATE1_PROTOCOL_VERSION,
    scenarioVersion: scenario.version,
    authorityTuple,
    choiceSetId,
    decisionIntentId: RECOVERY_ALLOCATION_INTENT_ID,
    w1TerminalState:
      w1Opportunity?.terminalState ?? 'omitted',
    w1ResultRevision: w1Opportunity?.stateRevision ?? null,
    equipmentExposure:
      state.managementChoices.equipmentExposure,
    equipmentRecoveryLoad:
      state.managementChoices.equipmentRecoveryLoad,
    resourceLotId: RECOVERY_ALLOCATION_RESOURCE_LOT_ID,
    resourceUnit: 'schedule-block',
    resourceQuantity: 1,
    resourceOwner: 'chen-du',
    dayIndex: 10,
    blockIndex: 2,
    resourceTimeWindow: 'day-index-10:block-index-2',
    resourceTickInterval: RECOVERY_ALLOCATION_TICK_INTERVAL,
    resourceTickCount: RECOVERY_ALLOCATION_TICK_COUNT,
    originalActivity: resolveScheduleBlock(
      state,
      RECOVERY_ALLOCATION_BLOCK_ID,
    ).activity,
    competingTarget: 'food-production',
    endingFood: food,
    endingRepair: repair,
    candidates: [
      {
        candidateId: 'allocate-repair-buffer',
        projectedEndingRepairDelta: 1,
        projectedEndingFoodDelta: 0,
        requiredConsequenceIds:
          W2_REQUIRED_CONSEQUENCES['allocate-repair-buffer'],
      },
      {
        candidateId: 'allocate-food-production',
        projectedEndingRepairDelta: 0,
        projectedEndingFoodDelta: 1,
        requiredConsequenceIds:
          W2_REQUIRED_CONSEQUENCES['allocate-food-production'],
      },
    ],
  }
}

function candidateProjection(
  state: SimulationState,
  choiceSetId: ManagementChoiceSetId,
  candidateId: ManagementCandidateId,
) {
  const base = opportunityProjection(state, choiceSetId)
  if (choiceSetId === PREVENTIVE_CAPACITY_CHOICE_SET_ID) {
    return {
      ...base,
      selectedCandidateId: candidateId,
      scheduleSlot: PUMP_MAINTENANCE_BLOCK_ID,
      beforeActivity: resolveScheduleBlock(
        state,
        PUMP_MAINTENANCE_BLOCK_ID,
      ).activity,
      afterActivity:
        candidateId === 'schedule-preventive-maintenance'
          ? 'repair'
          : 'rest',
      equipmentExposure:
        candidateId === 'schedule-preventive-maintenance'
          ? 'low'
          : 'high',
      equipmentRecoveryLoad:
        candidateId === 'schedule-preventive-maintenance' ? 1 : 2,
      linHeRecoveryUnits:
        candidateId === 'retain-rest-capacity' ? 1 : 0,
      personnelReadinessDelta:
        candidateId === 'retain-rest-capacity' ? 1 : 0,
      requiredConsequenceIds: requiredConsequenceIds(candidateId),
    }
  }
  return {
    ...base,
    selectedCandidateId: candidateId,
    scheduleSlot: RECOVERY_ALLOCATION_BLOCK_ID,
    beforeActivity: resolveScheduleBlock(
      state,
      RECOVERY_ALLOCATION_BLOCK_ID,
    ).activity,
    afterActivity:
      candidateId === 'allocate-repair-buffer'
        ? 'repair'
        : 'food',
    projectedEndingRepairDelta:
      candidateId === 'allocate-repair-buffer' ? 1 : 0,
    projectedEndingFoodDelta:
      candidateId === 'allocate-food-production' ? 1 : 0,
    requiredConsequenceIds: requiredConsequenceIds(candidateId),
  }
}

function createOpportunity(
  state: SimulationState,
  authority: ManagementChoiceAuthority,
  choiceSetId: ManagementChoiceSetId,
  stateRevision: number,
): ManagementChoiceOpportunity {
  const preventive =
    choiceSetId === PREVENTIVE_CAPACITY_CHOICE_SET_ID
  return {
    opportunityId: `opportunity:${authority.sessionId}:${preventive ? 'w0:preventive-capacity' : 'w1:recovery-allocation'}`,
    decisionIntentId: preventive
      ? PREVENTIVE_CAPACITY_INTENT_ID
      : RECOVERY_ALLOCATION_INTENT_ID,
    choiceSetId,
    candidateId: null,
    objectRef: preventive ? 'water-pump' : 'pump-recovery',
    week: preventive ? 0 : 1,
    diagnosisId: authority.diagnosisId,
    sessionId: authority.sessionId,
    candidateBuildAuthorityHash:
      authority.candidateBuildAuthorityHash,
    sessionAuthorityToken:
      authority.sessionAuthorityToken,
    stateRevision,
    projectionBaseHash: hash(
      opportunityProjection(state, choiceSetId, authority),
    ),
    candidateProjectionHash: null,
    idempotencyKey: null,
    commitCause: 'opportunity-created',
    resourceClaimRef: preventive
      ? `schedule-slot:${PUMP_MAINTENANCE_BLOCK_ID}`
      : RECOVERY_ALLOCATION_RESOURCE_LOT_ID,
    requiredConsequenceIds:
      allRequiredConsequenceIds(choiceSetId),
    effectFingerprints: [],
    terminalState: 'open',
    committedAtSequence: null,
  }
}

export function bindManagementChoiceAuthority(
  state: SimulationState,
  authority: ManagementChoiceAuthority,
): SimulationState {
  const existing = state.managementChoices.authority
  if (existing !== null) {
    if (
      existing.diagnosisId !== authority.diagnosisId ||
      existing.sessionId !== authority.sessionId ||
      existing.candidateBuildAuthorityHash !==
        authority.candidateBuildAuthorityHash ||
      existing.sessionAuthorityToken !==
        authority.sessionAuthorityToken
    ) {
      throw new Error(
        'Management choice authority cannot be rebound across sessions',
      )
    }
    return state
  }
  const preventiveCapacity = createOpportunity(
    state,
    authority,
    PREVENTIVE_CAPACITY_CHOICE_SET_ID,
    state.stateRevision,
  )
  return {
    ...state,
    managementChoices: {
      ...state.managementChoices,
      authority: { ...authority },
      opportunities: {
        ...state.managementChoices.opportunities,
        preventiveCapacity,
      },
    },
  }
}

export function createManagementChoiceCommitRequest(
  state: SimulationState,
  choiceSetId: ManagementChoiceSetId,
  candidateId: ManagementCandidateId,
  idempotencyKey: string,
): ManagementChoiceCommitRequest {
  const opportunity = opportunityFor(state, choiceSetId)
  const authority = state.managementChoices.authority
  if (
    opportunity === null ||
    authority === null ||
    !candidateBelongsToChoiceSet(choiceSetId, candidateId)
  ) {
    throw new Error('Management choice opportunity is unavailable')
  }
  return {
    opportunityId: opportunity.opportunityId,
    choiceSetId,
    candidateId,
    diagnosisId: authority.diagnosisId,
    sessionId: authority.sessionId,
    candidateBuildAuthorityHash:
      authority.candidateBuildAuthorityHash,
    sessionAuthorityToken:
      authority.sessionAuthorityToken,
    stateRevision: state.stateRevision,
    projectionBaseHash: hash(
      opportunityProjection(state, choiceSetId),
    ),
    candidateProjectionHash: hash(
      candidateProjection(state, choiceSetId, candidateId),
    ),
    idempotencyKey,
    commitCause: 'explicit-candidate-action',
  }
}

export function isManagementChoiceActive(
  state: SimulationState,
  choiceSetId: ManagementChoiceSetId,
) {
  const opportunity = opportunityFor(state, choiceSetId)
  if (
    opportunity === null ||
    opportunity.terminalState !== 'open'
  ) {
    return false
  }
  const weekIndex = weekIndexForTick(
    state.currentTick,
    scenario,
  )
  const deadline =
    choiceSetId === PREVENTIVE_CAPACITY_CHOICE_SET_ID
      ? PREVENTIVE_CAPACITY_DEADLINE_TICK
      : RECOVERY_ALLOCATION_DEADLINE_TICK
  return (
    weekIndex === opportunity.week &&
    state.currentTick < deadline
  )
}

function createEffectFingerprint(input: {
  authorityTuple: ManagementChoiceAuthority
  decisionIntentId: ManagementDecisionIntentId
  choiceSetId: ManagementChoiceSetId
  candidateId: ManagementCandidateId
  consequenceId: string
  objectRef: string
  resourceLotId: string
  stateRevisionBefore: number
  stateRevisionAfter: number
  scheduleSlot: string
  beforeValue: string | number
  afterValue: string | number
}) {
  return `effect:${hash(input)}`
}

function consequence(
  request: ManagementChoiceCommitRequest,
  opportunity: ManagementChoiceOpportunity,
  committedAtSequence: number,
  consequenceId: string,
  objectRef: string,
  beforeValue: string | number,
  afterValue: string | number,
  scheduleSlot: string,
): ManagementChoiceConsequence {
  const requiredIds = requiredConsequenceIds(
    request.candidateId,
  )
  const effectFingerprint = createEffectFingerprint({
    authorityTuple: {
      diagnosisId: opportunity.diagnosisId,
      sessionId: opportunity.sessionId,
      candidateBuildAuthorityHash:
        opportunity.candidateBuildAuthorityHash,
      sessionAuthorityToken:
        opportunity.sessionAuthorityToken,
    },
    decisionIntentId: opportunity.decisionIntentId,
    choiceSetId: opportunity.choiceSetId,
    candidateId: request.candidateId,
    consequenceId,
    objectRef,
    resourceLotId: opportunity.resourceClaimRef,
    stateRevisionBefore: request.stateRevision,
    stateRevisionAfter: request.stateRevision + 1,
    scheduleSlot,
    beforeValue,
    afterValue,
  })
  return {
    consequenceId,
    opportunityId: opportunity.opportunityId,
    decisionIntentId: opportunity.decisionIntentId,
    choiceSetId: opportunity.choiceSetId,
    candidateId: request.candidateId,
    objectRef,
    week: opportunity.week,
    diagnosisId: opportunity.diagnosisId,
    sessionId: opportunity.sessionId,
    candidateBuildAuthorityHash:
      opportunity.candidateBuildAuthorityHash,
    sessionAuthorityToken:
      opportunity.sessionAuthorityToken,
    stateRevision: request.stateRevision,
    projectionBaseHash: request.projectionBaseHash,
    candidateProjectionHash:
      request.candidateProjectionHash,
    idempotencyKey: request.idempotencyKey,
    commitCause: 'explicit-candidate-action',
    resourceClaimRef: opportunity.resourceClaimRef,
    requiredConsequenceIds: requiredIds,
    effectFingerprints: [effectFingerprint],
    terminalState: request.candidateId,
    committedAtSequence,
    effectFingerprint,
    beforeValue,
    afterValue,
  }
}

function consequencesFor(
  state: SimulationState,
  scheduledState: SimulationState,
  request: ManagementChoiceCommitRequest,
  opportunity: ManagementChoiceOpportunity,
  committedAtSequence: number,
) {
  if (
    request.candidateId ===
    'schedule-preventive-maintenance'
  ) {
    return [
      consequence(
        request,
        opportunity,
        committedAtSequence,
        W1_REQUIRED_CONSEQUENCES[
          'schedule-preventive-maintenance'
        ][0],
        PUMP_MAINTENANCE_BLOCK_ID,
        'rest',
        'repair',
        PUMP_MAINTENANCE_BLOCK_ID,
      ),
      consequence(
        request,
        opportunity,
        committedAtSequence,
        W1_REQUIRED_CONSEQUENCES[
          'schedule-preventive-maintenance'
        ][1],
        'water-pump:equipment-exposure',
        'high',
        'low',
        PUMP_MAINTENANCE_BLOCK_ID,
      ),
      consequence(
        request,
        opportunity,
        committedAtSequence,
        W1_REQUIRED_CONSEQUENCES[
          'schedule-preventive-maintenance'
        ][2],
        'water-pump:equipment-recovery-load',
        2,
        1,
        PUMP_MAINTENANCE_BLOCK_ID,
      ),
    ]
  }
  if (request.candidateId === 'retain-rest-capacity') {
    return [
      consequence(
        request,
        opportunity,
        committedAtSequence,
        W1_REQUIRED_CONSEQUENCES['retain-rest-capacity'][0],
        'water-pump:preventive-capacity-allocation',
        'unallocated',
        'rest',
        PUMP_MAINTENANCE_BLOCK_ID,
      ),
      consequence(
        request,
        opportunity,
        committedAtSequence,
        W1_REQUIRED_CONSEQUENCES['retain-rest-capacity'][1],
        'lin-he:recovery-units',
        0,
        1,
        PUMP_MAINTENANCE_BLOCK_ID,
      ),
      consequence(
        request,
        opportunity,
        committedAtSequence,
        W1_REQUIRED_CONSEQUENCES['retain-rest-capacity'][2],
        'settlement:personnel-readiness',
        state.managementChoices.personnelReadiness,
        state.managementChoices.personnelReadiness + 1,
        PUMP_MAINTENANCE_BLOCK_ID,
      ),
    ]
  }
  const repair =
    request.candidateId === 'allocate-repair-buffer'
  const beforeForecast = repair
    ? calculateRepairForecast(state).endingStock.high
    : calculateFoodForecast(state).endingStock.high
  const afterForecast = repair
    ? calculateRepairForecast(scheduledState).endingStock.high
    : calculateFoodForecast(scheduledState).endingStock.high
  return [
    consequence(
      request,
      opportunity,
      committedAtSequence,
      W2_REQUIRED_CONSEQUENCES[request.candidateId][0],
      RECOVERY_ALLOCATION_BLOCK_ID,
      'rest',
      repair ? 'repair' : 'food',
      RECOVERY_ALLOCATION_BLOCK_ID,
    ),
    consequence(
      request,
      opportunity,
      committedAtSequence,
      W2_REQUIRED_CONSEQUENCES[request.candidateId][1],
      repair
        ? 'forecast:ending-repair'
        : 'forecast:ending-food',
      beforeForecast,
      afterForecast,
      RECOVERY_ALLOCATION_BLOCK_ID,
    ),
  ]
}

function failure(
  state: SimulationState,
  code: ManagementChoiceCommitFailureCode,
): ManagementChoiceCommitResult {
  return { ok: false, code, state }
}

export function commitManagementChoice(
  state: SimulationState,
  request: ManagementChoiceCommitRequest,
  committedAtSequence: number,
  actionId: string,
): ManagementChoiceCommitResult {
  if (request.stateRevision !== state.stateRevision) {
    return failure(state, 'STATE_REVISION_CONFLICT')
  }
  if (!candidateBelongsToChoiceSet(
    request.choiceSetId,
    request.candidateId,
  )) {
    return failure(state, 'CANDIDATE_NOT_IN_CHOICE_SET')
  }
  const opportunity = opportunityFor(
    state,
    request.choiceSetId,
  )
  if (
    opportunity === null ||
    opportunity.opportunityId !== request.opportunityId
  ) {
    return failure(state, 'OPPORTUNITY_MISMATCH')
  }
  if (opportunity.terminalState !== 'open') {
    return failure(state, 'OPPORTUNITY_ALREADY_COMMITTED')
  }
  const authority = state.managementChoices.authority
  if (
    authority === null ||
    authority.diagnosisId !== request.diagnosisId ||
    authority.sessionId !== request.sessionId ||
    authority.candidateBuildAuthorityHash !==
      request.candidateBuildAuthorityHash ||
    authority.sessionAuthorityToken !==
      request.sessionAuthorityToken ||
    opportunity.diagnosisId !== request.diagnosisId ||
    opportunity.sessionId !== request.sessionId ||
    opportunity.candidateBuildAuthorityHash !==
      request.candidateBuildAuthorityHash ||
    opportunity.sessionAuthorityToken !==
      request.sessionAuthorityToken
  ) {
    return failure(state, 'AUTHORITY_MISMATCH')
  }
  const expectedBaseHash = hash(
    opportunityProjection(state, request.choiceSetId),
  )
  const expectedCandidateHash = hash(
    candidateProjection(
      state,
      request.choiceSetId,
      request.candidateId,
    ),
  )
  if (
    request.projectionBaseHash !== expectedBaseHash ||
    request.candidateProjectionHash !==
      expectedCandidateHash
  ) {
    return failure(state, 'STALE_PROJECTION')
  }
  if (!isManagementChoiceActive(state, request.choiceSetId)) {
    return failure(state, 'OPPORTUNITY_NOT_ACTIVE')
  }
  const blockId =
    opportunity.week === 0
      ? PUMP_MAINTENANCE_BLOCK_ID
      : RECOVERY_ALLOCATION_BLOCK_ID
  if (resolveScheduleBlock(state, blockId).activity !== 'rest') {
    return failure(state, 'ORIGINAL_ACTIVITY_MISMATCH')
  }

  const activity: Activity =
    request.candidateId ===
    'schedule-preventive-maintenance'
      ? 'repair'
      : request.candidateId === 'allocate-repair-buffer'
        ? 'repair'
        : request.candidateId ===
            'allocate-food-production'
          ? 'food'
          : 'rest'
  const scheduled =
    activity === 'rest'
      ? state
      : applyScheduleTransaction(state, actionId, {
          type: 'EDIT_SCHEDULE',
          blockIds: [blockId],
          activity,
          scope: 'weekly',
        })
  if (opportunity.week === 1) {
    const foodBefore =
      calculateFoodForecast(state).endingStock
    const foodAfter =
      calculateFoodForecast(scheduled).endingStock
    const repairBefore =
      calculateRepairForecast(state).endingStock
    const repairAfter =
      calculateRepairForecast(scheduled).endingStock
    const foodDelta = {
      low: foodAfter.low - foodBefore.low,
      high: foodAfter.high - foodBefore.high,
    }
    const repairDelta = {
      low: repairAfter.low - repairBefore.low,
      high: repairAfter.high - repairBefore.high,
    }
    const validDelta =
      request.candidateId === 'allocate-repair-buffer'
        ? foodDelta.low === 0 &&
          foodDelta.high === 0 &&
          repairDelta.low === 1 &&
          repairDelta.high === 1
        : repairDelta.low === 0 &&
          repairDelta.high === 0 &&
          foodDelta.low === 1 &&
          foodDelta.high === 1
    if (!validDelta) {
      return failure(state, 'CANONICAL_DELTA_MISMATCH')
    }
  }
  const consequences = consequencesFor(
    state,
    scheduled,
    request,
    opportunity,
    committedAtSequence,
  )
  const fingerprints = consequences.map(
    (item) => item.effectFingerprint,
  )
  if (
    fingerprints.some((fingerprint) => {
      const owner =
        state.managementChoices.effectOwnership[fingerprint]
      return (
        owner !== undefined &&
        owner !== opportunity.decisionIntentId
      )
    })
  ) {
    return failure(state, 'EFFECT_ALREADY_OWNED')
  }
  const preventive =
    request.choiceSetId ===
    PREVENTIVE_CAPACITY_CHOICE_SET_ID
  const terminalOpportunity: ManagementChoiceOpportunity = {
    ...opportunity,
    stateRevision: request.stateRevision + 1,
    projectionBaseHash: request.projectionBaseHash,
    candidateProjectionHash:
      request.candidateProjectionHash,
    idempotencyKey: request.idempotencyKey,
    commitCause: 'opportunity-created',
    effectFingerprints: fingerprints,
    terminalState: request.candidateId,
    committedAtSequence,
  }
  const commitment: ManagementChoiceCommitment = {
    opportunityId: opportunity.opportunityId,
    decisionIntentId: opportunity.decisionIntentId,
    choiceSetId: opportunity.choiceSetId,
    candidateId: request.candidateId,
    objectRef: opportunity.objectRef,
    week: opportunity.week,
    diagnosisId: opportunity.diagnosisId,
    sessionId: opportunity.sessionId,
    candidateBuildAuthorityHash:
      opportunity.candidateBuildAuthorityHash,
    sessionAuthorityToken:
      opportunity.sessionAuthorityToken,
    stateRevision: request.stateRevision,
    projectionBaseHash: request.projectionBaseHash,
    candidateProjectionHash:
      request.candidateProjectionHash,
    idempotencyKey: request.idempotencyKey,
    commitCause: 'explicit-candidate-action',
    resourceClaimRef: opportunity.resourceClaimRef,
    requiredConsequenceIds: requiredConsequenceIds(
      request.candidateId,
    ),
    effectFingerprints: fingerprints,
    terminalState: request.candidateId,
    committedAtSequence,
    consequences,
  }
  const next: SimulationState = {
    ...scheduled,
    managementChoices: {
      ...scheduled.managementChoices,
      opportunities: {
        ...scheduled.managementChoices.opportunities,
        [opportunityKey(request.choiceSetId)]:
          terminalOpportunity,
      },
      commitments: [
        ...scheduled.managementChoices.commitments,
        commitment,
      ],
      effectOwnership: {
        ...scheduled.managementChoices.effectOwnership,
        ...Object.fromEntries(
          fingerprints.map((fingerprint) => [
            fingerprint,
            opportunity.decisionIntentId,
          ]),
        ),
      },
      equipmentExposure: preventive
        ? request.candidateId ===
          'schedule-preventive-maintenance'
          ? 'low'
          : 'high'
        : scheduled.managementChoices.equipmentExposure,
      equipmentRecoveryLoad: preventive
        ? request.candidateId ===
          'schedule-preventive-maintenance'
          ? 1
          : 2
        : scheduled.managementChoices.equipmentRecoveryLoad,
      preventiveCapacityAllocation: preventive
        ? request.candidateId ===
          'schedule-preventive-maintenance'
          ? 'maintenance'
          : 'rest'
        : scheduled.managementChoices
            .preventiveCapacityAllocation,
      linHeRecoveryUnits: preventive
        ? request.candidateId === 'retain-rest-capacity'
          ? 1
          : 0
        : scheduled.managementChoices.linHeRecoveryUnits,
      personnelReadiness: preventive
        ? scheduled.managementChoices.personnelReadiness +
          (request.candidateId === 'retain-rest-capacity'
            ? 1
            : 0)
        : scheduled.managementChoices.personnelReadiness,
    },
    stateRevision: state.stateRevision + 1,
  }
  return { ok: true, state: next, commitment }
}

function wasDirectlyEdited(
  state: SimulationState,
  blockId: string,
) {
  return state.actionLog.some(
    (envelope) =>
      envelope.action.type !==
        'COMMIT_MANAGEMENT_CHOICE' &&
      envelope.affectedBlockIds.includes(blockId),
  )
}

function freezeOpportunity(
  state: SimulationState,
  choiceSetId: ManagementChoiceSetId,
): SimulationState {
  const opportunity = opportunityFor(state, choiceSetId)
  if (
    opportunity === null ||
    opportunity.terminalState !== 'open'
  ) {
    return state
  }
  const blockId =
    choiceSetId === PREVENTIVE_CAPACITY_CHOICE_SET_ID
      ? PUMP_MAINTENANCE_BLOCK_ID
      : RECOVERY_ALLOCATION_BLOCK_ID
  const terminalState: ManagementTerminalState =
    wasDirectlyEdited(state, blockId)
      ? 'unqualified-direct-edit'
      : 'omitted'
  return {
    ...state,
    managementChoices: {
      ...state.managementChoices,
      opportunities: {
        ...state.managementChoices.opportunities,
        [opportunityKey(choiceSetId)]: {
          ...opportunity,
          stateRevision: state.stateRevision,
          terminalState,
        },
      },
      ...(choiceSetId ===
      PREVENTIVE_CAPACITY_CHOICE_SET_ID
        ? {
            equipmentExposure:
              hasPreventiveMaintenance(state)
                ? ('low' as const)
                : ('high' as const),
            equipmentRecoveryLoad:
              hasPreventiveMaintenance(state)
                ? (1 as const)
                : (2 as const),
          }
        : {}),
    },
  }
}

export function freezePreventiveCapacityOpportunity(
  state: SimulationState,
) {
  return freezeOpportunity(
    state,
    PREVENTIVE_CAPACITY_CHOICE_SET_ID,
  )
}

export function openRecoveryAllocationOpportunity(
  state: SimulationState,
): SimulationState {
  const frozen = freezePreventiveCapacityOpportunity(state)
  const authority = frozen.managementChoices.authority
  if (
    authority === null ||
    frozen.managementChoices.opportunities
      .recoveryAllocation !== null
  ) {
    return frozen
  }
  const recoveryAllocation = createOpportunity(
    frozen,
    authority,
    RECOVERY_ALLOCATION_CHOICE_SET_ID,
    frozen.stateRevision + 1,
  )
  return {
    ...frozen,
    managementChoices: {
      ...frozen.managementChoices,
      opportunities: {
        ...frozen.managementChoices.opportunities,
        recoveryAllocation,
      },
    },
  }
}

export function freezeRecoveryAllocationOpportunity(
  state: SimulationState,
) {
  return freezeOpportunity(
    state,
    RECOVERY_ALLOCATION_CHOICE_SET_ID,
  )
}

export function synchronizeManagementScheduleState(
  state: SimulationState,
): SimulationState {
  let synchronized = state
  const preventive =
    synchronized.managementChoices.opportunities.preventiveCapacity
  if (
    preventive?.terminalState === 'open' &&
    wasDirectlyEdited(
      synchronized,
      PUMP_MAINTENANCE_BLOCK_ID,
    )
  ) {
    synchronized = freezeOpportunity(
      synchronized,
      PREVENTIVE_CAPACITY_CHOICE_SET_ID,
    )
  }
  const recovery =
    synchronized.managementChoices.opportunities.recoveryAllocation
  if (
    recovery?.terminalState === 'open' &&
    wasDirectlyEdited(
      synchronized,
      RECOVERY_ALLOCATION_BLOCK_ID,
    )
  ) {
    synchronized = freezeOpportunity(
      synchronized,
      RECOVERY_ALLOCATION_CHOICE_SET_ID,
    )
  }
  const terminalPreventive =
    synchronized.managementChoices.opportunities.preventiveCapacity
  if (
    terminalPreventive?.terminalState ===
      'schedule-preventive-maintenance' ||
    terminalPreventive?.terminalState ===
      'retain-rest-capacity'
  ) {
    return synchronized
  }
  const protectedPump = hasPreventiveMaintenance(synchronized)
  return {
    ...synchronized,
    managementChoices: {
      ...synchronized.managementChoices,
      equipmentExposure: protectedPump ? 'low' : 'high',
      equipmentRecoveryLoad: protectedPump ? 1 : 2,
    },
  }
}

export function isManagementScheduleBlockLocked(
  state: SimulationState,
  blockId: string,
) {
  return state.managementChoices.commitments.some(
    (commitment) =>
      (commitment.choiceSetId ===
        PREVENTIVE_CAPACITY_CHOICE_SET_ID &&
        blockId === PUMP_MAINTENANCE_BLOCK_ID) ||
      (commitment.choiceSetId ===
        RECOVERY_ALLOCATION_CHOICE_SET_ID &&
        blockId === RECOVERY_ALLOCATION_BLOCK_ID),
  )
}

export function managementCommitmentCount(
  state: SimulationState,
  week: 0 | 1,
) {
  return new Set(
    state.managementChoices.commitments
      .filter(
        (commitment) =>
          commitment.week === week &&
          commitment.commitCause ===
            'explicit-candidate-action',
      )
      .map(
        (commitment) =>
          `${commitment.diagnosisId}:${commitment.week}:${commitment.decisionIntentId}`,
      ),
  ).size
}

export function infrastructurePressure(
  endingRepair: number,
  equipmentRecoveryLoad: 0 | 1 | 2,
) {
  return (
    Math.max(0, 5 - endingRepair) +
    equipmentRecoveryLoad
  )
}
