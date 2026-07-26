export type Activity = 'food' | 'repair' | 'logistics' | 'study' | 'rest' | 'social'
export type PumpStatus = 'at-risk' | 'protected' | 'failed'
export type CharacterId = 'lin-he' | 'qiao-pan' | 'su-ji' | 'chen-du'
export type ScheduleScope = 'weekly' | 'immediate' | 'base'
export type ScheduleLayer = 'weeklyOverrides' | 'immediateAdjustments' | 'basePlan'

export interface CharacterDefinition {
  id: CharacterId
  name: string
  skill: string
}

export interface ResolvedScheduleBlock {
  blockId: string
  characterId: CharacterId
  dayIndex: number
  blockIndex: number
  activity: Activity
  source: '基础计划' | '本周例外' | '即时调整'
}

export interface ScheduleChange {
  key: string
  layer: ScheduleLayer
  before?: Activity
  after: Activity
}

export interface ScheduleTransaction {
  actionId: string
  affectedBlockIds: readonly string[]
  changes: readonly ScheduleChange[]
}

export interface ForecastRange {
  low: number
  high: number
}

export interface FoodForecast {
  currentStock: number
  production: ForecastRange
  consumption: number
  endingStock: ForecastRange
  status: '严重短缺' | '轻度缺口' | '脆弱平衡' | '目标区间'
  trend: '风险未消除' | '风险收窄' | '事件下调'
  reasons: readonly string[]
}

export interface TimelineEntry {
  order: number
  atTick: number
  kind: 'scripted-event' | 'player-action'
  id: string
  title: string
  detail: string
  before?: ForecastRange
  after?: ForecastRange
}

export interface WeekendRecap {
  planned: ForecastRange
  actual: number
  headline: string
  items: readonly string[]
}

export interface SimulationState {
  currentTick: number
  isPaused: boolean
  activity: Activity
  basePlan: Readonly<Record<string, Activity>>
  weeklyOverrides: Readonly<Record<string, Activity>>
  immediateAdjustments: Readonly<Record<string, Activity>>
  scheduleTransactions: readonly ScheduleTransaction[]
  pumpStatus: PumpStatus
  processedScriptEventIds: readonly string[]
  actionLog: readonly PlayerActionEnvelope[]
  timeline: readonly TimelineEntry[]
  planSnapshot: ForecastRange | null
  recap: WeekendRecap | null
  recaps: readonly WeekendRecap[]
  completedWeekIndexes: readonly number[]
  isComplete: boolean
}

export type PlayerAction =
  | { type: 'CHANGE_ACTIVITY'; activity: Activity }
  | {
      type: 'EDIT_SCHEDULE'
      blockIds: readonly string[]
      activity: Activity
      scope: ScheduleScope
    }
  | {
      type: 'COPY_DAY'
      characterId: CharacterId
      sourceDayIndex: number
      targetDayIndex: number
      scope: ScheduleScope
    }
  | { type: 'UNDO_SCHEDULE' }
  | { type: 'SET_PAUSED'; paused: boolean }

export interface PlayerActionEnvelope {
  id: string
  sequence: number
  atTick: number
  action: PlayerAction
  affectedBlockIds: readonly string[]
}

export interface ScriptedEvent {
  id: string
  atTick: number
  type: 'PUMP_INCIDENT'
}

export interface ScenarioDefinition {
  id: string
  version: string
  fixedSeed: number
  startTick: number
  weekEndTick: number
  weekEndTicks: readonly number[]
  simulationEndTick: number
  pumpEventTick: number
  createInitialState(): SimulationState
  scriptedEvents: readonly ScriptedEvent[]
}

export interface DomainEvent {
  id: string
  type:
    | 'activity-changed'
    | 'schedule-edited'
    | 'schedule-undone'
    | 'clock-changed'
    | 'pump-incident'
    | 'week-ended'
  atTick: number
  before?: ForecastRange
  after?: ForecastRange
}

export interface TransitionResult {
  state: SimulationState
  events: readonly DomainEvent[]
}
