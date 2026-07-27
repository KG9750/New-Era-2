import { gate1WeekOneScenario as scenario } from '../scenario/gate1-week-one'
import type { PlayerAction, SimulationState } from '../sim/model'
import {
  canOpenTransportShortcut,
  selectCurrentWeekIndex,
  selectMapCharacterPositions,
  selectTransportRepairCost,
  selectTransportRoute,
} from '../sim/transport'

interface MapPanelProps {
  simulation: SimulationState
  focused?: boolean
  submit(action: PlayerAction): void
}

export function MapPanel({ simulation, focused = false, submit }: MapPanelProps) {
  const route = selectTransportRoute(simulation)
  const characters = selectMapCharacterPositions(simulation)
  const canOpenShortcut = canOpenTransportShortcut(simulation, scenario)
  const currentWeekIndex = selectCurrentWeekIndex(simulation, scenario)
  const transportStarted =
    simulation.currentTick >=
    scenario.weeklyTransportStartTicks[currentWeekIndex]

  return (
    <section
      className={`panel map-panel ${focused ? 'focused-panel' : ''}`}
      aria-labelledby="map-title"
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">地图兑现 · 农田 → 粮仓</p>
          <h2 id="map-title">运输路径与人物位置</h2>
        </div>
        <span className={`status-chip route-${route.id}`}>
          {route.label} · 损耗 {route.foodLoss}
        </span>
      </div>

      <svg
        aria-labelledby="transport-map-title transport-map-desc"
        className="transport-map"
        role="img"
        viewBox="0 0 108 96"
      >
        <title id="transport-map-title">东篱聚落运输地图</title>
        <desc id="transport-map-desc">
          {`当前使用${route.label}，农田到粮仓 ${route.distanceMeters} 米，预计运输 ${route.travelMinutes} 分钟，损耗 ${route.foodLoss} 单位粮食。`}
        </desc>
        <rect className="map-ground" height="92" rx="5" width="104" x="2" y="2" />
        <path className="map-river" d="M 4 68 C 30 55, 42 82, 104 70" />
        <polyline
          className={`transport-route route-line-${route.id}`}
          points={route.path}
        />

        <g className="facility facility-field" transform="translate(13 39)">
          <rect height="18" rx="2" width="18" />
          <text x="9" y="11">农田</text>
        </g>
        <g className="facility facility-granary" transform="translate(78 39)">
          <rect height="18" rx="2" width="18" />
          <text x="9" y="11">粮仓</text>
        </g>
        <g className="facility facility-workshop" transform="translate(56 75)">
          <rect height="13" rx="2" width="22" />
          <text x="11" y="9">维修工坊</text>
        </g>
        <g className="facility facility-home" transform="translate(8 75)">
          <rect height="13" rx="2" width="22" />
          <text x="11" y="9">住所</text>
        </g>
        {route.id === 'south-shortcut' && (
          <g className="shortcut-gate" transform="translate(47 57)">
            <circle cx="5" cy="5" r="5" />
            <text x="5" y="6.5">通</text>
          </g>
        )}

        {characters.map((character) => (
          <g
            className={`map-character character-${character.id}`}
            key={character.id}
            transform={`translate(${character.x} ${character.y})`}
          >
            <circle r="3.4" />
            <text x="0" y="1.4">{character.name.slice(0, 1)}</text>
            <title>{`${character.name} · ${character.activity}`}</title>
          </g>
        ))}
      </svg>

      <dl className="route-metrics">
        <div><dt>路线</dt><dd>{route.label}</dd></div>
        <div><dt>距离</dt><dd>{route.distanceMeters} 米</dd></div>
        <div><dt>搬运耗时</dt><dd>{route.travelMinutes} 分钟</dd></div>
        <div><dt>粮食损耗</dt><dd>−{route.foodLoss}</dd></div>
      </dl>
      <div className="loss-source">
        <strong>损耗来自</strong>
        <ul>
          {route.lossSources.map((source) => <li key={source}>{source}</li>)}
        </ul>
      </div>

      {route.id === 'north-loop' ? (
        <div className="map-adjustment">
          <div>
            <strong>可选：开启南侧短通路</strong>
            <span>860 → 470 米，粮食损耗 6 → 2；启用周投入 1 点维修保障。</span>
          </div>
          <button
            disabled={!canOpenShortcut}
            onClick={() => submit({ type: 'OPEN_TRANSPORT_SHORTCUT' })}
            type="button"
          >
            {canOpenShortcut
              ? '开启短通路 · 维修保障 −1'
              : transportStarted
                ? '本周运输已开始，不能追溯调整'
                : '周末结算中'}
          </button>
        </div>
      ) : (
        <p className="map-adjusted-note">
          南侧短通路已生效
          {selectTransportRepairCost(simulation) > 0
            ? '；本周启用成本已进入维修预测。'
            : '；后续周继承路线，不重复支付启用成本。'}
        </p>
      )}
    </section>
  )
}
