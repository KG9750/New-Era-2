import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import { advanceSimulation, applyPlayerAction, createPlayerAction } from '../src/sim/engine'
import { calculateFoodForecast, calculateRepairForecast } from '../src/sim/forecast'
import type { PlayerAction, SimulationState } from '../src/sim/model'
import {
  PUMP_MAINTENANCE_BLOCK_ID,
  PUMP_MAINTENANCE_BLOCK_IDS,
  createBlockId,
  findQiaoPanBoundaryWarning,
  hasPreventiveMaintenance,
} from '../src/sim/schedule'

function act(state: SimulationState, sequence: number, action: PlayerAction) {
  return applyPlayerAction(
    state,
    createPlayerAction(sequence, state.currentTick, action),
    scenario,
  ).state
}

function prepareSharedTradeoff(state: SimulationState, useFertilizer: boolean) {
  let next = act(state, 1, {
    type: 'EDIT_SCHEDULE',
    blockIds: [
      createBlockId('chen-du', 0, 0),
      createBlockId('chen-du', 1, 0),
    ],
    activity: 'repair',
    scope: 'weekly',
  })
  next = act(next, 2, { type: 'CHANGE_ACTIVITY', activity: 'repair' })
  if (useFertilizer) next = act(next, 3, { type: 'USE_FERTILIZER' })
  return next
}

function completeTwoWeeks(strategy: 'fertilizer-and-learning' | 'accepted-gap-and-decline') {
  const useFertilizer = strategy === 'fertilizer-and-learning'
  let sequence = useFertilizer ? 4 : 3
  let state = prepareSharedTradeoff(scenario.createInitialState(), useFertilizer)

  if (!useFertilizer) {
    state = act(state, sequence, {
      type: 'SET_FOOD_SHORTFALL_ACCEPTED',
      accepted: true,
    })
    sequence += 1
  }

  state = act(state, sequence, { type: 'SET_PAUSED', paused: false })
  sequence += 1
  state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
  state = act(state, sequence, { type: 'SET_PAUSED', paused: false })
  sequence += 1
  state = advanceSimulation(state, scenario.weekEndTick, scenario).state

  expect(state.planSnapshot).toBeNull()
  expect(state.acceptedFoodShortfall).toBe(false)
  state = act(state, sequence, { type: 'SET_PAUSED', paused: false })
  sequence += 1
  state = act(state, sequence, {
    type: 'RESOLVE_LIN_HE_REQUEST',
    decision: useFertilizer ? 'accepted' : 'declined',
  })
  sequence += 1
  state = advanceSimulation(state, scenario.simulationEndTick, scenario).state
  return state
}

describe('Gate 1 food-repair-character tradeoff contract', () => {
  it('feeds food, repair, and logistics schedule changes into both explainable forecasts', () => {
    const initial = scenario.createInitialState()
    const linReassigned = act(initial, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [createBlockId('lin-he', 0, 0)],
      activity: 'repair',
      scope: 'weekly',
    })
    const chenReassigned = act(initial, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [createBlockId('chen-du', 0, 0)],
      activity: 'repair',
      scope: 'weekly',
    })
    const logisticsRemoved = act(initial, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [createBlockId('su-ji', 0, 0)],
      activity: 'rest',
      scope: 'weekly',
    })

    expect(calculateFoodForecast(linReassigned).endingStock.high).toBeLessThan(
      calculateFoodForecast(chenReassigned).endingStock.high,
    )
    expect(calculateRepairForecast(linReassigned).endingStock.high).toBe(
      calculateRepairForecast(chenReassigned).endingStock.high,
    )
    expect(calculateFoodForecast(logisticsRemoved).endingStock).not.toEqual(
      calculateFoodForecast(initial).endingStock,
    )
    expect(calculateRepairForecast(logisticsRemoved).endingStock).not.toEqual(
      calculateRepairForecast(initial).endingStock,
    )
    expect(calculateFoodForecast(initial).reasons.join(' ')).toContain('林禾 28')
    expect(calculateRepairForecast(initial).reasons.join(' ')).toContain('维修工坊')
  })

  it('requires two visible maintenance blocks before the pump is protected', () => {
    const initial = scenario.createInitialState()
    expect(PUMP_MAINTENANCE_BLOCK_IDS).toHaveLength(2)
    expect(hasPreventiveMaintenance(initial)).toBe(false)

    const protectedPlan = act(initial, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [PUMP_MAINTENANCE_BLOCK_ID],
      activity: 'repair',
      scope: 'weekly',
    })
    expect(hasPreventiveMaintenance(protectedPlan)).toBe(true)

    const missingQiaoBlock = act(protectedPlan, 2, {
      type: 'EDIT_SCHEDULE',
      blockIds: [PUMP_MAINTENANCE_BLOCK_IDS[0]],
      activity: 'rest',
      scope: 'weekly',
    })
    expect(hasPreventiveMaintenance(missingQiaoBlock)).toBe(false)
  })

  it('caps shared labor so adding work and overtime cannot raise food and repair together', () => {
    const initial = scenario.createInitialState()
    const overtime = act(initial, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [
        createBlockId('lin-he', 0, 3),
        createBlockId('su-ji', 0, 3),
        createBlockId('chen-du', 0, 3),
      ],
      activity: 'repair',
      scope: 'weekly',
    })
    const beforeFood = calculateFoodForecast(initial).production.high
    const beforeRepair = calculateRepairForecast(initial).production.high
    const afterFood = calculateFoodForecast(overtime).production.high
    const afterRepair = calculateRepairForecast(overtime).production.high

    expect(afterFood > beforeFood && afterRepair > beforeRepair).toBe(false)
    expect(calculateRepairForecast(overtime).reasons.join(' ')).toContain(
      '超过可持续上限',
    )
  })

  it('uses fertilizer once, changes only food, and records inventory and event state', () => {
    const initial = scenario.createInitialState()
    const beforeFood = calculateFoodForecast(initial)
    const beforeRepair = calculateRepairForecast(initial)
    const fertilized = act(initial, 1, { type: 'USE_FERTILIZER' })

    expect(calculateFoodForecast(fertilized).production.high).toBe(
      beforeFood.production.high + 6,
    )
    expect(calculateRepairForecast(fertilized)).toEqual(beforeRepair)
    expect(fertilized.fertilizerUsed).toBe(true)
    expect(fertilized.timeline.at(-1)?.title).toBe('使用唯一一份化肥')
    expect(() => act(fertilized, 2, { type: 'USE_FERTILIZER' })).toThrow(
      '没有第二份',
    )
  })

  it('accepts only a mild food gap without changing math and invalidates it on severe pump loss', () => {
    const initial = scenario.createInitialState()
    const before = calculateFoodForecast(initial).endingStock
    let state = act(initial, 1, {
      type: 'SET_FOOD_SHORTFALL_ACCEPTED',
      accepted: true,
    })

    expect(calculateFoodForecast(state).endingStock).toEqual(before)
    expect(calculateFoodForecast(state).acceptedRisk).toBe(true)
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    expect(calculateFoodForecast(state).status).toBe('严重短缺')
    expect(state.acceptedFoodShortfall).toBe(false)
    expect(calculateFoodForecast(state).acceptedRisk).toBe(false)
  })

  it('warns before Qiao Pan third consecutive overtime, including across weeks, and resets after a gap', () => {
    const initial = scenario.createInitialState()
    const acrossWeekAction: Extract<PlayerAction, { type: 'EDIT_SCHEDULE' }> = {
      type: 'EDIT_SCHEDULE',
      blockIds: [5, 6, 7].map((day) => createBlockId('qiao-pan', day, 3)),
      activity: 'repair',
      scope: 'weekly',
    }
    const withGapAction: Extract<PlayerAction, { type: 'EDIT_SCHEDULE' }> = {
      ...acrossWeekAction,
      blockIds: [5, 6, 8].map((day) => createBlockId('qiao-pan', day, 3)),
    }
    const beforeRepair = calculateRepairForecast(initial)

    expect(findQiaoPanBoundaryWarning(initial, acrossWeekAction)?.refusedDayIndexes).toEqual([
      7,
    ])
    expect(findQiaoPanBoundaryWarning(initial, withGapAction)).toBeNull()
    expect(() => act(initial, 1, acrossWeekAction)).toThrow('乔磐将在第 8 日')
    expect(calculateRepairForecast(initial)).toEqual(beforeRepair)
  })

  it('completes both deterministic strategies with opposite fertilizer, gap, and Lin He decisions', () => {
    const investment = completeTwoWeeks('fertilizer-and-learning')
    const austerity = completeTwoWeeks('accepted-gap-and-decline')

    expect(investment.isComplete).toBe(true)
    expect(austerity.isComplete).toBe(true)
    expect(investment.fertilizerUsed).toBe(true)
    expect(austerity.fertilizerUsed).toBe(false)
    expect(investment.linHeRequestDecision).toBe('accepted')
    expect(austerity.linHeRequestDecision).toBe('declined')
    expect(investment.characterRecords['lin-he'].at(-1)).toContain('已接受')
    expect(austerity.characterRecords['lin-he'].at(-1)).toContain('已拒绝')
  })

  it('changes Lin He record and week-two food forecast on either branch without touching fertilizer', () => {
    let base = prepareSharedTradeoff(scenario.createInitialState(), false)
    base = act(base, 3, { type: 'SET_PAUSED', paused: false })
    base = advanceSimulation(base, scenario.pumpEventTick, scenario).state
    base = act(base, 4, { type: 'SET_PAUSED', paused: false })
    base = advanceSimulation(base, scenario.weekEndTick, scenario).state
    base = act(base, 5, { type: 'SET_PAUSED', paused: false })
    const before = calculateFoodForecast(base).endingStock

    const accepted = act(base, 6, {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'accepted',
    })
    const declined = act(base, 6, {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'declined',
    })

    expect(calculateFoodForecast(accepted).endingStock.high).toBeLessThan(before.high)
    expect(calculateFoodForecast(declined).endingStock).toEqual(before)
    expect(accepted.characterRecords['lin-he'].at(-1)).toContain('已接受')
    expect(declined.characterRecords['lin-he'].at(-1)).toContain('已拒绝')
    expect(accepted.fertilizerUsed).toBe(false)
    expect(declined.fertilizerUsed).toBe(false)
  })

  it('rejects retrospective edits and starts the second week with a fresh plan snapshot', () => {
    let state = scenario.createInitialState()
    state = advanceSimulation(state, 73, scenario).state
    expect(() =>
      act(state, 1, {
        type: 'EDIT_SCHEDULE',
        blockIds: [createBlockId('chen-du', 0, 0)],
        activity: 'repair',
        scope: 'weekly',
      }),
    ).toThrow('不能追溯修改')

    state = prepareSharedTradeoff(scenario.createInitialState(), false)
    state = act(state, 3, { type: 'SET_PAUSED', paused: false })
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = act(state, 4, { type: 'SET_PAUSED', paused: false })
    state = advanceSimulation(state, scenario.weekEndTick, scenario).state
    expect(state.planSnapshot).toBeNull()
    state = act(state, 5, { type: 'SET_PAUSED', paused: false })
    expect(state.planSnapshot).toEqual(calculateFoodForecast(state).endingStock)
  })
})
