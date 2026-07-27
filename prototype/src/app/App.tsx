import { useEffect, useMemo, useRef, useState } from 'react'
import type { RcBuildMetadata } from '../build-metadata'
import { gate1WeekOneScenario as scenario } from '../scenario/gate1-week-one'
import {
  ManagementChoiceCommitError,
  advanceSimulation,
  applyPlayerAction,
  createPlayerAction,
} from '../sim/engine'
import {
  GATE1_FOOD_TARGET,
  GATE1_REPAIR_TARGET,
  calculateFoodForecast,
  calculateRepairForecast,
  formatRange,
} from '../sim/forecast'
import type {
  Activity,
  FoodForecast,
  PlayerAction,
  RepairForecast,
  SimulationState,
} from '../sim/model'
import { selectClockLabel, selectProgress } from '../sim/selectors'
import {
  PUMP_MAINTENANCE_BLOCK_ID,
  resolveScheduleBlock,
} from '../sim/schedule'
import { selectTransportRoute } from '../sim/transport'
import { weekIndexForTick } from '../sim/week-phase'
import {
  PREVENTIVE_CAPACITY_CHOICE_SET_ID,
  RECOVERY_ALLOCATION_CHOICE_SET_ID,
  bindManagementChoiceAuthority,
  createManagementChoiceCommitRequest,
  infrastructurePressure,
  isManagementChoiceActive,
} from '../sim/management-choices'
import type { ManagementCandidateId } from '../sim/model'
import {
  createBlockedPlaytestExport,
  createPlaytestExport,
} from '../telemetry/export'
import {
  recordBlockedCaptureCreated,
  createSessionRecorder,
  recordExportCreated,
  recordPlayerTransition,
  recordSimulationAdvance,
  recordSpeedChange,
} from '../telemetry/session'
import type {
  HostIssuedSessionAuthority,
  PlaytestSessionMeta,
  SessionRecorder,
} from '../telemetry/session'
import { MapPanel } from './MapPanel'
import {
  RepairResponsibilitySchedule,
  ScheduleBoard,
} from './ScheduleBoard'
import { SessionGate } from './SessionGate'

type Speed = 1 | 3 | 8
type FocusedIssue =
  | 'food'
  | 'pump'
  | 'repair'
  | 'transport'
  | 'lin-request'
  | 'recovery'
  | null
type SupplyForecast = FoodForecast | RepairForecast

interface AppProps {
  buildMetadata: RcBuildMetadata
  sessionAuthorityProvider?(
    sampleId: string,
  ):
    | HostIssuedSessionAuthority
    | Promise<HostIssuedSessionAuthority>
}

interface IssueSummaryCardProps {
  actionLabel: string
  description: string
  icon: string
  meta: string
  onOpen(trigger: HTMLButtonElement): void
  resolved?: boolean
  selected?: boolean
  title: string
}

interface CaptureReceipt {
  schemaVersion: 'gate1-capture-receipt-v1'
  captureVersion: 'gate1-capture-host-v1'
  filename: string
  bytes: number
  sha256: string
  capturedAtUtc: string
  sampleId: string
  sessionId: string
  buildId: string
  gitSha: string
  artifactHash: string
  downloadUrl: string
  captureKind?: 'blocked'
  blockedAtTick?: number
  isComplete?: false
}

interface PendingCapture {
  rawJson: string
  tick: number
  captureKind: 'complete' | 'blocked'
}

type CaptureStatus = 'idle' | 'saving' | 'saved' | 'error'
type CaptureKind = PendingCapture['captureKind']

const MAX_BLOCKED_REASON_LENGTH = 240

const ACTIVITY_LABELS: Readonly<Record<Activity, string>> = {
  food: '农务',
  repair: '维修',
  logistics: '物流',
  study: '学习',
  rest: '休息',
  social: '社交',
}

function initialState(): SimulationState {
  return scenario.createInitialState()
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function captureErrorMessage(value: unknown, fallback: string) {
  if (
    value &&
    typeof value === 'object' &&
    'error' in value &&
    typeof value.error === 'string'
  ) {
    return value.error
  }
  return fallback
}

const MANAGEMENT_CHOICE_ERROR_MESSAGES = {
  STATE_REVISION_CONFLICT:
    '状态刚刚发生变化，请重新打开比较后再选择。',
  OPPORTUNITY_ALREADY_COMMITTED:
    '这个经营取舍已经结束，不能重复提交。',
  OPPORTUNITY_MISMATCH:
    '当前比较已失效，请关闭后重新打开。',
  AUTHORITY_MISMATCH:
    '当前会话登记不一致，请结束本场并重新创建会话。',
  STALE_PROJECTION:
    '经营预测已经变化，请重新查看两项后果。',
  CANDIDATE_NOT_IN_CHOICE_SET:
    '该方案不属于当前经营取舍。',
  ORIGINAL_ACTIVITY_MISMATCH:
    '目标日程格已被直接修改；真实经营结果保留，但不会补记本次管理意图。',
  OPPORTUNITY_NOT_ACTIVE:
    '该经营取舍已过时限，不能再提交。',
  EFFECT_ALREADY_OWNED:
    '这项经营后果已经由另一项承诺占用。',
  CANONICAL_DELTA_MISMATCH:
    '当前方案无法兑现页面展示的固定后果。',
} as const

async function requestSessionAuthority(
  sampleId: string,
): Promise<HostIssuedSessionAuthority> {
  const response = await fetch('/__gate1/session-authority', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ sampleId }),
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    throw new Error(
      captureErrorMessage(body, '无法向本机构建登记测试会话。'),
    )
  }
  if (
    !body ||
    typeof body !== 'object' ||
    !('diagnosisId' in body) ||
    !('sessionId' in body) ||
    !('candidateBuildAuthorityHash' in body) ||
    !('sessionAuthorityToken' in body) ||
    body.diagnosisId !== sampleId ||
    typeof body.sessionId !== 'string' ||
    typeof body.candidateBuildAuthorityHash !== 'string' ||
    typeof body.sessionAuthorityToken !== 'string' ||
    !/^[a-f0-9]{64}$/.test(body.sessionAuthorityToken)
  ) {
    throw new Error('本机构建返回了无效的会话登记。')
  }
  return body as HostIssuedSessionAuthority
}

function validCaptureReceipt(
  value: unknown,
  expected: {
    artifactHash: string
    buildId: string
    bytes: number
    filename: string
    gitSha: string
    sampleId: string
    sessionId: string
    sha256: string
    captureKind: CaptureKind
    blockedAtTick?: number
  },
): value is CaptureReceipt {
  if (!value || typeof value !== 'object') return false
  const receipt = value as Record<string, unknown>
  const commonReceipt =
    receipt.schemaVersion === 'gate1-capture-receipt-v1' &&
    receipt.captureVersion === 'gate1-capture-host-v1' &&
    receipt.filename === expected.filename &&
    receipt.bytes === expected.bytes &&
    receipt.sha256 === expected.sha256 &&
    receipt.sampleId === expected.sampleId &&
    receipt.sessionId === expected.sessionId &&
    receipt.buildId === expected.buildId &&
    receipt.gitSha === expected.gitSha &&
    receipt.artifactHash === expected.artifactHash &&
    typeof receipt.capturedAtUtc === 'string' &&
    typeof receipt.downloadUrl === 'string' &&
    /^\/__gate1\/capture\/[a-f0-9-]+$/i.test(receipt.downloadUrl)
  if (!commonReceipt) return false
  return expected.captureKind === 'blocked'
    ? receipt.captureKind === 'blocked' &&
        receipt.blockedAtTick === expected.blockedAtTick &&
        receipt.isComplete === false
    : !('captureKind' in receipt) &&
        !('blockedAtTick' in receipt) &&
        !('isComplete' in receipt)
}

function SupplyForecastCard({
  focused = false,
  forecast,
}: {
  focused?: boolean
  forecast: SupplyForecast
}) {
  return (
    <section
      className={`panel forecast-panel ${focused ? 'focused-panel' : ''}`}
      aria-labelledby={`${forecast.id}-forecast-title`}
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">聚落供需推演</p>
          <h2 id={`${forecast.id}-forecast-title`}>{forecast.label}</h2>
        </div>
        <span className={`status-chip supply-status-${forecast.status}`}>
          {forecast.status}
          {forecast.acceptedRisk ? ' · 已接受风险' : ''}
        </span>
      </div>
      <div className="forecast-number" aria-live="polite">
        <span>预计期末库存</span>
        <strong>{formatRange(forecast.endingStock)}</strong>
        <small>趋势：{forecast.trend}</small>
      </div>
      <dl className="forecast-formula">
        <div><dt>当前库存</dt><dd>{forecast.currentStock}</dd></div>
        <div><dt>计划产出</dt><dd>+{formatRange(forecast.production)}</dd></div>
        <div><dt>已知需求</dt><dd>−{forecast.consumption}</dd></div>
      </dl>
      <div className="explanation" aria-live="polite">
        <strong>为什么是这个结果？</strong>
        <ul>
          {forecast.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </div>
    </section>
  )
}

function IssueSummaryCard({
  actionLabel,
  description,
  icon,
  meta,
  onOpen,
  resolved = false,
  selected = false,
  title,
}: IssueSummaryCardProps) {
  return (
    <article
      className={`issue-card ${selected ? 'selected' : ''} ${resolved ? 'resolved' : ''}`}
    >
      <span className="issue-icon" aria-hidden="true">{icon}</span>
      <span className="issue-copy">
        <strong>{title}</strong>
        <span>{description}</span>
        <small>{meta}</small>
      </span>
      <button
        className="issue-action-button"
        onClick={(event) => onOpen(event.currentTarget)}
        type="button"
      >
        {actionLabel}
      </button>
    </article>
  )
}

interface CharacterDecisionPanelProps {
  simulation: SimulationState
}

export function CharacterDecisionPanel({
  simulation,
}: CharacterDecisionPanelProps) {
  const showLinHeRequest =
    weekIndexForTick(simulation.currentTick, scenario) === 1
  const requestPending = simulation.linHeRequestDecision === 'pending'

  return (
    <section className="character-decisions" aria-labelledby="character-decisions-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">人物承诺</p>
          <h2 id="character-decisions-title">不是匿名效率条</h2>
        </div>
        <span className="count-chip">决定会写入人物记录</span>
      </div>
      <div className="character-card-grid">
        <article className="character-card">
          <div className="character-card-heading">
            <div>
              <strong>乔磐</strong>
              <span>维修效率 200%</span>
            </div>
            <span className="boundary-chip">连续加班上限 2 日</span>
          </div>
          <p>“正常班和两天短期加班都可以，第三天请安排别人交接。”</p>
          <small>{simulation.characterRecords['qiao-pan'].at(-1)}</small>
        </article>

        {showLinHeRequest && (
          <article className="character-card request-card">
            <div className="character-card-heading">
              <div>
                <strong>林禾</strong>
                <span>农务效率 200%</span>
              </div>
              <span className="request-chip">
                {requestPending
                  ? '等待答复'
                  : simulation.linHeRequestDecision === 'accepted'
                    ? '已接受'
                    : '已拒绝'}
              </span>
            </div>
            <p>“第二周周二上午，我想把一个农务块留给学习。眼前会少 2 份产出。”</p>
            {requestPending ? (
              <>
                <div className="request-impact">
                  <span>接受：粮食产出 −2，记录学习承诺</span>
                  <span>拒绝：粮食不变，记录本次拒绝</span>
                </div>
                <small>从第二周新增例外定位周二 B1 后答复。</small>
              </>
            ) : (
              <small>{simulation.characterRecords['lin-he'].at(-1)}</small>
            )}
          </article>
        )}
      </div>
    </section>
  )
}

export function App({
  buildMetadata,
  sessionAuthorityProvider = requestSessionAuthority,
}: AppProps) {
  const [simulation, setSimulation] = useState(initialState)
  const [speed, setSpeed] = useState<Speed>(3)
  const [focusedIssue, setFocusedIssue] = useState<FocusedIssue>(null)
  const [activeSession, setActiveSession] = useState<PlaytestSessionMeta | null>(null)
  const [wasSessionCleared, setWasSessionCleared] = useState(false)
  const [lastExportedAtTick, setLastExportedAtTick] = useState<number>()
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>('idle')
  const [captureError, setCaptureError] = useState<string>()
  const [savedCaptureKind, setSavedCaptureKind] = useState<CaptureKind>()
  const [blockedReason, setBlockedReason] = useState('')
  const [blockedCaptureFrozen, setBlockedCaptureFrozen] = useState(false)
  const [choiceError, setChoiceError] = useState<string>()
  const [sessionStartError, setSessionStartError] =
    useState<string>()
  const [sessionStarting, setSessionStarting] = useState(false)
  const nextActionSequence = useRef(1)
  const simulationRef = useRef(simulation)
  const recorderRef = useRef<SessionRecorder | null>(null)
  const pendingCaptureRef = useRef<PendingCapture | null>(null)
  const comparisonCloseRef = useRef<HTMLButtonElement | null>(null)
  const comparisonTriggerRef = useRef<HTMLButtonElement | null>(null)
  const foodForecast = useMemo(() => calculateFoodForecast(simulation), [simulation])
  const repairForecast = useMemo(() => calculateRepairForecast(simulation), [simulation])
  const progress = selectProgress(simulation, scenario)
  const currentWeekIndex = weekIndexForTick(simulation.currentTick, scenario)
  const currentWeek = currentWeekIndex + 1
  const fertilizerUsedWeek =
    simulation.fertilizer.appliedWeekIndex === null
      ? null
      : simulation.fertilizer.appliedWeekIndex + 1
  const pumpBlock = resolveScheduleBlock(
    simulation,
    PUMP_MAINTENANCE_BLOCK_ID,
  )
  const transportRoute = selectTransportRoute(simulation)
  const latestBlockingEvent = simulation.isPaused
    ? [...simulation.timeline].reverse().find(
        (item) =>
          item.kind === 'scripted-event' &&
          item.atTick === simulation.currentTick &&
          !item.id.endsWith('-ended'),
      )
    : undefined
  const repairResponsibilityResolved =
    simulation.repairResponsibility !== 'unresolved'
  const repairResponsibilityTitle =
    simulation.repairResponsibility === 'scheduled'
      ? '维修责任已写入日程'
      : simulation.repairResponsibility === 'debt'
        ? '维修欠账已接受'
        : simulation.repairResponsibilitySelection === null
          ? '水泵维修责任尚未落地'
          : '责任方向已选，等待日程确认'
  const preventiveCapacityTerminal =
    simulation.managementChoices.opportunities
      .preventiveCapacity?.terminalState ?? 'open'
  const recoveryAllocationTerminal =
    simulation.managementChoices.opportunities
      .recoveryAllocation?.terminalState ?? 'open'
  const preventiveCapacityCommitted = [
    'schedule-preventive-maintenance',
    'retain-rest-capacity',
  ].includes(preventiveCapacityTerminal)
  const recoveryAllocationCommitted = [
    'allocate-repair-buffer',
    'allocate-food-production',
  ].includes(recoveryAllocationTerminal)
  const recoveryLoadStatus =
    simulation.managementChoices.equipmentRecoveryLoad <= 1
      ? '稳定'
      : '脆弱'
  const currentInfrastructurePressure =
    infrastructurePressure(
      repairForecast.endingStock.high,
      simulation.managementChoices.equipmentRecoveryLoad,
    )

  function submit(action: PlayerAction) {
    if (!recorderRef.current || blockedCaptureFrozen) return
    const current = simulationRef.current
    const undoOfActionId =
      action.type === 'UNDO_SCHEDULE'
        ? current.scheduleTransactions.at(-1)?.actionId
        : undefined
    const envelope = createPlayerAction(
      nextActionSequence.current,
      current.currentTick,
      action,
      undoOfActionId,
    )
    nextActionSequence.current += 1
    if (action.type === 'CONTINUE_TO_NEXT_WEEK') setFocusedIssue(null)
    const result = applyPlayerAction(current, envelope, scenario)
    recordPlayerTransition(recorderRef.current, current, envelope, result)
    simulationRef.current = result.state
    setSimulation(result.state)
  }

  function submitManagementChoice(
    candidateId: ManagementCandidateId,
  ) {
    const current = simulationRef.current
    const choiceSetId =
      candidateId ===
        'schedule-preventive-maintenance' ||
      candidateId === 'retain-rest-capacity'
        ? PREVENTIVE_CAPACITY_CHOICE_SET_ID
        : RECOVERY_ALLOCATION_CHOICE_SET_ID
    try {
      const request =
        createManagementChoiceCommitRequest(
          current,
          choiceSetId,
          candidateId,
          [
            current.managementChoices.authority
              ?.sessionAuthorityToken,
            choiceSetId,
            current.stateRevision,
            candidateId,
          ].join(':'),
        )
      submit({
        type: 'COMMIT_MANAGEMENT_CHOICE',
        request,
      })
      setChoiceError(undefined)
    } catch (error) {
      setChoiceError(
        error instanceof ManagementChoiceCommitError
          ? MANAGEMENT_CHOICE_ERROR_MESSAGES[error.code]
          : error instanceof Error
            ? error.message
            : '管理选择提交失败。',
      )
    }
  }

  function openComparison(
    issue: Extract<FocusedIssue, 'repair' | 'lin-request'>,
    trigger: HTMLButtonElement,
  ) {
    comparisonTriggerRef.current = trigger
    setFocusedIssue(issue)
  }

  function closeComparison() {
    const trigger = comparisonTriggerRef.current
    setFocusedIssue(null)
    queueMicrotask(() => trigger?.focus())
  }

  useEffect(() => {
    if (
      !activeSession ||
      blockedCaptureFrozen ||
      simulation.isPaused ||
      simulation.recap
    ) return
    const timer = window.setInterval(() => {
      setSimulation((current) => {
        if (current.isPaused || current.recap) return current
        const result = advanceSimulation(
          current,
          current.currentTick + speed,
          scenario,
        )
        if (recorderRef.current) {
          recordSimulationAdvance(recorderRef.current, current, result, speed)
        }
        simulationRef.current = result.state
        return result.state
      })
    }, 250)
    return () => window.clearInterval(timer)
  }, [
    activeSession,
    blockedCaptureFrozen,
    simulation.isPaused,
    simulation.recap,
    speed,
  ])

  useEffect(() => {
    if (focusedIssue === 'repair' || focusedIssue === 'lin-request') {
      comparisonCloseRef.current?.focus()
    }
  }, [focusedIssue])

  function installSession(
    sampleId: string,
    authority: HostIssuedSessionAuthority,
  ) {
    const state = initialState()
    const recorder = createSessionRecorder(
      sampleId,
      state,
      buildMetadata,
      Date.now(),
      performance.now(),
      authority,
    )
    const sessionState = bindManagementChoiceAuthority(
      state,
      authority,
    )
    recorderRef.current = recorder
    simulationRef.current = sessionState
    nextActionSequence.current = 1
    setSimulation(sessionState)
    setSpeed(3)
    setFocusedIssue(null)
    setLastExportedAtTick(undefined)
    setCaptureStatus('idle')
    setCaptureError(undefined)
    setSavedCaptureKind(undefined)
    setBlockedReason('')
    setBlockedCaptureFrozen(false)
    setChoiceError(undefined)
    pendingCaptureRef.current = null
    setActiveSession(recorder.meta)
    setWasSessionCleared(false)
  }

  function failSessionStart(error: unknown) {
    setSessionStartError(
      error instanceof Error
        ? error.message
        : '无法创建本地测试会话。',
    )
  }

  function startSession(sampleId: string) {
    setSessionStarting(true)
    setSessionStartError(undefined)
    try {
      const issued = sessionAuthorityProvider(sampleId)
      if (issued instanceof Promise) {
        void issued
          .then((authority) => installSession(sampleId, authority))
          .catch(failSessionStart)
          .finally(() => setSessionStarting(false))
        return
      }
      installSession(sampleId, issued)
      setSessionStarting(false)
    } catch (error) {
      failSessionStart(error)
      setSessionStarting(false)
    }
  }

  function changeSpeed(value: Speed) {
    if (blockedCaptureFrozen) return
    if (recorderRef.current && speed !== value) {
      recordSpeedChange(recorderRef.current, simulation.currentTick, value)
    }
    setSpeed(value)
  }

  async function captureSession(captureKind: CaptureKind) {
    const normalizedBlockedReason = blockedReason.trim()
    if (
      !recorderRef.current ||
      !activeSession ||
      savedCaptureKind !== undefined ||
      (captureKind === 'complete' && !simulation.isComplete) ||
      (captureKind === 'blocked' &&
        (simulation.isComplete ||
          normalizedBlockedReason.length === 0 ||
          normalizedBlockedReason.length > MAX_BLOCKED_REASON_LENGTH)) ||
      captureStatus === 'saving'
    ) {
      return
    }
    if (captureKind === 'blocked') setBlockedCaptureFrozen(true)
    setCaptureStatus('saving')
    setCaptureError(undefined)

    let pendingCapture = pendingCaptureRef.current
    if (!pendingCapture) {
      const payload =
        captureKind === 'blocked'
          ? (() => {
              recordBlockedCaptureCreated(
                recorderRef.current!,
                simulation.currentTick,
              )
              return createBlockedPlaytestExport(
                recorderRef.current!,
                simulation,
                normalizedBlockedReason,
              )
            })()
          : (() => {
              recordExportCreated(
                recorderRef.current!,
                simulation.currentTick,
              )
              return createPlaytestExport(recorderRef.current!, simulation)
            })()
      pendingCapture = {
        rawJson: JSON.stringify(payload, null, 2),
        tick: simulation.currentTick,
        captureKind,
      }
      pendingCaptureRef.current = pendingCapture
    }
    if (pendingCapture.captureKind !== captureKind) return

    try {
      const bytes = new TextEncoder().encode(pendingCapture.rawJson)
      const sha256 = await sha256Hex(bytes)
      const filename =
        `${activeSession.buildId}-${activeSession.sampleId}-${activeSession.sessionId}.json`
      const response = await fetch('/__gate1/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: pendingCapture.rawJson,
        cache: 'no-store',
      })
      let responseBody: unknown
      try {
        responseBody = await response.json()
      } catch {
        throw new Error(`匿名记录保存失败（HTTP ${response.status}）`)
      }
      if (!response.ok) {
        throw new Error(
          captureErrorMessage(
            responseBody,
            `匿名记录保存失败（HTTP ${response.status}）`,
          ),
        )
      }
      if (
        !validCaptureReceipt(responseBody, {
          artifactHash: activeSession.artifactHash,
          buildId: activeSession.buildId,
          bytes: bytes.byteLength,
          filename,
          gitSha: activeSession.gitSha,
          sampleId: activeSession.sampleId,
          sessionId: activeSession.sessionId,
          sha256,
          captureKind: pendingCapture.captureKind,
          ...(pendingCapture.captureKind === 'blocked'
            ? { blockedAtTick: pendingCapture.tick }
            : {}),
        })
      ) {
        throw new Error('匿名记录保存回执无效')
      }

      setLastExportedAtTick(pendingCapture.tick)
      setSavedCaptureKind(pendingCapture.captureKind)
      setCaptureStatus('saved')
      const anchor = document.createElement('a')
      anchor.href = responseBody.downloadUrl
      anchor.download = responseBody.filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
    } catch (error) {
      setCaptureStatus('error')
      setCaptureError(
        error instanceof Error ? error.message : '匿名记录保存失败，请重试。',
      )
    }
  }

  function clearSession() {
    if (!activeSession || savedCaptureKind === undefined) return
    recorderRef.current = null
    nextActionSequence.current = 1
    pendingCaptureRef.current = null
    setWasSessionCleared(true)
    setActiveSession(null)
    const resetState = initialState()
    simulationRef.current = resetState
    setSimulation(resetState)
    setSpeed(3)
    setFocusedIssue(null)
    setLastExportedAtTick(undefined)
    setCaptureStatus('idle')
    setCaptureError(undefined)
    setSavedCaptureKind(undefined)
    setBlockedReason('')
    setBlockedCaptureFrozen(false)
    setChoiceError(undefined)
  }

  const canEditPumpPlan = isManagementChoiceActive(
    simulation,
    PREVENTIVE_CAPACITY_CHOICE_SET_ID,
  )
  const canAllocateRecovery = isManagementChoiceActive(
    simulation,
    RECOVERY_ALLOCATION_CHOICE_SET_ID,
  )

  if (!activeSession) {
    return (
      <SessionGate
        buildMetadata={buildMetadata}
        onStart={startSession}
        startError={sessionStartError}
        starting={sessionStarting}
        wasCleared={wasSessionCleared}
      />
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Gate 1 · 第 {currentWeek} 周 / 共 2 周</p>
          <h1>东篱聚落周计划</h1>
        </div>
        <div className="clock-panel" aria-label="聚落时钟">
          <div>
            <strong>{selectClockLabel(simulation)}</strong>
            <span>{simulation.isPaused ? '已暂停' : `${speed}× 运行中`}</span>
          </div>
          <div className="speed-controls" aria-label="时间速度">
            {([1, 3, 8] as const).map((value) => (
              <button
                className={speed === value ? 'active' : ''}
                disabled={blockedCaptureFrozen}
                key={value}
                onClick={() => changeSpeed(value)}
                type="button"
              >
                {value}×
              </button>
            ))}
            <button
              className="play-button"
              disabled={simulation.recap !== null || blockedCaptureFrozen}
              onClick={() =>
                submit({ type: 'SET_PAUSED', paused: !simulation.isPaused })
              }
              type="button"
            >
              {simulation.recap
                ? '复盘中'
                : simulation.isPaused
                  ? latestBlockingEvent
                    ? '确认后继续'
                    : '开始运行'
                  : '暂停'}
            </button>
          </div>
        </div>
        <div className="progress-label">两周总进度 {progress}%</div>
        <div className="progress-track" aria-label={`两周总进度 ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="session-meta-strip" aria-label="当前测试会话元数据">
        <div><span>匿名编号</span><strong>{activeSession.sampleId}</strong></div>
        <div><span>构建</span><strong>{activeSession.buildId}</strong></div>
        <div><span>Git</span><strong title={activeSession.gitSha}>{activeSession.gitSha}</strong></div>
        <div><span>产物</span><strong title={activeSession.artifactHash}>{activeSession.artifactHash}</strong></div>
        <div><span>初态</span><strong>{activeSession.initialStateHash}</strong></div>
        <div><span>场景</span><strong>{activeSession.scenarioVersion}</strong></div>
        <div><span>种子</span><strong>{activeSession.fixedSeed}</strong></div>
        <div><span>Session</span><strong>{activeSession.sessionId}</strong></div>
      </section>

      {!simulation.recap && (
        <>
      <section className="briefing" aria-labelledby="briefing-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">周初摘要</p>
            <h2 id="briefing-title">
              {currentWeek === 1 ? '本周三项取舍' : '第二周新增例外'}
            </h2>
          </div>
          <span className="count-chip">
            {currentWeek === 1 ? '不要求全部调绿' : '未变化计划无需确认'}
          </span>
        </div>
        {currentWeek === 2 && (
          <div className="inheritance-strip">
            <strong>基础计划已继承</strong>
            <span>四人 112 个活动块继续生效；第一周一次性例外已结算失效。</span>
          </div>
        )}
        <div className="issue-list">
          {currentWeek === 1 ? (
            <>
              <IssueSummaryCard
                actionLabel={foodForecast.acceptedRisk ? '查看已接受风险' : '查看粮食取舍'}
                description={`期末库存 ${formatRange(foodForecast.endingStock)}；可补产能，也可承担可见缺口。`}
                icon="!"
                meta={foodForecast.acceptedRisk
                  ? '风险已接受 · 数学预测保持不变'
                  : '后果：粮食、化肥与共享劳动力'}
                onOpen={() => setFocusedIssue('food')}
                resolved={foodForecast.acceptedRisk}
                selected={focusedIssue === 'food'}
                title={`粮食预计${foodForecast.status}`}
              />
              <IssueSummaryCard
                actionLabel={
                  preventiveCapacityCommitted
                    ? '查看容量结果'
                    : '比较容量取舍'
                }
                description={
                  preventiveCapacityTerminal ===
                  'schedule-preventive-maintenance'
                    ? '一个休息格已原子分配给第二次预防检修，设备暴露降为 low。'
                    : preventiveCapacityTerminal ===
                        'retain-rest-capacity'
                      ? '已指定保护性恢复，人员准备度 +1；设备暴露保持 high。'
                      : '同一个休息格只能用于第二次预防检修或专项保护性恢复；跳过只保留普通休息。'
                }
                icon="!"
                meta="同一资源：林禾第2日 B2 · 无默认或推荐"
                onOpen={() => setFocusedIssue('pump')}
                resolved={preventiveCapacityCommitted}
                selected={focusedIssue === 'pump'}
                title="预防容量分配"
              />
              <IssueSummaryCard
                actionLabel={repairResponsibilityResolved ? '查看责任结果' : '比较责任方向'}
                description={simulation.repairResponsibility === 'debt'
                  ? '本周和第二周各承担 3 点代价，终局结清。'
                  : '可由维修专员承担、跨岗交接，或接受有期限的维修欠账。'}
                icon="责"
                meta={`后果：维修保障 ${formatRange(repairForecast.endingStock)}、人物负荷与跨周欠账`}
                onOpen={(trigger) => openComparison('repair', trigger)}
                resolved={repairResponsibilityResolved}
                selected={focusedIssue === 'repair'}
                title={repairResponsibilityTitle}
              />
            </>
          ) : (
            <>
              <IssueSummaryCard
                actionLabel={
                  recoveryAllocationCommitted
                    ? '查看分配结果'
                    : '比较应急班次'
                }
                description={
                  recoveryAllocationTerminal ===
                  'allocate-repair-buffer'
                    ? '第11日 B3 已分配给维修备件，预计期末维修保障 +1。'
                    : recoveryAllocationTerminal ===
                        'allocate-food-production'
                      ? '第11日 B3 已分配给粮食生产，预计期末粮食 +1。'
                      : '同一个三小时应急班次只能投向维修备件或粮食生产，也可以跳过。'
                }
                icon="配"
                meta={`设备恢复负荷 ${simulation.managementChoices.equipmentRecoveryLoad} · 同一 18-tick 班次`}
                onOpen={() => setFocusedIssue('recovery')}
                resolved={recoveryAllocationCommitted}
                selected={focusedIssue === 'recovery'}
                title="恢复资源分配"
              />
              <IssueSummaryCard
                actionLabel={simulation.linHeRequestDecision === 'pending'
                  ? '比较回应方案'
                  : '查看回应结果'}
                description="接受会降低本周粮食产出；拒绝或逾期会留下不同的人物记录。"
                icon="人"
                meta={simulation.linHeRequestDecision === 'pending'
                  ? '新增例外 · 在请求时限前答复'
                  : '回应已记录 · 对应活动块已锁定'}
                onOpen={(trigger) => openComparison('lin-request', trigger)}
                resolved={simulation.linHeRequestDecision !== 'pending'}
                selected={focusedIssue === 'lin-request'}
                title="一项成员发展请求待回应"
              />
              <IssueSummaryCard
                actionLabel="定位资源取舍"
                description={fertilizerUsedWeek === 1
                  ? '第二周没有额外化肥可补粮。'
                  : fertilizerUsedWeek === 2
                    ? '本周已使用化肥，库存为 0。'
                    : '可用粮食 +6 弥补学习或已知缺口，也可保留到终局。'}
                icon="+"
                meta="后果：粮食与终局保留资产"
                onOpen={() => setFocusedIssue('food')}
                resolved={fertilizerUsedWeek !== null}
                selected={focusedIssue === 'food'}
                title={fertilizerUsedWeek === 1
                  ? '化肥已在第一周使用'
                  : fertilizerUsedWeek === 2
                    ? '化肥已在第二周使用'
                    : '化肥仍有一次机会'}
              />
              <IssueSummaryCard
                actionLabel="查看路线方案"
                description={`当前 ${transportRoute.distanceMeters} 米 / ${transportRoute.travelMinutes} 分钟，粮食损耗 ${transportRoute.foodLoss}。`}
                icon="路"
                meta={transportRoute.id === 'south-shortcut'
                  ? '继承结果 · 无需重复设置'
                  : '责任方向：在首次运输前确认路线'}
                onOpen={() => setFocusedIssue('transport')}
                resolved={transportRoute.id === 'south-shortcut'}
                selected={focusedIssue === 'transport'}
                title={transportRoute.id === 'south-shortcut'
                  ? '短通路结果已继承'
                  : '当前运输路线存在损耗'}
              />
            </>
          )}
        </div>
      </section>

      {currentWeek === 1 && focusedIssue === 'pump' && (
        <section
          aria-labelledby="preventive-capacity-title"
          aria-modal="false"
          className="choice-comparison"
          onKeyDown={(event) => {
            if (
              event.target === event.currentTarget &&
              (event.key === 'Enter' || event.key === ' ')
            ) {
              event.preventDefault()
            }
          }}
          role="dialog"
        >
          <div className="comparison-heading">
            <div>
              <p className="eyebrow">预防容量分配</p>
              <h2 id="preventive-capacity-title">
                一个休息格，两种持久后果
              </h2>
            </div>
            <button
              className="comparison-close"
              onClick={() => setFocusedIssue(null)}
              type="button"
            >
              关闭比较
            </button>
          </div>
          <p className="comparison-intro">
            两项同时可见；打开、关闭或定位不会提交。明确选择后立即原子兑现，不能改选。跳过会保留普通休息，但没有专项 recovery 或 readiness 提升。
          </p>
          <div
            className="comparison-options two-options"
            role="list"
            aria-label="预防容量候选"
          >
            <article className="comparison-option" role="listitem">
              <strong>安排第二次预防检修</strong>
              <span>
                成本：消耗林禾第2日 B2 的休息；收益：设备暴露 high → low。
              </span>
              <small>
                放弃人员恢复；W2 设备恢复负荷为 1。
              </small>
              <button
                aria-pressed={
                  preventiveCapacityTerminal ===
                  'schedule-preventive-maintenance'
                }
                className="comparison-option-action"
                disabled={
                  preventiveCapacityTerminal !== 'open' ||
                  !canEditPumpPlan
                }
                onClick={() =>
                  submitManagementChoice(
                    'schedule-preventive-maintenance',
                  )
                }
                type="button"
              >
                安排第二次预防检修
              </button>
            </article>
            <article className="comparison-option" role="listitem">
              <strong>指定保护性恢复</strong>
              <span>
                成本：设备暴露保持 high；收益：林禾恢复 1，终局人员准备度 +1。
              </span>
              <small>
                放弃第二次检修；W2 设备恢复负荷为 2。
              </small>
              <button
                aria-pressed={
                  preventiveCapacityTerminal ===
                  'retain-rest-capacity'
                }
                className="comparison-option-action"
                disabled={
                  preventiveCapacityTerminal !== 'open' ||
                  !canEditPumpPlan
                }
                onClick={() =>
                  submitManagementChoice(
                    'retain-rest-capacity',
                  )
                }
                type="button"
              >
                指定保护性恢复
              </button>
            </article>
          </div>
          {preventiveCapacityTerminal ===
            'unqualified-direct-edit' && (
            <p className="choice-integrity-note" role="status">
              目标日程格已直接编辑：真实经营结果继续生效，但系统不会事后补记本次管理意图。
            </p>
          )}
          {choiceError && (
            <small role="alert">{choiceError}</small>
          )}
        </section>
      )}

      {currentWeek === 2 &&
        focusedIssue === 'recovery' && (
          <section
            aria-labelledby="recovery-allocation-title"
            aria-modal="false"
            className="choice-comparison"
            onKeyDown={(event) => {
              if (
                event.target === event.currentTarget &&
                (event.key === 'Enter' ||
                  event.key === ' ')
              ) {
                event.preventDefault()
              }
            }}
            role="dialog"
          >
            <div className="comparison-heading">
              <div>
                <p className="eyebrow">恢复资源分配</p>
                <h2 id="recovery-allocation-title">
                  同一个应急班次投向哪里
                </h2>
              </div>
              <button
                className="comparison-close"
                onClick={() => setFocusedIssue(null)}
                type="button"
              >
                关闭比较
              </button>
            </div>
            <p className="comparison-intro">
              陈渡第11日 B3（16–19）是唯一资源；两项都消耗同一个 18-tick 班次。
            </p>
            <dl
              aria-label="恢复资源共享状态"
              className="shared-status-table"
            >
              <div>
                <dt>当前粮食</dt>
                <dd>
                  {formatRange(foodForecast.endingStock)} / 目标 ≥
                  {GATE1_FOOD_TARGET.low}
                </dd>
              </div>
              <div>
                <dt>当前维修</dt>
                <dd>
                  {formatRange(repairForecast.endingStock)} / 目标 ≥
                  {GATE1_REPAIR_TARGET.low}
                </dd>
              </div>
              <div>
                <dt>设备负荷</dt>
                <dd>
                  {recoveryLoadStatus}（
                  {simulation.managementChoices.equipmentRecoveryLoad}）
                </dd>
              </div>
              <div>
                <dt>基础设施压力</dt>
                <dd>{currentInfrastructurePressure}</dd>
              </div>
            </dl>
            <div
              className="comparison-options two-options"
              role="list"
              aria-label="恢复资源候选"
            >
              <article
                className="comparison-option"
                role="listitem"
              >
                <strong>分配给维修备件</strong>
                <span>
                  收益：预计期末维修保障 +1；粮食不变。
                </span>
                <small>
                  放弃粮食 +1；设备恢复负荷保持 {simulation.managementChoices.equipmentRecoveryLoad}。
                </small>
                <dl className="candidate-outcome-grid">
                  <div><dt>选择后粮食</dt><dd>{formatRange(foodForecast.endingStock)}</dd></div>
                  <div><dt>选择后维修</dt><dd>{formatRange({
                    low: repairForecast.endingStock.low + 1,
                    high: repairForecast.endingStock.high + 1,
                  })}</dd></div>
                  <div><dt>负荷</dt><dd>{recoveryLoadStatus}</dd></div>
                  <div><dt>准备度</dt><dd>{simulation.managementChoices.personnelReadiness}</dd></div>
                  <div><dt>压力</dt><dd>{infrastructurePressure(
                    repairForecast.endingStock.high + 1,
                    simulation.managementChoices.equipmentRecoveryLoad,
                  )}</dd></div>
                </dl>
                <button
                  aria-pressed={
                    recoveryAllocationTerminal ===
                    'allocate-repair-buffer'
                  }
                  className="comparison-option-action"
                  disabled={
                    recoveryAllocationTerminal !== 'open' ||
                    !canAllocateRecovery
                  }
                  onClick={() =>
                    submitManagementChoice(
                      'allocate-repair-buffer',
                    )
                  }
                  type="button"
                >
                  分配给维修备件
                </button>
              </article>
              <article
                className="comparison-option"
                role="listitem"
              >
                <strong>分配给粮食生产</strong>
                <span>
                  收益：预计期末粮食 +1；维修保障不变。
                </span>
                <small>
                  放弃维修 +1；设备恢复负荷保持 {simulation.managementChoices.equipmentRecoveryLoad}。
                </small>
                <dl className="candidate-outcome-grid">
                  <div><dt>选择后粮食</dt><dd>{formatRange({
                    low: foodForecast.endingStock.low + 1,
                    high: foodForecast.endingStock.high + 1,
                  })}</dd></div>
                  <div><dt>选择后维修</dt><dd>{formatRange(repairForecast.endingStock)}</dd></div>
                  <div><dt>负荷</dt><dd>{recoveryLoadStatus}</dd></div>
                  <div><dt>准备度</dt><dd>{simulation.managementChoices.personnelReadiness}</dd></div>
                  <div><dt>压力</dt><dd>{currentInfrastructurePressure}</dd></div>
                </dl>
                <button
                  aria-pressed={
                    recoveryAllocationTerminal ===
                    'allocate-food-production'
                  }
                  className="comparison-option-action"
                  disabled={
                    recoveryAllocationTerminal !== 'open' ||
                    !canAllocateRecovery
                  }
                  onClick={() =>
                    submitManagementChoice(
                      'allocate-food-production',
                    )
                  }
                  type="button"
                >
                  分配给粮食生产
                </button>
              </article>
            </div>
            {recoveryAllocationTerminal ===
              'unqualified-direct-edit' && (
              <p className="choice-integrity-note" role="status">
                目标班次已直接编辑：真实粮食或维修结果继续生效，但系统不会事后补记本次恢复资源意图。
              </p>
            )}
            {choiceError && (
              <small role="alert">{choiceError}</small>
            )}
          </section>
        )}

      {currentWeek === 1 && focusedIssue === 'repair' && (
        <section
          aria-labelledby="repair-comparison-title"
          aria-modal="false"
          className="choice-comparison"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              closeComparison()
              return
            }
            if (
              event.target === event.currentTarget &&
              (event.key === 'Enter' || event.key === ' ')
            ) {
              event.preventDefault()
            }
          }}
          role="dialog"
        >
          <div className="comparison-heading">
            <div>
              <p className="eyebrow">责任方向比较</p>
              <h2 id="repair-comparison-title">先比较后果，再把人员责任落到日程</h2>
            </div>
            <button
              className="comparison-close"
              onClick={closeComparison}
              ref={comparisonCloseRef}
              type="button"
            >
              关闭比较
            </button>
          </div>
          <p className="comparison-intro">
            三条当前可行方向同时展示；打开此处不会改变预测，选择人员方向后仍须确认具体日程。
          </p>
          <div className="comparison-options" role="list" aria-label="维修责任可行方案">
            <article className="comparison-option" role="listitem">
              <strong>维修专员承担</strong>
              <span>乔磐接手：维修产出 +2，人物负荷 +2；会占用一个休息活动块。</span>
              <small>责任只有在对应日程确认后才兑现。</small>
              <button
                aria-pressed={simulation.repairResponsibilitySelection === 'qiao-pan'}
                className="comparison-option-action"
                disabled={
                  repairResponsibilityResolved ||
                  simulation.repairResponsibilitySelection === 'qiao-pan'
                }
                onClick={() =>
                  submit({
                    type: 'SELECT_REPAIR_RESPONSIBILITY',
                    responsible: 'qiao-pan',
                  })
                }
                type="button"
              >
                选择维修专员承担
              </button>
            </article>
            <article className="comparison-option" role="listitem">
              <strong>跨岗交接</strong>
              <span>陈渡或苏霁接手：维修产出 +1；两种日程的人物负荷与原岗位代价不同。</span>
              <small>下一步会同时展示两种可确认的日程实现。</small>
              <button
                aria-pressed={simulation.repairResponsibilitySelection === 'handoff'}
                className="comparison-option-action"
                disabled={
                  repairResponsibilityResolved ||
                  simulation.repairResponsibilitySelection === 'handoff'
                }
                onClick={() =>
                  submit({
                    type: 'SELECT_REPAIR_RESPONSIBILITY',
                    responsible: 'handoff',
                  })
                }
                type="button"
              >
                选择跨岗交接
              </button>
            </article>
            <article className="comparison-option" role="listitem">
              <strong>接受维修欠账</strong>
              <span>不改日程；本周立即承担 3 点代价，第二周再累计 3 点。</span>
              <small>欠账在 tick 2010 结清，并进入两周复盘。</small>
              <button
                aria-pressed={simulation.repairResponsibility === 'debt'}
                className="comparison-option-action"
                disabled={repairResponsibilityResolved}
                onClick={() => submit({ type: 'ACCEPT_REPAIR_DEBT' })}
                type="button"
              >
                接受维修欠账
              </button>
            </article>
          </div>
        </section>
      )}

      {currentWeek === 2 && focusedIssue === 'lin-request' && (
        <section
          aria-labelledby="request-comparison-title"
          aria-modal="false"
          className="choice-comparison"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              closeComparison()
              return
            }
            if (
              event.target === event.currentTarget &&
              (event.key === 'Enter' || event.key === ' ')
            ) {
              event.preventDefault()
            }
          }}
          role="dialog"
        >
          <div className="comparison-heading">
            <div>
              <p className="eyebrow">人物请求比较</p>
              <h2 id="request-comparison-title">林禾的学习请求</h2>
            </div>
            <button
              className="comparison-close"
              onClick={closeComparison}
              ref={comparisonCloseRef}
              type="button"
            >
              关闭比较
            </button>
          </div>
          <p className="comparison-intro">
            两种回应同时展示；没有默认选择，只有点击具体回应才会改动日程与人物记录。
          </p>
          <div className="comparison-options two-options" role="list" aria-label="学习请求可行方案">
            <article className="comparison-option" role="listitem">
              <strong>接受学习请求</strong>
              <span>把第二周对应农务活动块改为学习；本周粮食产出 −2。</span>
              <small>写入学习承诺，目标活动块随后锁定。</small>
              <button
                aria-pressed={simulation.linHeRequestDecision === 'accepted'}
                className="comparison-option-action"
                disabled={simulation.linHeRequestDecision !== 'pending'}
                onClick={() =>
                  submit({ type: 'RESOLVE_LIN_HE_REQUEST', decision: 'accepted' })
                }
                type="button"
              >
                接受学习请求
              </button>
            </article>
            <article className="comparison-option" role="listitem">
              <strong>拒绝并保留农务</strong>
              <span>保留当前农务活动块；粮食产出不变。</span>
              <small>写入本次拒绝，目标活动块随后锁定。</small>
              <button
                aria-pressed={simulation.linHeRequestDecision === 'declined'}
                className="comparison-option-action"
                disabled={simulation.linHeRequestDecision !== 'pending'}
                onClick={() =>
                  submit({ type: 'RESOLVE_LIN_HE_REQUEST', decision: 'declined' })
                }
                type="button"
              >
                拒绝并保留农务
              </button>
            </article>
          </div>
        </section>
      )}

      <div className="workspace-grid">
        <section
          className={`panel schedule-panel ${
            focusedIssue === 'pump' ||
            (currentWeek === 1 && focusedIssue === 'repair') ||
            (currentWeek === 2 && focusedIssue === 'lin-request')
              ? 'focused-panel'
              : ''
          }`}
          aria-labelledby="schedule-title"
        >
          <div className="panel-title">
            <div>
              <p className="eyebrow">成员安排</p>
              <h2 id="schedule-title">
                {currentWeek === 1 && focusedIssue === 'repair'
                  ? '维修责任日程'
                  : currentWeek === 1
                    ? '林禾 · 周二 B2'
                    : '林禾 · 周二 B1'}
              </h2>
            </div>
            <span className="skill-chip">
              {currentWeek === 1 && focusedIssue === 'repair'
                ? simulation.repairResponsibility === 'scheduled'
                  ? '责任已兑现'
                  : simulation.repairResponsibility === 'debt'
                    ? '欠账已记录'
                    : simulation.repairResponsibilitySelection === null
                      ? '等待方向'
                      : '等待日程确认'
                : currentWeek === 1
                ? `${ACTIVITY_LABELS[pumpBlock.activity]} · ${pumpBlock.source}`
                : '新增请求'}
            </span>
          </div>
          <p className="block-time">
            {currentWeek === 1 && focusedIssue === 'repair'
              ? '方向选择本身不增加维修产出；具体活动块确认后才进入供需预测。'
              : currentWeek === 1
              ? '周二 13:00–16:00 · 水泵检修第 2 / 2 块'
              : '第二周周二 09:00–12:00 · 农务 / 学习请求'}
          </p>
          {currentWeek === 2 ? (
            simulation.linHeRequestDecision !== 'pending' ? (
              <p className="empty-prompt">
                {simulation.characterRecords['lin-he'].at(-1)}
              </p>
            ) : focusedIssue !== 'lin-request' ? (
              <p className="empty-prompt">
                从周初摘要打开成员请求，只处理这一项新增例外。
              </p>
            ) : (
              <p className="empty-prompt">
                两种回应已在上方同层级展示；此处只标明请求对应的日程位置。
              </p>
            )
          ) : focusedIssue === 'repair' ? (
            <RepairResponsibilitySchedule
              simulation={simulation}
              submit={submit}
            />
          ) : focusedIssue !== 'pump' ? (
            <p className="empty-prompt">
              从周初摘要定位预防检修日程，或比较维修责任方向。
            </p>
          ) : (
            <div className="activity-editor">
              <p>
                乔磐已有 1 块；当前该格为 {ACTIVITY_LABELS[pumpBlock.activity]}。
              </p>
              <small>
                上方两项是唯一可计数的显式 choice set。完整周计划里的底层编辑仍会改变真实日程，但不会事后推断为本项承诺。
              </small>
              {!canEditPumpPlan && <small>水泵事件已发生，过去的预防性安排不能追溯修改。</small>}
            </div>
          )}
        </section>

        <div className="supply-stack">
          <SupplyForecastCard
            focused={focusedIssue === 'food'}
            forecast={foodForecast}
          />
          <SupplyForecastCard
            focused={focusedIssue === 'repair'}
            forecast={repairForecast}
          />
        </div>
      </div>

      <MapPanel
        focused={focusedIssue === 'transport'}
        simulation={simulation}
        submit={submit}
      />

      <section className="management-actions" aria-labelledby="management-actions-title">
        <div>
          <p className="eyebrow">本周资源与风险</p>
          <h2 id="management-actions-title">选择代价，不是一键补绿</h2>
        </div>
        <div className="management-action-card">
          <strong>化肥库存</strong>
          <span>{simulation.fertilizerUsed ? '0 / 1 · 已用于粮食' : '1 / 1 · 仅能使用一次'}</span>
          <button
            disabled={simulation.fertilizerUsed}
            onClick={() => submit({ type: 'USE_FERTILIZER' })}
            type="button"
          >
            {simulation.fertilizerUsed ? '化肥已使用' : '使用化肥：粮食 +6'}
          </button>
        </div>
        <div className="management-action-card">
          <strong>粮食风险承诺</strong>
          <span>
            {foodForecast.status === '轻度缺口'
              ? '可主动接受；数学预测不会改变'
              : '只有轻度缺口可以主动接受'}
          </span>
          <button
            disabled={foodForecast.status !== '轻度缺口'}
            onClick={() =>
              submit({
                type: 'SET_FOOD_SHORTFALL_ACCEPTED',
                accepted: !foodForecast.acceptedRisk,
              })
            }
            type="button"
          >
            {foodForecast.acceptedRisk ? '撤回风险接受' : '接受轻度粮食缺口'}
          </button>
        </div>
      </section>

      <CharacterDecisionPanel simulation={simulation} />

      <ScheduleBoard
        currentWeekIndex={currentWeekIndex}
        key={`schedule-week-${currentWeek}`}
        simulation={simulation}
        submit={submit}
      />
        </>
      )}

      {latestBlockingEvent && !simulation.recap && (
        <section className="event-banner" role="alert">
          <div>
            <p className="eyebrow">周中事件 · 时钟已自动暂停</p>
            <h2>{latestBlockingEvent.title}</h2>
          </div>
          <p>{latestBlockingEvent.detail}</p>
        </section>
      )}

      {simulation.recap && (
        <section className="recap" aria-labelledby="recap-title">
          <p className="eyebrow">第 {simulation.recaps.length} 周结束</p>
          <h2 id="recap-title">周末偏差复盘 · 本周结算快照</h2>
          <div className="settlement-note" role="status">
            <strong>本周安排已完成并结算，不是被撤销</strong>
            <span>
              {simulation.isComplete
                ? '当前页面冻结为第二周结算快照；不会并列显示失效例外后的基础日程或下一周预测。'
                : '当前页面冻结为第一周结算快照；进入第二周后才显示继承的基础计划和新增例外。'}
            </span>
          </div>
          <p className="recap-headline">{simulation.recap.headline}</p>
          <div className="recap-numbers">
            <div><span>计划期末</span><strong>{formatRange(simulation.recap.planned)}</strong></div>
            <div><span>实际期末</span><strong>{simulation.recap.actual}</strong></div>
          </div>
          <ol className="recap-items">
            {simulation.recap.items.map((item) => (
              <li key={item.id}>
                <span className={`recap-category category-${item.category}`}>
                  {item.category}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <small>来源：{item.sourceId}</small>
                </div>
              </li>
            ))}
          </ol>
          {simulation.isComplete ? (
            <p className="recap-next-step">两周流程已完成，可以下载匿名 JSON 并结束会话。</p>
          ) : (
            <button
              className="recap-next-button"
              onClick={() => submit({ type: 'CONTINUE_TO_NEXT_WEEK' })}
              type="button"
            >
              确认复盘并进入第二周
            </button>
          )}
        </section>
      )}

      {simulation.timeline.length > 0 && (
        <section className="history" aria-labelledby="history-title">
          <h2 id="history-title">因果记录</h2>
          <ol>
            {simulation.timeline.map((entry) => (
              <li key={`${entry.kind}-${entry.id}`}>
                <span>{selectClockLabel({ ...simulation, currentTick: entry.atTick })}</span>
                <strong>{entry.title}</strong>
                <p>{entry.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="session-actions" aria-labelledby="session-actions-title">
        <div>
          <p className="eyebrow">匿名证据链</p>
          <h2 id="session-actions-title">导出或结束当前会话</h2>
          <p>
            JSON 只包含固定元数据、机器时长、动作、候选编辑组、领域事件和速度轨迹；
            有效编辑数由测试运营负责人另行裁定。
          </p>
          {lastExportedAtTick !== undefined && (
            <small role="status">
              {savedCaptureKind === 'blocked'
                ? `已保存并校验 tick ${lastExportedAtTick} 的阻断记录（非完整场次）。`
                : `已保存并校验 tick ${lastExportedAtTick} 的匿名记录。`}
            </small>
          )}
          {captureError && <small role="alert">{captureError}</small>}
          {!simulation.isComplete && (
            <>
              <label className="blocked-reason-field">
                <span>阻断原因</span>
                <textarea
                  disabled={blockedCaptureFrozen}
                  maxLength={MAX_BLOCKED_REASON_LENGTH}
                  onChange={(event) => setBlockedReason(event.target.value)}
                  placeholder="简要说明在当前状态下无法继续的可复现阻断"
                  rows={3}
                  value={blockedReason}
                />
                <small>
                  1–{MAX_BLOCKED_REASON_LENGTH} 字；阻断记录只保存当前未完成状态，
                  不代表已完成两周。
                </small>
              </label>
              {blockedCaptureFrozen && savedCaptureKind === undefined && (
                <small>阻断记录已冻结；保存失败时请重试，成功前不能清空。</small>
              )}
            </>
          )}
          {simulation.isComplete && savedCaptureKind === undefined && (
            <small>完整场次需先成功保存匿名记录，才能清空。</small>
          )}
        </div>
        <div className="session-action-buttons">
          <button
            disabled={
              !simulation.isComplete ||
              captureStatus === 'saving' ||
              savedCaptureKind !== undefined
            }
            onClick={() => captureSession('complete')}
            type="button"
          >
            下载匿名 JSON
          </button>
          {!simulation.isComplete && (
            <button
              disabled={
                captureStatus === 'saving' ||
                savedCaptureKind !== undefined ||
                (!blockedCaptureFrozen &&
                  (blockedReason.trim().length === 0 ||
                    blockedReason.trim().length >
                      MAX_BLOCKED_REASON_LENGTH))
              }
              onClick={() => captureSession('blocked')}
              type="button"
            >
              保存阻断记录
            </button>
          )}
          <button
            className="danger-button"
            disabled={savedCaptureKind === undefined}
            onClick={clearSession}
            type="button"
          >
            结束并清空会话
          </button>
        </div>
      </section>
    </main>
  )
}
