import type { ScenarioDefinition, SimulationState } from '../sim/model'
import { createInitialBasePlan } from '../sim/schedule'

export const TICKS_PER_DAY = 144
export const START_TICK = 54
export const PUMP_EVENT_TICK = TICKS_PER_DAY * 2 + 54
export const WEEK_END_TICK = TICKS_PER_DAY * 6 + 138
export const SIMULATION_END_TICK = TICKS_PER_DAY * 13 + 138
export const LIN_HE_REQUEST_DEADLINE_TICK = TICKS_PER_DAY * 8 + 54
export const WEEK_START_TICKS = [
  START_TICK,
  TICKS_PER_DAY * 7 + START_TICK,
] as const
export const WEEKLY_TRANSPORT_START_TICKS = [
  78,
  TICKS_PER_DAY * 7 + 78,
] as const

export const gate1WeekOneScenario: ScenarioDefinition = {
  id: 'gate1-two-week-management',
  version: '0.5.0',
  fixedSeed: 104729,
  startTick: START_TICK,
  weekStartTicks: WEEK_START_TICKS,
  weekEndTick: WEEK_END_TICK,
  weekEndTicks: [WEEK_END_TICK, SIMULATION_END_TICK],
  simulationEndTick: SIMULATION_END_TICK,
  pumpEventTick: PUMP_EVENT_TICK,
  linHeRequestDeadlineTick: LIN_HE_REQUEST_DEADLINE_TICK,
  weeklyTransportStartTicks: WEEKLY_TRANSPORT_START_TICKS,
  scriptedEvents: [
    {
      id: 'pump-incident-day-3',
      atTick: PUMP_EVENT_TICK,
      type: 'PUMP_INCIDENT',
    },
    {
      id: 'lin-he-request-deadline',
      atTick: LIN_HE_REQUEST_DEADLINE_TICK,
      type: 'LIN_HE_REQUEST_DEADLINE',
    },
  ],
  createInitialState(): SimulationState {
    return {
      currentTick: START_TICK,
      isPaused: true,
      activity: 'rest',
      basePlan: createInitialBasePlan(),
      weeklyOverrides: {},
      immediateAdjustments: {},
      scheduleTransactions: [],
      pumpStatus: 'at-risk',
      processedScriptEventIds: [],
      actionLog: [],
      timeline: [],
      planSnapshot: null,
      supplyPlanSnapshot: null,
      recap: null,
      recaps: [],
      completedWeekIndexes: [],
      isComplete: false,
      inventory: {
        food: 18,
        repair: 9,
      },
      fertilizer: {
        initialUnits: 1,
        appliedWeekIndex: null,
        remainingUnits: 1,
      },
      fertilizerUsed: false,
      acceptedFoodShortfall: false,
      linHeRequestDecision: 'pending',
      linHeRequestResolutionSource: null,
      transportRouteId: 'north-loop',
      transportRouteOpenedAtTick: null,
      repairResponsibilitySelection: null,
      repairResponsibility: 'unresolved',
      repairResponsibilityAssignment: null,
      repairDebt: null,
      characterRecords: {
        'lin-he': ['第二周希望占用一个农务块学习，等待管理者答复。'],
        'qiao-pan': ['接受正常排班与连续不超过两日的短期加班。'],
        'su-ji': ['物流效率稳定，可承担基础岗位交接。'],
        'chen-du': ['泛用协作稳定，适合作为粮食与维修之间的调剂者。'],
      },
    }
  },
}
