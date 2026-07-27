import {
  GATE1_PROTOCOL_VERSION,
  gate1WeekOneScenario as scenario,
} from '../scenario/gate1-week-one'
import type { RcBuildMetadata } from '../build-metadata'
import type {
  DomainEvent,
  PlayerActionEnvelope,
  SimulationState,
  TransitionResult,
} from '../sim/model'

export interface PlaytestSessionMeta {
  sampleId: string
  diagnosisId: string
  sessionId: string
  candidateBuildAuthorityHash: string
  sessionAuthorityToken: string
  buildId: string
  gitSha: string
  artifactHash: string
  scenarioId: string
  scenarioVersion: string
  protocolVersion: typeof GATE1_PROTOCOL_VERSION
  fixedSeed: number
  initialStateHash: string
  viewport: string
  inputDevice: 'browser-pointer-keyboard'
}

export interface HostIssuedSessionAuthority {
  diagnosisId: string
  sessionId: string
  candidateBuildAuthorityHash: string
  sessionAuthorityToken: string
}

export type TelemetryType =
  | 'session-started'
  | 'player-action-applied'
  | 'simulation-advanced'
  | 'speed-changed'
  | 'auto-pause-triggered'
  | 'week-started'
  | 'week-completed'
  | 'export-created'
  | 'blocked-capture-created'

export interface TelemetryEvent {
  sequence: number
  type: TelemetryType
  atTick: number
  machineOffsetMs: number
  speed?: 1 | 3 | 8
  fromTick?: number
  toTick?: number
  actionId?: string
  domainEventIds?: readonly string[]
  weekIndex?: 0 | 1
}

export interface DomainEventEnvelope {
  sequence: number
  eventId: string
  type: DomainEvent['type']
  atTick: number
  before?: DomainEvent['before']
  after?: DomainEvent['after']
}

export interface SpeedTrajectoryEntry {
  sequence: number
  atTick: number
  machineOffsetMs: number
  speed: 1 | 3 | 8
}

export interface RecordedPlayerTransition {
  envelope: PlayerActionEnvelope
  before: SimulationState
  after: SimulationState
}

export interface SessionRecorder {
  meta: PlaytestSessionMeta
  machineStartedAtEpochMs: number
  machineStartedAtMonotonicMs: number
  weekStartedOffsetMs: [number, number | null]
  weekRawDurationMs: [number | null, number | null]
  actions: PlayerActionEnvelope[]
  domainEvents: DomainEventEnvelope[]
  telemetry: TelemetryEvent[]
  speedTrajectory: SpeedTrajectoryEntry[]
  playerTransitions: RecordedPlayerTransition[]
}

let fallbackSessionSequence = 0

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

export function stableStateHash(state: unknown): string {
  const input = stableJson(state)
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function createSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  fallbackSessionSequence += 1
  return `session-${Date.now()}-${fallbackSessionSequence}`
}

function createFallbackAuthorityToken(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${globalThis.crypto.randomUUID()}${globalThis.crypto.randomUUID()}`
      .replaceAll('-', '')
      .toLowerCase()
  }
  fallbackSessionSequence += 1
  return fallbackSessionSequence.toString(16).padStart(64, '0')
}

function machineOffset(recorder: SessionRecorder, monotonicNow: number): number {
  return Math.max(0, Math.round(monotonicNow - recorder.machineStartedAtMonotonicMs))
}

function pushTelemetry(
  recorder: SessionRecorder,
  event: Omit<TelemetryEvent, 'sequence'>,
) {
  recorder.telemetry.push({
    ...event,
    sequence: recorder.telemetry.length + 1,
  })
}

function recordDomainEvents(
  recorder: SessionRecorder,
  events: readonly DomainEvent[],
) {
  for (const event of events) {
    recorder.domainEvents.push({
      sequence: recorder.domainEvents.length + 1,
      eventId: event.id,
      type: event.type,
      atTick: event.atTick,
      ...(event.before ? { before: event.before } : {}),
      ...(event.after ? { after: event.after } : {}),
    })
  }
}

function recordWeekBoundaries(
  recorder: SessionRecorder,
  events: readonly DomainEvent[],
  atTick: number,
  monotonicNow: number,
) {
  const offset = machineOffset(recorder, monotonicNow)
  for (const event of events) {
    if (event.type !== 'week-ended') continue
    const weekIndex = event.id === 'week-1-ended' ? 0 : 1
    const startedAt = recorder.weekStartedOffsetMs[weekIndex]
    if (startedAt !== null) {
      recorder.weekRawDurationMs[weekIndex] = Math.max(0, offset - startedAt)
    }
    pushTelemetry(recorder, {
      type: 'week-completed',
      atTick,
      machineOffsetMs: offset,
      weekIndex,
    })
  }
}

export function createSessionRecorder(
  sampleId: string,
  state: SimulationState,
  buildMetadata: RcBuildMetadata,
  epochNow = Date.now(),
  monotonicNow = performance.now(),
  issuedAuthority?: HostIssuedSessionAuthority,
): SessionRecorder {
  const initialStateHash = stableStateHash(state)
  if (buildMetadata.initialStateHash !== initialStateHash) {
    throw new Error(
      `冻结初态指纹不一致：metadata=${buildMetadata.initialStateHash} runtime=${initialStateHash}`,
    )
  }
  const authority = issuedAuthority ?? {
    diagnosisId: sampleId,
    sessionId: createSessionId(),
    candidateBuildAuthorityHash: buildMetadata.artifactHash,
    sessionAuthorityToken: createFallbackAuthorityToken(),
  }
  if (
    authority.diagnosisId !== sampleId ||
    authority.candidateBuildAuthorityHash !==
      buildMetadata.artifactHash
  ) {
    throw new Error('Host 会话 authority 与样本或构建不一致')
  }
  const meta: PlaytestSessionMeta = {
    sampleId,
    diagnosisId: authority.diagnosisId,
    sessionId: authority.sessionId,
    candidateBuildAuthorityHash:
      authority.candidateBuildAuthorityHash,
    sessionAuthorityToken: authority.sessionAuthorityToken,
    buildId: buildMetadata.buildId,
    gitSha: buildMetadata.gitSha,
    artifactHash: buildMetadata.artifactHash,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    protocolVersion: GATE1_PROTOCOL_VERSION,
    fixedSeed: scenario.fixedSeed,
    initialStateHash,
    viewport:
      typeof window === 'undefined'
        ? 'unknown'
        : `${window.innerWidth}x${window.innerHeight}`,
    inputDevice: 'browser-pointer-keyboard',
  }
  const recorder: SessionRecorder = {
    meta,
    machineStartedAtEpochMs: epochNow,
    machineStartedAtMonotonicMs: monotonicNow,
    weekStartedOffsetMs: [0, null],
    weekRawDurationMs: [null, null],
    actions: [],
    domainEvents: [],
    telemetry: [],
    speedTrajectory: [],
    playerTransitions: [],
  }
  pushTelemetry(recorder, {
    type: 'session-started',
    atTick: state.currentTick,
    machineOffsetMs: 0,
    weekIndex: 0,
  })
  pushTelemetry(recorder, {
    type: 'week-started',
    atTick: state.currentTick,
    machineOffsetMs: 0,
    weekIndex: 0,
  })
  recordSpeedChange(recorder, state.currentTick, 3, monotonicNow)
  return recorder
}

export function recordSpeedChange(
  recorder: SessionRecorder,
  atTick: number,
  speed: 1 | 3 | 8,
  monotonicNow = performance.now(),
) {
  const entry: SpeedTrajectoryEntry = {
    sequence: recorder.speedTrajectory.length + 1,
    atTick,
    machineOffsetMs: machineOffset(recorder, monotonicNow),
    speed,
  }
  recorder.speedTrajectory.push(entry)
  pushTelemetry(recorder, {
    type: 'speed-changed',
    atTick,
    machineOffsetMs: entry.machineOffsetMs,
    speed,
  })
}

export function recordPlayerTransition(
  recorder: SessionRecorder,
  before: SimulationState,
  envelope: PlayerActionEnvelope,
  result: TransitionResult,
  monotonicNow = performance.now(),
) {
  recorder.actions.push(envelope)
  recorder.playerTransitions.push({
    envelope,
    before,
    after: result.state,
  })
  recordDomainEvents(recorder, result.events)
  const offset = machineOffset(recorder, monotonicNow)
  pushTelemetry(recorder, {
    type: 'player-action-applied',
    atTick: result.state.currentTick,
    machineOffsetMs: offset,
    fromTick: before.currentTick,
    toTick: result.state.currentTick,
    actionId: envelope.id,
    domainEventIds: result.events.map((event) => event.id),
  })
  if (envelope.action.type === 'CONTINUE_TO_NEXT_WEEK') {
    recorder.weekStartedOffsetMs[1] = offset
    pushTelemetry(recorder, {
      type: 'week-started',
      atTick: result.state.currentTick,
      machineOffsetMs: offset,
      weekIndex: 1,
    })
  }
  recordWeekBoundaries(recorder, result.events, result.state.currentTick, monotonicNow)
}

export function recordSimulationAdvance(
  recorder: SessionRecorder,
  before: SimulationState,
  result: TransitionResult,
  speed: 1 | 3 | 8,
  monotonicNow = performance.now(),
) {
  recordDomainEvents(recorder, result.events)
  const offset = machineOffset(recorder, monotonicNow)
  pushTelemetry(recorder, {
    type: 'simulation-advanced',
    atTick: result.state.currentTick,
    machineOffsetMs: offset,
    speed,
    fromTick: before.currentTick,
    toTick: result.state.currentTick,
    domainEventIds: result.events.map((event) => event.id),
  })
  if (!before.isPaused && result.state.isPaused && result.events.length > 0) {
    pushTelemetry(recorder, {
      type: 'auto-pause-triggered',
      atTick: result.state.currentTick,
      machineOffsetMs: offset,
      speed,
      domainEventIds: result.events.map((event) => event.id),
    })
  }
  recordWeekBoundaries(recorder, result.events, result.state.currentTick, monotonicNow)
}

export function recordExportCreated(
  recorder: SessionRecorder,
  atTick: number,
  monotonicNow = performance.now(),
) {
  pushTelemetry(recorder, {
    type: 'export-created',
    atTick,
    machineOffsetMs: machineOffset(recorder, monotonicNow),
  })
}

export function recordBlockedCaptureCreated(
  recorder: SessionRecorder,
  atTick: number,
  monotonicNow = performance.now(),
) {
  pushTelemetry(recorder, {
    type: 'blocked-capture-created',
    atTick,
    machineOffsetMs: machineOffset(recorder, monotonicNow),
  })
}
