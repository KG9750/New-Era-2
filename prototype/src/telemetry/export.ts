import { gate1WeekOneScenario as scenario } from '../scenario/gate1-week-one'
import type {
  PlayerAction,
  PlayerActionEnvelope,
  SimulationState,
} from '../sim/model'
import type { SessionRecorder } from './session'
import { stableStateHash } from './session'

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

function weekIndexForTick(tick: number): 0 | 1 {
  return tick <= scenario.weekEndTicks[0] ? 0 : 1
}

export function createPlaytestExport(
  recorder: SessionRecorder,
  state: SimulationState,
  epochNow = Date.now(),
  monotonicNow = performance.now(),
) {
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
      weekIndex: weekIndexForTick(envelope.atTick),
      actionType: envelope.action.type,
      affectedCellIds: [...envelope.affectedBlockIds],
      undoActionIds: undoActionsByTarget.get(envelope.id) ?? [],
    }))

  return {
    schemaVersion: 'gate1-playtest-v1' as const,
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
