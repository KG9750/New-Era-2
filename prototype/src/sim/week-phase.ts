import type { ScenarioDefinition } from './model'

export function weekIndexForTick(
  tick: number,
  scenario: ScenarioDefinition,
): 0 | 1 {
  const weekIndex = scenario.weekStartTicks.findIndex(
    (startTick, index) =>
      tick >= startTick && tick <= scenario.weekEndTicks[index],
  )

  if (weekIndex === 0 || weekIndex === 1) return weekIndex
  throw new Error(`Tick ${tick} 位于不可达的周相位`)
}
