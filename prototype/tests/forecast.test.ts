import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import {
  calculateFoodForecast,
  calculateRepairForecast,
} from '../src/sim/forecast'

describe('RC9-02 inventory forecasts', () => {
  it('uses the frozen RC9 scenario version', () => {
    expect(scenario.version).toBe('0.5.1')
  })

  it('starts with one unapplied fertilizer unit', () => {
    expect(scenario.createInitialState().fertilizer).toEqual({
      initialUnits: 1,
      appliedWeekIndex: null,
      remainingUnits: 1,
    })
  })

  it('uses the fertilizer lifecycle, not the compatibility flag, as forecast authority', () => {
    const initial = scenario.createInitialState()
    const baseline = calculateFoodForecast(initial).production.high
    const appliedThisWeek = {
      ...initial,
      fertilizer: {
        initialUnits: 1 as const,
        appliedWeekIndex: 0 as const,
        remainingUnits: 0 as const,
      },
      fertilizerUsed: false,
    }
    const staleCompatibilityFlag = {
      ...initial,
      fertilizerUsed: true,
    }

    expect(calculateFoodForecast(appliedThisWeek).production.high).toBe(baseline + 6)
    expect(calculateFoodForecast(staleCompatibilityFlag).production.high).toBe(baseline)
  })

  it('reads the current food and repair stocks from simulation state', () => {
    const state = {
      ...scenario.createInitialState(),
      inventory: {
        food: 5,
        repair: 7,
      },
    }

    expect(calculateFoodForecast(state).currentStock).toBe(5)
    expect(calculateRepairForecast(state).currentStock).toBe(7)
  })
})
