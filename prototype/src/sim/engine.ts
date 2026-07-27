import {
  calculateFoodForecast,
  calculateRepairForecast,
  formatRange,
  GATE1_FOOD_TARGET,
  GATE1_REPAIR_TARGET,
} from './forecast'
import type {
  DomainEvent,
  ForecastRange,
  PlayerAction,
  PlayerActionEnvelope,
  ScenarioDefinition,
  SimulationState,
  TransitionResult,
  WeekendRecap,
  WeekendRecapItem,
} from './model'
import {
  PUMP_MAINTENANCE_BLOCK_ID,
  LIN_HE_STUDY_BLOCK_ID,
  affectedBlockIdsFor,
  applyScheduleTransaction,
  blockEndTick,
  expireScheduleLayers,
  findRepairResponsibilityAssignment,
  findQiaoPanBoundaryWarning,
  hasPreventiveMaintenance,
  isLinHeRequestBlockLocked,
  resolveScheduleBlock,
  undoLastScheduleTransaction,
} from './schedule'
import {
  canOpenTransportShortcut,
  selectTransportRepairCost,
  selectTransportRoute,
} from './transport'
import { weekIndexForTick } from './week-phase'
import {
  PREVENTIVE_CAPACITY_DEADLINE_TICK,
  RECOVERY_ALLOCATION_DEADLINE_TICK,
  commitManagementChoice,
  freezePreventiveCapacityOpportunity,
  freezeRecoveryAllocationOpportunity,
  isManagementScheduleBlockLocked,
  openRecoveryAllocationOpportunity,
  synchronizeManagementScheduleState,
  type ManagementChoiceCommitFailureCode,
} from './management-choices'
import {
  GATE1_BRANCH_MATRIX_AXES,
  evaluateDominance,
  gate1BranchOutcomeVector,
  type Gate1BranchMatrixContext,
  type Gate1BranchMatrixOracle,
  Gate1BranchOutcome,
  Gate1BranchPlan,
  type Gate1ChoiceSetId,
  type Gate1WeekOneOutcome,
} from '../scenario/gate1-week-one'

export function createPlayerAction(
  sequence: number,
  atTick: number,
  action: PlayerAction,
  undoOfActionId?: string,
): PlayerActionEnvelope {
  return {
    id: `action-${sequence.toString().padStart(4, '0')}`,
    sequence,
    atTick,
    action,
    affectedBlockIds:
      action.type === 'OPEN_TRANSPORT_SHORTCUT'
        ? ['map:transport-route']
        : affectedBlockIdsFor(action),
    ...(undoOfActionId ? { undoOfActionId } : {}),
  }
}

export class ManagementChoiceCommitError extends Error {
  constructor(
    public readonly code: ManagementChoiceCommitFailureCode,
  ) {
    super(code)
    this.name = 'ManagementChoiceCommitError'
  }
}

function changesManagementProjection(action: PlayerAction) {
  return [
    'CHANGE_ACTIVITY',
    'EDIT_SCHEDULE',
    'COPY_DAY',
    'UNDO_SCHEDULE',
    'USE_FERTILIZER',
    'ACCEPT_REPAIR_DEBT',
    'RESOLVE_LIN_HE_REQUEST',
    'OPEN_TRANSPORT_SHORTCUT',
    'CONTINUE_TO_NEXT_WEEK',
  ].includes(action.type)
}

function rangeOf(state: SimulationState): ForecastRange {
  return calculateFoodForecast(state).endingStock
}

function supplyPlanOf(state: SimulationState) {
  return {
    food: calculateFoodForecast(state).endingStock,
    repair: calculateRepairForecast(state).endingStock,
  }
}

function supplyChangeDetail(beforeState: SimulationState, afterState: SimulationState): string {
  const beforeFood = calculateFoodForecast(beforeState).endingStock
  const afterFood = calculateFoodForecast(afterState).endingStock
  const beforeRepair = calculateRepairForecast(beforeState).endingStock
  const afterRepair = calculateRepairForecast(afterState).endingStock
  return `粮食 ${formatRange(beforeFood)} → ${formatRange(afterFood)}；维修保障 ${formatRange(beforeRepair)} → ${formatRange(afterRepair)}。`
}

function addCharacterRecord(
  state: SimulationState,
  characterId: keyof SimulationState['characterRecords'],
  record: string,
): SimulationState['characterRecords'] {
  return {
    ...state.characterRecords,
    [characterId]: [...state.characterRecords[characterId], record],
  }
}

function repairResponsibilityRecord(
  selection: NonNullable<
    SimulationState['repairResponsibilitySelection']
  >,
  assignment: NonNullable<
    SimulationState['repairResponsibilityAssignment']
  >,
): string {
  if (selection === 'qiao-pan') {
    return `[维修责任] 乔磐承担水泵维修；额外人物负荷为 ${assignment.characterLoadCost}。`
  }
  const actorName = assignment.actorId === 'chen-du' ? '陈渡' : '苏霁'
  return `[维修责任] ${actorName}接手水泵维修；额外人物负荷为 ${assignment.characterLoadCost}。`
}

function removeRepairResponsibilityRecord(
  state: SimulationState,
  assignment: NonNullable<
    SimulationState['repairResponsibilityAssignment']
  >,
): SimulationState['characterRecords'] {
  return {
    ...state.characterRecords,
    [assignment.actorId]: state.characterRecords[assignment.actorId].filter(
      (record) => !record.startsWith('[维修责任]'),
    ),
  }
}

function appendTimeline(
  state: SimulationState,
  entry: Omit<SimulationState['timeline'][number], 'order'>,
): SimulationState['timeline'] {
  return [...state.timeline, { ...entry, order: state.timeline.length + 1 }]
}

const SETTLED_CONSEQUENCE_BY_CANDIDATE = {
  'schedule-preventive-maintenance':
    'consequence:w0:preventive-capacity:recovery-load',
  'retain-rest-capacity':
    'consequence:w0:preventive-capacity:personnel-readiness',
  'allocate-repair-buffer':
    'consequence:w1:recovery-allocation:ending-repair',
  'allocate-food-production':
    'consequence:w1:recovery-allocation:ending-food',
} as const

function settleManagementOutcome(
  state: SimulationState,
  settledWeek: 0 | 1,
  settledAtTick: number,
): SimulationState {
  const commitment = state.managementChoices.commitments.find(
    (item) => item.week === settledWeek,
  )
  if (commitment === undefined) return state
  if (
    state.managementChoices.settledOutcomes.some(
      (item) => item.choiceSetId === commitment.choiceSetId,
    )
  ) {
    return state
  }
  const consequenceId =
    SETTLED_CONSEQUENCE_BY_CANDIDATE[commitment.candidateId]
  const consequence = commitment.consequences.find(
    (item) => item.consequenceId === consequenceId,
  )
  const action = state.actionLog.find(
    (item) => item.sequence === commitment.committedAtSequence,
  )
  if (
    consequence === undefined ||
    typeof consequence.beforeValue !== 'number' ||
    typeof consequence.afterValue !== 'number' ||
    action?.action.type !== 'COMMIT_MANAGEMENT_CHOICE'
  ) {
    throw new Error(
      `Management commitment ${commitment.choiceSetId} cannot be settled`,
    )
  }
  return {
    ...state,
    managementChoices: {
      ...state.managementChoices,
      settledOutcomes: [
        ...state.managementChoices.settledOutcomes,
        {
          choiceSetId: commitment.choiceSetId,
          decisionIntentId: commitment.decisionIntentId,
          candidateId: commitment.candidateId,
          consequenceId: consequence.consequenceId,
          effectFingerprint: consequence.effectFingerprint,
          beforeValue: consequence.beforeValue,
          afterValue: consequence.afterValue,
          delta:
            consequence.afterValue - consequence.beforeValue,
          settledWeek,
          settledAtTick,
          diagnosisId: commitment.diagnosisId,
          sessionId: commitment.sessionId,
          candidateBuildAuthorityHash:
            commitment.candidateBuildAuthorityHash,
          sessionAuthorityToken:
            commitment.sessionAuthorityToken,
          actionId: action.id,
          actionSequence: action.sequence,
        },
      ],
    },
  }
}

export function applyPlayerAction(
  state: SimulationState,
  envelope: PlayerActionEnvelope,
  _scenario: ScenarioDefinition,
): TransitionResult {
  if (state.actionLog.some((item) => item.id === envelope.id)) {
    throw new Error(`Duplicate player action id: ${envelope.id}`)
  }
  if (envelope.atTick !== state.currentTick) {
    throw new Error('Player action tick must match the current simulation tick')
  }
  const actionWeekIndex = weekIndexForTick(envelope.atTick, _scenario)

  const before = rangeOf(state)
  let next: SimulationState
  let event: DomainEvent

  if (envelope.action.type === 'CHANGE_ACTIVITY') {
    if (
      isManagementScheduleBlockLocked(
        state,
        PUMP_MAINTENANCE_BLOCK_ID,
      )
    ) {
      throw new Error(
        `已兑现的管理选择锁定该活动块：${PUMP_MAINTENANCE_BLOCK_ID}`,
      )
    }
    const activity = envelope.action.activity
    const edited = applyScheduleTransaction(state, envelope.id, {
      type: 'EDIT_SCHEDULE',
      blockIds: [PUMP_MAINTENANCE_BLOCK_ID],
      activity,
      scope: 'weekly',
    })
    const draft: SimulationState = { ...edited, activity }
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: activity === 'repair' ? '安排预防性检修' : '保留休息安排',
        detail:
          activity === 'repair'
            ? `${supplyChangeDetail(state, draft)}周三前的水泵检修已达到 2 个维修块。`
            : `${supplyChangeDetail(state, draft)}水泵检修重新不足 2 个维修块。`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'activity-changed',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (
    envelope.action.type === 'EDIT_SCHEDULE' ||
    envelope.action.type === 'COPY_DAY'
  ) {
    const lockedBlockId = envelope.affectedBlockIds.find(
      (blockId) =>
        isManagementScheduleBlockLocked(state, blockId),
    )
    if (lockedBlockId) {
      throw new Error(
        `已兑现的管理选择锁定该活动块：${lockedBlockId}`,
      )
    }
    const requestTarget = envelope.affectedBlockIds.find(isLinHeRequestBlockLocked)
    if (requestTarget) {
      throw new Error('林禾请求占用的活动块必须通过人物请求决定，不能用普通日程编辑覆盖')
    }
    const pastBlockId = envelope.affectedBlockIds.find(
      (blockId) => blockEndTick(blockId) <= state.currentTick,
    )
    if (pastBlockId) {
      throw new Error(`已经执行的活动块不能追溯修改：${pastBlockId}`)
    }
    const boundaryWarning = findQiaoPanBoundaryWarning(state, envelope.action)
    if (boundaryWarning) throw new Error(boundaryWarning.message)
    let edited = applyScheduleTransaction(state, envelope.id, envelope.action)
    const previousAssignment = state.repairResponsibilityAssignment
    const assignmentInvalidated =
      previousAssignment !== null &&
      envelope.affectedBlockIds.includes(previousAssignment.blockId) &&
      resolveScheduleBlock(edited, previousAssignment.blockId).activity !==
        'repair'
    if (assignmentInvalidated && previousAssignment !== null) {
      const transaction = edited.scheduleTransactions.at(-1)!
      edited = {
        ...edited,
        scheduleTransactions: [
          ...edited.scheduleTransactions.slice(0, -1),
          {
            ...transaction,
            repairResponsibilityBefore: previousAssignment,
          },
        ],
      }
    }
    const responsibilityBase: SimulationState = assignmentInvalidated
      ? {
          ...edited,
          repairResponsibility: 'unresolved',
          repairResponsibilityAssignment: null,
          characterRecords: removeRepairResponsibilityRecord(
            edited,
            previousAssignment,
          ),
        }
      : edited
    const responsibilitySelection =
      state.repairResponsibilitySelection
    const assignment =
      responsibilityBase.repairResponsibility === 'unresolved' &&
      responsibilitySelection !== null
        ? findRepairResponsibilityAssignment(
            responsibilityBase,
            envelope.id,
            responsibilitySelection,
            envelope.affectedBlockIds,
          )
        : null
    const responsibilityDraft: SimulationState =
      assignment === null
        ? responsibilityBase
        : (() => {
            if (responsibilitySelection === null) {
              throw new Error(
                'Repair responsibility assignment requires a selected direction',
              )
            }
            return {
              ...responsibilityBase,
              repairResponsibility: 'scheduled',
              repairResponsibilityAssignment: assignment,
              characterRecords: addCharacterRecord(
                responsibilityBase,
                assignment.actorId,
                repairResponsibilityRecord(
                  responsibilitySelection,
                  assignment,
                ),
              ),
            }
          })()
    const draft: SimulationState = {
      ...responsibilityDraft,
      activity: resolveScheduleBlock(
        responsibilityDraft,
        PUMP_MAINTENANCE_BLOCK_ID,
      ).activity,
    }
    const after = rangeOf(draft)
    const count = envelope.affectedBlockIds.length
    const permanent =
      envelope.action.scope === 'base' ? '，并明确写入后续基础计划' : ''
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: envelope.action.type === 'COPY_DAY' ? '复制单日安排' : '修改日程',
        detail: `${envelope.id} 作为一个事务修改 ${count} 个活动块${permanent}。${supplyChangeDetail(state, draft)}`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: assignment
        ? 'repair-responsibility-scheduled'
        : 'schedule-edited',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (envelope.action.type === 'UNDO_SCHEDULE') {
    const transaction = state.scheduleTransactions.at(-1)
    const lockedBlockId = transaction?.affectedBlockIds.find(
      (blockId) =>
        isManagementScheduleBlockLocked(state, blockId),
    )
    if (lockedBlockId) {
      throw new Error(
        `已兑现的管理选择不能通过撤销回滚：${lockedBlockId}`,
      )
    }
    const pastBlockId = transaction?.affectedBlockIds.find(
      (blockId) => blockEndTick(blockId) <= state.currentTick,
    )
    if (pastBlockId) {
      throw new Error(`已经执行的活动块不能撤销：${pastBlockId}`)
    }
    const undone = undoLastScheduleTransaction(state)
    const responsibilityUndone =
      transaction !== undefined &&
      state.repairResponsibilityAssignment?.actionId === transaction.actionId
    const responsibilityBase: SimulationState =
      responsibilityUndone &&
      state.repairResponsibilityAssignment !== null
        ? {
            ...undone,
            repairResponsibility: 'unresolved',
            repairResponsibilityAssignment: null,
            characterRecords: removeRepairResponsibilityRecord(
              undone,
              state.repairResponsibilityAssignment,
            ),
          }
        : undone
    const responsibilityBefore = transaction?.repairResponsibilityBefore
    const responsibilitySelection =
      responsibilityBefore?.actorId === 'qiao-pan' ? 'qiao-pan' : 'handoff'
    const restoredAssignment =
      responsibilityBase.repairResponsibility === 'unresolved' &&
      responsibilityBefore !== undefined &&
      responsibilityBase.repairResponsibilitySelection ===
        responsibilitySelection &&
      resolveScheduleBlock(responsibilityBase, responsibilityBefore.blockId)
        .activity === 'repair'
        ? responsibilityBefore
        : null
    const responsibilityDraft: SimulationState =
      restoredAssignment !== null &&
      responsibilityBase.repairResponsibilitySelection !== null
        ? {
            ...responsibilityBase,
            repairResponsibility: 'scheduled',
            repairResponsibilityAssignment: restoredAssignment,
            characterRecords: addCharacterRecord(
              responsibilityBase,
              restoredAssignment.actorId,
              repairResponsibilityRecord(
                responsibilityBase.repairResponsibilitySelection,
                restoredAssignment,
              ),
            ),
          }
        : responsibilityBase
    const draft: SimulationState = {
      ...responsibilityDraft,
      activity: resolveScheduleBlock(
        responsibilityDraft,
        PUMP_MAINTENANCE_BLOCK_ID,
      ).activity,
    }
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: '撤销日程事务',
        detail: transaction
          ? `已撤销 ${transaction.actionId}，恢复 ${transaction.affectedBlockIds.length} 个活动块。`
          : '没有可撤销的日程事务。',
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'schedule-undone',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (envelope.action.type === 'USE_FERTILIZER') {
    if (state.recap !== null || state.isComplete) {
      throw new Error('周末复盘已经冻结，不能在结算后使用化肥')
    }
    if (state.fertilizer.remainingUnits === 0) {
      throw new Error('化肥已经使用，库存中没有第二份')
    }
    const appliedWeekIndex = actionWeekIndex
    const draft: SimulationState = {
      ...state,
      fertilizer: {
        ...state.fertilizer,
        appliedWeekIndex,
        remainingUnits: 0,
      },
      fertilizerUsed: true,
    }
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: '使用唯一一份化肥',
        detail: `${supplyChangeDetail(state, draft)}这份化肥之后不能再次使用。`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'fertilizer-used',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (envelope.action.type === 'SET_FOOD_SHORTFALL_ACCEPTED') {
    if (
      envelope.action.accepted &&
      calculateFoodForecast(state).status !== '轻度缺口'
    ) {
      throw new Error('只有轻度粮食缺口可以被主动接受')
    }
    next = {
      ...state,
      acceptedFoodShortfall: envelope.action.accepted,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: envelope.action.accepted ? '接受轻度粮食缺口' : '重新处理粮食缺口',
        detail: envelope.action.accepted
          ? '该缺口保留在预测中，但已标为管理者主动承担，不再作为未处理错误催促。'
          : '已移除风险接受标记，粮食缺口重新进入待处理状态。',
        before,
        after: before,
      }),
    }
    event = {
      id: envelope.id,
      type: 'food-shortfall-accepted',
      atTick: envelope.atTick,
      before,
      after: before,
    }
  } else if (envelope.action.type === 'SELECT_REPAIR_RESPONSIBILITY') {
    if (
      actionWeekIndex !== 0 ||
      state.recap !== null ||
      state.repairResponsibility !== 'unresolved'
    ) {
      throw new Error('维修责任方向只能在第一周尚未兑现时选择')
    }
    next = {
      ...state,
      repairResponsibilitySelection: envelope.action.responsible,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title:
          envelope.action.responsible === 'qiao-pan'
            ? '选择乔磐承担维修'
            : '选择陈渡或苏霁交接维修',
        detail: '这里只确定责任方向；确认具体日程前，不改变粮食或维修预测。',
        before,
        after: before,
      }),
    }
    event = {
      id: envelope.id,
      type: 'repair-responsibility-selected',
      atTick: envelope.atTick,
      before,
      after: before,
    }
  } else if (envelope.action.type === 'ACCEPT_REPAIR_DEBT') {
    if (
      actionWeekIndex !== 0 ||
      state.recap !== null ||
      state.repairResponsibility !== 'unresolved'
    ) {
      throw new Error('维修欠账只能在第一周责任尚未兑现时接受')
    }
    const draft: SimulationState = {
      ...state,
      repairResponsibilitySelection: null,
      repairResponsibility: 'debt',
      repairResponsibilityAssignment: null,
      repairDebt: {
        acceptedActionId: envelope.id,
        dueTick: _scenario.simulationEndTick,
        weeklyPenalty: 3,
        accruedPenalty: 0,
        settlementRecapIndex: 1,
        settled: false,
        settledAtTick: null,
        currentRisk: '本周维修保障将在周末减少 3',
        nextConsequence: '第一周复盘将累计 3 点维修欠账代价',
      },
      characterRecords: addCharacterRecord(
        state,
        'qiao-pan',
        '[维修责任] 管理者接受维修欠账；乔磐本周不追加任务，欠账每周累计 3 点维修保障代价。',
      ),
    }
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: '接受维修欠账',
        detail: `欠账到期 tick ${_scenario.simulationEndTick}；每周累计代价 3，并在周末复盘兑现。${supplyChangeDetail(state, draft)}`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'repair-debt-accepted',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (envelope.action.type === 'OPEN_TRANSPORT_SHORTCUT') {
    if (!canOpenTransportShortcut(state, _scenario)) {
      throw new Error('短通路只能在本周首次运输开始前开启，不能追溯改写已发生的损耗')
    }
    const beforeRoute = selectTransportRoute(state)
    const draft: SimulationState = {
      ...state,
      transportRouteId: 'south-shortcut',
      transportRouteOpenedAtTick: state.currentTick,
    }
    const afterRoute = selectTransportRoute(draft)
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: '开启南侧短通路',
        detail: `${beforeRoute.label} ${beforeRoute.distanceMeters} 米 / 损耗 ${beforeRoute.foodLoss} → ${afterRoute.label} ${afterRoute.distanceMeters} 米 / 损耗 ${afterRoute.foodLoss}；本周投入 ${selectTransportRepairCost(draft)} 点维修保障。${supplyChangeDetail(state, draft)}`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'transport-shortcut-opened',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (envelope.action.type === 'RESOLVE_LIN_HE_REQUEST') {
    if (actionWeekIndex !== 1 || state.recap !== null) {
      throw new Error('林禾的请求会在第二周开始后出现')
    }
    if (state.linHeRequestDecision !== 'pending') {
      throw new Error('林禾的请求已经处理')
    }
    if (state.currentTick >= _scenario.linHeRequestDeadlineTick) {
      throw new Error('林禾请求已经超过答复截止时间')
    }
    const accepted = envelope.action.decision === 'accepted'
    const scheduled = accepted
      ? applyScheduleTransaction(state, envelope.id, {
          type: 'EDIT_SCHEDULE',
          blockIds: [LIN_HE_STUDY_BLOCK_ID],
          activity: 'study',
          scope: 'weekly',
        })
      : state
    const draft: SimulationState = {
      ...scheduled,
      scheduleTransactions: state.scheduleTransactions,
      linHeRequestDecision: envelope.action.decision,
      linHeRequestResolutionSource: 'player',
      characterRecords: addCharacterRecord(
        state,
        'lin-he',
        accepted
          ? '第二周学习请求已接受：周二 B1 由农务改为学习，短期粮食产出减少 2。'
          : '第二周学习请求已拒绝：保留农务产能；林禾记住管理者优先保障本周粮食。',
      ),
    }
    const after = rangeOf(draft)
    const afterSupplies = supplyPlanOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: accepted ? '接受林禾的学习请求' : '拒绝林禾的学习请求',
        detail: accepted
          ? `${supplyChangeDetail(state, draft)}人物记录已写入学习承诺。`
          : `${supplyChangeDetail(state, draft)}人物记录已写入拒绝决定。`,
        before,
        after,
      }),
      planSnapshot:
        state.planSnapshot === null && !state.isPaused
          ? after
          : state.planSnapshot,
      supplyPlanSnapshot:
        state.supplyPlanSnapshot === null && !state.isPaused
          ? afterSupplies
          : state.supplyPlanSnapshot,
    }
    event = {
      id: envelope.id,
      type: 'lin-he-request-resolved',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (
    envelope.action.type === 'COMMIT_MANAGEMENT_CHOICE'
  ) {
    const result = commitManagementChoice(
      state,
      envelope.action.request,
      envelope.sequence,
      envelope.id,
    )
    if (!result.ok) {
      throw new ManagementChoiceCommitError(result.code)
    }
    const draft = result.state
    const after = rangeOf(draft)
    next = {
      ...draft,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title:
          result.commitment.choiceSetId ===
          'choice:w0:preventive-capacity'
            ? '提交预防容量分配'
            : '提交恢复资源分配',
        detail: `${result.commitment.candidateId} 已与全部 required consequences 原子提交；${supplyChangeDetail(state, draft)}`,
        before,
        after,
      }),
    }
    event = {
      id: envelope.id,
      type: 'management-choice-committed',
      atTick: envelope.atTick,
      before,
      after,
    }
  } else if (envelope.action.type === 'CONTINUE_TO_NEXT_WEEK') {
    if (state.recap === null || state.isComplete) {
      throw new Error('只有未完成的周末复盘可以进入下一周')
    }
    next = openRecoveryAllocationOpportunity({
      ...state,
      currentTick: _scenario.weekStartTicks[1],
      inventory: {
        food: state.recap.supplies.food.actual,
        repair: state.recap.supplies.repair.actual,
      },
      recap: null,
      isPaused: true,
      planSnapshot: null,
      supplyPlanSnapshot: null,
      scheduleTransactions: [],
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: '进入第二周',
        detail: '基础计划已经继承；第一周一次性例外已结算失效。第二周保持暂停，只需处理新增例外。',
      }),
    })
    event = {
      id: envelope.id,
      type: 'clock-changed',
      atTick: envelope.atTick,
    }
  } else {
    if (state.recap !== null) {
      throw new Error('请先完成周末复盘并进入下一周')
    }
    const clockDraft: SimulationState = {
      ...state,
    }
    const weekTwoRequestReady =
      actionWeekIndex === 0 ||
      state.linHeRequestDecision !== 'pending'
    const planSnapshot =
      !envelope.action.paused &&
      state.planSnapshot === null &&
      weekTwoRequestReady
        ? rangeOf(clockDraft)
        : state.planSnapshot
    const supplyPlanSnapshot =
      !envelope.action.paused &&
      state.supplyPlanSnapshot === null &&
      weekTwoRequestReady
        ? supplyPlanOf(clockDraft)
        : state.supplyPlanSnapshot
    next = {
      ...clockDraft,
      isPaused: envelope.action.paused,
      planSnapshot,
      supplyPlanSnapshot,
      actionLog: [...state.actionLog, envelope],
      timeline: appendTimeline(state, {
        atTick: envelope.atTick,
        kind: 'player-action',
        id: envelope.id,
        title: envelope.action.paused ? '暂停时间' : '继续时间',
        detail: envelope.action.paused
          ? '聚落时钟已暂停。'
          : actionWeekIndex === 1
            ? state.linHeRequestDecision === 'pending'
              ? '第二周开始推进；林禾请求尚未答复，截止时将默认保留农务。'
              : '第二周从继承的基础计划和已处理的新例外开始推进。'
            : '聚落时钟开始连续推进。',
      }),
    }
    event = {
      id: envelope.id,
      type: 'clock-changed',
      atTick: envelope.atTick,
    }
  }

  const synchronized =
    synchronizeManagementScheduleState(next)
  return {
    state: changesManagementProjection(envelope.action)
      ? {
          ...synchronized,
          stateRevision: state.stateRevision + 1,
        }
      : synchronized,
    events: [event],
  }
}

function createRecap(state: SimulationState, weekIndex: number): WeekendRecap {
  const planned = state.planSnapshot ?? rangeOf(state)
  const plannedSupplies = state.supplyPlanSnapshot ?? supplyPlanOf(state)
  const foodForecast = calculateFoodForecast(state)
  const repairForecast = calculateRepairForecast(state)
  const actual =
    state.pumpStatus === 'protected'
      ? foodForecast.endingStock.low
      : foodForecast.endingStock.high
  const repairActual = repairForecast.endingStock.low
  const fertilizerBonus: 0 | 6 =
    state.fertilizer.appliedWeekIndex === weekIndex ? 6 : 0
  const route = selectTransportRoute(state)
  const items: WeekendRecapItem[] = [
    {
      id: `week-${weekIndex + 1}-food-result`,
      category: '计划内结果',
      sourceId: 'food-forecast',
      title: '粮食计划兑现',
      detail: `第 ${weekIndex + 1} 周计划期末库存 ${formatRange(planned)}，周末实际库存 ${actual}。`,
      values: {
        plannedLow: planned.low,
        plannedHigh: planned.high,
        actual,
      },
    },
  ]

  if (weekIndex === 0) {
    const protectedPump = state.pumpStatus === 'protected'
    items.push(
      {
        id: 'week-1-pump-risk',
        category: '已知风险',
        sourceId: 'pump-preventive-maintenance',
        title: protectedPump ? '林禾补足预防性检修' : '水泵风险未处理',
        detail: protectedPump
          ? '周三前完成 2 个维修块，已知停机风险被压低。'
          : '周三前只有乔磐的 1 个维修块，水泵停机风险按已知上限兑现。',
        values: {
          maintenanceBlocks: protectedPump ? 2 : 1,
          knownWorstFoodLoss: 8,
        },
      },
      {
        id: 'week-1-pump-incident',
        category: '新事件',
        sourceId: 'pump-incident-day-3',
        title: protectedPump ? '周三水泵异常被缓释' : '周三水泵故障并停机',
        detail: protectedPump
          ? '事件发生后新增信息确认：预防性检修奏效，实际只损失 1 单位粮食。'
          : '事件发生后新增信息确认：水泵停机，实际损失 8 单位粮食。',
        values: {
          actualFoodLoss: protectedPump ? 1 : 8,
        },
      },
    )
  } else {
    const accepted = state.linHeRequestDecision === 'accepted'
    const expired = state.linHeRequestResolutionSource === 'deadline'
    items.push({
      id: 'week-2-lin-he-request',
      category: expired ? '新事件' : '计划内结果',
      sourceId: expired
        ? 'lin-he-request-deadline'
        : accepted
          ? 'lin-he-request-accepted'
          : 'lin-he-request-declined',
      title: expired
        ? '林禾请求逾期未答'
        : accepted
          ? '林禾开始学习'
          : '林禾保留农务',
      detail: expired
        ? '管理者未在周二 B1 前答复，系统按已公开默认保留农务；林禾记住了这次沉默。'
        : accepted
          ? '林禾用周二 B1 学习，短期粮食产出减少 2。'
          : '管理者明确拒绝请求，周二 B1 继续农务，林禾记住了本次取舍。',
      values: {
        shortTermFoodDelta: accepted ? -2 : 0,
      },
    })
  }

  const managementOpportunity =
    weekIndex === 0
      ? state.managementChoices.opportunities
          .preventiveCapacity
      : state.managementChoices.opportunities
          .recoveryAllocation
  if (managementOpportunity !== null) {
    const settledOutcome =
      state.managementChoices.settledOutcomes.find(
        (outcome) =>
          outcome.choiceSetId ===
          managementOpportunity.choiceSetId,
      )
    const terminal = managementOpportunity.terminalState
    const committed =
      terminal !== 'open' &&
      terminal !== 'omitted' &&
      terminal !== 'unqualified-direct-edit'
    items.push({
      id: `week-${weekIndex + 1}-management-choice`,
      category: committed
        ? '计划内结果'
        : '已知风险',
      sourceId: managementOpportunity.choiceSetId,
      title:
        weekIndex === 0
          ? committed
            ? terminal ===
              'schedule-preventive-maintenance'
              ? '预防容量分配给第二次检修'
              : '预防容量用于保护性恢复'
            : '预防容量机会未形成合格承诺'
          : committed
            ? terminal === 'allocate-repair-buffer'
              ? '应急班次分配给维修备件'
              : '应急班次分配给粮食生产'
            : '恢复资源机会未形成合格承诺',
      detail:
        weekIndex === 0
          ? terminal === 'schedule-preventive-maintenance'
            ? '林禾把专项恢复时段改为第二次检修，设备暴露降低，第二周恢复负荷随之减轻。'
            : terminal === 'retain-rest-capacity'
              ? '林禾完成专项保护性恢复，人员准备度提高；水泵仍以较高暴露进入第二周。'
              : terminal === 'unqualified-direct-edit'
                ? '目标日程格曾被直接修改，真实经营结果继续生效，但本次没有形成可核验的管理意图承诺。'
                : '管理者没有指定专项方案；林禾按普通休息执行，未获得专项恢复或人员准备度提升。'
          : terminal === 'allocate-repair-buffer'
            ? '唯一应急班次用于维修备件，期末维修保障增加 1，粮食预测不变。'
            : terminal === 'allocate-food-production'
              ? '唯一应急班次用于粮食生产，期末粮食增加 1，维修保障预测不变。'
              : terminal === 'unqualified-direct-edit'
                ? '目标日程格曾被直接修改，真实经营结果继续生效，但本次没有形成可核验的恢复资源承诺。'
                : '管理者没有指定应急班次用途，本周未获得额外粮食或维修保障。',
      values: {
        equipmentRecoveryLoad:
          state.managementChoices.equipmentRecoveryLoad,
        personnelReadiness:
          state.managementChoices.personnelReadiness,
        endingFoodDelta:
          terminal === 'allocate-food-production' ? 1 : 0,
        endingRepairDelta:
          terminal === 'allocate-repair-buffer' ? 1 : 0,
        ...(settledOutcome === undefined
          ? {}
          : {
              settledBeforeValue:
                settledOutcome.beforeValue,
              settledAfterValue:
                settledOutcome.afterValue,
              settledDelta: settledOutcome.delta,
            }),
      },
    })
  }

  if (
    state.repairResponsibilityAssignment !== null &&
    state.repairResponsibilityAssignment.weekIndex === weekIndex
  ) {
    const assignment = state.repairResponsibilityAssignment
    const actorName =
      assignment.actorId === 'qiao-pan'
        ? '乔磐'
        : assignment.actorId === 'chen-du'
          ? '陈渡'
          : '苏霁'
    items.push({
      id: `week-${weekIndex + 1}-repair-responsibility`,
      category: '计划内结果',
      sourceId: 'repair-responsibility',
      title: `${actorName}兑现水泵维修责任`,
      detail: `${assignment.blockId} 已按玩家确认写入日程；维修产出 +${assignment.repairOutputDelta}，人物负荷代价 ${assignment.characterLoadCost}。`,
      values: {
        repairOutputDelta: assignment.repairOutputDelta,
        characterLoadCost: assignment.characterLoadCost,
      },
    })
  }

  if (state.repairDebt !== null) {
    const accruedPenalty =
      state.repairDebt.accruedPenalty + state.repairDebt.weeklyPenalty
    const settled = weekIndex >= state.repairDebt.settlementRecapIndex
    items.push({
      id: `week-${weekIndex + 1}-repair-debt`,
      category: settled ? '计划内结果' : '已知风险',
      sourceId: 'repair-debt',
      title: settled ? '维修欠账到期结清' : '维修欠账继续累计',
      detail: settled
        ? `本周再扣除 ${state.repairDebt.weeklyPenalty} 点维修保障，累计代价 ${accruedPenalty}；欠账在 tick ${state.repairDebt.dueTick} 结清。`
        : `本周扣除 ${state.repairDebt.weeklyPenalty} 点维修保障，累计代价 ${accruedPenalty}；下一周复盘再扣除同额代价后结清。`,
      values: {
        weeklyPenalty: state.repairDebt.weeklyPenalty,
        accruedPenalty,
        dueTick: state.repairDebt.dueTick,
      },
    })
  }

  items.push({
    id: `week-${weekIndex + 1}-transport-result`,
    category: route.id === 'south-shortcut' ? '计划内结果' : '已知风险',
    sourceId: route.id,
    title:
      route.id === 'south-shortcut'
        ? '苏霁兑现南侧短通路'
        : '苏霁继续北侧绕行',
    detail:
      route.id === 'south-shortcut'
        ? `农田到粮仓缩短为 ${route.distanceMeters} 米 / ${route.travelMinutes} 分钟，运输损耗从 6 降至 ${route.foodLoss}。`
        : `农田到粮仓仍需 ${route.distanceMeters} 米 / ${route.travelMinutes} 分钟，${route.foodLoss} 单位粮食在搬运中未兑现。`,
    values: {
      distanceMeters: route.distanceMeters,
      travelMinutes: route.travelMinutes,
      foodLoss: route.foodLoss,
    },
  })

  return {
    planned,
    actual,
    supplies: {
      food: {
        planned: plannedSupplies.food,
        actual,
        endingStock: actual,
        reasons: foodForecast.reasons,
      },
      repair: {
        planned: plannedSupplies.repair,
        actual: repairActual,
        endingStock: repairActual,
        reasons: repairForecast.reasons,
      },
    },
    fertilizer: {
      appliedWeekIndex: state.fertilizer.appliedWeekIndex,
      remainingUnits: state.fertilizer.remainingUnits,
      bonus: fertilizerBonus,
    },
    headline:
      actual >= planned.low && actual <= planned.high
        ? '实际结果落在计划区间内'
        : '事件使实际结果偏离计划区间',
    items,
  }
}

function repairDebtAfterRecap(
  state: SimulationState,
  endingWeekIndex: number,
  currentTick: number,
): SimulationState['repairDebt'] {
  if (state.repairDebt === null || state.repairDebt.settled) {
    return state.repairDebt
  }
  const accruedPenalty =
    state.repairDebt.accruedPenalty + state.repairDebt.weeklyPenalty
  const settled = endingWeekIndex >= state.repairDebt.settlementRecapIndex
  return {
    ...state.repairDebt,
    accruedPenalty,
    settled,
    settledAtTick: settled ? currentTick : null,
    currentRisk: settled
      ? '维修欠账已在终局复盘结清'
      : `已累计 ${accruedPenalty} 点维修欠账代价`,
    nextConsequence: settled
      ? '无后续欠账后果'
      : '第二周复盘将再累计 3 点并结清欠账',
  }
}

export function advanceSimulation(
  state: SimulationState,
  targetTick: number,
  scenario: ScenarioDefinition,
): TransitionResult {
  weekIndexForTick(state.currentTick, scenario)
  if (targetTick < state.currentTick) {
    throw new Error('Simulation cannot advance backwards')
  }
  if (state.recap !== null && targetTick > state.currentTick) {
    weekIndexForTick(targetTick, scenario)
    throw new Error('请先完成周末复盘并进入下一周')
  }

  const managementDeadline = [
    {
      tick: PREVENTIVE_CAPACITY_DEADLINE_TICK,
      opportunity:
        state.managementChoices.opportunities.preventiveCapacity,
      freeze: freezePreventiveCapacityOpportunity,
    },
    {
      tick: RECOVERY_ALLOCATION_DEADLINE_TICK,
      opportunity:
        state.managementChoices.opportunities.recoveryAllocation,
      freeze: freezeRecoveryAllocationOpportunity,
    },
  ]
    .filter(
      ({ tick, opportunity }) =>
        opportunity?.terminalState === 'open' &&
        state.currentTick <= tick &&
        targetTick >= tick,
    )
    .sort((left, right) => left.tick - right.tick)[0]

  const nextEvent = [...scenario.scriptedEvents]
    .sort((left, right) => left.atTick - right.atTick)
    .find(
      (event) =>
        event.atTick >= state.currentTick &&
        event.atTick <= targetTick &&
        !state.processedScriptEventIds.includes(event.id),
    )
  const endingWeekIndex = scenario.weekEndTicks.findIndex(
    (tick, index) =>
      tick >= state.currentTick &&
      tick <= targetTick &&
      !state.completedWeekIndexes.includes(index),
  )
  const nextCandidate = [
    ...(managementDeadline === undefined
      ? []
      : [
          {
            kind: 'management-deadline' as const,
            tick: managementDeadline.tick,
            priority: 0,
          },
        ]),
    ...(nextEvent === undefined
      ? []
      : [
          {
            kind: 'scripted-event' as const,
            tick: nextEvent.atTick,
            priority: 1,
          },
        ]),
    ...(endingWeekIndex < 0
      ? []
      : [
          {
            kind: 'week-end' as const,
            tick: scenario.weekEndTicks[endingWeekIndex],
            priority: 2,
          },
        ]),
  ].sort(
    (left, right) =>
      left.tick - right.tick ||
      left.priority - right.priority,
  )[0]

  if (
    nextCandidate?.kind === 'management-deadline' &&
    managementDeadline !== undefined
  ) {
    const deadlineState = managementDeadline.freeze({
      ...expireScheduleLayers(state, managementDeadline.tick),
      currentTick: managementDeadline.tick,
    })
    return targetTick > managementDeadline.tick
      ? advanceSimulation(deadlineState, targetTick, scenario)
      : { state: deadlineState, events: [] }
  }

  if (
    nextCandidate?.kind === 'scripted-event' &&
    nextEvent !== undefined
  ) {
    const before = rangeOf(state)
    const expired = expireScheduleLayers(state, nextEvent.atTick)
    if (nextEvent.type === 'LIN_HE_REQUEST_DEADLINE') {
      if (state.linHeRequestDecision !== 'pending') {
        const consumedState: SimulationState = {
          ...expired,
          currentTick: nextEvent.atTick,
          processedScriptEventIds: [...state.processedScriptEventIds, nextEvent.id],
        }
        return targetTick > nextEvent.atTick
          ? advanceSimulation(consumedState, targetTick, scenario)
          : { state: consumedState, events: [] }
      }
      const deadlineState: SimulationState = {
        ...expired,
        currentTick: nextEvent.atTick,
        isPaused: true,
        linHeRequestDecision: 'declined',
        linHeRequestResolutionSource: 'deadline',
        processedScriptEventIds: [...state.processedScriptEventIds, nextEvent.id],
        characterRecords: addCharacterRecord(
          state,
          'lin-he',
          '第二周学习请求逾期未答：按公开默认保留农务；林禾记住管理者没有回应。',
        ),
      }
      const after = rangeOf(deadlineState)
      const next: SimulationState = {
        ...deadlineState,
        planSnapshot: state.planSnapshot ?? after,
        supplyPlanSnapshot:
          state.supplyPlanSnapshot ?? supplyPlanOf(deadlineState),
        timeline: appendTimeline(state, {
          atTick: nextEvent.atTick,
          kind: 'scripted-event',
          id: nextEvent.id,
          title: '林禾请求逾期，默认保留农务',
          detail: `事件触发时，时钟自动暂停。周二 B1 锁定为农务，粮食预测 ${formatRange(after)}；林禾记住了这次沉默。`,
          before,
          after,
        }),
      }
      return {
        state: next,
        events: [
          {
            id: nextEvent.id,
            type: 'lin-he-request-expired',
            atTick: nextEvent.atTick,
            before,
            after,
          },
        ],
      }
    }

    const frozenState =
      freezePreventiveCapacityOpportunity(state)
    const pumpStatus = hasPreventiveMaintenance(frozenState)
      ? 'protected'
      : 'failed'
    const eventState: SimulationState = {
      ...expired,
      managementChoices: frozenState.managementChoices,
      currentTick: nextEvent.atTick,
      isPaused: true,
      pumpStatus,
      acceptedFoodShortfall:
        pumpStatus === 'failed' ? false : state.acceptedFoodShortfall,
      processedScriptEventIds: [...state.processedScriptEventIds, nextEvent.id],
    }
    const after = rangeOf(eventState)
    const next: SimulationState = {
      ...eventState,
      timeline: appendTimeline(state, {
        atTick: nextEvent.atTick,
        kind: 'scripted-event',
        id: nextEvent.id,
        title: pumpStatus === 'protected' ? '水泵异常，检修奏效' : '水泵故障并停机',
        detail:
          pumpStatus === 'protected'
            ? `事件触发时，时钟自动暂停。粮食期末预测由 ${formatRange(before)} 调整为 ${formatRange(after)}。`
            : `事件触发时，时钟自动暂停。粮食期末预测由 ${formatRange(before)} 下调为 ${formatRange(after)}。`,
        before,
        after,
      }),
    }
    return {
      state: next,
      events: [
        {
          id: nextEvent.id,
          type: 'pump-incident',
          atTick: nextEvent.atTick,
          before,
          after,
        },
      ],
    }
  }

  if (
    nextCandidate?.kind === 'week-end' &&
    endingWeekIndex >= 0
  ) {
    const currentTick = scenario.weekEndTicks[endingWeekIndex]
    const frozenState =
      endingWeekIndex === 1
        ? freezeRecoveryAllocationOpportunity(state)
        : freezePreventiveCapacityOpportunity(state)
    const terminalState = settleManagementOutcome(
      frozenState,
      endingWeekIndex as 0 | 1,
      currentTick,
    )
    const recap = createRecap(
      { ...terminalState, currentTick },
      endingWeekIndex,
    )
    const expired = expireScheduleLayers(state, currentTick, endingWeekIndex)
    const base: SimulationState = {
      ...expired,
      managementChoices: terminalState.managementChoices,
      currentTick,
      isPaused: true,
      acceptedFoodShortfall: false,
      scheduleTransactions: [],
      completedWeekIndexes: [...state.completedWeekIndexes, endingWeekIndex],
      isComplete: endingWeekIndex === scenario.weekEndTicks.length - 1,
      repairDebt: repairDebtAfterRecap(state, endingWeekIndex, currentTick),
    }
    return {
      state: {
        ...base,
        recap,
        recaps: [...state.recaps, recap],
        planSnapshot: null,
        supplyPlanSnapshot: null,
        timeline: appendTimeline(state, {
          atTick: currentTick,
          kind: 'scripted-event',
          id: `week-${endingWeekIndex + 1}-ended`,
          title: `第 ${endingWeekIndex + 1} 周复盘`,
          detail: `${recap.headline}：计划 ${formatRange(recap.planned)}，实际 ${recap.actual}。`,
        }),
      },
      events: [
        {
          id: `week-${endingWeekIndex + 1}-ended`,
          type: 'week-ended',
          atTick: currentTick,
        },
      ],
    }
  }

  weekIndexForTick(targetTick, scenario)
  const base: SimulationState = {
    ...expireScheduleLayers(state, targetTick),
    currentTick: targetTick,
  }
  return { state: base, events: [] }
}

export function simulateGate1Branch(
  plan: Gate1BranchPlan,
  scenario: ScenarioDefinition,
): Gate1BranchOutcome {
  let state = scenario.createInitialState()
  let sequence = 1
  const act = (action: PlayerAction) => {
    state = applyPlayerAction(
      state,
      createPlayerAction(sequence, state.currentTick, action),
      scenario,
    ).state
    sequence += 1
  }

  if (plan.food === 'food-shift-qiao') {
    act({
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d1:b1'],
      activity: 'food',
      scope: 'weekly',
    })
  } else {
    act({ type: 'SET_FOOD_SHORTFALL_ACCEPTED', accepted: true })
  }

  if (plan.repair === 'accept-debt') {
    act({ type: 'ACCEPT_REPAIR_DEBT' })
  } else {
    const actorId =
      plan.repair === 'schedule-qiao'
        ? 'qiao-pan'
        : plan.repair === 'schedule-chen'
          ? 'chen-du'
          : 'su-ji'
    const blockId =
      actorId === 'qiao-pan'
        ? 'qiao-pan:d3:b2'
        : actorId === 'chen-du'
          ? 'chen-du:d3:b0'
          : 'su-ji:d3:b0'
    act({
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: actorId === 'qiao-pan' ? 'qiao-pan' : 'handoff',
    })
    act({
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'repair',
      scope: 'weekly',
    })
  }

  if (plan.transport === 'south-week-one') {
    act({ type: 'OPEN_TRANSPORT_SHORTCUT' })
  }
  if (plan.fertilizer === 'use-week-one') {
    act({ type: 'USE_FERTILIZER' })
  }
  if (plan.pumpPlan === 'protect') {
    act({ type: 'CHANGE_ACTIVITY', activity: 'repair' })
  }

  act({ type: 'SET_PAUSED', paused: false })
  state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
  act({ type: 'SET_PAUSED', paused: false })
  state = advanceSimulation(state, scenario.weekEndTick, scenario).state
  const weekOneRepairDebtCost =
    state.repairDebt?.accruedPenalty ?? 0
  const weekOneCharacterLoadCost =
    state.repairResponsibilityAssignment?.characterLoadCost ?? 0
  if (state.pumpStatus === 'at-risk') {
    throw new Error(
      'Gate 1 week-one outcome must resolve the pump incident',
    )
  }
  const weekOnePumpStatus = state.pumpStatus
  const weekOneRepairResolution =
    state.repairResponsibility === 'debt'
      ? 'debt'
      : state.repairResponsibilityAssignment?.actorId
  if (weekOneRepairResolution === undefined) {
    throw new Error(
      'Gate 1 week-one outcome must resolve repair responsibility',
    )
  }
  if (weekOneRepairResolution === 'lin-he') {
    throw new Error(
      'Lin He is not a frozen repair-responsibility option',
    )
  }
  const weekOneTransportRoute = state.transportRouteId
  const weekOneFertilizerRemaining = state.fertilizer.remainingUnits
  act({ type: 'CONTINUE_TO_NEXT_WEEK' })

  act({
    type: 'RESOLVE_LIN_HE_REQUEST',
    decision:
      plan.linHe === 'accept-study' ? 'accepted' : 'declined',
  })
  if (
    plan.transport === 'south-week-two' &&
    state.transportRouteId === 'north-loop'
  ) {
    act({ type: 'OPEN_TRANSPORT_SHORTCUT' })
  }
  if (
    plan.fertilizer === 'use-week-two' &&
    state.fertilizer.remainingUnits > 0
  ) {
    act({ type: 'USE_FERTILIZER' })
  }
  act({ type: 'SET_PAUSED', paused: false })
  state = advanceSimulation(
    state,
    scenario.simulationEndTick,
    scenario,
  ).state

  const [weekOne, weekTwo] = state.recaps
  if (weekOne === undefined || weekTwo === undefined) {
    throw new Error('Gate 1 branch simulation must complete both recaps')
  }
  const transportFoodLoss = state.recaps.reduce((total, recap) => {
    const transport = recap.items.find((item) =>
      item.id.endsWith('-transport-result'),
    )
    return total + (transport?.values.foodLoss ?? 0)
  }, 0)

  return {
    isComplete: state.isComplete,
    weekOneFood: weekOne.supplies.food.actual,
    weekOneRepair: weekOne.supplies.repair.actual,
    weekOneRepairDebtCost,
    weekOneCharacterLoadCost,
    weekOnePumpStatus,
    weekOneRepairResolution,
    weekOneTransportRoute,
    weekOneFertilizerRemaining,
    weekTwoFood: weekTwo.supplies.food.actual,
    weekTwoRepair: weekTwo.supplies.repair.actual,
    repairDebtCost: state.repairDebt?.accruedPenalty ?? 0,
    characterLoadCost:
      state.repairResponsibilityAssignment?.characterLoadCost ?? 0,
    transportFoodLoss,
    fertilizerRemaining: state.fertilizer.remainingUnits,
    linHeCommitment:
      state.linHeRequestDecision === 'accepted' ? 1 : 0,
  }
}

const PUMP_PLANS = ['protect', 'expose'] as const
const FOOD_OPTIONS = [
  'food-shift-qiao',
  'accept-food-gap',
] as const
const REPAIR_OPTIONS = [
  'schedule-qiao',
  'schedule-chen',
  'schedule-su',
  'accept-debt',
] as const
const TRANSPORT_TIMINGS = [
  'south-week-one',
  'south-week-two',
  'north-loop',
] as const
const FERTILIZER_TIMINGS = [
  'use-week-one',
  'use-week-two',
  'keep',
] as const
const LIN_HE_OPTIONS = [
  'accept-study',
  'decline-study',
] as const

function gate1BranchPlanKey(plan: Gate1BranchPlan): string {
  return [
    plan.pumpPlan,
    plan.food,
    plan.repair,
    plan.transport,
    plan.fertilizer,
    plan.linHe,
  ].join('|')
}

function allGate1BranchPlans(): readonly Gate1BranchPlan[] {
  const plans: Gate1BranchPlan[] = []
  for (const pumpPlan of PUMP_PLANS) {
    for (const food of FOOD_OPTIONS) {
      for (const repair of REPAIR_OPTIONS) {
        for (const transport of TRANSPORT_TIMINGS) {
          for (const fertilizer of FERTILIZER_TIMINGS) {
            for (const linHe of LIN_HE_OPTIONS) {
              plans.push({
                pumpPlan,
                food,
                repair,
                transport,
                fertilizer,
                linHe,
              })
            }
          }
        }
      }
    }
  }
  return plans
}

type PolicyPlans = Map<string, Gate1BranchPlan>

function createBranchMatrixContext(
  choiceSetId: Gate1ChoiceSetId,
  choiceContextId: string,
  optionPlans: ReadonlyMap<string, PolicyPlans>,
  outcomeForPlan: (plan: Gate1BranchPlan) => Gate1BranchOutcome,
): Gate1BranchMatrixContext {
  const continuationPolicyIds = [
    ...new Set(
      [...optionPlans.values()].flatMap((plans) => [...plans.keys()]),
    ),
  ].sort()
  const rawOptions = [...optionPlans.entries()].map(
    ([optionId, plans]) => ({
      optionId,
      resultsByPolicy: Object.fromEntries(
        [...plans.entries()].map(([policyId, plan]) => [
          policyId,
          gate1BranchOutcomeVector(outcomeForPlan(plan)),
        ]),
      ),
    }),
  )
  const statuses = evaluateDominance({
    continuationPolicyIds,
    axes: GATE1_BRANCH_MATRIX_AXES,
    options: rawOptions,
  })
  return {
    choiceContextId,
    choiceSetId,
    continuationPolicyIds,
    options: rawOptions.map((option) => ({
      ...option,
      dominanceStatus: statuses[option.optionId],
    })),
  }
}

function emptyOptionPlans(optionIds: readonly string[]) {
  return new Map(
    optionIds.map((optionId) => [optionId, new Map()]),
  )
}

function setPolicyPlan(
  optionPlans: Map<string, PolicyPlans>,
  optionId: string,
  policyId: string,
  plan: Gate1BranchPlan,
) {
  optionPlans.get(optionId)?.set(policyId, plan)
}

const branchMatrixCache = new WeakMap<
  ScenarioDefinition,
  Gate1BranchMatrixOracle
>()

export function buildGate1BranchMatrixOracle(
  scenario: ScenarioDefinition,
): Gate1BranchMatrixOracle {
  const cached = branchMatrixCache.get(scenario)
  if (cached) return cached

  const allPlans = allGate1BranchPlans()
  const outcomeByPlan = new Map(
    allPlans.map((plan) => [
      gate1BranchPlanKey(plan),
      simulateGate1Branch(plan, scenario),
    ]),
  )
  const outcomeForPlan = (plan: Gate1BranchPlan) => {
    const outcome = outcomeByPlan.get(gate1BranchPlanKey(plan))
    if (!outcome) {
      throw new Error(
        `Gate 1 branch plan is outside the frozen state space: ${gate1BranchPlanKey(plan)}`,
      )
    }
    return outcome
  }
  const contexts: Gate1BranchMatrixContext[] = []

  const foodPlans = emptyOptionPlans(FOOD_OPTIONS)
  for (const pumpPlan of PUMP_PLANS) {
    for (const repair of REPAIR_OPTIONS) {
      for (const transport of TRANSPORT_TIMINGS) {
        for (const fertilizer of FERTILIZER_TIMINGS) {
          for (const linHe of LIN_HE_OPTIONS) {
            const policyId = [
              `pump=${pumpPlan}`,
              `repair=${repair}`,
              `transport=${transport}`,
              `fertilizer=${fertilizer}`,
              `linHe=${linHe}`,
            ].join('|')
            for (const food of FOOD_OPTIONS) {
              setPolicyPlan(foodPlans, food, policyId, {
                pumpPlan,
                food,
                repair,
                transport,
                fertilizer,
                linHe,
              })
            }
          }
        }
      }
    }
  }
  contexts.push(
    createBranchMatrixContext(
      'choice:w0:food-plan',
      'context:w0:initial:food-plan',
      foodPlans,
      outcomeForPlan,
    ),
  )

  const repairPlans = emptyOptionPlans(REPAIR_OPTIONS)
  for (const pumpPlan of PUMP_PLANS) {
    for (const food of FOOD_OPTIONS) {
      for (const transport of TRANSPORT_TIMINGS) {
        for (const fertilizer of FERTILIZER_TIMINGS) {
          for (const linHe of LIN_HE_OPTIONS) {
            const policyId = [
              `pump=${pumpPlan}`,
              `food=${food}`,
              `transport=${transport}`,
              `fertilizer=${fertilizer}`,
              `linHe=${linHe}`,
            ].join('|')
            for (const repair of REPAIR_OPTIONS) {
              setPolicyPlan(repairPlans, repair, policyId, {
                pumpPlan,
                food,
                repair,
                transport,
                fertilizer,
                linHe,
              })
            }
          }
        }
      }
    }
  }
  contexts.push(
    createBranchMatrixContext(
      'choice:w0:pump-repair',
      'context:w0:initial:pump-repair',
      repairPlans,
      outcomeForPlan,
    ),
  )

  const weekOneTransportPlans = emptyOptionPlans([
    'north-loop',
    'south-shortcut',
  ])
  for (const pumpPlan of PUMP_PLANS) {
    for (const food of FOOD_OPTIONS) {
      for (const repair of REPAIR_OPTIONS) {
        for (const fertilizer of FERTILIZER_TIMINGS) {
          for (const linHe of LIN_HE_OPTIONS) {
            for (const futureTransport of ['open', 'keep'] as const) {
              const policyId = [
                `pump=${pumpPlan}`,
                `food=${food}`,
                `repair=${repair}`,
                `futureTransport=${futureTransport}`,
                `fertilizer=${fertilizer}`,
                `linHe=${linHe}`,
              ].join('|')
              setPolicyPlan(
                weekOneTransportPlans,
                'south-shortcut',
                policyId,
                {
                  pumpPlan,
                  food,
                  repair,
                  transport: 'south-week-one',
                  fertilizer,
                  linHe,
                },
              )
              setPolicyPlan(
                weekOneTransportPlans,
                'north-loop',
                policyId,
                {
                  pumpPlan,
                  food,
                  repair,
                  transport:
                    futureTransport === 'open'
                      ? 'south-week-two'
                      : 'north-loop',
                  fertilizer,
                  linHe,
                },
              )
            }
          }
        }
      }
    }
  }
  contexts.push(
    createBranchMatrixContext(
      'choice:w0:transport-route',
      'context:w0:initial:transport-route',
      weekOneTransportPlans,
      outcomeForPlan,
    ),
  )

  const weekOneFertilizerPlans = emptyOptionPlans([
    'use-fertilizer',
    'keep-fertilizer',
  ])
  for (const pumpPlan of PUMP_PLANS) {
    for (const food of FOOD_OPTIONS) {
      for (const repair of REPAIR_OPTIONS) {
        for (const transport of TRANSPORT_TIMINGS) {
          for (const linHe of LIN_HE_OPTIONS) {
            for (const futureFertilizer of ['use', 'keep'] as const) {
              const policyId = [
                `pump=${pumpPlan}`,
                `food=${food}`,
                `repair=${repair}`,
                `transport=${transport}`,
                `futureFertilizer=${futureFertilizer}`,
                `linHe=${linHe}`,
              ].join('|')
              setPolicyPlan(
                weekOneFertilizerPlans,
                'use-fertilizer',
                policyId,
                {
                  pumpPlan,
                  food,
                  repair,
                  transport,
                  fertilizer: 'use-week-one',
                  linHe,
                },
              )
              setPolicyPlan(
                weekOneFertilizerPlans,
                'keep-fertilizer',
                policyId,
                {
                  pumpPlan,
                  food,
                  repair,
                  transport,
                  fertilizer:
                    futureFertilizer === 'use'
                      ? 'use-week-two'
                      : 'keep',
                  linHe,
                },
              )
            }
          }
        }
      }
    }
  }
  contexts.push(
    createBranchMatrixContext(
      'choice:w0:fertilizer',
      'context:w0:initial:fertilizer',
      weekOneFertilizerPlans,
      outcomeForPlan,
    ),
  )

  for (const pumpPlan of PUMP_PLANS) {
    for (const food of FOOD_OPTIONS) {
      for (const repair of REPAIR_OPTIONS) {
        for (const weekOneTransport of [
          'south-week-one',
          'north-loop',
        ] as const) {
          for (const weekOneFertilizer of [
            'use-week-one',
            'keep',
          ] as const) {
            const linPlans = emptyOptionPlans(LIN_HE_OPTIONS)
            const futureTransports =
              weekOneTransport === 'south-week-one'
                ? (['inherited'] as const)
                : (['open', 'keep'] as const)
            const futureFertilizers =
              weekOneFertilizer === 'use-week-one'
                ? (['consumed'] as const)
                : (['use', 'keep'] as const)
            for (const futureTransport of futureTransports) {
              for (const futureFertilizer of futureFertilizers) {
                const policyId = [
                  `futureTransport=${futureTransport}`,
                  `futureFertilizer=${futureFertilizer}`,
                ].join('|')
                for (const linHe of LIN_HE_OPTIONS) {
                  setPolicyPlan(linPlans, linHe, policyId, {
                    pumpPlan,
                    food,
                    repair,
                    transport:
                      futureTransport === 'open'
                        ? 'south-week-two'
                        : weekOneTransport,
                    fertilizer:
                      futureFertilizer === 'use'
                        ? 'use-week-two'
                        : weekOneFertilizer,
                    linHe,
                  })
                }
              }
            }
            contexts.push(
              createBranchMatrixContext(
                'choice:w1:lin-he-study',
                [
                  'context:w1:lin-he-study',
                  `pump=${pumpPlan}`,
                  `food=${food}`,
                  `repair=${repair}`,
                  `route=${weekOneTransport}`,
                  `fertilizer=${weekOneFertilizer}`,
                ].join('|'),
                linPlans,
                outcomeForPlan,
              ),
            )
          }
        }
      }
    }
  }

  for (const pumpPlan of PUMP_PLANS) {
    for (const food of FOOD_OPTIONS) {
      for (const repair of REPAIR_OPTIONS) {
        for (const weekOneFertilizer of [
          'use-week-one',
          'keep',
        ] as const) {
          const transportPlans = emptyOptionPlans([
            'north-loop',
            'south-shortcut',
          ])
          const futureFertilizers =
            weekOneFertilizer === 'use-week-one'
              ? (['consumed'] as const)
              : (['use', 'keep'] as const)
          for (const futureFertilizer of futureFertilizers) {
            for (const linHe of LIN_HE_OPTIONS) {
              const policyId = [
                `futureFertilizer=${futureFertilizer}`,
                `linHe=${linHe}`,
              ].join('|')
              const fertilizer =
                futureFertilizer === 'use'
                  ? 'use-week-two'
                  : weekOneFertilizer
              setPolicyPlan(
                transportPlans,
                'north-loop',
                policyId,
                {
                  pumpPlan,
                  food,
                  repair,
                  transport: 'north-loop',
                  fertilizer,
                  linHe,
                },
              )
              setPolicyPlan(
                transportPlans,
                'south-shortcut',
                policyId,
                {
                  pumpPlan,
                  food,
                  repair,
                  transport: 'south-week-two',
                  fertilizer,
                  linHe,
                },
              )
            }
          }
          contexts.push(
            createBranchMatrixContext(
              'choice:w1:transport-route',
              [
                'context:w1:transport-route',
                `pump=${pumpPlan}`,
                `food=${food}`,
                `repair=${repair}`,
                `fertilizer=${weekOneFertilizer}`,
              ].join('|'),
              transportPlans,
              outcomeForPlan,
            ),
          )
        }
      }
    }
  }

  for (const pumpPlan of PUMP_PLANS) {
    for (const food of FOOD_OPTIONS) {
      for (const repair of REPAIR_OPTIONS) {
        for (const weekOneTransport of [
          'south-week-one',
          'north-loop',
        ] as const) {
          const fertilizerPlans = emptyOptionPlans([
            'use-fertilizer',
            'keep-fertilizer',
          ])
          const futureTransports =
            weekOneTransport === 'south-week-one'
              ? (['inherited'] as const)
              : (['open', 'keep'] as const)
          for (const futureTransport of futureTransports) {
            for (const linHe of LIN_HE_OPTIONS) {
              const policyId = [
                `futureTransport=${futureTransport}`,
                `linHe=${linHe}`,
              ].join('|')
              const transport =
                futureTransport === 'open'
                  ? 'south-week-two'
                  : weekOneTransport
              setPolicyPlan(
                fertilizerPlans,
                'use-fertilizer',
                policyId,
                {
                  pumpPlan,
                  food,
                  repair,
                  transport,
                  fertilizer: 'use-week-two',
                  linHe,
                },
              )
              setPolicyPlan(
                fertilizerPlans,
                'keep-fertilizer',
                policyId,
                {
                  pumpPlan,
                  food,
                  repair,
                  transport,
                  fertilizer: 'keep',
                  linHe,
                },
              )
            }
          }
          contexts.push(
            createBranchMatrixContext(
              'choice:w1:fertilizer',
              [
                'context:w1:fertilizer',
                `pump=${pumpPlan}`,
                `food=${food}`,
                `repair=${repair}`,
                `route=${weekOneTransport}`,
              ].join('|'),
              fertilizerPlans,
              outcomeForPlan,
            ),
          )
        }
      }
    }
  }

  const weekOneOutcomeById = new Map<
    string,
    Omit<
      Gate1WeekOneOutcome,
      'responseOptionIds' | 'improvementOpportunityIds'
    > & {
      responseOptionIds: Set<string>
    }
  >()
  for (const plan of allPlans) {
    const outcome = outcomeForPlan(plan)
    const outcomeId = [
      `food=${outcome.weekOneFood}`,
      `repair=${outcome.weekOneRepair}`,
      `debt=${outcome.weekOneRepairDebtCost}`,
      `load=${outcome.weekOneCharacterLoadCost}`,
      `pump=${outcome.weekOnePumpStatus}`,
      `responsibility=${outcome.weekOneRepairResolution}`,
      `route=${outcome.weekOneTransportRoute}`,
      `fertilizer=${outcome.weekOneFertilizerRemaining}`,
    ].join('|')
    const entry = weekOneOutcomeById.get(outcomeId) ?? {
      outcomeId,
      food: outcome.weekOneFood,
      repair: outcome.weekOneRepair,
      repairDebtCost: outcome.weekOneRepairDebtCost,
      characterLoadCost: outcome.weekOneCharacterLoadCost,
      pumpStatus: outcome.weekOnePumpStatus,
      repairResolution: outcome.weekOneRepairResolution,
      transportRoute: outcome.weekOneTransportRoute,
      fertilizerRemaining: outcome.weekOneFertilizerRemaining,
      responseOptionIds: new Set<string>(),
    }
    entry.responseOptionIds.add(`character:${plan.linHe}`)
    if (outcome.weekOneTransportRoute === 'north-loop') {
      entry.responseOptionIds.add(
        plan.transport === 'south-week-two'
          ? 'transport:south-shortcut'
          : 'transport:north-loop',
      )
    }
    if (outcome.weekOneFertilizerRemaining === 1) {
      entry.responseOptionIds.add(
        plan.fertilizer === 'use-week-two'
          ? 'fertilizer:use-week-two'
          : 'fertilizer:keep',
      )
    }
    weekOneOutcomeById.set(outcomeId, entry)
  }
  const weekOneOutcomes: Gate1WeekOneOutcome[] = [
    ...weekOneOutcomeById.values(),
  ]
    .map((entry) => {
      const responseOptionIds = [...entry.responseOptionIds].sort()
      const improvementOpportunityIds = [
        ...(entry.food >= GATE1_FOOD_TARGET.low &&
        entry.repair >= GATE1_REPAIR_TARGET.low &&
        entry.responseOptionIds.has('character:accept-study')
          ? ['character:accept-study']
          : []),
        ...(entry.responseOptionIds.has(
          'transport:south-shortcut',
        )
          ? ['transport:south-shortcut']
          : []),
        ...(entry.responseOptionIds.has('fertilizer:keep')
          ? ['fertilizer:keep-as-reserve']
          : []),
      ]
      return {
        ...entry,
        responseOptionIds,
        improvementOpportunityIds,
      }
    })
    .sort((left, right) =>
      left.outcomeId.localeCompare(right.outcomeId),
    )

  const oracle: Gate1BranchMatrixOracle = {
    scenarioVersion: scenario.version,
    completeTrajectoryCount: allPlans.length,
    axes: GATE1_BRANCH_MATRIX_AXES,
    contexts,
    weekOneOutcomes,
  }
  branchMatrixCache.set(scenario, oracle)
  return oracle
}
