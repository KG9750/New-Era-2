import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import {
  advanceSimulation,
  applyPlayerAction,
  createPlayerAction,
} from '../src/sim/engine'
import type { SimulationState } from '../src/sim/model'
import { createPlaytestExport } from '../src/telemetry/export'
import {
  createSessionRecorder,
  recordPlayerTransition,
  recordSimulationAdvance,
  recordSpeedChange,
} from '../src/telemetry/session'

const TEST_BUILD_METADATA = {
  buildId: 'g1-e2e-unit.1',
  gitSha: '1111111111111111111111111111111111111111',
  artifactHash: '2'.repeat(64),
  artifactHashAlgorithm: 'sha256-canonical-file-manifest-v1' as const,
  artifactManifestPath: 'artifact-manifest.json' as const,
  initialStateHash: 'fnv1a32-bbad047d',
  initialStateHashAlgorithm: 'fnv1a32-stable-json-v1' as const,
}

describe('Gate 1 playtest evidence contract', () => {
  it('records structured undo, domain events, tick transitions, speed, and raw week duration', () => {
    let state: SimulationState = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'A01',
      state,
      TEST_BUILD_METADATA,
      1_000,
      100,
    )

    const edit = createPlayerAction(1, state.currentTick, {
      type: 'CHANGE_ACTIVITY',
      activity: 'repair',
    })
    let result = applyPlayerAction(state, edit, scenario)
    recordPlayerTransition(recorder, state, edit, result, 120)
    state = result.state

    const undo = createPlayerAction(
      2,
      state.currentTick,
      { type: 'UNDO_SCHEDULE' },
      edit.id,
    )
    result = applyPlayerAction(state, undo, scenario)
    recordPlayerTransition(recorder, state, undo, result, 140)
    state = result.state

    const run = createPlayerAction(3, state.currentTick, {
      type: 'SET_PAUSED',
      paused: false,
    })
    result = applyPlayerAction(state, run, scenario)
    recordPlayerTransition(recorder, state, run, result, 160)
    state = result.state
    recordSpeedChange(recorder, state.currentTick, 8, 170)

    result = advanceSimulation(state, scenario.pumpEventTick, scenario)
    recordSimulationAdvance(recorder, state, result, 8, 200)
    state = result.state

    const continueAfterEvent = createPlayerAction(4, state.currentTick, {
      type: 'SET_PAUSED',
      paused: false,
    })
    result = applyPlayerAction(state, continueAfterEvent, scenario)
    recordPlayerTransition(
      recorder,
      state,
      continueAfterEvent,
      result,
      210,
    )
    state = result.state

    result = advanceSimulation(state, scenario.weekEndTick, scenario)
    recordSimulationAdvance(recorder, state, result, 8, 300)
    state = result.state

    const exported = createPlaytestExport(recorder, state, 1_250, 350)
    expect(exported.actions[1]).toMatchObject({
      id: 'action-0002',
      undoOfActionId: 'action-0001',
    })
    expect(exported.candidateEditGroups[0]).toMatchObject({
      actionId: 'action-0001',
      affectedCellIds: ['lin-he:d1:b1'],
      undoActionIds: ['action-0002'],
    })
    expect(exported.domainEvents.map((event) => event.type)).toContain(
      'pump-incident',
    )
    expect(exported.telemetry.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        'simulation-advanced',
        'auto-pause-triggered',
        'week-completed',
      ]),
    )
    expect(exported.speedTrajectory.at(-1)?.speed).toBe(8)
    expect(exported.machineTiming.week1RawDurationMs).toBe(200)
    expect(exported.summary).toEqual({
      week1CandidateEditCount: 1,
      week2CandidateEditCount: 0,
    })
    expect(exported.summary).not.toHaveProperty('week1EffectiveEditCount')
  })

  it('uses a strict privacy allowlist and gives every fresh session a new id', () => {
    const initial = scenario.createInitialState()
    const first = createSessionRecorder(
      'M-C',
      initial,
      TEST_BUILD_METADATA,
      1_000,
      100,
    )
    const second = createSessionRecorder(
      'M-C',
      initial,
      TEST_BUILD_METADATA,
      2_000,
      200,
    )
    const exported = createPlaytestExport(first, initial, 1_100, 150)

    expect(second.meta.sessionId).not.toBe(first.meta.sessionId)
    expect(Object.keys(exported).sort()).toEqual([
      'actions',
      'candidateEditGroups',
      'domainEvents',
      'finalState',
      'finalStateHash',
      'finalTick',
      'machineTiming',
      'meta',
      'recap',
      'schemaVersion',
      'speedTrajectory',
      'summary',
      'telemetry',
    ])
    expect(Object.keys(exported.meta).sort()).toEqual([
      'artifactHash',
      'buildId',
      'fixedSeed',
      'gitSha',
      'initialStateHash',
      'inputDevice',
      'sampleId',
      'scenarioId',
      'scenarioVersion',
      'sessionId',
      'viewport',
    ])
    const json = JSON.stringify(exported)
    for (const forbidden of [
      'realName',
      'email',
      'phone',
      'contact',
      'hostNotes',
      'freeText',
      'location.href',
      'Error.stack',
      '/Users/',
    ]) {
      expect(json).not.toContain(forbidden)
    }
  })
})
