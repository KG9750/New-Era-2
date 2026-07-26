import {
  calculateFoodForecast,
  calculateRepairForecast,
  formatRange,
} from './forecast'
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
  LIN_HE_STUDY_BLOCK_ID,
  affectedBlockIdsFor,
  applyScheduleTransaction,
  blockEndTick,
  expireScheduleLayers,
  findQiaoPanBoundaryWarning,
  hasPreventiveMaintenance,
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

function supplyChangeDetail(beforeState: SimulationState, afterState: SimulationState): string {
  const beforeFood = calculateFoodForecast(beforeState).endingStock
  const afterFood = calculateFoodForecast(afterState).endingStock
  const beforeRepair = calculateRepairForecast(beforeState).endingStock
  const afterRepair = calculateRepairForecast(afterState).endingStock
  return `粮食 ${formatRange(beforeFood)} → ${formatRange(afterFood)}；维修保障 ${formatRange(beforeRepair)} → ${formatRange(afterRepair)}。`
}

function addCharacterRecord(
  state: SimulationState,
  characterId: keyof SimulationState['characterRecords'],
  record: string,
): SimulationState['characterRecords'] {
  return {
    ...state.characterRecords,
    [characterId]: [...state.characterRecords[characterId], record],
  }
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
            ? `${supplyChangeDetail(state, draft)}周三前的水泵检修已达到 2 个维修块。`
            : `${supplyChangeDetail(state, draft)}水泵检修重新不足 2 个维修块。`,
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
    const pastBlockId = envelope.affectedBlockIds.find(
      (blockId) => blockEndTick(blockId) <= state.currentTick,
    )
    if (pastBlockId) {
      throw new Error(`已经执行的活动块不能追溯修改：${pastBlockId}`)
    }
    const boundaryWarning = findQiaoPanBoundaryWarning(state, envelope.action)
    if (boundaryWarning) throw new Error(boundaryWarning.message)
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
        detail: `${envelope.id} 作为一个事务修改 ${count} 个活动块${permanent}。${supplyChangeDetail(state, draft)}`,
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
  } else if (envelope.action.type === 'USE_FERTILIZER') {
    if (state.fertilizerUsed) throw new Error('化肥已经使用，库存中没有第二份')
    const draft: SimulationState = { ...state, fertilizerUsed: true }
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: '使用唯一一份化肥',
        detail: `${supplyChangeDetail(state, draft)}这份化肥之后不能再次使用。`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'fertilizer-used',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (envelope.action.type === 'SET_FOOD_SHORTFALL_ACCEPTED') {
    if (
      envelope.action.accepted &&
      calculateFoodForecast(state).status !== '轻度缺口'
    ) {
      throw new Error('只有轻度粮食缺口可以被主动接受')
    }
    next = {
      ...state,
      acceptedFoodShortfall: envelope.action.accepted,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: envelope.action.accepted ? '接受轻度粮食缺口' : '重新处理粮食缺口',
        detail: envelope.action.accepted
          ? '该缺口保留在预测中，但已标为管理者主动承担，不再作为未处理错误催促。'
          : '已移除风险接受标记，粮食缺口重新进入待处理状态。',
        before,
        after: before,
      }),
    }
    event = {
      id: envelope.id,
      type: 'food-shortfall-accepted',
      atTick: envelope.atTick,
      before,
      after: before,
    }
  } else if (envelope.action.type === 'RESOLVE_LIN_HE_REQUEST') {
    if (!state.completedWeekIndexes.includes(0) || state.recap !== null) {
      throw new Error('林禾的请求会在第二周开始后出现')
    }
    if (state.linHeRequestDecision !== 'pending') {
      throw new Error('林禾的请求已经处理')
    }
    const accepted = envelope.action.decision === 'accepted'
    const scheduled = accepted
      ? applyScheduleTransaction(state, envelope.id, {
          type: 'EDIT_SCHEDULE',
          blockIds: [LIN_HE_STUDY_BLOCK_ID],
          activity: 'study',
          scope: 'weekly',
        })
      : state
    const draft: SimulationState = {
      ...scheduled,
      scheduleTransactions: state.scheduleTransactions,
      linHeRequestDecision: envelope.action.decision,
      characterRecords: addCharacterRecord(
        state,
        'lin-he',
        accepted
          ? '第二周学习请求已接受：周二 B1 由农务改为学习，短期粮食产出减少 2。'
          : '第二周学习请求已拒绝：保留农务产能；林禾记住管理者优先保障本周粮食。',
      ),
    }
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: accepted ? '接受林禾的学习请求' : '拒绝林禾的学习请求',
        detail: accepted
          ? `${supplyChangeDetail(state, draft)}人物记录已写入学习承诺。`
          : `${supplyChangeDetail(state, draft)}人物记录已写入拒绝决定。`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'lin-he-request-resolved',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else {
    const enteringNextWeek =
      !envelope.action.paused && state.recap !== null && !state.isComplete
    const clockDraft: SimulationState = {
      ...state,
      recap: envelope.action.paused ? state.recap : null,
    }
    const planSnapshot =
      !envelope.action.paused && state.planSnapshot === null
        ? rangeOf(clockDraft)
        : state.planSnapshot
    next = {
      ...clockDraft,
      isPaused: envelope.action.paused,
      planSnapshot,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: envelope.action.paused ? '暂停时间' : '继续时间',
        detail: envelope.action.paused
          ? '聚落时钟已暂停。'
          : enteringNextWeek
            ? '第二周从继承的基础计划开始连续推进。'
            : '聚落时钟开始连续推进。',
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
  const actualRange = rangeOf(state)
  const actual =
    state.pumpStatus === 'protected' ? actualRange.low : actualRange.high
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
    const pumpStatus = hasPreventiveMaintenance(state) ? 'protected' : 'failed'
    const expired = expireScheduleLayers(state, nextEvent.atTick)
    const eventState: SimulationState = {
      ...expired,
      currentTick: nextEvent.atTick,
      isPaused: true,
      pumpStatus,
      acceptedFoodShortfall:
        pumpStatus === 'failed' ? false : state.acceptedFoodShortfall,
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
    const recap = createRecap({ ...state, currentTick }, endingWeekIndex)
    const expired = expireScheduleLayers(state, currentTick, endingWeekIndex)
    const base: SimulationState = {
      ...expired,
      currentTick,
      isPaused: true,
      acceptedFoodShortfall: false,
      completedWeekIndexes: [...state.completedWeekIndexes, endingWeekIndex],
      isComplete: endingWeekIndex === scenario.weekEndTicks.length - 1,
    }
    return {
      state: {
        ...base,
        recap,
        recaps: [...state.recaps, recap],
        planSnapshot: null,
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
