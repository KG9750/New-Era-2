import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import { advanceSimulation, applyPlayerAction, createPlayerAction } from '../src/sim/engine'
import { calculateFoodForecast, calculateRepairForecast } from '../src/sim/forecast'
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

  it('rejects duplicate player action ids and sequences independently', () => {
    const initial = scenario.createInitialState()
    const first = createPlayerAction(
      1,
      initial.currentTick,
      { type: 'SET_PAUSED', paused: true },
    )
    const state = applyPlayerAction(
      initial,
      first,
      scenario,
    ).state
    const second = createPlayerAction(
      2,
      state.currentTick,
      { type: 'SET_PAUSED', paused: false },
    )

    expect(() =>
      applyPlayerAction(
        state,
        { ...second, id: first.id },
        scenario,
      ),
    ).toThrow('Duplicate player action id')
    expect(() =>
      applyPlayerAction(
        state,
        { ...second, sequence: first.sequence },
        scenario,
      ),
    ).toThrow('Duplicate player action sequence')
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
    expect(
      state.recap?.items.map((item) => `${item.title} ${item.detail}`).join(' '),
    ).toContain('水泵异常')
  })

  it('freezes both supply results in recap and commits them once on continue', () => {
    let state = chooseRepair(scenario.createInitialState())
    state = applyPlayerAction(
      state,
      createPlayerAction(2, state.currentTick, {
        type: 'SET_PAUSED',
        paused: false,
      }),
      scenario,
    ).state
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = advanceSimulation(state, scenario.weekEndTick, scenario).state

    expect(state.inventory).toEqual({ food: 18, repair: 9 })
    expect(state.recap).not.toBeNull()
    if (state.recap === null) throw new Error('Expected the week-one recap')
    expect(state.recap.supplies.food.planned).toEqual({ low: 9, high: 9 })
    expect(state.recap.supplies.food.actual).toBe(8)
    expect(state.recap.supplies.food.endingStock).toBe(8)
    expect(state.recap.supplies.repair.actual).toBe(
      state.recap.supplies.repair.endingStock,
    )
    expect(state.recap.supplies.repair.reasons.length).toBeGreaterThan(0)

    const weekOneActual = {
      food: state.recap.supplies.food.actual,
      repair: state.recap.supplies.repair.actual,
    }
    expect(state.currentTick).toBe(1002)
    expect(() => advanceSimulation(state, 1003, scenario)).toThrow('不可达')
    expect(() => advanceSimulation(state, 1062, scenario)).toThrow(
      '先完成周末复盘',
    )
    state = applyPlayerAction(
      state,
      createPlayerAction(3, state.currentTick, {
        type: 'CONTINUE_TO_NEXT_WEEK',
      }),
      scenario,
    ).state

    expect(state.actionLog.at(-1)?.atTick).toBe(1002)
    expect(state.currentTick).toBe(1062)
    expect(state.inventory).toEqual(weekOneActual)
    expect(calculateFoodForecast(state).currentStock).toBe(weekOneActual.food)
    expect(calculateRepairForecast(state).currentStock).toBe(weekOneActual.repair)
    expect(() =>
      applyPlayerAction(
        state,
        createPlayerAction(4, state.currentTick, {
          type: 'CONTINUE_TO_NEXT_WEEK',
        }),
        scenario,
      ),
    ).toThrow('只有未完成的周末复盘')
  })

  it('records a week-one fertilizer application in the authoritative lifecycle', () => {
    const state = applyPlayerAction(
      scenario.createInitialState(),
      createPlayerAction(1, scenario.startTick, {
        type: 'USE_FERTILIZER',
      }),
      scenario,
    ).state

    expect(state.fertilizer).toEqual({
      initialUnits: 1,
      appliedWeekIndex: 0,
      remainingUnits: 0,
    })
    expect(state.fertilizerUsed).toBe(true)
  })

  it('applies week-one fertilizer only to week one and preserves the spent asset in recaps', () => {
    const initial = scenario.createInitialState()
    const baselineProduction = calculateFoodForecast(initial).production.high
    let state = applyPlayerAction(
      initial,
      createPlayerAction(1, initial.currentTick, {
        type: 'USE_FERTILIZER',
      }),
      scenario,
    ).state

    expect(calculateFoodForecast(state).production.high).toBe(
      baselineProduction + 6,
    )
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = advanceSimulation(state, scenario.weekEndTick, scenario).state
    const recapWithoutFertilizer = {
      ...state,
      fertilizer: {
        initialUnits: 1 as const,
        appliedWeekIndex: null,
        remainingUnits: 1 as const,
      },
      fertilizerUsed: false,
    }
    expect(calculateFoodForecast(state).production.high).toBe(
      calculateFoodForecast(recapWithoutFertilizer).production.high + 6,
    )
    expect(state.recap?.fertilizer).toEqual({
      appliedWeekIndex: 0,
      remainingUnits: 0,
      bonus: 6,
    })

    state = applyPlayerAction(
      state,
      createPlayerAction(2, state.currentTick, {
        type: 'CONTINUE_TO_NEXT_WEEK',
      }),
      scenario,
    ).state
    const unusedControl = {
      ...state,
      fertilizer: {
        initialUnits: 1 as const,
        appliedWeekIndex: null,
        remainingUnits: 1 as const,
      },
      fertilizerUsed: false,
    }
    expect(calculateFoodForecast(state).production).toEqual(
      calculateFoodForecast(unusedControl).production,
    )

    state = advanceSimulation(
      state,
      scenario.linHeRequestDeadlineTick,
      scenario,
    ).state
    state = advanceSimulation(state, scenario.simulationEndTick, scenario).state
    expect(state.recap?.fertilizer).toEqual({
      appliedWeekIndex: 0,
      remainingUnits: 0,
      bonus: 0,
    })
  })

  it('keeps fertilizer through week one and applies it only in week two', () => {
    let state = scenario.createInitialState()
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = advanceSimulation(state, scenario.weekEndTick, scenario).state
    expect(state.recap?.fertilizer).toEqual({
      appliedWeekIndex: null,
      remainingUnits: 1,
      bonus: 0,
    })

    state = applyPlayerAction(
      state,
      createPlayerAction(1, state.currentTick, {
        type: 'CONTINUE_TO_NEXT_WEEK',
      }),
      scenario,
    ).state
    const baselineProduction = calculateFoodForecast(state).production.high
    state = applyPlayerAction(
      state,
      createPlayerAction(2, state.currentTick, {
        type: 'USE_FERTILIZER',
      }),
      scenario,
    ).state

    expect(state.fertilizer).toEqual({
      initialUnits: 1,
      appliedWeekIndex: 1,
      remainingUnits: 0,
    })
    expect(calculateFoodForecast(state).production.high).toBe(
      baselineProduction + 6,
    )

    state = advanceSimulation(
      state,
      scenario.linHeRequestDeadlineTick,
      scenario,
    ).state
    state = advanceSimulation(state, scenario.simulationEndTick, scenario).state
    expect(state.recap?.fertilizer).toEqual({
      appliedWeekIndex: 1,
      remainingUnits: 0,
      bonus: 6,
    })
  })

  it('retains one fertilizer unit at the end when the player never applies it', () => {
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
    state = advanceSimulation(
      state,
      scenario.linHeRequestDeadlineTick,
      scenario,
    ).state
    state = advanceSimulation(state, scenario.simulationEndTick, scenario).state

    expect(state.fertilizer).toEqual({
      initialUnits: 1,
      appliedWeekIndex: null,
      remainingUnits: 1,
    })
    expect(state.recap?.fertilizer).toEqual({
      appliedWeekIndex: null,
      remainingUnits: 1,
      bonus: 0,
    })
  })

  it('rejects a second application from the spent fertilizer lifecycle', () => {
    const initial = scenario.createInitialState()
    const state = applyPlayerAction(
      initial,
      createPlayerAction(1, initial.currentTick, {
        type: 'USE_FERTILIZER',
      }),
      scenario,
    ).state
    const staleCompatibilityFlag = {
      ...state,
      fertilizerUsed: false,
    }

    expect(() =>
      applyPlayerAction(
        staleCompatibilityFlag,
        createPlayerAction(2, staleCompatibilityFlag.currentTick, {
          type: 'USE_FERTILIZER',
        }),
        scenario,
      ),
    ).toThrow('库存中没有第二份')
  })

  it('rejects fertilizer use after the final recap has frozen the remaining asset', () => {
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
    state = advanceSimulation(
      state,
      scenario.linHeRequestDeadlineTick,
      scenario,
    ).state
    state = advanceSimulation(state, scenario.simulationEndTick, scenario).state

    expect(() =>
      applyPlayerAction(
        state,
        createPlayerAction(2, state.currentTick, {
          type: 'USE_FERTILIZER',
        }),
        scenario,
      ),
    ).toThrow('周末复盘已经冻结')
    expect(state.fertilizer.remainingUnits).toBe(1)
    expect(state.recap?.fertilizer.remainingUnits).toBe(1)
  })
})
