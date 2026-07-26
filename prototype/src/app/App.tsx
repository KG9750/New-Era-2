import { useEffect, useMemo, useRef, useState } from 'react'
import { gate1WeekOneScenario as scenario } from '../scenario/gate1-week-one'
import { advanceSimulation, applyPlayerAction, createPlayerAction } from '../sim/engine'
import { calculateFoodForecast, formatRange } from '../sim/forecast'
import type { PlayerAction, SimulationState } from '../sim/model'
import { selectClockLabel, selectProgress } from '../sim/selectors'

type Speed = 1 | 3 | 8

function initialState(): SimulationState {
  return scenario.createInitialState()
}

export function App() {
  const [simulation, setSimulation] = useState(initialState)
  const [speed, setSpeed] = useState<Speed>(3)
  const [isFocused, setIsFocused] = useState(false)
  const nextActionSequence = useRef(1)
  const forecast = useMemo(() => calculateFoodForecast(simulation), [simulation])
  const progress = selectProgress(simulation, scenario)
  const pumpHandled = simulation.processedScriptEventIds.includes('pump-incident-day-3')

  function submit(action: PlayerAction) {
    const envelope = createPlayerAction(
      nextActionSequence.current,
      simulation.currentTick,
      action,
    )
    nextActionSequence.current += 1
    setSimulation((current) => applyPlayerAction(current, envelope, scenario).state)
  }

  useEffect(() => {
    if (simulation.isPaused || simulation.recap) return
    const timer = window.setInterval(() => {
      setSimulation((current) => {
        if (current.isPaused || current.recap) return current
        return advanceSimulation(current, current.currentTick + speed, scenario).state
      })
    }, 250)
    return () => window.clearInterval(timer)
  }, [simulation.isPaused, simulation.recap, speed])

  const canEdit = simulation.currentTick < scenario.pumpEventTick

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Gate 1 · 第一周</p>
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
                onClick={() => setSpeed(value)}
                type="button"
              >
                {value}×
              </button>
            ))}
            <button
              className="play-button"
              disabled={Boolean(simulation.recap)}
              onClick={() => submit({ type: 'SET_PAUSED', paused: !simulation.isPaused })}
              type="button"
            >
              {simulation.isPaused ? (pumpHandled ? '查看后继续' : '开始运行') : '暂停'}
            </button>
          </div>
        </div>
        <div className="progress-track" aria-label={`本周进度 ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="briefing" aria-labelledby="briefing-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">周初摘要</p>
            <h2 id="briefing-title">本周先处理这一件事</h2>
          </div>
          <span className="count-chip">1 个已知风险</span>
        </div>
        <button
          className={`issue-card ${isFocused ? 'selected' : ''}`}
          onClick={() => setIsFocused(true)}
          type="button"
        >
          <span className="issue-icon" aria-hidden="true">!</span>
          <span className="issue-copy">
            <strong>水泵需要预防性检修</strong>
            <span>
              周三 09:00 前不处理，粮食期末库存可能从 11 下探至 3。
            </span>
            <small>影响：林禾 · 周二午后 · 粮食预测</small>
          </span>
          <span className="issue-action">{isFocused ? '已定位' : '定位安排 →'}</span>
        </button>
      </section>

      <div className="workspace-grid">
        <section
          className={`panel schedule-panel ${isFocused ? 'focused-panel' : ''}`}
          aria-labelledby="schedule-title"
        >
          <div className="panel-title">
            <div>
              <p className="eyebrow">成员安排</p>
              <h2 id="schedule-title">林禾 · 周二 B2</h2>
            </div>
            <span className="skill-chip">农务</span>
          </div>
          <p className="block-time">13:00–16:00 · 本周一次性安排</p>
          {!isFocused ? (
            <p className="empty-prompt">点击上方问题卡，定位受影响的活动块。</p>
          ) : (
            <div className="activity-editor">
              <p>选择这个活动块：</p>
              <div className="activity-options" role="group" aria-label="活动选择">
                <button
                  aria-pressed={simulation.activity === 'rest'}
                  disabled={!canEdit}
                  onClick={() => submit({ type: 'CHANGE_ACTIVITY', activity: 'rest' })}
                  type="button"
                >
                  <span aria-hidden="true">☕</span>
                  保留休息
                </button>
                <button
                  aria-pressed={simulation.activity === 'repair'}
                  disabled={!canEdit}
                  onClick={() => submit({ type: 'CHANGE_ACTIVITY', activity: 'repair' })}
                  type="button"
                >
                  <span aria-hidden="true">◆</span>
                  检修水泵
                </button>
              </div>
              {!canEdit && <small>水泵事件已发生，这个预防性安排不再可改。</small>}
            </div>
          )}
        </section>

        <section className="panel forecast-panel" aria-labelledby="forecast-title">
          <div className="panel-title">
            <div>
              <p className="eyebrow">聚落供需推演</p>
              <h2 id="forecast-title">粮食</h2>
            </div>
            <span className={`status-chip status-${forecast.trend}`}>{forecast.status}</span>
          </div>
          <div className="forecast-number" aria-live="polite">
            <span>预计期末库存</span>
            <strong>{formatRange(forecast.endingStock)}</strong>
            <small>趋势：{forecast.trend}</small>
          </div>
          <dl className="forecast-formula">
            <div><dt>当前库存</dt><dd>{forecast.currentStock}</dd></div>
            <div><dt>计划产出</dt><dd>+{formatRange(forecast.production)}</dd></div>
            <div><dt>已知消费</dt><dd>−{forecast.consumption}</dd></div>
          </dl>
          <div className="explanation" aria-live="polite">
            <strong>为什么是这个结果？</strong>
            <ul>
              {forecast.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
        </section>
      </div>

      {pumpHandled && !simulation.recap && (
        <section className="event-banner" role="alert">
          <div>
            <p className="eyebrow">周中事件 · 时钟已自动暂停</p>
            <h2>
              {simulation.pumpStatus === 'protected'
                ? '水泵异常，预防性检修奏效'
                : '水泵故障并停机'}
            </h2>
          </div>
          <p>{simulation.timeline.find((item) => item.id === 'pump-incident-day-3')?.detail}</p>
        </section>
      )}

      {simulation.recap && (
        <section className="recap" aria-labelledby="recap-title">
          <p className="eyebrow">第一周结束</p>
          <h2 id="recap-title">周末偏差复盘</h2>
          <p className="recap-headline">{simulation.recap.headline}</p>
          <div className="recap-numbers">
            <div><span>计划期末</span><strong>{formatRange(simulation.recap.planned)}</strong></div>
            <div><span>实际期末</span><strong>{simulation.recap.actual}</strong></div>
          </div>
          <ol>
            {simulation.recap.items.map((item) => <li key={item}>{item}</li>)}
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
    </main>
  )
}
