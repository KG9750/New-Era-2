import { gate1WeekOneScenario } from '../scenario/gate1-week-one'
import type {
  Activity,
  CharacterId,
  ScenarioDefinition,
  SimulationState,
  TransportRouteId,
} from './model'
import { CHARACTERS, createBlockId, resolveScheduleBlock } from './schedule'
import { weekIndexForTick } from './week-phase'

export interface TransportRouteDefinition {
  id: TransportRouteId
  label: string
  distanceMeters: number
  travelMinutes: number
  foodLoss: number
  repairCost: number
  path: string
  lossSources: readonly string[]
}

export interface MapCharacterPosition {
  id: CharacterId
  name: string
  activity: Activity | 'personal'
  x: number
  y: number
}

const ROUTES: Readonly<Record<TransportRouteId, TransportRouteDefinition>> = {
  'north-loop': {
    id: 'north-loop',
    label: '北侧绕行',
    distanceMeters: 860,
    travelMinutes: 96,
    foodLoss: 6,
    repairCost: 0,
    path: '22,48 34,18 70,18 86,48',
    lossSources: ['远距离搬运损失 4', '重复装卸与等待损失 2'],
  },
  'south-shortcut': {
    id: 'south-shortcut',
    label: '南侧短通路',
    distanceMeters: 470,
    travelMinutes: 52,
    foodLoss: 2,
    repairCost: 1,
    path: '22,48 48,62 68,62 86,48',
    lossSources: ['短路搬运损失 1', '临时通路交接损失 1'],
  },
}

export function selectCurrentWeekIndex(
  state: SimulationState,
  scenario: ScenarioDefinition = gate1WeekOneScenario,
): 0 | 1 {
  return weekIndexForTick(state.currentTick, scenario)
}

export function selectTransportRoute(
  state: SimulationState,
): TransportRouteDefinition {
  return ROUTES[state.transportRouteId]
}

export function selectTransportRepairCost(
  state: SimulationState,
  scenario: ScenarioDefinition = gate1WeekOneScenario,
): number {
  if (
    state.transportRouteId !== 'south-shortcut' ||
    state.transportRouteOpenedAtTick === null
  ) {
    return 0
  }
  const openedWeek = weekIndexForTick(state.transportRouteOpenedAtTick, scenario)
  return openedWeek === selectCurrentWeekIndex(state, scenario)
    ? ROUTES['south-shortcut'].repairCost
    : 0
}

export function canOpenTransportShortcut(
  state: SimulationState,
  scenario: ScenarioDefinition,
): boolean {
  if (state.transportRouteId === 'south-shortcut' || state.recap !== null) return false
  const weekIndex = selectCurrentWeekIndex(state, scenario)
  return state.currentTick < scenario.weeklyTransportStartTicks[weekIndex]
}

function activeBlockIndex(currentTick: number): number | null {
  const tickInDay = currentTick % 144
  if (tickInDay >= 54 && tickInDay < 72) return 0
  if (tickInDay >= 78 && tickInDay < 96) return 1
  if (tickInDay >= 96 && tickInDay < 114) return 2
  if (tickInDay >= 120 && tickInDay < 138) return 3
  return null
}

export function selectMapCharacterPositions(
  state: SimulationState,
): readonly MapCharacterPosition[] {
  const dayIndex = Math.min(13, Math.floor(state.currentTick / 144))
  const blockIndex = activeBlockIndex(state.currentTick)
  const route = selectTransportRoute(state)
  const logisticsPoint =
    route.id === 'north-loop' ? { x: 52, y: 18 } : { x: 54, y: 62 }
  const locations: Readonly<Record<Activity | 'personal', { x: number; y: number }>> = {
    food: { x: 22, y: 48 },
    repair: { x: 66, y: 82 },
    logistics: logisticsPoint,
    study: { x: 18, y: 82 },
    rest: { x: 18, y: 82 },
    social: { x: 18, y: 82 },
    personal: { x: 18, y: 82 },
  }

  return CHARACTERS.map((character, index) => {
    const activity =
      blockIndex === null
        ? 'personal'
        : resolveScheduleBlock(
            state,
            createBlockId(character.id, dayIndex, blockIndex),
          ).activity
    const location = locations[activity]
    return {
      id: character.id,
      name: character.name,
      activity,
      x: location.x + (index % 2) * 3,
      y: location.y + Math.floor(index / 2) * 4,
    }
  })
}
