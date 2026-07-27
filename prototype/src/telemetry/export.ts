import {
  gate1WeekOneScenario as scenario,
  getGate1ChoiceSetOracle,
  type Gate1ChoiceSetId,
} from '../scenario/gate1-week-one'
import type {
  PlayerAction,
  PlayerActionEnvelope,
  SimulationState,
} from '../sim/model'
import { weekIndexForTick } from '../sim/week-phase'
import type { SessionRecorder } from './session'
import { stableStateHash } from './session'
import {
  LIN_HE_STUDY_BLOCK_ID,
  PUMP_MAINTENANCE_BLOCK_ID,
  RECOVERY_ALLOCATION_BLOCK_ID,
  blockEndTick,
  parseBlockId,
  resolveScheduleBlock,
} from '../sim/schedule'
import { sha256Canonical } from '../sim/canonical-hash'

const MAX_BLOCKED_REASON_LENGTH = 240
const LIN_HE_INTENT_ID = 'w1:character-request:lin-he-study'
const FOOD_INTENT_ID = 'w0:food-plan'
const FOOD_SCHEDULE_BLOCK_ID = 'qiao-pan:d1:b1'
const REPAIR_INTENT_ID =
  'w0:repair-responsibility:pump-incident-day-3'
const REPAIR_SCHEDULE_DEFAULT_ACTIVITY: Readonly<
  Record<string, string>
> = {
  'qiao-pan:d3:b2': 'rest',
  'chen-du:d3:b0': 'food',
  'su-ji:d3:b0': 'logistics',
}

type ExportedV2Action =
  | {
      id: string
      type: 'EDIT_SCHEDULE'
      memberId: string
      dayIndex: number
      blockId: string
      fromActivity: string
      toActivity: string
      responsibility?: 'scheduled'
    }
  | {
      id: string
      type: 'RESOLVE_LIN_HE_REQUEST'
      resolution: 'accepted'
      memberId: 'lin-he'
      dayIndex: 8
      blockId: string
      fromActivity: string
      toActivity: string
    }
  | {
      id: string
      type: 'RESOLVE_LIN_HE_REQUEST'
      resolution: 'declined'
      persistentCharacterRecord: true
    }
  | {
      id: string
      type: 'SET_FOOD_SHORTFALL_ACCEPTED'
      accepted: boolean
    }
  | {
      id: string
      type: 'SELECT_REPAIR_RESPONSIBILITY'
      responsible: string
      scheduleConfirmed: false
    }
  | { id: string; type: 'ACCEPT_REPAIR_DEBT' }
  | {
      id: string
      type: 'OPEN_TRANSPORT_SHORTCUT' | 'USE_FERTILIZER'
      atTick: number
      weekIndex: 0 | 1
    }
  | { id: string; type: 'UNDO'; revertsActionId: string }
  | { id: string; type: 'SET_PAUSED'; paused: boolean }
  | { id: string; type: 'CONTINUE_TO_NEXT_WEEK' }
  | {
      id: string
      type: 'COMMIT_MANAGEMENT_CHOICE'
      opportunityId: string
      choiceSetId: string
      candidateId: string
      stateRevision: number
      projectionBaseHash: string
      candidateProjectionHash: string
      idempotencyKey: string
      commitCause: 'explicit-candidate-action'
    }

function decisionHash(decisionIntentId: string, projection: unknown) {
  return sha256Canonical({ decisionIntentId, projection })
}

function oracleChoiceSet(
  choiceSetId: Gate1ChoiceSetId,
  selectedOptionId: string | null,
  reachableByOption: Readonly<Record<string, boolean>> = {},
) {
  const oracle = getGate1ChoiceSetOracle(choiceSetId)
  return {
    choiceSetId: oracle.choiceSetId,
    decisionIntentId: oracle.decisionIntentId,
    options: oracle.options.map((option) => ({
      optionId: option.optionId,
      reachable: reachableByOption[option.optionId] ?? true,
      visibleConsequenceRefs: option.visibleConsequenceRefs,
      dominanceStatus: option.dominanceStatus,
    })),
    selectedOptionId,
  }
}

function linHeChoiceSet(selectedOptionId: string | null) {
  return oracleChoiceSet(
    'choice:w1:lin-he-study',
    selectedOptionId,
  )
}

function foodChoiceSet(
  selectedOptionId: string | null,
  scheduleOptionReachable: boolean,
) {
  return oracleChoiceSet(
    'choice:w0:food-plan',
    selectedOptionId,
    { 'food-shift-qiao': scheduleOptionReachable },
  )
}

function repairChoiceSet(selectedOptionId: string | null) {
  return oracleChoiceSet(
    'choice:w0:pump-repair',
    selectedOptionId,
  )
}

function transportChoiceSet(weekIndex: 0 | 1) {
  return oracleChoiceSet(
    `choice:w${weekIndex}:transport-route`,
    'south-shortcut',
  )
}

function fertilizerChoiceSet(weekIndex: 0 | 1) {
  return oracleChoiceSet(
    `choice:w${weekIndex}:fertilizer`,
    'use-fertilizer',
  )
}

function createV2Export(
  recorder: SessionRecorder,
  state: SimulationState,
  epochNow: number,
  monotonicNow: number,
  blockedReason?: string,
) {
  const isV03 =
    state.managementChoices.authority !== null
  const requestTransitions = recorder.playerTransitions.filter(
    ({ envelope }) =>
      envelope.action.type === 'RESOLVE_LIN_HE_REQUEST',
  )
  const foodTransitions = recorder.playerTransitions.filter(
    ({ envelope }) =>
      envelope.action.type === 'SET_FOOD_SHORTFALL_ACCEPTED' &&
      weekIndexForTick(envelope.atTick, scenario) === 0,
  )
  const foodScheduleTransitions = recorder.playerTransitions.filter(
    ({ envelope, before, after }) =>
      (envelope.action.type === 'EDIT_SCHEDULE' ||
        envelope.action.type === 'COPY_DAY' ||
        envelope.action.type === 'CHANGE_ACTIVITY') &&
      envelope.affectedBlockIds.includes(FOOD_SCHEDULE_BLOCK_ID) &&
      resolveScheduleBlock(before, FOOD_SCHEDULE_BLOCK_ID)
        .activity !==
        resolveScheduleBlock(after, FOOD_SCHEDULE_BLOCK_ID)
          .activity,
  )
  const foodScheduleRuntimeActionIds = new Set(
    foodScheduleTransitions.map(({ envelope }) => envelope.id),
  )
  const foodUndoTransitions = recorder.playerTransitions.filter(
    ({ envelope }) =>
      envelope.action.type === 'UNDO_SCHEDULE' &&
      envelope.undoOfActionId !== undefined &&
      foodScheduleRuntimeActionIds.has(envelope.undoOfActionId),
  )
  const foodScheduleOptionStarted =
    foodScheduleTransitions.length > 0 &&
    resolveScheduleBlock(
      foodScheduleTransitions[0].before,
      FOOD_SCHEDULE_BLOCK_ID,
    ).activity === 'repair' &&
    resolveScheduleBlock(
      foodScheduleTransitions[0].after,
      FOOD_SCHEDULE_BLOCK_ID,
    ).activity === 'food'
  const foodIntentTransitions = recorder.playerTransitions.filter(
    (transition) =>
      foodTransitions.includes(transition) ||
      (
        foodScheduleOptionStarted &&
        (
          foodScheduleTransitions.includes(transition) ||
          foodUndoTransitions.includes(transition)
        )
      ),
  )
  const repairScheduleTransitions = recorder.playerTransitions.filter(
    ({ envelope, before, after }) => {
      const assignment = after.repairResponsibilityAssignment
      return (
        (envelope.action.type === 'EDIT_SCHEDULE' ||
          envelope.action.type === 'COPY_DAY') &&
        after.repairResponsibility === 'scheduled' &&
        assignment?.actionId === envelope.id &&
        resolveScheduleBlock(before, assignment.blockId).activity ===
          REPAIR_SCHEDULE_DEFAULT_ACTIVITY[assignment.blockId]
      )
    },
  )
  const repairScheduleRuntimeActionIds = new Set(
    repairScheduleTransitions.map(({ envelope }) => envelope.id),
  )
  const repairBlockIds = [
    ...new Set(
      repairScheduleTransitions.flatMap(({ after }) => {
        const blockId =
          after.repairResponsibilityAssignment?.blockId
        return blockId === undefined ? [] : [blockId]
      }),
    ),
  ]
  const repairRelatedScheduleTransitions =
    recorder.playerTransitions.filter(
      ({ envelope, before, after }) =>
        (envelope.action.type === 'EDIT_SCHEDULE' ||
          envelope.action.type === 'COPY_DAY') &&
        envelope.affectedBlockIds.some(
          (blockId) =>
            repairBlockIds.includes(blockId) &&
            resolveScheduleBlock(before, blockId).activity !==
              resolveScheduleBlock(after, blockId).activity,
        ),
    )
  for (const { envelope } of repairRelatedScheduleTransitions) {
    repairScheduleRuntimeActionIds.add(envelope.id)
  }
  const repairUndoTransitions = recorder.playerTransitions.filter(
    ({ envelope }) =>
      envelope.action.type === 'UNDO_SCHEDULE' &&
      envelope.undoOfActionId !== undefined &&
      repairScheduleRuntimeActionIds.has(envelope.undoOfActionId),
  )
  const repairIntentTransitions = recorder.playerTransitions.filter(
    (transition) =>
      repairRelatedScheduleTransitions.includes(transition) ||
      repairUndoTransitions.includes(transition),
  )
  const repairDebtTransitions = recorder.playerTransitions.filter(
    ({ envelope }) =>
      envelope.action.type === 'ACCEPT_REPAIR_DEBT',
  )
  const transportTransitions = recorder.playerTransitions.filter(
    ({ envelope }) =>
      envelope.action.type === 'OPEN_TRANSPORT_SHORTCUT',
  )
  const fertilizerTransitions = recorder.playerTransitions.filter(
    ({ envelope }) =>
      envelope.action.type === 'USE_FERTILIZER',
  )
  if (transportTransitions.length > 1) {
    throw new Error('同一份导出不能重复开启运输捷径')
  }
  if (fertilizerTransitions.length > 1) {
    throw new Error('同一份导出不能重复使用化肥')
  }
  const actions = recorder.playerTransitions.flatMap<ExportedV2Action>(
    ({ envelope, before, after }) => {
      if (
        envelope.action.type ===
        'COMMIT_MANAGEMENT_CHOICE'
      ) {
        const { request } = envelope.action
        return [
          {
            id: envelope.id,
            type: 'COMMIT_MANAGEMENT_CHOICE' as const,
            opportunityId: request.opportunityId,
            choiceSetId: request.choiceSetId,
            candidateId: request.candidateId,
            stateRevision: request.stateRevision,
            projectionBaseHash:
              request.projectionBaseHash,
            candidateProjectionHash:
              request.candidateProjectionHash,
            idempotencyKey: request.idempotencyKey,
            commitCause: request.commitCause,
          },
        ]
      }
      if (envelope.action.type === 'RESOLVE_LIN_HE_REQUEST') {
        return [
          envelope.action.decision === 'accepted'
            ? {
                id: envelope.id,
                type: 'RESOLVE_LIN_HE_REQUEST' as const,
                resolution: 'accepted' as const,
                memberId: 'lin-he',
                dayIndex: 8,
                blockId: LIN_HE_STUDY_BLOCK_ID,
                fromActivity: resolveScheduleBlock(
                  before,
                  LIN_HE_STUDY_BLOCK_ID,
                ).activity,
                toActivity: resolveScheduleBlock(
                  after,
                  LIN_HE_STUDY_BLOCK_ID,
                ).activity,
              }
            : {
                id: envelope.id,
                type: 'RESOLVE_LIN_HE_REQUEST' as const,
                resolution: 'declined' as const,
                persistentCharacterRecord: true,
              },
        ]
      }
      if (envelope.action.type === 'SET_FOOD_SHORTFALL_ACCEPTED') {
        return [
          {
            id: envelope.id,
            type: 'SET_FOOD_SHORTFALL_ACCEPTED' as const,
            accepted: envelope.action.accepted,
          },
        ]
      }
      if (
        envelope.action.type === 'EDIT_SCHEDULE' ||
        envelope.action.type === 'COPY_DAY' ||
        envelope.action.type === 'CHANGE_ACTIVITY'
      ) {
        const changedBlockIds = envelope.affectedBlockIds.filter(
          (blockId) =>
            resolveScheduleBlock(before, blockId).activity !==
            resolveScheduleBlock(after, blockId).activity,
        )
        return changedBlockIds.map((blockId, index) => {
          const { characterId, dayIndex } = parseBlockId(blockId)
          const responsibility =
            after.repairResponsibility === 'scheduled' &&
            after.repairResponsibilityAssignment?.actionId ===
              envelope.id &&
            after.repairResponsibilityAssignment.blockId === blockId
              ? ('scheduled' as const)
              : undefined
          return {
            id:
              changedBlockIds.length === 1
                ? envelope.id
                : `${envelope.id}:${index + 1}`,
            type: 'EDIT_SCHEDULE' as const,
            memberId: characterId,
            dayIndex,
            blockId,
            fromActivity: resolveScheduleBlock(before, blockId)
              .activity,
            toActivity: resolveScheduleBlock(after, blockId).activity,
            ...(responsibility === undefined
              ? {}
              : { responsibility }),
          }
        })
      }
      if (
        envelope.action.type ===
        'SELECT_REPAIR_RESPONSIBILITY'
      ) {
        return [
          {
            id: envelope.id,
            type: 'SELECT_REPAIR_RESPONSIBILITY' as const,
            responsible: envelope.action.responsible,
            scheduleConfirmed: false,
          },
        ]
      }
      if (envelope.action.type === 'ACCEPT_REPAIR_DEBT') {
        return [
          {
            id: envelope.id,
            type: 'ACCEPT_REPAIR_DEBT' as const,
          },
        ]
      }
      if (envelope.action.type === 'OPEN_TRANSPORT_SHORTCUT') {
        return [
          {
            id: envelope.id,
            type: 'OPEN_TRANSPORT_SHORTCUT' as const,
            atTick: envelope.atTick,
            weekIndex: weekIndexForTick(envelope.atTick, scenario),
          },
        ]
      }
      if (envelope.action.type === 'USE_FERTILIZER') {
        return [
          {
            id: envelope.id,
            type: 'USE_FERTILIZER' as const,
            atTick: envelope.atTick,
            weekIndex: weekIndexForTick(envelope.atTick, scenario),
          },
        ]
      }
      if (
        envelope.action.type === 'UNDO_SCHEDULE' &&
        envelope.undoOfActionId !== undefined
      ) {
        const target = recorder.playerTransitions.find(
          ({ envelope: candidate }) =>
            candidate.id === envelope.undoOfActionId,
        )
        const revertedBlockIds =
          target?.envelope.affectedBlockIds.filter(
            (blockId) =>
              resolveScheduleBlock(target.before, blockId)
                .activity !==
              resolveScheduleBlock(target.after, blockId).activity,
          ) ?? []
        return revertedBlockIds.map((_, index) => ({
          id:
            revertedBlockIds.length === 1
              ? envelope.id
              : `${envelope.id}:${index + 1}`,
          type: 'UNDO' as const,
          revertsActionId:
            revertedBlockIds.length === 1
              ? envelope.undoOfActionId!
              : `${envelope.undoOfActionId}:${index + 1}`,
        }))
      }
      if (envelope.action.type === 'SET_PAUSED') {
        return [
          {
            id: envelope.id,
            type: 'SET_PAUSED' as const,
            paused: envelope.action.paused,
          },
        ]
      }
      if (envelope.action.type === 'CONTINUE_TO_NEXT_WEEK') {
        return [
          {
            id: envelope.id,
            type: 'CONTINUE_TO_NEXT_WEEK' as const,
          },
        ]
      }
      return []
    },
  )
  const acceptedActionIds = actions
    .filter(
      (action) =>
        action.type === 'RESOLVE_LIN_HE_REQUEST' &&
        action.resolution === 'accepted',
    )
    .map((action) => action.id)
  const foodScheduleActionIds = actions
    .filter(
      (action) =>
        (action.type === 'EDIT_SCHEDULE' &&
          action.blockId === FOOD_SCHEDULE_BLOCK_ID) ||
        (action.type === 'UNDO' &&
          actions.some(
            (target) =>
              target.id === action.revertsActionId &&
              target.type === 'EDIT_SCHEDULE' &&
              target.blockId === FOOD_SCHEDULE_BLOCK_ID,
          )),
    )
    .map((action) => action.id)
  const candidateEditGroups = [
    ...(foodScheduleActionIds.length === 0
      ? []
      : [
          {
            groupId: 'legacy:w0:food-plan',
            actionIds: foodScheduleActionIds,
          },
        ]),
    ...(acceptedActionIds.length === 0
      ? []
      : [
          {
            groupId: 'legacy:w1:lin-he-study',
            actionIds: acceptedActionIds,
          },
        ]),
    ...transportTransitions.map(({ envelope }) => {
      const weekIndex = weekIndexForTick(envelope.atTick, scenario)
      return {
        groupId: `legacy:w${weekIndex}:transport-route`,
        actionIds: [envelope.id],
      }
    }),
  ]
  const firstRequest = requestTransitions[0]
  const lastRequest = requestTransitions.at(-1)
  const selectedOptionId =
    lastRequest?.envelope.action.type === 'RESOLVE_LIN_HE_REQUEST'
      ? lastRequest.envelope.action.decision === 'accepted'
        ? 'accept-study'
        : 'decline-study'
      : null
  const firstFoodTransition = foodIntentTransitions[0]
  const lastFoodTransition = foodIntentTransitions.at(-1)
  const foodScheduleSelected =
    foodScheduleOptionStarted &&
    lastFoodTransition !== undefined &&
    resolveScheduleBlock(
      lastFoodTransition.after,
      FOOD_SCHEDULE_BLOCK_ID,
    ).activity === 'food'
  const foodShortfallSelected =
    lastFoodTransition?.after.acceptedFoodShortfall === true
  const foodOptionsConflict =
    foodShortfallSelected && foodScheduleSelected
  const foodScheduleHasSupportedFinal =
    !foodScheduleOptionStarted ||
    lastFoodTransition === undefined ||
    ['repair', 'food'].includes(
      resolveScheduleBlock(
        lastFoodTransition.after,
        FOOD_SCHEDULE_BLOCK_ID,
      ).activity,
    )
  const selectedFoodOptionId = foodOptionsConflict
    ? null
    : foodShortfallSelected
      ? 'accept-food-gap'
      : foodScheduleSelected
        ? 'food-shift-qiao'
        : null
  const foodScheduleOptionReachable =
    firstFoodTransition !== undefined &&
    firstFoodTransition.before.currentTick <
      blockEndTick(FOOD_SCHEDULE_BLOCK_ID)
  const choiceSets = [
    ...(firstRequest === undefined
      ? []
      : [linHeChoiceSet(selectedOptionId)]),
    ...(lastFoodTransition === undefined
      ? []
      : [
          foodChoiceSet(
            selectedFoodOptionId,
            foodScheduleOptionReachable,
          ),
        ]),
    ...(repairScheduleTransitions.length === 0 &&
    repairDebtTransitions.length === 0
      ? []
      : [
          repairChoiceSet(
            repairDebtTransitions.length > 0
              ? 'accept-debt'
              : repairIntentTransitions.at(-1)?.after
                    .repairResponsibility === 'scheduled'
                ? 'schedule-repair'
                : null,
          ),
        ]),
    ...transportTransitions.map(({ envelope }) =>
      transportChoiceSet(
        weekIndexForTick(envelope.atTick, scenario),
      ),
    ),
    ...fertilizerTransitions.map(({ envelope }) =>
      fertilizerChoiceSet(
        weekIndexForTick(envelope.atTick, scenario),
      ),
    ),
  ]
  const requestCommitmentGroups =
    firstRequest === undefined || lastRequest === undefined
      ? []
      : (() => {
          const beforeProjection = {
            resolution: firstRequest.before.linHeRequestDecision,
            scheduleCells: [
              `${LIN_HE_STUDY_BLOCK_ID}=${resolveScheduleBlock(
                firstRequest.before,
                LIN_HE_STUDY_BLOCK_ID,
              ).activity}`,
            ],
          }
          const finalProjection = {
            resolution: lastRequest.after.linHeRequestDecision,
            scheduleCells: [
              `${LIN_HE_STUDY_BLOCK_ID}=${resolveScheduleBlock(
                lastRequest.after,
                LIN_HE_STUDY_BLOCK_ID,
              ).activity}`,
            ],
            characterRecord: {
              linHeStudy: lastRequest.after.linHeRequestDecision,
            },
          }
          const accepted = selectedOptionId === 'accept-study'
          return [
            {
              decisionIntentId: LIN_HE_INTENT_ID,
              choiceSetId: 'choice:w1:lin-he-study',
              weekIndex: 1 as const,
              problemCategory: 'character-request' as const,
              actionIds: actions
                .filter(
                  (action) =>
                    action.type ===
                    'RESOLVE_LIN_HE_REQUEST',
                )
                .map((action) => action.id),
              consequenceRefs: accepted
                ? [
                    {
                      kind: 'schedule' as const,
                      id: LIN_HE_STUDY_BLOCK_ID,
                    },
                    {
                      kind: 'character-record' as const,
                      id: 'lin-he-study',
                    },
                  ]
                : [
                    {
                      kind: 'character-record' as const,
                      id: 'lin-he-study-declined',
                    },
                  ],
              beforeDecisionStateHash: decisionHash(
                LIN_HE_INTENT_ID,
                beforeProjection,
              ),
              finalDecisionStateHash: decisionHash(
                LIN_HE_INTENT_ID,
                finalProjection,
              ),
              finalOutcomeCode: `committed:${selectedOptionId}`,
              finalDisposition: 'committed' as const,
            },
          ]
        })()
  const foodCommitmentGroups =
    firstFoodTransition === undefined ||
    lastFoodTransition === undefined ||
    !foodScheduleOptionReachable ||
    foodOptionsConflict ||
    !foodScheduleHasSupportedFinal
      ? []
      : (() => {
          const hasFoodShortfallAction = foodTransitions.length > 0
          const hasFoodScheduleAction = foodScheduleOptionStarted
          const beforeProjection = {
            ...(hasFoodScheduleAction
              ? {
                  scheduleCells: [
                    `${FOOD_SCHEDULE_BLOCK_ID}=${resolveScheduleBlock(
                      firstFoodTransition.before,
                      FOOD_SCHEDULE_BLOCK_ID,
                    ).activity}`,
                  ],
                }
              : {}),
            ...(hasFoodShortfallAction
              ? {
                  foodShortfallAccepted:
                    firstFoodTransition.before
                      .acceptedFoodShortfall,
                }
              : {}),
          }
          const finalProjection = {
            ...(hasFoodScheduleAction
              ? {
                  scheduleCells: [
                    `${FOOD_SCHEDULE_BLOCK_ID}=${resolveScheduleBlock(
                      lastFoodTransition.after,
                      FOOD_SCHEDULE_BLOCK_ID,
                    ).activity}`,
                  ],
                }
              : {}),
            ...(hasFoodShortfallAction
              ? {
                  foodShortfallAccepted:
                    lastFoodTransition.after.acceptedFoodShortfall,
                }
              : {}),
          }
          const beforeHash = decisionHash(
            FOOD_INTENT_ID,
            beforeProjection,
          )
          const finalHash = decisionHash(
            FOOD_INTENT_ID,
            finalProjection,
          )
          const reverted = beforeHash === finalHash
          const foodActionIds = actions
            .filter(
              (action) =>
                action.type ===
                  'SET_FOOD_SHORTFALL_ACCEPTED' ||
                (
                  foodScheduleOptionStarted &&
                  (
                    (action.type === 'EDIT_SCHEDULE' &&
                      action.blockId === FOOD_SCHEDULE_BLOCK_ID) ||
                    (action.type === 'UNDO' &&
                      actions.some(
                        (target) =>
                          target.id === action.revertsActionId &&
                          target.type === 'EDIT_SCHEDULE' &&
                          target.blockId ===
                            FOOD_SCHEDULE_BLOCK_ID,
                      ))
                  )
                ),
            )
            .map((action) => action.id)
          return [
            {
              decisionIntentId: FOOD_INTENT_ID,
              choiceSetId: 'choice:w0:food-plan',
              weekIndex: 0 as const,
              problemCategory: 'food' as const,
              actionIds: foodActionIds,
              consequenceRefs:
                hasFoodScheduleAction && !reverted
                  ? [
                      {
                        kind: 'schedule' as const,
                        id: FOOD_SCHEDULE_BLOCK_ID,
                      },
                      {
                        kind: 'forecast' as const,
                        id: 'w0:food',
                      },
                      {
                        kind: 'forecast' as const,
                        id: 'w0:repair',
                      },
                    ]
                  : hasFoodScheduleAction
                    ? [
                        {
                          kind: 'schedule' as const,
                          id: FOOD_SCHEDULE_BLOCK_ID,
                        },
                      ]
                    : reverted
                ? [
                    {
                      kind: 'forecast' as const,
                      id: 'w0:food',
                    },
                  ]
                : [
                    {
                      kind: 'forecast' as const,
                      id: 'w0:food',
                    },
                    {
                      kind: 'forecast' as const,
                      id: 'w0:repair',
                    },
                  ],
              beforeDecisionStateHash: beforeHash,
              finalDecisionStateHash: finalHash,
              finalOutcomeCode: reverted
                ? 'reverted'
                : selectedFoodOptionId === 'food-shift-qiao'
                  ? `committed:schedule:${finalHash}`
                  : 'committed:accept-food-gap',
              finalDisposition: reverted
                ? ('reverted' as const)
                : ('committed' as const),
            },
          ]
        })()
  const firstRepairSchedule = repairScheduleTransitions[0]
  const firstRepairIntent = repairIntentTransitions[0]
  const lastRepairIntent = repairIntentTransitions.at(-1)
  const repairCommitmentGroups =
    firstRepairSchedule === undefined ||
    firstRepairIntent === undefined ||
    lastRepairIntent === undefined
      ? []
      : (() => {
          const beforeProjection = {
            repairResponsibility:
              firstRepairIntent.before.repairResponsibility,
            scheduleCells: repairBlockIds.map(
              (blockId) =>
                `${blockId}=${resolveScheduleBlock(
                  firstRepairIntent.before,
                  blockId,
                ).activity}`,
            ),
          }
          const finalProjection = {
            repairResponsibility:
              lastRepairIntent.after.repairResponsibility,
            scheduleCells: repairBlockIds.map(
              (blockId) =>
                `${blockId}=${resolveScheduleBlock(
                  lastRepairIntent.after,
                  blockId,
                ).activity}`,
            ),
          }
          const beforeHash = decisionHash(
            REPAIR_INTENT_ID,
            beforeProjection,
          )
          const finalHash = decisionHash(
            REPAIR_INTENT_ID,
            finalProjection,
          )
          const reverted = beforeHash === finalHash
          if (
            !reverted &&
            lastRepairIntent.after.repairResponsibility !==
              'scheduled'
          ) {
            return []
          }
          const finalRepairBlockId =
            lastRepairIntent.after.repairResponsibilityAssignment
              ?.blockId
          const repairActionIds = actions
            .filter(
              (action) =>
                (action.type === 'EDIT_SCHEDULE' &&
                  repairBlockIds.includes(action.blockId)) ||
                (action.type === 'UNDO' &&
                  actions.some(
                    (target) =>
                      target.id === action.revertsActionId &&
                      target.type === 'EDIT_SCHEDULE' &&
                      repairBlockIds.includes(target.blockId),
                  )),
            )
            .map((action) => action.id)
          return [
            {
              decisionIntentId: REPAIR_INTENT_ID,
              choiceSetId: 'choice:w0:pump-repair',
              weekIndex: 0 as const,
              problemCategory: 'repair' as const,
              actionIds: repairActionIds,
              consequenceRefs: reverted
                ? repairBlockIds.map((blockId) => ({
                    kind: 'schedule' as const,
                    id: blockId,
                  }))
                : finalRepairBlockId === undefined
                  ? []
                  : [
                    {
                      kind: 'forecast' as const,
                      id: 'w0:repair',
                    },
                    {
                      kind: 'risk' as const,
                      id: 'pump',
                    },
                    {
                      kind: 'schedule' as const,
                      id: finalRepairBlockId,
                    },
                  ],
              beforeDecisionStateHash: beforeHash,
              finalDecisionStateHash: finalHash,
              finalOutcomeCode: reverted
                ? 'reverted'
                : 'committed:schedule-repair',
              finalDisposition: reverted
                ? ('reverted' as const)
                : ('committed' as const),
            },
          ]
        })()
  const firstRepairDebt = repairDebtTransitions[0]
  const lastRepairDebt = repairDebtTransitions.at(-1)
  const repairDebtCommitmentGroups =
    firstRepairDebt === undefined || lastRepairDebt === undefined
      ? []
      : (() => {
          const beforeProjection = {
            repairResponsibility:
              firstRepairDebt.before.repairResponsibility,
            repairDebt: null,
          }
          const finalDebt = lastRepairDebt.after.repairDebt
          const finalProjection = {
            repairResponsibility:
              lastRepairDebt.after.repairResponsibility,
            repairDebt:
              finalDebt === null
                ? null
                : {
                    dueTick: finalDebt.dueTick,
                    weeklyPenalty: finalDebt.weeklyPenalty,
                  },
          }
          return [
            {
              decisionIntentId: REPAIR_INTENT_ID,
              choiceSetId: 'choice:w0:pump-repair',
              weekIndex: 0 as const,
              problemCategory: 'repair' as const,
              actionIds: repairDebtTransitions.map(
                ({ envelope }) => envelope.id,
              ),
              consequenceRefs: [
                {
                  kind: 'risk' as const,
                  id: 'repair-debt',
                },
                {
                  kind: 'recap' as const,
                  id: 'w0:repair',
                },
              ],
              beforeDecisionStateHash: decisionHash(
                REPAIR_INTENT_ID,
                beforeProjection,
              ),
              finalDecisionStateHash: decisionHash(
                REPAIR_INTENT_ID,
                finalProjection,
              ),
              finalOutcomeCode: 'committed:accept-debt',
              finalDisposition: 'committed' as const,
            },
          ]
        })()
  const transportCommitmentGroups = transportTransitions.map(
    ({ envelope, before, after }) => {
      const weekIndex = weekIndexForTick(envelope.atTick, scenario)
      const decisionIntentId = `w${weekIndex}:transport-route`
      return {
        decisionIntentId,
        choiceSetId: `choice:w${weekIndex}:transport-route`,
        weekIndex,
        problemCategory: 'transport' as const,
        actionIds: [envelope.id],
        consequenceRefs: [
          {
            kind: 'forecast' as const,
            id: `w${weekIndex}:food`,
          },
          {
            kind: 'risk' as const,
            id: `w${weekIndex}:transport-loss`,
          },
        ],
        beforeDecisionStateHash: decisionHash(
          decisionIntentId,
          {
            transportRoute: before.transportRouteId,
          },
        ),
        finalDecisionStateHash: decisionHash(
          decisionIntentId,
          {
            transportRoute: after.transportRouteId,
          },
        ),
        finalOutcomeCode: 'committed:south-shortcut',
        finalDisposition: 'committed' as const,
      }
    },
  )
  const fertilizerCommitmentGroups = fertilizerTransitions.map(
    ({ envelope, before, after }) => {
      const weekIndex = weekIndexForTick(envelope.atTick, scenario)
      const decisionIntentId =
        `w${weekIndex}:asset-use:fertilizer`
      return {
        decisionIntentId,
        choiceSetId: `choice:w${weekIndex}:fertilizer`,
        weekIndex,
        problemCategory: 'asset-use' as const,
        actionIds: [envelope.id],
        consequenceRefs: [
          {
            kind: 'forecast' as const,
            id: `w${weekIndex}:food`,
          },
          {
            kind: 'inventory' as const,
            id: 'fertilizer',
          },
        ],
        beforeDecisionStateHash: decisionHash(
          decisionIntentId,
          {
            fertilizer: {
              remainingUnits: before.fertilizer.remainingUnits,
              appliedWeekIndex:
                before.fertilizer.appliedWeekIndex,
            },
          },
        ),
        finalDecisionStateHash: decisionHash(
          decisionIntentId,
          {
            fertilizer: {
              remainingUnits: after.fertilizer.remainingUnits,
              appliedWeekIndex:
                after.fertilizer.appliedWeekIndex,
            },
          },
        ),
        finalOutcomeCode: 'committed:use-fertilizer',
        finalDisposition: 'committed' as const,
      }
    },
  )
  const legacyCandidateManagementCommitmentGroups = [
    ...foodCommitmentGroups,
    ...(repairDebtCommitmentGroups.length > 0
      ? repairDebtCommitmentGroups
      : repairCommitmentGroups),
    ...requestCommitmentGroups,
    ...transportCommitmentGroups,
    ...fertilizerCommitmentGroups,
  ]
  const managementCommitmentGroupsV03 =
    state.managementChoices.commitments.map(
      (commitment) => {
        const action = state.actionLog.find(
          (entry) =>
            entry.sequence ===
            commitment.committedAtSequence,
        )
        if (
          action?.action.type !==
          'COMMIT_MANAGEMENT_CHOICE'
        ) {
          throw new Error(
            `Management commitment ${commitment.opportunityId} has no canonical action`,
          )
        }
        return {
          decisionIntentId: commitment.decisionIntentId,
          choiceSetId: commitment.choiceSetId,
          weekIndex: commitment.week,
          problemCategory:
            commitment.week === 0
              ? ('preventive-capacity' as const)
              : ('recovery-allocation' as const),
          actionIds: [action.id],
          consequenceRefs: commitment.consequences.map(
            (consequence) => ({
              kind:
                consequence.objectRef ===
                  PUMP_MAINTENANCE_BLOCK_ID ||
                consequence.objectRef ===
                  RECOVERY_ALLOCATION_BLOCK_ID
                  ? ('schedule' as const)
                  : consequence.objectRef.startsWith(
                        'forecast:',
                      )
                    ? ('forecast' as const)
                    : ('risk' as const),
              id: consequence.objectRef,
            }),
          ),
          beforeDecisionStateHash:
            commitment.projectionBaseHash,
          finalDecisionStateHash:
            commitment.candidateProjectionHash,
          finalOutcomeCode: `committed:${commitment.candidateId}`,
          finalDisposition: 'committed' as const,
        }
      },
    )
  const candidateManagementCommitmentGroups = [
    ...legacyCandidateManagementCommitmentGroups,
    ...(isV03 ? managementCommitmentGroupsV03 : []),
  ]
  const managementChoiceSetsV03 = [
    state.managementChoices.opportunities.preventiveCapacity,
    state.managementChoices.opportunities.recoveryAllocation,
  ].flatMap((opportunity) =>
    opportunity === null
      ? []
      : [
          oracleChoiceSet(
            opportunity.choiceSetId,
            state.managementChoices.commitments.find(
              (commitment) =>
                commitment.opportunityId ===
                opportunity.opportunityId,
            )?.candidateId ?? null,
          ),
        ],
  )
  return {
    schemaVersion: 'gate1-playtest-v2' as const,
    ...(isV03
      ? {
          protocolVersion:
            recorder.meta.protocolVersion,
          scenarioVersion: recorder.meta.scenarioVersion,
        }
      : {}),
    captureKind:
      blockedReason === undefined
        ? ('complete' as const)
        : ('blocked' as const),
    ...(blockedReason === undefined
      ? {}
      : {
          blockedAtTick: state.currentTick,
          blockedReason,
        }),
    meta: isV03
      ? { ...recorder.meta }
      : {
          sampleId: recorder.meta.sampleId,
          sessionId: recorder.meta.sessionId,
          buildId: recorder.meta.buildId,
          gitSha: recorder.meta.gitSha,
          artifactHash: recorder.meta.artifactHash,
          scenarioId: recorder.meta.scenarioId,
          scenarioVersion: '0.5.0',
          fixedSeed: recorder.meta.fixedSeed,
          initialStateHash:
            recorder.meta.initialStateHash,
          viewport: recorder.meta.viewport,
          inputDevice: recorder.meta.inputDevice,
        },
    machineTiming: {
      machineStartedAtEpochMs: recorder.machineStartedAtEpochMs,
      machineEndedAtEpochMs: epochNow,
      machineElapsedMs: Math.max(
        0,
        Math.round(
          monotonicNow - recorder.machineStartedAtMonotonicMs,
        ),
      ),
      week1RawDurationMs: recorder.weekRawDurationMs[0],
      week2RawDurationMs: recorder.weekRawDurationMs[1],
    },
    actions,
    candidateEditGroups,
    choiceSets: [
      ...choiceSets,
      ...(isV03 ? managementChoiceSetsV03 : []),
    ],
    candidateManagementCommitmentGroups,
    ...(isV03
      ? {
          managementChoiceOpportunitiesV03: [
            state.managementChoices.opportunities
              .preventiveCapacity,
            state.managementChoices.opportunities
              .recoveryAllocation,
          ].filter((value) => value !== null),
          managementChoiceCommitmentsV03:
            state.managementChoices.commitments.map(
              (commitment) => ({
                ...commitment,
                consequences:
                  commitment.consequences.map(
                    (consequence) => ({
                      ...consequence,
                    }),
                  ),
              }),
            ),
          effectOwnershipV03: {
            ...state.managementChoices.effectOwnership,
          },
        }
      : {}),
    domainEvents: recorder.domainEvents.map((event) => ({ ...event })),
    telemetry: recorder.telemetry.map((event) => ({ ...event })),
    speedTrajectory: recorder.speedTrajectory.map((entry) => ({ ...entry })),
    finalTick: state.currentTick,
    finalStateHash: stableStateHash(state),
    finalState: {
      isComplete: state.isComplete,
      completedWeekCount: state.completedWeekIndexes.length,
      recapCount: state.recaps.length,
      processedScriptEventIds: [...state.processedScriptEventIds],
      ...(isV03
        ? {
            equipmentExposure:
              state.managementChoices.equipmentExposure,
            equipmentRecoveryLoad:
              state.managementChoices
                .equipmentRecoveryLoad,
            preventiveCapacityAllocation:
              state.managementChoices
                .preventiveCapacityAllocation,
            linHeRecoveryUnits:
              state.managementChoices.linHeRecoveryUnits,
            personnelReadiness:
              state.managementChoices.personnelReadiness,
          }
        : {}),
    },
    recap: state.recaps.map((week, weekIndex) => ({
      weekIndex,
      planned: { ...week.planned },
      actual: week.actual,
      itemIds: week.items.map((item) => item.id),
      sourceIds: week.items.map((item) => item.sourceId),
    })),
    weekRecaps: state.recaps.map((_, weekIndex) => ({ weekIndex })),
    summary: {
      week1CandidateEditCount: candidateEditGroups.filter(
        ({ groupId }) => groupId.startsWith('legacy:w0:'),
      ).length,
      week2CandidateEditCount: candidateEditGroups.filter(
        ({ groupId }) => groupId.startsWith('legacy:w1:'),
      ).length,
      week1CandidateManagementCount:
        candidateManagementCommitmentGroups.filter(
          ({ weekIndex }) => weekIndex === 0,
        ).length,
      week2CandidateManagementCount:
        candidateManagementCommitmentGroups.filter(
          ({ weekIndex }) => weekIndex === 1,
        ).length,
      ...(isV03
        ? {
            week1C03TerminalCommitmentCount:
              managementCommitmentGroupsV03.filter(
                ({ weekIndex }) => weekIndex === 0,
              ).length,
            week2C03TerminalCommitmentCount:
              managementCommitmentGroupsV03.filter(
                ({ weekIndex }) => weekIndex === 1,
              ).length,
          }
        : {}),
    },
  }
}

type ExportedPlayerAction =
  | { type: 'CHANGE_ACTIVITY'; activity: string }
  | {
      type: 'EDIT_SCHEDULE'
      blockIds: readonly string[]
      activity: string
      scope: string
    }
  | {
      type: 'COPY_DAY'
      characterId: string
      sourceDayIndex: number
      targetDayIndex: number
      scope: string
    }
  | { type: 'UNDO_SCHEDULE' }
  | { type: 'USE_FERTILIZER' }
  | { type: 'SET_FOOD_SHORTFALL_ACCEPTED'; accepted: boolean }
  | {
      type: 'SELECT_REPAIR_RESPONSIBILITY'
      responsible: string
    }
  | { type: 'ACCEPT_REPAIR_DEBT' }
  | { type: 'RESOLVE_LIN_HE_REQUEST'; decision: string }
  | { type: 'OPEN_TRANSPORT_SHORTCUT' }
  | {
      type: 'COMMIT_MANAGEMENT_CHOICE'
      opportunityId: string
      choiceSetId: string
      candidateId: string
      stateRevision: number
      projectionBaseHash: string
      candidateProjectionHash: string
      idempotencyKey: string
      commitCause: 'explicit-candidate-action'
    }
  | { type: 'CONTINUE_TO_NEXT_WEEK' }
  | { type: 'SET_PAUSED'; paused: boolean }

function exportAction(action: PlayerAction): ExportedPlayerAction {
  switch (action.type) {
    case 'CHANGE_ACTIVITY':
      return { type: action.type, activity: action.activity }
    case 'EDIT_SCHEDULE':
      return {
        type: action.type,
        blockIds: [...action.blockIds],
        activity: action.activity,
        scope: action.scope,
      }
    case 'COPY_DAY':
      return {
        type: action.type,
        characterId: action.characterId,
        sourceDayIndex: action.sourceDayIndex,
        targetDayIndex: action.targetDayIndex,
        scope: action.scope,
      }
    case 'SET_FOOD_SHORTFALL_ACCEPTED':
      return { type: action.type, accepted: action.accepted }
    case 'SELECT_REPAIR_RESPONSIBILITY':
      return {
        type: action.type,
        responsible: action.responsible,
      }
    case 'RESOLVE_LIN_HE_REQUEST':
      return { type: action.type, decision: action.decision }
    case 'SET_PAUSED':
      return { type: action.type, paused: action.paused }
    case 'COMMIT_MANAGEMENT_CHOICE':
      return {
        type: action.type,
        opportunityId: action.request.opportunityId,
        choiceSetId: action.request.choiceSetId,
        candidateId: action.request.candidateId,
        stateRevision: action.request.stateRevision,
        projectionBaseHash:
          action.request.projectionBaseHash,
        candidateProjectionHash:
          action.request.candidateProjectionHash,
        idempotencyKey: action.request.idempotencyKey,
        commitCause: action.request.commitCause,
      }
    default:
      return { type: action.type }
  }
}

function exportEnvelope(envelope: PlayerActionEnvelope) {
  return {
    id: envelope.id,
    sequence: envelope.sequence,
    atTick: envelope.atTick,
    action: exportAction(envelope.action),
    affectedCellIds: [...envelope.affectedBlockIds],
    undoOfActionId: envelope.undoOfActionId ?? null,
  }
}

function isCandidateEdit(envelope: PlayerActionEnvelope): boolean {
  return (
    envelope.action.type === 'CHANGE_ACTIVITY' ||
    envelope.action.type === 'EDIT_SCHEDULE' ||
    envelope.action.type === 'COPY_DAY' ||
    envelope.action.type === 'OPEN_TRANSPORT_SHORTCUT'
  )
}

function createExport(
  recorder: SessionRecorder,
  state: SimulationState,
  epochNow = Date.now(),
  monotonicNow = performance.now(),
  blockedReason?: string,
) {
  if (
    scenario.version === '0.5.0' ||
    scenario.version === '0.5.1'
  ) {
    return createV2Export(
      recorder,
      state,
      epochNow,
      monotonicNow,
      blockedReason,
    )
  }
  const machineElapsedMs = Math.max(
    0,
    Math.round(monotonicNow - recorder.machineStartedAtMonotonicMs),
  )
  const actions = recorder.actions.map(exportEnvelope)
  const undoActionsByTarget = new Map<string, string[]>()
  for (const action of actions) {
    if (!action.undoOfActionId) continue
    const undoIds = undoActionsByTarget.get(action.undoOfActionId) ?? []
    undoIds.push(action.id)
    undoActionsByTarget.set(action.undoOfActionId, undoIds)
  }
  const candidateEditGroups = recorder.actions
    .filter(isCandidateEdit)
    .map((envelope) => ({
      actionId: envelope.id,
      weekIndex: weekIndexForTick(envelope.atTick, scenario),
      actionType: envelope.action.type,
      affectedCellIds: [...envelope.affectedBlockIds],
      undoActionIds: undoActionsByTarget.get(envelope.id) ?? [],
    }))

  return {
    schemaVersion: 'gate1-playtest-v1' as const,
    ...(blockedReason === undefined
      ? {}
      : {
          captureKind: 'blocked' as const,
          blockedAtTick: state.currentTick,
          blockedReason,
        }),
    meta: { ...recorder.meta },
    machineTiming: {
      machineStartedAtEpochMs: recorder.machineStartedAtEpochMs,
      machineEndedAtEpochMs: epochNow,
      machineElapsedMs,
      week1RawDurationMs: recorder.weekRawDurationMs[0],
      week2RawDurationMs: recorder.weekRawDurationMs[1],
    },
    actions,
    candidateEditGroups,
    domainEvents: recorder.domainEvents.map((event) => ({ ...event })),
    telemetry: recorder.telemetry.map((event) => ({ ...event })),
    speedTrajectory: recorder.speedTrajectory.map((entry) => ({ ...entry })),
    finalTick: state.currentTick,
    finalStateHash: stableStateHash(state),
    finalState: {
      isComplete: state.isComplete,
      completedWeekCount: state.completedWeekIndexes.length,
      recapCount: state.recaps.length,
      processedScriptEventIds: [...state.processedScriptEventIds],
    },
    recap: state.recaps.map((week, weekIndex) => ({
      weekIndex,
      planned: { ...week.planned },
      actual: week.actual,
      itemIds: week.items.map((item) => item.id),
      sourceIds: week.items.map((item) => item.sourceId),
    })),
    summary: {
      week1CandidateEditCount: candidateEditGroups.filter(
        (group) => group.weekIndex === 0,
      ).length,
      week2CandidateEditCount: candidateEditGroups.filter(
        (group) => group.weekIndex === 1,
      ).length,
    },
  }
}

export function createPlaytestExport(
  recorder: SessionRecorder,
  state: SimulationState,
  epochNow = Date.now(),
  monotonicNow = performance.now(),
): ReturnType<typeof createV2Export> {
  return createExport(
    recorder,
    state,
    epochNow,
    monotonicNow,
  ) as ReturnType<typeof createV2Export>
}

export function createBlockedPlaytestExport(
  recorder: SessionRecorder,
  state: SimulationState,
  reason: string,
  epochNow = Date.now(),
  monotonicNow = performance.now(),
): ReturnType<typeof createV2Export> {
  const blockedReason = reason.trim()
  if (
    blockedReason.length === 0 ||
    blockedReason.length > MAX_BLOCKED_REASON_LENGTH
  ) {
    throw new Error('阻断原因需为 1–240 个字符')
  }
  if (state.isComplete) {
    throw new Error('完整场次不能保存为阻断记录')
  }
  return createExport(
    recorder,
    state,
    epochNow,
    monotonicNow,
    blockedReason,
  ) as ReturnType<typeof createV2Export>
}
