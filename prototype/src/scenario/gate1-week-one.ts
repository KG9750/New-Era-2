import type { ScenarioDefinition, SimulationState } from '../sim/model'

export const TICKS_PER_DAY = 144
export const START_TICK = 54
export const PUMP_EVENT_TICK = TICKS_PER_DAY * 2 + 54
export const WEEK_END_TICK = TICKS_PER_DAY * 5 + 108

export const gate1WeekOneScenario: ScenarioDefinition = {
  id: 'gate1-week-one-minimal',
  version: '0.1.0',
  fixedSeed: 104729,
  startTick: START_TICK,
  weekEndTick: WEEK_END_TICK,
  pumpEventTick: PUMP_EVENT_TICK,
  scriptedEvents: [
    {
      id: 'pump-incident-day-3',
      atTick: PUMP_EVENT_TICK,
      type: 'PUMP_INCIDENT',
    },
  ],
  createInitialState(): SimulationState {
    return {
      currentTick: START_TICK,
      isPaused: true,
      activity: 'rest',
      pumpStatus: 'at-risk',
      processedScriptEventIds: [],
      actionLog: [],
      timeline: [],
      planSnapshot: null,
      recap: null,
    }
  },
}
