import type { FoodForecast, ForecastRange, SimulationState } from './model'
import { PUMP_MAINTENANCE_BLOCK_ID, resolveScheduleBlock } from './schedule'

const CURRENT_STOCK = 18
const KNOWN_CONSUMPTION = 42

function endingStock(production: ForecastRange): ForecastRange {
  return {
    low: CURRENT_STOCK + production.low - KNOWN_CONSUMPTION,
    high: CURRENT_STOCK + production.high - KNOWN_CONSUMPTION,
  }
}

function statusFor(range: ForecastRange): FoodForecast['status'] {
  if (range.high < 4) return '严重短缺'
  if (range.high < 12) return '轻度缺口'
  if (range.low < 12) return '脆弱平衡'
  return '目标区间'
}

export function calculateFoodForecast(state: SimulationState): FoodForecast {
  let production: ForecastRange
  let trend: FoodForecast['trend']
  let reasons: readonly string[]

  if (state.pumpStatus === 'protected') {
    production = { low: 34, high: 35 }
    trend = '风险收窄'
    reasons = [
      '周二的预防性检修生效：周三水泵异常只造成 0–1 单位产出损失。',
      '林禾其余农务块与既有运输条件维持基线产出。',
    ]
  } else if (state.pumpStatus === 'failed') {
    production = { low: 27, high: 27 }
    trend = '事件下调'
    reasons = [
      '水泵未检修并在周三停机，粮食产出确定减少 8 单位。',
      '这是已发生事件带来的下调，不是隐藏随机波动。',
    ]
  } else if (resolveScheduleBlock(state, PUMP_MAINTENANCE_BLOCK_ID).activity === 'repair') {
    production = { low: 35, high: 35 }
    trend = '风险收窄'
    reasons = [
      '林禾已把周二午后改为预防性检修，水泵故障风险已从预测中移除。',
      '检修占用休息块，不减少既定农务产出。',
    ]
  } else {
    production = { low: 27, high: 35 }
    trend = '风险未消除'
    reasons = [
      '水泵仍未安排检修；若周三故障兑现，粮食产出可能减少 8 单位。',
      '当前区间只包含玩家已知的水泵风险。',
    ]
  }

  const ending = endingStock(production)
  return {
    currentStock: CURRENT_STOCK,
    production,
    consumption: KNOWN_CONSUMPTION,
    endingStock: ending,
    status: statusFor(ending),
    trend,
    reasons,
  }
}

export function formatRange(range: ForecastRange): string {
  return range.low === range.high ? `${range.low}` : `${range.low}–${range.high}`
}
