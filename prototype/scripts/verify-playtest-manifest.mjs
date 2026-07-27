import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const HEX_64 = /^[a-f0-9]{64}$/
const GIT_SHA = /^[a-f0-9]{40}$/
const SAMPLE_ID_V2_TECH = /^TECH-RC9-[DP](?:0[1-9]|[1-9]\d+)$/
const CANDIDATE_ATTEMPT_ID = /^C(?:0[1-9]|[1-9]\d+)$/
const CANDIDATE_MANIFEST_ID = /^CM(?:0[1-9]|[1-9]\d+)$/
const REQUIRED_AUTHORITY_PATHS = {
  protocol:
    'docs/product-specs/weekly-management-slice-playtest-v0.2.md',
  design:
    'docs/design-docs/weekly-plan-production-forecast-slice-v0.2.md',
  operations:
    'docs/exec-plans/active/2026-07-27-gate1a-rc9-test-operations.md',
  'player-packet':
    'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/player-packet-v0.2.md',
  interview:
    'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/post-session-interview-v0.2.md',
  'fixture-oracle': 'prototype/tests/fixtures/fixture-expectations.json',
  'capture-host': 'prototype/scripts/playtest-host.mjs',
}

function argument(name) {
  const index = process.argv.lastIndexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function reject(errorCode) {
  return { accepted: false, errorCode }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function validateCandidateManifest(input) {
  if (
    !isRecord(input) ||
    !CANDIDATE_MANIFEST_ID.test(input.candidateManifestId ?? '') ||
    !CANDIDATE_ATTEMPT_ID.test(input.candidateAttempt ?? '') ||
    input.status !== 'PENDING_INDEPENDENT_REVIEW' ||
    !GIT_SHA.test(input.sourceSha ?? '') ||
    !HEX_64.test(input.artifactHash ?? '') ||
    !HEX_64.test(input.archiveHash ?? '') ||
    !Array.isArray(input.authorityHashes) ||
    !Array.isArray(input.rejectedAttempts) ||
    !input.rejectedAttempts.every(
      (attempt) =>
        isRecord(attempt) &&
        CANDIDATE_ATTEMPT_ID.test(attempt.candidateAttempt ?? '') &&
        HEX_64.test(attempt.rejectionHash ?? ''),
    )
  ) {
    return reject('CANDIDATE_MANIFEST_SHAPE')
  }

  const requiredRoles = Object.keys(REQUIRED_AUTHORITY_PATHS)
  const roles = input.authorityHashes.map((entry) => entry?.role)
  const paths = input.authorityHashes.map((entry) => entry?.path)
  if (
    input.authorityHashes.length !== requiredRoles.length ||
    !input.authorityHashes.every(
      (entry) =>
        isRecord(entry) &&
        requiredRoles.includes(entry.role) &&
        entry.path === REQUIRED_AUTHORITY_PATHS[entry.role] &&
        HEX_64.test(entry.sha256 ?? ''),
    ) ||
    new Set(roles).size !== roles.length ||
    new Set(paths).size !== paths.length ||
    !requiredRoles.every((role) => roles.includes(role))
  ) {
    return reject('CANDIDATE_MANIFEST_AUTHORITY')
  }

  const manifestNumber = Number(input.candidateManifestId.slice(2))
  const attemptNumber = Number(input.candidateAttempt.slice(1))
  const expectedPriorManifestIds = Array.from(
    { length: manifestNumber - 1 },
    (_, index) => `CM${String(index + 1).padStart(2, '0')}`,
  )
  if (
    !Array.isArray(input.priorManifests) ||
    !input.priorManifests.every(
      (entry) =>
        isRecord(entry) &&
        CANDIDATE_MANIFEST_ID.test(entry.candidateManifestId ?? '') &&
        CANDIDATE_ATTEMPT_ID.test(entry.candidateAttempt ?? '') &&
        HEX_64.test(entry.manifestHash ?? '') &&
        [
          'REJECTED_INDEPENDENT_REVIEW',
          'REJECTED_SEAL',
        ].includes(entry.status),
    ) ||
    !sameJson(
      input.priorManifests.map((entry) => entry.candidateManifestId),
      expectedPriorManifestIds,
    )
  ) {
    return reject('CANDIDATE_MANIFEST_HISTORY')
  }

  const priorManifestAttemptIds = input.priorManifests.map(
    (entry) => entry.candidateAttempt,
  )
  const rejectedAttemptIds = input.rejectedAttempts.map(
    (entry) => entry.candidateAttempt,
  )
  const expectedPriorAttemptIds = Array.from(
    { length: attemptNumber - 1 },
    (_, index) => `C${String(index + 1).padStart(2, '0')}`,
  )
  if (
    new Set(priorManifestAttemptIds).size !==
      priorManifestAttemptIds.length ||
    new Set(rejectedAttemptIds).size !== rejectedAttemptIds.length ||
    priorManifestAttemptIds.includes(input.candidateAttempt) ||
    priorManifestAttemptIds.some(
      (candidateAttempt) =>
        !rejectedAttemptIds.includes(candidateAttempt),
    ) ||
    !sameJson(rejectedAttemptIds, expectedPriorAttemptIds)
  ) {
    return reject('CANDIDATE_MANIFEST_HISTORY')
  }

  const requiredCommandIds = [
    'lint',
    'test',
    'build',
    'rc-build',
    'rc-verify',
    'e2e-rc',
    'rc-archive',
    'rc-verify-archive',
    'schema-fixtures',
    'guard-rc8',
    'manifest-verify',
    'rc-repro',
  ]
  const commandIds = input.commandResults?.map((entry) => entry?.id) ?? []
  const expectedDiagnosticIds = Array.from(
    { length: 5 },
    (_, index) =>
      `TECH-RC9-D${String((attemptNumber - 1) * 5 + index + 1).padStart(2, '0')}`,
  )
  const expectedAntiPassIds = Array.from(
    { length: 2 },
    (_, index) =>
      `TECH-RC9-P${String((attemptNumber - 1) * 2 + index + 1).padStart(2, '0')}`,
  )
  const diagnosticIds = input.diagnosticManifest?.sampleIds ?? []
  const antiPassIds = input.antiPass?.map((entry) => entry?.sampleId) ?? []
  if (
    !GIT_SHA.test(input.dependencyIntegrationSha ?? '') ||
    !HEX_64.test(input.candidateAttemptManifestHash ?? '') ||
    typeof input.buildId !== 'string' ||
    input.buildId.length === 0 ||
    input.scenarioId !== 'gate1-two-week-management' ||
    input.scenarioVersion !== '0.5.0' ||
    input.schemaVersion !== 'gate1-playtest-v2' ||
    !isRecord(input.diagnosticManifest) ||
    input.diagnosticManifest.status !== 'PASS' ||
    input.diagnosticManifest.path !==
      `candidates/${input.candidateAttempt}/diagnostics/manifest.json` ||
    !HEX_64.test(input.diagnosticManifest.sha256 ?? '') ||
    !Array.isArray(input.diagnosticManifest.sampleIds) ||
    input.diagnosticManifest.sampleIds.length !== 5 ||
    new Set(input.diagnosticManifest.sampleIds).size !== 5 ||
    !sameJson(diagnosticIds, expectedDiagnosticIds) ||
    !Array.isArray(input.antiPass) ||
    input.antiPass.length !== 2 ||
    !input.antiPass.every(
      (entry) =>
        isRecord(entry) &&
        SAMPLE_ID_V2_TECH.test(entry.sampleId ?? '') &&
        entry.status === 'PASS' &&
        HEX_64.test(entry.evidenceHash ?? ''),
    ) ||
    new Set(input.antiPass.map((entry) => entry.sampleId)).size !== 2 ||
    !sameJson(antiPassIds, expectedAntiPassIds) ||
    !isRecord(input.rc8Guard) ||
    !GIT_SHA.test(input.rc8Guard.baselineSha ?? '') ||
    !GIT_SHA.test(input.rc8Guard.treeId ?? '') ||
    !HEX_64.test(input.rc8Guard.inventorySha256 ?? '') ||
    input.rc8Guard.status !== 'PASS' ||
    !Array.isArray(input.commandResults) ||
    input.commandResults.length !== requiredCommandIds.length ||
    new Set(commandIds).size !== commandIds.length ||
    !requiredCommandIds.every((id) => commandIds.includes(id)) ||
    !input.commandResults.every(
      (entry) =>
        isRecord(entry) &&
        requiredCommandIds.includes(entry.id) &&
        entry.status === 'PASS' &&
        HEX_64.test(entry.outputHash ?? ''),
    ) ||
    input.rejectedAttempts.some(
      (entry) => entry.candidateAttempt === input.candidateAttempt,
    )
  ) {
    return reject('CANDIDATE_MANIFEST_EVIDENCE')
  }

  return {
    accepted: true,
    candidateManifestId: input.candidateManifestId,
    candidateAttempt: input.candidateAttempt,
    errorCode: null,
  }
}

const manifestArgument = argument('--manifest')
if (!manifestArgument) {
  process.stderr.write(
    '用法：node scripts/verify-playtest-manifest.mjs --manifest <manifest.json>\n',
  )
  process.exit(1)
}

const manifestPath = resolve(manifestArgument)
let document
try {
  document = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (error) {
  process.stderr.write(
    `candidate manifest 无法读取：${error instanceof Error ? error.message : error}\n`,
  )
  process.exit(1)
}

const input =
  document?.kind === 'candidate-manifest' && isRecord(document.input)
    ? document.input
    : document
const result = validateCandidateManifest(input)
process.stdout.write(`${JSON.stringify(result)}\n`)
if (!result.accepted) process.exitCode = 1
