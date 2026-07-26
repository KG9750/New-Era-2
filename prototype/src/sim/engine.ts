import { calculateFoodForecast, formatRange } from './forecast'
import type {
  DomainEvent,
  ForecastRange,
  PlayerAction,
  PlayerActionEnvelope,
  ScenarioDefinition,
  SimulationState,
  TransitionResult,
  WeekendRecap,
} from './model'
import {
  PUMP_MAINTENANCE_BLOCK_ID,
  affectedBlockIdsFor,
  applyScheduleTransaction,
  expireScheduleLayers,
  resolveScheduleBlock,
  undoLastScheduleTransaction,
} from './schedule'

export function createPlayerAction(
  sequence: number,
  atTick: number,
  action: PlayerAction,
): PlayerActionEnvelope {
  return {
    id: `action-${sequence.toString().padStart(4, '0')}`,
    sequence,
    atTick,
    action,
    affectedBlockIds: affectedBlockIdsFor(action),
  }
}

function rangeOf(state: SimulationState): ForecastRange {
  return calculateFoodForecast(state).endingStock
}

function appendTimeline(
  state: SimulationState,
  entry: Omit<SimulationState['timeline'][number], 'order'>,
): SimulationState['timeline'] {
  return [...state.timeline, { ...entry, order: state.timeline.length + 1 }]
}

export function applyPlayerAction(
  state: SimulationState,
  envelope: PlayerActionEnvelope,
  _scenario: ScenarioDefinition,
): TransitionResult {
  if (state.actionLog.some((item) => item.id === envelope.id)) {
    throw new Error(`Duplicate player action id: ${envelope.id}`)
  }
  if (envelope.atTick !== state.currentTick) {
    throw new Error('Player action tick must match the current simulation tick')
  }

  const before = rangeOf(state)
  let next: SimulationState
  let event: DomainEvent

  if (envelope.action.type === 'CHANGE_ACTIVITY') {
    const activity = envelope.action.activity
    const edited = applyScheduleTransaction(state, envelope.id, {
      type: 'EDIT_SCHEDULE',
      blockIds: [PUMP_MAINTENANCE_BLOCK_ID],
      activity,
      scope: 'weekly',
    })
    const draft: SimulationState = { ...edited, activity }
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: activity === 'repair' ? '安排预防性检修' : '保留休息安排',
        detail:
          activity === 'repair'
            ? `粮食期末预测由 ${formatRange(before)} 变为 ${formatRange(after)}。`
            : `粮食期末预测由 ${formatRange(before)} 变为 ${formatRange(after)}。`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'activity-changed',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (
    envelope.action.type === 'EDIT_SCHEDULE' ||
    envelope.action.type === 'COPY_DAY'
  ) {
    const edited = applyScheduleTransaction(state, envelope.id, envelope.action)
    const draft: SimulationState = {
      ...edited,
      activity: resolveScheduleBlock(edited, PUMP_MAINTENANCE_BLOCK_ID).activity,
    }
    const after = rangeOf(draft)
    const count = envelope.affectedBlockIds.length
    const permanent =
      envelope.action.scope === 'base' ? '，并明确写入后续基础计划' : ''
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: envelope.action.type === 'COPY_DAY' ? '复制单日安排' : '修改日程',
        detail: `${envelope.id} 作为一个事务修改 ${count} 个活动块${permanent}。`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'schedule-edited',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (envelope.action.type === 'UNDO_SCHEDULE') {
    const transaction = state.scheduleTransactions.at(-1)
    const undone = undoLastScheduleTransaction(state)
    const draft: SimulationState = {
      ...undone,
      activity: resolveScheduleBlock(undone, PUMP_MAINTENANCE_BLOCK_ID).activity,
    }
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: '撤销日程事务',
        detail: transaction
          ? `已撤销 ${transaction.actionId}，恢复 ${transaction.affectedBlockIds.length} 个活动块。`
          : '没有可撤销的日程事务。',
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'schedule-undone',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else {
    const planSnapshot =
      !envelope.action.paused && state.planSnapshot === null ? before : state.planSnapshot
    next = {
      ...state,
      isPaused: envelope.action.paused,
      recap: envelope.action.paused ? state.recap : null,
      planSnapshot,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: envelope.action.paused ? '暂停时间' : '继续时间',
        detail: envelope.action.paused ? '聚落时钟已暂停。' : '聚落时钟开始连续推进。',
      }),
    }
    event = {
      id: envelope.id,
      type: 'clock-changed',
      atTick: envelope.atTick,
    }
  }

  return { state: next, events: [event] }
}

function createRecap(state: SimulationState, weekIndex: number): WeekendRecap {
  const planned = state.planSnapshot ?? rangeOf(state)
  const actual = state.pumpStatus === 'protected' ? 10 : 3
  const protectedPump = state.pumpStatus === 'protected'
  return {
    planned,
    actual,
    headline:
      actual >= planned.low && actual <= planned.high
        ? '实际结果落在计划区间内'
        : '事件使实际结果偏离计划区间',
    items: [
      `第 ${weekIndex + 1} 周计划期末库存 ${formatRange(planned)}，周末实际库存 ${actual}。`,
      protectedPump
        ? '林禾的预防性检修生效：水泵异常只造成 1 单位粮食损失。'
        : '水泵未检修并停机：粮食较原计划上限少 8 单位。',
      weekIndex === 0 && protectedPump
        ? '本周检修是一次性安排，周末后自动失效；建议下周重新评估水泵状态。'
        : weekIndex === 0
          ? '建议下周优先恢复水泵，并保留一块预防性维修时间。'
          : '第二周本周例外已自动失效，基础计划保留为后续起点。',
    ],
  }
}

export function advanceSimulation(
  state: SimulationState,
  targetTick: number,
  scenario: ScenarioDefinition,
): TransitionResult {
  if (targetTick < state.currentTick) {
    throw new Error('Simulation cannot advance backwards')
  }

  const nextEvent = [...scenario.scriptedEvents]
    .sort((left, right) => left.atTick - right.atTick)
    .find(
      (event) =>
        event.atTick >= state.currentTick &&
        event.atTick <= targetTick &&
        !state.processedScriptEventIds.includes(event.id),
    )

  if (nextEvent) {
    const before = rangeOf(state)
    const pumpStatus =
      resolveScheduleBlock(state, PUMP_MAINTENANCE_BLOCK_ID).activity === 'repair'
        ? 'protected'
        : 'failed'
    const expired = expireScheduleLayers(state, nextEvent.atTick)
    const eventState: SimulationState = {
      ...expired,
      currentTick: nextEvent.atTick,
      isPaused: true,
      pumpStatus,
      processedScriptEventIds: [...state.processedScriptEventIds, nextEvent.id],
    }
    const after = rangeOf(eventState)
    const next: SimulationState = {
      ...eventState,
      timeline: appendTimeline(state, {
        atTick: nextEvent.atTick,
        kind: 'scripted-event',
        id: nextEvent.id,
        title: pumpStatus === 'protected' ? '水泵异常，检修奏效' : '水泵故障并停机',
        detail:
          pumpStatus === 'protected'
            ? `时钟已自动暂停。粮食期末预测由 ${formatRange(before)} 调整为 ${formatRange(after)}。`
            : `时钟已自动暂停。粮食期末预测由 ${formatRange(before)} 下调为 ${formatRange(after)}。`,
        before,
        after,
      }),
    }
    return {
      state: next,
      events: [
        {
          id: nextEvent.id,
          type: 'pump-incident',
          atTick: nextEvent.atTick,
          before,
          after,
        },
      ],
    }
  }

  const endingWeekIndex = scenario.weekEndTicks.findIndex(
    (tick, index) =>
      tick >= state.currentTick &&
      tick <= targetTick &&
      !state.completedWeekIndexes.includes(index),
  )

  if (endingWeekIndex >= 0) {
    const currentTick = scenario.weekEndTicks[endingWeekIndex]
    const expired = expireScheduleLayers(state, currentTick, endingWeekIndex)
    const base: SimulationState = {
      ...expired,
      currentTick,
      isPaused: true,
      completedWeekIndexes: [...state.completedWeekIndexes, endingWeekIndex],
      isComplete: endingWeekIndex === scenario.weekEndTicks.length - 1,
    }
    const recap = createRecap(base, endingWeekIndex)
    return {
      state: {
        ...base,
        recap,
        recaps: [...state.recaps, recap],
        timeline: appendTimeline(state, {
          atTick: currentTick,
          kind: 'scripted-event',
          id: `week-${endingWeekIndex + 1}-ended`,
          title: `第 ${endingWeekIndex + 1} 周复盘`,
          detail: `${recap.headline}：计划 ${formatRange(recap.planned)}，实际 ${recap.actual}。`,
        }),
      },
      events: [
        {
          id: `week-${endingWeekIndex + 1}-ended`,
          type: 'week-ended',
          atTick: currentTick,
        },
      ],
    }
  }

  const base: SimulationState = {
    ...expireScheduleLayers(state, targetTick),
    currentTick: targetTick,
  }
  return { state: base, events: [] }
}
