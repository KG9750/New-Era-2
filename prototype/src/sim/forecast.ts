import type {
  CharacterId,
  FoodForecast,
  ForecastRange,
  RepairForecast,
  SimulationState,
  SupplyStatus,
} from './model'
import {
  CHARACTERS,
  LIN_HE_STUDY_BLOCK_ID,
  createBlockId,
  hasPreventiveMaintenance,
  resolveScheduleBlock,
} from './schedule'
import {
  selectTransportRepairCost,
  selectTransportRoute,
} from './transport'

const FOOD_KNOWN_CONSUMPTION = 42
const FOOD_TARGET = { low: 12, high: 20 }
const REPAIR_KNOWN_CONSUMPTION = 32
const REPAIR_TARGET = { low: 5, high: 9 }
const BASELINE_FOOD_OUTPUT = 35
const BASELINE_REPAIR_OUTPUT = 28
const BASELINE_LOGISTICS_OUTPUT = 41
const BASELINE_TRANSPORT_LOSS = 6
const SHARED_LABOR_CAPACITY =
  BASELINE_FOOD_OUTPUT + BASELINE_REPAIR_OUTPUT + BASELINE_LOGISTICS_OUTPUT

const FOOD_EFFICIENCY: Readonly<Record<CharacterId, number>> = {
  'lin-he': 2,
  'qiao-pan': 1,
  'su-ji': 1,
  'chen-du': 1,
}

const REPAIR_EFFICIENCY: Readonly<Record<CharacterId, number>> = {
  'lin-he': 1,
  'qiao-pan': 2,
  'su-ji': 1,
  'chen-du': 1,
}

const LOGISTICS_EFFICIENCY: Readonly<Record<CharacterId, number>> = {
  'lin-he': 1,
  'qiao-pan': 1,
  'su-ji': 2,
  'chen-du': 1,
}

interface LaborAllocation {
  food: number
  repair: number
  rawFood: number
  rawRepair: number
  logistics: number
  rawLogistics: number
  foodByCharacter: Readonly<Record<CharacterId, number>>
  repairByCharacter: Readonly<Record<CharacterId, number>>
  logisticsByCharacter: Readonly<Record<CharacterId, number>>
  capped: boolean
}

function currentWeekIndex(state: SimulationState): 0 | 1 {
  if (state.completedWeekIndexes.includes(0) && state.recap === null) return 1
  return Math.floor(state.currentTick / (144 * 7)) >= 1 ? 1 : 0
}

function calculateLaborAllocation(state: SimulationState): LaborAllocation {
  const firstDay = currentWeekIndex(state) * 7
  const foodByCharacter = Object.fromEntries(
    CHARACTERS.map((character) => [character.id, 0]),
  ) as Record<CharacterId, number>
  const repairByCharacter = { ...foodByCharacter }
  const logisticsByCharacter = { ...foodByCharacter }

  for (const character of CHARACTERS) {
    for (let dayIndex = firstDay; dayIndex < firstDay + 7; dayIndex += 1) {
      for (let blockIndex = 0; blockIndex < 4; blockIndex += 1) {
        const blockId = createBlockId(character.id, dayIndex, blockIndex)
        const activity =
          state.linHeRequestDecision === 'accepted' &&
          blockId === LIN_HE_STUDY_BLOCK_ID
            ? 'study'
            : resolveScheduleBlock(state, blockId).activity
        if (activity === 'food') {
          foodByCharacter[character.id] += FOOD_EFFICIENCY[character.id]
        }
        if (activity === 'repair') {
          repairByCharacter[character.id] += REPAIR_EFFICIENCY[character.id]
        }
        if (activity === 'logistics') {
          logisticsByCharacter[character.id] += LOGISTICS_EFFICIENCY[character.id]
        }
      }
    }
  }

  const rawFood = Object.values(foodByCharacter).reduce((sum, value) => sum + value, 0)
  const rawRepair = Object.values(repairByCharacter).reduce((sum, value) => sum + value, 0)
  const rawLogistics = Object.values(logisticsByCharacter).reduce(
    (sum, value) => sum + value,
    0,
  )
  const rawTotal = rawFood + rawRepair + rawLogistics
  const capped = rawTotal > SHARED_LABOR_CAPACITY
  const scale = capped ? SHARED_LABOR_CAPACITY / rawTotal : 1

  return {
    food: Math.floor(rawFood * scale),
    repair: Math.floor(rawRepair * scale),
    logistics: Math.floor(rawLogistics * scale),
    rawFood,
    rawRepair,
    rawLogistics,
    foodByCharacter,
    repairByCharacter,
    logisticsByCharacter,
    capped,
  }
}

function statusFor(
  range: ForecastRange,
  target: Readonly<{ low: number; high: number }>,
  severeBelow: number,
): SupplyStatus {
  if (range.high < severeBelow) return '严重短缺'
  if (range.high < target.low) return '轻度缺口'
  if (range.low < target.low) return '脆弱平衡'
  if (range.low > target.high) return '显著过剩'
  return '目标区间'
}

function foodFacilityRange(state: SimulationState, output: number): ForecastRange {
  if (state.pumpStatus === 'at-risk' && hasPreventiveMaintenance(state)) {
    return { low: output, high: output }
  }
  if (state.pumpStatus === 'protected') return { low: output - 1, high: output }
  if (state.pumpStatus === 'failed') return { low: output - 8, high: output - 8 }
  return { low: output - 8, high: output }
}

function foodFacilityReason(state: SimulationState): string {
  if (state.pumpStatus === 'at-risk' && hasPreventiveMaintenance(state)) {
    return '设施：周三前已安排 2 个水泵维修块，已知停机风险从计划区间移除。'
  }
  if (state.pumpStatus === 'protected') {
    return '设施：水泵已受检修保护，农田产出区间仅保留 0–1 的可见波动。'
  }
  if (state.pumpStatus === 'failed') {
    return '设施：水泵已停机，农田产出确定减少 8；这不是隐藏随机波动。'
  }
  return '设施：水泵尚未检修，农田产出下限包含已知的 8 单位停机风险。'
}

function laborReason(allocation: LaborAllocation, supply: 'food' | 'repair'): string {
  const contributions = supply === 'food' ? allocation.foodByCharacter : allocation.repairByCharacter
  const visibleContributors = CHARACTERS
    .filter((character) => contributions[character.id] > 0)
    .map((character) => `${character.name} ${contributions[character.id]}`)
    .join('、')
  const label = supply === 'food' ? '农务' : '维修'
  return `人物与日程：${visibleContributors || '无人投入'}；熟练度已计入每个${label}块。`
}

function sharedLaborReason(allocation: LaborAllocation): string {
  if (allocation.capped) {
    return `共享劳动力：粮食、维修与物流原始投入共 ${allocation.rawFood + allocation.rawRepair + allocation.rawLogistics}，超过可持续上限 ${SHARED_LABOR_CAPACITY}；额外加班不能同时抬高两条预测。`
  }
  return `共享劳动力：粮食、维修与物流共占用 ${allocation.rawFood + allocation.rawRepair + allocation.rawLogistics}/${SHARED_LABOR_CAPACITY} 可靠产能，改派会在两条供需间转移。`
}

function logisticsAdjustment(allocation: LaborAllocation): number {
  return Math.max(-6, Math.min(6, allocation.logistics - BASELINE_LOGISTICS_OUTPUT))
}

export function calculateFoodForecast(state: SimulationState): FoodForecast {
  const allocation = calculateLaborAllocation(state)
  const currentWeekIndex = state.completedWeekIndexes.includes(0) ? 1 : 0
  const fertilizerBonus =
    state.fertilizer.appliedWeekIndex === currentWeekIndex ? 6 : 0
  const logisticsBonus = logisticsAdjustment(allocation)
  const transportRoute = selectTransportRoute(state)
  const grossFieldOutput =
    allocation.food + logisticsBonus + BASELINE_TRANSPORT_LOSS
  const deliveredOutput = Math.max(0, grossFieldOutput - transportRoute.foodLoss)
  const facilityProduction = foodFacilityRange(
    state,
    deliveredOutput,
  )
  const production = {
    low: Math.max(0, facilityProduction.low + fertilizerBonus),
    high: Math.max(0, facilityProduction.high + fertilizerBonus),
  }
  const endingStock = {
    low: state.inventory.food + production.low - FOOD_KNOWN_CONSUMPTION,
    high: state.inventory.food + production.high - FOOD_KNOWN_CONSUMPTION,
  }
  const status = statusFor(endingStock, FOOD_TARGET, 4)
  const requestAccepted = state.linHeRequestDecision === 'accepted'
  const modifiers = [
    fertilizerBonus > 0
      ? '化肥 +6'
      : state.fertilizer.remainingUnits > 0
        ? '化肥尚未使用'
        : '化肥已于前一周使用',
    requestAccepted ? '林禾学习占用 1 个农务块' : null,
    `地图：${transportRoute.label} ${transportRoute.distanceMeters} 米 / ${transportRoute.travelMinutes} 分钟，运输损耗 ${transportRoute.foodLoss}（${transportRoute.lossSources.join('、')}）`,
    `物流排班修正 ${logisticsBonus >= 0 ? '+' : ''}${logisticsBonus}；${sharedLaborReason(allocation)}`,
  ].filter((item): item is string => item !== null)

  return {
    id: 'food',
    label: '粮食',
    currentStock: state.inventory.food,
    production,
    consumption: FOOD_KNOWN_CONSUMPTION,
    endingStock,
    status,
    trend:
      state.pumpStatus === 'failed'
        ? '事件下调'
        : state.pumpStatus === 'protected' ||
            (state.pumpStatus === 'at-risk' && hasPreventiveMaintenance(state))
          ? '风险收窄'
        : production.high > BASELINE_FOOD_OUTPUT
          ? '上升'
          : production.high < BASELINE_FOOD_OUTPUT
            ? '下调'
            : '风险未消除',
    reasons: [
      foodFacilityReason(state),
      laborReason(allocation, 'food'),
      modifiers.join('；'),
    ],
    acceptedRisk: state.acceptedFoodShortfall && status === '轻度缺口',
  }
}

export function calculateRepairForecast(state: SimulationState): RepairForecast {
  const allocation = calculateLaborAllocation(state)
  const logisticsBonus = Math.trunc(logisticsAdjustment(allocation) / 2)
  const transportRepairCost = selectTransportRepairCost(state)
  const riskCost =
    state.pumpStatus === 'failed'
      ? { low: 4, high: 4 }
      : state.pumpStatus === 'protected'
        ? { low: 1, high: 1 }
        : hasPreventiveMaintenance(state)
          ? { low: 1, high: 1 }
          : { low: 2, high: 0 }
  const repairOutput = Math.max(0, allocation.repair + logisticsBonus)
  const production = { low: repairOutput, high: repairOutput }
  const endingStock = {
    low:
      state.inventory.repair +
      production.low -
      REPAIR_KNOWN_CONSUMPTION -
      riskCost.low -
      transportRepairCost,
    high:
      state.inventory.repair +
      production.high -
      REPAIR_KNOWN_CONSUMPTION -
      riskCost.high -
      transportRepairCost,
  }

  return {
    id: 'repair',
    label: '维修保障',
    currentStock: state.inventory.repair,
    production,
    consumption: REPAIR_KNOWN_CONSUMPTION + transportRepairCost,
    endingStock,
    status: statusFor(endingStock, REPAIR_TARGET, 0),
    trend:
      state.pumpStatus === 'failed'
        ? '事件下调'
        : repairOutput > BASELINE_REPAIR_OUTPUT
          ? '上升'
          : repairOutput < BASELINE_REPAIR_OUTPUT
            ? '下调'
            : state.pumpStatus === 'protected' || hasPreventiveMaintenance(state)
              ? '风险收窄'
              : '风险未消除',
    reasons: [
      state.pumpStatus === 'at-risk'
        ? '设施：维修工坊正常；水泵风险会额外占用 0–2 保障。'
        : state.pumpStatus === 'protected'
          ? '设施：维修工坊正常；预防性检修把水泵额外消耗锁定为 1。'
          : '设施：维修工坊正常；水泵停机已确定占用 4 维修保障。',
      laborReason(allocation, 'repair'),
      `物流备件支持 ${logisticsBonus >= 0 ? '+' : ''}${logisticsBonus}；短通路本周启用成本 −${transportRepairCost}；${sharedLaborReason(allocation)}`,
    ],
    acceptedRisk: false,
  }
}

export function calculateSupplyForecasts(state: SimulationState) {
  return {
    food: calculateFoodForecast(state),
    repair: calculateRepairForecast(state),
  }
}

export function formatRange(range: ForecastRange): string {
  return range.low === range.high ? `${range.low}` : `${range.low}–${range.high}`
}
