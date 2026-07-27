import { gate1WeekOneScenario as scenario } from '../scenario/gate1-week-one'
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
  blockEndTick,
  parseBlockId,
  resolveScheduleBlock,
} from '../sim/schedule'

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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(
            (value as Record<string, unknown>)[key],
          )}`,
      )
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count))
}

function sha256(value: unknown): string {
  const source = new TextEncoder().encode(canonicalJson(value))
  const bitLength = source.length * 8
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64
  const bytes = new Uint8Array(paddedLength)
  bytes.set(source)
  bytes[source.length] = 0x80
  const view = new DataView(bytes.buffer)
  view.setUint32(paddedLength - 4, bitLength, false)
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const words = new Uint32Array(64)
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false)
    }
    for (let index = 16; index < 64; index += 1) {
      const left =
        rotateRight(words[index - 15], 7) ^
        rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3)
      const right =
        rotateRight(words[index - 2], 17) ^
        rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10)
      words[index] =
        (words[index - 16] + left + words[index - 7] + right) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = hash
    for (let index = 0; index < 64; index += 1) {
      const choose = (e & f) ^ (~e & g)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const first =
        (h +
          (rotateRight(e, 6) ^
            rotateRight(e, 11) ^
            rotateRight(e, 25)) +
          choose +
          constants[index] +
          words[index]) >>>
        0
      const second =
        (rotateRight(a, 2) ^
          rotateRight(a, 13) ^
          rotateRight(a, 22)) +
        majority
      h = g
      g = f
      f = e
      e = (d + first) >>> 0
      d = c
      c = b
      b = a
      a = (first + second) >>> 0
    }
    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }
  return hash.map((item) => item.toString(16).padStart(8, '0')).join('')
}

function decisionHash(decisionIntentId: string, projection: unknown) {
  return sha256({ decisionIntentId, projection })
}

function linHeChoiceSet(selectedOptionId: string | null) {
  return {
    choiceSetId: 'choice:w1:lin-he-study',
    decisionIntentId: LIN_HE_INTENT_ID,
    options: [
      {
        optionId: 'accept-study',
        reachable: true,
        visibleConsequenceRefs: [
          'forecast:w1:food',
          `schedule:${LIN_HE_STUDY_BLOCK_ID}`,
          'character-record:lin-he-study',
        ],
        dominanceStatus: 'non-dominated' as const,
      },
      {
        optionId: 'decline-study',
        reachable: true,
        visibleConsequenceRefs: [
          'forecast:w1:food',
          'character-record:lin-he-study-declined',
        ],
        dominanceStatus: 'non-dominated' as const,
      },
    ],
    selectedOptionId,
  }
}

function foodChoiceSet(
  selectedOptionId: string | null,
  scheduleOptionReachable: boolean,
) {
  return {
    choiceSetId: 'choice:w0:food-plan',
    decisionIntentId: FOOD_INTENT_ID,
    options: [
      {
        optionId: 'food-shift-qiao',
        reachable: scheduleOptionReachable,
        visibleConsequenceRefs: [
          'forecast:w0:food',
          'forecast:w0:repair',
          'schedule:qiao-pan:d1:b1',
        ],
        dominanceStatus: 'non-dominated' as const,
      },
      {
        optionId: 'accept-food-gap',
        reachable: true,
        visibleConsequenceRefs: [
          'forecast:w0:food',
          'forecast:w0:repair',
        ],
        dominanceStatus: 'non-dominated' as const,
      },
    ],
    selectedOptionId,
  }
}

function repairChoiceSet(selectedOptionId: string | null) {
  return {
    choiceSetId: 'choice:w0:pump-repair',
    decisionIntentId: REPAIR_INTENT_ID,
    options: [
      {
        optionId: 'schedule-repair',
        reachable: true,
        visibleConsequenceRefs: [
          'forecast:w0:repair',
          'risk:pump',
          'schedule:qiao-pan:d3:b2',
          'schedule:chen-du:d3:b0',
          'schedule:su-ji:d3:b0',
        ],
        dominanceStatus: 'non-dominated' as const,
      },
      {
        optionId: 'accept-debt',
        reachable: true,
        visibleConsequenceRefs: [
          'recap:w0:repair',
          'risk:repair-debt',
        ],
        dominanceStatus: 'non-dominated' as const,
      },
    ],
    selectedOptionId,
  }
}

function transportChoiceSet(weekIndex: 0 | 1) {
  return {
    choiceSetId: `choice:w${weekIndex}:transport-route`,
    decisionIntentId: `w${weekIndex}:transport-route`,
    options: [
      {
        optionId: 'north-loop',
        reachable: true,
        visibleConsequenceRefs: [
          `forecast:w${weekIndex}:food`,
          `risk:w${weekIndex}:transport-loss`,
        ],
        dominanceStatus: 'non-dominated' as const,
      },
      {
        optionId: 'south-shortcut',
        reachable: true,
        visibleConsequenceRefs: [
          `forecast:w${weekIndex}:food`,
          `risk:w${weekIndex}:transport-loss`,
        ],
        dominanceStatus: 'non-dominated' as const,
      },
    ],
    selectedOptionId: 'south-shortcut',
  }
}

function fertilizerChoiceSet(weekIndex: 0 | 1) {
  return {
    choiceSetId: `choice:w${weekIndex}:fertilizer`,
    decisionIntentId: `w${weekIndex}:asset-use:fertilizer`,
    options: [
      {
        optionId: 'use-fertilizer',
        reachable: true,
        visibleConsequenceRefs: [
          `forecast:w${weekIndex}:food`,
          'inventory:fertilizer',
        ],
        dominanceStatus: 'non-dominated' as const,
      },
      {
        optionId: 'keep-fertilizer',
        reachable: true,
        visibleConsequenceRefs: [
          `forecast:w${weekIndex}:food`,
          'inventory:fertilizer',
        ],
        dominanceStatus: 'non-dominated' as const,
      },
    ],
    selectedOptionId: 'use-fertilizer',
  }
}

function createV2Export(
  recorder: SessionRecorder,
  state: SimulationState,
  epochNow: number,
  monotonicNow: number,
  blockedReason?: string,
) {
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
  const candidateManagementCommitmentGroups = [
    ...foodCommitmentGroups,
    ...(repairDebtCommitmentGroups.length > 0
      ? repairDebtCommitmentGroups
      : repairCommitmentGroups),
    ...requestCommitmentGroups,
    ...transportCommitmentGroups,
    ...fertilizerCommitmentGroups,
  ]
  return {
    schemaVersion: 'gate1-playtest-v2' as const,
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
    meta: { ...recorder.meta },
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
    choiceSets,
    candidateManagementCommitmentGroups,
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
  if (scenario.version === '0.5.0') {
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
