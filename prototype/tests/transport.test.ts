import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import {
  advanceSimulation,
  applyPlayerAction,
  createPlayerAction,
} from '../src/sim/engine'
import { calculateRepairForecast } from '../src/sim/forecast'
import {
  selectCurrentWeekIndex,
  selectTransportRepairCost,
} from '../src/sim/transport'

describe('RC9 transport week phase', () => {
  it('derives the current week only from the shared tick boundary', () => {
    const initial = scenario.createInitialState()
    const staleTransitionFlags = {
      ...initial,
      currentTick: 1002,
      completedWeekIndexes: [0],
      recap: null,
    }

    expect(selectCurrentWeekIndex(staleTransitionFlags)).toBe(0)
    expect(
      selectCurrentWeekIndex({
        ...initial,
        currentTick: 1062,
      }),
    ).toBe(1)
    expect(() =>
      selectCurrentWeekIndex({
        ...initial,
        currentTick: 1003,
      }),
    ).toThrow('不可达')
  })

  it('charges a week-two shortcut to the week-two forecast and recap', () => {
    let state = scenario.createInitialState()
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = advanceSimulation(state, scenario.weekEndTick, scenario).state
    state = applyPlayerAction(
      state,
      createPlayerAction(1, state.currentTick, {
        type: 'CONTINUE_TO_NEXT_WEEK',
      }),
      scenario,
    ).state

    const before = calculateRepairForecast(state)
    state = applyPlayerAction(
      state,
      createPlayerAction(2, state.currentTick, {
        type: 'OPEN_TRANSPORT_SHORTCUT',
      }),
      scenario,
    ).state
    const after = calculateRepairForecast(state)

    expect(selectTransportRepairCost(state, scenario)).toBe(1)
    expect(after.consumption).toBe(before.consumption + 1)
    expect(after.endingStock.high).toBe(before.endingStock.high - 1)

    state = advanceSimulation(
      state,
      scenario.linHeRequestDeadlineTick,
      scenario,
    ).state
    state = advanceSimulation(state, scenario.simulationEndTick, scenario).state

    expect(state.recap?.supplies.repair.planned).toEqual(after.endingStock)
    expect(state.recap?.supplies.repair.reasons.join(' ')).toContain(
      '短通路本周启用成本 −1',
    )
  })
})
