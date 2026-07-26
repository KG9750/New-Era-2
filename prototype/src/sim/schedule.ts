import type {
  Activity,
  CharacterDefinition,
  CharacterId,
  PlayerAction,
  ScheduleChange,
  ScheduleLayer,
  ScheduleScope,
  ScheduleTransaction,
  SimulationState,
} from './model'

export const CHARACTERS: readonly CharacterDefinition[] = [
  { id: 'lin-he', name: '林禾', skill: '农务' },
  { id: 'qiao-pan', name: '乔磐', skill: '维修' },
  { id: 'su-ji', name: '苏霁', skill: '物流' },
  { id: 'chen-du', name: '陈渡', skill: '协作' },
]

export const BLOCK_LABELS = ['B1 09–12', 'B2 13–16', 'B3 16–19', 'B4 20–23']
export const DAY_LABELS = [
  '第1日',
  '第2日',
  '第3日',
  '第4日',
  '第5日',
  '第6日',
  '第7日',
  '第8日',
  '第9日',
  '第10日',
  '第11日',
  '第12日',
  '第13日',
  '第14日',
]

export const PUMP_MAINTENANCE_BLOCK_ID = createBlockId('lin-he', 1, 1)
export const PUMP_MAINTENANCE_BLOCK_IDS = [
  createBlockId('qiao-pan', 1, 0),
  PUMP_MAINTENANCE_BLOCK_ID,
] as const
export const LIN_HE_STUDY_BLOCK_ID = createBlockId('lin-he', 8, 0)

export function isLinHeRequestBlockLocked(blockId: string): boolean {
  return blockId === LIN_HE_STUDY_BLOCK_ID
}

export function createBlockId(
  characterId: CharacterId,
  dayIndex: number,
  blockIndex: number,
): string {
  return `${characterId}:d${dayIndex}:b${blockIndex}`
}

export function parseBlockId(blockId: string): {
  characterId: CharacterId
  dayIndex: number
  blockIndex: number
} {
  const match = /^(lin-he|qiao-pan|su-ji|chen-du):d(\d+):b([0-3])$/.exec(blockId)
  if (!match) throw new Error(`Invalid schedule block id: ${blockId}`)
  return {
    characterId: match[1] as CharacterId,
    dayIndex: Number(match[2]),
    blockIndex: Number(match[3]),
  }
}

export function blockEndTick(blockId: string): number {
  const { dayIndex, blockIndex } = parseBlockId(blockId)
  return dayIndex * 144 + [72, 96, 114, 138][blockIndex]
}

export function createBaseKey(
  characterId: CharacterId,
  dayIndex: number,
  blockIndex: number,
): string {
  return `${characterId}:weekday${dayIndex % 7}:b${blockIndex}`
}

function templateFor(characterId: CharacterId, weekday: number): readonly Activity[] {
  if (characterId === 'lin-he') {
    return weekday === 1
      ? ['food', 'rest', 'food', 'social']
      : ['food', 'food', 'logistics', 'rest']
  }
  if (characterId === 'qiao-pan') return ['repair', 'repair', 'rest', 'social']
  if (characterId === 'su-ji') return ['logistics', 'logistics', 'rest', 'social']
  return ['food', 'logistics', 'rest', 'social']
}

export function createInitialBasePlan(): Readonly<Record<string, Activity>> {
  const result: Record<string, Activity> = {}
  for (const character of CHARACTERS) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      templateFor(character.id, weekday).forEach((activity, blockIndex) => {
        result[createBaseKey(character.id, weekday, blockIndex)] = activity
      })
    }
  }
  return result
}

export function allBlockIds(): readonly string[] {
  const result: string[] = []
  for (const character of CHARACTERS) {
    for (let dayIndex = 0; dayIndex < 14; dayIndex += 1) {
      for (let blockIndex = 0; blockIndex < 4; blockIndex += 1) {
        result.push(createBlockId(character.id, dayIndex, blockIndex))
      }
    }
  }
  return result
}

export function resolveScheduleBlock(state: SimulationState, blockId: string) {
  const parsed = parseBlockId(blockId)
  const immediate = state.immediateAdjustments[blockId]
  if (immediate) {
    return { ...parsed, blockId, activity: immediate, source: '即时调整' as const }
  }
  const weekly = state.weeklyOverrides[blockId]
  if (weekly) {
    return { ...parsed, blockId, activity: weekly, source: '本周例外' as const }
  }
  return {
    ...parsed,
    blockId,
    activity: state.basePlan[createBaseKey(parsed.characterId, parsed.dayIndex, parsed.blockIndex)],
    source: '基础计划' as const,
  }
}

export function hasPreventiveMaintenance(state: SimulationState): boolean {
  return PUMP_MAINTENANCE_BLOCK_IDS.every(
    (blockId) => resolveScheduleBlock(state, blockId).activity === 'repair',
  )
}

function layerFor(scope: ScheduleScope): ScheduleLayer {
  if (scope === 'immediate') return 'immediateAdjustments'
  if (scope === 'base') return 'basePlan'
  return 'weeklyOverrides'
}

function keyFor(blockId: string, scope: ScheduleScope): string {
  if (scope !== 'base') return blockId
  const parsed = parseBlockId(blockId)
  return createBaseKey(parsed.characterId, parsed.dayIndex, parsed.blockIndex)
}

function affectedIdsForCopy(action: Extract<PlayerAction, { type: 'COPY_DAY' }>): readonly string[] {
  return [0, 1, 2, 3].map((blockIndex) =>
    createBlockId(action.characterId, action.targetDayIndex, blockIndex),
  )
}

export function affectedBlockIdsFor(action: PlayerAction): readonly string[] {
  if (action.type === 'EDIT_SCHEDULE') return [...new Set(action.blockIds)]
  if (action.type === 'COPY_DAY') return affectedIdsForCopy(action)
  if (action.type === 'CHANGE_ACTIVITY') return [PUMP_MAINTENANCE_BLOCK_ID]
  if (action.type === 'RESOLVE_LIN_HE_REQUEST' && action.decision === 'accepted') {
    return [LIN_HE_STUDY_BLOCK_ID]
  }
  return []
}

function activitiesForAction(
  state: SimulationState,
  action:
    | Extract<PlayerAction, { type: 'EDIT_SCHEDULE' }>
    | Extract<PlayerAction, { type: 'COPY_DAY' }>,
): readonly { blockId: string; activity: Activity }[] {
  if (action.type === 'EDIT_SCHEDULE') {
    return [...new Set(action.blockIds)].map((blockId) => ({
      blockId,
      activity: action.activity,
    }))
  }
  return [0, 1, 2, 3].map((blockIndex) => ({
    blockId: createBlockId(action.characterId, action.targetDayIndex, blockIndex),
    activity: resolveScheduleBlock(
      state,
      createBlockId(action.characterId, action.sourceDayIndex, blockIndex),
    ).activity,
  }))
}

export function applyScheduleTransaction(
  state: SimulationState,
  actionId: string,
  action:
    | Extract<PlayerAction, { type: 'EDIT_SCHEDULE' }>
    | Extract<PlayerAction, { type: 'COPY_DAY' }>,
): SimulationState {
  if (action.type === 'EDIT_SCHEDULE' && action.blockIds.length === 0) {
    throw new Error('Schedule edit requires at least one block')
  }
  const layer = layerFor(action.scope)
  const nextLayer = { ...state[layer] }
  const changesByKey = new Map<string, ScheduleChange>()

  for (const item of activitiesForAction(state, action)) {
    parseBlockId(item.blockId)
    const key = keyFor(item.blockId, action.scope)
    if (!changesByKey.has(key)) {
      changesByKey.set(key, {
        key,
        layer,
        before: state[layer][key],
        after: item.activity,
      })
    } else {
      changesByKey.set(key, { ...changesByKey.get(key)!, after: item.activity })
    }
    nextLayer[key] = item.activity
  }

  const transaction: ScheduleTransaction = {
    actionId,
    affectedBlockIds: affectedBlockIdsFor(action),
    changes: [...changesByKey.values()],
  }
  return {
    ...state,
    [layer]: nextLayer,
    scheduleTransactions: [...state.scheduleTransactions, transaction],
  }
}

export interface QiaoPanBoundaryWarning {
  refusedDayIndexes: readonly number[]
  message: string
}

export function findQiaoPanBoundaryWarning(
  state: SimulationState,
  action:
    | Extract<PlayerAction, { type: 'EDIT_SCHEDULE' }>
    | Extract<PlayerAction, { type: 'COPY_DAY' }>,
): QiaoPanBoundaryWarning | null {
  const preview = applyScheduleTransaction(state, 'boundary-preview', action)
  const refusedDayIndexes: number[] = []
  let consecutiveDays = 0

  for (let dayIndex = 0; dayIndex < 14; dayIndex += 1) {
    const overtimeActivity = resolveScheduleBlock(
      preview,
      createBlockId('qiao-pan', dayIndex, 3),
    ).activity
    if (overtimeActivity === 'repair') {
      consecutiveDays += 1
      if (consecutiveDays >= 3) refusedDayIndexes.push(dayIndex)
    } else {
      consecutiveDays = 0
    }
  }

  if (refusedDayIndexes.length === 0) return null
  const firstRefusedDay = refusedDayIndexes[0] + 1
  return {
    refusedDayIndexes,
    message: `乔磐将在第 ${firstRefusedDay} 日触发第三个连续加班日并拒绝该维修块。请改由陈渡交接、延期，或接受维修缺口。`,
  }
}

export function undoLastScheduleTransaction(state: SimulationState): SimulationState {
  const transaction = state.scheduleTransactions.at(-1)
  if (!transaction) return state

  let next: SimulationState = { ...state }
  for (const change of transaction.changes) {
    const layer = { ...next[change.layer] }
    if (change.before === undefined) delete layer[change.key]
    else layer[change.key] = change.before
    next = { ...next, [change.layer]: layer }
  }
  return {
    ...next,
    scheduleTransactions: state.scheduleTransactions.slice(0, -1),
  }
}

export function expireScheduleLayers(
  state: SimulationState,
  throughTick: number,
  endingWeekIndex?: number,
): SimulationState {
  const immediateAdjustments = { ...state.immediateAdjustments }
  for (const blockId of Object.keys(immediateAdjustments)) {
    const { dayIndex } = parseBlockId(blockId)
    const endTick = blockEndTick(blockId)
    if (endTick <= throughTick) delete immediateAdjustments[blockId]
  }

  const weeklyOverrides = { ...state.weeklyOverrides }
  if (endingWeekIndex !== undefined) {
    const firstDay = endingWeekIndex * 7
    const lastDay = firstDay + 6
    for (const blockId of Object.keys(weeklyOverrides)) {
      const { dayIndex } = parseBlockId(blockId)
      if (dayIndex >= firstDay && dayIndex <= lastDay) delete weeklyOverrides[blockId]
    }
  }

  return { ...state, immediateAdjustments, weeklyOverrides }
}
