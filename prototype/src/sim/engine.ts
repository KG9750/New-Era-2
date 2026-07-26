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
  WeekendRecapItem,
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
  isLinHeRequestBlockLocked,
  resolveScheduleBlock,
  undoLastScheduleTransaction,
} from './schedule'
import {
  canOpenTransportShortcut,
  selectTransportRepairCost,
  selectTransportRoute,
} from './transport'

export function createPlayerAction(
  sequence: number,
  atTick: number,
  action: PlayerAction,
  undoOfActionId?: string,
): PlayerActionEnvelope {
  return {
    id: `action-${sequence.toString().padStart(4, '0')}`,
    sequence,
    atTick,
    action,
    affectedBlockIds:
      action.type === 'OPEN_TRANSPORT_SHORTCUT'
        ? ['map:transport-route']
        : affectedBlockIdsFor(action),
    ...(undoOfActionId ? { undoOfActionId } : {}),
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
    const requestTarget = envelope.affectedBlockIds.find(isLinHeRequestBlockLocked)
    if (requestTarget) {
      throw new Error('林禾请求占用的活动块必须通过人物请求决定，不能用普通日程编辑覆盖')
    }
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
  } else if (envelope.action.type === 'OPEN_TRANSPORT_SHORTCUT') {
    if (!canOpenTransportShortcut(state, _scenario)) {
      throw new Error('短通路只能在本周首次运输开始前开启，不能追溯改写已发生的损耗')
    }
    const beforeRoute = selectTransportRoute(state)
    const draft: SimulationState = {
      ...state,
      transportRouteId: 'south-shortcut',
      transportRouteOpenedAtTick: state.currentTick,
    }
    const afterRoute = selectTransportRoute(draft)
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: '开启南侧短通路',
        detail: `${beforeRoute.label} ${beforeRoute.distanceMeters} 米 / 损耗 ${beforeRoute.foodLoss} → ${afterRoute.label} ${afterRoute.distanceMeters} 米 / 损耗 ${afterRoute.foodLoss}；本周投入 ${selectTransportRepairCost(draft)} 点维修保障。${supplyChangeDetail(state, draft)}`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'transport-shortcut-opened',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (envelope.action.type === 'RESOLVE_LIN_HE_REQUEST') {
    if (!state.completedWeekIndexes.includes(0) || state.recap !== null) {
      throw new Error('林禾的请求会在第二周开始后出现')
    }
    if (state.linHeRequestDecision !== 'pending') {
      throw new Error('林禾的请求已经处理')
    }
    if (state.currentTick >= _scenario.linHeRequestDeadlineTick) {
      throw new Error('林禾请求已经超过答复截止时间')
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
      linHeRequestResolutionSource: 'player',
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
      planSnapshot:
        state.planSnapshot === null && !state.isPaused
          ? after
          : state.planSnapshot,
    }
    event = {
      id: envelope.id,
      type: 'lin-he-request-resolved',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (envelope.action.type === 'CONTINUE_TO_NEXT_WEEK') {
    if (state.recap === null || state.isComplete) {
      throw new Error('只有未完成的周末复盘可以进入下一周')
    }
    next = {
      ...state,
      recap: null,
      isPaused: true,
      planSnapshot: null,
      scheduleTransactions: [],
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: '进入第二周',
        detail: '基础计划已经继承；第一周一次性例外已结算失效。第二周保持暂停，只需处理新增例外。',
      }),
    }
    event = {
      id: envelope.id,
      type: 'clock-changed',
      atTick: envelope.atTick,
    }
  } else {
    if (state.recap !== null) {
      throw new Error('请先完成周末复盘并进入下一周')
    }
    const clockDraft: SimulationState = {
      ...state,
    }
    const weekTwoRequestReady =
      !state.completedWeekIndexes.includes(0) ||
      state.linHeRequestDecision !== 'pending'
    const planSnapshot =
      !envelope.action.paused &&
      state.planSnapshot === null &&
      weekTwoRequestReady
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
          : state.completedWeekIndexes.includes(0)
            ? state.linHeRequestDecision === 'pending'
              ? '第二周开始推进；林禾请求尚未答复，截止时将默认保留农务。'
              : '第二周从继承的基础计划和已处理的新例外开始推进。'
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
  const route = selectTransportRoute(state)
  const items: WeekendRecapItem[] = [
    {
      id: `week-${weekIndex + 1}-food-result`,
      category: '计划内结果',
      sourceId: 'food-forecast',
      title: '粮食计划兑现',
      detail: `第 ${weekIndex + 1} 周计划期末库存 ${formatRange(planned)}，周末实际库存 ${actual}。`,
      values: {
        plannedLow: planned.low,
        plannedHigh: planned.high,
        actual,
      },
    },
  ]

  if (weekIndex === 0) {
    const protectedPump = state.pumpStatus === 'protected'
    items.push(
      {
        id: 'week-1-pump-risk',
        category: '已知风险',
        sourceId: 'pump-preventive-maintenance',
        title: protectedPump ? '林禾补足预防性检修' : '水泵风险未处理',
        detail: protectedPump
          ? '周三前完成 2 个维修块，已知停机风险被压低。'
          : '周三前只有乔磐的 1 个维修块，水泵停机风险按已知上限兑现。',
        values: {
          maintenanceBlocks: protectedPump ? 2 : 1,
          knownWorstFoodLoss: 8,
        },
      },
      {
        id: 'week-1-pump-incident',
        category: '新事件',
        sourceId: 'pump-incident-day-3',
        title: protectedPump ? '周三水泵异常被缓释' : '周三水泵故障并停机',
        detail: protectedPump
          ? '事件发生后新增信息确认：预防性检修奏效，实际只损失 1 单位粮食。'
          : '事件发生后新增信息确认：水泵停机，实际损失 8 单位粮食。',
        values: {
          actualFoodLoss: protectedPump ? 1 : 8,
        },
      },
    )
  } else {
    const accepted = state.linHeRequestDecision === 'accepted'
    const expired = state.linHeRequestResolutionSource === 'deadline'
    items.push({
      id: 'week-2-lin-he-request',
      category: expired ? '新事件' : '计划内结果',
      sourceId: expired
        ? 'lin-he-request-deadline'
        : accepted
          ? 'lin-he-request-accepted'
          : 'lin-he-request-declined',
      title: expired
        ? '林禾请求逾期未答'
        : accepted
          ? '林禾开始学习'
          : '林禾保留农务',
      detail: expired
        ? '管理者未在周二 B1 前答复，系统按已公开默认保留农务；林禾记住了这次沉默。'
        : accepted
          ? '林禾用周二 B1 学习，短期粮食产出减少 2。'
          : '管理者明确拒绝请求，周二 B1 继续农务，林禾记住了本次取舍。',
      values: {
        shortTermFoodDelta: accepted ? -2 : 0,
      },
    })
  }

  items.push({
    id: `week-${weekIndex + 1}-transport-result`,
    category: route.id === 'south-shortcut' ? '计划内结果' : '已知风险',
    sourceId: route.id,
    title:
      route.id === 'south-shortcut'
        ? '苏霁兑现南侧短通路'
        : '苏霁继续北侧绕行',
    detail:
      route.id === 'south-shortcut'
        ? `农田到粮仓缩短为 ${route.distanceMeters} 米 / ${route.travelMinutes} 分钟，运输损耗从 6 降至 ${route.foodLoss}。`
        : `农田到粮仓仍需 ${route.distanceMeters} 米 / ${route.travelMinutes} 分钟，${route.foodLoss} 单位粮食在搬运中未兑现。`,
    values: {
      distanceMeters: route.distanceMeters,
      travelMinutes: route.travelMinutes,
      foodLoss: route.foodLoss,
    },
  })

  return {
    planned,
    actual,
    headline:
      actual >= planned.low && actual <= planned.high
        ? '实际结果落在计划区间内'
        : '事件使实际结果偏离计划区间',
    items,
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
    const expired = expireScheduleLayers(state, nextEvent.atTick)
    if (nextEvent.type === 'LIN_HE_REQUEST_DEADLINE') {
      if (state.linHeRequestDecision !== 'pending') {
        const consumedState: SimulationState = {
          ...expired,
          currentTick: nextEvent.atTick,
          processedScriptEventIds: [...state.processedScriptEventIds, nextEvent.id],
        }
        return targetTick > nextEvent.atTick
          ? advanceSimulation(consumedState, targetTick, scenario)
          : { state: consumedState, events: [] }
      }
      const deadlineState: SimulationState = {
        ...expired,
        currentTick: nextEvent.atTick,
        isPaused: true,
        linHeRequestDecision: 'declined',
        linHeRequestResolutionSource: 'deadline',
        processedScriptEventIds: [...state.processedScriptEventIds, nextEvent.id],
        characterRecords: addCharacterRecord(
          state,
          'lin-he',
          '第二周学习请求逾期未答：按公开默认保留农务；林禾记住管理者没有回应。',
        ),
      }
      const after = rangeOf(deadlineState)
      const next: SimulationState = {
        ...deadlineState,
        planSnapshot: state.planSnapshot ?? after,
        timeline: appendTimeline(state, {
          atTick: nextEvent.atTick,
          kind: 'scripted-event',
          id: nextEvent.id,
          title: '林禾请求逾期，默认保留农务',
          detail: `事件触发时，时钟自动暂停。周二 B1 锁定为农务，粮食预测 ${formatRange(after)}；林禾记住了这次沉默。`,
          before,
          after,
        }),
      }
      return {
        state: next,
        events: [
          {
            id: nextEvent.id,
            type: 'lin-he-request-expired',
            atTick: nextEvent.atTick,
            before,
            after,
          },
        ],
      }
    }

    const pumpStatus = hasPreventiveMaintenance(state) ? 'protected' : 'failed'
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
            ? `事件触发时，时钟自动暂停。粮食期末预测由 ${formatRange(before)} 调整为 ${formatRange(after)}。`
            : `事件触发时，时钟自动暂停。粮食期末预测由 ${formatRange(before)} 下调为 ${formatRange(after)}。`,
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
      scheduleTransactions: [],
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
