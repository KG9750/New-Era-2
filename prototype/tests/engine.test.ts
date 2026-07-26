import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import { advanceSimulation, applyPlayerAction, createPlayerAction } from '../src/sim/engine'
import { calculateFoodForecast } from '../src/sim/forecast'
import type { SimulationState } from '../src/sim/model'

function chooseRepair(state: SimulationState, sequence = 1) {
  return applyPlayerAction(
    state,
    createPlayerAction(sequence, state.currentTick, {
      type: 'CHANGE_ACTIVITY',
      activity: 'repair',
    }),
    scenario,
  ).state
}

describe('Gate 1 minimal simulation contract', () => {
  it('produces the same state for the same initial state and action sequence', () => {
    const run = () => {
      let state = scenario.createInitialState()
      state = chooseRepair(state)
      state = applyPlayerAction(
        state,
        createPlayerAction(2, state.currentTick, { type: 'SET_PAUSED', paused: false }),
        scenario,
      ).state
      state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
      state = applyPlayerAction(
        state,
        createPlayerAction(3, state.currentTick, { type: 'SET_PAUSED', paused: false }),
        scenario,
      ).state
      return advanceSimulation(state, scenario.weekEndTick, scenario).state
    }

    expect(run()).toEqual(run())
  })

  it('assigns stable action ids without a clock or randomness', () => {
    expect(createPlayerAction(7, 54, { type: 'CHANGE_ACTIVITY', activity: 'repair' })).toEqual({
      id: 'action-0007',
      sequence: 7,
      atTick: 54,
      action: { type: 'CHANGE_ACTIVITY', activity: 'repair' },
      affectedBlockIds: ['lin-he:d1:b1'],
    })
  })

  it('updates the forecast immediately and explains preventive maintenance', () => {
    const initial = scenario.createInitialState()
    const repaired = chooseRepair(initial)

    expect(calculateFoodForecast(initial).endingStock).toEqual({ low: 3, high: 11 })
    expect(calculateFoodForecast(repaired).endingStock).toEqual({ low: 9, high: 9 })
    expect(calculateFoodForecast(repaired).reasons[0]).toContain('2 个水泵维修块')
  })

  it('processes the pump event once and auto-pauses at its tick', () => {
    let state = chooseRepair(scenario.createInitialState())
    state = advanceSimulation(state, scenario.pumpEventTick + 20, scenario).state

    expect(state.currentTick).toBe(scenario.pumpEventTick)
    expect(state.isPaused).toBe(true)
    expect(state.pumpStatus).toBe('protected')
    expect(state.processedScriptEventIds).toEqual(['pump-incident-day-3'])

    state = advanceSimulation(state, scenario.pumpEventTick + 20, scenario).state
    expect(state.processedScriptEventIds).toEqual(['pump-incident-day-3'])
    expect(state.timeline.filter((entry) => entry.id === 'pump-incident-day-3')).toHaveLength(1)
  })

  it('orders a same-tick scripted event before the following player action', () => {
    let state = scenario.createInitialState()
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = applyPlayerAction(
      state,
      createPlayerAction(1, state.currentTick, {
        type: 'CHANGE_ACTIVITY',
        activity: 'repair',
      }),
      scenario,
    ).state

    expect(state.timeline.map((entry) => entry.kind)).toEqual([
      'scripted-event',
      'player-action',
    ])
    expect(state.pumpStatus).toBe('failed')
    expect(calculateFoodForecast(state).endingStock).toEqual({ low: 1, high: 1 })
  })

  it('gives preventive maintenance and ignored maintenance different outcomes', () => {
    const protectedState = advanceSimulation(
      chooseRepair(scenario.createInitialState()),
      scenario.pumpEventTick,
      scenario,
    ).state
    const failedState = advanceSimulation(
      scenario.createInitialState(),
      scenario.pumpEventTick,
      scenario,
    ).state

    expect(protectedState.pumpStatus).toBe('protected')
    expect(failedState.pumpStatus).toBe('failed')
    expect(calculateFoodForecast(protectedState).endingStock).toEqual({ low: 8, high: 9 })
    expect(calculateFoodForecast(failedState).endingStock).toEqual({ low: 3, high: 3 })
  })

  it('creates a weekend recap that explains plan-versus-actual deviation', () => {
    let state = chooseRepair(scenario.createInitialState())
    state = applyPlayerAction(
      state,
      createPlayerAction(2, state.currentTick, { type: 'SET_PAUSED', paused: false }),
      scenario,
    ).state
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = advanceSimulation(state, scenario.weekEndTick, scenario).state

    expect(state.recap).not.toBeNull()
    expect(state.recap?.planned).toEqual({ low: 9, high: 9 })
    expect(state.recap?.actual).toBe(8)
    expect(state.recap?.items.join(' ')).toContain('水泵异常')
  })
})
