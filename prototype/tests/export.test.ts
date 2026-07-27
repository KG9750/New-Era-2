import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import {
  advanceSimulation,
  applyPlayerAction,
  createPlayerAction,
} from '../src/sim/engine'
import { calculateFoodForecast } from '../src/sim/forecast'
import {
  PREVENTIVE_CAPACITY_DEADLINE_TICK,
  PREVENTIVE_CAPACITY_CHOICE_SET_ID,
  RECOVERY_ALLOCATION_CHOICE_SET_ID,
  bindManagementChoiceAuthority,
  createManagementChoiceCommitRequest,
} from '../src/sim/management-choices'
import type {
  ManagementCandidateId,
  PlayerAction,
  SimulationState,
} from '../src/sim/model'
import {
  createBlockedPlaytestExport,
  createPlaytestExport,
} from '../src/telemetry/export'
import {
  createSessionRecorder,
  recordBlockedCaptureCreated,
  recordPlayerTransition,
  recordSimulationAdvance,
  stableStateHash,
} from '../src/telemetry/session'
import type { SessionRecorder } from '../src/telemetry/session'

function startWeekTwo(): SimulationState {
  let state = scenario.createInitialState()
  state = advanceSimulation(state, scenario.pumpEventTick, scenario).state
  state = advanceSimulation(state, scenario.weekEndTick, scenario).state
  const envelope = createPlayerAction(1, state.currentTick, {
    type: 'CONTINUE_TO_NEXT_WEEK',
  })
  return applyPlayerAction(state, envelope, scenario).state
}

function withLightFoodGap(state: SimulationState): SimulationState {
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

function recordAction(
  recorder: SessionRecorder,
  state: SimulationState,
  sequence: number,
  action: PlayerAction,
  monotonicNow: number,
) {
  const envelope = createPlayerAction(
    sequence,
    state.currentTick,
    action,
  )
  const result = applyPlayerAction(state, envelope, scenario)
  recordPlayerTransition(
    recorder,
    state,
    envelope,
    result,
    monotonicNow,
  )
  return result.state
}

function commitManagementCandidate(
  recorder: SessionRecorder,
  state: SimulationState,
  sequence: number,
  candidateId: ManagementCandidateId,
  monotonicNow: number,
) {
  const choiceSetId =
    candidateId === 'schedule-preventive-maintenance' ||
    candidateId === 'retain-rest-capacity'
      ? PREVENTIVE_CAPACITY_CHOICE_SET_ID
      : RECOVERY_ALLOCATION_CHOICE_SET_ID
  return recordAction(
    recorder,
    state,
    sequence,
    {
      type: 'COMMIT_MANAGEMENT_CHOICE',
      request: createManagementChoiceCommitRequest(
        state,
        choiceSetId,
        candidateId,
        `export-v03-${sequence}`,
      ),
    },
    monotonicNow,
  )
}

function v03BlockedExport() {
  const initial = scenario.createInitialState()
  const recorder = createSessionRecorder(
    'TECH-RC9-D80',
    initial,
    buildMetadata(),
    1_000,
    100,
  )
  let state = bindManagementChoiceAuthority(initial, {
    diagnosisId: recorder.meta.diagnosisId,
    sessionId: recorder.meta.sessionId,
    candidateBuildAuthorityHash:
      recorder.meta.candidateBuildAuthorityHash,
    sessionAuthorityToken:
      recorder.meta.sessionAuthorityToken,
  })
  state = commitManagementCandidate(
    recorder,
    state,
    1,
    'retain-rest-capacity',
    110,
  )
  state = recordAction(
    recorder,
    state,
    2,
    { type: 'SET_PAUSED', paused: false },
    120,
  )
  let advanced = advanceSimulation(
    state,
    scenario.pumpEventTick,
    scenario,
  )
  recordSimulationAdvance(
    recorder,
    state,
    advanced,
    3,
    130,
  )
  state = advanced.state
  state = recordAction(
    recorder,
    state,
    3,
    { type: 'SET_PAUSED', paused: false },
    140,
  )
  advanced = advanceSimulation(
    state,
    scenario.weekEndTick,
    scenario,
  )
  recordSimulationAdvance(
    recorder,
    state,
    advanced,
    3,
    150,
  )
  state = advanced.state
  state = recordAction(
    recorder,
    state,
    4,
    { type: 'CONTINUE_TO_NEXT_WEEK' },
    160,
  )
  state = commitManagementCandidate(
    recorder,
    state,
    5,
    'allocate-food-production',
    170,
  )
  recordBlockedCaptureCreated(
    recorder,
    state.currentTick,
    180,
  )
  return createBlockedPlaytestExport(
    recorder,
    state,
    'v0.3 ledger round-trip',
    1_100,
    190,
  )
}

describe('Gate 1 v2 production export', () => {
  it('exports two authority-bound C03 terminals as one complete v0.3 ledger', () => {
    const exported = v03BlockedExport()
    const commitments =
      exported.managementChoiceCommitmentsV03!
    const opportunities =
      exported.managementChoiceOpportunitiesV03!
    const fingerprints = commitments.flatMap(
      (commitment) => commitment.effectFingerprints,
    )

    expect(exported).toMatchObject({
      schemaVersion: 'gate1-playtest-v2',
      protocolVersion:
        'weekly-management-slice-playtest-v0.3',
      scenarioVersion: '0.5.1',
      meta: {
        diagnosisId: 'TECH-RC9-D80',
        protocolVersion:
          'weekly-management-slice-playtest-v0.3',
        scenarioVersion: '0.5.1',
      },
      summary: {
        week1C03TerminalCommitmentCount: 1,
        week2C03TerminalCommitmentCount: 1,
      },
    })
    expect(opportunities).toHaveLength(2)
    expect(
      opportunities.map((opportunity) => [
        opportunity.choiceSetId,
        opportunity.terminalState,
      ]),
    ).toEqual([
      [
        'choice:w0:preventive-capacity',
        'retain-rest-capacity',
      ],
      [
        'choice:w1:recovery-allocation',
        'allocate-food-production',
      ],
    ])
    expect(commitments).toHaveLength(2)
    expect(
      commitments.map((commitment) => [
        commitment.choiceSetId,
        commitment.resourceClaimRef,
        commitment.requiredConsequenceIds,
      ]),
    ).toEqual([
      [
        'choice:w0:preventive-capacity',
        'schedule-slot:lin-he:d1:b1',
        [
          'consequence:w0:preventive-capacity:allocation',
          'consequence:w0:preventive-capacity:rest-recovery',
          'consequence:w0:preventive-capacity:personnel-readiness',
        ],
      ],
      [
        'choice:w1:recovery-allocation',
        'schedule-slot:chen-du:d10:b2',
        [
          'consequence:w1:recovery-allocation:schedule',
          'consequence:w1:recovery-allocation:ending-food',
        ],
      ],
    ])
    expect(new Set(fingerprints).size).toBe(fingerprints.length)
    expect(Object.keys(exported.effectOwnershipV03!).sort()).toEqual(
      [...fingerprints].sort(),
    )
    expect(exported.candidateEditGroups).toEqual([])
  })

  it('exports the frozen omitted terminal when a blocked capture is created after the deadline', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D81',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const state = bindManagementChoiceAuthority(initial, {
      diagnosisId: recorder.meta.diagnosisId,
      sessionId: recorder.meta.sessionId,
      candidateBuildAuthorityHash:
        recorder.meta.candidateBuildAuthorityHash,
      sessionAuthorityToken:
        recorder.meta.sessionAuthorityToken,
    })
    const advanced = advanceSimulation(
      state,
      PREVENTIVE_CAPACITY_DEADLINE_TICK + 1,
      scenario,
    )
    recordSimulationAdvance(
      recorder,
      state,
      advanced,
      3,
      120,
    )
    recordBlockedCaptureCreated(
      recorder,
      advanced.state.currentTick,
      130,
    )

    const exported = createBlockedPlaytestExport(
      recorder,
      advanced.state,
      'deadline 后保存阻断记录',
      1_100,
      140,
    )

    expect(exported.finalTick).toBe(
      PREVENTIVE_CAPACITY_DEADLINE_TICK + 1,
    )
    expect(
      exported.managementChoiceOpportunitiesV03,
    ).toContainEqual(
      expect.objectContaining({
        choiceSetId: PREVENTIVE_CAPACITY_CHOICE_SET_ID,
        terminalState: 'omitted',
      }),
    )
    expect(exported.managementChoiceCommitmentsV03).toEqual([])
    expect(exported.summary).toMatchObject({
      week1C03TerminalCommitmentCount: 0,
      week2C03TerminalCommitmentCount: 0,
    })
  })

  it('classifies an accepted Lin He request into one legacy and one management group', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D01',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const before = startWeekTwo()
    const envelope = createPlayerAction(2, before.currentTick, {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'accepted',
    })
    const result = applyPlayerAction(before, envelope, scenario)
    recordPlayerTransition(recorder, before, envelope, result, 120)

    const exported = createPlaytestExport(recorder, result.state, 1_100, 150)

    expect(exported.schemaVersion).toBe('gate1-playtest-v2')
    expect(exported.actions).toContainEqual(
      expect.objectContaining({
        id: envelope.id,
        type: 'RESOLVE_LIN_HE_REQUEST',
        resolution: 'accepted',
        blockId: 'lin-he:d8:b0',
        fromActivity: 'food',
        toActivity: 'study',
      }),
    )
    expect(exported.candidateEditGroups).toEqual([
      {
        groupId: 'legacy:w1:lin-he-study',
        actionIds: [envelope.id],
      },
    ])
    expect(exported.candidateManagementCommitmentGroups).toHaveLength(1)
    expect(exported.candidateManagementCommitmentGroups[0]).toMatchObject({
      decisionIntentId: 'w1:character-request:lin-he-study',
      choiceSetId: 'choice:w1:lin-he-study',
      weekIndex: 1,
      problemCategory: 'character-request',
      actionIds: [envelope.id],
      finalOutcomeCode: 'committed:accept-study',
      finalDisposition: 'committed',
      beforeDecisionStateHash:
        'e8115a6454c3206d92c99656952e1887cd538e2b2666b377599d8cf5e06cb5d2',
      finalDecisionStateHash:
        'cfcf718d731e52a579f5a5cfa08c5ed79df77e5cf0c30c34e2ba0a346aa1bec6',
    })
    expect(exported.choiceSets).toContainEqual(
      expect.objectContaining({
        choiceSetId: 'choice:w1:lin-he-study',
        selectedOptionId: 'accept-study',
      }),
    )
  })

  it('keeps a declined Lin He request out of legacy edits while preserving its persistent commitment', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D02',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const before = startWeekTwo()
    const envelope = createPlayerAction(2, before.currentTick, {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'declined',
    })
    const result = applyPlayerAction(before, envelope, scenario)
    recordPlayerTransition(recorder, before, envelope, result, 120)

    const exported = createPlaytestExport(recorder, result.state, 1_100, 150)

    expect(exported.actions).toContainEqual({
      id: envelope.id,
      type: 'RESOLVE_LIN_HE_REQUEST',
      resolution: 'declined',
      persistentCharacterRecord: true,
    })
    expect(exported.candidateEditGroups).toEqual([])
    expect(exported.choiceSets[0]?.selectedOptionId).toBe('decline-study')
    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId: 'w1:character-request:lin-he-study',
        actionIds: [envelope.id],
        finalOutcomeCode: 'committed:decline-study',
        finalDisposition: 'committed',
        beforeDecisionStateHash:
          'e8115a6454c3206d92c99656952e1887cd538e2b2666b377599d8cf5e06cb5d2',
        finalDecisionStateHash:
          '4cd8595bc437cc5a46331d1936344c78412831f5e9dc165f2f7f15a72dd1d204',
      }),
    ])
  })

  it('classifies accepting the week-one food shortfall as one food commitment', () => {
    const before = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D17',
      before,
      buildMetadata(),
      1_000,
      100,
    )
    const envelope = createPlayerAction(1, before.currentTick, {
      type: 'SET_FOOD_SHORTFALL_ACCEPTED',
      accepted: true,
    })
    const result = applyPlayerAction(before, envelope, scenario)
    recordPlayerTransition(recorder, before, envelope, result, 120)

    const exported = createPlaytestExport(recorder, result.state, 1_100, 150)

    expect(exported.actions).toContainEqual({
      id: envelope.id,
      type: 'SET_FOOD_SHORTFALL_ACCEPTED',
      accepted: true,
    })
    expect(exported.candidateEditGroups).toEqual([])
    expect(exported.choiceSets).toContainEqual(
      expect.objectContaining({
        choiceSetId: 'choice:w0:food-plan',
        selectedOptionId: 'accept-food-gap',
      }),
    )
    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId: 'w0:food-plan',
        choiceSetId: 'choice:w0:food-plan',
        weekIndex: 0,
        problemCategory: 'food',
        actionIds: [envelope.id],
        beforeDecisionStateHash:
          '963237c894c03a5dfe8d91ed1f17a12a096cfa34ad7e5811d4a7c237f920a6a9',
        finalDecisionStateHash:
          '244e1c3590840fa639700713f093f3e8a5d8b8061d3aad8011ddeaacb7aac8f0',
        finalOutcomeCode: 'committed:accept-food-gap',
        finalDisposition: 'committed',
      }),
    ])
  })

  it('keeps a retracted food-shortfall decision as one reverted intent', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D18',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const accept = createPlayerAction(1, initial.currentTick, {
      type: 'SET_FOOD_SHORTFALL_ACCEPTED',
      accepted: true,
    })
    const accepted = applyPlayerAction(initial, accept, scenario)
    recordPlayerTransition(recorder, initial, accept, accepted, 120)
    const retract = createPlayerAction(2, accepted.state.currentTick, {
      type: 'SET_FOOD_SHORTFALL_ACCEPTED',
      accepted: false,
    })
    const retracted = applyPlayerAction(
      accepted.state,
      retract,
      scenario,
    )
    recordPlayerTransition(
      recorder,
      accepted.state,
      retract,
      retracted,
      130,
    )

    const exported = createPlaytestExport(
      recorder,
      retracted.state,
      1_100,
      150,
    )

    expect(exported.actions).toEqual([
      {
        id: accept.id,
        type: 'SET_FOOD_SHORTFALL_ACCEPTED',
        accepted: true,
      },
      {
        id: retract.id,
        type: 'SET_FOOD_SHORTFALL_ACCEPTED',
        accepted: false,
      },
    ])
    expect(exported.choiceSets[0]?.selectedOptionId).toBeNull()
    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId: 'w0:food-plan',
        actionIds: [accept.id, retract.id],
        beforeDecisionStateHash:
          '963237c894c03a5dfe8d91ed1f17a12a096cfa34ad7e5811d4a7c237f920a6a9',
        finalDecisionStateHash:
          '963237c894c03a5dfe8d91ed1f17a12a096cfa34ad7e5811d4a7c237f920a6a9',
        finalOutcomeCode: 'reverted',
        finalDisposition: 'reverted',
      }),
    ])
  })

  it('normalizes the qualifying week-one food schedule edit into the food intent', () => {
    const before = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'A43',
      before,
      buildMetadata(),
      1_000,
      100,
    )
    const envelope = createPlayerAction(1, before.currentTick, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d1:b1'],
      activity: 'food',
      scope: 'weekly',
    })
    const result = applyPlayerAction(before, envelope, scenario)
    recordPlayerTransition(recorder, before, envelope, result, 120)

    const exported = createPlaytestExport(recorder, result.state, 1_100, 150)

    expect(exported.actions).toContainEqual({
      id: envelope.id,
      type: 'EDIT_SCHEDULE',
      memberId: 'qiao-pan',
      dayIndex: 1,
      blockId: 'qiao-pan:d1:b1',
      fromActivity: 'repair',
      toActivity: 'food',
    })
    expect(exported.candidateEditGroups).toEqual([
      {
        groupId: 'legacy:w0:food-plan',
        actionIds: [envelope.id],
      },
    ])
    expect(exported.choiceSets).toContainEqual(
      expect.objectContaining({
        choiceSetId: 'choice:w0:food-plan',
        selectedOptionId: 'food-shift-qiao',
      }),
    )
    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId: 'w0:food-plan',
        actionIds: [envelope.id],
        beforeDecisionStateHash:
          '8b5fd125cfcf01d9320e43ec07b177f1086452f156572fa49b253d132f8b7bea',
        finalDecisionStateHash:
          '8d7904c8b215ad06653fae43246b8329f6e4c9dbf93aad46f7d9f6fe0770bd98',
        finalOutcomeCode:
          'committed:schedule:8d7904c8b215ad06653fae43246b8329f6e4c9dbf93aad46f7d9f6fe0770bd98',
        finalDisposition: 'committed',
      }),
    ])
  })

  it('normalizes schedule undo and classifies the food edit as reverted', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'A44',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const edit = createPlayerAction(1, initial.currentTick, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d1:b1'],
      activity: 'food',
      scope: 'weekly',
    })
    const edited = applyPlayerAction(initial, edit, scenario)
    recordPlayerTransition(recorder, initial, edit, edited, 120)
    const undo = createPlayerAction(
      2,
      edited.state.currentTick,
      { type: 'UNDO_SCHEDULE' },
      edit.id,
    )
    const undone = applyPlayerAction(edited.state, undo, scenario)
    recordPlayerTransition(recorder, edited.state, undo, undone, 130)

    const exported = createPlaytestExport(
      recorder,
      undone.state,
      1_100,
      150,
    )

    expect(exported.actions).toEqual([
      {
        id: edit.id,
        type: 'EDIT_SCHEDULE',
        memberId: 'qiao-pan',
        dayIndex: 1,
        blockId: 'qiao-pan:d1:b1',
        fromActivity: 'repair',
        toActivity: 'food',
      },
      {
        id: undo.id,
        type: 'UNDO',
        revertsActionId: edit.id,
      },
    ])
    expect(exported.candidateEditGroups).toEqual([
      {
        groupId: 'legacy:w0:food-plan',
        actionIds: [edit.id, undo.id],
      },
    ])
    expect(exported.choiceSets[0]?.selectedOptionId).toBeNull()
    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId: 'w0:food-plan',
        actionIds: [edit.id, undo.id],
        beforeDecisionStateHash:
          '8b5fd125cfcf01d9320e43ec07b177f1086452f156572fa49b253d132f8b7bea',
        finalDecisionStateHash:
          '8b5fd125cfcf01d9320e43ec07b177f1086452f156572fa49b253d132f8b7bea',
        finalOutcomeCode: 'reverted',
        finalDisposition: 'reverted',
      }),
    ])
  })

  it('keeps the normalized food member of a multi-block copy and undo in one chain', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D71',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const prepare = createPlayerAction(1, initial.currentTick, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d0:b0', 'qiao-pan:d0:b1'],
      activity: 'food',
      scope: 'weekly',
    })
    const prepared = applyPlayerAction(initial, prepare, scenario)
    recordPlayerTransition(
      recorder,
      initial,
      prepare,
      prepared,
      110,
    )
    const copy = createPlayerAction(2, prepared.state.currentTick, {
      type: 'COPY_DAY',
      characterId: 'qiao-pan',
      sourceDayIndex: 0,
      targetDayIndex: 1,
      scope: 'weekly',
    })
    const copied = applyPlayerAction(prepared.state, copy, scenario)
    recordPlayerTransition(
      recorder,
      prepared.state,
      copy,
      copied,
      120,
    )
    const undo = createPlayerAction(
      3,
      copied.state.currentTick,
      { type: 'UNDO_SCHEDULE' },
      copy.id,
    )
    const undone = applyPlayerAction(copied.state, undo, scenario)
    recordPlayerTransition(
      recorder,
      copied.state,
      undo,
      undone,
      130,
    )

    const exported = createPlaytestExport(
      recorder,
      undone.state,
      1_100,
      150,
    )

    expect(exported.candidateEditGroups).toEqual([
      {
        groupId: 'legacy:w0:food-plan',
        actionIds: [`${copy.id}:2`, `${undo.id}:2`],
      },
    ])
    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId: 'w0:food-plan',
        actionIds: [`${copy.id}:2`, `${undo.id}:2`],
        finalDisposition: 'reverted',
      }),
    ])
  })

  it('classifies a confirmed Qiao Pan repair schedule without a legacy edit', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D19',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const select = createPlayerAction(1, initial.currentTick, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'qiao-pan',
    })
    const selected = applyPlayerAction(initial, select, scenario)
    recordPlayerTransition(recorder, initial, select, selected, 110)
    const edit = createPlayerAction(2, selected.state.currentTick, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d3:b2'],
      activity: 'repair',
      scope: 'weekly',
    })
    const edited = applyPlayerAction(selected.state, edit, scenario)
    recordPlayerTransition(
      recorder,
      selected.state,
      edit,
      edited,
      120,
    )

    const exported = createPlaytestExport(
      recorder,
      edited.state,
      1_100,
      150,
    )

    expect(exported.actions).toEqual([
      {
        id: select.id,
        type: 'SELECT_REPAIR_RESPONSIBILITY',
        responsible: 'qiao-pan',
        scheduleConfirmed: false,
      },
      {
        id: edit.id,
        type: 'EDIT_SCHEDULE',
        memberId: 'qiao-pan',
        dayIndex: 3,
        blockId: 'qiao-pan:d3:b2',
        fromActivity: 'rest',
        toActivity: 'repair',
        responsibility: 'scheduled',
      },
    ])
    expect(exported.candidateEditGroups).toEqual([])
    expect(exported.choiceSets).toContainEqual(
      expect.objectContaining({
        choiceSetId: 'choice:w0:pump-repair',
        selectedOptionId: 'schedule-repair',
      }),
    )
    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId:
          'w0:repair-responsibility:pump-incident-day-3',
        weekIndex: 0,
        problemCategory: 'repair',
        actionIds: [edit.id],
        beforeDecisionStateHash:
          '5e06411dbfd7c0405df2884f294a49208ea9b89241a6619a3122f7a91fc83960',
        finalDecisionStateHash:
          'fb19e1bc01aa464a5af6812d71be406fb1144eb7ec48ed91d8ce325b3728afb8',
        finalOutcomeCode: 'committed:schedule-repair',
        finalDisposition: 'committed',
      }),
    ])
  })

  it('keeps an undone repair schedule as one reverted repair intent', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D28',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const select = createPlayerAction(1, initial.currentTick, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'qiao-pan',
    })
    const selected = applyPlayerAction(initial, select, scenario)
    recordPlayerTransition(recorder, initial, select, selected, 110)
    const edit = createPlayerAction(2, selected.state.currentTick, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d3:b2'],
      activity: 'repair',
      scope: 'weekly',
    })
    const edited = applyPlayerAction(selected.state, edit, scenario)
    recordPlayerTransition(
      recorder,
      selected.state,
      edit,
      edited,
      120,
    )
    const undo = createPlayerAction(
      3,
      edited.state.currentTick,
      { type: 'UNDO_SCHEDULE' },
      edit.id,
    )
    const undone = applyPlayerAction(edited.state, undo, scenario)
    recordPlayerTransition(recorder, edited.state, undo, undone, 130)

    const exported = createPlaytestExport(
      recorder,
      undone.state,
      1_100,
      150,
    )

    expect(exported.actions).toContainEqual({
      id: undo.id,
      type: 'UNDO',
      revertsActionId: edit.id,
    })
    expect(exported.choiceSets).toContainEqual(
      expect.objectContaining({
        choiceSetId: 'choice:w0:pump-repair',
        selectedOptionId: null,
      }),
    )
    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId:
          'w0:repair-responsibility:pump-incident-day-3',
        actionIds: [edit.id, undo.id],
        beforeDecisionStateHash:
          '5e06411dbfd7c0405df2884f294a49208ea9b89241a6619a3122f7a91fc83960',
        finalDecisionStateHash:
          '5e06411dbfd7c0405df2884f294a49208ea9b89241a6619a3122f7a91fc83960',
        finalOutcomeCode: 'reverted',
        finalDisposition: 'reverted',
      }),
    ])
  })

  it('keeps a repair reassignment and its ordinary reverse in one intent', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D50',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    let state = initial
    const envelopes = [
      createPlayerAction(1, state.currentTick, {
        type: 'SELECT_REPAIR_RESPONSIBILITY',
        responsible: 'qiao-pan',
      }),
    ]
    let result = applyPlayerAction(state, envelopes[0], scenario)
    recordPlayerTransition(
      recorder,
      state,
      envelopes[0],
      result,
      110,
    )
    state = result.state
    for (const [sequence, blockId, activity] of [
      [2, 'qiao-pan:d3:b2', 'repair'],
      [3, 'qiao-pan:d3:b2', 'rest'],
    ] as const) {
      const envelope = createPlayerAction(sequence, state.currentTick, {
        type: 'EDIT_SCHEDULE',
        blockIds: [blockId],
        activity,
        scope: 'weekly',
      })
      envelopes.push(envelope)
      result = applyPlayerAction(state, envelope, scenario)
      recordPlayerTransition(
        recorder,
        state,
        envelope,
        result,
        110 + sequence,
      )
      state = result.state
    }
    const handoff = createPlayerAction(4, state.currentTick, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'handoff',
    })
    envelopes.push(handoff)
    result = applyPlayerAction(state, handoff, scenario)
    recordPlayerTransition(recorder, state, handoff, result, 114)
    state = result.state
    const chen = createPlayerAction(5, state.currentTick, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['chen-du:d3:b0'],
      activity: 'repair',
      scope: 'weekly',
    })
    envelopes.push(chen)
    result = applyPlayerAction(state, chen, scenario)
    recordPlayerTransition(recorder, state, chen, result, 115)

    const exported = createPlaytestExport(
      recorder,
      result.state,
      1_100,
      150,
    )

    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId:
          'w0:repair-responsibility:pump-incident-day-3',
        actionIds: [
          envelopes[1].id,
          envelopes[2].id,
          envelopes[4].id,
        ],
        beforeDecisionStateHash:
          'b62ec445e929fe3165d9384f3d86d15d5388ea6015a16580874ec46d11efd493',
        finalDecisionStateHash:
          '909eb9b5b92444be6ab665c4810abb27cb6b2a0942e40cf50a8aaf5814fa86ee',
        finalOutcomeCode: 'committed:schedule-repair',
        finalDisposition: 'committed',
      }),
    ])
  })

  it('classifies an ordinary repair reverse with no later reassignment as reverted', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D55',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const select = createPlayerAction(1, initial.currentTick, {
      type: 'SELECT_REPAIR_RESPONSIBILITY',
      responsible: 'qiao-pan',
    })
    const selected = applyPlayerAction(initial, select, scenario)
    recordPlayerTransition(recorder, initial, select, selected, 110)
    const edit = createPlayerAction(2, selected.state.currentTick, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d3:b2'],
      activity: 'repair',
      scope: 'weekly',
    })
    const edited = applyPlayerAction(selected.state, edit, scenario)
    recordPlayerTransition(
      recorder,
      selected.state,
      edit,
      edited,
      120,
    )
    const reverse = createPlayerAction(3, edited.state.currentTick, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d3:b2'],
      activity: 'rest',
      scope: 'weekly',
    })
    const reversed = applyPlayerAction(
      edited.state,
      reverse,
      scenario,
    )
    recordPlayerTransition(
      recorder,
      edited.state,
      reverse,
      reversed,
      130,
    )

    const exported = createPlaytestExport(
      recorder,
      reversed.state,
      1_100,
      150,
    )

    expect(exported.choiceSets).toContainEqual(
      expect.objectContaining({
        choiceSetId: 'choice:w0:pump-repair',
        selectedOptionId: null,
      }),
    )
    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId:
          'w0:repair-responsibility:pump-incident-day-3',
        actionIds: [edit.id, reverse.id],
        finalDisposition: 'reverted',
        finalOutcomeCode: 'reverted',
      }),
    ])
    const [group] = exported.candidateManagementCommitmentGroups
    expect(group.beforeDecisionStateHash).toBe(
      group.finalDecisionStateHash,
    )
  })

  it('does not count a late or cross-week food response as a two-option commitment', () => {
    const initial = scenario.createInitialState()
    const cases = [
      withLightFoodGap(
        advanceSimulation(initial, 240, scenario).state,
      ),
      withLightFoodGap(startWeekTwo()),
    ]

    cases.forEach((before, index) => {
      const recorder = createSessionRecorder(
        `TECH-RC9-D${56 + index}`,
        initial,
        buildMetadata(),
        1_000,
        100,
      )
      const action = createPlayerAction(
        index + 1,
        before.currentTick,
        {
          type: 'SET_FOOD_SHORTFALL_ACCEPTED',
          accepted: true,
        },
      )
      const result = applyPlayerAction(before, action, scenario)
      recordPlayerTransition(recorder, before, action, result, 120)

      const exported = createPlaytestExport(
        recorder,
        result.state,
        1_100,
        150,
      )
      const foodChoice = exported.choiceSets.find(
        ({ choiceSetId }) => choiceSetId === 'choice:w0:food-plan',
      )

      expect(
        exported.candidateManagementCommitmentGroups.some(
          ({ decisionIntentId }) =>
            decisionIntentId === 'w0:food-plan',
        ),
      ).toBe(false)
      if (index === 0) {
        expect(
          foodChoice?.options.find(
            ({ optionId }) => optionId === 'food-shift-qiao',
          )?.reachable,
        ).toBe(false)
      } else {
        expect(foodChoice).toBeUndefined()
      }
    })
  })

  it('does not count mutually active food alternatives as one commitment', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D58',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const accept = createPlayerAction(1, initial.currentTick, {
      type: 'SET_FOOD_SHORTFALL_ACCEPTED',
      accepted: true,
    })
    const accepted = applyPlayerAction(initial, accept, scenario)
    recordPlayerTransition(recorder, initial, accept, accepted, 110)
    const edit = createPlayerAction(2, accepted.state.currentTick, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d1:b1'],
      activity: 'food',
      scope: 'weekly',
    })
    const edited = applyPlayerAction(accepted.state, edit, scenario)
    recordPlayerTransition(
      recorder,
      accepted.state,
      edit,
      edited,
      120,
    )

    const exported = createPlaytestExport(
      recorder,
      edited.state,
      1_100,
      150,
    )

    expect(
      exported.choiceSets.find(
        ({ choiceSetId }) => choiceSetId === 'choice:w0:food-plan',
      )?.selectedOptionId,
    ).toBeNull()
    expect(
      exported.candidateManagementCommitmentGroups.some(
        ({ decisionIntentId }) =>
          decisionIntentId === 'w0:food-plan',
      ),
    ).toBe(false)
  })

  it('keeps an unrelated edit on the observed food block out of the commitment classifier', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D59',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    const edit = createPlayerAction(1, initial.currentTick, {
      type: 'EDIT_SCHEDULE',
      blockIds: ['qiao-pan:d1:b1'],
      activity: 'study',
      scope: 'weekly',
    })
    const edited = applyPlayerAction(initial, edit, scenario)
    recordPlayerTransition(
      recorder,
      initial,
      edit,
      edited,
      120,
    )

    const exported = createPlaytestExport(
      recorder,
      edited.state,
      1_100,
      150,
    )

    expect(exported.candidateEditGroups).toEqual([
      {
        groupId: 'legacy:w0:food-plan',
        actionIds: [edit.id],
      },
    ])
    expect(exported.choiceSets).toEqual([])
    expect(exported.candidateManagementCommitmentGroups).toEqual([])
  })

  it.each([
    {
      sampleId: 'TECH-RC9-D20',
      blockId: 'chen-du:d3:b0',
      memberId: 'chen-du',
      fromActivity: 'food',
      beforeHash:
        '8d41f1808f4f8e90d16d1736f9e38250f601a37b328c9f9b3264c6a65809b2dd',
      finalHash:
        '67171c70d00b96c6ccaf9f20380e671abe2d3e2e9595eb5d9e7e9e3b823e7586',
    },
    {
      sampleId: 'TECH-RC9-D21',
      blockId: 'su-ji:d3:b0',
      memberId: 'su-ji',
      fromActivity: 'logistics',
      beforeHash:
        '4c3cafe9fb7d180d626a237176a84f86c68bfa52888052c4c13621cd14b675b3',
      finalHash:
        '7a0611b8727b312c00688283873e1358d25b1501c906484c2745490e6b0709f1',
    },
  ])(
    'classifies the $memberId handoff as the same repair option',
    ({
      sampleId,
      blockId,
      memberId,
      fromActivity,
      beforeHash,
      finalHash,
    }) => {
      const initial = scenario.createInitialState()
      const recorder = createSessionRecorder(
        sampleId,
        initial,
        buildMetadata(),
        1_000,
        100,
      )
      const select = createPlayerAction(1, initial.currentTick, {
        type: 'SELECT_REPAIR_RESPONSIBILITY',
        responsible: 'handoff',
      })
      const selected = applyPlayerAction(initial, select, scenario)
      recordPlayerTransition(recorder, initial, select, selected, 110)
      const edit = createPlayerAction(2, selected.state.currentTick, {
        type: 'EDIT_SCHEDULE',
        blockIds: [blockId],
        activity: 'repair',
        scope: 'weekly',
      })
      const edited = applyPlayerAction(selected.state, edit, scenario)
      recordPlayerTransition(
        recorder,
        selected.state,
        edit,
        edited,
        120,
      )

      const exported = createPlaytestExport(
        recorder,
        edited.state,
        1_100,
        150,
      )

      expect(exported.actions).toContainEqual({
        id: edit.id,
        type: 'EDIT_SCHEDULE',
        memberId,
        dayIndex: 3,
        blockId,
        fromActivity,
        toActivity: 'repair',
        responsibility: 'scheduled',
      })
      expect(
        exported.candidateManagementCommitmentGroups,
      ).toEqual([
        expect.objectContaining({
          decisionIntentId:
            'w0:repair-responsibility:pump-incident-day-3',
          actionIds: [edit.id],
          beforeDecisionStateHash: beforeHash,
          finalDecisionStateHash: finalHash,
          finalOutcomeCode: 'committed:schedule-repair',
          finalDisposition: 'committed',
        }),
      ])
    },
  )

  it('classifies accepting repair debt as a persistent repair commitment', () => {
    const before = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D22',
      before,
      buildMetadata(),
      1_000,
      100,
    )
    const envelope = createPlayerAction(1, before.currentTick, {
      type: 'ACCEPT_REPAIR_DEBT',
    })
    const result = applyPlayerAction(before, envelope, scenario)
    recordPlayerTransition(recorder, before, envelope, result, 120)

    const exported = createPlaytestExport(recorder, result.state, 1_100, 150)

    expect(exported.actions).toContainEqual({
      id: envelope.id,
      type: 'ACCEPT_REPAIR_DEBT',
    })
    expect(exported.candidateEditGroups).toEqual([])
    expect(exported.choiceSets).toContainEqual(
      expect.objectContaining({
        choiceSetId: 'choice:w0:pump-repair',
        selectedOptionId: 'accept-debt',
      }),
    )
    expect(exported.candidateManagementCommitmentGroups).toEqual([
      expect.objectContaining({
        decisionIntentId:
          'w0:repair-responsibility:pump-incident-day-3',
        actionIds: [envelope.id],
        beforeDecisionStateHash:
          '3f7a995664ccf22d9014d84dc59b3467ecc51837ce33edd36c61efdc9358f2c2',
        finalDecisionStateHash:
          'b2b081b36e5b1a1590c460aae28c9e3d503a9633fe34f411607c2c4c987cfdc2',
        finalOutcomeCode: 'committed:accept-debt',
        finalDisposition: 'committed',
      }),
    ])
  })

  it.each([
    {
      weekIndex: 0 as const,
      beforeHash:
        '5787a69bb55494fbb320bba90bc0f1c67a808bdabfa7ed6ae10d7f4194380441',
      finalHash:
        '016c3bf2edbc34c9930e3190a6ee8e77e04efa9a32bf43b2219779159331d868',
    },
    {
      weekIndex: 1 as const,
      beforeHash:
        'd3c6578b029cf325a1efb93f6b3e83b7bfe4f88f7e9bf4587af475a0fad14016',
      finalHash:
        '1b42cef2768bcf2749c3efb9364adab4e23948f4838bc34471c75ea2f1433e2e',
    },
  ])(
    'classifies the single-use transport shortcut in week $weekIndex',
    ({ weekIndex, beforeHash, finalHash }) => {
      const initial = scenario.createInitialState()
      const recorder = createSessionRecorder(
        `TECH-RC9-D2${weekIndex + 3}`,
        initial,
        buildMetadata(),
        1_000,
        100,
      )
      const before = weekIndex === 0 ? initial : startWeekTwo()
      const envelope = createPlayerAction(
        weekIndex === 0 ? 1 : 2,
        before.currentTick,
        {
        type: 'OPEN_TRANSPORT_SHORTCUT',
        },
      )
      const result = applyPlayerAction(before, envelope, scenario)
      recordPlayerTransition(recorder, before, envelope, result, 120)

      const exported = createPlaytestExport(
        recorder,
        result.state,
        1_100,
        150,
      )

      expect(exported.actions).toContainEqual({
        id: envelope.id,
        type: 'OPEN_TRANSPORT_SHORTCUT',
        atTick: before.currentTick,
        weekIndex,
      })
      expect(exported.candidateEditGroups).toEqual([
        {
          groupId: `legacy:w${weekIndex}:transport-route`,
          actionIds: [envelope.id],
        },
      ])
      expect(exported.choiceSets).toContainEqual(
        expect.objectContaining({
          choiceSetId: `choice:w${weekIndex}:transport-route`,
          selectedOptionId: 'south-shortcut',
        }),
      )
      expect(
        exported.candidateManagementCommitmentGroups,
      ).toEqual([
        expect.objectContaining({
          decisionIntentId: `w${weekIndex}:transport-route`,
          weekIndex,
          problemCategory: 'transport',
          actionIds: [envelope.id],
          beforeDecisionStateHash: beforeHash,
          finalDecisionStateHash: finalHash,
          finalOutcomeCode: 'committed:south-shortcut',
          finalDisposition: 'committed',
        }),
      ])
    },
  )

  it.each([
    {
      weekIndex: 0 as const,
      beforeHash:
        '6a533698bbbafed44e2a5a7a2a849f6adbc78df5834616f74dd20cd1e34eeef4',
      finalHash:
        '216d7b44af16ccc33ff7a0fb56bcbfc3067e68a1043e38e82b8f2375ec33f3d3',
    },
    {
      weekIndex: 1 as const,
      beforeHash:
        '4b0f5ddd9938ff9eaf8b8a7720166adc60fcd70540d4905712c025af8aaa38a1',
      finalHash:
        '17574353901206f0b9eb15538934e798316759e8cc7bda2d19d677d9cc5c941e',
    },
  ])(
    'classifies the single fertilizer use in week $weekIndex',
    ({ weekIndex, beforeHash, finalHash }) => {
      const initial = scenario.createInitialState()
      const recorder = createSessionRecorder(
        `TECH-RC9-D2${weekIndex + 5}`,
        initial,
        buildMetadata(),
        1_000,
        100,
      )
      const before = weekIndex === 0 ? initial : startWeekTwo()
      const envelope = createPlayerAction(
        weekIndex === 0 ? 1 : 2,
        before.currentTick,
        { type: 'USE_FERTILIZER' },
      )
      const result = applyPlayerAction(before, envelope, scenario)
      recordPlayerTransition(recorder, before, envelope, result, 120)

      const exported = createPlaytestExport(
        recorder,
        result.state,
        1_100,
        150,
      )

      expect(exported.actions).toContainEqual({
        id: envelope.id,
        type: 'USE_FERTILIZER',
        atTick: before.currentTick,
        weekIndex,
      })
      expect(exported.candidateEditGroups).toEqual([])
      expect(exported.choiceSets).toContainEqual(
        expect.objectContaining({
          choiceSetId: `choice:w${weekIndex}:fertilizer`,
          selectedOptionId: 'use-fertilizer',
        }),
      )
      expect(
        exported.candidateManagementCommitmentGroups,
      ).toEqual([
        expect.objectContaining({
          decisionIntentId: `w${weekIndex}:asset-use:fertilizer`,
          weekIndex,
          problemCategory: 'asset-use',
          actionIds: [envelope.id],
          beforeDecisionStateHash: beforeHash,
          finalDecisionStateHash: finalHash,
          finalOutcomeCode: 'committed:use-fertilizer',
          finalDisposition: 'committed',
        }),
      ])
    },
  )

  it('keeps multiple intents isolated in one two-week export', () => {
    const initial = scenario.createInitialState()
    const recorder = createSessionRecorder(
      'TECH-RC9-D27',
      initial,
      buildMetadata(),
      1_000,
      100,
    )
    let weekOne = initial
    for (const [sequence, action] of [
      [
        1,
        {
          type: 'SET_FOOD_SHORTFALL_ACCEPTED',
          accepted: true,
        } as const,
      ],
      [2, { type: 'ACCEPT_REPAIR_DEBT' } as const],
      [3, { type: 'OPEN_TRANSPORT_SHORTCUT' } as const],
      [4, { type: 'USE_FERTILIZER' } as const],
    ] as const) {
      const envelope = createPlayerAction(
        sequence,
        weekOne.currentTick,
        action,
      )
      const result = applyPlayerAction(weekOne, envelope, scenario)
      recordPlayerTransition(
        recorder,
        weekOne,
        envelope,
        result,
        110 + sequence,
      )
      weekOne = result.state
    }
    const weekTwo = startWeekTwo()
    const request = createPlayerAction(5, weekTwo.currentTick, {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'accepted',
    })
    const requested = applyPlayerAction(
      weekTwo,
      request,
      scenario,
    )
    recordPlayerTransition(
      recorder,
      weekTwo,
      request,
      requested,
      130,
    )

    const exported = createPlaytestExport(
      recorder,
      requested.state,
      1_100,
      150,
    )
    const actionOwners =
      exported.candidateManagementCommitmentGroups.flatMap(
        (group) => group.actionIds,
      )

    expect(new Set(actionOwners).size).toBe(actionOwners.length)
    expect(
      exported.candidateManagementCommitmentGroups.map(
        (group) => group.decisionIntentId,
      ),
    ).toEqual([
      'w0:food-plan',
      'w0:repair-responsibility:pump-incident-day-3',
      'w1:character-request:lin-he-study',
      'w0:transport-route',
      'w0:asset-use:fertilizer',
    ])
    expect(
      exported.candidateManagementCommitmentGroups.find(
        (group) =>
          group.decisionIntentId ===
          'w1:character-request:lin-he-study',
      )?.actionIds,
    ).toEqual([request.id])
    expect(exported).not.toHaveProperty(
      'oracleDecisionProjections',
    )
    expect(exported.summary).toEqual({
      week1CandidateEditCount: 1,
      week2CandidateEditCount: 1,
      week1CandidateManagementCount: 4,
      week2CandidateManagementCount: 1,
    })
  })
})
