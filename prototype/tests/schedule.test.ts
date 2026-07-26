import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import { advanceSimulation, applyPlayerAction, createPlayerAction } from '../src/sim/engine'
import type { PlayerAction, SimulationState } from '../src/sim/model'
import {
  CHARACTERS,
  allBlockIds,
  createBaseKey,
  createBlockId,
  resolveScheduleBlock,
} from '../src/sim/schedule'

function act(state: SimulationState, sequence: number, action: PlayerAction) {
  return applyPlayerAction(
    state,
    createPlayerAction(sequence, state.currentTick, action),
    scenario,
  ).state
}

describe('four-person fourteen-day schedule contract', () => {
  it('creates four named characters and 224 editable blocks across fourteen days', () => {
    expect(CHARACTERS.map((character) => character.name)).toEqual([
      '林禾',
      '乔磐',
      '苏霁',
      '陈渡',
    ])
    expect(allBlockIds()).toHaveLength(4 * 14 * 4)
    expect(new Set(allBlockIds()).size).toBe(224)
  })

  it('resolves immediate adjustment before weekly exception before base plan', () => {
    const blockId = createBlockId('su-ji', 3, 0)
    let state = scenario.createInitialState()
    expect(resolveScheduleBlock(state, blockId)).toMatchObject({
      activity: 'logistics',
      source: '基础计划',
    })

    state = act(state, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'rest',
      scope: 'weekly',
    })
    expect(resolveScheduleBlock(state, blockId)).toMatchObject({
      activity: 'rest',
      source: '本周例外',
    })

    state = act(state, 2, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'repair',
      scope: 'immediate',
    })
    expect(resolveScheduleBlock(state, blockId)).toMatchObject({
      activity: 'repair',
      source: '即时调整',
    })
  })

  it('expires first-week exceptions at the weekend while an explicit base edit persists', () => {
    const weeklyBlock = createBlockId('chen-du', 2, 0)
    const baseBlock = createBlockId('qiao-pan', 2, 2)
    let state = scenario.createInitialState()
    state = act(state, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [weeklyBlock],
      activity: 'study',
      scope: 'weekly',
    })
    state = act(state, 2, {
      type: 'EDIT_SCHEDULE',
      blockIds: [baseBlock],
      activity: 'food',
      scope: 'base',
    })
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = advanceSimulation(state, scenario.weekEndTick, scenario).state

    expect(state.weeklyOverrides[weeklyBlock]).toBeUndefined()
    expect(resolveScheduleBlock(state, weeklyBlock).source).toBe('基础计划')
    expect(
      state.basePlan[createBaseKey('qiao-pan', 9, 2)],
    ).toBe('food')
    expect(resolveScheduleBlock(state, createBlockId('qiao-pan', 9, 2))).toMatchObject({
      activity: 'food',
      source: '基础计划',
    })
  })

  it('keeps a batch edit as one stable transaction with all affected block ids', () => {
    const blockIds = [
      createBlockId('lin-he', 0, 0),
      createBlockId('qiao-pan', 0, 0),
      createBlockId('su-ji', 0, 0),
    ]
    const state = act(scenario.createInitialState(), 12, {
      type: 'EDIT_SCHEDULE',
      blockIds,
      activity: 'rest',
      scope: 'weekly',
    })

    expect(state.actionLog).toHaveLength(1)
    expect(state.actionLog[0]).toMatchObject({
      id: 'action-0012',
      affectedBlockIds: blockIds,
    })
    expect(state.scheduleTransactions).toHaveLength(1)
    expect(state.scheduleTransactions[0]).toMatchObject({
      actionId: 'action-0012',
      affectedBlockIds: blockIds,
    })
  })

  it('copies one character day as one transaction and undo restores the target day', () => {
    let state = scenario.createInitialState()
    const originalTarget = [0, 1, 2, 3].map((blockIndex) =>
      resolveScheduleBlock(state, createBlockId('lin-he', 2, blockIndex)).activity,
    )
    state = act(state, 1, {
      type: 'COPY_DAY',
      characterId: 'lin-he',
      sourceDayIndex: 0,
      targetDayIndex: 2,
      scope: 'weekly',
    })
    const copied = [0, 1, 2, 3].map((blockIndex) =>
      resolveScheduleBlock(state, createBlockId('lin-he', 2, blockIndex)).activity,
    )
    const source = [0, 1, 2, 3].map((blockIndex) =>
      resolveScheduleBlock(state, createBlockId('lin-he', 0, blockIndex)).activity,
    )

    expect(copied).toEqual(source)
    expect(state.scheduleTransactions.at(-1)?.affectedBlockIds).toHaveLength(4)

    state = act(state, 2, { type: 'UNDO_SCHEDULE' })
    expect(
      [0, 1, 2, 3].map((blockIndex) =>
        resolveScheduleBlock(state, createBlockId('lin-he', 2, blockIndex)).activity,
      ),
    ).toEqual(originalTarget)
  })

  it('does not mutate the base plan for a normal single-block weekly edit', () => {
    const blockId = createBlockId('chen-du', 4, 1)
    const initial = scenario.createInitialState()
    const baseKey = createBaseKey('chen-du', 4, 1)
    const state = act(initial, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'study',
      scope: 'weekly',
    })

    expect(state.basePlan[baseKey]).toBe(initial.basePlan[baseKey])
    expect(state.weeklyOverrides[blockId]).toBe('study')
  })

  it('expires an immediate adjustment after its activity block has executed', () => {
    const blockId = createBlockId('qiao-pan', 0, 0)
    let state = act(scenario.createInitialState(), 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [blockId],
      activity: 'rest',
      scope: 'immediate',
    })
    state = advanceSimulation(state, 73, scenario).state

    expect(state.immediateAdjustments[blockId]).toBeUndefined()
    expect(resolveScheduleBlock(state, blockId).source).toBe('基础计划')
  })

  it('runs through both week boundaries and completes all fourteen days', () => {
    let state = scenario.createInitialState()
    state = act(state, 1, {
      type: 'EDIT_SCHEDULE',
      blockIds: [createBlockId('lin-he', 1, 1)],
      activity: 'repair',
      scope: 'weekly',
    })
    state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
    state = advanceSimulation(state, scenario.weekEndTick, scenario).state
    expect(state.completedWeekIndexes).toEqual([0])
    expect(state.isComplete).toBe(false)

    state = act(state, 2, { type: 'SET_PAUSED', paused: false })
    state = act(state, 3, {
      type: 'EDIT_SCHEDULE',
      blockIds: [createBlockId('su-ji', 9, 2)],
      activity: 'study',
      scope: 'weekly',
    })
    state = advanceSimulation(state, scenario.simulationEndTick, scenario).state

    expect(state.currentTick).toBe(scenario.simulationEndTick)
    expect(state.completedWeekIndexes).toEqual([0, 1])
    expect(state.recaps).toHaveLength(2)
    expect(state.isComplete).toBe(true)
    expect(state.weeklyOverrides).toEqual({})
  })
})
