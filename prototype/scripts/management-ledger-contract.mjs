import { createHash } from 'node:crypto'

export const SESSION_AUTHORITY_TOKEN_PATTERN = /^[a-f0-9]{64}$/

const HASH_PATTERN = /^[a-f0-9]{64}$/
const EFFECT_PATTERN = /^effect:[a-f0-9]{64}$/
const TERMINAL_WITHOUT_COMMITMENT = new Set([
  'open',
  'omitted',
  'unqualified-direct-edit',
])
const SETTLED_CONSEQUENCE_BY_CANDIDATE = Object.freeze({
  'schedule-preventive-maintenance':
    'consequence:w0:preventive-capacity:recovery-load',
  'retain-rest-capacity':
    'consequence:w0:preventive-capacity:personnel-readiness',
  'allocate-repair-buffer':
    'consequence:w1:recovery-allocation:ending-repair',
  'allocate-food-production':
    'consequence:w1:recovery-allocation:ending-food',
})
const SETTLED_AT_TICK_BY_WEEK = [1002, 2010]

export const C03_CANONICAL_CHOICE_CONTRACT = Object.freeze({
  'choice:w0:preventive-capacity': {
    week: 0,
    decisionIntentId: 'w0:preventive-capacity:pump',
    objectRef: 'water-pump',
    resourceClaimRef: 'schedule-slot:lin-he:d1:b1',
    scheduleSlot: 'lin-he:d1:b1',
    candidates: {
      'schedule-preventive-maintenance': [
        {
          consequenceId:
            'consequence:w0:preventive-capacity:schedule',
          objectRef: 'lin-he:d1:b1',
          beforeValue: 'rest',
          afterValue: 'repair',
        },
        {
          consequenceId:
            'consequence:w0:preventive-capacity:equipment-exposure',
          objectRef: 'water-pump:equipment-exposure',
          beforeValue: 'high',
          afterValue: 'low',
        },
        {
          consequenceId:
            'consequence:w0:preventive-capacity:recovery-load',
          objectRef: 'water-pump:equipment-recovery-load',
          beforeValue: 2,
          afterValue: 1,
        },
      ],
      'retain-rest-capacity': [
        {
          consequenceId:
            'consequence:w0:preventive-capacity:allocation',
          objectRef: 'water-pump:preventive-capacity-allocation',
          beforeValue: 'unallocated',
          afterValue: 'rest',
        },
        {
          consequenceId:
            'consequence:w0:preventive-capacity:rest-recovery',
          objectRef: 'lin-he:recovery-units',
          beforeValue: 0,
          afterValue: 1,
        },
        {
          consequenceId:
            'consequence:w0:preventive-capacity:personnel-readiness',
          objectRef: 'settlement:personnel-readiness',
          beforeValue: 0,
          afterValue: 1,
        },
      ],
    },
  },
  'choice:w1:recovery-allocation': {
    week: 1,
    decisionIntentId:
      'w1:recovery-allocation:pump-vs-food',
    objectRef: 'pump-recovery',
    resourceClaimRef: 'schedule-slot:chen-du:d10:b2',
    scheduleSlot: 'chen-du:d10:b2',
    candidates: {
      'allocate-repair-buffer': [
        {
          consequenceId:
            'consequence:w1:recovery-allocation:schedule',
          objectRef: 'chen-du:d10:b2',
          beforeValue: 'rest',
          afterValue: 'repair',
        },
        {
          consequenceId:
            'consequence:w1:recovery-allocation:ending-repair',
          objectRef: 'forecast:ending-repair',
          numericDelta: 1,
        },
      ],
      'allocate-food-production': [
        {
          consequenceId:
            'consequence:w1:recovery-allocation:schedule',
          objectRef: 'chen-du:d10:b2',
          beforeValue: 'rest',
          afterValue: 'food',
        },
        {
          consequenceId:
            'consequence:w1:recovery-allocation:ending-food',
          objectRef: 'forecast:ending-food',
          numericDelta: 1,
        },
      ],
    },
  },
})

function isRecord(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
      )
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256Canonical(value) {
  return createHash('sha256')
    .update(canonicalJson(value))
    .digest('hex')
}

function authorityTuple(value) {
  return {
    diagnosisId: value.diagnosisId,
    sessionId: value.sessionId,
    candidateBuildAuthorityHash:
      value.candidateBuildAuthorityHash,
    sessionAuthorityToken: value.sessionAuthorityToken,
  }
}

function sameAuthority(value, expected) {
  return (
    isRecord(value) &&
    value.diagnosisId === expected.diagnosisId &&
    value.sessionId === expected.sessionId &&
    value.candidateBuildAuthorityHash ===
      expected.candidateBuildAuthorityHash &&
    value.sessionAuthorityToken ===
      expected.sessionAuthorityToken
  )
}

function allConsequenceIds(contract) {
  return Object.values(contract.candidates).flatMap((entries) =>
    entries.map(({ consequenceId }) => consequenceId),
  )
}

function requiredConsequenceIds(contract, candidateId) {
  return contract.candidates[candidateId]?.map(
    ({ consequenceId }) => consequenceId,
  )
}

function isCanonicalTuple(consequence, template) {
  if (
    consequence.consequenceId !== template.consequenceId ||
    consequence.objectRef !== template.objectRef
  ) {
    return false
  }
  if ('numericDelta' in template) {
    return (
      Number.isFinite(consequence.beforeValue) &&
      Number.isFinite(consequence.afterValue) &&
      consequence.afterValue - consequence.beforeValue ===
        template.numericDelta
    )
  }
  return (
    consequence.beforeValue === template.beforeValue &&
    consequence.afterValue === template.afterValue
  )
}

export function canonicalEffectFingerprint(
  commitment,
  consequence,
) {
  const contract =
    C03_CANONICAL_CHOICE_CONTRACT[commitment.choiceSetId]
  if (contract === undefined) return null
  return `effect:${sha256Canonical({
    authorityTuple: authorityTuple(commitment),
    decisionIntentId: commitment.decisionIntentId,
    choiceSetId: commitment.choiceSetId,
    candidateId: commitment.candidateId,
    consequenceId: consequence.consequenceId,
    objectRef: consequence.objectRef,
    resourceLotId: commitment.resourceClaimRef,
    stateRevisionBefore: commitment.stateRevision,
    stateRevisionAfter: commitment.stateRevision + 1,
    scheduleSlot: contract.scheduleSlot,
    beforeValue: consequence.beforeValue,
    afterValue: consequence.afterValue,
  })}`
}

function reject(code) {
  return { ok: false, code }
}

function validateFinalState(
  input,
  opportunitiesByChoiceSet,
  commitmentsByChoiceSet,
) {
  const finalState = input.finalState
  if (!isRecord(finalState)) return 'V03_FINAL_STATE_MISMATCH'
  const w1 =
    opportunitiesByChoiceSet.get(
      'choice:w0:preventive-capacity',
    )
  const w2 =
    opportunitiesByChoiceSet.get(
      'choice:w1:recovery-allocation',
    )
  const completedWeekCount = finalState.completedWeekCount
  if (
    !Number.isInteger(completedWeekCount) ||
    completedWeekCount < 0 ||
    completedWeekCount > 2 ||
    !['rest', 'repair', 'food', 'logistics', 'study', 'social'].includes(
      finalState.preventiveCapacityActivity,
    ) ||
    !['rest', 'repair', 'food', 'logistics', 'study', 'social'].includes(
      finalState.recoveryAllocationActivity,
    ) ||
    !isRecord(finalState.endingFood) ||
    !Number.isFinite(finalState.endingFood.low) ||
    !Number.isFinite(finalState.endingFood.high) ||
    !isRecord(finalState.endingRepair) ||
    !Number.isFinite(finalState.endingRepair.low) ||
    !Number.isFinite(finalState.endingRepair.high) ||
    !Number.isInteger(finalState.infrastructurePressure)
  ) {
    return 'V03_FINAL_STATE_MISMATCH'
  }

  let expectedExposure = 'high'
  let expectedLoad = 2
  let expectedAllocation = 'unallocated'
  let expectedRecovery = 0
  let expectedReadiness = 0
  if (
    completedWeekCount > 0 &&
    finalState.preventiveCapacityActivity !== 'rest'
  ) {
    return 'V03_FINAL_STATE_MISMATCH'
  }
  if (w1?.terminalState === 'schedule-preventive-maintenance') {
    expectedExposure = 'low'
    expectedLoad = 1
    expectedAllocation = 'maintenance'
    if (
      finalState.preventiveCapacityActivity !==
      (completedWeekCount > 0 ? 'rest' : 'repair')
    ) {
      return 'V03_FINAL_STATE_MISMATCH'
    }
  } else if (w1?.terminalState === 'retain-rest-capacity') {
    expectedAllocation = 'rest'
    expectedRecovery = 1
    expectedReadiness = 1
    if (finalState.preventiveCapacityActivity !== 'rest') {
      return 'V03_FINAL_STATE_MISMATCH'
    }
  } else if (w1?.terminalState === 'omitted') {
    if (finalState.preventiveCapacityActivity !== 'rest') {
      return 'V03_FINAL_STATE_MISMATCH'
    }
  } else if (
    w1?.terminalState === 'unqualified-direct-edit' &&
    finalState.preventiveCapacityActivity === 'repair'
  ) {
    expectedExposure = 'low'
    expectedLoad = 1
  }
  if (
    finalState.equipmentExposure !== expectedExposure ||
    finalState.equipmentRecoveryLoad !== expectedLoad ||
    finalState.preventiveCapacityAllocation !==
      expectedAllocation ||
    finalState.linHeRecoveryUnits !== expectedRecovery ||
    finalState.personnelReadiness !== expectedReadiness ||
    finalState.infrastructurePressure !==
      Math.max(0, 5 - finalState.endingRepair.high) +
        expectedLoad
  ) {
    return 'V03_FINAL_STATE_MISMATCH'
  }

  if (
    completedWeekCount > 1 &&
    finalState.recoveryAllocationActivity !== 'rest'
  ) {
    return 'V03_FINAL_STATE_MISMATCH'
  }
  if (w2?.terminalState === 'allocate-repair-buffer') {
    if (
      finalState.recoveryAllocationActivity !==
      (completedWeekCount > 1 ? 'rest' : 'repair')
    ) {
      return 'V03_FINAL_STATE_MISMATCH'
    }
    const economic = commitmentsByChoiceSet
      .get(w2.choiceSetId)
      ?.consequences.find(
        ({ objectRef }) =>
          objectRef === 'forecast:ending-repair',
      )
    if (
      completedWeekCount <= 1 &&
      economic?.afterValue !== finalState.endingRepair.high
    ) {
      return 'V03_FINAL_STATE_MISMATCH'
    }
  } else if (w2?.terminalState === 'allocate-food-production') {
    if (
      finalState.recoveryAllocationActivity !==
      (completedWeekCount > 1 ? 'rest' : 'food')
    ) {
      return 'V03_FINAL_STATE_MISMATCH'
    }
    const economic = commitmentsByChoiceSet
      .get(w2.choiceSetId)
      ?.consequences.find(
        ({ objectRef }) =>
          objectRef === 'forecast:ending-food',
      )
    if (
      completedWeekCount <= 1 &&
      economic?.afterValue !== finalState.endingFood.high
    ) {
      return 'V03_FINAL_STATE_MISMATCH'
    }
  } else if (
    w2?.terminalState === 'omitted' &&
    finalState.recoveryAllocationActivity !== 'rest'
  ) {
    return 'V03_FINAL_STATE_MISMATCH'
  }
  return null
}

function validateSettledOutcomes(
  input,
  commitmentsByChoiceSet,
  authority,
  actionById,
  actionBySequence,
) {
  const completedWeekCount = input.finalState.completedWeekCount
  const expectedCommitments = [
    ...commitmentsByChoiceSet.values(),
  ].filter(({ week }) => week < completedWeekCount)
  if (
    input.settledManagementOutcomesV03.length !==
    expectedCommitments.length
  ) {
    return {
      error: 'V03_SETTLED_OUTCOME_MISMATCH',
      outcomesByChoiceSet: new Map(),
    }
  }
  const outcomesByChoiceSet = new Map()
  for (const outcome of input.settledManagementOutcomesV03) {
    if (!isRecord(outcome)) {
      return {
        error: 'V03_SETTLED_OUTCOME_MISMATCH',
        outcomesByChoiceSet: new Map(),
      }
    }
    const commitment = commitmentsByChoiceSet.get(
      outcome.choiceSetId,
    )
    const expectedConsequenceId =
      SETTLED_CONSEQUENCE_BY_CANDIDATE[
        commitment?.candidateId
      ]
    const consequence = commitment?.consequences.find(
      (item) =>
        item.consequenceId === expectedConsequenceId,
    )
    const actionFromId = actionById.get(outcome.actionId)
    const actionFromSequence = actionBySequence.get(
      outcome.actionSequence,
    )
    const action =
      actionFromId === actionFromSequence
        ? actionFromId
        : undefined
    if (
      commitment === undefined ||
      commitment.week >= completedWeekCount ||
      consequence === undefined ||
      action === undefined ||
      action.type !== 'COMMIT_MANAGEMENT_CHOICE' ||
      outcomesByChoiceSet.has(outcome.choiceSetId) ||
      outcome.decisionIntentId !==
        commitment.decisionIntentId ||
      outcome.candidateId !== commitment.candidateId ||
      outcome.consequenceId !== consequence.consequenceId ||
      outcome.effectFingerprint !==
        consequence.effectFingerprint ||
      outcome.beforeValue !== consequence.beforeValue ||
      outcome.afterValue !== consequence.afterValue ||
      !Number.isFinite(outcome.beforeValue) ||
      !Number.isFinite(outcome.afterValue) ||
      outcome.delta !==
        outcome.afterValue - outcome.beforeValue ||
      outcome.delta === 0 ||
      outcome.settledWeek !== commitment.week ||
      outcome.settledAtTick !==
        SETTLED_AT_TICK_BY_WEEK[commitment.week] ||
      !sameAuthority(outcome, authority) ||
      !sameAuthority(action, authority) ||
      outcome.actionId !== commitment.actionId ||
      outcome.actionId !== action.id ||
      outcome.actionSequence !== action.sequence ||
      outcome.actionSequence !==
        commitment.committedAtSequence ||
      action.committedAtSequence !==
        commitment.committedAtSequence ||
      action.opportunityId !== commitment.opportunityId ||
      action.choiceSetId !== commitment.choiceSetId ||
      action.decisionIntentId !==
        commitment.decisionIntentId ||
      action.candidateId !== commitment.candidateId
    ) {
      return {
        error: 'V03_SETTLED_OUTCOME_MISMATCH',
        outcomesByChoiceSet: new Map(),
      }
    }
    outcomesByChoiceSet.set(
      outcome.choiceSetId,
      outcome,
    )
  }
  return { error: null, outcomesByChoiceSet }
}

function validateRecaps(
  input,
  opportunitiesByChoiceSet,
  settledOutcomesByChoiceSet,
) {
  if (!Array.isArray(input.recap)) {
    return 'V03_RECAP_MISMATCH'
  }
  const completedWeekCount = input.finalState.completedWeekCount
  for (const [choiceSetId, opportunity] of opportunitiesByChoiceSet) {
    if (opportunity.week >= completedWeekCount) continue
    const recap = input.recap.find(
      (entry) => entry?.weekIndex === opportunity.week,
    )
    const expectedItemId =
      `week-${opportunity.week + 1}-management-choice`
    if (
      !isRecord(recap) ||
      !Array.isArray(recap.itemIds) ||
      !Array.isArray(recap.sourceIds) ||
      !Array.isArray(recap.itemValues) ||
      recap.itemIds.length !== recap.sourceIds.length ||
      recap.itemValues.length !== recap.sourceIds.length ||
      recap.sourceIds.filter((value) => value === choiceSetId)
        .length !== 1
    ) {
      return 'V03_RECAP_MISMATCH'
    }
    const index = recap.sourceIds.indexOf(choiceSetId)
    if (recap.itemIds[index] !== expectedItemId) {
      return 'V03_RECAP_MISMATCH'
    }
    const settledOutcome =
      settledOutcomesByChoiceSet.get(choiceSetId)
    const itemValue = recap.itemValues[index]
    if (
      settledOutcome !== undefined &&
      (!isRecord(itemValue) ||
        itemValue.settledBeforeValue !==
          settledOutcome.beforeValue ||
        itemValue.settledAfterValue !==
          settledOutcome.afterValue ||
        itemValue.settledDelta !==
          settledOutcome.delta)
    ) {
      return 'V03_RECAP_MISMATCH'
    }
    if (
      settledOutcome === undefined &&
      isRecord(itemValue) &&
      Object.keys(itemValue).some((key) =>
        key.startsWith('settled'),
      )
    ) {
      return 'V03_RECAP_MISMATCH'
    }
  }
  return null
}

export function validateCanonicalManagementLedger(input) {
  if (
    !isRecord(input) ||
    input.schemaVersion !== 'gate1-playtest-v2' ||
    input.protocolVersion !==
      'weekly-management-slice-playtest-v0.3' ||
    input.scenarioVersion !== '0.5.1' ||
    !isRecord(input.meta) ||
    !Array.isArray(input.actions) ||
    !input.actions.every(isRecord) ||
    !Array.isArray(input.managementChoiceOpportunitiesV03) ||
    !Array.isArray(input.managementChoiceCommitmentsV03) ||
    !Array.isArray(input.settledManagementOutcomesV03) ||
    !isRecord(input.effectOwnershipV03)
  ) {
    return reject('V03_LEDGER_SHAPE')
  }
  const authority = authorityTuple(input.meta)
  if (
    typeof authority.diagnosisId !== 'string' ||
    typeof authority.sessionId !== 'string' ||
    !HASH_PATTERN.test(
      authority.candidateBuildAuthorityHash ?? '',
    ) ||
    !SESSION_AUTHORITY_TOKEN_PATTERN.test(
      authority.sessionAuthorityToken ?? '',
    )
  ) {
    return reject('V03_AUTHORITY_MISMATCH')
  }
  const actionById = new Map()
  const actionBySequence = new Map()
  const committedAtSequences = new Set()
  for (const action of input.actions) {
    if (
      typeof action.id !== 'string' ||
      action.id.trim().length === 0 ||
      actionById.has(action.id)
    ) {
      return reject('V03_ACTION_MISMATCH')
    }
    actionById.set(action.id, action)
    if (action.sequence !== undefined) {
      if (
        !Number.isInteger(action.sequence) ||
        actionBySequence.has(action.sequence)
      ) {
        return reject('V03_ACTION_MISMATCH')
      }
      actionBySequence.set(action.sequence, action)
    }
    if (action.type !== 'COMMIT_MANAGEMENT_CHOICE') continue
    if (
      !Number.isInteger(action.committedAtSequence) ||
      action.sequence !== action.committedAtSequence ||
      committedAtSequences.has(action.committedAtSequence)
    ) {
      return reject('V03_ACTION_MISMATCH')
    }
    committedAtSequences.add(action.committedAtSequence)
  }

  const complete = input.captureKind === 'complete'
  if (
    input.managementChoiceOpportunitiesV03.length < 1 ||
    input.managementChoiceOpportunitiesV03.length > 2
  ) {
    return reject('V03_LEDGER_SHAPE')
  }
  const opportunitiesById = new Map()
  const opportunitiesByChoiceSet = new Map()
  for (const opportunity of input.managementChoiceOpportunitiesV03) {
    const contract =
      C03_CANONICAL_CHOICE_CONTRACT[opportunity?.choiceSetId]
    if (
      !isRecord(opportunity) ||
      contract === undefined ||
      typeof opportunity.opportunityId !== 'string' ||
      opportunitiesById.has(opportunity.opportunityId) ||
      opportunitiesByChoiceSet.has(opportunity.choiceSetId) ||
      opportunity.candidateId !== null ||
      opportunity.decisionIntentId !==
        contract.decisionIntentId ||
      opportunity.week !== contract.week ||
      opportunity.objectRef !== contract.objectRef ||
      opportunity.resourceClaimRef !==
        contract.resourceClaimRef ||
      opportunity.commitCause !== 'opportunity-created' ||
      !Number.isInteger(opportunity.stateRevision) ||
      !HASH_PATTERN.test(opportunity.projectionBaseHash ?? '') ||
      !Array.isArray(opportunity.requiredConsequenceIds) ||
      !sameJson(
        opportunity.requiredConsequenceIds,
        allConsequenceIds(contract),
      ) ||
      !Array.isArray(opportunity.effectFingerprints) ||
      !sameAuthority(opportunity, authority)
    ) {
      return reject('V03_CANONICAL_CONTRACT')
    }
    const candidateIds = Object.keys(contract.candidates)
    if (
      !TERMINAL_WITHOUT_COMMITMENT.has(
        opportunity.terminalState,
      ) &&
      !candidateIds.includes(opportunity.terminalState)
    ) {
      return reject('V03_TERMINAL_MISMATCH')
    }
    opportunitiesById.set(
      opportunity.opportunityId,
      opportunity,
    )
    opportunitiesByChoiceSet.set(
      opportunity.choiceSetId,
      opportunity,
    )
  }
  if (
    complete &&
    (opportunitiesByChoiceSet.size !== 2 ||
      [...opportunitiesByChoiceSet.values()].some(
        ({ terminalState }) => terminalState === 'open',
      ))
  ) {
    return reject('V03_COMPLETE_TERMINALS')
  }

  const ownedFingerprints = new Map()
  const commitmentsByChoiceSet = new Map()
  for (const commitment of input.managementChoiceCommitmentsV03) {
    const opportunity = opportunitiesById.get(
      commitment?.opportunityId,
    )
    const contract =
      C03_CANONICAL_CHOICE_CONTRACT[commitment?.choiceSetId]
    const templates =
      contract?.candidates[commitment?.candidateId]
    if (
      !isRecord(commitment) ||
      opportunity === undefined ||
      contract === undefined ||
      templates === undefined ||
      commitmentsByChoiceSet.has(commitment.choiceSetId) ||
      commitment.choiceSetId !== opportunity.choiceSetId ||
      commitment.decisionIntentId !==
        contract.decisionIntentId ||
      commitment.week !== contract.week ||
      commitment.week !== opportunity.week ||
      commitment.objectRef !== contract.objectRef ||
      commitment.resourceClaimRef !==
        contract.resourceClaimRef ||
      commitment.commitCause !==
        'explicit-candidate-action' ||
      typeof commitment.actionId !== 'string' ||
      commitment.actionId.trim().length === 0 ||
      commitment.terminalState !== commitment.candidateId ||
      opportunity.terminalState !== commitment.candidateId ||
      !sameAuthority(commitment, authority) ||
      !Number.isInteger(commitment.stateRevision) ||
      opportunity.stateRevision !==
        commitment.stateRevision + 1 ||
      !HASH_PATTERN.test(commitment.projectionBaseHash ?? '') ||
      !HASH_PATTERN.test(
        commitment.candidateProjectionHash ?? '',
      ) ||
      typeof commitment.idempotencyKey !== 'string' ||
      commitment.idempotencyKey.length === 0 ||
      !Number.isInteger(commitment.committedAtSequence) ||
      !Array.isArray(commitment.requiredConsequenceIds) ||
      !sameJson(
        commitment.requiredConsequenceIds,
        requiredConsequenceIds(
          contract,
          commitment.candidateId,
        ),
      ) ||
      !Array.isArray(commitment.effectFingerprints) ||
      !Array.isArray(commitment.consequences) ||
      commitment.consequences.length !== templates.length
    ) {
      return reject('V03_CANONICAL_CONTRACT')
    }
    const actionFromId = actionById.get(commitment.actionId)
    const actionFromSequence = actionBySequence.get(
      commitment.committedAtSequence,
    )
    if (
      actionFromId === undefined ||
      actionFromId !== actionFromSequence ||
      actionFromId.type !== 'COMMIT_MANAGEMENT_CHOICE' ||
      !sameAuthority(actionFromId, authority)
    ) {
      return reject('V03_ACTION_MISMATCH')
    }
    const action = actionFromId
    if (
      action.id !== commitment.actionId ||
      action.opportunityId !== commitment.opportunityId ||
      action.choiceSetId !== commitment.choiceSetId ||
      action.candidateId !== commitment.candidateId ||
      action.decisionIntentId !==
        commitment.decisionIntentId ||
      action.week !== commitment.week ||
      action.resourceClaimRef !==
        commitment.resourceClaimRef ||
      action.stateRevision !== commitment.stateRevision ||
      action.projectionBaseHash !==
        commitment.projectionBaseHash ||
      action.candidateProjectionHash !==
        commitment.candidateProjectionHash ||
      action.idempotencyKey !== commitment.idempotencyKey ||
      action.commitCause !== commitment.commitCause ||
      action.terminalState !== commitment.terminalState ||
      action.committedAtSequence !==
        commitment.committedAtSequence ||
      action.sequence !== commitment.committedAtSequence ||
      !sameJson(
        action.requiredConsequenceIds,
        commitment.requiredConsequenceIds,
      )
    ) {
      return reject('V03_ACTION_MISMATCH')
    }

    const fingerprints = []
    for (const [index, consequence] of
      commitment.consequences.entries()) {
      const template = templates[index]
      if (
        !isRecord(consequence) ||
        !isCanonicalTuple(consequence, template) ||
        consequence.opportunityId !==
          commitment.opportunityId ||
        consequence.decisionIntentId !==
          commitment.decisionIntentId ||
        consequence.choiceSetId !== commitment.choiceSetId ||
        consequence.candidateId !== commitment.candidateId ||
        consequence.week !== commitment.week ||
        consequence.commitCause !== commitment.commitCause ||
        consequence.resourceClaimRef !==
          commitment.resourceClaimRef ||
        consequence.stateRevision !==
          commitment.stateRevision ||
        consequence.projectionBaseHash !==
          commitment.projectionBaseHash ||
        consequence.candidateProjectionHash !==
          commitment.candidateProjectionHash ||
        consequence.idempotencyKey !==
          commitment.idempotencyKey ||
        consequence.terminalState !==
          commitment.terminalState ||
        consequence.committedAtSequence !==
          commitment.committedAtSequence ||
        !sameAuthority(consequence, authority) ||
        consequence.beforeValue === consequence.afterValue ||
        !EFFECT_PATTERN.test(
          consequence.effectFingerprint ?? '',
        ) ||
        consequence.effectFingerprint !==
          canonicalEffectFingerprint(commitment, consequence) ||
        !sameJson(
          consequence.requiredConsequenceIds,
          commitment.requiredConsequenceIds,
        ) ||
        !sameJson(consequence.effectFingerprints, [
          consequence.effectFingerprint,
        ])
      ) {
        return reject('V03_EFFECT_FINGERPRINT')
      }
      if (
        ownedFingerprints.has(consequence.effectFingerprint)
      ) {
        return reject('V03_EFFECT_DOUBLE_OWNER')
      }
      fingerprints.push(consequence.effectFingerprint)
      ownedFingerprints.set(
        consequence.effectFingerprint,
        commitment.decisionIntentId,
      )
    }
    if (
      !sameJson(commitment.effectFingerprints, fingerprints) ||
      !sameJson(opportunity.effectFingerprints, fingerprints)
    ) {
      return reject('V03_REQUIRED_CONSEQUENCE_MISMATCH')
    }
    commitmentsByChoiceSet.set(
      commitment.choiceSetId,
      commitment,
    )
  }

  const committedOpportunities = [
    ...opportunitiesByChoiceSet.values(),
  ].filter(
    ({ terminalState }) =>
      !TERMINAL_WITHOUT_COMMITMENT.has(terminalState),
  )
  if (
    committedOpportunities.length !==
      commitmentsByChoiceSet.size ||
    input.actions.filter(
      ({ type }) => type === 'COMMIT_MANAGEMENT_CHOICE',
    ).length !== commitmentsByChoiceSet.size
  ) {
    return reject('V03_TERMINAL_MISMATCH')
  }
  if (
    Object.keys(input.effectOwnershipV03).length !==
    ownedFingerprints.size
  ) {
    return reject('V03_EFFECT_OWNER_MISMATCH')
  }
  for (const [fingerprint, owner] of ownedFingerprints) {
    if (input.effectOwnershipV03[fingerprint] !== owner) {
      return reject('V03_EFFECT_OWNER_MISMATCH')
    }
  }

  if (!isRecord(input.summary)) {
    return reject('V03_SUMMARY_MISMATCH')
  }
  const expectedSummary = {
    week1C03TerminalCommitmentCount: [
      ...commitmentsByChoiceSet.values(),
    ].filter(({ week }) => week === 0).length,
    week2C03TerminalCommitmentCount: [
      ...commitmentsByChoiceSet.values(),
    ].filter(({ week }) => week === 1).length,
  }
  if (
    input.summary.week1C03TerminalCommitmentCount !==
      expectedSummary.week1C03TerminalCommitmentCount ||
    input.summary.week2C03TerminalCommitmentCount !==
      expectedSummary.week2C03TerminalCommitmentCount
  ) {
    return reject('V03_SUMMARY_MISMATCH')
  }
  const finalStateError = validateFinalState(
    input,
    opportunitiesByChoiceSet,
    commitmentsByChoiceSet,
  )
  if (finalStateError !== null) return reject(finalStateError)
  const settledValidation = validateSettledOutcomes(
    input,
    commitmentsByChoiceSet,
    authority,
    actionById,
    actionBySequence,
  )
  if (settledValidation.error !== null) {
    return reject(settledValidation.error)
  }
  const recapError = validateRecaps(
    input,
    opportunitiesByChoiceSet,
    settledValidation.outcomesByChoiceSet,
  )
  if (recapError !== null) return reject(recapError)

  return {
    ok: true,
    code: null,
    protocolVersion: input.protocolVersion,
    terminalCommitmentCount: commitmentsByChoiceSet.size,
    ownedEffectCount: ownedFingerprints.size,
  }
}
