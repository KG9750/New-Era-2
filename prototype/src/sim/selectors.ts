import type { ScenarioDefinition, SimulationState } from './model'

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function selectClockLabel(state: SimulationState): string {
  const day = Math.floor(state.currentTick / 144)
  const minutes = (state.currentTick % 144) * 10
  const hours = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${DAY_NAMES[day] ?? `第 ${day + 1} 日`} ${hours.toString().padStart(2, '0')}:${minute
    .toString()
    .padStart(2, '0')}`
}

export function selectProgress(
  state: SimulationState,
  scenario: ScenarioDefinition,
): number {
  const elapsed = state.currentTick - scenario.startTick
  const duration = scenario.weekEndTick - scenario.startTick
  return Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100)))
}
