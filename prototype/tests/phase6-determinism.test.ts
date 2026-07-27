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
import { createPlaytestExport } from '../src/telemetry/export'
import {
  createSessionRecorder,
  recordExportCreated,
  recordPlayerTransition,
  recordSimulationAdvance,
  stableStateHash,
} from '../src/telemetry/session'

const BUILD_METADATA = {
  buildId: 'g1-e2e-determinism.1',
  gitSha: '1'.repeat(40),
  artifactHash: '2'.repeat(64),
  artifactHashAlgorithm: 'sha256-canonical-file-manifest-v1' as const,
  artifactManifestPath: 'artifact-manifest.json' as const,
  initialStateHash: stableStateHash(scenario.createInitialState()),
  initialStateHashAlgorithm: 'fnv1a32-stable-json-v1' as const,
}

function runTwoWeekTrace() {
  let state = scenario.createInitialState()
  const recorder = createSessionRecorder(
    'TECH-RC9-D01',
    state,
    BUILD_METADATA,
    1_000,
    100,
  )
  let sequence = 1
  let monotonicNow = 110

  const act = (action: Parameters<typeof createPlayerAction>[2]) => {
    const envelope = createPlayerAction(
      sequence,
      state.currentTick,
      action,
    )
    sequence += 1
    const before = state
    const result = applyPlayerAction(before, envelope, scenario)
    recordPlayerTransition(
      recorder,
      before,
      envelope,
      result,
      monotonicNow,
    )
    monotonicNow += 10
    state = result.state
  }
  const advance = (targetTick: number) => {
    const before = state
    const result = advanceSimulation(before, targetTick, scenario)
    recordSimulationAdvance(
      recorder,
      before,
      result,
      3,
      monotonicNow,
    )
    monotonicNow += 10
    state = result.state
  }
  const forecasts = () => ({
    food: calculateFoodForecast(state),
    repair: calculateRepairForecast(state),
  })

  const forecastSnapshots = [forecasts()]
  act({ type: 'CHANGE_ACTIVITY', activity: 'repair' })
  act({ type: 'OPEN_TRANSPORT_SHORTCUT' })
  forecastSnapshots.push(forecasts())
  act({ type: 'SET_PAUSED', paused: false })
  advance(scenario.pumpEventTick)
  act({ type: 'SET_PAUSED', paused: false })
  advance(scenario.weekEndTick)
  act({ type: 'CONTINUE_TO_NEXT_WEEK' })
  act({ type: 'RESOLVE_LIN_HE_REQUEST', decision: 'declined' })
  forecastSnapshots.push(forecasts())
  act({ type: 'SET_PAUSED', paused: false })
  advance(scenario.simulationEndTick)
  recordExportCreated(recorder, state.currentTick, monotonicNow)

  const exported = createPlaytestExport(
    recorder,
    state,
    1_500,
    monotonicNow + 10,
  )
  return {
    state,
    forecastSnapshots,
    recaps: state.recaps,
    candidateEditGroups: exported.candidateEditGroups,
    candidateManagementCommitmentGroups:
      exported.candidateManagementCommitmentGroups,
    choiceSets: exported.choiceSets,
    normalizedExport: {
      ...exported,
      meta: {
        ...exported.meta,
        sessionId: '<excluded-random-session-id>',
      },
    },
  }
}

describe('Phase 6 deterministic simulation evidence', () => {
  it('repeats state, forecasts, both recaps, candidate groups, and normalized export', () => {
    const first = runTwoWeekTrace()
    const second = runTwoWeekTrace()

    expect(first.state.isComplete).toBe(true)
    expect(first.recaps).toHaveLength(2)
    expect(first).toEqual(second)
  })
})
