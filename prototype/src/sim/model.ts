export type Activity = 'rest' | 'repair'
export type PumpStatus = 'at-risk' | 'protected' | 'failed'

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
  pumpStatus: PumpStatus
  processedScriptEventIds: readonly string[]
  actionLog: readonly PlayerActionEnvelope[]
  timeline: readonly TimelineEntry[]
  planSnapshot: ForecastRange | null
  recap: WeekendRecap | null
}

export type PlayerAction =
  | { type: 'CHANGE_ACTIVITY'; activity: Activity }
  | { type: 'SET_PAUSED'; paused: boolean }

export interface PlayerActionEnvelope {
  id: string
  sequence: number
  atTick: number
  action: PlayerAction
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
  pumpEventTick: number
  createInitialState(): SimulationState
  scriptedEvents: readonly ScriptedEvent[]
}

export interface DomainEvent {
  id: string
  type: 'activity-changed' | 'clock-changed' | 'pump-incident' | 'week-ended'
  atTick: number
  before?: ForecastRange
  after?: ForecastRange
}

export interface TransitionResult {
  state: SimulationState
  events: readonly DomainEvent[]
}
