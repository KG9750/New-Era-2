import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const prototypeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixturesRoot = join(prototypeRoot, 'tests', 'fixtures')
const expectationsPath = join(fixturesRoot, 'fixture-expectations.json')
const HEX_64 = /^[a-f0-9]{64}$/
const GIT_SHA = /^[a-f0-9]{40}$/
const SAMPLE_ID_V1 = /^(?:A\d{2,}|P\d{2,}|M-[ABC])$/
const SAMPLE_ID_V2_AGENT = /^A(?:3[89]|[4-9]\d|[1-9]\d{2,})$/
const SAMPLE_ID_V2_TECH = /^TECH-RC9-[DP](?:0[1-9]|[1-9]\d+)$/
const CANDIDATE_ATTEMPT_ID = /^C(?:0[1-9]|[1-9]\d+)$/
const CANDIDATE_MANIFEST_ID = /^CM(?:0[1-9]|[1-9]\d+)$/

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function reject(errorCode, details = {}) {
  return { accepted: false, errorCode, summary: details }
}

function accept(summary = {}) {
  return { accepted: true, errorCode: null, summary }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isRc9SampleId(value) {
  return (
    SAMPLE_ID_V2_AGENT.test(value ?? '') ||
    SAMPLE_ID_V2_TECH.test(value ?? '')
  )
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (isRecord(value)) {
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

function sha256(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

const ALLOWED_DECISION_PROJECTION_FIELDS = new Set([
  'scheduleCells',
  'resolvedScheduleCells',
  'inventory',
  'fertilizer',
  'pump',
  'repairResponsibility',
  'responsibility',
  'repairDebt',
  'linHeRequest',
  'resolution',
  'resolutionSource',
  'transportRoute',
  'characterRecord',
  'foodShortfallAccepted',
])
const FORBIDDEN_DECISION_PROJECTION_FIELDS = new Set([
  'actionlog',
  'timeline',
  'uuid',
  'sequence',
  'wallclock',
  'monotonictime',
  'pause',
  'speed',
  'focus',
  'focustarget',
  'expanded',
  'telemetry',
  'capturemetadata',
  'forecast',
  'recap',
])
const ALLOWED_V2_ACTION_TYPES = new Set([
  'CHANGE_ACTIVITY',
  'EDIT_SCHEDULE',
  'COPY_DAY',
  'UNDO_SCHEDULE',
  'USE_FERTILIZER',
  'SET_FOOD_SHORTFALL_ACCEPTED',
  'RESOLVE_LIN_HE_REQUEST',
  'OPEN_TRANSPORT_SHORTCUT',
  'CONTINUE_TO_NEXT_WEEK',
  'SET_PAUSED',
  'UNDO',
  'REDO',
  'SELECT_REPAIR_RESPONSIBILITY',
  'ACCEPT_REPAIR_DEBT',
  'CONFIRM_ONLY_REACHABLE_SCHEDULE',
])
const INTENT_CONTRACTS = new Map([
  [
    'w0:food-plan',
    {
      weekIndex: 0,
      problemCategory: 'food',
      choiceSetId: 'choice:w0:food-plan',
      actionTypes: new Set([
        'CHANGE_ACTIVITY',
        'EDIT_SCHEDULE',
        'COPY_DAY',
        'UNDO_SCHEDULE',
        'SET_FOOD_SHORTFALL_ACCEPTED',
        'UNDO',
        'REDO',
      ]),
      optionContracts: new Map([
        [
          'food-shift-lin',
          {
            dominanceStatus: 'non-dominated',
            visibleConsequenceRefs: [
              'forecast:w0:food',
              'forecast:w0:repair',
              'schedule:lin-he:d1:b2',
            ],
            requiredAction: {
              type: 'EDIT_SCHEDULE',
              payload: {
                memberId: 'lin-he',
                dayIndex: 1,
                blockId: 'lin-he:d1:b2',
                fromActivity: 'baseline',
                toActivity: 'food',
              },
            },
            requiredConsequenceRefs: [
              'schedule:lin-he:d1:b2',
              'forecast:w0:food',
            ],
            projectionPredicate: 'food-schedule-changed',
            committable: true,
          },
        ],
        [
          'accept-food-gap',
          {
            dominanceStatus: 'non-dominated',
            visibleConsequenceRefs: [
              'forecast:w0:food',
              'forecast:w0:repair',
            ],
            requiredAction: {
              type: 'SET_FOOD_SHORTFALL_ACCEPTED',
              field: 'accepted',
              value: true,
            },
            requiredConsequenceRefs: [
              'forecast:w0:food',
              'forecast:w0:repair',
            ],
            projectionPredicate: 'food-shortfall-accepted',
            committable: true,
          },
        ],
      ]),
      projectionFields: new Set([
        'scheduleCells',
        'resolvedScheduleCells',
        'inventory',
        'foodShortfallAccepted',
      ]),
    },
  ],
  [
    'w0:repair-responsibility:pump-incident-day-3',
    {
      weekIndex: 0,
      problemCategory: 'repair',
      choiceSetId: 'choice:w0:pump-repair',
      actionTypes: new Set([
        'CHANGE_ACTIVITY',
        'EDIT_SCHEDULE',
        'COPY_DAY',
        'UNDO_SCHEDULE',
        'SELECT_REPAIR_RESPONSIBILITY',
        'ACCEPT_REPAIR_DEBT',
        'UNDO',
        'REDO',
      ]),
      optionContracts: new Map([
        [
          'schedule-repair',
          {
            dominanceStatus: 'non-dominated',
            visibleConsequenceRefs: [
              'forecast:w0:repair',
              'risk:pump',
              'schedule:qiao-pan:d3:b2',
            ],
            requiredAction: {
              type: 'EDIT_SCHEDULE',
              payload: {
                memberId: 'qiao-pan',
                dayIndex: 3,
                blockId: 'qiao-pan:d3:b2',
                fromActivity: 'baseline',
                toActivity: 'repair',
                responsibility: 'scheduled',
              },
            },
            requiredConsequenceRefs: [
              'schedule:qiao-pan:d3:b2',
              'risk:pump',
              'forecast:w0:repair',
            ],
            projectionPredicate: 'repair-schedule-changed',
            committable: true,
          },
        ],
        [
          'accept-debt',
          {
            dominanceStatus: 'non-dominated',
            visibleConsequenceRefs: [
              'recap:w0:repair',
              'risk:repair-debt',
            ],
            requiredAction: {
              type: 'ACCEPT_REPAIR_DEBT',
            },
            requiredConsequenceRefs: [
              'recap:w0:repair',
              'risk:repair-debt',
            ],
            projectionPredicate: 'repair-debt-accepted',
            committable: true,
          },
        ],
      ]),
      projectionFields: new Set([
        'scheduleCells',
        'resolvedScheduleCells',
        'inventory',
        'pump',
        'repairResponsibility',
        'responsibility',
        'repairDebt',
      ]),
    },
  ],
  [
    'w1:character-request:lin-he-study',
    {
      weekIndex: 1,
      problemCategory: 'character-request',
      choiceSetId: 'choice:w1:lin-he-study',
      actionTypes: new Set([
        'RESOLVE_LIN_HE_REQUEST',
        'UNDO',
        'REDO',
      ]),
      optionContracts: new Map([
        [
          'accept-study',
          {
            dominanceStatus: 'non-dominated',
            visibleConsequenceRefs: [
              'character-record:lin-he-study',
              'forecast:w1:food',
              'schedule:lin-he:d7:b2',
            ],
            requiredAction: {
              type: 'RESOLVE_LIN_HE_REQUEST',
              field: 'resolution',
              value: 'accepted',
              payload: {
                memberId: 'lin-he',
                dayIndex: 7,
                blockId: 'lin-he:d7:b2',
                fromActivity: 'food',
                toActivity: 'study',
              },
            },
            requiredConsequenceRefs: [
              'schedule:lin-he:d7:b2',
              'character-record:lin-he-study',
            ],
            projectionPredicate: 'lin-he-accepted',
            committable: true,
          },
        ],
        [
          'decline-study',
          {
            dominanceStatus: 'non-dominated',
            visibleConsequenceRefs: [
              'character-record:lin-he-study-declined',
              'forecast:w1:food',
            ],
            requiredAction: {
              type: 'RESOLVE_LIN_HE_REQUEST',
              field: 'resolution',
              value: 'declined',
            },
            requiredConsequenceRefs: [
              'character-record:lin-he-study-declined',
            ],
            projectionPredicate: 'lin-he-declined',
            committable: true,
          },
        ],
      ]),
      projectionFields: new Set([
        'scheduleCells',
        'resolvedScheduleCells',
        'linHeRequest',
        'resolution',
        'resolutionSource',
        'characterRecord',
      ]),
    },
  ],
  [
    'w1:transport-route',
    {
      weekIndex: 1,
      problemCategory: 'transport',
      choiceSetId: 'choice:w1:transport-route',
      actionTypes: new Set(['OPEN_TRANSPORT_SHORTCUT']),
      optionContracts: new Map([
        [
          'north-loop',
          {
            dominanceStatus: 'non-dominated',
            visibleConsequenceRefs: [
              'forecast:w1:food',
              'risk:w1:transport-loss',
            ],
            requiredAction: null,
            requiredConsequenceRefs: [
              'forecast:w1:food',
              'risk:w1:transport-loss',
            ],
            projectionPredicate: 'transport-default',
            committable: false,
          },
        ],
        [
          'south-shortcut',
          {
            dominanceStatus: 'non-dominated',
            visibleConsequenceRefs: [
              'forecast:w1:food',
              'risk:w1:transport-loss',
            ],
            requiredAction: {
              type: 'OPEN_TRANSPORT_SHORTCUT',
            },
            requiredConsequenceRefs: [
              'forecast:w1:food',
              'risk:w1:transport-loss',
            ],
            projectionPredicate: 'transport-shortcut-opened',
            committable: true,
          },
        ],
      ]),
      projectionFields: new Set(['inventory', 'transportRoute']),
    },
  ],
  [
    'w1:asset-use:fertilizer',
    {
      weekIndex: 1,
      problemCategory: 'asset-use',
      choiceSetId: 'choice:w1:fertilizer',
      actionTypes: new Set(['USE_FERTILIZER']),
      optionContracts: new Map([
        [
          'use-fertilizer',
          {
            dominanceStatus: 'non-dominated',
            visibleConsequenceRefs: [
              'forecast:w1:food',
              'inventory:fertilizer',
            ],
            requiredAction: {
              type: 'USE_FERTILIZER',
            },
            requiredConsequenceRefs: [
              'forecast:w1:food',
              'inventory:fertilizer',
            ],
            projectionPredicate: 'fertilizer-used',
            committable: true,
          },
        ],
        [
          'keep-fertilizer',
          {
            dominanceStatus: 'non-dominated',
            visibleConsequenceRefs: [
              'forecast:w1:food',
              'inventory:fertilizer',
            ],
            requiredAction: null,
            requiredConsequenceRefs: [
              'forecast:w1:food',
              'inventory:fertilizer',
            ],
            projectionPredicate: 'fertilizer-default',
            committable: false,
          },
        ],
      ]),
      projectionFields: new Set(['inventory', 'fertilizer']),
    },
  ],
])
const LEGACY_GROUP_CONTRACTS = new Map([
  [
    'legacy:w0:food-plan',
    new Set([
      'CHANGE_ACTIVITY',
      'EDIT_SCHEDULE',
      'COPY_DAY',
      'UNDO_SCHEDULE',
      'UNDO',
      'REDO',
    ]),
  ],
  [
    'legacy:w1:lin-he-study',
    new Set(['RESOLVE_LIN_HE_REQUEST', 'UNDO', 'REDO']),
  ],
  [
    'legacy:w1:transport-route',
    new Set(['OPEN_TRANSPORT_SHORTCUT']),
  ],
])

function containsForbiddenDecisionProjectionField(value) {
  if (Array.isArray(value)) {
    return value.some((item) =>
      containsForbiddenDecisionProjectionField(item),
    )
  }
  if (!isRecord(value)) return false
  return Object.entries(value).some(([key, nested]) => {
    const normalizedKey = key.toLowerCase().replaceAll(/[-_]/g, '')
    return (
      FORBIDDEN_DECISION_PROJECTION_FIELDS.has(normalizedKey) ||
      containsForbiddenDecisionProjectionField(nested)
    )
  })
}

function isDecisionProjection(value) {
  if (!isRecord(value)) return false
  const fields = Object.keys(value)
  return (
    fields.length > 0 &&
    fields.every((field) =>
      ALLOWED_DECISION_PROJECTION_FIELDS.has(field),
    ) &&
    !containsForbiddenDecisionProjectionField(value)
  )
}

function isDecisionProjectionForIntent(value, contract) {
  return (
    isDecisionProjection(value) &&
    Object.keys(value).every((field) =>
      contract.projectionFields.has(field),
    )
  )
}

function sameStringSet(left, right) {
  return (
    Array.isArray(left) &&
    new Set(left).size === left.length &&
    sameJson([...left].sort(), [...right].sort())
  )
}

function actionMatchesRequirement(action, requirement) {
  if (!requirement || action?.type !== requirement.type) return false
  if (
    requirement.field &&
    action[requirement.field] !== requirement.value
  ) {
    return false
  }
  return Object.entries(requirement.payload ?? {}).every(
    ([field, value]) => sameJson(action[field], value),
  )
}

function hasTypedSchedulePayload(action) {
  const blockMatch = /^([^:]+):d(\d+):b[0-3]$/.exec(
    action.blockId ?? '',
  )
  if (
    typeof action.memberId !== 'string' ||
    !Number.isInteger(action.dayIndex) ||
    !blockMatch ||
    blockMatch[1] !== action.memberId ||
    Number(blockMatch[2]) !== action.dayIndex ||
    typeof action.fromActivity !== 'string' ||
    typeof action.toActivity !== 'string' ||
    action.fromActivity === action.toActivity
  ) {
    return false
  }
  return true
}

function hasValidActionPayload(action) {
  if (action.type === 'EDIT_SCHEDULE') {
    return (
      hasTypedSchedulePayload(action) &&
      (
        action.responsibility === undefined ||
        action.responsibility === 'scheduled'
      )
    )
  }
  if (
    action.type === 'RESOLVE_LIN_HE_REQUEST' &&
    action.resolution === 'accepted'
  ) {
    return hasTypedSchedulePayload(action)
  }
  return true
}

function hasExactScheduleCell(projection, blockId, activity) {
  if (!Array.isArray(projection.scheduleCells)) return false
  const scheduleFields = [
    projection.scheduleCells,
    projection.resolvedScheduleCells,
  ].filter((cells) => cells !== undefined)
  return scheduleFields.every(
    (cells) =>
      Array.isArray(cells) &&
      sameJson(
        cells.filter(
          (cell) =>
            typeof cell === 'string' &&
            cell.startsWith(`${blockId}=`),
        ),
        [`${blockId}=${activity}`],
      ),
  )
}

function projectionMatchesOption(
  predicate,
  beforeProjection,
  finalProjection,
  requiredAction,
) {
  const payload = requiredAction?.payload
  if (predicate === 'food-schedule-changed') {
    return (
      payload &&
      hasExactScheduleCell(
        beforeProjection,
        payload.blockId,
        payload.fromActivity,
      ) &&
      hasExactScheduleCell(
        finalProjection,
        payload.blockId,
        payload.toActivity,
      )
    )
  }
  if (predicate === 'food-shortfall-accepted') {
    return (
      beforeProjection.foodShortfallAccepted !== true &&
      finalProjection.foodShortfallAccepted === true
    )
  }
  if (predicate === 'repair-schedule-changed') {
    return (
      payload &&
      beforeProjection.repairResponsibility === 'unresolved' &&
      hasExactScheduleCell(
        beforeProjection,
        payload.blockId,
        payload.fromActivity,
      ) &&
      finalProjection.repairResponsibility === payload.responsibility &&
      hasExactScheduleCell(
        finalProjection,
        payload.blockId,
        payload.toActivity,
      )
    )
  }
  if (predicate === 'repair-debt-accepted') {
    return (
      beforeProjection.repairDebt === null &&
      finalProjection.repairResponsibility === 'debt' &&
      isRecord(finalProjection.repairDebt) &&
      Number.isInteger(finalProjection.repairDebt.dueTick) &&
      Number.isFinite(finalProjection.repairDebt.weeklyPenalty)
    )
  }
  if (predicate === 'lin-he-accepted') {
    return (
      payload &&
      beforeProjection.resolution === 'pending' &&
      hasExactScheduleCell(
        beforeProjection,
        payload.blockId,
        payload.fromActivity,
      ) &&
      finalProjection.resolution === 'accepted' &&
      finalProjection.characterRecord?.linHeStudy === 'accepted' &&
      hasExactScheduleCell(
        finalProjection,
        payload.blockId,
        payload.toActivity,
      )
    )
  }
  if (predicate === 'lin-he-declined') {
    return (
      beforeProjection.resolution === 'pending' &&
      finalProjection.resolution === 'declined' &&
      finalProjection.characterRecord?.linHeStudy === 'declined'
    )
  }
  if (predicate === 'transport-shortcut-opened') {
    return (
      beforeProjection.transportRoute === 'north-loop' &&
      finalProjection.transportRoute === 'south-shortcut'
    )
  }
  if (predicate === 'fertilizer-used') {
    return (
      beforeProjection.fertilizer?.remainingUnits === 1 &&
      beforeProjection.fertilizer?.appliedWeekIndex === null &&
      finalProjection.fertilizer?.remainingUnits === 0 &&
      finalProjection.fertilizer?.appliedWeekIndex === 1
    )
  }
  return false
}

function validateIntentContract(group, choiceSet, actionsById) {
  const contract = INTENT_CONTRACTS.get(group.decisionIntentId)
  if (
    !contract ||
    group.weekIndex !== contract.weekIndex ||
    group.problemCategory !== contract.problemCategory ||
    group.choiceSetId !== contract.choiceSetId
  ) {
    return reject('V2_INTENT_CONTRACT')
  }

  const optionIds = choiceSet.options.map((option) => option.optionId)
  if (
    optionIds.length !== contract.optionContracts.size ||
    !optionIds.every(
      (optionId) => {
        const option = choiceSet.options.find(
          (candidate) => candidate.optionId === optionId,
        )
        const optionContract = contract.optionContracts.get(optionId)
        return (
          optionContract?.dominanceStatus ===
            option?.dominanceStatus &&
          sameStringSet(
            option?.visibleConsequenceRefs,
            optionContract?.visibleConsequenceRefs ?? [],
          )
        )
      },
    ) ||
    ![...contract.optionContracts.keys()].every((optionId) =>
      optionIds.includes(optionId),
    )
  ) {
    return reject('V2_CHOICE_SET_ORACLE_MISMATCH')
  }

  if (
    group.actionIds.some(
      (actionId) =>
        !contract.actionTypes.has(actionsById.get(actionId)?.type),
    )
  ) {
    return reject('V2_INTENT_ACTION_MISMATCH')
  }

  const selectedOptionContract = contract.optionContracts.get(
    choiceSet.selectedOptionId,
  )
  let selectedOptionAction = null
  if (group.finalDisposition === 'committed') {
    if (!selectedOptionContract?.committable) {
      return reject('V2_OPTION_NOT_COMMITTABLE')
    }
    selectedOptionAction = group.actionIds
      .map((actionId) => actionsById.get(actionId))
      .find((action) =>
        actionMatchesRequirement(
          action,
          selectedOptionContract.requiredAction,
        ),
      )
    if (!selectedOptionAction) {
      return reject('V2_OPTION_ACTION_MISMATCH')
    }
    const consequenceRefIds = group.consequenceRefs.map(
      (reference) => `${reference.kind}:${reference.id}`,
    )
    if (
      !selectedOptionContract.requiredConsequenceRefs.every(
        (reference) => consequenceRefIds.includes(reference),
      )
    ) {
      return reject('V2_REQUIRED_CONSEQUENCE_MISSING')
    }
  }

  return accept({
    contract,
    selectedOptionContract,
  })
}

function decisionProjectionHash(decisionIntentId, projection) {
  return sha256({ decisionIntentId, projection })
}

function validateChoiceSet(choiceSet) {
  if (
    !isRecord(choiceSet) ||
    typeof choiceSet.choiceSetId !== 'string' ||
    typeof choiceSet.decisionIntentId !== 'string' ||
    !Array.isArray(choiceSet.options) ||
    choiceSet.options.length < 2 ||
    !(
      choiceSet.selectedOptionId === null ||
      typeof choiceSet.selectedOptionId === 'string'
    )
  ) {
    return reject('V2_CHOICE_SET_SHAPE')
  }

  const optionIds = new Set()
  for (const option of choiceSet.options) {
    if (
      !isRecord(option) ||
      typeof option.optionId !== 'string' ||
      optionIds.has(option.optionId) ||
      typeof option.reachable !== 'boolean' ||
      !Array.isArray(option.visibleConsequenceRefs) ||
      !option.visibleConsequenceRefs.every(
        (reference) => typeof reference === 'string',
      ) ||
      !['non-dominated', 'dominated', 'unverified'].includes(
        option.dominanceStatus,
      )
    ) {
      return reject('V2_CHOICE_OPTION_SHAPE')
    }
    optionIds.add(option.optionId)
  }

  if (
    choiceSet.selectedOptionId !== null &&
    !optionIds.has(choiceSet.selectedOptionId)
  ) {
    return reject('V2_CHOICE_SELECTION_UNKNOWN')
  }

  return accept({
    qualifiedOptionCount: choiceSet.options.filter(
      (option) =>
        option.reachable &&
        option.visibleConsequenceRefs.length > 0 &&
        option.dominanceStatus === 'non-dominated',
    ).length,
  })
}

function validateCommitmentGroup(group, choiceSetsById) {
  if (
    !isRecord(group) ||
    typeof group.decisionIntentId !== 'string' ||
    typeof group.choiceSetId !== 'string' ||
    ![0, 1].includes(group.weekIndex) ||
    ![
      'food',
      'repair',
      'character-request',
      'transport',
      'asset-use',
    ].includes(group.problemCategory) ||
    !Array.isArray(group.actionIds) ||
    group.actionIds.length === 0 ||
    !group.actionIds.every((actionId) => typeof actionId === 'string') ||
    new Set(group.actionIds).size !== group.actionIds.length ||
    !Array.isArray(group.consequenceRefs) ||
    group.consequenceRefs.length === 0 ||
    !group.consequenceRefs.every(
      (reference) =>
        isRecord(reference) &&
        [
          'forecast',
          'schedule',
          'inventory',
          'risk',
          'character-record',
          'recap',
        ].includes(reference.kind) &&
        typeof reference.id === 'string',
    ) ||
    !HEX_64.test(group.beforeDecisionStateHash ?? '') ||
    !HEX_64.test(group.finalDecisionStateHash ?? '') ||
    typeof group.finalOutcomeCode !== 'string' ||
    !['committed', 'reverted', 'default-maintained'].includes(
      group.finalDisposition,
    )
  ) {
    return reject('V2_COMMITMENT_GROUP_SHAPE')
  }

  const choiceSet = choiceSetsById.get(group.choiceSetId)
  if (
    !choiceSet ||
    choiceSet.decisionIntentId !== group.decisionIntentId
  ) {
    return reject('V2_COMMITMENT_CHOICE_SET_MISMATCH')
  }

  const choiceResult = validateChoiceSet(choiceSet)
  if (!choiceResult.accepted) return choiceResult

  if (group.finalDisposition === 'committed') {
    const selectedOption = choiceSet.options.find(
      (option) => option.optionId === choiceSet.selectedOptionId,
    )
    const selectedOptionContract = INTENT_CONTRACTS
      .get(group.decisionIntentId)
      ?.optionContracts.get(choiceSet.selectedOptionId)
    const expectedScheduleObject =
      selectedOptionContract?.requiredAction?.payload?.blockId
    const scheduleConsequenceIds = group.consequenceRefs
      .filter((reference) => reference.kind === 'schedule')
      .map((reference) => reference.id)
    if (
      expectedScheduleObject &&
      scheduleConsequenceIds.some(
        (id) => id !== expectedScheduleObject,
      )
    ) {
      return reject('V2_CONSEQUENCE_OBJECT_MISMATCH')
    }
    const expectedChoiceOutcome =
      `committed:${choiceSet.selectedOptionId}`
    const validScheduleOutcome =
      group.finalOutcomeCode ===
      `committed:schedule:${group.finalDecisionStateHash}`
    const allConsequencesVisible = group.consequenceRefs.every(
      (reference) =>
        selectedOption?.visibleConsequenceRefs.includes(
          `${reference.kind}:${reference.id}`,
        ),
    )
    if (
      choiceResult.summary.qualifiedOptionCount < 2 ||
      choiceSet.selectedOptionId === null ||
      selectedOption?.reachable !== true ||
      selectedOption?.dominanceStatus !== 'non-dominated' ||
      selectedOption.visibleConsequenceRefs.length === 0 ||
      group.beforeDecisionStateHash === group.finalDecisionStateHash ||
      (
        group.finalOutcomeCode !== expectedChoiceOutcome &&
        !validScheduleOutcome
      ) ||
      !allConsequencesVisible
    ) {
      if (!allConsequencesVisible) {
        return reject('V2_CONSEQUENCE_NOT_VISIBLE')
      }
      return reject(
        selectedOption &&
          (
            !selectedOption.reachable ||
            selectedOption.dominanceStatus !== 'non-dominated' ||
            selectedOption.visibleConsequenceRefs.length === 0
          )
          ? 'V2_SELECTED_OPTION_NOT_QUALIFIED'
          : 'V2_COMMITMENT_NOT_QUALIFIED',
      )
    }
  }

  if (
    group.finalDisposition === 'reverted' &&
    (
      group.beforeDecisionStateHash !== group.finalDecisionStateHash ||
      group.finalOutcomeCode !== 'reverted'
    )
  ) {
    return reject('V2_REVERT_HASH_MISMATCH')
  }
  if (
    group.finalDisposition === 'default-maintained' &&
    (
      group.beforeDecisionStateHash !== group.finalDecisionStateHash ||
      group.finalOutcomeCode !== 'default-maintained'
    )
  ) {
    return reject('V2_DEFAULT_HASH_MISMATCH')
  }

  return accept()
}

function validatePlaytestExport(input) {
  if (!isRecord(input) || typeof input.schemaVersion !== 'string') {
    return reject('EXPORT_SHAPE')
  }

  if (!isRecord(input.meta)) {
    return reject('SAMPLE_ID')
  }

  if (!Number.isInteger(input.finalTick)) {
    return reject('FINAL_TICK')
  }

  if (
    input.finalTick > 1002 &&
    input.finalTick < 1062
  ) {
    return reject('UNREACHABLE_WEEK_GAP')
  }

  if (
    input.schemaVersion === 'gate1-playtest-v1' &&
    (
      'choiceSets' in input ||
      'candidateManagementCommitmentGroups' in input ||
      input.meta.scenarioVersion === '0.5.0'
    )
  ) {
    return reject('MIXED_SCHEMA_FIELDS')
  }

  if (input.schemaVersion === 'gate1-playtest-v1') {
    if (!SAMPLE_ID_V1.test(input.meta.sampleId ?? '')) {
      return reject('SAMPLE_ID')
    }
    if (
      !Array.isArray(input.actions) ||
      !Array.isArray(input.candidateEditGroups) ||
      !isRecord(input.finalState)
    ) {
      return reject('V1_SHAPE')
    }
    if (
      input.captureKind === 'blocked' &&
      (
        input.finalState.isComplete !== false ||
        input.blockedAtTick !== input.finalTick ||
        typeof input.blockedReason !== 'string' ||
        input.blockedReason.trim().length === 0
      )
    ) {
      return reject('V1_BLOCKED_STATE_MISMATCH')
    }
    if (
      input.captureKind === undefined &&
      (input.finalTick !== 2010 || input.finalState.isComplete !== true)
    ) {
      return reject('V1_COMPLETE_STATE_MISMATCH')
    }
    if (
      input.captureKind !== undefined &&
      input.captureKind !== 'blocked'
    ) {
      return reject('V1_CAPTURE_KIND')
    }
    return accept({
      schemaVersion: input.schemaVersion,
      candidateEditCount: input.candidateEditGroups.length,
      candidateEditGroupIds: input.candidateEditGroups.map(
        (group) => group.groupId,
      ),
      candidateManagementCount: 0,
      candidateManagementGroupIds: [],
      committedCount: 0,
      decisionHashes: [],
    })
  }

  if (input.schemaVersion !== 'gate1-playtest-v2') {
    return reject('SCHEMA_VERSION')
  }

  if (!isRc9SampleId(input.meta.sampleId)) {
    return reject('SAMPLE_ID_V2')
  }

  if (
    input.meta.scenarioVersion !== '0.5.0' ||
    !['complete', 'blocked'].includes(input.captureKind) ||
    !Array.isArray(input.actions) ||
    !Array.isArray(input.candidateEditGroups) ||
    !Array.isArray(input.choiceSets) ||
    !Array.isArray(input.candidateManagementCommitmentGroups) ||
    !isRecord(input.finalState)
  ) {
    return reject('V2_SHAPE')
  }

  const actionsById = new Map()
  for (const action of input.actions) {
    if (
      !isRecord(action) ||
      typeof action.id !== 'string' ||
      typeof action.type !== 'string'
    ) {
      return reject('V2_ACTION_SHAPE')
    }
    if (actionsById.has(action.id)) {
      return reject('V2_ACTION_DUPLICATE')
    }
    if (!ALLOWED_V2_ACTION_TYPES.has(action.type)) {
      return reject('V2_ACTION_TYPE')
    }
    if (!hasValidActionPayload(action)) {
      return reject('V2_ACTION_PAYLOAD')
    }
    actionsById.set(action.id, action)
    if (
      action.type === 'UNDO' &&
      (
        typeof action.revertsActionId !== 'string' ||
        !actionsById.has(action.revertsActionId)
      )
    ) {
      return reject('V2_UNDO_TARGET')
    }
    if (
      action.type === 'REDO' &&
      (
        typeof action.replaysActionId !== 'string' ||
        !actionsById.has(action.replaysActionId)
      )
    ) {
      return reject('V2_REDO_TARGET')
    }
  }

  const legacyGroupIds = new Set()
  const legacyActionOwners = new Map()
  for (const group of input.candidateEditGroups) {
    if (
      !isRecord(group) ||
      typeof group.groupId !== 'string' ||
      !Array.isArray(group.actionIds) ||
      group.actionIds.length === 0 ||
      new Set(group.actionIds).size !== group.actionIds.length
    ) {
      return reject('V2_CANDIDATE_EDIT_GROUP_SHAPE')
    }
    if (group.actionIds.some((actionId) => !actionsById.has(actionId))) {
      return reject('V2_CANDIDATE_ACTION_UNKNOWN')
    }
    if (legacyGroupIds.has(group.groupId)) {
      return reject('V2_CANDIDATE_EDIT_GROUP_DUPLICATE')
    }
    const legacyContract = LEGACY_GROUP_CONTRACTS.get(group.groupId)
    if (
      !legacyContract ||
      group.actionIds.some(
        (actionId) =>
          !legacyContract.has(actionsById.get(actionId)?.type),
      )
    ) {
      return reject('V2_LEGACY_GROUP_CONTRACT')
    }
    legacyGroupIds.add(group.groupId)
    for (const actionId of group.actionIds) {
      if (legacyActionOwners.has(actionId)) {
        return reject('V2_LEGACY_ACTION_REUSED')
      }
      legacyActionOwners.set(actionId, group)
    }
  }

  if (
    input.captureKind === 'complete' &&
    (
      input.finalTick !== 2010 ||
      input.finalState.isComplete !== true ||
      'blockedAtTick' in input ||
      'blockedReason' in input
    )
  ) {
    return reject('COMPLETE_STATE_MISMATCH')
  }
  if (
    input.captureKind === 'complete' &&
    (
      !Array.isArray(input.weekRecaps) ||
      input.weekRecaps.length !== 2 ||
      input.weekRecaps[0]?.weekIndex !== 0 ||
      input.weekRecaps[1]?.weekIndex !== 1
    )
  ) {
    return reject('COMPLETE_RECAPS')
  }

  if (
    input.captureKind === 'blocked' &&
    (
      typeof input.blockedReason !== 'string' ||
      input.blockedReason.trim().length === 0 ||
      input.blockedReason.trim().length > 240
    )
  ) {
    return reject('BLOCKED_REASON_LENGTH')
  }

  if (
    input.captureKind === 'blocked' &&
    (
      input.finalState.isComplete !== false ||
      input.blockedAtTick !== input.finalTick ||
      input.finalTick < 54 ||
      input.finalTick > 2010
    )
  ) {
    return reject('BLOCKED_STATE_MISMATCH')
  }

  const choiceSetsById = new Map()
  for (const choiceSet of input.choiceSets) {
    const result = validateChoiceSet(choiceSet)
    if (!result.accepted) return result
    if (choiceSetsById.has(choiceSet.choiceSetId)) {
      return reject('V2_CHOICE_SET_DUPLICATE')
    }
    choiceSetsById.set(choiceSet.choiceSetId, choiceSet)
  }

  const commitmentGroupKeys = new Set()
  const managementActionOwners = new Map()
  const intentContractsByGroupKey = new Map()
  for (const group of input.candidateManagementCommitmentGroups) {
    const result = validateCommitmentGroup(group, choiceSetsById)
    if (!result.accepted) return result
    if (group.actionIds.some((actionId) => !actionsById.has(actionId))) {
      return reject('V2_CANDIDATE_ACTION_UNKNOWN')
    }
    const key = `${group.weekIndex}:${group.decisionIntentId}`
    if (commitmentGroupKeys.has(key)) {
      return reject('V2_COMMITMENT_GROUP_DUPLICATE')
    }
    if (
      group.actionIds.some((actionId) =>
        managementActionOwners.has(actionId),
      )
    ) {
      return reject('V2_MANAGEMENT_ACTION_REUSED')
    }
    const contractResult = validateIntentContract(
      group,
      choiceSetsById.get(group.choiceSetId),
      actionsById,
    )
    if (!contractResult.accepted) return contractResult
    for (const actionId of group.actionIds) {
      managementActionOwners.set(actionId, group)
    }
    commitmentGroupKeys.add(key)
    intentContractsByGroupKey.set(key, contractResult.summary)
  }

  if (
    input.candidateManagementCommitmentGroups.length > 0 &&
    !isRecord(input.oracleDecisionProjections)
  ) {
    return reject('V2_DECISION_PROJECTION_MISSING')
  }
  for (const group of input.candidateManagementCommitmentGroups) {
    const key = `${group.weekIndex}:${group.decisionIntentId}`
    const projections = input.oracleDecisionProjections[key]
    const {
      contract,
      selectedOptionContract,
    } = intentContractsByGroupKey.get(key)
    if (
      !isRecord(projections) ||
      !isDecisionProjectionForIntent(projections.before, contract) ||
      !isDecisionProjectionForIntent(projections.final, contract)
    ) {
      return reject('V2_DECISION_PROJECTION_FIELDS')
    }
    const beforeHash = decisionProjectionHash(
      group.decisionIntentId,
      projections.before,
    )
    const finalHash = decisionProjectionHash(
      group.decisionIntentId,
      projections.final,
    )
    if (
      group.beforeDecisionStateHash !== beforeHash ||
      group.finalDecisionStateHash !== finalHash
    ) {
      return reject('V2_DECISION_HASH_MISMATCH')
    }
    if (
      group.finalDisposition === 'committed' &&
      !projectionMatchesOption(
        selectedOptionContract.projectionPredicate,
        projections.before,
        projections.final,
        selectedOptionContract.requiredAction,
      )
    ) {
      return reject('V2_OPTION_PROJECTION_MISMATCH')
    }
  }

  function hasCompleteUndoRedoChain(actionIds) {
    const groupActionIds = new Set(actionIds)
    return input.actions.every((action) => {
      const targetActionId =
        action.type === 'UNDO'
          ? action.revertsActionId
          : action.type === 'REDO'
            ? action.replaysActionId
            : null
      if (targetActionId === null) return true
      return (
        groupActionIds.has(action.id) ===
        groupActionIds.has(targetActionId)
      )
    })
  }
  if (
    [
      ...input.candidateEditGroups,
      ...input.candidateManagementCommitmentGroups,
    ].some((group) => !hasCompleteUndoRedoChain(group.actionIds))
  ) {
    return reject('V2_ACTION_CHAIN_INCOMPLETE')
  }

  for (const action of input.actions) {
    const legacyGroup = legacyActionOwners.get(action.id)
    const managementGroup = managementActionOwners.get(action.id)
    if (action.type === 'RESOLVE_LIN_HE_REQUEST') {
      if (
        action.resolution === 'accepted' &&
        (
          legacyGroup?.groupId !== 'legacy:w1:lin-he-study' ||
          managementGroup?.decisionIntentId !==
            'w1:character-request:lin-he-study'
        )
      ) {
        return reject('V2_ACCEPTED_REQUEST_CLASSIFICATION')
      }
      if (
        action.resolution === 'declined' &&
        action.persistentCharacterRecord === true &&
        (
          legacyGroup !== undefined ||
          managementGroup?.decisionIntentId !==
            'w1:character-request:lin-he-study'
        )
      ) {
        return reject('V2_DECLINED_REQUEST_CLASSIFICATION')
      }
      if (
        action.resolution === 'declined' &&
        action.persistentCharacterRecord !== true &&
        (
          legacyGroup !== undefined ||
          managementGroup !== undefined
        )
      ) {
        return reject('V2_DEFAULT_REQUEST_CLASSIFICATION')
      }
      if (!['accepted', 'declined'].includes(action.resolution)) {
        return reject('V2_REQUEST_RESOLUTION')
      }
    }
    if (
      action.type === 'SELECT_REPAIR_RESPONSIBILITY' &&
      action.scheduleConfirmed === false &&
      (
        legacyGroup !== undefined ||
        managementGroup !== undefined
      )
    ) {
      return reject('V2_UNCONFIRMED_REPAIR_CLASSIFICATION')
    }
    if (
      action.type === 'ACCEPT_REPAIR_DEBT' &&
      (
        legacyGroup !== undefined ||
        managementGroup?.decisionIntentId !==
          'w0:repair-responsibility:pump-incident-day-3'
      )
    ) {
      return reject('V2_REPAIR_DEBT_CLASSIFICATION')
    }
  }

  return accept({
    schemaVersion: input.schemaVersion,
    candidateEditCount: input.candidateEditGroups.length,
    candidateEditGroupIds: input.candidateEditGroups.map(
      (group) => group.groupId,
    ),
    candidateManagementCount:
      input.candidateManagementCommitmentGroups.length,
    candidateManagementGroupIds:
      input.candidateManagementCommitmentGroups.map(
        (group) => group.decisionIntentId,
      ),
    committedCount: input.candidateManagementCommitmentGroups.filter(
      (group) => group.finalDisposition === 'committed',
    ).length,
    decisionHashes: input.candidateManagementCommitmentGroups.map(
      (group) => group.finalDecisionStateHash,
    ),
  })
}

function validateComparisonState(input) {
  if (
    !isRecord(input) ||
    !Array.isArray(input.options) ||
    input.options.length < 2
  ) {
    return reject('COMPARISON_SHAPE')
  }

  const available = input.options.filter((option) => option.reachable)
  const samePresentation = available.every(
    (option) =>
      option.visualRole === 'equal' &&
      option.ariaRole === 'radio' &&
      option.recommended === false,
  )
  const neutral =
    input.selectedOptionId === null &&
    input.initialFocusTarget === 'comparison-heading' &&
    input.enterBeforeSelectionCommits === false &&
    input.spaceBeforeSelectionCommits === false &&
    input.authorityMutationCountOnOpen === 0

  if (!samePresentation || !neutral) {
    return reject('COMPARISON_BIAS_OR_MUTATION')
  }

  return accept({
    authorityMutationCount: input.authorityMutationCountOnOpen,
    availableOptionCount: available.length,
  })
}

function compareValue(left, right, direction) {
  if (direction === 'higher') return Math.sign(left - right)
  if (direction === 'lower') return Math.sign(right - left)
  throw new Error(`未知结果轴方向：${direction}`)
}

function validateDominanceCase(input) {
  if (
    !isRecord(input) ||
    !Array.isArray(input.continuationPolicyIds) ||
    input.continuationPolicyIds.length === 0 ||
    new Set(input.continuationPolicyIds).size !==
      input.continuationPolicyIds.length ||
    !input.continuationPolicyIds.every(
      (policyId) => typeof policyId === 'string' && policyId.length > 0,
    ) ||
    !Array.isArray(input.axes) ||
    input.axes.length === 0 ||
    !Array.isArray(input.options) ||
    input.options.length < 2
  ) {
    return reject('DOMINANCE_SHAPE')
  }

  const axisIds = input.axes.map((axis) => axis?.id)
  const optionIds = input.options.map((option) => option?.optionId)
  if (
    !input.axes.every(
      (axis) =>
        isRecord(axis) &&
        typeof axis.id === 'string' &&
        ['higher', 'lower'].includes(axis.direction),
    ) ||
    new Set(axisIds).size !== axisIds.length ||
    !input.options.every(
      (option) =>
        isRecord(option) &&
        typeof option.optionId === 'string' &&
        isRecord(option.resultsByPolicy),
    ) ||
    new Set(optionIds).size !== optionIds.length
  ) {
    return reject('DOMINANCE_SHAPE')
  }

  const statuses = {}
  const expectedPolicyIds = [...input.continuationPolicyIds].sort()
  const policySets = input.options.map((option) =>
    Object.keys(option.resultsByPolicy ?? {}).sort(),
  )
  const completePolicies = policySets.every(
    (set) => sameJson(set, expectedPolicyIds),
  )
  const completeVectors = input.options.every((option) =>
    expectedPolicyIds.every((policyId) => {
      const vector = option.resultsByPolicy[policyId]
      return (
        Array.isArray(vector) &&
        vector.length === input.axes.length &&
        vector.every(
          (value) => typeof value === 'number' && Number.isFinite(value),
        )
      )
    }),
  )
  if (!completePolicies || !completeVectors) {
    for (const option of input.options) statuses[option.optionId] = 'unverified'
    return accept({ dominanceStatus: statuses })
  }

  for (const option of input.options) statuses[option.optionId] = 'non-dominated'

  for (const candidate of input.options) {
    for (const other of input.options) {
      if (candidate === other) continue
      let noWorseEverywhere = true
      let strictlyBetterSomewhere = false
      for (const policyId of expectedPolicyIds) {
        const candidateVector = candidate.resultsByPolicy[policyId]
        const otherVector = other.resultsByPolicy[policyId]
        input.axes.forEach((axis, index) => {
          const comparison = compareValue(
            candidateVector[index],
            otherVector[index],
            axis.direction,
          )
          if (comparison < 0) noWorseEverywhere = false
          if (comparison > 0) strictlyBetterSomewhere = true
        })
      }
      if (noWorseEverywhere && strictlyBetterSomewhere) {
        statuses[other.optionId] = 'dominated'
      }
    }
  }

  return accept({ dominanceStatus: statuses })
}

function validateCandidateManifest(input) {
  if (
    !isRecord(input) ||
    !CANDIDATE_MANIFEST_ID.test(input.candidateManifestId ?? '') ||
    !CANDIDATE_ATTEMPT_ID.test(input.candidateAttempt ?? '') ||
    input.status !== 'PENDING_INDEPENDENT_REVIEW' ||
    !GIT_SHA.test(input.sourceSha ?? '') ||
    !HEX_64.test(input.artifactHash ?? '') ||
    !HEX_64.test(input.archiveHash ?? '') ||
    !Array.isArray(input.authorityHashes) ||
    !Array.isArray(input.rejectedAttempts) ||
    !input.rejectedAttempts.every(
      (attempt) =>
        isRecord(attempt) &&
        CANDIDATE_ATTEMPT_ID.test(attempt.candidateAttempt ?? '') &&
        HEX_64.test(attempt.rejectionHash ?? ''),
    )
  ) {
    return reject('CANDIDATE_MANIFEST_SHAPE')
  }

  const requiredAuthorityPaths = {
    protocol:
      'docs/product-specs/weekly-management-slice-playtest-v0.2.md',
    design:
      'docs/design-docs/weekly-plan-production-forecast-slice-v0.2.md',
    operations:
      'docs/exec-plans/active/2026-07-27-gate1a-rc9-test-operations.md',
    'player-packet':
      'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/player-packet-v0.2.md',
    interview:
      'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/post-session-interview-v0.2.md',
    'fixture-oracle':
      'prototype/tests/fixtures/fixture-expectations.json',
    'capture-host': 'prototype/scripts/playtest-host.mjs',
  }
  const requiredAuthorityRoles = Object.keys(requiredAuthorityPaths)
  const authorityRoles = input.authorityHashes.map((entry) => entry?.role)
  const authorityPaths = input.authorityHashes.map((entry) => entry?.path)
  if (
    input.authorityHashes.length !== requiredAuthorityRoles.length ||
    !input.authorityHashes.every(
      (entry) =>
        isRecord(entry) &&
        requiredAuthorityRoles.includes(entry.role) &&
        entry.path === requiredAuthorityPaths[entry.role] &&
        HEX_64.test(entry.sha256 ?? ''),
    ) ||
    new Set(authorityRoles).size !== authorityRoles.length ||
    new Set(authorityPaths).size !== authorityPaths.length ||
    !requiredAuthorityRoles.every((role) => authorityRoles.includes(role))
  ) {
    return reject('CANDIDATE_MANIFEST_AUTHORITY')
  }

  const manifestNumber = Number(input.candidateManifestId.slice(2))
  const attemptNumber = Number(input.candidateAttempt.slice(1))
  const expectedPriorManifestIds = Array.from(
    { length: manifestNumber - 1 },
    (_, index) => `CM${String(index + 1).padStart(2, '0')}`,
  )
  if (
    !Array.isArray(input.priorManifests) ||
    !input.priorManifests.every(
      (entry) =>
        isRecord(entry) &&
        CANDIDATE_MANIFEST_ID.test(entry.candidateManifestId ?? '') &&
        CANDIDATE_ATTEMPT_ID.test(entry.candidateAttempt ?? '') &&
        HEX_64.test(entry.manifestHash ?? '') &&
        [
          'REJECTED_INDEPENDENT_REVIEW',
          'REJECTED_SEAL',
        ].includes(entry.status),
    ) ||
    !sameJson(
      input.priorManifests.map(
        (entry) => entry.candidateManifestId,
      ),
      expectedPriorManifestIds,
    )
  ) {
    return reject('CANDIDATE_MANIFEST_HISTORY')
  }
  const priorManifestAttemptIds = input.priorManifests.map(
    (entry) => entry.candidateAttempt,
  )
  const rejectedAttemptIds = input.rejectedAttempts.map(
    (entry) => entry.candidateAttempt,
  )
  const expectedPriorAttemptIds = Array.from(
    { length: attemptNumber - 1 },
    (_, index) => `C${String(index + 1).padStart(2, '0')}`,
  )
  if (
    new Set(priorManifestAttemptIds).size !==
      priorManifestAttemptIds.length ||
    new Set(rejectedAttemptIds).size !== rejectedAttemptIds.length ||
    priorManifestAttemptIds.includes(input.candidateAttempt) ||
    priorManifestAttemptIds.some(
      (candidateAttempt) =>
        !rejectedAttemptIds.includes(candidateAttempt),
    ) ||
    !sameJson(
      rejectedAttemptIds,
      expectedPriorAttemptIds,
    )
  ) {
    return reject('CANDIDATE_MANIFEST_HISTORY')
  }

  const requiredCommandIds = [
    'lint',
    'test',
    'build',
    'rc-build',
    'rc-verify',
    'e2e-rc',
    'rc-archive',
    'rc-verify-archive',
    'schema-fixtures',
    'guard-rc8',
    'manifest-verify',
    'rc-repro',
  ]
  const commandIds = input.commandResults?.map((entry) => entry?.id) ?? []
  const expectedDiagnosticIds = Array.from(
    { length: 5 },
    (_, index) =>
      `TECH-RC9-D${String((attemptNumber - 1) * 5 + index + 1).padStart(2, '0')}`,
  )
  const expectedAntiPassIds = Array.from(
    { length: 2 },
    (_, index) =>
      `TECH-RC9-P${String((attemptNumber - 1) * 2 + index + 1).padStart(2, '0')}`,
  )
  const diagnosticIds = input.diagnosticManifest?.sampleIds ?? []
  const antiPassIds = input.antiPass?.map((entry) => entry?.sampleId) ?? []
  if (
    !GIT_SHA.test(input.dependencyIntegrationSha ?? '') ||
    !HEX_64.test(input.candidateAttemptManifestHash ?? '') ||
    typeof input.buildId !== 'string' ||
    input.buildId.length === 0 ||
    input.scenarioId !== 'gate1-two-week-management' ||
    input.scenarioVersion !== '0.5.0' ||
    input.schemaVersion !== 'gate1-playtest-v2' ||
    !isRecord(input.diagnosticManifest) ||
    input.diagnosticManifest.status !== 'PASS' ||
    input.diagnosticManifest.path !==
      `candidates/${input.candidateAttempt}/diagnostics/manifest.json` ||
    !HEX_64.test(input.diagnosticManifest.sha256 ?? '') ||
    !Array.isArray(input.diagnosticManifest.sampleIds) ||
    input.diagnosticManifest.sampleIds.length !== 5 ||
    new Set(input.diagnosticManifest.sampleIds).size !== 5 ||
    !sameJson(diagnosticIds, expectedDiagnosticIds) ||
    !Array.isArray(input.antiPass) ||
    input.antiPass.length !== 2 ||
    !input.antiPass.every(
      (entry) =>
        isRecord(entry) &&
        SAMPLE_ID_V2_TECH.test(entry.sampleId ?? '') &&
        entry.status === 'PASS' &&
        HEX_64.test(entry.evidenceHash ?? ''),
    ) ||
    new Set(input.antiPass.map((entry) => entry.sampleId)).size !== 2 ||
    !sameJson(antiPassIds, expectedAntiPassIds) ||
    !isRecord(input.rc8Guard) ||
    !GIT_SHA.test(input.rc8Guard.baselineSha ?? '') ||
    !GIT_SHA.test(input.rc8Guard.treeId ?? '') ||
    !HEX_64.test(input.rc8Guard.inventorySha256 ?? '') ||
    input.rc8Guard.status !== 'PASS' ||
    !Array.isArray(input.commandResults) ||
    input.commandResults.length !== requiredCommandIds.length ||
    new Set(commandIds).size !== commandIds.length ||
    !requiredCommandIds.every((id) => commandIds.includes(id)) ||
    !input.commandResults.every(
      (entry) =>
        isRecord(entry) &&
        requiredCommandIds.includes(entry.id) &&
        entry.status === 'PASS' &&
        HEX_64.test(entry.outputHash ?? ''),
    ) ||
    input.rejectedAttempts.some(
      (entry) => entry.candidateAttempt === input.candidateAttempt,
    )
  ) {
    return reject('CANDIDATE_MANIFEST_EVIDENCE')
  }

  return accept({
    candidateManifestId: input.candidateManifestId,
    candidateAttempt: input.candidateAttempt,
  })
}

function validateDecisionHashCase(input) {
  if (
    !isRecord(input) ||
    !Array.isArray(input.snapshots) ||
    input.snapshots.length < 2 ||
    !Array.isArray(input.relations) ||
    input.relations.length === 0
  ) {
    return reject('DECISION_HASH_SHAPE')
  }

  const hashes = {}
  for (const snapshot of input.snapshots) {
    if (
      !isRecord(snapshot) ||
      typeof snapshot.id !== 'string' ||
      snapshot.id in hashes ||
      typeof snapshot.decisionIntentId !== 'string' ||
      !isRecord(snapshot.projection)
    ) {
      return reject('DECISION_HASH_SNAPSHOT')
    }
    if (!isDecisionProjection(snapshot.projection)) {
      return reject('DECISION_HASH_PROJECTION_FIELDS')
    }
    hashes[snapshot.id] = decisionProjectionHash(
      snapshot.decisionIntentId,
      snapshot.projection,
    )
  }

  const relations = []
  for (const relation of input.relations) {
    if (
      !isRecord(relation) ||
      typeof relation.left !== 'string' ||
      typeof relation.right !== 'string' ||
      !['equal', 'different'].includes(relation.expected) ||
      !(relation.left in hashes) ||
      !(relation.right in hashes)
    ) {
      return reject('DECISION_HASH_RELATION')
    }
    const actual =
      hashes[relation.left] === hashes[relation.right]
        ? 'equal'
        : 'different'
    relations.push({
      left: relation.left,
      right: relation.right,
      actual,
      expected: relation.expected,
    })
    if (actual !== relation.expected) {
      return reject('DECISION_HASH_RELATION_MISMATCH', {
        hashes,
        relations,
      })
    }
  }

  return accept({ hashes, relations })
}

function validateFertilizerLifecycle(input) {
  if (
    !isRecord(input) ||
    input.initialUnits !== 1 ||
    ![null, 0, 1].includes(input.appliedWeekIndex) ||
    ![0, 1].includes(input.remainingUnits) ||
    !Array.isArray(input.weekRecaps) ||
    input.weekRecaps.length !== 2 ||
    !input.weekRecaps.every(
      (recap, index) =>
        isRecord(recap) &&
        recap.weekIndex === index &&
        Number.isFinite(recap.fertilizerBonus),
    )
  ) {
    return reject('FERTILIZER_LIFECYCLE_SHAPE')
  }

  const expectedRemaining = input.appliedWeekIndex === null ? 1 : 0
  const expectedBonuses = [0, 1].map((weekIndex) =>
    input.appliedWeekIndex === weekIndex ? 6 : 0,
  )
  const weekBonuses = input.weekRecaps.map(
    (recap) => recap.fertilizerBonus,
  )
  if (
    input.remainingUnits !== expectedRemaining ||
    !sameJson(weekBonuses, expectedBonuses)
  ) {
    return reject('FERTILIZER_LIFECYCLE_MISMATCH', {
      appliedWeekIndex: input.appliedWeekIndex,
      remainingUnits: input.remainingUnits,
      weekBonuses,
    })
  }

  return accept({
    appliedWeekIndex: input.appliedWeekIndex,
    remainingUnits: input.remainingUnits,
    weekBonuses,
  })
}

function validateOutcomeFingerprintCase(input) {
  if (
    !isRecord(input) ||
    !Array.isArray(input.snapshots) ||
    input.snapshots.length < 2 ||
    !Array.isArray(input.relations) ||
    input.relations.length === 0
  ) {
    return reject('OUTCOME_FINGERPRINT_SHAPE')
  }

  const hashes = {}
  for (const snapshot of input.snapshots) {
    if (
      !isRecord(snapshot) ||
      typeof snapshot.id !== 'string' ||
      snapshot.id in hashes ||
      !Array.isArray(snapshot.outcomes)
    ) {
      return reject('OUTCOME_FINGERPRINT_SNAPSHOT')
    }
    const seenIntentIds = new Set()
    const projection = []
    for (const outcome of snapshot.outcomes) {
      if (
        !isRecord(outcome) ||
        typeof outcome.decisionIntentId !== 'string' ||
        typeof outcome.finalOutcomeCode !== 'string' ||
        seenIntentIds.has(outcome.decisionIntentId)
      ) {
        return reject('OUTCOME_FINGERPRINT_OUTCOME')
      }
      seenIntentIds.add(outcome.decisionIntentId)
      projection.push({
        decisionIntentId: outcome.decisionIntentId,
        finalOutcomeCode: outcome.finalOutcomeCode,
      })
    }
    projection.sort((left, right) =>
      left.decisionIntentId.localeCompare(right.decisionIntentId),
    )
    hashes[snapshot.id] = sha256(projection)
  }

  const relations = []
  for (const relation of input.relations) {
    if (
      !isRecord(relation) ||
      typeof relation.left !== 'string' ||
      typeof relation.right !== 'string' ||
      !['equal', 'different'].includes(relation.expected) ||
      !(relation.left in hashes) ||
      !(relation.right in hashes)
    ) {
      return reject('OUTCOME_FINGERPRINT_RELATION')
    }
    const actual =
      hashes[relation.left] === hashes[relation.right]
        ? 'equal'
        : 'different'
    relations.push({
      left: relation.left,
      right: relation.right,
      actual,
      expected: relation.expected,
    })
    if (actual !== relation.expected) {
      return reject('OUTCOME_FINGERPRINT_RELATION_MISMATCH', {
        hashes,
        relations,
      })
    }
  }

  return accept({ hashes, relations })
}

function validateFixture(fixture) {
  if (!isRecord(fixture) || typeof fixture.fixtureId !== 'string') {
    return reject('FIXTURE_SHAPE')
  }
  if (fixture.kind === 'playtest-export') {
    return validatePlaytestExport(fixture.input)
  }
  if (fixture.kind === 'comparison-state') {
    return validateComparisonState(fixture.input)
  }
  if (fixture.kind === 'dominance-case') {
    return validateDominanceCase(fixture.input)
  }
  if (fixture.kind === 'candidate-manifest') {
    return validateCandidateManifest(fixture.input)
  }
  if (fixture.kind === 'decision-hash-case') {
    return validateDecisionHashCase(fixture.input)
  }
  if (fixture.kind === 'fertilizer-lifecycle') {
    return validateFertilizerLifecycle(fixture.input)
  }
  if (fixture.kind === 'outcome-fingerprint-case') {
    return validateOutcomeFingerprintCase(fixture.input)
  }
  return reject('FIXTURE_KIND')
}

function assertionValue(result, key) {
  if (key === 'accepted') return result.accepted
  if (key === 'errorCode') return result.errorCode
  return result.summary[key]
}

let expectations
try {
  expectations = JSON.parse(await readFile(expectationsPath, 'utf8'))
} catch {
  console.error('fixture-expectations.json JSON_READ_OR_PARSE')
  process.exit(1)
}
if (
  !isRecord(expectations) ||
  expectations.contractVersion !== 'gate1-playtest-fixtures-v2' ||
  !Array.isArray(expectations.fixtures) ||
  expectations.fixtures.length === 0
) {
  throw new Error('fixture-expectations.json 结构无效')
}

const listedFiles = new Set()
const fixtureIds = new Set()
const failures = []
const requiredFixtureFiles = [
  'playtest-v1/complete-valid.json',
  'playtest-v1/blocked-valid.json',
  'playtest-v2/request-accepted-valid.json',
  'playtest-v2/request-declined-persistent-valid.json',
  'playtest-v2/request-declined-default-valid.json',
  'playtest-v2/repair-direction-unconfirmed-valid.json',
  'playtest-v2/repair-debt-committed-valid.json',
  'playtest-v2/fertilizer-week1-valid.json',
  'playtest-v2/fertilizer-week2-valid.json',
  'playtest-v2/fertilizer-unused-valid.json',
  'playtest-v2/edit-undo-redo-valid.json',
  'playtest-v2/edit-fully-reverted-valid.json',
  'playtest-v2/mixed-v1-v2-rejected.json',
  'playtest-v2/unreachable-tick-rejected.json',
  'playtest-v2/comparison-neutral-valid.json',
  'playtest-v2/housekeeping-single-option-valid.json',
  'playtest-v2/decision-hash-stable.json',
  'playtest-v2/decision-hash-different.json',
  'playtest-v2/decision-hash-cross-intent-isolation.json',
  'playtest-v2/outcome-fingerprint-stability.json',
  'playtest-v2/dominance-complete-valid.json',
  'playtest-v2/dominance-incomplete-unverified.json',
  'playtest-v2/dominance-nonnumeric-unverified.json',
  'playtest-v2/selected-dominated-option-rejected.json',
  'playtest-v2/dangling-action-rejected.json',
  'playtest-v2/request-accepted-omitted-rejected.json',
  'playtest-v2/consequence-not-visible-rejected.json',
  'playtest-v2/decision-hash-history-only-rejected.json',
  'playtest-v2/human-sample-id-rejected.json',
  'playtest-v2/complete-missing-recaps-rejected.json',
  'playtest-v2/blocked-reason-too-long-rejected.json',
  'playtest-v2/undo-chain-omitted-rejected.json',
  'playtest-v2/duplicate-legacy-group-rejected.json',
  'playtest-v2/wrong-week-category-rejected.json',
  'playtest-v2/same-action-two-intents-rejected.json',
  'playtest-v2/unknown-domain-action-rejected.json',
  'playtest-v2/food-cross-intent-projection-rejected.json',
  'playtest-v2/food-choice-oracle-mismatch-rejected.json',
  'playtest-v2/mechanical-three-committed-rejected.json',
  'playtest-v2/canonical-agent-id-leading-zero-rejected.json',
  'playtest-v2/canonical-tech-id-leading-zero-rejected.json',
  'manifests/candidate-valid.json',
  'manifests/candidate-invalid-source-sha.json',
  'manifests/candidate-invalid-incomplete-authority.json',
  'manifests/candidate-zero-id-rejected.json',
  'manifests/candidate-c02-reuses-c01-evidence-rejected.json',
]
const REQUIRED_FIXTURE_OUTCOMES = new Map([
  ['playtest-v1/complete-valid.json', [true, null]],
  ['playtest-v2/decision-hash-stable.json', [true, null]],
  ['playtest-v1/blocked-valid.json', [true, null]],
  ['playtest-v2/request-accepted-valid.json', [true, null]],
  ['playtest-v2/request-declined-persistent-valid.json', [true, null]],
  ['playtest-v2/request-declined-default-valid.json', [true, null]],
  ['playtest-v2/repair-direction-unconfirmed-valid.json', [true, null]],
  ['playtest-v2/repair-debt-committed-valid.json', [true, null]],
  ['playtest-v2/edit-undo-redo-valid.json', [true, null]],
  ['playtest-v2/edit-fully-reverted-valid.json', [true, null]],
  ['playtest-v2/mixed-v1-v2-rejected.json', [false, 'MIXED_SCHEMA_FIELDS']],
  ['playtest-v2/unreachable-tick-rejected.json', [false, 'UNREACHABLE_WEEK_GAP']],
  ['playtest-v2/housekeeping-single-option-valid.json', [true, null]],
  ['playtest-v2/comparison-neutral-valid.json', [true, null]],
  ['playtest-v2/comparison-biased-rejected.json', [false, 'COMPARISON_BIAS_OR_MUTATION']],
  ['playtest-v2/dominance-complete-valid.json', [true, null]],
  ['playtest-v2/dominance-incomplete-unverified.json', [true, null]],
  ['playtest-v2/dominance-nonnumeric-unverified.json', [true, null]],
  ['playtest-v2/decision-hash-different.json', [true, null]],
  ['playtest-v2/fertilizer-week1-valid.json', [true, null]],
  ['playtest-v2/fertilizer-week2-valid.json', [true, null]],
  ['playtest-v2/fertilizer-unused-valid.json', [true, null]],
  ['playtest-v2/fertilizer-repeated-rejected.json', [false, 'FERTILIZER_LIFECYCLE_MISMATCH']],
  ['manifests/candidate-valid.json', [true, null]],
  ['manifests/candidate-invalid-source-sha.json', [false, 'CANDIDATE_MANIFEST_SHAPE']],
  ['manifests/candidate-invalid-incomplete-authority.json', [false, 'CANDIDATE_MANIFEST_AUTHORITY']],
  ['playtest-v2/outcome-fingerprint-stability.json', [true, null]],
  ['playtest-v2/duplicate-intent-group-rejected.json', [false, 'V2_COMMITMENT_GROUP_DUPLICATE']],
  ['playtest-v2/decision-hash-cross-intent-isolation.json', [true, null]],
  ['playtest-v2/selected-dominated-option-rejected.json', [false, 'V2_SELECTED_OPTION_NOT_QUALIFIED']],
  ['playtest-v2/dangling-action-rejected.json', [false, 'V2_CANDIDATE_ACTION_UNKNOWN']],
  ['playtest-v2/request-accepted-omitted-rejected.json', [false, 'V2_ACCEPTED_REQUEST_CLASSIFICATION']],
  ['playtest-v2/consequence-not-visible-rejected.json', [false, 'V2_CONSEQUENCE_NOT_VISIBLE']],
  ['playtest-v2/decision-hash-history-only-rejected.json', [false, 'DECISION_HASH_PROJECTION_FIELDS']],
  ['playtest-v2/human-sample-id-rejected.json', [false, 'SAMPLE_ID_V2']],
  ['playtest-v2/complete-missing-recaps-rejected.json', [false, 'COMPLETE_RECAPS']],
  ['playtest-v2/blocked-reason-too-long-rejected.json', [false, 'BLOCKED_REASON_LENGTH']],
  ['playtest-v2/undo-chain-omitted-rejected.json', [false, 'V2_ACTION_CHAIN_INCOMPLETE']],
  ['playtest-v2/duplicate-legacy-group-rejected.json', [false, 'V2_CANDIDATE_EDIT_GROUP_DUPLICATE']],
  ['playtest-v2/wrong-week-category-rejected.json', [false, 'V2_INTENT_CONTRACT']],
  ['playtest-v2/same-action-two-intents-rejected.json', [false, 'V2_MANAGEMENT_ACTION_REUSED']],
  ['playtest-v2/unknown-domain-action-rejected.json', [false, 'V2_ACTION_TYPE']],
  ['playtest-v2/food-cross-intent-projection-rejected.json', [false, 'V2_DECISION_PROJECTION_FIELDS']],
  ['playtest-v2/food-choice-oracle-mismatch-rejected.json', [false, 'V2_CHOICE_SET_ORACLE_MISMATCH']],
  ['playtest-v2/mechanical-three-committed-rejected.json', [false, 'V2_INTENT_CONTRACT']],
  ['playtest-v2/canonical-agent-id-leading-zero-rejected.json', [false, 'SAMPLE_ID_V2']],
  ['playtest-v2/canonical-tech-id-leading-zero-rejected.json', [false, 'SAMPLE_ID_V2']],
  ['manifests/candidate-zero-id-rejected.json', [false, 'CANDIDATE_MANIFEST_SHAPE']],
  ['manifests/candidate-c02-reuses-c01-evidence-rejected.json', [false, 'CANDIDATE_MANIFEST_EVIDENCE']],
  ['manifests/candidate-c02-first-manifest-valid.json', [true, null]],
  ['manifests/candidate-c02-second-manifest-valid.json', [true, null]],
  ['manifests/candidate-c01-rewrapped-by-cm02-rejected.json', [false, 'CANDIDATE_MANIFEST_HISTORY']],
  ['playtest-v2/food-shortfall-committed-valid.json', [true, null]],
  ['playtest-v2/repair-schedule-committed-valid.json', [true, null]],
  ['playtest-v2/transport-shortcut-committed-valid.json', [true, null]],
  ['playtest-v2/fertilizer-use-committed-valid.json', [true, null]],
  ['playtest-v2/accept-debt-with-schedule-action-rejected.json', [false, 'V2_OPTION_ACTION_MISMATCH']],
  ['playtest-v2/decline-study-accepted-payload-rejected.json', [false, 'V2_OPTION_ACTION_MISMATCH']],
  ['playtest-v2/food-shift-with-shortfall-action-rejected.json', [false, 'V2_OPTION_ACTION_MISMATCH']],
  ['playtest-v2/legacy-food-intent-split-rejected.json', [false, 'V2_LEGACY_GROUP_CONTRACT']],
  ['playtest-v2/food-projection-repair-rejected.json', [false, 'V2_OPTION_PROJECTION_MISMATCH']],
  ['playtest-v2/repair-projection-food-unresolved-rejected.json', [false, 'V2_OPTION_PROJECTION_MISMATCH']],
  ['playtest-v2/study-projection-other-member-rejected.json', [false, 'V2_OPTION_PROJECTION_MISMATCH']],
  ['playtest-v2/schedule-object-consequence-mismatch-rejected.json', [false, 'V2_CONSEQUENCE_OBJECT_MISMATCH']],
  ['playtest-v2/only-noncore-consequence-rejected.json', [false, 'V2_REQUIRED_CONSEQUENCE_MISSING']],
  ['playtest-v2/schedule-outcome-hash-mismatch-rejected.json', [false, 'V2_COMMITMENT_NOT_QUALIFIED']],
])
const declaredFixtureFiles = new Set(
  expectations.fixtures.map((expectation) => expectation?.file),
)
const declaredPlaytestFixtureCount = [...declaredFixtureFiles].filter(
  (path) =>
    path?.startsWith('playtest-v1/') ||
    path?.startsWith('playtest-v2/'),
).length
if (declaredPlaytestFixtureCount < 20) {
  failures.push(
    `playtest fixture 少于 20：${declaredPlaytestFixtureCount}`,
  )
}
for (const requiredFile of requiredFixtureFiles) {
  if (!declaredFixtureFiles.has(requiredFile)) {
    failures.push(`缺少必需 fixture：${requiredFile}`)
  }
}
if (expectations.fixtures.length !== REQUIRED_FIXTURE_OUTCOMES.size) {
  failures.push(
    `fixture outcome 矩阵数量不符：expected=${REQUIRED_FIXTURE_OUTCOMES.size} actual=${expectations.fixtures.length}`,
  )
}
for (const [requiredFile, [accepted, errorCode]] of REQUIRED_FIXTURE_OUTCOMES) {
  const expectation = expectations.fixtures.find(
    (candidate) => candidate?.file === requiredFile,
  )
  if (!expectation) {
    failures.push(`缺少固定 outcome fixture：${requiredFile}`)
    continue
  }
  if (
    expectation.assertions?.accepted !== accepted ||
    expectation.assertions?.errorCode !== errorCode
  ) {
    failures.push(
      `${requiredFile} 固定 outcome 不符：expected=${JSON.stringify([accepted, errorCode])} actual=${JSON.stringify([expectation.assertions?.accepted, expectation.assertions?.errorCode])}`,
    )
  }
}

for (const expectation of expectations.fixtures) {
  if (
    !isRecord(expectation) ||
    typeof expectation.file !== 'string' ||
    !isRecord(expectation.assertions) ||
    typeof expectation.assertions.accepted !== 'boolean' ||
    !Object.hasOwn(expectation.assertions, 'errorCode')
  ) {
    failures.push('fixture expectation 结构无效')
    continue
  }
  const fixturePath = join(fixturesRoot, expectation.file)
  let fixture
  try {
    fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  } catch {
    failures.push(`${expectation.file} JSON_READ_OR_PARSE`)
    continue
  }
  if (listedFiles.has(resolve(fixturePath))) {
    failures.push(`重复登记 fixture：${expectation.file}`)
    continue
  }
  listedFiles.add(resolve(fixturePath))
  if (fixtureIds.has(fixture.fixtureId)) {
    failures.push(`重复 fixtureId：${fixture.fixtureId}`)
    continue
  }
  fixtureIds.add(fixture.fixtureId)
  const requiredAssertionKeys = (() => {
    if (expectation.assertions.accepted !== true) return []
    if (fixture.kind === 'playtest-export') {
      return [
        'schemaVersion',
        'candidateEditCount',
        'candidateEditGroupIds',
        'candidateManagementCount',
        'candidateManagementGroupIds',
        'committedCount',
        'decisionHashes',
      ]
    }
    if (
      fixture.kind === 'decision-hash-case' ||
      fixture.kind === 'outcome-fingerprint-case'
    ) {
      return ['hashes', 'relations']
    }
    if (fixture.kind === 'comparison-state') {
      return ['authorityMutationCount', 'availableOptionCount']
    }
    if (fixture.kind === 'dominance-case') {
      return ['dominanceStatus']
    }
    if (fixture.kind === 'fertilizer-lifecycle') {
      return ['appliedWeekIndex', 'remainingUnits', 'weekBonuses']
    }
    if (fixture.kind === 'candidate-manifest') {
      return ['candidateManifestId', 'candidateAttempt']
    }
    return []
  })()
  for (const key of requiredAssertionKeys) {
    if (!Object.hasOwn(expectation.assertions, key)) {
      failures.push(`${expectation.file} 缺少必需断言：${key}`)
    }
  }
  const result = validateFixture(fixture)
  for (const [key, expected] of Object.entries(expectation.assertions)) {
    const actual = assertionValue(result, key)
    if (!sameJson(actual, expected)) {
      failures.push(
        `${expectation.file} ${key}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
      )
    }
  }
}

async function collectJsonFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectJsonFiles(path))
    if (entry.isFile() && entry.name.endsWith('.json')) files.push(resolve(path))
  }
  return files
}

const ignored = new Set([resolve(expectationsPath)])
const allFixtureFiles = (await collectJsonFiles(fixturesRoot)).filter(
  (path) => !ignored.has(path),
)
for (const path of allFixtureFiles) {
  if (!listedFiles.has(path)) {
    failures.push(`未登记 fixture：${relative(fixturesRoot, path)}`)
  }
}
for (const path of listedFiles) {
  if (!allFixtureFiles.includes(path)) {
    failures.push(`expectation 指向不存在或非 JSON fixture：${relative(fixturesRoot, path)}`)
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    `schema fixtures PASS: ${expectations.fixtures.length} cases, contract=${expectations.contractVersion}`,
  )
}
