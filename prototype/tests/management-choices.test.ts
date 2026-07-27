import { describe, expect, it } from 'vitest'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import {
  ManagementChoiceCommitError,
  advanceSimulation,
  applyPlayerAction,
  createPlayerAction,
} from '../src/sim/engine'
import {
  PREVENTIVE_CAPACITY_DEADLINE_TICK,
  PREVENTIVE_CAPACITY_CHOICE_SET_ID,
  RECOVERY_ALLOCATION_BLOCK_ID,
  RECOVERY_ALLOCATION_CHOICE_SET_ID,
  RECOVERY_ALLOCATION_DEADLINE_TICK,
  bindManagementChoiceAuthority,
  createManagementChoiceCommitRequest,
  managementCommitmentCount,
} from '../src/sim/management-choices'
import type {
  ManagementCandidateId,
  PlayerAction,
  SimulationState,
} from '../src/sim/model'
import { resolveScheduleBlock } from '../src/sim/schedule'

const AUTHORITY = {
  diagnosisId: 'TECH-RC9-D11',
  sessionId: '11111111-1111-4111-8111-111111111111',
  candidateBuildAuthorityHash: 'a'.repeat(64),
  sessionAuthorityToken: 'b'.repeat(64),
}

function initial() {
  return bindManagementChoiceAuthority(
    scenario.createInitialState(),
    AUTHORITY,
  )
}

function act(
  state: SimulationState,
  sequence: number,
  action: PlayerAction,
) {
  return applyPlayerAction(
    state,
    createPlayerAction(sequence, state.currentTick, action),
    scenario,
  ).state
}

function choose(
  state: SimulationState,
  sequence: number,
  candidateId: ManagementCandidateId,
) {
  const choiceSetId =
    candidateId === 'schedule-preventive-maintenance' ||
    candidateId === 'retain-rest-capacity'
      ? PREVENTIVE_CAPACITY_CHOICE_SET_ID
      : RECOVERY_ALLOCATION_CHOICE_SET_ID
  return act(state, sequence, {
    type: 'COMMIT_MANAGEMENT_CHOICE',
    request: createManagementChoiceCommitRequest(
      state,
      choiceSetId,
      candidateId,
      `idempotency-${sequence}`,
    ),
  })
}

function enterWeekTwo(
  w1Candidate: 'schedule-preventive-maintenance' | 'retain-rest-capacity',
) {
  let state = choose(initial(), 1, w1Candidate)
  state = act(state, 2, { type: 'SET_PAUSED', paused: false })
  state = advanceSimulation(
    state,
    scenario.pumpEventTick,
    scenario,
  ).state
  state = act(state, 3, { type: 'SET_PAUSED', paused: false })
  state = advanceSimulation(
    state,
    scenario.weekEndTick,
    scenario,
  ).state
  return act(state, 4, { type: 'CONTINUE_TO_NEXT_WEEK' })
}

function openWeekTwoBeforeRecoveryDeadline() {
  return act(
    enterWeekTwo('schedule-preventive-maintenance'),
    5,
    {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'declined',
    },
  )
}

describe('C03 management choice domain', () => {
  it('binds W1 opportunity to diagnosis, session, and build authority', () => {
    const opportunity =
      initial().managementChoices.opportunities.preventiveCapacity
    expect(opportunity).toMatchObject({
      choiceSetId: 'choice:w0:preventive-capacity',
      decisionIntentId: 'w0:preventive-capacity:pump',
      diagnosisId: AUTHORITY.diagnosisId,
      sessionId: AUTHORITY.sessionId,
      candidateBuildAuthorityHash:
        AUTHORITY.candidateBuildAuthorityHash,
      sessionAuthorityToken:
        AUTHORITY.sessionAuthorityToken,
      terminalState: 'open',
      stateRevision: 0,
    })
    expect(opportunity?.projectionBaseHash).toMatch(
      /^[a-f0-9]{64}$/,
    )
  })

  it('atomically commits one W1 candidate and rejects the concurrent stale candidate', () => {
    const base = initial()
    const maintenance =
      createManagementChoiceCommitRequest(
        base,
        PREVENTIVE_CAPACITY_CHOICE_SET_ID,
        'schedule-preventive-maintenance',
        'concurrent-a',
      )
    const rest = createManagementChoiceCommitRequest(
      base,
      PREVENTIVE_CAPACITY_CHOICE_SET_ID,
      'retain-rest-capacity',
      'concurrent-b',
    )
    const committed = act(base, 1, {
      type: 'COMMIT_MANAGEMENT_CHOICE',
      request: maintenance,
    })
    expect(committed.stateRevision).toBe(1)
    expect(() =>
      act(committed, 2, {
        type: 'COMMIT_MANAGEMENT_CHOICE',
        request: rest,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ManagementChoiceCommitError>>({
        code: 'STATE_REVISION_CONFLICT',
      }),
    )
    expect(managementCommitmentCount(committed, 0)).toBe(1)
    expect(
      committed.managementChoices.commitments[0].consequences,
    ).toHaveLength(3)
  })

  it('rejects a fresh second selection without mutating the terminal state', () => {
    const committed = choose(
      initial(),
      1,
      'retain-rest-capacity',
    )
    const second = createManagementChoiceCommitRequest(
      committed,
      PREVENTIVE_CAPACITY_CHOICE_SET_ID,
      'schedule-preventive-maintenance',
      'second-selection',
    )
    expect(() =>
      act(committed, 2, {
        type: 'COMMIT_MANAGEMENT_CHOICE',
        request: second,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ManagementChoiceCommitError>>({
        code: 'OPPORTUNITY_ALREADY_COMMITTED',
      }),
    )
    expect(
      committed.managementChoices.opportunities
        .preventiveCapacity?.terminalState,
    ).toBe('retain-rest-capacity')
    expect(managementCommitmentCount(committed, 0)).toBe(1)
  })

  it('keeps retain-rest consequences mutation-only and persists readiness', () => {
    const state = choose(
      initial(),
      1,
      'retain-rest-capacity',
    )
    const commitment = state.managementChoices.commitments[0]
    expect(
      commitment.consequences.map((item) => item.objectRef),
    ).toEqual([
      'water-pump:preventive-capacity-allocation',
      'lin-he:recovery-units',
      'settlement:personnel-readiness',
    ])
    expect(
      commitment.consequences.every(
        (item) => item.beforeValue !== item.afterValue,
      ),
    ).toBe(true)
    expect(state.managementChoices).toMatchObject({
      preventiveCapacityAllocation: 'rest',
      equipmentExposure: 'high',
      equipmentRecoveryLoad: 2,
      linHeRecoveryUnits: 1,
      personnelReadiness: 1,
    })
  })

  it('treats a low-level W1 schedule edit as real state but never as an explicit commitment', () => {
    let state = act(initial(), 1, {
      type: 'CHANGE_ACTIVITY',
      activity: 'repair',
    })
    expect(
      resolveScheduleBlock(state, 'lin-he:d1:b1').activity,
    ).toBe('repair')
    expect(managementCommitmentCount(state, 0)).toBe(0)
    state = advanceSimulation(
      state,
      scenario.pumpEventTick,
      scenario,
    ).state
    expect(
      state.managementChoices.opportunities.preventiveCapacity
        ?.terminalState,
    ).toBe('unqualified-direct-edit')
    expect(state.managementChoices.equipmentExposure).toBe('low')
  })

  it('rejects cross-session replay even with the same intent and revision', () => {
    const state = initial()
    const request = createManagementChoiceCommitRequest(
      state,
      PREVENTIVE_CAPACITY_CHOICE_SET_ID,
      'retain-rest-capacity',
      'cross-session',
    )
    expect(() =>
      act(state, 1, {
        type: 'COMMIT_MANAGEMENT_CHOICE',
        request: {
          ...request,
          sessionId:
            '22222222-2222-4222-8222-222222222222',
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ManagementChoiceCommitError>>({
        code: 'AUTHORITY_MISMATCH',
      }),
    )
    expect(managementCommitmentCount(state, 0)).toBe(0)
  })

  it('rejects a canonical consequence fingerprint already owned by a competing intent', () => {
    const base = initial()
    const reference = choose(
      base,
      1,
      'retain-rest-capacity',
    )
    const poisoned: SimulationState = {
      ...base,
      managementChoices: {
        ...base.managementChoices,
        effectOwnership: Object.fromEntries(
          reference.managementChoices.commitments[0]
            .effectFingerprints.map((fingerprint) => [
              fingerprint,
              'w1:recovery-allocation:pump-vs-food',
            ]),
        ),
      },
    }

    expect(() =>
      choose(poisoned, 1, 'retain-rest-capacity'),
    ).toThrowError(
      expect.objectContaining<
        Partial<ManagementChoiceCommitError>
      >({
        code: 'EFFECT_ALREADY_OWNED',
      }),
    )
    expect(managementCommitmentCount(poisoned, 0)).toBe(0)
  })

  it.each([
    ['allocate-repair-buffer', 'repair', 1, 0],
    ['allocate-food-production', 'food', 0, 1],
  ] as const)(
    'commits W2 %s through the canonical lot with exactly one +1 economic delta',
    (candidateId, activity, repairDelta, foodDelta) => {
      const before = enterWeekTwo(
        'schedule-preventive-maintenance',
      )
      const beforeFood =
        before.inventory.food
      const beforeCommit = before.managementChoices.commitments.length
      const state = choose(before, 5, candidateId)
      const commitment =
        state.managementChoices.commitments[beforeCommit]
      expect(
        resolveScheduleBlock(
          state,
          RECOVERY_ALLOCATION_BLOCK_ID,
        ).activity,
      ).toBe(activity)
      expect(commitment.resourceClaimRef).toBe(
        'schedule-slot:chen-du:d10:b2',
      )
      const economic = commitment.consequences.filter(
        (item) => item.objectRef.startsWith('forecast:'),
      )
      expect(economic).toHaveLength(1)
      expect(
        Number(economic[0].afterValue) -
          Number(economic[0].beforeValue),
      ).toBe(1)
      expect(
        economic[0].objectRef === 'forecast:ending-repair'
          ? [1, 0]
          : [0, 1],
      ).toEqual([repairDelta, foodDelta])
      expect(state.inventory.food).toBe(beforeFood)
      expect(
        state.managementChoices.equipmentRecoveryLoad,
      ).toBe(1)
    },
  )

  it('freezes an omitted W1 terminal before opening W2 without creating a count', () => {
    let state = initial()
    state = act(state, 1, { type: 'SET_PAUSED', paused: false })
    state = advanceSimulation(
      state,
      scenario.pumpEventTick,
      scenario,
    ).state
    state = act(state, 2, { type: 'SET_PAUSED', paused: false })
    state = advanceSimulation(
      state,
      scenario.weekEndTick,
      scenario,
    ).state
    state = act(state, 3, {
      type: 'CONTINUE_TO_NEXT_WEEK',
    })
    expect(
      state.managementChoices.opportunities.preventiveCapacity
        ?.terminalState,
    ).toBe('omitted')
    expect(
      state.managementChoices.opportunities.recoveryAllocation,
    ).toMatchObject({
      terminalState: 'open',
      stateRevision: state.stateRevision,
    })
    expect(managementCommitmentCount(state, 0)).toBe(0)
  })

  it.each([
    ['W1', 0, PREVENTIVE_CAPACITY_DEADLINE_TICK],
    ['W2', 1, RECOVERY_ALLOCATION_DEADLINE_TICK],
  ] as const)(
    'keeps the %s management opportunity open one tick before its deadline',
    (_label, weekIndex, deadlineTick) => {
      const state =
        weekIndex === 0
          ? initial()
          : openWeekTwoBeforeRecoveryDeadline()
      const advanced = advanceSimulation(
        state,
        deadlineTick - 1,
        scenario,
      ).state
      const opportunity =
        weekIndex === 0
          ? advanced.managementChoices.opportunities
              .preventiveCapacity
          : advanced.managementChoices.opportunities
              .recoveryAllocation

      expect(advanced.currentTick).toBe(deadlineTick - 1)
      expect(opportunity?.terminalState).toBe('open')
      expect(managementCommitmentCount(advanced, weekIndex)).toBe(0)
    },
  )

  it.each([
    ['W1', 0, PREVENTIVE_CAPACITY_DEADLINE_TICK],
    ['W2', 1, RECOVERY_ALLOCATION_DEADLINE_TICK],
  ] as const)(
    'freezes the %s management opportunity exactly at its deadline',
    (_label, weekIndex, deadlineTick) => {
      const state =
        weekIndex === 0
          ? initial()
          : openWeekTwoBeforeRecoveryDeadline()
      const advanced = advanceSimulation(
        state,
        deadlineTick,
        scenario,
      ).state
      const opportunity =
        weekIndex === 0
          ? advanced.managementChoices.opportunities
              .preventiveCapacity
          : advanced.managementChoices.opportunities
              .recoveryAllocation

      expect(advanced.currentTick).toBe(deadlineTick)
      expect(opportunity?.terminalState).toBe('omitted')
      expect(managementCommitmentCount(advanced, weekIndex)).toBe(0)
    },
  )

  it.each([
    ['W1', 0, PREVENTIVE_CAPACITY_DEADLINE_TICK],
    ['W2', 1, RECOVERY_ALLOCATION_DEADLINE_TICK],
  ] as const)(
    'freezes the %s management opportunity before continuing past its deadline',
    (_label, weekIndex, deadlineTick) => {
      const state =
        weekIndex === 0
          ? initial()
          : openWeekTwoBeforeRecoveryDeadline()
      const advanced = advanceSimulation(
        state,
        deadlineTick + 1,
        scenario,
      ).state
      const opportunity =
        weekIndex === 0
          ? advanced.managementChoices.opportunities
              .preventiveCapacity
          : advanced.managementChoices.opportunities
              .recoveryAllocation

      expect(advanced.currentTick).toBe(deadlineTick + 1)
      expect(opportunity?.terminalState).toBe('omitted')
      expect(managementCommitmentCount(advanced, weekIndex)).toBe(0)
    },
  )
})
