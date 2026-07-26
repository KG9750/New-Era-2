import { useState } from 'react'
import type {
  Activity,
  CharacterId,
  PlayerAction,
  ScheduleScope,
  SimulationState,
} from '../sim/model'
import {
  BLOCK_LABELS,
  CHARACTERS,
  DAY_LABELS,
  blockEndTick,
  createBlockId,
  findQiaoPanBoundaryWarning,
  resolveScheduleBlock,
} from '../sim/schedule'

const ACTIVITY_LABELS: Record<Activity, string> = {
  food: '农务',
  repair: '维修',
  logistics: '物流',
  study: '学习',
  rest: '休息',
  social: '社交',
}

interface ScheduleBoardProps {
  simulation: SimulationState
  submit(action: PlayerAction): void
}

export function ScheduleBoard({ simulation, submit }: ScheduleBoardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [weekIndex, setWeekIndex] = useState<0 | 1>(0)
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  const [activity, setActivity] = useState<Activity>('rest')
  const [scope, setScope] = useState<ScheduleScope>('weekly')
  const [copyCharacter, setCopyCharacter] = useState<CharacterId>('lin-he')
  const [sourceDayOffset, setSourceDayOffset] = useState(0)
  const [targetDayOffset, setTargetDayOffset] = useState(1)

  const firstDay = weekIndex * 7
  const editAction: Extract<PlayerAction, { type: 'EDIT_SCHEDULE' }> = {
    type: 'EDIT_SCHEDULE',
    blockIds: selectedIds,
    activity,
    scope,
  }
  const editBoundaryWarning =
    selectedIds.length > 0 ? findQiaoPanBoundaryWarning(simulation, editAction) : null
  const copyAction: Extract<PlayerAction, { type: 'COPY_DAY' }> = {
    type: 'COPY_DAY',
    characterId: copyCharacter,
    sourceDayIndex: firstDay + sourceDayOffset,
    targetDayIndex: firstDay + targetDayOffset,
    scope,
  }
  const copyBoundaryWarning =
    sourceDayOffset === targetDayOffset
      ? null
      : findQiaoPanBoundaryWarning(simulation, copyAction)
  const copyTargetsPast = [0, 1, 2, 3].some(
    (blockIndex) =>
      blockEndTick(
        createBlockId(copyCharacter, firstDay + targetDayOffset, blockIndex),
      ) <= simulation.currentTick,
  )

  function toggleBlock(blockId: string) {
    setSelectedIds((current) =>
      current.includes(blockId)
        ? current.filter((id) => id !== blockId)
        : [...current, blockId],
    )
  }

  function applyEdit() {
    if (selectedIds.length === 0 || editBoundaryWarning) return
    submit(editAction)
    setSelectedIds([])
  }

  function copyDay() {
    if (copyBoundaryWarning) return
    submit(copyAction)
  }

  if (!isExpanded) {
    return (
      <section className="schedule-disclosure" aria-label="完整周计划入口">
        <div>
          <p className="eyebrow">按需展开</p>
          <h2>四人十四日日程</h2>
          <p>摘要足够时无需逐格检查；需要统一排班时再展开每周 112 格。</p>
        </div>
        <button onClick={() => setIsExpanded(true)} type="button">
          展开完整周计划
        </button>
      </section>
    )
  }

  return (
    <section className="full-schedule" aria-labelledby="full-schedule-title">
      <div className="schedule-heading">
        <div>
          <p className="eyebrow">完整计划 · 每周 112 格</p>
          <h2 id="full-schedule-title">四名成员 · 连续十四日</h2>
        </div>
        <div className="schedule-tabs" role="tablist" aria-label="计划周">
          {([0, 1] as const).map((index) => (
            <button
              aria-selected={weekIndex === index}
              className={weekIndex === index ? 'active' : ''}
              key={index}
              onClick={() => {
                setWeekIndex(index)
                setSelectedIds([])
              }}
              role="tab"
              type="button"
            >
              第 {index + 1} 周
            </button>
          ))}
          <button className="close-schedule" onClick={() => setIsExpanded(false)} type="button">
            收起
          </button>
        </div>
      </div>

      <div className="edit-toolbar">
        <div className="selection-summary">
          <strong>{selectedIds.length > 0 ? `已选 ${selectedIds.length} 格` : '选择一个或多个活动块'}</strong>
          <span>批量确认只生成一个动作 ID</span>
        </div>
        <label>
          活动
          <select
            aria-label="批量活动"
            onChange={(event) => setActivity(event.target.value as Activity)}
            value={activity}
          >
            {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          生效范围
          <select
            aria-label="生效范围"
            onChange={(event) => setScope(event.target.value as ScheduleScope)}
            value={scope}
          >
            <option value="weekly">本周例外（默认）</option>
            <option value="immediate">即时调整</option>
            <option value="base">设为后续基础计划</option>
          </select>
        </label>
        <button
          disabled={selectedIds.length === 0 || editBoundaryWarning !== null}
          onClick={applyEdit}
          type="button"
        >
          {editBoundaryWarning
            ? '先调整红线冲突'
            : selectedIds.length > 1
              ? `批量修改 ${selectedIds.length} 格`
              : '修改所选格'}
        </button>
        <button
          className="secondary-button"
          disabled={simulation.scheduleTransactions.length === 0}
          onClick={() => submit({ type: 'UNDO_SCHEDULE' })}
          type="button"
        >
          撤销上次日程修改
        </button>
      </div>

      <p className="overtime-note">
        B4（20:00–23:00）安排工作视为加班；乔磐只接受连续两日短期加班。
      </p>
      {editBoundaryWarning && (
        <div className="boundary-warning" role="alert">
          <strong>乔磐红线预警</strong>
          <span>{editBoundaryWarning.message}</span>
        </div>
      )}

      <div className="schedule-table" role="grid" aria-label={`第 ${weekIndex + 1} 周完整计划`}>
        {CHARACTERS.map((character) => (
          <div className="character-row" key={character.id} role="row">
            <div className="character-label" role="rowheader">
              <strong>{character.name}</strong>
              <span>{character.skill}</span>
            </div>
            {Array.from({ length: 7 }, (_, dayOffset) => {
              const dayIndex = firstDay + dayOffset
              return (
                <div className="day-column" key={dayIndex}>
                  <span className="day-label">{DAY_LABELS[dayIndex]}</span>
                  {Array.from({ length: 4 }, (_, blockIndex) => {
                    const blockId = createBlockId(character.id, dayIndex, blockIndex)
                    const block = resolveScheduleBlock(simulation, blockId)
                    const selected = selectedIds.includes(blockId)
                    const isPast = blockEndTick(blockId) <= simulation.currentTick
                    return (
                      <button
                        aria-label={`${character.name} ${DAY_LABELS[dayIndex]} ${BLOCK_LABELS[blockIndex]} ${ACTIVITY_LABELS[block.activity]} ${block.source}${isPast ? ' 已执行' : ''}`}
                        aria-pressed={selected}
                        className={`schedule-block activity-${block.activity} ${selected ? 'selected' : ''}`}
                        disabled={isPast}
                        key={blockId}
                        onClick={() => toggleBlock(blockId)}
                        role="gridcell"
                        type="button"
                      >
                        <span>{BLOCK_LABELS[blockIndex].slice(0, 2)}</span>
                        <strong>{ACTIVITY_LABELS[block.activity]}</strong>
                        <small>{block.source}</small>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="copy-toolbar">
        <strong>复制单日</strong>
        <label>
          成员
          <select
            aria-label="复制成员"
            onChange={(event) => setCopyCharacter(event.target.value as CharacterId)}
            value={copyCharacter}
          >
            {CHARACTERS.map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </label>
        <label>
          从
          <select
            aria-label="复制来源日"
            onChange={(event) => setSourceDayOffset(Number(event.target.value))}
            value={sourceDayOffset}
          >
            {Array.from({ length: 7 }, (_, index) => (
              <option key={index} value={index}>{DAY_LABELS[firstDay + index]}</option>
            ))}
          </select>
        </label>
        <label>
          到
          <select
            aria-label="复制目标日"
            onChange={(event) => setTargetDayOffset(Number(event.target.value))}
            value={targetDayOffset}
          >
            {Array.from({ length: 7 }, (_, index) => (
              <option key={index} value={index}>{DAY_LABELS[firstDay + index]}</option>
            ))}
          </select>
        </label>
        <button
          disabled={
            sourceDayOffset === targetDayOffset ||
            copyBoundaryWarning !== null ||
            copyTargetsPast
          }
          onClick={copyDay}
          type="button"
        >
          {copyBoundaryWarning ? '复制会触发红线' : '复制这一天'}
        </button>
      </div>
      {copyBoundaryWarning && (
        <div className="boundary-warning compact" role="alert">
          <strong>复制前预警</strong>
          <span>{copyBoundaryWarning.message}</span>
        </div>
      )}
    </section>
  )
}
