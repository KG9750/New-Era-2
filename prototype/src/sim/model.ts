export type Activity = 'food' | 'repair' | 'logistics' | 'study' | 'rest' | 'social'
export type PumpStatus = 'at-risk' | 'protected' | 'failed'
export type CharacterId = 'lin-he' | 'qiao-pan' | 'su-ji' | 'chen-du'
export type ScheduleScope = 'weekly' | 'immediate' | 'base'
export type ScheduleLayer = 'weeklyOverrides' | 'immediateAdjustments' | 'basePlan'
export type SupplyStatus =
  | '严重短缺'
  | '轻度缺口'
  | '脆弱平衡'
  | '目标区间'
  | '显著过剩'
export type SupplyTrend = '上升' | '持平' | '下调' | '风险未消除' | '风险收窄' | '事件下调'
export type LinHeRequestDecision = 'pending' | 'accepted' | 'declined'
export type LinHeRequestResolutionSource = 'player' | 'deadline' | null
export type TransportRouteId = 'north-loop' | 'south-shortcut'
export type RecapCategory = '计划内结果' | '已知风险' | '新事件'

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
  id: 'food'
  label: '粮食'
  currentStock: number
  production: ForecastRange
  consumption: number
  endingStock: ForecastRange
  status: SupplyStatus
  trend: SupplyTrend
  reasons: readonly string[]
  acceptedRisk: boolean
}

export interface RepairForecast {
  id: 'repair'
  label: '维修保障'
  currentStock: number
  production: ForecastRange
  consumption: number
  endingStock: ForecastRange
  status: SupplyStatus
  trend: SupplyTrend
  reasons: readonly string[]
  acceptedRisk: false
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
  items: readonly WeekendRecapItem[]
}

export interface WeekendRecapItem {
  id: string
  category: RecapCategory
  sourceId: string
  title: string
  detail: string
  values: Readonly<Record<string, number>>
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
  fertilizerUsed: boolean
  acceptedFoodShortfall: boolean
  linHeRequestDecision: LinHeRequestDecision
  linHeRequestResolutionSource: LinHeRequestResolutionSource
  transportRouteId: TransportRouteId
  transportRouteOpenedAtTick: number | null
  characterRecords: Readonly<Record<CharacterId, readonly string[]>>
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
  | { type: 'USE_FERTILIZER' }
  | { type: 'SET_FOOD_SHORTFALL_ACCEPTED'; accepted: boolean }
  | { type: 'RESOLVE_LIN_HE_REQUEST'; decision: Exclude<LinHeRequestDecision, 'pending'> }
  | { type: 'OPEN_TRANSPORT_SHORTCUT' }
  | { type: 'CONTINUE_TO_NEXT_WEEK' }
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
  type: 'PUMP_INCIDENT' | 'LIN_HE_REQUEST_DEADLINE'
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
  linHeRequestDeadlineTick: number
  weeklyTransportStartTicks: readonly number[]
  createInitialState(): SimulationState
  scriptedEvents: readonly ScriptedEvent[]
}

export interface DomainEvent {
  id: string
  type:
    | 'activity-changed'
    | 'schedule-edited'
    | 'schedule-undone'
    | 'fertilizer-used'
    | 'food-shortfall-accepted'
    | 'lin-he-request-resolved'
    | 'transport-shortcut-opened'
    | 'clock-changed'
    | 'pump-incident'
    | 'lin-he-request-expired'
    | 'week-ended'
  atTick: number
  before?: ForecastRange
  after?: ForecastRange
}

export interface TransitionResult {
  state: SimulationState
  events: readonly DomainEvent[]
}
