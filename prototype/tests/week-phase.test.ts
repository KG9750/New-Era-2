import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import { selectClockLabel } from '../src/sim/selectors'
import { weekIndexForTick } from '../src/sim/week-phase'

describe('RC9 shared week phase', () => {
  it('maps reachable boundary ticks and rejects the inter-week gap', () => {
    expect(weekIndexForTick(54, scenario)).toBe(0)
    expect(weekIndexForTick(1002, scenario)).toBe(0)
    expect(weekIndexForTick(1062, scenario)).toBe(1)
    expect(weekIndexForTick(2010, scenario)).toBe(1)

    for (let tick = 1003; tick <= 1061; tick += 1) {
      expect(() => weekIndexForTick(tick, scenario)).toThrow('不可达')
    }
  })

  it('starts week two on Monday at tick 1062', () => {
    const initial = scenario.createInitialState()

    expect(selectClockLabel(initial)).toBe('周一 09:00')
    expect(
      selectClockLabel({
        ...initial,
        currentTick: 1062,
      }),
    ).toBe('周一 09:00')
  })
})
