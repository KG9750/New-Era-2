const HEX_64 = /^[a-f0-9]{64}$/
const GIT_SHA = /^[a-f0-9]{40}$/
const CANDIDATE_ATTEMPT_ID = /^C(?:0[1-9]|[1-9]\d+)$/
const CANDIDATE_MANIFEST_ID = /^CM(?:0[1-9]|[1-9]\d+)$/
const SAMPLE_ID_V2_TECH = /^TECH-RC9-[DP](?:0[1-9]|[1-9]\d+)$/

export const RC9_COHORT_ROOT =
  'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01'
export const EVIDENCE_BASELINE =
  '5b9438cc5123ba35d8a703f3507bbf463e90176d'

export const REJECTION_AUTHORITIES = Object.freeze({
  C01: Object.freeze({
    path: `${RC9_COHORT_ROOT}/candidates/C01/rejection-record.json`,
    sha256:
      '2408890b5fe84b42663a4960ce1f8595a4603a200c5aa864391eedfa32e91cd0',
  }),
  C02: Object.freeze({
    path: `${RC9_COHORT_ROOT}/candidates/C02/rejection-record.json`,
    sha256:
      '9265bde06a4f59dd85e122f4372229c5259b0c1dea26bd269c24d8acbf188397',
  }),
  C03: Object.freeze({
    path: `${RC9_COHORT_ROOT}/candidates/C03/rejection-record.json`,
    sha256:
      '5550936b5298269e16b53c40df7a597d6c839a6dda155298e6f0a99fd7f0df6f',
  }),
})

export const AUTHORITY_PROFILES = Object.freeze({
  'rc9-v02': Object.freeze({
    scenarioVersion: '0.5.0',
    protocolVersion: 'weekly-management-slice-playtest-v0.2',
    authorityPaths: Object.freeze({
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
      'fixture-oracle':
        'prototype/tests/fixtures/fixture-expectations.json',
      'capture-host': 'prototype/scripts/playtest-host.mjs',
    }),
  }),
  'rc9-v03': Object.freeze({
    scenarioVersion: '0.5.1',
    protocolVersion: 'weekly-management-slice-playtest-v0.3',
    authorityPaths: Object.freeze({
      protocol:
        'docs/product-specs/weekly-management-slice-playtest-v0.3.md',
      'c03-management-authority':
        'docs/design-docs/gate1-c03-management-choice-authority.md',
      'c03-branch-matrix':
        'docs/design-docs/gate1-rc9-branch-matrix.md',
      'c04-recovery-plan':
        'docs/exec-plans/active/2026-07-29-gate1a-rc9-c04-recovery-plan.md',
      operations:
        'docs/exec-plans/active/2026-07-27-gate1a-rc9-test-operations.md',
      'player-packet':
        'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/player-packet-v0.2.md',
      interview:
        'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/post-session-interview-v0.2.md',
      'fixture-oracle':
        'prototype/tests/fixtures/fixture-expectations.json',
      'capture-host': 'prototype/scripts/playtest-host.mjs',
    }),
  }),
})

export const REQUIRED_COMMAND_IDS = Object.freeze([
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
  'manifest-fixtures',
  'manifest-probe',
  'runtime-equivalence',
  'rc-repro',
])

const COMMAND_OUTPUT_FILES = Object.freeze({
  lint: 'lint.txt',
  test: 'test.txt',
  build: 'build.txt',
  'rc-build': 'rc-build.txt',
  'rc-verify': 'rc-verify.txt',
  'e2e-rc': 'e2e-rc.txt',
  'rc-archive': 'rc-archive.txt',
  'rc-verify-archive': 'rc-verify-archive.txt',
  'schema-fixtures': 'schema-fixtures.txt',
  'guard-rc8': 'guard-rc8.txt',
  'manifest-fixtures': 'manifest-fixtures.json',
  'manifest-probe': 'manifest-probe.json',
  'runtime-equivalence': 'runtime-equivalence.json',
  'rc-repro': 'rc-repro.txt',
})

export function candidateRoot(candidateAttempt) {
  return `${RC9_COHORT_ROOT}/candidates/${candidateAttempt}`
}

export function candidateBuildManifestPath(candidateAttempt) {
  return `${candidateRoot(candidateAttempt)}/candidate-build-manifest.json`
}

export function diagnosticManifestPath(candidateAttempt) {
  return `${candidateRoot(candidateAttempt)}/diagnostics/manifest.json`
}

export function antiPassEvidencePath(candidateAttempt, sampleId) {
  return `${candidateRoot(candidateAttempt)}/anti-pass/${sampleId}/result.json`
}

export function frozenEvidenceGuardPath(candidateAttempt) {
  return `${candidateRoot(candidateAttempt)}/evidence/phase6/frozen-evidence-guard.json`
}

export function commandOutputPath(candidateAttempt, commandId) {
  const filename = COMMAND_OUTPUT_FILES[commandId]
  return filename
    ? `${candidateRoot(candidateAttempt)}/evidence/phase6/${filename}`
    : null
}

export function candidateManifestPath(candidateManifestId) {
  return `${RC9_COHORT_ROOT}/candidate-manifests/${candidateManifestId}/candidate-manifest.json`
}

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isRepoRelativePath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    value.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  )
}

function reject(errorCode) {
  return { accepted: false, errorCode }
}

function accept(summary = {}) {
  return { accepted: true, errorCode: null, summary }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function expectedIds(prefix, start, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}${String(start + index).padStart(2, '0')}`,
  )
}

export function validateCandidateAuthority(input) {
  if (!isRecord(input) || !Object.hasOwn(AUTHORITY_PROFILES, input.authorityProfile)) {
    return reject('CANDIDATE_MANIFEST_AUTHORITY_PROFILE')
  }

  const profile = AUTHORITY_PROFILES[input.authorityProfile]
  if (
    input.scenarioVersion !== profile.scenarioVersion ||
    input.protocolVersion !== profile.protocolVersion
  ) {
    return reject('CANDIDATE_MANIFEST_AUTHORITY_VERSION')
  }

  const requiredEntries = Object.entries(profile.authorityPaths)
  const authorityRoles = input.authorityHashes?.map((entry) => entry?.role) ?? []
  const authorityPaths = input.authorityHashes?.map((entry) => entry?.path) ?? []
  if (
    !Array.isArray(input.authorityHashes) ||
    input.authorityHashes.length !== requiredEntries.length ||
    !input.authorityHashes.every(
      (entry) =>
        isRecord(entry) &&
        profile.authorityPaths[entry.role] === entry.path &&
        HEX_64.test(entry.sha256 ?? ''),
    ) ||
    new Set(authorityRoles).size !== authorityRoles.length ||
    new Set(authorityPaths).size !== authorityPaths.length ||
    !requiredEntries.every(([role, path]) =>
      input.authorityHashes.some(
        (entry) => entry.role === role && entry.path === path,
      ),
    )
  ) {
    return reject('CANDIDATE_MANIFEST_AUTHORITY')
  }

  return accept({
    authorityProfile: input.authorityProfile,
    scenarioVersion: input.scenarioVersion,
    protocolVersion: input.protocolVersion,
  })
}

export function validateCandidateManifest(input) {
  if (
    !isRecord(input) ||
    !CANDIDATE_MANIFEST_ID.test(input.candidateManifestId ?? '') ||
    !CANDIDATE_ATTEMPT_ID.test(input.candidateAttempt ?? '') ||
    input.status !== 'PENDING_INDEPENDENT_REVIEW' ||
    !GIT_SHA.test(input.sourceSha ?? '') ||
    !GIT_SHA.test(input.dependencyIntegrationSha ?? '') ||
    !GIT_SHA.test(input.candidateEvidenceSnapshotSha ?? '') ||
    !HEX_64.test(input.candidateAttemptManifestHash ?? '') ||
    !isRepoRelativePath(input.candidateAttemptManifestPath) ||
    typeof input.buildId !== 'string' ||
    input.buildId.length === 0 ||
    input.scenarioId !== 'gate1-two-week-management' ||
    input.schemaVersion !== 'gate1-playtest-v2' ||
    !HEX_64.test(input.artifactHash ?? '') ||
    !HEX_64.test(input.archiveHash ?? '') ||
    !Array.isArray(input.rejectedAttempts) ||
    !input.rejectedAttempts.every(
      (attempt) =>
        isRecord(attempt) &&
        CANDIDATE_ATTEMPT_ID.test(attempt.candidateAttempt ?? '') &&
        isRepoRelativePath(attempt.rejectionPath) &&
        HEX_64.test(attempt.rejectionHash ?? ''),
    )
  ) {
    return reject('CANDIDATE_MANIFEST_SHAPE')
  }

  const authorityResult = validateCandidateAuthority(input)
  if (!authorityResult.accepted) return authorityResult

  if (
    input.candidateAttemptManifestPath !==
    candidateBuildManifestPath(input.candidateAttempt)
  ) {
    return reject('CANDIDATE_MANIFEST_EVIDENCE')
  }

  const manifestNumber = Number(input.candidateManifestId.slice(2))
  const attemptNumber = Number(input.candidateAttempt.slice(1))
  const expectedPriorManifestIds = expectedIds('CM', 1, manifestNumber - 1)
  if (
    !Array.isArray(input.priorManifests) ||
    !input.priorManifests.every(
      (entry) =>
        isRecord(entry) &&
        CANDIDATE_MANIFEST_ID.test(entry.candidateManifestId ?? '') &&
        CANDIDATE_ATTEMPT_ID.test(entry.candidateAttempt ?? '') &&
        HEX_64.test(entry.manifestHash ?? '') &&
        ['REJECTED_INDEPENDENT_REVIEW', 'REJECTED_SEAL'].includes(
          entry.status,
        ),
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
  const expectedPriorAttemptIds = expectedIds('C', 1, attemptNumber - 1)
  if (
    new Set(priorManifestAttemptIds).size !== priorManifestAttemptIds.length ||
    new Set(rejectedAttemptIds).size !== rejectedAttemptIds.length ||
    priorManifestAttemptIds.includes(input.candidateAttempt) ||
    priorManifestAttemptIds.some(
      (candidateAttempt) => !rejectedAttemptIds.includes(candidateAttempt),
    ) ||
    !sameJson(rejectedAttemptIds, expectedPriorAttemptIds)
  ) {
    return reject('CANDIDATE_MANIFEST_HISTORY')
  }

  const commandIds = input.commandResults?.map((entry) => entry?.id) ?? []
  const expectedDiagnosticIds = expectedIds(
    'TECH-RC9-D',
    (attemptNumber - 1) * 5 + 1,
    5,
  )
  const expectedAntiPassIds = expectedIds(
    'TECH-RC9-P',
    (attemptNumber - 1) * 2 + 1,
    2,
  )
  const diagnosticIds = input.diagnosticManifest?.sampleIds ?? []
  const antiPassIds = input.antiPass?.map((entry) => entry?.sampleId) ?? []
  if (
    !isRecord(input.diagnosticManifest) ||
    input.diagnosticManifest.status !== 'PASS' ||
    input.diagnosticManifest.path !==
      diagnosticManifestPath(input.candidateAttempt) ||
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
        entry.evidencePath ===
          antiPassEvidencePath(input.candidateAttempt, entry.sampleId) &&
        HEX_64.test(entry.evidenceHash ?? ''),
    ) ||
    new Set(antiPassIds).size !== 2 ||
    !sameJson(antiPassIds, expectedAntiPassIds) ||
    !isRecord(input.rc8Guard) ||
    !GIT_SHA.test(input.rc8Guard.baselineSha ?? '') ||
    !GIT_SHA.test(input.rc8Guard.treeId ?? '') ||
    !HEX_64.test(input.rc8Guard.inventorySha256 ?? '') ||
    input.rc8Guard.status !== 'PASS' ||
    !isRecord(input.frozenEvidenceGuard) ||
    input.frozenEvidenceGuard.path !==
      frozenEvidenceGuardPath(input.candidateAttempt) ||
    !HEX_64.test(input.frozenEvidenceGuard.sha256 ?? '') ||
    input.frozenEvidenceGuard.baselineSha !== EVIDENCE_BASELINE ||
    input.frozenEvidenceGuard.status !== 'PASS_EVIDENCE_LINEAGE' ||
    !Array.isArray(input.commandResults) ||
    input.commandResults.length !== REQUIRED_COMMAND_IDS.length ||
    new Set(commandIds).size !== commandIds.length ||
    !REQUIRED_COMMAND_IDS.every((id) => commandIds.includes(id)) ||
    !input.commandResults.every(
      (entry) =>
        isRecord(entry) &&
        REQUIRED_COMMAND_IDS.includes(entry.id) &&
        entry.status === 'PASS' &&
        entry.outputPath ===
          commandOutputPath(input.candidateAttempt, entry.id) &&
        HEX_64.test(entry.outputHash ?? ''),
    ) ||
    new Set(input.commandResults.map((entry) => entry.outputPath)).size !==
      input.commandResults.length
  ) {
    return reject('CANDIDATE_MANIFEST_EVIDENCE')
  }

  if (
    input.rejectedAttempts.some((entry) => {
      const authority = REJECTION_AUTHORITIES[entry.candidateAttempt]
      return (
        !authority ||
        entry.rejectionPath !== authority.path ||
        entry.rejectionHash !== authority.sha256
      )
    })
  ) {
    return reject('CANDIDATE_MANIFEST_HISTORY')
  }

  return accept({
    candidateManifestId: input.candidateManifestId,
    candidateAttempt: input.candidateAttempt,
    authorityProfile: input.authorityProfile,
  })
}
