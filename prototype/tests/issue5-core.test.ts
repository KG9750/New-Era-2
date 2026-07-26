import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import {
  advanceSimulation,
  applyPlayerAction,
  createPlayerAction,
} from '../src/sim/engine'
import {
  calculateFoodForecast,
  calculateRepairForecast,
} from '../src/sim/forecast'
import type { PlayerAction, SimulationState } from '../src/sim/model'
import {
  LIN_HE_STUDY_BLOCK_ID,
  createBaseKey,
  createBlockId,
  resolveScheduleBlock,
} from '../src/sim/schedule'
import {
  canOpenTransportShortcut,
  selectMapCharacterPositions,
  selectTransportRoute,
} from '../src/sim/transport'

function act(state: SimulationState, sequence: number, action: PlayerAction) {
  return applyPlayerAction(
    state,
    createPlayerAction(sequence, state.currentTick, action),
    scenario,
  ).state
}

function reachWeekTwo(state = scenario.createInitialState()) {
  let next = advanceSimulation(state, scenario.pumpEventTick, scenario).state
  next = advanceSimulation(next, scenario.weekEndTick, scenario).state
  return act(next, 90, { type: 'CONTINUE_TO_NEXT_WEEK' })
}

describe('Gate 1 Issue #5 core contract', () => {
  it('uses the authoritative route id for map path, loss, forecast, and opening cost', () => {
    const initial = scenario.createInitialState()
    const beforeFood = calculateFoodForecast(initial)
    const beforeRepair = calculateRepairForecast(initial)
    const beforeRoute = selectTransportRoute(initial)
    const opened = act(initial, 1, { type: 'OPEN_TRANSPORT_SHORTCUT' })
    const afterRoute = selectTransportRoute(opened)

    expect(beforeRoute).toMatchObject({
      id: 'north-loop',
      distanceMeters: 860,
      foodLoss: 6,
    })
    expect(afterRoute).toMatchObject({
      id: 'south-shortcut',
      distanceMeters: 470,
      foodLoss: 2,
    })
    expect(afterRoute.path).not.toBe(beforeRoute.path)
    expect(calculateFoodForecast(opened).endingStock.high).toBe(
      beforeFood.endingStock.high + 4,
    )
    expect(calculateRepairForecast(opened).endingStock.high).toBe(
      beforeRepair.endingStock.high - 1,
    )
    expect(selectMapCharacterPositions(opened).map((item) => item.name)).toEqual([
      '林禾',
      '乔磐',
      '苏霁',
      '陈渡',
    ])
  })

  it('rejects a retroactive route change after the current week starts transporting', () => {
    let state = advanceSimulation(
      scenario.createInitialState(),
      scenario.weeklyTransportStartTicks[0],
      scenario,
    ).state

    expect(canOpenTransportShortcut(state, scenario)).toBe(false)
    expect(() => act(state, 1, { type: 'OPEN_TRANSPORT_SHORTCUT' })).toThrow(
      '不能追溯改写',
    )

    state = reachWeekTwo()
    expect(canOpenTransportShortcut(state, scenario)).toBe(true)
  })

  it('inherits explicit base edits, expires weekly exceptions, and blocks cross-week undo', () => {
    const weeklyBlock = createBlockId('chen-du', 2, 0)
    const baseBlock = createBlockId('qiao-pan', 2, 2)
    let state = scenario.createInitialState()
    state = act(state, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [weeklyBlock],
      activity: 'study',
      scope: 'weekly',
    })
    state = act(state, 2, {
      type: 'EDIT_SCHEDULE',
      blockIds: [baseBlock],
      activity: 'food',
      scope: 'base',
    })
    state = reachWeekTwo(state)

    expect(state.weeklyOverrides[weeklyBlock]).toBeUndefined()
    expect(state.basePlan[createBaseKey('qiao-pan', 9, 2)]).toBe('food')
    expect(state.scheduleTransactions).toEqual([])
    const afterUndo = act(state, 91, { type: 'UNDO_SCHEDULE' })
    expect(afterUndo.basePlan).toEqual(state.basePlan)
  })

  it('defaults an unanswered Lin He request at its deadline and locks its target block', () => {
    let state = reachWeekTwo()
    state = act(state, 91, { type: 'SET_PAUSED', paused: false })
    expect(state.planSnapshot).toBeNull()
    state = advanceSimulation(state, scenario.linHeRequestDeadlineTick, scenario).state

    expect(state.linHeRequestDecision).toBe('declined')
    expect(state.linHeRequestResolutionSource).toBe('deadline')
    expect(state.planSnapshot).toEqual(calculateFoodForecast(state).endingStock)
    expect(resolveScheduleBlock(state, LIN_HE_STUDY_BLOCK_ID).activity).toBe('food')
    expect(() =>
      act(state, 92, {
        type: 'EDIT_SCHEDULE',
        blockIds: [LIN_HE_STUDY_BLOCK_ID],
        activity: 'study',
        scope: 'weekly',
      }),
    ).toThrow('必须通过人物请求决定')
  })

  it('locks an accepted request to the promised study block', () => {
    let state = reachWeekTwo()
    state = act(state, 91, {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'accepted',
    })

    expect(resolveScheduleBlock(state, LIN_HE_STUDY_BLOCK_ID).activity).toBe('study')
    expect(() =>
      act(state, 92, {
        type: 'EDIT_SCHEDULE',
        blockIds: [LIN_HE_STUDY_BLOCK_ID],
        activity: 'food',
        scope: 'weekly',
      }),
    ).toThrow('不能用普通日程编辑覆盖')
  })

  it('completes fourteen days without management edits and records only real named costs', () => {
    let state = scenario.createInitialState()
    state = act(state, 1, { type: 'SET_PAUSED', paused: false })
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = act(state, 2, { type: 'SET_PAUSED', paused: false })
    state = advanceSimulation(state, scenario.weekEndTick, scenario).state
    state = act(state, 3, { type: 'CONTINUE_TO_NEXT_WEEK' })
    state = act(state, 4, { type: 'SET_PAUSED', paused: false })
    state = advanceSimulation(state, scenario.linHeRequestDeadlineTick, scenario).state
    state = act(state, 5, { type: 'SET_PAUSED', paused: false })
    state = advanceSimulation(state, scenario.simulationEndTick, scenario).state

    expect(state.isComplete).toBe(true)
    expect(state.recaps).toHaveLength(2)
    expect(state.actionLog.every((entry) =>
      entry.action.type === 'SET_PAUSED' ||
      entry.action.type === 'CONTINUE_TO_NEXT_WEEK',
    )).toBe(true)

    const firstSources = state.recaps[0].items.map((item) => item.sourceId)
    const secondSources = state.recaps[1].items.map((item) => item.sourceId)
    expect(firstSources).toEqual([
      'food-forecast',
      'pump-preventive-maintenance',
      'pump-incident-day-3',
      'north-loop',
    ])
    expect(secondSources).toEqual([
      'food-forecast',
      'lin-he-request-deadline',
      'north-loop',
    ])
    expect(secondSources).not.toContain('pump-incident-day-3')
    expect(state.recaps.flatMap((recap) => recap.items).every(
      (item) =>
        item.id.length > 0 &&
        item.sourceId.length > 0 &&
        Object.keys(item.values).length > 0,
    )).toBe(true)
  })

  it('keeps the accepted week-two consequence visible after weekly overrides expire', () => {
    let state = reachWeekTwo()
    state = act(state, 91, {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'accepted',
    })
    state = act(state, 92, { type: 'SET_PAUSED', paused: false })
    state = advanceSimulation(state, scenario.simulationEndTick, scenario).state

    expect(state.isComplete).toBe(true)
    expect(state.weeklyOverrides).toEqual({})
    expect(state.linHeRequestDecision).toBe('accepted')
    expect(calculateFoodForecast(state).endingStock).toEqual(
      state.recaps[1].planned,
    )
  })
})
