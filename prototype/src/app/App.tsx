import { useEffect, useMemo, useRef, useState } from 'react'
import { gate1WeekOneScenario as scenario } from '../scenario/gate1-week-one'
import { advanceSimulation, applyPlayerAction, createPlayerAction } from '../sim/engine'
import {
  calculateFoodForecast,
  calculateRepairForecast,
  formatRange,
} from '../sim/forecast'
import type {
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
import { createPlaytestExport } from '../telemetry/export'
import {
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

function initialState(): SimulationState {
  return scenario.createInitialState()
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
    (simulation.completedWeekIndexes.includes(0) && simulation.recap === null) ||
    simulation.currentTick >= 144 * 7
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

export function App() {
  const [simulation, setSimulation] = useState(initialState)
  const [speed, setSpeed] = useState<Speed>(3)
  const [focusedIssue, setFocusedIssue] = useState<FocusedIssue>(null)
  const [activeSession, setActiveSession] = useState<PlaytestSessionMeta | null>(null)
  const [wasSessionCleared, setWasSessionCleared] = useState(false)
  const [lastExportedAtTick, setLastExportedAtTick] = useState<number>()
  const nextActionSequence = useRef(1)
  const recorderRef = useRef<SessionRecorder | null>(null)
  const downloadUrlRef = useRef<string | null>(null)
  const foodForecast = useMemo(() => calculateFoodForecast(simulation), [simulation])
  const repairForecast = useMemo(() => calculateRepairForecast(simulation), [simulation])
  const progress = selectProgress(simulation, scenario)
  const currentWeek =
    (simulation.completedWeekIndexes.includes(0) && simulation.recap === null) ||
    simulation.currentTick >= 144 * 7
      ? 2
      : 1
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

  function submit(action: PlayerAction) {
    if (!recorderRef.current) return
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
    if (!activeSession || simulation.isPaused || simulation.recap) return
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
  }, [activeSession, simulation.isPaused, simulation.recap, speed])

  useEffect(
    () => () => {
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current)
    },
    [],
  )

  function startSession(sampleId: string) {
    const state = initialState()
    const recorder = createSessionRecorder(sampleId, state)
    recorderRef.current = recorder
    nextActionSequence.current = 1
    setSimulation(state)
    setSpeed(3)
    setFocusedIssue(null)
    setLastExportedAtTick(undefined)
    setActiveSession(recorder.meta)
    setWasSessionCleared(false)
  }

  function changeSpeed(value: Speed) {
    if (recorderRef.current && speed !== value) {
      recordSpeedChange(recorderRef.current, simulation.currentTick, value)
    }
    setSpeed(value)
  }

  function exportSession() {
    if (!recorderRef.current || !activeSession) return
    recordExportCreated(recorderRef.current, simulation.currentTick)
    const payload = createPlaytestExport(recorderRef.current, simulation)
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current)
    const url = URL.createObjectURL(blob)
    downloadUrlRef.current = url
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${activeSession.buildId}-${activeSession.sampleId}-${activeSession.sessionId}.json`
    anchor.click()
    setLastExportedAtTick(simulation.currentTick)
  }

  function clearSession() {
    if (!activeSession) return
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current)
      downloadUrlRef.current = null
    }
    recorderRef.current = null
    nextActionSequence.current = 1
    setWasSessionCleared(true)
    setActiveSession(null)
    setSimulation(initialState())
    setSpeed(3)
    setFocusedIssue(null)
    setLastExportedAtTick(undefined)
  }

  const canEditPumpPlan = simulation.currentTick < scenario.pumpEventTick

  if (!activeSession) {
    return (
      <SessionGate
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
                key={value}
                onClick={() => changeSpeed(value)}
                type="button"
              >
                {value}×
              </button>
            ))}
            <button
              className="play-button"
              disabled={simulation.isComplete}
              onClick={() =>
                simulation.recap && !simulation.isComplete
                  ? submit({ type: 'CONTINUE_TO_NEXT_WEEK' })
                  : submit({ type: 'SET_PAUSED', paused: !simulation.isPaused })
              }
              type="button"
            >
              {simulation.isPaused
                ? simulation.recap && !simulation.isComplete
                  ? '进入第二周'
                  : latestBlockingEvent
                    ? '确认后继续'
                    : '开始运行'
                : '暂停'}
            </button>
          </div>
        </div>
        <div className="progress-track" aria-label={`两周进度 ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="session-meta-strip" aria-label="当前测试会话元数据">
        <div><span>匿名编号</span><strong>{activeSession.sampleId}</strong></div>
        <div><span>构建</span><strong>{activeSession.buildId}</strong></div>
        <div><span>场景</span><strong>{activeSession.scenarioVersion}</strong></div>
        <div><span>种子</span><strong>{activeSession.fixedSeed}</strong></div>
        <div><span>Session</span><strong>{activeSession.sessionId}</strong></div>
      </section>

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
              {focusedIssue === 'food' ? '已定位' : '查看原因 →'}
            </span>
          </button>
          <button
            className={`issue-card ${focusedIssue === 'pump' ? 'selected' : ''} ${pumpPlanReady ? 'resolved' : ''}`}
            onClick={() => setFocusedIssue('pump')}
            type="button"
          >
            <span className="issue-icon" aria-hidden="true">!</span>
            <span className="issue-copy">
              <strong>水泵需要 2 个预防性维修块</strong>
              <span>
                乔磐已排 1 块；周三前再补 1 块，否则粮食下探会成为严重短缺。
              </span>
              <small>影响：乔磐、林禾 · 周二 · 粮食与维修保障</small>
            </span>
            <span className="issue-action">
              {focusedIssue === 'pump' ? '已定位' : '定位安排 →'}
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
              {focusedIssue === 'repair' ? '已定位' : '查看原因 →'}
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
                  {focusedIssue === 'lin-request' ? '已定位' : '处理请求 →'}
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
                    {simulation.fertilizerUsed ? '化肥已在第一周使用' : '化肥仍有一次机会'}
                  </strong>
                  <span>
                    {simulation.fertilizerUsed
                      ? '第二周没有额外化肥可补粮。'
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
                  {focusedIssue === 'transport' ? '已定位' : '查看地图 →'}
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
              {currentWeek === 1 ? '农务' : '新增请求'}
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
        currentWeekIndex={currentWeek === 1 ? 0 : 1}
        key={`schedule-week-${currentWeek}`}
        simulation={simulation}
        submit={submit}
      />

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
          <h2 id="recap-title">周末偏差复盘</h2>
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
              已导出 tick {lastExportedAtTick} 的匿名记录。
            </small>
          )}
        </div>
        <div className="session-action-buttons">
          <button onClick={exportSession} type="button">
            下载匿名 JSON
          </button>
          <button
            className="danger-button"
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
