import { createHash, randomUUID } from 'node:crypto'
import {
  createReadStream,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'

const CAPTURE_PATH = '/__gate1/capture'
const CAPTURE_VERSION = 'gate1-capture-host-v1'
const MAX_EXPORT_BYTES = 2 * 1024 * 1024
const MAX_BLOCKED_REASON_LENGTH = 240
const SCENARIO_START_TICK = 54
const BUILD_ID_PATTERN = /^g1-(?:rc|e2e)-[a-z0-9.-]+$/i
const SAMPLE_ID_V1_PATTERN = /^(?:(?:A|P)\d{2,}|M-[ABC])$/
const SAMPLE_ID_V2_PATTERN =
  /^(?:A(?:3[89]|[4-9]\d|[1-9]\d{2,})|TECH-RC9-[DP](?:0[1-9]|[1-9]\d+))$/
const SESSION_ID_PATTERN = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i
const ARTIFACT_HASH_PATTERN = /^[a-f0-9]{64}$/i
const INITIAL_STATE_HASH_PATTERN = /^fnv1a32-[a-f0-9]{8}$/i
const FOOD_SCHEDULE_BLOCK_ID = 'qiao-pan:d1:b1'
const FOOD_SCHEDULE_BLOCK_END_TICK = 240
const REPAIR_BLOCK_DEFAULTS = new Map([
  ['qiao-pan:d3:b2', 'rest'],
  ['chen-du:d3:b0', 'food'],
  ['su-ji:d3:b0', 'logistics'],
])
const DOMAIN_EVENT_TYPES = new Set([
  'activity-changed',
  'schedule-edited',
  'schedule-undone',
  'fertilizer-used',
  'food-shortfall-accepted',
  'repair-responsibility-selected',
  'repair-responsibility-scheduled',
  'repair-debt-accepted',
  'lin-he-request-resolved',
  'transport-shortcut-opened',
  'clock-changed',
  'pump-incident',
  'lin-he-request-expired',
  'week-ended',
])
const EXPORT_KEYS = [
  'actions',
  'candidateEditGroups',
  'domainEvents',
  'finalState',
  'finalStateHash',
  'finalTick',
  'machineTiming',
  'meta',
  'recap',
  'schemaVersion',
  'speedTrajectory',
  'summary',
  'telemetry',
]
const BLOCKED_EXPORT_KEYS = [
  ...EXPORT_KEYS,
  'blockedAtTick',
  'blockedReason',
  'captureKind',
]
const V2_EXPORT_KEYS = [
  'actions',
  'candidateEditGroups',
  'candidateManagementCommitmentGroups',
  'captureKind',
  'choiceSets',
  'domainEvents',
  'finalState',
  'finalStateHash',
  'finalTick',
  'machineTiming',
  'meta',
  'recap',
  'schemaVersion',
  'speedTrajectory',
  'summary',
  'telemetry',
  'weekRecaps',
]
const V2_BLOCKED_EXPORT_KEYS = [
  ...V2_EXPORT_KEYS,
  'blockedAtTick',
  'blockedReason',
]
const META_KEYS = [
  'artifactHash',
  'buildId',
  'fixedSeed',
  'gitSha',
  'initialStateHash',
  'inputDevice',
  'sampleId',
  'scenarioId',
  'scenarioVersion',
  'sessionId',
  'viewport',
]
const FINAL_STATE_KEYS = [
  'completedWeekCount',
  'isComplete',
  'processedScriptEventIds',
  'recapCount',
]
const RECAP_KEYS = [
  'actual',
  'itemIds',
  'planned',
  'sourceIds',
  'weekIndex',
]
const PLANNED_KEYS = ['high', 'low']
const RECEIPT_KEYS = [
  'artifactHash',
  'buildId',
  'bytes',
  'capturedAtUtc',
  'captureVersion',
  'filename',
  'gitSha',
  'sampleId',
  'schemaVersion',
  'sessionId',
  'sha256',
]
const BLOCKED_RECEIPT_KEYS = [
  ...RECEIPT_KEYS,
  'blockedAtTick',
  'captureKind',
  'isComplete',
]
const REQUIRED_ARRAYS = [
  'actions',
  'candidateEditGroups',
  'domainEvents',
  'recap',
  'speedTrajectory',
  'telemetry',
]
const REQUIRED_V2_ARRAYS = [
  ...REQUIRED_ARRAYS,
  'candidateManagementCommitmentGroups',
  'choiceSets',
  'weekRecaps',
]
const REQUIRED_OBJECTS = [
  'finalState',
  'machineTiming',
  'summary',
]
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
}

function argument(name) {
  const index = process.argv.lastIndexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function sendJson(response, status, payload) {
  const bytes = Buffer.from(`${JSON.stringify(payload)}\n`)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': bytes.byteLength,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(bytes)
}

function hasExactKeys(value, keys) {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...keys].sort())
  )
}

function validV1Export(value, buildMetadata) {
  const isBlocked = value?.captureKind === 'blocked'
  if (
    !value ||
    typeof value !== 'object' ||
    value.schemaVersion !== 'gate1-playtest-v1' ||
    !hasExactKeys(value, isBlocked ? BLOCKED_EXPORT_KEYS : EXPORT_KEYS) ||
    !value.meta ||
    typeof value.meta !== 'object' ||
    !hasExactKeys(value.meta, META_KEYS) ||
    typeof value.finalStateHash !== 'string' ||
    !INITIAL_STATE_HASH_PATTERN.test(value.finalStateHash)
  ) {
    return false
  }
  if (
    REQUIRED_ARRAYS.some((key) => !Array.isArray(value[key])) ||
    REQUIRED_OBJECTS.some(
      (key) =>
        !value[key] ||
        typeof value[key] !== 'object' ||
        Array.isArray(value[key]),
    )
  ) {
    return false
  }

  const meta = value.meta
  const validRecaps = value.recap.every(
    (recap) =>
      recap &&
      typeof recap === 'object' &&
      !Array.isArray(recap) &&
      hasExactKeys(recap, RECAP_KEYS) &&
      recap.planned &&
      typeof recap.planned === 'object' &&
      !Array.isArray(recap.planned) &&
      hasExactKeys(recap.planned, PLANNED_KEYS) &&
      Number.isFinite(recap.planned.low) &&
      Number.isFinite(recap.planned.high) &&
      Number.isFinite(recap.actual) &&
      Array.isArray(recap.itemIds) &&
      recap.itemIds.every((itemId) => typeof itemId === 'string') &&
      Array.isArray(recap.sourceIds) &&
      recap.sourceIds.every((sourceId) => typeof sourceId === 'string') &&
      recap.itemIds.length === recap.sourceIds.length &&
      Number.isInteger(recap.weekIndex),
  )
  const recapWeekIndexes = validRecaps
    ? value.recap.map((recap) => recap.weekIndex).sort()
    : []
  const exportCreated = value.telemetry.filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      entry.type === 'export-created',
  )
  const blockedCaptureCreated = value.telemetry.filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      entry.type === 'blocked-capture-created',
  )
  const validCommonContract =
    hasExactKeys(value.finalState, FINAL_STATE_KEYS) &&
    Array.isArray(value.finalState.processedScriptEventIds) &&
    value.finalState.processedScriptEventIds.every(
      (eventId) => typeof eventId === 'string',
    ) &&
    validRecaps &&
    typeof meta.sampleId === 'string' &&
    SAMPLE_ID_V1_PATTERN.test(meta.sampleId) &&
    meta.sampleId.length <= 16 &&
    typeof meta.sessionId === 'string' &&
    SESSION_ID_PATTERN.test(meta.sessionId) &&
    typeof meta.buildId === 'string' &&
    BUILD_ID_PATTERN.test(meta.buildId) &&
    meta.buildId.length <= 64 &&
    meta.buildId === buildMetadata.buildId &&
    typeof meta.gitSha === 'string' &&
    GIT_SHA_PATTERN.test(meta.gitSha) &&
    meta.gitSha === buildMetadata.gitSha &&
    typeof meta.artifactHash === 'string' &&
    ARTIFACT_HASH_PATTERN.test(meta.artifactHash) &&
    meta.artifactHash === buildMetadata.artifactHash &&
    typeof meta.initialStateHash === 'string' &&
    INITIAL_STATE_HASH_PATTERN.test(meta.initialStateHash) &&
    meta.initialStateHash === buildMetadata.initialStateHash &&
    typeof meta.scenarioId === 'string' &&
    meta.scenarioId === 'gate1-two-week-management' &&
    typeof meta.scenarioVersion === 'string' &&
    meta.scenarioVersion === '0.4.0' &&
    Number.isInteger(meta.fixedSeed) &&
    meta.fixedSeed === 104729 &&
    typeof meta.viewport === 'string' &&
    /^\d+x\d+$/.test(meta.viewport) &&
    typeof meta.inputDevice === 'string' &&
    meta.inputDevice === 'browser-pointer-keyboard'
  if (!validCommonContract) return false

  if (isBlocked) {
    return (
      Number.isInteger(value.blockedAtTick) &&
      value.blockedAtTick >= SCENARIO_START_TICK &&
      value.blockedAtTick <= 2010 &&
      value.finalTick === value.blockedAtTick &&
      typeof value.blockedReason === 'string' &&
      value.blockedReason === value.blockedReason.trim() &&
      value.blockedReason.length > 0 &&
      value.blockedReason.length <= MAX_BLOCKED_REASON_LENGTH &&
      value.finalState.isComplete === false &&
      Number.isInteger(value.finalState.completedWeekCount) &&
      value.finalState.completedWeekCount >= 0 &&
      value.finalState.completedWeekCount <= 2 &&
      value.finalState.recapCount === value.finalState.completedWeekCount &&
      value.recap.length === value.finalState.recapCount &&
      JSON.stringify(recapWeekIndexes) ===
        JSON.stringify(value.recap.map((_, weekIndex) => weekIndex)) &&
      exportCreated.length === 0 &&
      blockedCaptureCreated.length === 1 &&
      blockedCaptureCreated[0].atTick === value.blockedAtTick
    )
  }

  return (
    value.finalTick === 2010 &&
    value.finalState.isComplete === true &&
    value.finalState.completedWeekCount === 2 &&
    value.finalState.recapCount === 2 &&
    value.recap.length === 2 &&
    JSON.stringify(recapWeekIndexes) === JSON.stringify([0, 1]) &&
    exportCreated.length === 1 &&
    exportCreated[0].atTick === 2010 &&
    blockedCaptureCreated.length === 0
  )
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
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

function decisionHash(decisionIntentId, projection) {
  return createHash('sha256')
    .update(canonicalJson({ decisionIntentId, projection }))
    .digest('hex')
}

function sameOrderedValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sameStringSet(left, right) {
  return (
    Array.isArray(left) &&
    new Set(left).size === left.length &&
    sameOrderedValues([...left].sort(), [...right].sort())
  )
}

function validSequence(sequence, index) {
  return Number.isInteger(sequence) && sequence === index + 1
}

function validTick(value) {
  return (
    Number.isInteger(value) &&
    value >= SCENARIO_START_TICK &&
    value <= 2010
  )
}

function validMachineOffset(value) {
  return Number.isInteger(value) && value >= 0
}

function validMachineTiming(value) {
  const nullableDuration = (duration) =>
    duration === null || validMachineOffset(duration)
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'machineStartedAtEpochMs',
      'machineEndedAtEpochMs',
      'machineElapsedMs',
      'week1RawDurationMs',
      'week2RawDurationMs',
    ]) &&
    Number.isInteger(value.machineStartedAtEpochMs) &&
    value.machineStartedAtEpochMs >= 0 &&
    Number.isInteger(value.machineEndedAtEpochMs) &&
    value.machineEndedAtEpochMs >= value.machineStartedAtEpochMs &&
    validMachineOffset(value.machineElapsedMs) &&
    nullableDuration(value.week1RawDurationMs) &&
    nullableDuration(value.week2RawDurationMs)
  )
}

function validForecastRange(value) {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['high', 'low']) &&
    Number.isFinite(value.low) &&
    Number.isFinite(value.high) &&
    value.low <= value.high
  )
}

function validDomainEvents(events) {
  return events.every((event, index) => {
    if (
      !isRecord(event) ||
      !validSequence(event.sequence, index) ||
      typeof event.eventId !== 'string' ||
      event.eventId.length === 0 ||
      !DOMAIN_EVENT_TYPES.has(event.type) ||
      !validTick(event.atTick)
    ) {
      return false
    }
    const optionalKeys = [
      ...(event.before === undefined ? [] : ['before']),
      ...(event.after === undefined ? [] : ['after']),
    ]
    return (
      hasExactKeys(event, [
        'sequence',
        'eventId',
        'type',
        'atTick',
        ...optionalKeys,
      ]) &&
      (
        event.before === undefined ||
        validForecastRange(event.before)
      ) &&
      (
        event.after === undefined ||
        validForecastRange(event.after)
      )
    )
  })
}

function validSpeedTrajectory(entries) {
  return entries.every(
    (entry, index) =>
      isRecord(entry) &&
      hasExactKeys(entry, [
        'sequence',
        'atTick',
        'machineOffsetMs',
        'speed',
      ]) &&
      validSequence(entry.sequence, index) &&
      validTick(entry.atTick) &&
      validMachineOffset(entry.machineOffsetMs) &&
      [1, 3, 8].includes(entry.speed),
  )
}

function validTelemetry(events) {
  const keysByType = new Map([
    [
      'session-started',
      ['sequence', 'type', 'atTick', 'machineOffsetMs', 'weekIndex'],
    ],
    [
      'week-started',
      ['sequence', 'type', 'atTick', 'machineOffsetMs', 'weekIndex'],
    ],
    [
      'speed-changed',
      ['sequence', 'type', 'atTick', 'machineOffsetMs', 'speed'],
    ],
    [
      'player-action-applied',
      [
        'sequence',
        'type',
        'atTick',
        'machineOffsetMs',
        'fromTick',
        'toTick',
        'actionId',
        'domainEventIds',
      ],
    ],
    [
      'simulation-advanced',
      [
        'sequence',
        'type',
        'atTick',
        'machineOffsetMs',
        'speed',
        'fromTick',
        'toTick',
        'domainEventIds',
      ],
    ],
    [
      'auto-pause-triggered',
      [
        'sequence',
        'type',
        'atTick',
        'machineOffsetMs',
        'speed',
        'domainEventIds',
      ],
    ],
    [
      'week-completed',
      ['sequence', 'type', 'atTick', 'machineOffsetMs', 'weekIndex'],
    ],
    [
      'export-created',
      ['sequence', 'type', 'atTick', 'machineOffsetMs'],
    ],
    [
      'blocked-capture-created',
      ['sequence', 'type', 'atTick', 'machineOffsetMs'],
    ],
  ])
  return events.every((event, index) => {
    const keys = keysByType.get(event?.type)
    if (
      !isRecord(event) ||
      keys === undefined ||
      !hasExactKeys(event, keys) ||
      !validSequence(event.sequence, index) ||
      !validTick(event.atTick) ||
      !validMachineOffset(event.machineOffsetMs)
    ) {
      return false
    }
    if (
      ['session-started', 'week-started', 'week-completed'].includes(
        event.type,
      ) &&
      ![0, 1].includes(event.weekIndex)
    ) {
      return false
    }
    if (
      ['speed-changed', 'simulation-advanced', 'auto-pause-triggered'].includes(
        event.type,
      ) &&
      ![1, 3, 8].includes(event.speed)
    ) {
      return false
    }
    if (
      ['player-action-applied', 'simulation-advanced'].includes(
        event.type,
      ) &&
      (
        !validTick(event.fromTick) ||
        !validTick(event.toTick) ||
        event.fromTick > event.toTick ||
        event.atTick !== event.toTick ||
        !Array.isArray(event.domainEventIds) ||
        !event.domainEventIds.every(
          (eventId) => typeof eventId === 'string',
        )
      )
    ) {
      return false
    }
    if (
      event.type === 'player-action-applied' &&
      (
        typeof event.actionId !== 'string' ||
        !/^action-\d{4,}$/.test(event.actionId)
      )
    ) {
      return false
    }
    return (
      event.type !== 'auto-pause-triggered' ||
      (
        Array.isArray(event.domainEventIds) &&
        event.domainEventIds.every(
          (eventId) => typeof eventId === 'string',
        )
      )
    )
  })
}

function weekIndexForV2Tick(atTick) {
  if (!Number.isInteger(atTick)) return null
  if (atTick >= 54 && atTick <= 1002) return 0
  if (atTick >= 1062 && atTick <= 2010) return 1
  return null
}

function validV2Action(action) {
  if (
    !isRecord(action) ||
    typeof action.id !== 'string' ||
    !/^action-\d{4,}(?::\d+)?$/.test(action.id)
  ) {
    return false
  }
  const exact = (...keys) => hasExactKeys(action, ['id', 'type', ...keys])
  if (action.type === 'EDIT_SCHEDULE') {
    const block = /^(lin-he|qiao-pan|su-ji|chen-du):d(\d+):b[0-3]$/.exec(
      action.blockId ?? '',
    )
    const keys =
      action.responsibility === undefined
        ? ['memberId', 'dayIndex', 'blockId', 'fromActivity', 'toActivity']
        : [
            'memberId',
            'dayIndex',
            'blockId',
            'fromActivity',
            'toActivity',
            'responsibility',
          ]
    return (
      exact(...keys) &&
      block !== null &&
      block[1] === action.memberId &&
      Number(block[2]) === action.dayIndex &&
      typeof action.fromActivity === 'string' &&
      typeof action.toActivity === 'string' &&
      action.fromActivity !== action.toActivity &&
      (
        action.responsibility === undefined ||
        action.responsibility === 'scheduled'
      )
    )
  }
  if (
    action.type === 'OPEN_TRANSPORT_SHORTCUT' ||
    action.type === 'USE_FERTILIZER'
  ) {
    return (
      exact('atTick', 'weekIndex') &&
      [0, 1].includes(action.weekIndex) &&
      weekIndexForV2Tick(action.atTick) === action.weekIndex
    )
  }
  if (action.type === 'SET_FOOD_SHORTFALL_ACCEPTED') {
    return exact('accepted') && typeof action.accepted === 'boolean'
  }
  if (action.type === 'RESOLVE_LIN_HE_REQUEST') {
    if (action.resolution === 'accepted') {
      return (
        exact(
          'resolution',
          'memberId',
          'dayIndex',
          'blockId',
          'fromActivity',
          'toActivity',
        ) &&
        action.memberId === 'lin-he' &&
        action.dayIndex === 8 &&
        action.blockId === 'lin-he:d8:b0' &&
        action.fromActivity === 'food' &&
        action.toActivity === 'study'
      )
    }
    return (
      action.resolution === 'declined' &&
      exact('resolution', 'persistentCharacterRecord') &&
      typeof action.persistentCharacterRecord === 'boolean'
    )
  }
  if (action.type === 'UNDO') {
    return (
      exact('revertsActionId') &&
      typeof action.revertsActionId === 'string'
    )
  }
  if (action.type === 'REDO') {
    return (
      exact('replaysActionId') &&
      typeof action.replaysActionId === 'string'
    )
  }
  if (action.type === 'SELECT_REPAIR_RESPONSIBILITY') {
    return (
      exact('responsible', 'scheduleConfirmed') &&
      ['qiao-pan', 'handoff'].includes(action.responsible) &&
      action.scheduleConfirmed === false
    )
  }
  if (
    action.type === 'ACCEPT_REPAIR_DEBT' ||
    action.type === 'CONTINUE_TO_NEXT_WEEK' ||
    action.type === 'CONFIRM_ONLY_REACHABLE_SCHEDULE'
  ) {
    return exact()
  }
  if (action.type === 'SET_PAUSED') {
    return exact('paused') && typeof action.paused === 'boolean'
  }
  return false
}

function baseActionId(actionId) {
  return actionId.split(':')[0]
}

function validV2ActionHistory(actions, actionsById) {
  const reversibleStates = new Map()
  const scheduleActivityByBlock = new Map()
  for (const action of actions) {
    if (action.type === 'EDIT_SCHEDULE') {
      const current = scheduleActivityByBlock.get(action.blockId)
      if (current !== undefined && current !== action.fromActivity) {
        return false
      }
      scheduleActivityByBlock.set(
        action.blockId,
        action.toActivity,
      )
      reversibleStates.set(action.id, true)
      continue
    }
    if (action.type !== 'UNDO' && action.type !== 'REDO') continue
    const targetId =
      action.type === 'UNDO'
        ? action.revertsActionId
        : action.replaysActionId
    const target = actionsById.get(targetId)
    const requiredState = action.type === 'UNDO'
    if (
      target?.type !== 'EDIT_SCHEDULE' ||
      reversibleStates.get(targetId) !== requiredState ||
      scheduleActivityByBlock.get(target.blockId) !==
        (
          action.type === 'UNDO'
            ? target.toActivity
            : target.fromActivity
        )
    ) {
      return false
    }
    reversibleStates.set(targetId, !requiredState)
    scheduleActivityByBlock.set(
      target.blockId,
      action.type === 'UNDO'
        ? target.fromActivity
        : target.toActivity,
    )
  }
  return true
}

function actionTimingById(actions, telemetry) {
  const applied = telemetry.filter(
    (entry) => entry.type === 'player-action-applied',
  )
  const timing = new Map()
  for (const entry of applied) {
    if (timing.has(entry.actionId)) return null
    timing.set(entry.actionId, entry.atTick)
  }
  const baseIds = [
    ...new Set(actions.map((action) => baseActionId(action.id))),
  ]
  const telemetryActionIds = applied.map((entry) => entry.actionId)
  const actionSequenceNumbers = baseIds.map((actionId) =>
    Number(/^action-(\d+)$/.exec(actionId)?.[1]),
  )
  if (
    timing.size !== baseIds.length ||
    !baseIds.every((actionId) => timing.has(actionId)) ||
    !sameOrderedValues(baseIds, telemetryActionIds) ||
    actionSequenceNumbers.some(
      (sequence, index) =>
        !Number.isInteger(sequence) ||
        (
          index > 0 &&
          sequence <= actionSequenceNumbers[index - 1]
        ),
    ) ||
    actions.some(
      (action) =>
        Object.hasOwn(action, 'atTick') &&
        action.atTick !== timing.get(baseActionId(action.id)),
    )
  ) {
    return null
  }
  return timing
}

function validV2ChoiceSet(choiceSet) {
  return (
    isRecord(choiceSet) &&
    hasExactKeys(choiceSet, [
      'choiceSetId',
      'decisionIntentId',
      'options',
      'selectedOptionId',
    ]) &&
    typeof choiceSet.choiceSetId === 'string' &&
    typeof choiceSet.decisionIntentId === 'string' &&
    (
      choiceSet.selectedOptionId === null ||
      typeof choiceSet.selectedOptionId === 'string'
    ) &&
    Array.isArray(choiceSet.options) &&
    choiceSet.options.length >= 2 &&
    new Set(choiceSet.options.map((option) => option?.optionId)).size ===
      choiceSet.options.length &&
    choiceSet.options.every(
      (option) =>
        isRecord(option) &&
        hasExactKeys(option, [
          'dominanceStatus',
          'optionId',
          'reachable',
          'visibleConsequenceRefs',
        ]) &&
        typeof option.optionId === 'string' &&
        typeof option.reachable === 'boolean' &&
        Array.isArray(option.visibleConsequenceRefs) &&
        option.visibleConsequenceRefs.every(
          (reference) => typeof reference === 'string',
        ) &&
        ['non-dominated', 'dominated', 'unverified'].includes(
          option.dominanceStatus,
        ),
    ) &&
    (
      choiceSet.selectedOptionId === null ||
      choiceSet.options.some(
        (option) => option.optionId === choiceSet.selectedOptionId,
      )
    )
  )
}

function validV2LegacyGroup(group, actionsById) {
  if (
    !(
    isRecord(group) &&
    hasExactKeys(group, ['actionIds', 'groupId']) &&
    /^legacy:w[01]:(?:food-plan|lin-he-study|transport-route)$/.test(
      group.groupId ?? '',
    ) &&
    Array.isArray(group.actionIds) &&
    group.actionIds.length > 0 &&
    new Set(group.actionIds).size === group.actionIds.length &&
    group.actionIds.every((actionId) => actionsById.has(actionId))
    )
  ) {
    return false
  }
  const actions = group.actionIds.map((actionId) =>
    actionsById.get(actionId),
  )
  if (group.groupId === 'legacy:w0:food-plan') {
    return actions.every((action) => {
      if (
        action.type === 'EDIT_SCHEDULE' &&
        action.blockId === 'qiao-pan:d1:b1'
      ) {
        return true
      }
      const targetId =
        action.type === 'UNDO'
          ? action.revertsActionId
          : action.type === 'REDO'
            ? action.replaysActionId
            : null
      const target = targetId === null ? null : actionsById.get(targetId)
      return (
        target?.type === 'EDIT_SCHEDULE' &&
        target.blockId === 'qiao-pan:d1:b1'
      )
    })
  }
  if (group.groupId === 'legacy:w1:lin-he-study') {
    return actions.every(
      (action) =>
        action.type === 'RESOLVE_LIN_HE_REQUEST' &&
        action.resolution === 'accepted',
    )
  }
  const weekIndex = Number(group.groupId[8])
  return actions.every(
    (action) =>
      action.type === 'OPEN_TRANSPORT_SHORTCUT' &&
      action.weekIndex === weekIndex,
  )
}

function validV2CommitmentGroup(group, actionIds, choiceSetsById) {
  if (
    !isRecord(group) ||
    !hasExactKeys(group, [
      'actionIds',
      'beforeDecisionStateHash',
      'choiceSetId',
      'consequenceRefs',
      'decisionIntentId',
      'finalDecisionStateHash',
      'finalDisposition',
      'finalOutcomeCode',
      'problemCategory',
      'weekIndex',
    ]) ||
    ![0, 1].includes(group.weekIndex) ||
    !['food', 'repair', 'character-request', 'transport', 'asset-use'].includes(
      group.problemCategory,
    ) ||
    typeof group.decisionIntentId !== 'string' ||
    typeof group.choiceSetId !== 'string' ||
    choiceSetsById.get(group.choiceSetId)?.decisionIntentId !==
      group.decisionIntentId ||
    !Array.isArray(group.actionIds) ||
    group.actionIds.length === 0 ||
    new Set(group.actionIds).size !== group.actionIds.length ||
    !group.actionIds.every((actionId) => actionIds.has(actionId)) ||
    !Array.isArray(group.consequenceRefs) ||
    !group.consequenceRefs.every(
      (reference) =>
        isRecord(reference) &&
        hasExactKeys(reference, ['id', 'kind']) &&
        ['forecast', 'schedule', 'inventory', 'risk', 'character-record', 'recap'].includes(
          reference.kind,
        ) &&
        typeof reference.id === 'string',
    ) ||
    !ARTIFACT_HASH_PATTERN.test(group.beforeDecisionStateHash ?? '') ||
    !ARTIFACT_HASH_PATTERN.test(group.finalDecisionStateHash ?? '') ||
    typeof group.finalOutcomeCode !== 'string' ||
    !['committed', 'reverted', 'default-maintained'].includes(
      group.finalDisposition,
    )
  ) {
    return false
  }
  const choiceSet = choiceSetsById.get(group.choiceSetId)
  if (
    (
      group.finalDisposition === 'committed' &&
      (
        choiceSet.selectedOptionId === null ||
        !group.finalOutcomeCode.startsWith('committed:') ||
        group.beforeDecisionStateHash ===
          group.finalDecisionStateHash
      )
    ) ||
    (
      group.finalDisposition === 'reverted' &&
      (
        choiceSet.selectedOptionId !== null ||
        group.finalOutcomeCode !== 'reverted' ||
        group.beforeDecisionStateHash !==
          group.finalDecisionStateHash
      )
    )
  ) {
    return false
  }
  if (
    group.finalOutcomeCode.startsWith('committed:schedule:') &&
    group.finalOutcomeCode !==
      `committed:schedule:${group.finalDecisionStateHash}`
  ) {
    return false
  }
  return true
}

function actionBelongsToIntent(
  action,
  decisionIntentId,
  actionsById,
  visited = new Set(),
) {
  if (!isRecord(action)) return false
  if (visited.has(action.id)) return false
  visited.add(action.id)
  if (decisionIntentId === 'w0:food-plan') {
    if (action.type === 'SET_FOOD_SHORTFALL_ACCEPTED') return true
    if (
      action.type === 'EDIT_SCHEDULE' &&
      action.blockId === 'qiao-pan:d1:b1'
    ) {
      return true
    }
  } else if (
    decisionIntentId ===
    'w0:repair-responsibility:pump-incident-day-3'
  ) {
    if (action.type === 'ACCEPT_REPAIR_DEBT') return true
    if (
      action.type === 'EDIT_SCHEDULE' &&
      [
        'qiao-pan:d3:b2',
        'chen-du:d3:b0',
        'su-ji:d3:b0',
      ].includes(action.blockId)
    ) {
      return true
    }
  } else if (
    decisionIntentId ===
    'w1:character-request:lin-he-study'
  ) {
    return action.type === 'RESOLVE_LIN_HE_REQUEST'
  } else if (/^w[01]:transport-route$/.test(decisionIntentId)) {
    return (
      action.type === 'OPEN_TRANSPORT_SHORTCUT' &&
      decisionIntentId === `w${action.weekIndex}:transport-route`
    )
  } else if (/^w[01]:asset-use:fertilizer$/.test(decisionIntentId)) {
    return (
      action.type === 'USE_FERTILIZER' &&
      decisionIntentId ===
        `w${action.weekIndex}:asset-use:fertilizer`
    )
  }
  const targetId =
    action.type === 'UNDO'
      ? action.revertsActionId
      : action.type === 'REDO'
        ? action.replaysActionId
        : null
  return (
    targetId !== null &&
    actionBelongsToIntent(
      actionsById.get(targetId),
      decisionIntentId,
      actionsById,
      visited,
    )
  )
}

function actionIsExplicitlyActive(
  actionId,
  groupActionIds,
  actionsById,
) {
  const owned = new Set(groupActionIds)
  let active = true
  for (const action of actionsById.values()) {
    if (!owned.has(action.id)) continue
    if (
      action.type === 'UNDO' &&
      action.revertsActionId === actionId
    ) {
      active = false
    } else if (
      action.type === 'REDO' &&
      action.replaysActionId === actionId
    ) {
      active = true
    }
  }
  return active
}

function actionDeterminesFinalState(
  actionId,
  groupActionIds,
  actionsById,
) {
  if (
    !actionIsExplicitlyActive(
      actionId,
      groupActionIds,
      actionsById,
    )
  ) {
    return false
  }
  const target = actionsById.get(actionId)
  if (target?.type === 'SET_FOOD_SHORTFALL_ACCEPTED') {
    let afterTarget = false
    for (const action of actionsById.values()) {
      if (action.id === actionId) {
        afterTarget = true
        continue
      }
      if (
        afterTarget &&
        groupActionIds.includes(action.id) &&
        action.type === 'SET_FOOD_SHORTFALL_ACCEPTED'
      ) {
        return false
      }
    }
    return true
  }
  if (target?.type !== 'EDIT_SCHEDULE') return true
  let afterTarget = false
  for (const action of actionsById.values()) {
    if (action.id === actionId) {
      afterTarget = true
      continue
    }
    if (
      afterTarget &&
      groupActionIds.includes(action.id) &&
      action.type === 'EDIT_SCHEDULE' &&
      action.blockId === target.blockId &&
      actionIsExplicitlyActive(
        action.id,
        groupActionIds,
        actionsById,
      )
    ) {
      return false
    }
  }
  return true
}

function actionIdsForScheduleBlocks(actions, blockIds) {
  const blocks = new Set(blockIds)
  const editIds = new Set(
    actions
      .filter(
        (action) =>
          action.type === 'EDIT_SCHEDULE' &&
          blocks.has(action.blockId),
      )
      .map((action) => action.id),
  )
  return actions
    .filter((action) => {
      if (editIds.has(action.id)) return true
      if (action.type === 'UNDO') {
        return editIds.has(action.revertsActionId)
      }
      if (action.type === 'REDO') {
        return editIds.has(action.replaysActionId)
      }
      return false
    })
    .map((action) => action.id)
}

function replaySchedule(actionsById, actionIds, initialActivities) {
  const current = new Map(initialActivities)
  for (const actionId of actionIds) {
    const action = actionsById.get(actionId)
    if (action?.type === 'EDIT_SCHEDULE') {
      if (current.get(action.blockId) !== action.fromActivity) {
        return null
      }
      current.set(action.blockId, action.toActivity)
    } else if (action?.type === 'UNDO') {
      const target = actionsById.get(action.revertsActionId)
      if (
        target?.type !== 'EDIT_SCHEDULE' ||
        current.get(target.blockId) !== target.toActivity
      ) {
        return null
      }
      current.set(target.blockId, target.fromActivity)
    } else if (action?.type === 'REDO') {
      const target = actionsById.get(action.replaysActionId)
      if (
        target?.type !== 'EDIT_SCHEDULE' ||
        current.get(target.blockId) !== target.fromActivity
      ) {
        return null
      }
      current.set(target.blockId, target.toActivity)
    }
  }
  return current
}

function choiceOptionsForIntent(decisionIntentId, foodScheduleReachable) {
  if (decisionIntentId === 'w0:food-plan') {
    return [
      {
        optionId: 'food-shift-qiao',
        reachable: foodScheduleReachable,
        visibleConsequenceRefs: [
          'forecast:w0:food',
          'forecast:w0:repair',
          `schedule:${FOOD_SCHEDULE_BLOCK_ID}`,
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'accept-food-gap',
        reachable: true,
        visibleConsequenceRefs: [
          'forecast:w0:food',
          'forecast:w0:repair',
        ],
        dominanceStatus: 'non-dominated',
      },
    ]
  }
  if (
    decisionIntentId ===
    'w0:repair-responsibility:pump-incident-day-3'
  ) {
    return [
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
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'accept-debt',
        reachable: true,
        visibleConsequenceRefs: [
          'recap:w0:repair',
          'risk:repair-debt',
        ],
        dominanceStatus: 'non-dominated',
      },
    ]
  }
  if (decisionIntentId === 'w1:character-request:lin-he-study') {
    return [
      {
        optionId: 'accept-study',
        reachable: true,
        visibleConsequenceRefs: [
          'forecast:w1:food',
          'schedule:lin-he:d8:b0',
          'character-record:lin-he-study',
        ],
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'decline-study',
        reachable: true,
        visibleConsequenceRefs: [
          'forecast:w1:food',
          'character-record:lin-he-study-declined',
        ],
        dominanceStatus: 'non-dominated',
      },
    ]
  }
  const transport = /^w([01]):transport-route$/.exec(decisionIntentId)
  if (transport) {
    const weekIndex = Number(transport[1])
    const refs = [
      `forecast:w${weekIndex}:food`,
      `risk:w${weekIndex}:transport-loss`,
    ]
    return [
      {
        optionId: 'north-loop',
        reachable: true,
        visibleConsequenceRefs: refs,
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'south-shortcut',
        reachable: true,
        visibleConsequenceRefs: refs,
        dominanceStatus: 'non-dominated',
      },
    ]
  }
  const fertilizer = /^w([01]):asset-use:fertilizer$/.exec(
    decisionIntentId,
  )
  if (fertilizer) {
    const weekIndex = Number(fertilizer[1])
    const refs = [
      `forecast:w${weekIndex}:food`,
      'inventory:fertilizer',
    ]
    return [
      {
        optionId: 'use-fertilizer',
        reachable: true,
        visibleConsequenceRefs: refs,
        dominanceStatus: 'non-dominated',
      },
      {
        optionId: 'keep-fertilizer',
        reachable: true,
        visibleConsequenceRefs: refs,
        dominanceStatus: 'non-dominated',
      },
    ]
  }
  return null
}

function validChoiceOracle(choiceSet, expected) {
  return (
    choiceSet.choiceSetId === expected.choiceSetId &&
    choiceSet.decisionIntentId === expected.decisionIntentId &&
    choiceSet.selectedOptionId === expected.selectedOptionId &&
    sameOrderedValues(choiceSet.options, expected.options)
  )
}

function consequenceIds(group) {
  return group.consequenceRefs.map(
    (reference) => `${reference.kind}:${reference.id}`,
  )
}

function validCommitmentOracle(group, expected) {
  return (
    group.decisionIntentId === expected.decisionIntentId &&
    group.choiceSetId === expected.choiceSetId &&
    group.weekIndex === expected.weekIndex &&
    group.problemCategory === expected.problemCategory &&
    sameOrderedValues(group.actionIds, expected.actionIds) &&
    sameStringSet(consequenceIds(group), expected.consequenceRefs) &&
    group.beforeDecisionStateHash ===
      expected.beforeDecisionStateHash &&
    group.finalDecisionStateHash ===
      expected.finalDecisionStateHash &&
    group.finalOutcomeCode === expected.finalOutcomeCode &&
    group.finalDisposition === expected.finalDisposition
  )
}

function validV2SemanticContract(
  value,
  actionsById,
  choiceSetsById,
  actionTiming,
) {
  const actions = [...actionsById.values()]
  const timingFor = (action) =>
    actionTiming.get(baseActionId(action.id))

  const foodScheduleActions = actions.filter(
    (action) =>
      action.type === 'EDIT_SCHEDULE' &&
      action.blockId === FOOD_SCHEDULE_BLOCK_ID,
  )
  const foodScheduleActionIds = actionIdsForScheduleBlocks(
    actions,
    [FOOD_SCHEDULE_BLOCK_ID],
  )
  const foodScheduleOptionStarted =
    foodScheduleActions.length > 0 &&
    foodScheduleActions[0].fromActivity === 'repair' &&
    foodScheduleActions[0].toActivity === 'food'
  if (
    foodScheduleActions.some(
      (action) =>
        timingFor(action) >= FOOD_SCHEDULE_BLOCK_END_TICK,
    )
  ) {
    return false
  }
  const weekOneFoodShortfallActions = actions.filter(
    (action) =>
      action.type === 'SET_FOOD_SHORTFALL_ACCEPTED' &&
      weekIndexForV2Tick(timingFor(action)) === 0,
  )
  const foodActionIdSet = new Set([
    ...(foodScheduleOptionStarted ? foodScheduleActionIds : []),
    ...weekOneFoodShortfallActions.map((action) => action.id),
  ])
  const foodActionIds = actions
    .filter((action) => foodActionIdSet.has(action.id))
    .map((action) => action.id)
  const firstFoodTick =
    foodActionIds.length === 0
      ? null
      : Math.min(
          ...foodActionIds.map((actionId) =>
            timingFor(actionsById.get(actionId)),
          ),
        )
  const foodScheduleReachable =
    firstFoodTick !== null &&
    firstFoodTick < FOOD_SCHEDULE_BLOCK_END_TICK
  let foodScheduleFinal = null
  let foodBeforeProjection = null
  let foodFinalProjection = null
  if (foodActionIds.length > 0) {
    const initialSchedule =
      foodScheduleActions.length === 0
        ? new Map()
        : new Map([
            [
              FOOD_SCHEDULE_BLOCK_ID,
              foodScheduleActions[0].fromActivity,
            ],
          ])
    const finalSchedule = replaySchedule(
      actionsById,
      foodScheduleActionIds,
      initialSchedule,
    )
    if (finalSchedule === null) return false
    foodScheduleFinal =
      finalSchedule.get(FOOD_SCHEDULE_BLOCK_ID) ?? null
    let accepted = false
    for (const action of weekOneFoodShortfallActions) {
      accepted = action.accepted
    }
    const scheduleSelected =
      foodScheduleOptionStarted && foodScheduleFinal === 'food'
    const foodConflict = accepted && scheduleSelected
    const selectedOptionId = foodConflict
      ? null
      : accepted
        ? 'accept-food-gap'
        : scheduleSelected
          ? 'food-shift-qiao'
          : null
    const expectedChoice = {
      choiceSetId: 'choice:w0:food-plan',
      decisionIntentId: 'w0:food-plan',
      options: choiceOptionsForIntent(
        'w0:food-plan',
        foodScheduleReachable,
      ),
      selectedOptionId,
    }
    const actualChoice = choiceSetsById.get(expectedChoice.choiceSetId)
    if (
      actualChoice === undefined ||
      !validChoiceOracle(actualChoice, expectedChoice)
    ) {
      return false
    }
    foodBeforeProjection = {
      ...(!foodScheduleOptionStarted
        ? {}
        : {
            scheduleCells: [
              `${FOOD_SCHEDULE_BLOCK_ID}=${foodScheduleActions[0].fromActivity}`,
            ],
          }),
      ...(weekOneFoodShortfallActions.length === 0
        ? {}
        : { foodShortfallAccepted: false }),
    }
    foodFinalProjection = {
      ...(!foodScheduleOptionStarted
        ? {}
        : {
            scheduleCells: [
              `${FOOD_SCHEDULE_BLOCK_ID}=${foodScheduleFinal}`,
            ],
          }),
      ...(weekOneFoodShortfallActions.length === 0
        ? {}
        : { foodShortfallAccepted: accepted }),
    }
  }

  const repairQualifyingActions = actions.filter(
    (action) =>
      action.type === 'EDIT_SCHEDULE' &&
      action.responsibility === 'scheduled' &&
      REPAIR_BLOCK_DEFAULTS.has(action.blockId) &&
      action.fromActivity ===
        REPAIR_BLOCK_DEFAULTS.get(action.blockId) &&
      action.toActivity === 'repair',
  )
  const repairBlockIds = [
    ...new Set(
      repairQualifyingActions.map((action) => action.blockId),
    ),
  ]
  const repairActionIds = actionIdsForScheduleBlocks(
    actions,
    repairBlockIds,
  )
  const repairFinalSchedule = replaySchedule(
    actionsById,
    repairActionIds,
    new Map(
      repairBlockIds.map((blockId) => [
        blockId,
        REPAIR_BLOCK_DEFAULTS.get(blockId),
      ]),
    ),
  )
  if (repairFinalSchedule === null) return false
  const finalRepairActions = repairQualifyingActions.filter(
    (action) =>
      actionDeterminesFinalState(
        action.id,
        repairActionIds,
        actionsById,
      ) &&
      repairFinalSchedule.get(action.blockId) === 'repair',
  )
  if (finalRepairActions.length > 1) return false
  const repairDebtActions = actions.filter(
    (action) => action.type === 'ACCEPT_REPAIR_DEBT',
  )
  if (
    repairQualifyingActions.some(
      (action) => weekIndexForV2Tick(timingFor(action)) !== 0,
    ) ||
    repairDebtActions.some(
      (action) => weekIndexForV2Tick(timingFor(action)) !== 0,
    )
  ) {
    return false
  }
  if (
    repairDebtActions.length > 0 &&
    repairQualifyingActions.length > 0
  ) {
    return false
  }

  const requestActions = actions.filter(
    (action) => action.type === 'RESOLVE_LIN_HE_REQUEST',
  )
  if (requestActions.length > 1) return false
  const persistentRequestActions = requestActions.filter(
    (action) =>
      action.resolution === 'accepted' ||
      action.persistentCharacterRecord === true,
  )
  if (
    persistentRequestActions.some(
      (action) => weekIndexForV2Tick(timingFor(action)) !== 1,
    )
  ) {
    return false
  }
  const transportActions = actions.filter(
    (action) => action.type === 'OPEN_TRANSPORT_SHORTCUT',
  )
  const fertilizerActions = actions.filter(
    (action) => action.type === 'USE_FERTILIZER',
  )

  const expectedChoices = []
  if (foodActionIds.length > 0) {
    expectedChoices.push('choice:w0:food-plan')
  }
  if (
    repairQualifyingActions.length > 0 ||
    repairDebtActions.length > 0
  ) {
    const selectedOptionId =
      repairDebtActions.length > 0
        ? 'accept-debt'
        : finalRepairActions.length === 1
          ? 'schedule-repair'
          : null
    const expected = {
      choiceSetId: 'choice:w0:pump-repair',
      decisionIntentId:
        'w0:repair-responsibility:pump-incident-day-3',
      options: choiceOptionsForIntent(
        'w0:repair-responsibility:pump-incident-day-3',
      ),
      selectedOptionId,
    }
    const actual = choiceSetsById.get(expected.choiceSetId)
    if (actual === undefined || !validChoiceOracle(actual, expected)) {
      return false
    }
    expectedChoices.push(expected.choiceSetId)
  }
  if (persistentRequestActions.length > 0) {
    const request = persistentRequestActions[0]
    const selectedOptionId =
      request.resolution === 'accepted'
        ? 'accept-study'
        : 'decline-study'
    const expected = {
      choiceSetId: 'choice:w1:lin-he-study',
      decisionIntentId: 'w1:character-request:lin-he-study',
      options: choiceOptionsForIntent(
        'w1:character-request:lin-he-study',
      ),
      selectedOptionId,
    }
    const actual = choiceSetsById.get(expected.choiceSetId)
    if (actual === undefined || !validChoiceOracle(actual, expected)) {
      return false
    }
    expectedChoices.push(expected.choiceSetId)
  }
  for (const action of transportActions) {
    const weekIndex = action.weekIndex
    const decisionIntentId = `w${weekIndex}:transport-route`
    const expected = {
      choiceSetId: `choice:w${weekIndex}:transport-route`,
      decisionIntentId,
      options: choiceOptionsForIntent(decisionIntentId),
      selectedOptionId: 'south-shortcut',
    }
    const actual = choiceSetsById.get(expected.choiceSetId)
    if (actual === undefined || !validChoiceOracle(actual, expected)) {
      return false
    }
    expectedChoices.push(expected.choiceSetId)
  }
  for (const action of fertilizerActions) {
    const weekIndex = action.weekIndex
    const decisionIntentId = `w${weekIndex}:asset-use:fertilizer`
    const expected = {
      choiceSetId: `choice:w${weekIndex}:fertilizer`,
      decisionIntentId,
      options: choiceOptionsForIntent(decisionIntentId),
      selectedOptionId: 'use-fertilizer',
    }
    const actual = choiceSetsById.get(expected.choiceSetId)
    if (actual === undefined || !validChoiceOracle(actual, expected)) {
      return false
    }
    expectedChoices.push(expected.choiceSetId)
  }
  if (
    choiceSetsById.size !== expectedChoices.length ||
    !expectedChoices.every((choiceSetId) =>
      choiceSetsById.has(choiceSetId),
    )
  ) {
    return false
  }

  const expectedLegacyGroups = []
  if (foodScheduleActionIds.length > 0) {
    expectedLegacyGroups.push({
      groupId: 'legacy:w0:food-plan',
      actionIds: foodScheduleActionIds,
    })
  }
  const acceptedRequestIds = requestActions
    .filter((action) => action.resolution === 'accepted')
    .map((action) => action.id)
  if (acceptedRequestIds.length > 0) {
    expectedLegacyGroups.push({
      groupId: 'legacy:w1:lin-he-study',
      actionIds: acceptedRequestIds,
    })
  }
  for (const action of transportActions) {
    expectedLegacyGroups.push({
      groupId: `legacy:w${action.weekIndex}:transport-route`,
      actionIds: [action.id],
    })
  }
  if (
    !sameOrderedValues(
      value.candidateEditGroups,
      expectedLegacyGroups,
    )
  ) {
    return false
  }

  const expectedCommitments = []
  if (
    foodActionIds.length > 0 &&
    foodScheduleReachable
  ) {
    const choice = choiceSetsById.get('choice:w0:food-plan')
    const scheduleSelected =
      choice.selectedOptionId === 'food-shift-qiao'
    const shortfallSelected =
      choice.selectedOptionId === 'accept-food-gap'
    const foodConflict =
      foodScheduleFinal === 'food' &&
      weekOneFoodShortfallActions.at(-1)?.accepted === true
    const supportedScheduleFinal =
      !foodScheduleOptionStarted ||
      ['repair', 'food'].includes(foodScheduleFinal)
    if (!foodConflict && supportedScheduleFinal) {
      const beforeHash = decisionHash(
        'w0:food-plan',
        foodBeforeProjection,
      )
      const finalHash = decisionHash(
        'w0:food-plan',
        foodFinalProjection,
      )
      const reverted = beforeHash === finalHash
      expectedCommitments.push({
        decisionIntentId: 'w0:food-plan',
        choiceSetId: 'choice:w0:food-plan',
        weekIndex: 0,
        problemCategory: 'food',
        actionIds: foodActionIds,
        consequenceRefs:
          foodScheduleOptionStarted
            ? reverted
              ? [`schedule:${FOOD_SCHEDULE_BLOCK_ID}`]
              : [
                  `schedule:${FOOD_SCHEDULE_BLOCK_ID}`,
                  'forecast:w0:food',
                  'forecast:w0:repair',
                ]
            : reverted
              ? ['forecast:w0:food']
              : ['forecast:w0:food', 'forecast:w0:repair'],
        beforeDecisionStateHash: beforeHash,
        finalDecisionStateHash: finalHash,
        finalOutcomeCode: reverted
          ? 'reverted'
          : scheduleSelected
            ? `committed:schedule:${finalHash}`
            : shortfallSelected
              ? 'committed:accept-food-gap'
              : '',
        finalDisposition: reverted ? 'reverted' : 'committed',
      })
    }
  }

  if (repairDebtActions.length > 0) {
    const action = repairDebtActions[0]
    const beforeProjection = {
      repairResponsibility: 'unresolved',
      repairDebt: null,
    }
    const finalProjection = {
      repairResponsibility: 'debt',
      repairDebt: {
        dueTick: 2010,
        weeklyPenalty: 3,
      },
    }
    expectedCommitments.push({
      decisionIntentId:
        'w0:repair-responsibility:pump-incident-day-3',
      choiceSetId: 'choice:w0:pump-repair',
      weekIndex: 0,
      problemCategory: 'repair',
      actionIds: [action.id],
      consequenceRefs: [
        'risk:repair-debt',
        'recap:w0:repair',
      ],
      beforeDecisionStateHash: decisionHash(
        'w0:repair-responsibility:pump-incident-day-3',
        beforeProjection,
      ),
      finalDecisionStateHash: decisionHash(
        'w0:repair-responsibility:pump-incident-day-3',
        finalProjection,
      ),
      finalOutcomeCode: 'committed:accept-debt',
      finalDisposition: 'committed',
    })
  } else if (repairQualifyingActions.length > 0) {
    const beforeProjection = {
      repairResponsibility: 'unresolved',
      scheduleCells: repairBlockIds.map(
        (blockId) =>
          `${blockId}=${REPAIR_BLOCK_DEFAULTS.get(blockId)}`,
      ),
    }
    const finalProjection = {
      repairResponsibility:
        finalRepairActions.length === 1
          ? 'scheduled'
          : 'unresolved',
      scheduleCells: repairBlockIds.map(
        (blockId) =>
          `${blockId}=${repairFinalSchedule.get(blockId)}`,
      ),
    }
    const beforeHash = decisionHash(
      'w0:repair-responsibility:pump-incident-day-3',
      beforeProjection,
    )
    const finalHash = decisionHash(
      'w0:repair-responsibility:pump-incident-day-3',
      finalProjection,
    )
    const reverted = beforeHash === finalHash
    const finalRepairAction = finalRepairActions[0]
    if (reverted || finalRepairAction !== undefined) {
      expectedCommitments.push({
        decisionIntentId:
          'w0:repair-responsibility:pump-incident-day-3',
        choiceSetId: 'choice:w0:pump-repair',
        weekIndex: 0,
        problemCategory: 'repair',
        actionIds: repairActionIds,
        consequenceRefs: reverted
          ? repairBlockIds.map((blockId) => `schedule:${blockId}`)
          : [
              'forecast:w0:repair',
              'risk:pump',
              `schedule:${finalRepairAction.blockId}`,
            ],
        beforeDecisionStateHash: beforeHash,
        finalDecisionStateHash: finalHash,
        finalOutcomeCode: reverted
          ? 'reverted'
          : 'committed:schedule-repair',
        finalDisposition: reverted ? 'reverted' : 'committed',
      })
    }
  }

  if (persistentRequestActions.length > 0) {
    const request = persistentRequestActions[0]
    const accepted = request.resolution === 'accepted'
    const beforeProjection = {
      resolution: 'pending',
      scheduleCells: ['lin-he:d8:b0=food'],
    }
    const finalProjection = {
      resolution: request.resolution,
      scheduleCells: [
        `lin-he:d8:b0=${accepted ? 'study' : 'food'}`,
      ],
      characterRecord: {
        linHeStudy: request.resolution,
      },
    }
    expectedCommitments.push({
      decisionIntentId: 'w1:character-request:lin-he-study',
      choiceSetId: 'choice:w1:lin-he-study',
      weekIndex: 1,
      problemCategory: 'character-request',
      actionIds: [request.id],
      consequenceRefs: accepted
        ? [
            'schedule:lin-he:d8:b0',
            'character-record:lin-he-study',
          ]
        : ['character-record:lin-he-study-declined'],
      beforeDecisionStateHash: decisionHash(
        'w1:character-request:lin-he-study',
        beforeProjection,
      ),
      finalDecisionStateHash: decisionHash(
        'w1:character-request:lin-he-study',
        finalProjection,
      ),
      finalOutcomeCode: `committed:${
        accepted ? 'accept-study' : 'decline-study'
      }`,
      finalDisposition: 'committed',
    })
  }

  for (const action of transportActions) {
    const decisionIntentId = `w${action.weekIndex}:transport-route`
    expectedCommitments.push({
      decisionIntentId,
      choiceSetId: `choice:w${action.weekIndex}:transport-route`,
      weekIndex: action.weekIndex,
      problemCategory: 'transport',
      actionIds: [action.id],
      consequenceRefs: [
        `forecast:w${action.weekIndex}:food`,
        `risk:w${action.weekIndex}:transport-loss`,
      ],
      beforeDecisionStateHash: decisionHash(decisionIntentId, {
        transportRoute: 'north-loop',
      }),
      finalDecisionStateHash: decisionHash(decisionIntentId, {
        transportRoute: 'south-shortcut',
      }),
      finalOutcomeCode: 'committed:south-shortcut',
      finalDisposition: 'committed',
    })
  }

  for (const action of fertilizerActions) {
    const decisionIntentId =
      `w${action.weekIndex}:asset-use:fertilizer`
    expectedCommitments.push({
      decisionIntentId,
      choiceSetId: `choice:w${action.weekIndex}:fertilizer`,
      weekIndex: action.weekIndex,
      problemCategory: 'asset-use',
      actionIds: [action.id],
      consequenceRefs: [
        `forecast:w${action.weekIndex}:food`,
        'inventory:fertilizer',
      ],
      beforeDecisionStateHash: decisionHash(decisionIntentId, {
        fertilizer: {
          remainingUnits: 1,
          appliedWeekIndex: null,
        },
      }),
      finalDecisionStateHash: decisionHash(decisionIntentId, {
        fertilizer: {
          remainingUnits: 0,
          appliedWeekIndex: action.weekIndex,
        },
      }),
      finalOutcomeCode: 'committed:use-fertilizer',
      finalDisposition: 'committed',
    })
  }

  if (
    value.candidateManagementCommitmentGroups.length !==
    expectedCommitments.length
  ) {
    return false
  }
  return expectedCommitments.every((expected, index) =>
    validCommitmentOracle(
      value.candidateManagementCommitmentGroups[index],
      expected,
    ),
  )
}

function validV2Export(value, buildMetadata) {
  const isBlocked = value?.captureKind === 'blocked'
  if (
    !isRecord(value) ||
    value.schemaVersion !== 'gate1-playtest-v2' ||
    !['complete', 'blocked'].includes(value.captureKind) ||
    !hasExactKeys(
      value,
      isBlocked ? V2_BLOCKED_EXPORT_KEYS : V2_EXPORT_KEYS,
    ) ||
    REQUIRED_V2_ARRAYS.some((key) => !Array.isArray(value[key])) ||
    REQUIRED_OBJECTS.some((key) => !isRecord(value[key])) ||
    !isRecord(value.meta) ||
    !hasExactKeys(value.meta, META_KEYS) ||
    !INITIAL_STATE_HASH_PATTERN.test(value.finalStateHash ?? '') ||
    !hasExactKeys(value.finalState, FINAL_STATE_KEYS)
  ) {
    return false
  }

  const { meta } = value
  if (
    !SAMPLE_ID_V2_PATTERN.test(meta.sampleId ?? '') ||
    meta.sampleId.length > 20 ||
    !SESSION_ID_PATTERN.test(meta.sessionId ?? '') ||
    !BUILD_ID_PATTERN.test(meta.buildId ?? '') ||
    meta.buildId !== buildMetadata.buildId ||
    !GIT_SHA_PATTERN.test(meta.gitSha ?? '') ||
    meta.gitSha !== buildMetadata.gitSha ||
    !ARTIFACT_HASH_PATTERN.test(meta.artifactHash ?? '') ||
    meta.artifactHash !== buildMetadata.artifactHash ||
    !INITIAL_STATE_HASH_PATTERN.test(meta.initialStateHash ?? '') ||
    meta.initialStateHash !== buildMetadata.initialStateHash ||
    meta.scenarioId !== 'gate1-two-week-management' ||
    meta.scenarioVersion !== '0.5.0' ||
    meta.fixedSeed !== 104729 ||
    !/^\d+x\d+$/.test(meta.viewport ?? '') ||
    meta.inputDevice !== 'browser-pointer-keyboard' ||
    !Array.isArray(value.finalState.processedScriptEventIds) ||
    !value.finalState.processedScriptEventIds.every(
      (eventId) => typeof eventId === 'string',
    )
  ) {
    return false
  }
  if (
    !validMachineTiming(value.machineTiming) ||
    !validDomainEvents(value.domainEvents) ||
    !validSpeedTrajectory(value.speedTrajectory) ||
    !validTelemetry(value.telemetry)
  ) {
    return false
  }
  const domainEventsById = new Map(
    value.domainEvents.map((event) => [event.eventId, event]),
  )
  if (
    domainEventsById.size !== value.domainEvents.length ||
    value.domainEvents.some(
      (event, index) =>
        event.atTick > value.finalTick ||
        (
          index > 0 &&
          event.atTick < value.domainEvents[index - 1].atTick
        ),
    ) ||
    value.telemetry.some(
      (entry) =>
        Array.isArray(entry.domainEventIds) &&
        entry.domainEventIds.some(
          (eventId) => {
            const domainEvent = domainEventsById.get(eventId)
            if (domainEvent === undefined) return true
            if (
              entry.type === 'player-action-applied' ||
              entry.type === 'simulation-advanced'
            ) {
              return (
                domainEvent.atTick < entry.fromTick ||
                domainEvent.atTick > entry.toTick
              )
            }
            return (
              entry.type === 'auto-pause-triggered' &&
              domainEvent.atTick !== entry.atTick
            )
          },
        ),
    ) ||
    value.telemetry.some(
      (entry, index) =>
        index > 0 &&
        (
          entry.machineOffsetMs <
            value.telemetry[index - 1].machineOffsetMs ||
          entry.atTick < value.telemetry[index - 1].atTick
        ),
    ) ||
    value.telemetry.some(
      (entry) => entry.atTick > value.finalTick,
    )
  ) {
    return false
  }
  const speedTelemetry = value.telemetry
    .filter((entry) => entry.type === 'speed-changed')
    .map(({ atTick, machineOffsetMs, speed }, index) => ({
      sequence: index + 1,
      atTick,
      machineOffsetMs,
      speed,
    }))
  if (!sameOrderedValues(value.speedTrajectory, speedTelemetry)) {
    return false
  }
  const terminalTelemetry = value.telemetry.at(-1)
  if (
    terminalTelemetry?.type !==
      (isBlocked
        ? 'blocked-capture-created'
        : 'export-created') ||
    terminalTelemetry.atTick !== value.finalTick
  ) {
    return false
  }

  const actionsById = new Map()
  for (const action of value.actions) {
    if (!validV2Action(action) || actionsById.has(action.id)) return false
    actionsById.set(action.id, action)
  }
  if (!validV2ActionHistory(value.actions, actionsById)) {
    return false
  }
  const actionTiming = actionTimingById(
    value.actions,
    value.telemetry,
  )
  if (actionTiming === null) return false
  if (
    [...actionsById.values()].filter(
      (action) => action.type === 'OPEN_TRANSPORT_SHORTCUT',
    ).length > 1 ||
    [...actionsById.values()].filter(
      (action) => action.type === 'USE_FERTILIZER',
    ).length > 1
  ) {
    return false
  }

  const choiceSetsById = new Map()
  for (const choiceSet of value.choiceSets) {
    if (
      !validV2ChoiceSet(choiceSet) ||
      choiceSetsById.has(choiceSet.choiceSetId)
    ) {
      return false
    }
    choiceSetsById.set(choiceSet.choiceSetId, choiceSet)
  }

  const legacyOwners = new Map()
  const legacyGroupIds = new Set()
  for (const group of value.candidateEditGroups) {
    if (
      !validV2LegacyGroup(group, actionsById) ||
      legacyGroupIds.has(group.groupId) ||
      group.actionIds.some((actionId) => legacyOwners.has(actionId))
    ) {
      return false
    }
    legacyGroupIds.add(group.groupId)
    for (const actionId of group.actionIds) legacyOwners.set(actionId, group)
  }

  const managementOwners = new Map()
  const managementKeys = new Set()
  for (const group of value.candidateManagementCommitmentGroups) {
    const key = `${group?.weekIndex}:${group?.decisionIntentId}`
    if (
      !validV2CommitmentGroup(group, actionsById, choiceSetsById) ||
      managementKeys.has(key) ||
      group.actionIds.some((actionId) => managementOwners.has(actionId)) ||
      group.actionIds.some(
        (actionId) =>
          !actionBelongsToIntent(
            actionsById.get(actionId),
            group.decisionIntentId,
            actionsById,
          ),
      )
    ) {
      return false
    }
    managementKeys.add(key)
    for (const actionId of group.actionIds) {
      managementOwners.set(actionId, group)
    }
  }

  for (const action of actionsById.values()) {
    const legacy = legacyOwners.get(action.id)
    const management = managementOwners.get(action.id)
    if (action.type === 'UNDO' || action.type === 'REDO') {
      const targetId =
        action.type === 'UNDO'
          ? action.revertsActionId
          : action.replaysActionId
      const targetManagement = managementOwners.get(targetId)
      const targetLegacy = legacyOwners.get(targetId)
      if (
        (targetManagement !== undefined &&
          management !== targetManagement) ||
        (targetLegacy !== undefined && legacy !== targetLegacy)
      ) {
        return false
      }
    }
    if (
      action.type === 'RESOLVE_LIN_HE_REQUEST' &&
      action.resolution === 'accepted' &&
      (
        legacy?.groupId !== 'legacy:w1:lin-he-study' ||
        management?.decisionIntentId !==
          'w1:character-request:lin-he-study'
      )
    ) {
      return false
    }
    if (
      action.type === 'RESOLVE_LIN_HE_REQUEST' &&
      action.resolution === 'declined' &&
      (
        legacy !== undefined ||
        (
          action.persistentCharacterRecord &&
          management?.decisionIntentId !==
            'w1:character-request:lin-he-study'
        )
      )
    ) {
      return false
    }
    if (
      action.type === 'OPEN_TRANSPORT_SHORTCUT' &&
      (
        legacy?.groupId !==
          `legacy:w${action.weekIndex}:transport-route` ||
        management?.decisionIntentId !==
          `w${action.weekIndex}:transport-route`
      )
    ) {
      return false
    }
    if (
      action.type === 'USE_FERTILIZER' &&
      management?.decisionIntentId !==
        `w${action.weekIndex}:asset-use:fertilizer`
    ) {
      return false
    }
    if (
      action.type === 'SET_FOOD_SHORTFALL_ACCEPTED' &&
      action.accepted &&
      management !== undefined &&
      management.decisionIntentId !== 'w0:food-plan'
    ) {
      return false
    }
    if (
      action.type === 'EDIT_SCHEDULE' &&
      action.blockId === 'qiao-pan:d1:b1' &&
      action.fromActivity === 'repair' &&
      action.toActivity === 'food' &&
      (
        legacy?.groupId !== 'legacy:w0:food-plan' ||
        (
          management !== undefined &&
          management.decisionIntentId !== 'w0:food-plan'
        )
      )
    ) {
      return false
    }
    if (
      action.type === 'EDIT_SCHEDULE' &&
      action.responsibility === 'scheduled' &&
      management !== undefined &&
      management.decisionIntentId !==
        'w0:repair-responsibility:pump-incident-day-3'
    ) {
      return false
    }
    if (
      action.type === 'ACCEPT_REPAIR_DEBT' &&
      management?.decisionIntentId !==
        'w0:repair-responsibility:pump-incident-day-3'
    ) {
      return false
    }
  }
  if (
    !validV2SemanticContract(
      value,
      actionsById,
      choiceSetsById,
      actionTiming,
    )
  ) {
    return false
  }

  const validRecaps = value.recap.every(
    (recap) =>
      isRecord(recap) &&
      hasExactKeys(recap, RECAP_KEYS) &&
      isRecord(recap.planned) &&
      hasExactKeys(recap.planned, PLANNED_KEYS) &&
      Number.isFinite(recap.planned.low) &&
      Number.isFinite(recap.planned.high) &&
      Number.isFinite(recap.actual) &&
      Number.isInteger(recap.weekIndex) &&
      Array.isArray(recap.itemIds) &&
      recap.itemIds.every((itemId) => typeof itemId === 'string') &&
      Array.isArray(recap.sourceIds) &&
      recap.sourceIds.every((sourceId) => typeof sourceId === 'string') &&
      recap.itemIds.length === recap.sourceIds.length,
  )
  const validWeekRecaps =
    value.weekRecaps.length === value.recap.length &&
    value.weekRecaps.every(
      (recap, index) =>
        isRecord(recap) &&
        hasExactKeys(recap, ['weekIndex']) &&
        recap.weekIndex === index &&
        value.recap[index]?.weekIndex === index,
    )
  const expectedSummary = {
    week1CandidateEditCount: value.candidateEditGroups.filter(
      (group) => group.groupId.startsWith('legacy:w0:'),
    ).length,
    week2CandidateEditCount: value.candidateEditGroups.filter(
      (group) => group.groupId.startsWith('legacy:w1:'),
    ).length,
    week1CandidateManagementCount:
      value.candidateManagementCommitmentGroups.filter(
        (group) => group.weekIndex === 0,
      ).length,
    week2CandidateManagementCount:
      value.candidateManagementCommitmentGroups.filter(
        (group) => group.weekIndex === 1,
      ).length,
  }
  if (
    !validRecaps ||
    !validWeekRecaps ||
    !hasExactKeys(value.summary, Object.keys(expectedSummary)) ||
    Object.entries(expectedSummary).some(
      ([key, expected]) => value.summary[key] !== expected,
    )
  ) {
    return false
  }

  const exportCreated = value.telemetry.filter(
    (entry) => isRecord(entry) && entry.type === 'export-created',
  )
  const blockedCaptureCreated = value.telemetry.filter(
    (entry) =>
      isRecord(entry) && entry.type === 'blocked-capture-created',
  )
  if (isBlocked) {
    return (
      Number.isInteger(value.blockedAtTick) &&
      value.blockedAtTick === value.finalTick &&
      value.blockedAtTick >= SCENARIO_START_TICK &&
      value.blockedAtTick <= 2010 &&
      typeof value.blockedReason === 'string' &&
      value.blockedReason === value.blockedReason.trim() &&
      value.blockedReason.length > 0 &&
      value.blockedReason.length <= MAX_BLOCKED_REASON_LENGTH &&
      value.finalState.isComplete === false &&
      Number.isInteger(value.finalState.completedWeekCount) &&
      value.finalState.completedWeekCount >= 0 &&
      value.finalState.completedWeekCount <= 2 &&
      value.finalState.recapCount ===
        value.finalState.completedWeekCount &&
      value.recap.length === value.finalState.recapCount &&
      exportCreated.length === 0 &&
      blockedCaptureCreated.length === 1 &&
      blockedCaptureCreated[0].atTick === value.blockedAtTick
    )
  }
  return (
    value.finalTick === 2010 &&
    value.finalState.isComplete === true &&
    value.finalState.completedWeekCount === 2 &&
    value.finalState.recapCount === 2 &&
    value.recap.length === 2 &&
    exportCreated.length === 1 &&
    exportCreated[0].atTick === 2010 &&
    blockedCaptureCreated.length === 0
  )
}

export function validateCapturedExport(value, buildMetadata) {
  if (value?.schemaVersion === 'gate1-playtest-v1') {
    return validV1Export(value, buildMetadata)
  }
  if (value?.schemaVersion === 'gate1-playtest-v2') {
    return validV2Export(value, buildMetadata)
  }
  return false
}

function readBody(request, response, onComplete) {
  const chunks = []
  let byteLength = 0
  request.on('data', (chunk) => {
    byteLength += chunk.byteLength
    if (byteLength <= MAX_EXPORT_BYTES) chunks.push(chunk)
  })
  request.on('end', () => {
    if (byteLength > MAX_EXPORT_BYTES) {
      sendJson(response, 413, { error: '匿名导出超过大小上限' })
      return
    }
    onComplete(Buffer.concat(chunks))
  })
  request.on('error', () => {
    if (!response.headersSent) {
      sendJson(response, 400, { error: '匿名导出请求中断' })
    }
  })
}

function installIfAbsent(path, bytes) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  writeFileSync(temporaryPath, bytes, { flag: 'wx', mode: 0o600 })
  try {
    linkSync(temporaryPath, path)
    return true
  } catch (error) {
    if (error?.code === 'EEXIST') return false
    throw error
  } finally {
    unlinkSync(temporaryPath)
  }
}

function createReceipt(
  filename,
  bytes,
  sha256,
  metadata,
  capturedAtUtc,
  capture,
) {
  return {
    schemaVersion: 'gate1-capture-receipt-v1',
    captureVersion: CAPTURE_VERSION,
    filename,
    bytes: bytes.byteLength,
    sha256,
    capturedAtUtc,
    sampleId: metadata.sampleId,
    sessionId: metadata.sessionId,
    buildId: metadata.buildId,
    gitSha: metadata.gitSha,
    artifactHash: metadata.artifactHash,
    ...(capture?.captureKind === 'blocked'
      ? {
          captureKind: 'blocked',
          blockedAtTick: capture.blockedAtTick,
          isComplete: false,
        }
      : {}),
  }
}

function validCapturedAt(value) {
  if (typeof value !== 'string') return false
  try {
    return new Date(value).toISOString() === value
  } catch {
    return false
  }
}

function readMatchingReceipt(path, expected) {
  let receipt
  let receiptText
  try {
    receiptText = readFileSync(path, 'utf8')
    receipt = JSON.parse(receiptText)
  } catch {
    return undefined
  }
  if (
    !receipt ||
    typeof receipt !== 'object' ||
    Array.isArray(receipt) ||
    !hasExactKeys(
      receipt,
      receipt.captureKind === 'blocked'
        ? BLOCKED_RECEIPT_KEYS
        : RECEIPT_KEYS,
    ) ||
    !validCapturedAt(receipt.capturedAtUtc) ||
    receiptText !== `${JSON.stringify(receipt, null, 2)}\n`
  ) {
    return undefined
  }
  return Object.entries(expected).every(
    ([key, value]) => receipt[key] === value,
  )
    ? receipt
    : undefined
}

function matchingEvidence(sidecarPath, receiptPath, sidecarBytes, expectedReceipt) {
  if (!existsSync(sidecarPath) || !existsSync(receiptPath)) return undefined
  if (!readFileSync(sidecarPath).equals(sidecarBytes)) return undefined
  return readMatchingReceipt(receiptPath, expectedReceipt)
}

function writeCapture(captureRoot, filename, bytes, metadata, capture) {
  const rawPath = join(captureRoot, filename)
  const sidecarPath = `${rawPath}.sha256`
  const receiptPath = `${rawPath}.receipt.json`
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const sidecarBytes = Buffer.from(`${sha256}  ${filename}\n`)
  const expectedReceipt = createReceipt(
    filename,
    bytes,
    sha256,
    metadata,
    undefined,
    capture,
  )
  delete expectedReceipt.capturedAtUtc

  const rawExists = existsSync(rawPath)
  const sidecarExists = existsSync(sidecarPath)
  const receiptExists = existsSync(receiptPath)
  if (rawExists) {
    if (!readFileSync(rawPath).equals(bytes)) return { conflict: true }
    const receipt = matchingEvidence(
      sidecarPath,
      receiptPath,
      sidecarBytes,
      expectedReceipt,
    )
    return receipt
      ? { receipt, status: 200, rawPath }
      : { conflict: true }
  }
  if (sidecarExists !== receiptExists) return { conflict: true }
  if (sidecarExists && receiptExists) {
    const receipt = matchingEvidence(
      sidecarPath,
      receiptPath,
      sidecarBytes,
      expectedReceipt,
    )
    if (!receipt) return { conflict: true }
    const installed = installIfAbsent(rawPath, bytes)
    if (!installed && !readFileSync(rawPath).equals(bytes)) {
      return { conflict: true }
    }
    return { receipt, status: installed ? 201 : 200, rawPath }
  }

  const newReceipt = createReceipt(
    filename,
    bytes,
    sha256,
    metadata,
    new Date().toISOString(),
    capture,
  )
  const receiptBytes = Buffer.from(`${JSON.stringify(newReceipt, null, 2)}\n`)
  if (!installIfAbsent(sidecarPath, sidecarBytes)) return { conflict: true }
  if (!installIfAbsent(receiptPath, receiptBytes)) return { conflict: true }
  const receipt = matchingEvidence(
    sidecarPath,
    receiptPath,
    sidecarBytes,
    expectedReceipt,
  )
  if (!receipt) return { conflict: true }

  const installed = installIfAbsent(rawPath, bytes)
  if (!installed && !readFileSync(rawPath).equals(bytes)) {
    return { conflict: true }
  }
  return { receipt, status: installed ? 201 : 200, rawPath }
}

function createHandler(distRoot, captureRoot, buildMetadata) {
  const downloads = new Map()

  return (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (request.method === 'POST' && url.pathname === CAPTURE_PATH) {
      if (!request.headers['content-type']?.startsWith('application/json')) {
        sendJson(response, 415, { error: '匿名导出必须使用 JSON' })
        return
      }
      readBody(request, response, (bytes) => {
        let payload
        try {
          const text = bytes.toString('utf8')
          if (!Buffer.from(text, 'utf8').equals(bytes)) {
            sendJson(response, 400, { error: '匿名导出不是有效 UTF-8' })
            return
          }
          payload = JSON.parse(text)
        } catch {
          sendJson(response, 400, { error: '匿名导出不是有效 JSON' })
          return
        }
        if (!validateCapturedExport(payload, buildMetadata)) {
          sendJson(response, 400, { error: '匿名导出合同无效' })
          return
        }

        const { meta } = payload
        const capture =
          payload.captureKind === 'blocked'
            ? {
                captureKind: 'blocked',
                blockedAtTick: payload.blockedAtTick,
              }
            : undefined
        const filename = `${meta.buildId}-${meta.sampleId}-${meta.sessionId}.json`
        let result
        try {
          result = writeCapture(captureRoot, filename, bytes, meta, capture)
        } catch {
          sendJson(response, 500, { error: '匿名导出无法写入证据目录' })
          return
        }
        if (result.conflict) {
          sendJson(response, 409, { error: '同一会话证据链缺失或不一致' })
          return
        }

        const token = randomUUID()
        downloads.set(token, {
          filename,
          rawPath: result.rawPath,
        })
        sendJson(response, result.status, {
          ...result.receipt,
          downloadUrl: `${CAPTURE_PATH}/${token}`,
        })
      })
      return
    }

    if (request.method === 'GET' && url.pathname.startsWith(`${CAPTURE_PATH}/`)) {
      const token = url.pathname.slice(CAPTURE_PATH.length + 1)
      const download = downloads.get(token)
      if (!download || !SESSION_ID_PATTERN.test(token)) {
        sendJson(response, 404, { error: '匿名导出下载凭据无效' })
        return
      }
      let size
      try {
        size = statSync(download.rawPath).size
      } catch {
        sendJson(response, 404, { error: '匿名导出文件不存在' })
        return
      }
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${download.filename}"`,
        'Content-Length': size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      createReadStream(download.rawPath).pipe(response)
      return
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Method Not Allowed' })
      return
    }
    let pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      sendJson(response, 400, { error: 'URL 无效' })
      return
    }
    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
    const absolutePath = resolve(distRoot, relativePath)
    if (
      absolutePath !== distRoot &&
      !absolutePath.startsWith(`${distRoot}${sep}`)
    ) {
      sendJson(response, 404, { error: 'Not Found' })
      return
    }
    let stat
    try {
      stat = statSync(absolutePath)
    } catch {
      sendJson(response, 404, { error: 'Not Found' })
      return
    }
    if (!stat.isFile()) {
      sendJson(response, 404, { error: 'Not Found' })
      return
    }
    response.writeHead(200, {
      'Content-Type':
        CONTENT_TYPES[extname(absolutePath)] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': relativePath === 'index.html' ? 'no-store' : 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    createReadStream(absolutePath).pipe(response)
  }
}

export function createPlaytestHost({
  captureRoot,
  distRoot,
  host = '127.0.0.1',
  port = 4186,
}) {
  const resolvedDistRoot = resolve(distRoot)
  const resolvedCaptureRoot = resolve(captureRoot)
  const buildMetadata = JSON.parse(
    readFileSync(join(resolvedDistRoot, 'rc-build.json'), 'utf8'),
  )
  mkdirSync(resolvedCaptureRoot, { recursive: true })
  const server = createServer(
    createHandler(resolvedDistRoot, resolvedCaptureRoot, buildMetadata),
  )
  return {
    captureRoot: resolvedCaptureRoot,
    host,
    port,
    server,
    start() {
      return new Promise((resolveStart, reject) => {
        server.once('error', reject)
        server.listen(port, host, () => {
          server.off('error', reject)
          resolveStart(server.address())
        })
      })
    },
  }
}

async function main() {
  const host = argument('--host') ?? '127.0.0.1'
  const port = Number(argument('--port') ?? 4186)
  const explicitCaptureRoot = argument('--capture-dir')
  const distRoot = import.meta.dirname
  const captureRoot = resolve(
    explicitCaptureRoot ?? join(distRoot, '..', 'captures'),
  )
  if (host !== '127.0.0.1') {
    throw new Error('Gate 1 capture host 只允许绑定 127.0.0.1')
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Gate 1 capture host 端口无效')
  }
  const playtestHost = createPlaytestHost({
    captureRoot,
    distRoot,
    host,
    port,
  })
  await playtestHost.start()
  process.stdout.write(
    `Gate 1 RC listening on http://${host}:${port}/; capture=${captureRoot}\n`,
  )

  const stop = () => {
    playtestHost.server.close(() => {
      process.exit(0)
    })
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`)
    process.exit(1)
  })
}
