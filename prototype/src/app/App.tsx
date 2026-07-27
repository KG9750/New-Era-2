import { useEffect, useMemo, useRef, useState } from 'react'
import type { RcBuildMetadata } from '../build-metadata'
import { gate1WeekOneScenario as scenario } from '../scenario/gate1-week-one'
import { advanceSimulation, applyPlayerAction, createPlayerAction } from '../sim/engine'
import {
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
  hasPreventiveMaintenance,
  resolveScheduleBlock,
} from '../sim/schedule'
import { selectTransportRoute } from '../sim/transport'
import { weekIndexForTick } from '../sim/week-phase'
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
  PlaytestSessionMeta,
  SessionRecorder,
} from '../telemetry/session'
import { MapPanel } from './MapPanel'
import { ScheduleBoard } from './ScheduleBoard'
import { SessionGate } from './SessionGate'

type Speed = 1 | 3 | 8
type FocusedIssue = 'food' | 'pump' | 'repair' | 'transport' | 'lin-request' | null
type SupplyForecast = FoodForecast | RepairForecast

interface AppProps {
  buildMetadata: RcBuildMetadata
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

function SupplyForecastCard({ forecast }: { forecast: SupplyForecast }) {
  return (
    <section
      className="panel forecast-panel"
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

export function App({ buildMetadata }: AppProps) {
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
  const nextActionSequence = useRef(1)
  const recorderRef = useRef<SessionRecorder | null>(null)
  const pendingCaptureRef = useRef<PendingCapture | null>(null)
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
  const pumpPlanReady = hasPreventiveMaintenance(simulation)
  const transportRoute = selectTransportRoute(simulation)
  const latestBlockingEvent = simulation.isPaused
    ? [...simulation.timeline].reverse().find(
        (item) =>
          item.kind === 'scripted-event' &&
          item.atTick === simulation.currentTick &&
          !item.id.endsWith('-ended'),
      )
    : undefined
  const pumpIncidentResolved = simulation.processedScriptEventIds.includes(
    'pump-incident-day-3',
  )
  const pumpIssueStatus = pumpIncidentResolved
    ? simulation.pumpStatus === 'protected'
      ? '已兑现 · 检修奏效'
      : '已兑现 · 水泵停机'
    : pumpPlanReady
      ? '已安排 · 等待事件'
      : focusedIssue === 'pump'
        ? '已定位 · 待处理'
        : '定位安排 →'

  function submit(action: PlayerAction) {
    if (!recorderRef.current || blockedCaptureFrozen) return
    const undoOfActionId =
      action.type === 'UNDO_SCHEDULE'
        ? simulation.scheduleTransactions.at(-1)?.actionId
        : undefined
    const envelope = createPlayerAction(
      nextActionSequence.current,
      simulation.currentTick,
      action,
      undoOfActionId,
    )
    nextActionSequence.current += 1
    if (action.type === 'CONTINUE_TO_NEXT_WEEK') setFocusedIssue(null)
    const result = applyPlayerAction(simulation, envelope, scenario)
    recordPlayerTransition(recorderRef.current, simulation, envelope, result)
    setSimulation(result.state)
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

  function startSession(sampleId: string) {
    const state = initialState()
    const recorder = createSessionRecorder(sampleId, state, buildMetadata)
    recorderRef.current = recorder
    nextActionSequence.current = 1
    setSimulation(state)
    setSpeed(3)
    setFocusedIssue(null)
    setLastExportedAtTick(undefined)
    setCaptureStatus('idle')
    setCaptureError(undefined)
    setSavedCaptureKind(undefined)
    setBlockedReason('')
    setBlockedCaptureFrozen(false)
    pendingCaptureRef.current = null
    setActiveSession(recorder.meta)
    setWasSessionCleared(false)
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
    setSimulation(initialState())
    setSpeed(3)
    setFocusedIssue(null)
    setLastExportedAtTick(undefined)
    setCaptureStatus('idle')
    setCaptureError(undefined)
    setSavedCaptureKind(undefined)
    setBlockedReason('')
    setBlockedCaptureFrozen(false)
  }

  const canEditPumpPlan = simulation.currentTick < scenario.pumpEventTick

  if (!activeSession) {
    return (
      <SessionGate
        buildMetadata={buildMetadata}
        onStart={startSession}
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
          <button
            className={`issue-card ${focusedIssue === 'food' ? 'selected' : ''} ${foodForecast.acceptedRisk ? 'accepted' : ''}`}
            onClick={() => setFocusedIssue('food')}
            type="button"
          >
            <span className="issue-icon" aria-hidden="true">!</span>
            <span className="issue-copy">
              <strong>粮食预计{foodForecast.status}</strong>
              <span>期末库存 {formatRange(foodForecast.endingStock)}；可以补产能，也可以明确承担轻度缺口。</span>
              <small>{foodForecast.acceptedRisk ? '已接受风险，不再作为未处理错误' : '影响：粮食、化肥与共享劳动力'}</small>
            </span>
            <span className="issue-action">
              {foodForecast.acceptedRisk
                ? '已接受 · 风险保留'
                : focusedIssue === 'food'
                  ? '已定位 · 待决定'
                  : '查看原因 →'}
            </span>
          </button>
          <button
            className={`issue-card ${focusedIssue === 'pump' ? 'selected' : ''} ${pumpPlanReady ? 'resolved' : ''}`}
            onClick={() => setFocusedIssue('pump')}
            type="button"
          >
            <span className="issue-icon" aria-hidden="true">!</span>
            <span className="issue-copy">
              <strong>
                {pumpPlanReady
                  ? '水泵检修已安排 2 个维修块'
                  : '水泵需要 2 个预防性维修块'}
              </strong>
              <span>
                {pumpPlanReady
                  ? '乔磐与林禾已各排 1 块；周三前的已知停机下探已从预测区间移除。'
                  : '乔磐已排 1 块；周三前再补 1 块，否则粮食下探会成为严重短缺。'}
              </span>
              <small>
                {pumpPlanReady
                  ? '已安排 · 影响：粮食与维修保障'
                  : '影响：乔磐、林禾 · 周二 · 粮食与维修保障'}
              </small>
            </span>
            <span className="issue-action">
              {pumpIssueStatus}
            </span>
          </button>
          <button
            className={`issue-card ${focusedIssue === 'repair' ? 'selected' : ''}`}
            onClick={() => setFocusedIssue('repair')}
            type="button"
          >
            <span className="issue-icon" aria-hidden="true">!</span>
            <span className="issue-copy">
              <strong>维修保障处于{repairForecast.status}</strong>
              <span>期末库存 {formatRange(repairForecast.endingStock)}；把人调去维修会挤占粮食或物流。</span>
              <small>影响：乔磐效率、维修工坊与共享劳动力</small>
            </span>
            <span className="issue-action">
              {focusedIssue === 'repair' ? '已定位 · 待权衡' : '查看原因 →'}
            </span>
          </button>
            </>
          ) : (
            <>
              <button
                className={`issue-card ${focusedIssue === 'lin-request' ? 'selected' : ''} ${simulation.linHeRequestDecision !== 'pending' ? 'resolved' : ''}`}
                onClick={() => setFocusedIssue('lin-request')}
                type="button"
              >
                <span className="issue-icon" aria-hidden="true">人</span>
                <span className="issue-copy">
                  <strong>林禾请求周二 B1 学习</strong>
                  <span>
                    接受会让本周粮食产出 −2；拒绝或逾期会写入不同人物记录。
                  </span>
                  <small>
                    {simulation.linHeRequestDecision === 'pending'
                      ? '新增例外 · 周二 B1 前答复'
                      : `已${simulation.linHeRequestDecision === 'accepted' ? '接受' : '拒绝'} · 目标块已锁定`}
                  </small>
                </span>
                <span className="issue-action">
                  {simulation.linHeRequestDecision === 'accepted'
                    ? '已接受 · 已锁定'
                    : simulation.linHeRequestDecision === 'declined'
                      ? '已拒绝 · 保留农务'
                      : focusedIssue === 'lin-request'
                        ? '已定位 · 待答复'
                        : '处理请求 →'}
                </span>
              </button>
              <button
                className="issue-card"
                onClick={() => setFocusedIssue('food')}
                type="button"
              >
                <span className="issue-icon" aria-hidden="true">+</span>
                <span className="issue-copy">
                  <strong>
                    {fertilizerUsedWeek === 1
                      ? '化肥已在第一周使用'
                      : fertilizerUsedWeek === 2
                        ? '化肥已在第二周使用'
                        : '化肥仍有一次机会'}
                  </strong>
                  <span>
                    {fertilizerUsedWeek === 1
                      ? '第二周没有额外化肥可补粮。'
                      : fertilizerUsedWeek === 2
                        ? '本周已使用化肥，库存为 0。'
                        : '可用粮食 +6 弥补学习或已知缺口。'}
                  </span>
                  <small>新增例外 · 只影响粮食，不改变维修保障</small>
                </span>
                <span className="issue-action">查看资源 →</span>
              </button>
              <button
                className={`issue-card ${focusedIssue === 'transport' ? 'selected' : ''} ${transportRoute.id === 'south-shortcut' ? 'resolved' : ''}`}
                onClick={() => setFocusedIssue('transport')}
                type="button"
              >
                <span className="issue-icon" aria-hidden="true">路</span>
                <span className="issue-copy">
                  <strong>
                    {transportRoute.id === 'south-shortcut'
                      ? '南侧短通路已继承'
                      : '北侧长路仍造成运输损耗'}
                  </strong>
                  <span>
                    当前 {transportRoute.distanceMeters} 米 / {transportRoute.travelMinutes} 分钟，
                    粮食损耗 {transportRoute.foodLoss}。
                  </span>
                  <small>
                    {transportRoute.id === 'south-shortcut'
                      ? '继承结果 · 无需重复设置'
                      : '本周首次运输前仍可调整'}
                  </small>
                </span>
                <span className="issue-action">
                  {transportRoute.id === 'south-shortcut'
                    ? '已调整 · 已继承'
                    : focusedIssue === 'transport'
                      ? '已定位 · 待决定'
                      : '查看地图 →'}
                </span>
              </button>
            </>
          )}
        </div>
      </section>

      <div className="workspace-grid">
        <section
          className={`panel schedule-panel ${
            focusedIssue === 'pump' ||
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
                {currentWeek === 1 ? '林禾 · 周二 B2' : '林禾 · 周二 B1'}
              </h2>
            </div>
            <span className="skill-chip">
              {currentWeek === 1
                ? `${ACTIVITY_LABELS[pumpBlock.activity]} · ${pumpBlock.source}`
                : '新增请求'}
            </span>
          </div>
          <p className="block-time">
            {currentWeek === 1
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
                点击“林禾请求周二 B1 学习”，只处理这个新增例外。
              </p>
            ) : (
              <div className="activity-editor">
                <p>“我想用这一块学习。眼前会少 2 份粮食产出。”</p>
                <div className="request-actions">
                  <button
                    onClick={() =>
                      submit({ type: 'RESOLVE_LIN_HE_REQUEST', decision: 'accepted' })
                    }
                    type="button"
                  >
                    接受学习请求
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      submit({ type: 'RESOLVE_LIN_HE_REQUEST', decision: 'declined' })
                    }
                    type="button"
                  >
                    拒绝并保留农务
                  </button>
                </div>
                <small>决定后目标块锁定，不能再用普通日程编辑覆盖。</small>
              </div>
            )
          ) : focusedIssue !== 'pump' ? (
            <p className="empty-prompt">
              点击“水泵需要 2 个预防性维修块”，定位缺少的检修块。
            </p>
          ) : (
            <div className="activity-editor">
              <p>乔磐已有 1 块。为林禾选择第二块：</p>
              <div className="activity-options" role="group" aria-label="活动选择">
                <button
                  aria-pressed={
                    resolveScheduleBlock(simulation, PUMP_MAINTENANCE_BLOCK_ID).activity ===
                    'rest'
                  }
                  disabled={!canEditPumpPlan}
                  onClick={() => submit({ type: 'CHANGE_ACTIVITY', activity: 'rest' })}
                  type="button"
                >
                  <span aria-hidden="true">☕</span>
                  保留休息
                </button>
                <button
                  aria-pressed={
                    resolveScheduleBlock(simulation, PUMP_MAINTENANCE_BLOCK_ID).activity ===
                    'repair'
                  }
                  disabled={!canEditPumpPlan}
                  onClick={() => submit({ type: 'CHANGE_ACTIVITY', activity: 'repair' })}
                  type="button"
                >
                  <span aria-hidden="true">◆</span>
                  补足第 2 个检修块
                </button>
              </div>
              <small>
                人物与设施联动：林禾的维修效率低于乔磐，且这块会进入共享劳动力总额。
              </small>
              {!canEditPumpPlan && <small>水泵事件已发生，过去的预防性安排不能追溯修改。</small>}
            </div>
          )}
        </section>

        <div className="supply-stack">
          <SupplyForecastCard forecast={foodForecast} />
          <SupplyForecastCard forecast={repairForecast} />
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
