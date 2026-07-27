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
  REPAIR_RESPONSIBILITY_SCHEDULE_OPTIONS,
  resolveScheduleBlock,
} from '../src/sim/schedule'
import { canOpenTransportShortcut } from '../src/sim/transport'

function act(
  state: SimulationState,
  sequence: number,
  action: PlayerAction,
): SimulationState {
  return applyPlayerAction(
    state,
    createPlayerAction(sequence, state.currentTick, action),
    scenario,
  ).state
}

function startWeekTwo(): SimulationState {
  let state = scenario.createInitialState()
  state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
  state = advanceSimulation(state, scenario.weekEndTick, scenario).state
  return act(state, 1, { type: 'CONTINUE_TO_NEXT_WEEK' })
}

describe('RC9-01A oracle/runtime alignment', () => {
  it('uses a real food schedule tradeoff with visible food and repair changes', () => {
    const initial = scenario.createInitialState()
    const changed = act(initial, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d1:b1'],
      activity: 'food',
      scope: 'weekly',
    })

    expect(resolveScheduleBlock(initial, 'qiao-pan:d1:b1').activity).toBe(
      'repair',
    )
    expect(resolveScheduleBlock(changed, 'qiao-pan:d1:b1').activity).toBe(
      'food',
    )
    expect(calculateFoodForecast(initial).endingStock).toEqual({
      low: 3,
      high: 11,
    })
    expect(calculateFoodForecast(changed).endingStock).toEqual({
      low: 4,
      high: 12,
    })
    expect(calculateRepairForecast(initial).endingStock).toEqual({
      low: 3,
      high: 5,
    })
    expect(calculateRepairForecast(changed).endingStock).toEqual({
      low: 1,
      high: 3,
    })
  })

  it('uses the actual Lin He study block and resolves it from food to study', () => {
    expect(LIN_HE_STUDY_BLOCK_ID).toBe('lin-he:d8:b0')

    const weekTwo = startWeekTwo()
    const accepted = act(weekTwo, 2, {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'accepted',
    })

    expect(resolveScheduleBlock(weekTwo, LIN_HE_STUDY_BLOCK_ID).activity).toBe(
      'food',
    )
    expect(resolveScheduleBlock(accepted, LIN_HE_STUDY_BLOCK_ID).activity).toBe(
      'study',
    )
  })

  it('freezes all three accepted repair responsibility schedule objects', () => {
    expect(REPAIR_RESPONSIBILITY_SCHEDULE_OPTIONS).toEqual([
      {
        direction: 'qiao-pan',
        actorId: 'qiao-pan',
        blockId: 'qiao-pan:d3:b2',
        characterLoadCost: 2,
        repairOutputDelta: 2,
      },
      {
        direction: 'handoff',
        actorId: 'chen-du',
        blockId: 'chen-du:d3:b0',
        characterLoadCost: 2,
        repairOutputDelta: 1,
      },
      {
        direction: 'handoff',
        actorId: 'su-ji',
        blockId: 'su-ji:d3:b0',
        characterLoadCost: 1,
        repairOutputDelta: 1,
      },
    ])
  })

  it('keeps transport and fertilizer reachable in both runtime weeks', () => {
    const weekOne = scenario.createInitialState()
    expect(canOpenTransportShortcut(weekOne, scenario)).toBe(true)
    expect(
      act(weekOne, 1, { type: 'USE_FERTILIZER' }).fertilizer,
    ).toMatchObject({
      appliedWeekIndex: 0,
      remainingUnits: 0,
    })

    const weekTwo = startWeekTwo()
    expect(canOpenTransportShortcut(weekTwo, scenario)).toBe(true)
    expect(
      act(weekTwo, 2, { type: 'USE_FERTILIZER' }).fertilizer,
    ).toMatchObject({
      appliedWeekIndex: 1,
      remainingUnits: 0,
    })
  })
})
