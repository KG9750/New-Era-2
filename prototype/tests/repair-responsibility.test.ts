import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import {
  advanceSimulation,
  applyPlayerAction,
  createPlayerAction,
} from '../src/sim/engine'
import {
  calculateFoodForecast,
  calculateRepairForecast,
} from '../src/sim/forecast'
import type { PlayerAction, SimulationState } from '../src/sim/model'
import { blockEndTick, createBlockId } from '../src/sim/schedule'

function act(
  state: SimulationState,
  sequence: number,
  action: PlayerAction,
): SimulationState {
  return applyPlayerAction(
    state,
    createPlayerAction(sequence, state.currentTick, action),
    scenario,
  ).state
}

function completeTwoWeeks(state: SimulationState): SimulationState {
  let next = advanceSimulation(state, scenario.pumpEventTick, scenario).state
  next = advanceSimulation(next, scenario.weekEndTick, scenario).state
  next = act(next, next.actionLog.length + 1, {
    type: 'CONTINUE_TO_NEXT_WEEK',
  })
  next = advanceSimulation(
    next,
    scenario.linHeRequestDeadlineTick,
    scenario,
  ).state
  return advanceSimulation(next, scenario.simulationEndTick, scenario).state
}

describe('RC9 repair responsibility', () => {
  it('keeps a personnel direction non-numeric until a schedule is confirmed', () => {
    const initial = scenario.createInitialState()
    const foodBefore = calculateFoodForecast(initial)
    const repairBefore = calculateRepairForecast(initial)
    const selected = act(initial, 1, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'handoff',
    })

    expect(selected.repairResponsibilitySelection).toBe('handoff')
    expect(selected.repairResponsibility).toBe('unresolved')
    expect(selected.repairResponsibilityAssignment).toBeNull()
    expect(selected.scheduleTransactions).toEqual([])
    expect(selected.characterRecords).toEqual(initial.characterRecords)
    expect(calculateFoodForecast(selected)).toEqual(foodBefore)
    expect(calculateRepairForecast(selected)).toEqual(repairBefore)
  })

  it('commits either handoff implementation through a real schedule transaction', () => {
    const initial = scenario.createInitialState()
    const selected = act(initial, 1, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'handoff',
    })
    const repairBefore = calculateRepairForecast(selected)
    const outcomes: Array<{
      food: number
      repair: number
      load: number
    }> = []

    for (const actorId of ['chen-du', 'su-ji'] as const) {
      const blockId = createBlockId(actorId, 3, 0)
      const characterLoadCost = actorId === 'chen-du' ? 2 : 1
      const scheduled = act(selected, 2, {
        type: 'EDIT_SCHEDULE',
        blockIds: [blockId],
        activity: 'repair',
        scope: 'weekly',
      })

      expect(scheduled.scheduleTransactions.at(-1)).toMatchObject({
        actionId: 'action-0002',
        affectedBlockIds: [blockId],
      })
      expect(scheduled.repairResponsibility).toBe('scheduled')
      expect(scheduled.repairResponsibilityAssignment).toEqual({
        actionId: 'action-0002',
        weekIndex: 0,
        actorId,
        blockId,
        characterLoadCost,
        repairOutputDelta: 1,
      })
      expect(calculateRepairForecast(scheduled).endingStock.high).toBeGreaterThan(
        repairBefore.endingStock.high,
      )
      expect(calculateRepairForecast(scheduled).reasons.join(' ')).toContain(
        '维修责任兑现 +1',
      )
      expect(scheduled.characterRecords[actorId].at(-1)).toContain(
        '接手水泵维修',
      )
      const completed = completeTwoWeeks(scheduled)
      expect(completed.isComplete).toBe(true)
      expect(
        completed.recaps[0].items.find(
          (item) => item.sourceId === 'repair-responsibility',
        )?.title,
      ).toContain(actorId === 'chen-du' ? '陈渡' : '苏霁')
      outcomes.push({
        food: calculateFoodForecast(scheduled).endingStock.high,
        repair: calculateRepairForecast(scheduled).endingStock.high,
        load:
          scheduled.repairResponsibilityAssignment?.characterLoadCost ??
          Number.POSITIVE_INFINITY,
      })
    }
    const dominates = (
      left: (typeof outcomes)[number],
      right: (typeof outcomes)[number],
    ) =>
      left.food >= right.food &&
      left.repair >= right.repair &&
      left.load <= right.load &&
      (left.food > right.food ||
        left.repair > right.repair ||
        left.load < right.load)
    expect(dominates(outcomes[0], outcomes[1])).toBe(false)
    expect(dominates(outcomes[1], outcomes[0])).toBe(false)
  })

  it('removes the responsibility outcome when its schedule transaction is undone', () => {
    const initial = scenario.createInitialState()
    const selected = act(initial, 1, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'handoff',
    })
    const blockId = createBlockId('chen-du', 3, 0)
    const scheduled = act(selected, 2, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'repair',
      scope: 'weekly',
    })
    const undone = applyPlayerAction(
      scheduled,
      createPlayerAction(
        3,
        scheduled.currentTick,
        { type: 'UNDO_SCHEDULE' },
        'action-0002',
      ),
      scenario,
    ).state

    expect(undone.repairResponsibility).toBe('unresolved')
    expect(undone.repairResponsibilityAssignment).toBeNull()
    expect(calculateRepairForecast(undone)).toEqual(
      calculateRepairForecast(selected),
    )
    expect(undone.characterRecords['chen-du']).toEqual(
      selected.characterRecords['chen-du'],
    )
  })

  it('removes the responsibility outcome when its confirmed block is reassigned', () => {
    const initial = scenario.createInitialState()
    const selected = act(initial, 1, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'handoff',
    })
    const blockId = createBlockId('chen-du', 3, 0)
    const scheduled = act(selected, 2, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'repair',
      scope: 'weekly',
    })
    const reassigned = act(scheduled, 3, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'food',
      scope: 'weekly',
    })

    expect(reassigned.repairResponsibility).toBe('unresolved')
    expect(reassigned.repairResponsibilityAssignment).toBeNull()
    expect(reassigned.characterRecords['chen-du']).toEqual(
      selected.characterRecords['chen-du'],
    )
    expect(calculateRepairForecast(reassigned).reasons.join(' ')).toContain(
      '维修责任兑现 +0',
    )
  })

  it('restores the responsibility outcome when the reassignment is undone', () => {
    const selected = act(scenario.createInitialState(), 1, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'handoff',
    })
    const blockId = createBlockId('chen-du', 3, 0)
    const confirmed = act(selected, 2, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'repair',
      scope: 'weekly',
    })
    const reassigned = act(confirmed, 3, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'food',
      scope: 'weekly',
    })
    const restored = applyPlayerAction(
      reassigned,
      createPlayerAction(
        4,
        reassigned.currentTick,
        { type: 'UNDO_SCHEDULE' },
        'action-0003',
      ),
      scenario,
    ).state

    expect(restored.repairResponsibility).toBe(
      confirmed.repairResponsibility,
    )
    expect(restored.repairResponsibilityAssignment).toEqual(
      confirmed.repairResponsibilityAssignment,
    )
    expect(restored.characterRecords['chen-du']).toEqual(
      confirmed.characterRecords['chen-du'],
    )
    expect(calculateFoodForecast(restored)).toEqual(
      calculateFoodForecast(confirmed),
    )
    expect(calculateRepairForecast(restored)).toEqual(
      calculateRepairForecast(confirmed),
    )
  })

  it('does not infer responsibility when an unrelated edit is undone', () => {
    const responsibilityBlockId = createBlockId('chen-du', 3, 0)
    const preEdited = act(scenario.createInitialState(), 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [responsibilityBlockId],
      activity: 'repair',
      scope: 'weekly',
    })
    const selected = act(preEdited, 2, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'handoff',
    })
    const unrelated = act(selected, 3, {
      type: 'EDIT_SCHEDULE',
      blockIds: [createBlockId('chen-du', 4, 2)],
      activity: 'study',
      scope: 'weekly',
    })
    const undone = applyPlayerAction(
      unrelated,
      createPlayerAction(
        4,
        unrelated.currentTick,
        { type: 'UNDO_SCHEDULE' },
        'action-0003',
      ),
      scenario,
    ).state

    expect(undone.repairResponsibility).toBe('unresolved')
    expect(undone.repairResponsibilityAssignment).toBeNull()
    expect(undone.characterRecords['chen-du']).toEqual(
      scenario.createInitialState().characterRecords['chen-du'],
    )
  })

  it('atomically rejects undo after the responsibility block has executed', () => {
    const selected = act(scenario.createInitialState(), 1, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'handoff',
    })
    const blockId = createBlockId('chen-du', 3, 0)
    const confirmed = act(selected, 2, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'repair',
      scope: 'weekly',
    })
    const reassigned = act(confirmed, 3, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'food',
      scope: 'weekly',
    })
    let advanced = advanceSimulation(
      reassigned,
      scenario.pumpEventTick,
      scenario,
    ).state
    advanced = act(advanced, 4, { type: 'SET_PAUSED', paused: false })
    advanced = advanceSimulation(
      advanced,
      blockEndTick(blockId),
      scenario,
    ).state
    const snapshot = JSON.stringify(advanced)

    expect(() =>
      applyPlayerAction(
        advanced,
        createPlayerAction(
          5,
          advanced.currentTick,
          { type: 'UNDO_SCHEDULE' },
          'action-0003',
        ),
        scenario,
      ),
    ).toThrow(`已经执行的活动块不能撤销：${blockId}`)
    expect(JSON.stringify(advanced)).toBe(snapshot)
    expect(advanced.repairResponsibility).toBe('unresolved')
    expect(advanced.repairResponsibilityAssignment).toBeNull()
  })

  it('records repair debt with a due point and an immediate weekly forecast cost', () => {
    const initial = scenario.createInitialState()
    const before = calculateRepairForecast(initial)
    const accepted = act(initial, 1, { type: 'ACCEPT_REPAIR_DEBT' })
    const after = calculateRepairForecast(accepted)

    expect(accepted.repairResponsibility).toBe('debt')
    expect(accepted.repairResponsibilityAssignment).toBeNull()
    expect(accepted.repairDebt).toEqual({
      acceptedActionId: 'action-0001',
      dueTick: 2010,
      weeklyPenalty: 3,
      accruedPenalty: 0,
      settlementRecapIndex: 1,
      settled: false,
      settledAtTick: null,
      currentRisk: '本周维修保障将在周末减少 3',
      nextConsequence: '第一周复盘将累计 3 点维修欠账代价',
    })
    expect(accepted.scheduleTransactions).toEqual([])
    expect(after.consumption).toBe(before.consumption + 3)
    expect(after.endingStock.high).toBe(before.endingStock.high - 3)
    expect(after.reasons.join(' ')).toContain('维修欠账本周代价 −3')
    expect(accepted.characterRecords['qiao-pan'].at(-1)).toContain(
      '接受维修欠账',
    )
  })

  it('replaces an unconfirmed personnel direction when debt is accepted', () => {
    const selected = act(scenario.createInitialState(), 1, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'qiao-pan',
    })
    const accepted = act(selected, 2, { type: 'ACCEPT_REPAIR_DEBT' })

    expect(accepted.repairResponsibilitySelection).toBeNull()
    expect(accepted.repairResponsibility).toBe('debt')
    expect(accepted.repairDebt?.acceptedActionId).toBe('action-0002')
  })

  it('keeps character records semantic when action ids differ', () => {
    const scheduleWith = (selectSequence: number, editSequence: number) => {
      const selected = act(scenario.createInitialState(), selectSequence, {
        type: 'SELECT_REPAIR_RESPONSIBILITY',
        responsible: 'handoff',
      })
      return act(selected, editSequence, {
        type: 'EDIT_SCHEDULE',
        blockIds: [createBlockId('su-ji', 3, 0)],
        activity: 'repair',
        scope: 'weekly',
      })
    }
    const firstScheduled = scheduleWith(1, 2)
    const secondScheduled = scheduleWith(8, 9)
    const firstDebt = act(scenario.createInitialState(), 1, {
      type: 'ACCEPT_REPAIR_DEBT',
    })
    const secondDebt = act(scenario.createInitialState(), 8, {
      type: 'ACCEPT_REPAIR_DEBT',
    })

    expect(firstScheduled.characterRecords['su-ji']).toEqual(
      secondScheduled.characterRecords['su-ji'],
    )
    expect(firstDebt.characterRecords['qiao-pan']).toEqual(
      secondDebt.characterRecords['qiao-pan'],
    )
  })

  it('accrues the debt once per recap and settles it at tick 2010', () => {
    let state = act(scenario.createInitialState(), 1, {
      type: 'ACCEPT_REPAIR_DEBT',
    })
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = advanceSimulation(state, scenario.weekEndTick, scenario).state

    expect(state.repairDebt).toMatchObject({
      accruedPenalty: 3,
      settled: false,
      settledAtTick: null,
      currentRisk: '已累计 3 点维修欠账代价',
      nextConsequence: '第二周复盘将再累计 3 点并结清欠账',
    })
    expect(
      state.recap?.items.find((item) => item.sourceId === 'repair-debt'),
    ).toMatchObject({
      category: '已知风险',
      values: {
        weeklyPenalty: 3,
        accruedPenalty: 3,
        dueTick: 2010,
      },
    })

    state = act(state, 2, { type: 'CONTINUE_TO_NEXT_WEEK' })
    state = advanceSimulation(
      state,
      scenario.linHeRequestDeadlineTick,
      scenario,
    ).state
    state = advanceSimulation(state, scenario.simulationEndTick, scenario).state

    expect(state.isComplete).toBe(true)
    expect(state.repairDebt).toMatchObject({
      accruedPenalty: 6,
      settled: true,
      settledAtTick: 2010,
      currentRisk: '维修欠账已在终局复盘结清',
      nextConsequence: '无后续欠账后果',
    })
    expect(
      state.recap?.items.find((item) => item.sourceId === 'repair-debt'),
    ).toMatchObject({
      category: '计划内结果',
      values: {
        weeklyPenalty: 3,
        accruedPenalty: 6,
        dueTick: 2010,
      },
    })
    expect(calculateRepairForecast(state).endingStock.low).toBe(
      state.recap?.supplies.repair.actual,
    )
    expect(calculateRepairForecast(state).reasons.join(' ')).toContain(
      '维修欠账本周代价 −3',
    )
  })

  it('completes all three paths with visible, non-dominated outcomes', () => {
    const initial = scenario.createInitialState()
    const qiaoSelected = act(initial, 1, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'qiao-pan',
    })
    const qiaoScheduled = act(qiaoSelected, 2, {
      type: 'EDIT_SCHEDULE',
      blockIds: [createBlockId('qiao-pan', 3, 2)],
      activity: 'repair',
      scope: 'weekly',
    })
    const handoffSelected = act(initial, 1, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'handoff',
    })
    const handoffScheduled = act(handoffSelected, 2, {
      type: 'EDIT_SCHEDULE',
      blockIds: [createBlockId('su-ji', 3, 0)],
      activity: 'repair',
      scope: 'weekly',
    })
    const debtAccepted = act(initial, 1, { type: 'ACCEPT_REPAIR_DEBT' })

    const qiao = completeTwoWeeks(qiaoScheduled)
    const handoff = completeTwoWeeks(handoffScheduled)
    const debt = completeTwoWeeks(debtAccepted)

    for (const result of [qiao, handoff, debt]) {
      expect(result.isComplete).toBe(true)
      expect(result.recaps).toHaveLength(2)
    }
    expect(qiao.repairResponsibilityAssignment).toMatchObject({
      actorId: 'qiao-pan',
      characterLoadCost: 2,
      repairOutputDelta: 2,
    })
    expect(handoff.repairResponsibilityAssignment).toMatchObject({
      actorId: 'su-ji',
      characterLoadCost: 1,
      repairOutputDelta: 1,
    })
    expect(
      qiao.recaps[0].items.find(
        (item) => item.sourceId === 'repair-responsibility',
      ),
    ).toBeDefined()
    expect(
      handoff.recaps[0].items.find(
        (item) => item.sourceId === 'repair-responsibility',
      ),
    ).toBeDefined()
    expect(debt.repairDebt).toMatchObject({
      accruedPenalty: 6,
      settled: true,
    })
    expect(calculateRepairForecast(qiao).reasons.join(' ')).toContain(
      '维修责任兑现 +0',
    )

    const outcomes = [qiao, handoff, debt].map((state) => ({
      repair: state.recap?.supplies.repair.actual ?? Number.NEGATIVE_INFINITY,
      debt: state.repairDebt?.accruedPenalty ?? 0,
      load: state.repairResponsibilityAssignment?.characterLoadCost ?? 0,
    }))
    const dominates = (
      left: (typeof outcomes)[number],
      right: (typeof outcomes)[number],
    ) =>
      left.repair >= right.repair &&
      left.debt <= right.debt &&
      left.load <= right.load &&
      (left.repair > right.repair ||
        left.debt < right.debt ||
        left.load < right.load)

    for (const [leftIndex, left] of outcomes.entries()) {
      for (const [rightIndex, right] of outcomes.entries()) {
        if (leftIndex === rightIndex) continue
        expect(dominates(left, right)).toBe(false)
      }
    }
  })
})
