// @ts-nocheck -- the production host is an ESM .mjs script without a declaration file.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateCapturedExport } from '../scripts/playtest-host.mjs'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import {
  advanceSimulation,
  applyPlayerAction,
  createPlayerAction,
} from '../src/sim/engine'
import { calculateFoodForecast } from '../src/sim/forecast'
import type { SimulationState, WeekendRecap } from '../src/sim/model'
import {
  createBlockedPlaytestExport,
  createPlaytestExport,
} from '../src/telemetry/export'
import {
  createSessionRecorder,
  recordBlockedCaptureCreated,
  recordExportCreated,
  recordPlayerTransition,
  stableStateHash,
} from '../src/telemetry/session'

function buildMetadata() {
  return {
    buildId: 'g1-e2e-unit.1',
    gitSha: '1111111111111111111111111111111111111111',
    artifactHash: '2'.repeat(64),
    artifactHashAlgorithm: 'sha256-canonical-file-manifest-v1' as const,
    artifactManifestPath: 'artifact-manifest.json' as const,
    initialStateHash: stableStateHash(scenario.createInitialState()),
    initialStateHashAlgorithm: 'fnv1a32-stable-json-v1' as const,
  }
}

function recap(): WeekendRecap {
  const supply = {
    planned: { low: 1, high: 2 },
    actual: 1,
    endingStock: 1,
    reasons: [],
  }
  return {
    planned: { low: 1, high: 2 },
    actual: 1,
    supplies: {
      food: supply,
      repair: supply,
    },
    fertilizer: {
      appliedWeekIndex: null,
      remainingUnits: 1,
      bonus: 0,
    },
    headline: '测试复盘',
    items: [],
  }
}

function v2CompleteExport() {
  const initial = scenario.createInitialState()
  const metadata = buildMetadata()
  const recorder = createSessionRecorder(
    'A38',
    initial,
    metadata,
    1_000,
    100,
  )
  const weekRecap = recap()
  const complete: SimulationState = {
    ...initial,
    currentTick: scenario.simulationEndTick,
    isComplete: true,
    completedWeekIndexes: [0, 1],
    recap: weekRecap,
    recaps: [weekRecap, weekRecap],
  }
  recordExportCreated(recorder, complete.currentTick, 140)
  return {
    metadata,
    payload: createPlaytestExport(
      recorder,
      complete,
      1_100,
      150,
    ),
  }
}

function v2BlockedExport() {
  const initial = scenario.createInitialState()
  const metadata = buildMetadata()
  const recorder = createSessionRecorder(
    'TECH-RC9-P01',
    initial,
    metadata,
    1_000,
    100,
  )
  recordBlockedCaptureCreated(recorder, initial.currentTick, 140)
  return {
    metadata,
    payload: createBlockedPlaytestExport(
      recorder,
      initial,
      '可复现阻断',
      1_100,
      150,
    ),
  }
}

function v2FoodCommitmentBlockedExport() {
  const initial = scenario.createInitialState()
  const metadata = buildMetadata()
  const recorder = createSessionRecorder(
    'TECH-RC9-D29',
    initial,
    metadata,
    1_000,
    100,
  )
  const envelope = createPlayerAction(1, initial.currentTick, {
    type: 'SET_FOOD_SHORTFALL_ACCEPTED',
    accepted: true,
  })
  const result = applyPlayerAction(initial, envelope, scenario)
  recordPlayerTransition(recorder, initial, envelope, result, 120)
  recordBlockedCaptureCreated(
    recorder,
    result.state.currentTick,
    140,
  )
  return {
    metadata,
    payload: createBlockedPlaytestExport(
      recorder,
      result.state,
      '承诺后出现可复现阻断',
      1_100,
      150,
    ),
  }
}

function weekTwoState() {
  let state = scenario.createInitialState()
  state = advanceSimulation(
    state,
    scenario.pumpEventTick,
    scenario,
  ).state
  state = advanceSimulation(
    state,
    scenario.weekEndTick,
    scenario,
  ).state
  return applyPlayerAction(
    state,
    createPlayerAction(1, state.currentTick, {
      type: 'CONTINUE_TO_NEXT_WEEK',
    }),
    scenario,
  ).state
}

function withLightFoodGap(state: SimulationState) {
  for (let food = 0; food <= 50; food += 1) {
    const candidate = {
      ...state,
      inventory: { ...state.inventory, food },
    }
    if (calculateFoodForecast(candidate).status === '轻度缺口') {
      return candidate
    }
  }
  throw new Error('测试前态无法构造轻度粮食缺口')
}

function v2BlockedAfterActions(
  sampleId: string,
  before: SimulationState,
  actionSpecs: readonly object[],
) {
  const initial = scenario.createInitialState()
  const metadata = buildMetadata()
  const recorder = createSessionRecorder(
    sampleId,
    initial,
    metadata,
    1_000,
    100,
  )
  let state = before
  actionSpecs.forEach((action, index) => {
    const envelope = createPlayerAction(
      state.actionLog.length + 1,
      state.currentTick,
      action,
    )
    const result = applyPlayerAction(state, envelope, scenario)
    recordPlayerTransition(
      recorder,
      state,
      envelope,
      result,
      120 + index,
    )
    state = result.state
  })
  recordBlockedCaptureCreated(recorder, state.currentTick, 140)
  return {
    metadata,
    payload: createBlockedPlaytestExport(
      recorder,
      state,
      '语义 round-trip',
      1_100,
      150,
    ),
  }
}

function blockedPayloadFromFixture(fileName: string) {
  const fixture = JSON.parse(
    readFileSync(
      resolve('tests', 'fixtures', 'playtest-v2', fileName),
      'utf8',
    ),
  ).input
  const base = v2BlockedExport()
  const actionBaseIds = [
    ...new Set(
      fixture.actions.map(({ id }: { id: string }) =>
        id.split(':')[0],
      ),
    ),
  ]
  const telemetry = [
    base.payload.telemetry[0],
    base.payload.telemetry[1],
    base.payload.telemetry[2],
    ...actionBaseIds.map((actionId, index) => ({
      sequence: 4 + index,
      type: 'player-action-applied',
      atTick: 54,
      machineOffsetMs: 20 + index,
      fromTick: 54,
      toTick: 54,
      actionId,
      domainEventIds: [],
    })),
    {
      sequence: 4 + actionBaseIds.length,
      type: 'blocked-capture-created',
      atTick: 54,
      machineOffsetMs: 40,
    },
  ]
  return {
    metadata: base.metadata,
    payload: {
      ...base.payload,
      meta: {
        ...base.payload.meta,
        sampleId: fixture.meta.sampleId,
      },
      actions: fixture.actions,
      candidateEditGroups: fixture.candidateEditGroups,
      choiceSets: fixture.choiceSets,
      candidateManagementCommitmentGroups:
        fixture.candidateManagementCommitmentGroups,
      telemetry,
      summary: {
        week1CandidateEditCount:
          fixture.candidateEditGroups.filter(
            ({ groupId }: { groupId: string }) =>
              groupId.startsWith('legacy:w0:'),
          ).length,
        week2CandidateEditCount:
          fixture.candidateEditGroups.filter(
            ({ groupId }: { groupId: string }) =>
              groupId.startsWith('legacy:w1:'),
          ).length,
        week1CandidateManagementCount:
          fixture.candidateManagementCommitmentGroups.filter(
            ({ weekIndex }: { weekIndex: number }) =>
              weekIndex === 0,
          ).length,
        week2CandidateManagementCount:
          fixture.candidateManagementCommitmentGroups.filter(
            ({ weekIndex }: { weekIndex: number }) =>
              weekIndex === 1,
          ).length,
      },
    },
  }
}

describe('Gate 1 capture host contracts', () => {
  it('accepts strict v2 complete and blocked production exports', () => {
    const complete = v2CompleteExport()
    const blocked = v2BlockedExport()
    const terminalBlocked = {
      ...complete.payload,
      captureKind: 'blocked',
      blockedAtTick: scenario.simulationEndTick,
      blockedReason: '两周复盘已生成，但完成状态未生效',
      finalState: {
        ...complete.payload.finalState,
        isComplete: false,
      },
      telemetry: complete.payload.telemetry.map((entry, index, entries) =>
        index === entries.length - 1
          ? { ...entry, type: 'blocked-capture-created' }
          : entry,
      ),
    }

    expect(
      validateCapturedExport(complete.payload, complete.metadata),
    ).toBe(true)
    expect(
      validateCapturedExport(blocked.payload, blocked.metadata),
    ).toBe(true)
    expect(
      validateCapturedExport(terminalBlocked, complete.metadata),
    ).toBe(true)
    const committed = v2FoodCommitmentBlockedExport()
    expect(
      validateCapturedExport(committed.payload, committed.metadata),
    ).toBe(true)
  })

  it('accepts production commitments for every frozen decision intent', () => {
    const initial = scenario.createInitialState()
    const cases = [
      v2BlockedAfterActions('TECH-RC9-D60', initial, [
        {
          type: 'EDIT_SCHEDULE',
          blockIds: ['qiao-pan:d1:b1'],
          activity: 'food',
          scope: 'weekly',
        },
      ]),
      v2BlockedAfterActions('TECH-RC9-D61', initial, [
        {
          type: 'SELECT_REPAIR_RESPONSIBILITY',
          responsible: 'qiao-pan',
        },
        {
          type: 'EDIT_SCHEDULE',
          blockIds: ['qiao-pan:d3:b2'],
          activity: 'repair',
          scope: 'weekly',
        },
      ]),
      v2BlockedAfterActions('TECH-RC9-D62', initial, [
        { type: 'ACCEPT_REPAIR_DEBT' },
      ]),
      v2BlockedAfterActions('TECH-RC9-D63', weekTwoState(), [
        {
          type: 'RESOLVE_LIN_HE_REQUEST',
          decision: 'accepted',
        },
      ]),
      v2BlockedAfterActions('TECH-RC9-D64', initial, [
        { type: 'OPEN_TRANSPORT_SHORTCUT' },
      ]),
      v2BlockedAfterActions('TECH-RC9-D65', initial, [
        { type: 'USE_FERTILIZER' },
      ]),
      v2BlockedAfterActions('TECH-RC9-D73', initial, [
        {
          type: 'SELECT_REPAIR_RESPONSIBILITY',
          responsible: 'qiao-pan',
        },
        {
          type: 'EDIT_SCHEDULE',
          blockIds: ['qiao-pan:d3:b2', 'qiao-pan:d3:b3'],
          activity: 'repair',
          scope: 'weekly',
        },
      ]),
      v2BlockedAfterActions('TECH-RC9-D74', initial, [
        {
          type: 'EDIT_SCHEDULE',
          blockIds: ['qiao-pan:d4:b2'],
          activity: 'repair',
          scope: 'weekly',
        },
        {
          type: 'SELECT_REPAIR_RESPONSIBILITY',
          responsible: 'qiao-pan',
        },
        {
          type: 'COPY_DAY',
          characterId: 'qiao-pan',
          sourceDayIndex: 4,
          targetDayIndex: 3,
          scope: 'weekly',
        },
      ]),
    ]

    for (const { payload, metadata } of cases) {
      expect(validateCapturedExport(payload, metadata)).toBe(true)
    }
  })

  it('accepts valid raw evidence without inflating a food commitment', () => {
    const initial = scenario.createInitialState()
    const late = v2BlockedAfterActions(
      'TECH-RC9-D66',
      withLightFoodGap(
        advanceSimulation(initial, 240, scenario).state,
      ),
      [
        {
          type: 'SET_FOOD_SHORTFALL_ACCEPTED',
          accepted: true,
        },
      ],
    )
    const weekTwoFood = v2BlockedAfterActions(
      'TECH-RC9-D72',
      withLightFoodGap(weekTwoState()),
      [
        {
          type: 'SET_FOOD_SHORTFALL_ACCEPTED',
          accepted: true,
        },
      ],
    )
    const conflict = v2BlockedAfterActions(
      'TECH-RC9-D67',
      initial,
      [
        {
          type: 'SET_FOOD_SHORTFALL_ACCEPTED',
          accepted: true,
        },
        {
          type: 'EDIT_SCHEDULE',
          blockIds: ['qiao-pan:d1:b1'],
          activity: 'food',
          scope: 'weekly',
        },
      ],
    )
    const unrelated = v2BlockedAfterActions(
      'TECH-RC9-D68',
      initial,
      [
        {
          type: 'EDIT_SCHEDULE',
          blockIds: ['qiao-pan:d1:b1'],
          activity: 'study',
          scope: 'weekly',
        },
      ],
    )
    const unsupportedRepairFinal = v2BlockedAfterActions(
      'TECH-RC9-D69',
      initial,
      [
        {
          type: 'SELECT_REPAIR_RESPONSIBILITY',
          responsible: 'qiao-pan',
        },
        {
          type: 'EDIT_SCHEDULE',
          blockIds: ['qiao-pan:d3:b2'],
          activity: 'repair',
          scope: 'weekly',
        },
        {
          type: 'EDIT_SCHEDULE',
          blockIds: ['qiao-pan:d3:b2'],
          activity: 'study',
          scope: 'weekly',
        },
      ],
    )

    expect(
      validateCapturedExport(late.payload, late.metadata),
    ).toBe(true)
    expect(
      validateCapturedExport(
        weekTwoFood.payload,
        weekTwoFood.metadata,
      ),
    ).toBe(true)
    expect(
      validateCapturedExport(conflict.payload, conflict.metadata),
    ).toBe(true)
    expect(
      validateCapturedExport(
        unrelated.payload,
        unrelated.metadata,
      ),
    ).toBe(true)
    expect(
      validateCapturedExport(
        unsupportedRepairFinal.payload,
        unsupportedRepairFinal.metadata,
      ),
    ).toBe(true)
  })

  it('rejects v2 unknown fields, mixed schemas, and non-canonical ids', () => {
    const { payload, metadata } = v2BlockedExport()

    expect(
      validateCapturedExport(
        { ...payload, unexpected: true },
        metadata,
      ),
    ).toBe(false)
    expect(
      validateCapturedExport(
        { ...payload, schemaVersion: 'gate1-playtest-v1' },
        metadata,
      ),
    ).toBe(false)
    expect(
      validateCapturedExport(
        {
          ...payload,
          meta: { ...payload.meta, sampleId: 'A038' },
        },
        metadata,
      ),
    ).toBe(false)
    expect(
      validateCapturedExport(
        {
          ...payload,
          meta: {
            ...payload.meta,
            sampleId: 'TECH-RC9-D001',
          },
        },
        metadata,
      ),
    ).toBe(false)
    const committed = v2FoodCommitmentBlockedExport()
    expect(
      validateCapturedExport(
        {
          ...committed.payload,
          actions: committed.payload.actions.map((action) => ({
            ...action,
            unexpected: true,
          })),
        },
        committed.metadata,
      ),
    ).toBe(false)
  })

  it('rejects nested v2 evidence fields that are missing or unknown', () => {
    const { payload, metadata } = v2BlockedExport()

    expect(
      validateCapturedExport(
        { ...payload, machineTiming: {} },
        metadata,
      ),
    ).toBe(false)
    expect(
      validateCapturedExport(
        {
          ...payload,
          telemetry: payload.telemetry.map((entry, index) =>
            index === 0 ? { ...entry, unexpected: true } : entry,
          ),
        },
        metadata,
      ),
    ).toBe(false)
    expect(
      validateCapturedExport(
        {
          ...payload,
          speedTrajectory: payload.speedTrajectory.map(
            (entry, index) =>
              index === 0 ? { ...entry, unexpected: true } : entry,
          ),
        },
        metadata,
      ),
    ).toBe(false)
    expect(
      validateCapturedExport(
        {
          ...payload,
          domainEvents: [
            {
              sequence: 1,
              eventId: 'event-1',
              type: 'clock-changed',
              atTick: 54,
              unexpected: true,
            },
          ],
        },
        metadata,
      ),
    ).toBe(false)
  })

  it.each([
    'food-ordinary-reverse-omitted-rejected.json',
    'repair-multiple-active-actors-rejected.json',
    'schedule-reverted-without-undo-rejected.json',
    'food-competing-option-action-rejected.json',
  ])('rejects fixture oracle bypass %s', (fileName) => {
    const { payload, metadata } = blockedPayloadFromFixture(fileName)

    expect(validateCapturedExport(payload, metadata)).toBe(false)
  })

  it('rejects fabricated choices, hashes, and non-persistent default grouping', () => {
    const committed = v2FoodCommitmentBlockedExport()
    const [group] =
      committed.payload.candidateManagementCommitmentGroups
    const [choiceSet] = committed.payload.choiceSets
    expect(
      validateCapturedExport(
        {
          ...committed.payload,
          choiceSets: [
            {
              ...choiceSet,
              options: choiceSet.options.map((option, index) => ({
                ...option,
                optionId: `magic-${index}`,
              })),
              selectedOptionId: 'magic-0',
            },
          ],
          candidateManagementCommitmentGroups: [
            {
              ...group,
              beforeDecisionStateHash: 'a'.repeat(64),
              finalDecisionStateHash: 'b'.repeat(64),
              finalOutcomeCode: 'committed:magic-0',
            },
          ],
        },
        committed.metadata,
      ),
    ).toBe(false)

    const declined = blockedPayloadFromFixture(
      'request-declined-persistent-valid.json',
    )
    expect(
      validateCapturedExport(
        {
          ...declined.payload,
          actions: declined.payload.actions.map((action) => ({
            ...action,
            persistentCharacterRecord: false,
          })),
        },
        declined.metadata,
      ),
    ).toBe(false)
  })

  it('rejects redo without an active prior undo', () => {
    const { payload, metadata } = blockedPayloadFromFixture(
      'schedule-reverted-without-undo-rejected.json',
    )
    const edit = payload.actions[0]
    const redo = {
      id: 'action-0002',
      type: 'REDO',
      replaysActionId: edit.id,
    }

    expect(
      validateCapturedExport(
        {
          ...payload,
          actions: [edit, redo],
          candidateEditGroups: [
            {
              groupId: 'legacy:w0:food-plan',
              actionIds: [edit.id, redo.id],
            },
          ],
          candidateManagementCommitmentGroups:
            payload.candidateManagementCommitmentGroups.map(
              (group) => ({
                ...group,
                actionIds: [edit.id, redo.id],
              }),
            ),
        },
        metadata,
      ),
    ).toBe(false)
  })

  it('rejects an action, telemetry, and terminal tick split across weeks', () => {
    const transport = v2BlockedAfterActions(
      'TECH-RC9-D70',
      scenario.createInitialState(),
      [{ type: 'OPEN_TRANSPORT_SHORTCUT' }],
    )
    const payload = {
      ...transport.payload,
      telemetry: transport.payload.telemetry.map((entry) =>
        entry.type === 'player-action-applied'
          ? {
              ...entry,
              atTick: 1062,
              fromTick: 1062,
              toTick: 1062,
            }
          : entry,
      ),
    }

    expect(
      validateCapturedExport(payload, transport.metadata),
    ).toBe(false)
  })

  it('rejects action order that disagrees with telemetry chronology', () => {
    const initial = scenario.createInitialState()
    const conflict = v2BlockedAfterActions(
      'TECH-RC9-D75',
      initial,
      [
        {
          type: 'SET_FOOD_SHORTFALL_ACCEPTED',
          accepted: true,
        },
        {
          type: 'EDIT_SCHEDULE',
          blockIds: ['qiao-pan:d1:b1'],
          activity: 'food',
          scope: 'weekly',
        },
      ],
    )

    expect(
      validateCapturedExport(
        {
          ...conflict.payload,
          actions: [...conflict.payload.actions].reverse(),
        },
        conflict.metadata,
      ),
    ).toBe(false)
  })

  it('continues to accept a frozen v1 complete capture', () => {
    const capturePath = resolve(
      '..',
      'data/playtests/weekly-management-slice/gate1a',
      'g1a-20260726-rc8-01/captures',
      'g1-rc-20260726.8-A37-5be20eb7-504c-452d-a212-4bbfdc5d392c.json',
    )
    const payload = JSON.parse(readFileSync(capturePath, 'utf8'))
    const metadata = {
      buildId: payload.meta.buildId,
      gitSha: payload.meta.gitSha,
      artifactHash: payload.meta.artifactHash,
      initialStateHash: payload.meta.initialStateHash,
    }

    expect(validateCapturedExport(payload, metadata)).toBe(true)
  })
})
