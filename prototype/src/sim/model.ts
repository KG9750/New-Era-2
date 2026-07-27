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
export type RepairResponsibilitySelection = 'qiao-pan' | 'handoff'
export type RepairResponsibility = 'unresolved' | 'scheduled' | 'debt'
export type ManagementChoiceSetId =
  | 'choice:w0:preventive-capacity'
  | 'choice:w1:recovery-allocation'
export type ManagementDecisionIntentId =
  | 'w0:preventive-capacity:pump'
  | 'w1:recovery-allocation:pump-vs-food'
export type PreventiveCapacityCandidateId =
  | 'schedule-preventive-maintenance'
  | 'retain-rest-capacity'
export type RecoveryAllocationCandidateId =
  | 'allocate-repair-buffer'
  | 'allocate-food-production'
export type ManagementCandidateId =
  | PreventiveCapacityCandidateId
  | RecoveryAllocationCandidateId
export type ManagementTerminalState =
  | 'open'
  | 'omitted'
  | 'unqualified-direct-edit'
  | ManagementCandidateId
export type EquipmentExposure = 'high' | 'low'

export interface ManagementChoiceAuthority {
  diagnosisId: string
  sessionId: string
  candidateBuildAuthorityHash: string
  sessionAuthorityToken: string
}

export interface ManagementChoiceOpportunity {
  opportunityId: string
  decisionIntentId: ManagementDecisionIntentId
  choiceSetId: ManagementChoiceSetId
  candidateId: null
  objectRef: string
  week: 0 | 1
  diagnosisId: string
  sessionId: string
  candidateBuildAuthorityHash: string
  sessionAuthorityToken: string
  stateRevision: number
  projectionBaseHash: string
  candidateProjectionHash: string | null
  idempotencyKey: string | null
  commitCause: 'opportunity-created'
  resourceClaimRef: string
  requiredConsequenceIds: readonly string[]
  effectFingerprints: readonly string[]
  terminalState: ManagementTerminalState
  committedAtSequence: number | null
}

export interface ManagementChoiceConsequence {
  consequenceId: string
  opportunityId: string
  decisionIntentId: ManagementDecisionIntentId
  choiceSetId: ManagementChoiceSetId
  candidateId: ManagementCandidateId
  objectRef: string
  week: 0 | 1
  diagnosisId: string
  sessionId: string
  candidateBuildAuthorityHash: string
  sessionAuthorityToken: string
  stateRevision: number
  projectionBaseHash: string
  candidateProjectionHash: string
  idempotencyKey: string
  commitCause: 'explicit-candidate-action'
  resourceClaimRef: string
  requiredConsequenceIds: readonly string[]
  effectFingerprints: readonly string[]
  terminalState: ManagementCandidateId
  committedAtSequence: number
  effectFingerprint: string
  beforeValue: string | number
  afterValue: string | number
}

export interface ManagementChoiceCommitment {
  opportunityId: string
  decisionIntentId: ManagementDecisionIntentId
  choiceSetId: ManagementChoiceSetId
  candidateId: ManagementCandidateId
  objectRef: string
  week: 0 | 1
  diagnosisId: string
  sessionId: string
  candidateBuildAuthorityHash: string
  sessionAuthorityToken: string
  stateRevision: number
  projectionBaseHash: string
  candidateProjectionHash: string
  idempotencyKey: string
  commitCause: 'explicit-candidate-action'
  resourceClaimRef: string
  requiredConsequenceIds: readonly string[]
  effectFingerprints: readonly string[]
  terminalState: ManagementCandidateId
  committedAtSequence: number
  consequences: readonly ManagementChoiceConsequence[]
}

export interface ManagementChoiceCommitRequest {
  opportunityId: string
  choiceSetId: ManagementChoiceSetId
  candidateId: ManagementCandidateId
  diagnosisId: string
  sessionId: string
  candidateBuildAuthorityHash: string
  sessionAuthorityToken: string
  stateRevision: number
  projectionBaseHash: string
  candidateProjectionHash: string
  idempotencyKey: string
  commitCause: 'explicit-candidate-action'
}

export interface ManagementChoiceState {
  authority: ManagementChoiceAuthority | null
  opportunities: {
    preventiveCapacity: ManagementChoiceOpportunity | null
    recoveryAllocation: ManagementChoiceOpportunity | null
  }
  commitments: readonly ManagementChoiceCommitment[]
  effectOwnership: Readonly<Record<string, ManagementDecisionIntentId>>
  equipmentExposure: EquipmentExposure
  equipmentRecoveryLoad: 0 | 1 | 2
  preventiveCapacityAllocation:
    | 'unallocated'
    | 'maintenance'
    | 'rest'
  linHeRecoveryUnits: 0 | 1
  personnelReadiness: number
}

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
  repairResponsibilityBefore?: RepairResponsibilityAssignment
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
  supplies: WeekendSupplyRecaps
  fertilizer: WeekendFertilizerRecap
  headline: string
  items: readonly WeekendRecapItem[]
}

export interface WeekendFertilizerRecap {
  appliedWeekIndex: 0 | 1 | null
  remainingUnits: 0 | 1
  bonus: 0 | 6
}

export interface WeekendSupplyRecap {
  planned: ForecastRange
  actual: number
  endingStock: number
  reasons: readonly string[]
}

export interface WeekendSupplyRecaps {
  food: WeekendSupplyRecap
  repair: WeekendSupplyRecap
}

export interface WeekendRecapItem {
  id: string
  category: RecapCategory
  sourceId: string
  title: string
  detail: string
  values: Readonly<Record<string, number>>
}

export interface SettlementInventory {
  food: number
  repair: number
}

export interface FertilizerLifecycle {
  initialUnits: 1
  appliedWeekIndex: 0 | 1 | null
  remainingUnits: 0 | 1
}

export interface RepairResponsibilityAssignment {
  actionId: string
  weekIndex: 0 | 1
  actorId: CharacterId
  blockId: string
  characterLoadCost: number
  repairOutputDelta: number
}

export interface RepairDebtState {
  acceptedActionId: string
  dueTick: number
  weeklyPenalty: 3
  accruedPenalty: number
  settlementRecapIndex: 1
  settled: boolean
  settledAtTick: number | null
  currentRisk: string
  nextConsequence: string
}

export interface SupplyPlanSnapshot {
  food: ForecastRange
  repair: ForecastRange
}

export interface SimulationState {
  stateRevision: number
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
  supplyPlanSnapshot: SupplyPlanSnapshot | null
  recap: WeekendRecap | null
  recaps: readonly WeekendRecap[]
  completedWeekIndexes: readonly number[]
  isComplete: boolean
  inventory: SettlementInventory
  fertilizer: FertilizerLifecycle
  fertilizerUsed: boolean
  acceptedFoodShortfall: boolean
  linHeRequestDecision: LinHeRequestDecision
  linHeRequestResolutionSource: LinHeRequestResolutionSource
  transportRouteId: TransportRouteId
  transportRouteOpenedAtTick: number | null
  repairResponsibilitySelection: RepairResponsibilitySelection | null
  repairResponsibility: RepairResponsibility
  repairResponsibilityAssignment: RepairResponsibilityAssignment | null
  repairDebt: RepairDebtState | null
  characterRecords: Readonly<Record<CharacterId, readonly string[]>>
  managementChoices: ManagementChoiceState
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
  | {
      type: 'SELECT_REPAIR_RESPONSIBILITY'
      responsible: RepairResponsibilitySelection
    }
  | { type: 'ACCEPT_REPAIR_DEBT' }
  | { type: 'RESOLVE_LIN_HE_REQUEST'; decision: Exclude<LinHeRequestDecision, 'pending'> }
  | { type: 'OPEN_TRANSPORT_SHORTCUT' }
  | {
      type: 'COMMIT_MANAGEMENT_CHOICE'
      request: ManagementChoiceCommitRequest
    }
  | { type: 'CONTINUE_TO_NEXT_WEEK' }
  | { type: 'SET_PAUSED'; paused: boolean }

export interface PlayerActionEnvelope {
  id: string
  sequence: number
  atTick: number
  action: PlayerAction
  affectedBlockIds: readonly string[]
  undoOfActionId?: string
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
  weekStartTicks: readonly number[]
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
    | 'repair-responsibility-selected'
    | 'repair-responsibility-scheduled'
    | 'repair-debt-accepted'
    | 'lin-he-request-resolved'
    | 'transport-shortcut-opened'
    | 'management-choice-committed'
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
