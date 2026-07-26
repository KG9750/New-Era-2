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
    const draft: SimulationState = { ...state, activity }
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
  } else {
    const planSnapshot =
      !envelope.action.paused && state.planSnapshot === null ? before : state.planSnapshot
    next = {
      ...state,
      isPaused: envelope.action.paused,
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

function createRecap(state: SimulationState): WeekendRecap {
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
      `周初计划期末库存 ${formatRange(planned)}，周末实际库存 ${actual}。`,
      protectedPump
        ? '林禾的预防性检修生效：水泵异常只造成 1 单位粮食损失。'
        : '水泵未检修并停机：粮食较原计划上限少 8 单位。',
      protectedPump
        ? '本周检修是一次性安排，周末后自动失效；建议下周重新评估水泵状态。'
        : '建议下周优先恢复水泵，并保留一块预防性维修时间。',
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
    const pumpStatus = state.activity === 'repair' ? 'protected' : 'failed'
    const eventState: SimulationState = {
      ...state,
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

  const reachedWeekEnd = targetTick >= scenario.weekEndTick
  const currentTick = reachedWeekEnd ? scenario.weekEndTick : targetTick
  const base: SimulationState = {
    ...state,
    currentTick,
    isPaused: reachedWeekEnd ? true : state.isPaused,
  }

  if (reachedWeekEnd && state.recap === null) {
    const recap = createRecap(base)
    return {
      state: {
        ...base,
        recap,
        timeline: appendTimeline(state, {
          atTick: currentTick,
          kind: 'scripted-event',
          id: 'week-one-ended',
          title: '第一周复盘',
          detail: `${recap.headline}：计划 ${formatRange(recap.planned)}，实际 ${recap.actual}。`,
        }),
      },
      events: [
        {
          id: 'week-one-ended',
          type: 'week-ended',
          atTick: currentTick,
        },
      ],
    }
  }

  return { state: base, events: [] }
}
