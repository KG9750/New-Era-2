import { createHash } from 'node:crypto'
import {
  mkdirSync,
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HEX_64 = /^[a-f0-9]{64}$/
const GIT_SHA = /^[a-f0-9]{40}$/
const CANDIDATE_ATTEMPT_ID = /^C(?:0[1-9]|[1-9]\d+)$/
const CANDIDATE_MANIFEST_ID = /^CM(?:0[1-9]|[1-9]\d+)$/
const SAMPLE_ID_V2_TECH = /^TECH-RC9-[DP](?:0[1-9]|[1-9]\d+)$/
const PHASE6_PATH =
  '/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin'
const PHASE6_NODE_PATH = '/opt/homebrew/opt/node@24/bin/node'
const PHASE6_NODE_REALPATH =
  '/opt/homebrew/Cellar/node@24/24.18.0/bin/node'
const PHASE6_NODE_VERSION = 'v24.18.0'
const PHASE6_NODE_SHA256 =
  '72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f'
const PHASE6_PLAN_REF = '441f7d96635e9176c8aea3ff21454d596c287c49'
const PHASE6_BUILD_ID = 'g1-rc-20260729.rc9-c04'
const PHASE6_SOURCE_DATE_EPOCH = '946684800'
const PHASE6_SOURCE_BASELINE = 'cd2fc9716d98c160fe530c593347992f18bf96e4'
const PHASE6_EVIDENCE_BASELINE =
  '5b9438cc5123ba35d8a703f3507bbf463e90176d'
const PHASE6_REJECTED_SOURCE_SHA =
  'a39c63387242b0aaea0c76c6e36cc5bdc4851909'
const PHASE6_EXCLUDED_ANCESTORS = Object.freeze([
  '3cc6de4f6c8458f51936a893b95ea08e62bb0883',
  'bbda54826dc529ad3b93c55c4fd164463c842401',
  'b027ad8019d8fa46eaf7596c40eb28f470cc8c06',
  '6752c3b4f73a17fadcfc2420c9b9c6ededeeceb9',
])
const PHASE6_RC8_BASELINE = 'c0f4269bc3fef56962199629bad8db041aafc5f0'
const PHASE6_RC8_PATH =
  '../data/playtests/weekly-management-slice/gate1a/' +
  'g1a-20260726-rc8-01'
const PHASE6_AUTHORITY_PROBE =
  'tests/fixtures/manifests/candidate-c04-authority-probe.json'
export const SOURCE_CHANGE_ALLOWLIST = Object.freeze(
  `CONTEXT.md
PLANS.md
docs/exec-plans/active/2026-07-29-gate1a-rc9-c04-recovery-plan.md
docs/exec-plans/evidence/2026-07-29-c04-cli-compatibility-probe.json
docs/exec-plans/evidence/2026-07-29-c04-cli-compatibility-probe.json.sha256
docs/exec-plans/evidence/2026-07-29-c04-compatibility-amendment-review.json
docs/exec-plans/evidence/2026-07-29-c04-compatibility-amendment-review.json.sha256
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-discovery.json
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-discovery.json.sha256
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-recapture.json
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-recapture.json.sha256
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-amendment-review.json
docs/exec-plans/evidence/2026-07-29-c04-isolation-grammar-amendment-review.json.sha256
docs/exec-plans/active/2026-07-27-gate1a-rc9-test-operations.md
prototype/package.json
prototype/scripts/candidate-manifest-contract.mjs
prototype/scripts/check-playtest-fixtures.mjs
prototype/scripts/verify-c04-runtime-equivalence.mjs
prototype/scripts/verify-diagnostic-isolation.mjs
prototype/scripts/verify-frozen-evidence.mjs
prototype/scripts/verify-playtest-manifest.mjs
prototype/scripts/create-deterministic-archive.mjs
prototype/tests/playtest-manifest.test.ts
prototype/tests/c04-verifier-cli.test.ts
prototype/tests/deterministic-archive.test.ts
prototype/tests/fixtures/fixture-expectations.json
prototype/tests/fixtures/isolation/aggregate-valid.json
prototype/tests/fixtures/isolation/fixture-matrix.json
prototype/tests/fixtures/isolation/sample-valid.json
prototype/tests/fixtures/isolation/golden-codex-0.146.0-alpha.3.1-persisted-rollout.jsonl
prototype/tests/fixtures/isolation/golden-codex-0.146.0-alpha.3.1-exec-events.jsonl
prototype/tests/fixtures/manifests/candidate-c01-rewrapped-by-cm02-rejected.json
prototype/tests/fixtures/manifests/candidate-c02-first-manifest-valid.json
prototype/tests/fixtures/manifests/candidate-c02-reuses-c01-evidence-rejected.json
prototype/tests/fixtures/manifests/candidate-c02-second-manifest-valid.json
prototype/tests/fixtures/manifests/candidate-c03-rejection-history-rejected.json
prototype/tests/fixtures/manifests/candidate-c04-authority-probe.json
prototype/tests/fixtures/manifests/candidate-c04-synthetic-valid.json
prototype/tests/fixtures/manifests/candidate-invalid-incomplete-authority.json
prototype/tests/fixtures/manifests/candidate-invalid-source-sha.json
prototype/tests/fixtures/manifests/candidate-missing-profile-rejected.json
prototype/tests/fixtures/manifests/candidate-unknown-profile-rejected.json
prototype/tests/fixtures/manifests/candidate-v03-extra-authority-rejected.json
prototype/tests/fixtures/manifests/candidate-v03-path-mismatch-rejected.json
prototype/tests/fixtures/manifests/candidate-v03-protocol-mismatch-rejected.json
prototype/tests/fixtures/manifests/candidate-v03-role-mismatch-rejected.json
prototype/tests/fixtures/manifests/candidate-v03-scenario-mismatch-rejected.json
prototype/tests/fixtures/manifests/candidate-valid.json
prototype/tests/fixtures/manifests/candidate-zero-id-rejected.json`.split('\n'),
)

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
export const PHASE6_WRAPPER_COMMAND_IDS = Object.freeze([
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
  'rc-repro',
  'frozen-evidence-guard',
  'manifest-fixtures',
  'manifest-probe',
  'runtime-equivalence',
])
const PHASE6_JSON_COMMAND_IDS = new Set([
  'frozen-evidence-guard',
  'manifest-fixtures',
  'manifest-probe',
  'runtime-equivalence',
])
const PHASE6_JSON_SUCCESS_STATUS = Object.freeze({
  'frozen-evidence-guard': 'PASS_EVIDENCE_LINEAGE',
  'manifest-fixtures': 'PASS_FIXTURES',
  'manifest-probe': 'PASS_AUTHORITY_PREFLIGHT',
  'runtime-equivalence': 'PASS_RUNTIME_EQUIVALENCE',
})

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

function phase6EvidenceRoot(candidateAttempt) {
  const directory =
    candidateAttempt === 'C04' ? 'phase6-retry-03' : 'phase6'
  return `${candidateRoot(candidateAttempt)}/evidence/${directory}`
}

export function frozenEvidenceGuardPath(candidateAttempt) {
  return `${phase6EvidenceRoot(candidateAttempt)}/frozen-evidence-guard.json`
}

export function commandOutputPath(candidateAttempt, commandId) {
  const filename = COMMAND_OUTPUT_FILES[commandId]
  return filename
    ? `${phase6EvidenceRoot(candidateAttempt)}/${filename}`
    : null
}

function phase6OutputPath(candidateAttempt, commandId) {
  return commandId === 'frozen-evidence-guard'
    ? frozenEvidenceGuardPath(candidateAttempt)
    : commandOutputPath(candidateAttempt, commandId)
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

function phase6NpmArgv(script, args = []) {
  return [
    'npm',
    'run',
    script,
    ...(args.length > 0 ? ['--', ...args] : []),
  ]
}

export function expectedPhase6Argv(identity) {
  if (!isRecord(identity)) return null
  const sourceSha =
    identity.mode === 'source'
      ? identity.sourceSha
      : identity.artifactSourceSha
  const headSha =
    identity.mode === 'source'
      ? identity.sourceSha
      : identity.integrationSha
  const output = identity.outputPath
  const archive = identity.archivePath
  const commands = {
    lint: phase6NpmArgv('lint'),
    test: phase6NpmArgv('test:run'),
    build: phase6NpmArgv('build'),
    'rc-build': phase6NpmArgv('rc:build', [
      '--build-id',
      PHASE6_BUILD_ID,
      '--git-sha',
      sourceSha,
    ]),
    'rc-verify': phase6NpmArgv('rc:verify'),
    'e2e-rc': phase6NpmArgv('e2e:rc'),
    'rc-archive': phase6NpmArgv('rc:archive', [
      '--input',
      'dist',
      '--output',
      archive,
      '--source-date-epoch',
      PHASE6_SOURCE_DATE_EPOCH,
    ]),
    'rc-verify-archive': phase6NpmArgv('rc:verify-archive', [
      '--input',
      'dist',
      '--archive',
      archive,
      '--source-date-epoch',
      PHASE6_SOURCE_DATE_EPOCH,
    ]),
    'schema-fixtures': phase6NpmArgv('schema:fixtures'),
    'guard-rc8': phase6NpmArgv('guard:rc8', [
      '--baseline',
      PHASE6_RC8_BASELINE,
      '--path',
      PHASE6_RC8_PATH,
    ]),
    'manifest-fixtures': phase6NpmArgv('manifest:verify', [
      '--fixtures',
      '--output',
      output,
    ]),
    'manifest-probe': phase6NpmArgv('manifest:verify', [
      '--probe',
      PHASE6_AUTHORITY_PROBE,
      '--repo-root',
      '..',
      '--output',
      output,
    ]),
    'runtime-equivalence': phase6NpmArgv('runtime:equivalence', [
      '--head',
      headSha,
      '--artifact-git-sha',
      sourceSha,
      '--output',
      output,
    ]),
    'rc-repro': phase6NpmArgv('rc:repro', [
      '--git-sha',
      sourceSha,
      '--build-id',
      PHASE6_BUILD_ID,
      '--source-date-epoch',
      PHASE6_SOURCE_DATE_EPOCH,
      ...(identity.mode === 'source'
        ? ['--source-repository', '..']
        : []),
    ]),
    'frozen-evidence-guard': phase6NpmArgv('guard:frozen-evidence', [
      '--mode',
      identity.mode === 'source' ? 'source' : 'evidence-lineage',
      '--baseline',
      identity.mode === 'source'
        ? PHASE6_SOURCE_BASELINE
        : PHASE6_EVIDENCE_BASELINE,
      '--head',
      headSha,
      '--output',
      output,
    ]),
  }
  return commands[identity.commandId] ?? null
}

export function validatePhase6Identity(identity, expectedCommandId) {
  const validBinding =
    (identity?.mode === 'source' &&
      GIT_SHA.test(identity.sourceSha ?? '') &&
      !Object.hasOwn(identity, 'integrationSha') &&
      !Object.hasOwn(identity, 'artifactSourceSha')) ||
    (identity?.mode === 'integration' &&
      GIT_SHA.test(identity.integrationSha ?? '') &&
      GIT_SHA.test(identity.artifactSourceSha ?? '') &&
      !Object.hasOwn(identity, 'sourceSha'))
  const archiveCommand = [
    'rc-archive',
    'rc-verify-archive',
  ].includes(expectedCommandId)
  const validOutput =
    (identity?.mode === 'source' &&
      typeof identity.outputPath === 'string' &&
      isAbsolute(identity.outputPath)) ||
    (identity?.mode === 'integration' &&
      identity.outputPath === phase6OutputPath('C04', expectedCommandId))
  if (
    !isRecord(identity) ||
    identity.schemaVersion !== 'c04-phase6-command-identity-v1' ||
    identity.commandId !== expectedCommandId ||
    !validBinding ||
    identity.environment?.PATH !== PHASE6_PATH ||
    Object.keys(identity.environment ?? {}).length !== 1 ||
    identity.commandVNodePath !== PHASE6_NODE_PATH ||
    identity.resolvedNodeRealPath !== PHASE6_NODE_REALPATH ||
    identity.nodeVersion !== PHASE6_NODE_VERSION ||
    identity.nodeBinarySha256 !== PHASE6_NODE_SHA256 ||
    identity.workingDirectory !== 'prototype' ||
    !validOutput ||
    (archiveCommand
      ? typeof identity.archivePath !== 'string' ||
        !isAbsolute(identity.archivePath)
      : Object.hasOwn(identity, 'archivePath')) ||
    !Array.isArray(identity.argv) ||
    identity.argv.some((entry) => typeof entry !== 'string') ||
    !sameJson(identity.argv, expectedPhase6Argv(identity)) ||
    identity.planRef !== PHASE6_PLAN_REF
  ) {
    return false
  }
  return true
}

export function phase6IdentityFromEnvironment(expectedCommandId) {
  const encoded = process.env.C04_PHASE6_IDENTITY_V1
  if (encoded === undefined) return null
  let identity
  try {
    identity = JSON.parse(encoded)
  } catch {
    throw new Error('C04_PHASE6_IDENTITY')
  }
  if (!validatePhase6Identity(identity, expectedCommandId)) {
    throw new Error('C04_PHASE6_IDENTITY')
  }
  return identity
}

export function reservedPhase6IdentityFromEnvironment(
  repoRoot,
  resolvedOutputPath,
  expectedCommandId,
  expectedBindings = {},
) {
  const reservedOutput = phase6OutputPath('C04', expectedCommandId)
  if (
    typeof reservedOutput !== 'string' ||
    resolve(repoRoot, reservedOutput) !== resolvedOutputPath
  ) {
    return null
  }
  const identity = phase6IdentityFromEnvironment(expectedCommandId)
  if (
    !identity ||
    identity.mode !== 'integration' ||
    identity.outputPath !== reservedOutput ||
    (expectedBindings.integrationSha !== undefined &&
      identity.integrationSha !== expectedBindings.integrationSha) ||
    (expectedBindings.artifactSourceSha !== undefined &&
      identity.artifactSourceSha !== expectedBindings.artifactSourceSha) ||
    !phase6TopologyBinding(
      repoRoot,
      identity.mode,
      undefined,
      identity.integrationSha,
      identity.artifactSourceSha,
    )
  ) {
    throw new Error('C04_PHASE6_IDENTITY')
  }
  return identity
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

function phase6ProcessEnvironment() {
  const environment = {
    ...process.env,
    PATH: PHASE6_PATH,
  }
  for (const key of Object.keys(environment)) {
    if (key.startsWith('GIT_') && !key.startsWith('GIT_TRACE')) {
      delete environment[key]
    }
  }
  return environment
}

function phase6NodeIdentity() {
  try {
    if (process.env.PATH !== PHASE6_PATH) return false
    const commandV = spawnSync('/bin/sh', ['-c', 'command -v node'], {
      encoding: 'utf8',
      env: phase6ProcessEnvironment(),
    })
    if (
      commandV.status !== 0 ||
      commandV.stdout.trim() !== PHASE6_NODE_PATH ||
      realpathSync(PHASE6_NODE_PATH) !== PHASE6_NODE_REALPATH ||
      process.execPath !== PHASE6_NODE_REALPATH
    ) {
      return false
    }
    const version = spawnSync(PHASE6_NODE_PATH, ['--version'], {
      encoding: 'utf8',
      env: phase6ProcessEnvironment(),
    })
    if (
      version.status !== 0 ||
      version.stdout.trim() !== PHASE6_NODE_VERSION ||
      createHash('sha256')
        .update(readFileSync(PHASE6_NODE_REALPATH))
        .digest('hex') !== PHASE6_NODE_SHA256
    ) {
      return false
    }
  } catch {
    return false
  }
  return {
    environment: { PATH: PHASE6_PATH },
    commandVNodePath: PHASE6_NODE_PATH,
    resolvedNodeRealPath: PHASE6_NODE_REALPATH,
    nodeVersion: PHASE6_NODE_VERSION,
    nodeBinarySha256: PHASE6_NODE_SHA256,
  }
}

function phase6Failure(errorCode) {
  process.stderr.write(`${JSON.stringify({ errorCode })}\n`)
  process.exitCode = 1
}

function phase6AllowlistTree(repoRoot, commit) {
  const listing = spawnSync(
    'git',
    [
      '-C',
      repoRoot,
      'ls-tree',
      '-r',
      '-z',
      '--full-tree',
      commit,
      '--',
      ...SOURCE_CHANGE_ALLOWLIST,
    ],
    {
      encoding: 'buffer',
      env: phase6ProcessEnvironment(),
    },
  )
  if (listing.status !== 0) return null
  const observed = new Map()
  for (const record of listing.stdout.toString('utf8').split('\0')) {
    if (record === '') continue
    const match = record.match(
      /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/,
    )
    if (
      !match ||
      !SOURCE_CHANGE_ALLOWLIST.includes(match[3]) ||
      observed.has(match[3])
    ) {
      return null
    }
    observed.set(match[3], `${match[1]} ${match[2]}`)
  }
  return observed.size === SOURCE_CHANGE_ALLOWLIST.length
    ? observed
    : null
}

function phase6PriorIntegrationOutputs(commandId) {
  const index = PHASE6_WRAPPER_COMMAND_IDS.indexOf(commandId)
  if (index < 0) return null
  const outputs = []
  for (const priorCommandId of PHASE6_WRAPPER_COMMAND_IDS.slice(0, index)) {
    const output = phase6OutputPath('C04', priorCommandId)
    if (typeof output !== 'string') return null
    outputs.push(output)
    if (PHASE6_JSON_COMMAND_IDS.has(priorCommandId)) {
      outputs.push(`${output}.sha256`)
    }
  }
  return outputs
}

function phase6CanonicalBase64(value) {
  return (
    typeof value === 'string' &&
    Buffer.from(value, 'base64').toString('base64') === value
  )
}

function phase6PriorIdentityValid(
  identity,
  commandId,
  integrationSha,
  artifactSourceSha,
  outputPath,
) {
  return (
    validatePhase6Identity(identity, commandId) &&
    identity.mode === 'integration' &&
    identity.integrationSha === integrationSha &&
    identity.artifactSourceSha === artifactSourceSha &&
    identity.outputPath === outputPath
  )
}

function phase6LastJsonLine(bytes) {
  let text
  try {
    text = bytes.toString('utf8')
    if (!Buffer.from(text, 'utf8').equals(bytes)) return null
    const lines = text.trimEnd().split('\n')
    return JSON.parse(lines.at(-1))
  } catch {
    return null
  }
}

function phase6ArchiveObservation(
  repoRoot,
  identity,
  stdoutBytes,
  verified,
) {
  const document = phase6LastJsonLine(stdoutBytes)
  if (
    !isRecord(document) ||
    (verified
      ? document.verified !== true
      : Object.hasOwn(document, 'verified')) ||
    document.archive !== identity.archivePath ||
    document.archiveFormat !== 'ustar' ||
    !HEX_64.test(document.archiveHash ?? '') ||
    !Number.isSafeInteger(document.bytes) ||
    document.bytes <= 0 ||
    !Number.isSafeInteger(document.entryCount) ||
    document.entryCount <= 0 ||
    document.sourceDateEpoch !== Number(PHASE6_SOURCE_DATE_EPOCH)
  ) {
    return null
  }
  try {
    if (!phase6ArchivePathSafe(repoRoot, identity.archivePath)) return null
    const entry = lstatSync(identity.archivePath, {
      throwIfNoEntry: false,
    })
    if (!entry?.isFile() || entry.isSymbolicLink()) return null
    const bytes = readFileSync(identity.archivePath)
    if (
      bytes.length !== document.bytes ||
      createHash('sha256').update(bytes).digest('hex') !==
        document.archiveHash
    ) {
      return null
    }
  } catch {
    return null
  }
  return {
    archive: document.archive,
    archiveFormat: document.archiveFormat,
    archiveHash: document.archiveHash,
    bytes: document.bytes,
    entryCount: document.entryCount,
    sourceDateEpoch: document.sourceDateEpoch,
  }
}

function phase6ReadPriorText(
  repoRoot,
  commandId,
  integrationSha,
  artifactSourceSha,
) {
  const outputPath = phase6OutputPath('C04', commandId)
  let bytes
  try {
    bytes = readFileSync(resolve(repoRoot, outputPath))
  } catch {
    return null
  }
  const text = bytes.toString('utf8')
  if (!Buffer.from(text, 'utf8').equals(bytes)) return null
  const lines = text.split('\n')
  if (
    lines.length !== 3 ||
    lines[0] !== 'C04_PHASE6_IDENTITY_V1' ||
    lines[2] !== ''
  ) {
    return null
  }
  let record
  try {
    record = JSON.parse(lines[1])
  } catch {
    return null
  }
  if (
    !isRecord(record) ||
    !sameJson(Object.keys(record).sort(), [
      'childExitCode',
      'phase6Identity',
      'schemaVersion',
      'stderrBase64',
      'stdoutBase64',
    ]) ||
    record.schemaVersion !== 'c04-phase6-text-record-v1' ||
    record.childExitCode !== 0 ||
    !phase6CanonicalBase64(record.stdoutBase64) ||
    !phase6CanonicalBase64(record.stderrBase64) ||
    !phase6PriorIdentityValid(
      record.phase6Identity,
      commandId,
      integrationSha,
      artifactSourceSha,
      outputPath,
    )
  ) {
    return null
  }
  return {
    identity: record.phase6Identity,
    stdout: Buffer.from(record.stdoutBase64, 'base64'),
    stderr: Buffer.from(record.stderrBase64, 'base64'),
  }
}

function phase6ReadPriorJson(
  repoRoot,
  commandId,
  integrationSha,
  artifactSourceSha,
) {
  const outputPath = phase6OutputPath('C04', commandId)
  const absolutePath = resolve(repoRoot, outputPath)
  let bytes
  let document
  let sidecar
  try {
    bytes = readFileSync(absolutePath)
    document = JSON.parse(bytes.toString('utf8'))
    sidecar = readFileSync(`${absolutePath}.sha256`, 'utf8')
  } catch {
    return null
  }
  if (
    !isRecord(document) ||
    document.status !== PHASE6_JSON_SUCCESS_STATUS[commandId] ||
    !phase6PriorIdentityValid(
      document.phase6Identity,
      commandId,
      integrationSha,
      artifactSourceSha,
      outputPath,
    ) ||
    sidecar !==
      `${createHash('sha256').update(bytes).digest('hex')}  ${outputPath}\n`
  ) {
    return null
  }
  return { identity: document.phase6Identity, document }
}

function phase6PriorIntegrationEvidence(
  repoRoot,
  commandId,
  integrationSha,
  artifactSourceSha,
  currentArchivePath,
) {
  const index = PHASE6_WRAPPER_COMMAND_IDS.indexOf(commandId)
  if (index < 0) return false
  const expectedOutputs = phase6PriorIntegrationOutputs(commandId)
  const untracked = phase6UntrackedPaths(repoRoot)
  if (
    !expectedOutputs ||
    !untracked ||
    untracked.length !== expectedOutputs.length ||
    expectedOutputs.some((path) => !untracked.includes(path))
  ) {
    return false
  }
  for (const path of expectedOutputs) {
    const entry = lstatSync(resolve(repoRoot, path), {
      throwIfNoEntry: false,
    })
    if (!entry?.isFile() || entry.isSymbolicLink()) return false
  }
  const retryRoot = resolve(
    repoRoot,
    candidateRoot('C04'),
    'evidence',
    'phase6-retry-03',
  )
  const retryEntry = lstatSync(retryRoot, { throwIfNoEntry: false })
  if (index === 0) return retryEntry === undefined
  if (!retryEntry?.isDirectory() || retryEntry.isSymbolicLink()) {
    return false
  }
  let archiveCreated = null
  let archiveVerified = null
  for (const priorCommandId of PHASE6_WRAPPER_COMMAND_IDS.slice(0, index)) {
    const prior = PHASE6_JSON_COMMAND_IDS.has(priorCommandId)
      ? phase6ReadPriorJson(
          repoRoot,
          priorCommandId,
          integrationSha,
          artifactSourceSha,
        )
      : phase6ReadPriorText(
          repoRoot,
          priorCommandId,
          integrationSha,
          artifactSourceSha,
        )
    if (!prior) return false
    if (priorCommandId === 'rc-archive') {
      archiveCreated = phase6ArchiveObservation(
        repoRoot,
        prior.identity,
        prior.stdout,
        false,
      )
      if (!archiveCreated) return false
    }
    if (priorCommandId === 'rc-verify-archive') {
      archiveVerified = phase6ArchiveObservation(
        repoRoot,
        prior.identity,
        prior.stdout,
        true,
      )
      if (
        !archiveVerified ||
        !sameJson(archiveCreated, archiveVerified)
      ) {
        return false
      }
    }
  }
  return !(
    commandId === 'rc-verify-archive' &&
    (!archiveCreated ||
      currentArchivePath !== archiveCreated.archive)
  )
}

function phase6NulRecords(bytes) {
  if (bytes.length === 0) return []
  if (bytes.at(-1) !== 0) return null
  const records = []
  let start = 0
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0) continue
    if (index === start) return null
    records.push(bytes.subarray(start, index))
    start = index + 1
  }
  return records
}

function phase6Utf8Path(bytes) {
  const path = bytes.toString('utf8')
  return (
      path !== '' &&
      Buffer.from(path, 'utf8').equals(bytes)
    )
    ? path
    : null
}

function phase6HeadTree(repoRoot) {
  const listing = spawnSync(
    'git',
    ['-C', repoRoot, 'ls-tree', '-r', '-z', '--full-tree', 'HEAD'],
    {
      encoding: 'buffer',
      env: phase6ProcessEnvironment(),
    },
  )
  if (listing.status !== 0) return false
  const records = phase6NulRecords(listing.stdout)
  if (!records) return null
  const tree = new Map()
  for (const record of records) {
    const separator = record.indexOf(0x09)
    if (separator < 0) return null
    const header = record.subarray(0, separator).toString('ascii')
    const match = header.match(
      /^(100644|100755|120000) blob ([a-f0-9]{40})$/,
    )
    const path = phase6Utf8Path(record.subarray(separator + 1))
    if (!match || !path || tree.has(path)) return null
    tree.set(path, { mode: match[1], oid: match[2] })
  }
  return tree
}

function phase6IndexTree(repoRoot) {
  const listing = spawnSync(
    'git',
    ['-C', repoRoot, 'ls-files', '-v', '-z', '--stage'],
    {
      encoding: 'buffer',
      env: phase6ProcessEnvironment(),
    },
  )
  if (listing.status !== 0) return null
  const records = phase6NulRecords(listing.stdout)
  if (!records) return null
  const tree = new Map()
  for (const record of records) {
    const separator = record.indexOf(0x09)
    if (separator < 0) return null
    const header = record.subarray(0, separator).toString('ascii')
    const match = header.match(
      /^H (100644|100755|120000) ([a-f0-9]{40}) 0$/,
    )
    const path = phase6Utf8Path(record.subarray(separator + 1))
    if (!match || !path || tree.has(path)) return null
    tree.set(path, { mode: match[1], oid: match[2] })
  }
  return tree
}

function phase6TrackedTreeBinding(repoRoot) {
  const headTree = phase6HeadTree(repoRoot)
  const indexTree = phase6IndexTree(repoRoot)
  if (
    !headTree ||
    !indexTree ||
    headTree.size !== indexTree.size
  ) {
    return false
  }
  for (const [path, headEntry] of headTree) {
    const indexEntry = indexTree.get(path)
    if (
      !indexEntry ||
      indexEntry.mode !== headEntry.mode ||
      indexEntry.oid !== headEntry.oid
    ) {
      return false
    }
  }
  const environment = phase6ProcessEnvironment()
  const indexDiff = spawnSync(
    'git',
    [
      '-C',
      repoRoot,
      'diff-index',
      '--cached',
      '--quiet',
      'HEAD',
      '--',
    ],
    { encoding: 'utf8', env: environment },
  )
  if (indexDiff.status !== 0) return false
  const worktreeDiff = spawnSync(
    'git',
    [
      '-C',
      repoRoot,
      'diff-files',
      '--quiet',
      '--no-ext-diff',
      '--ignore-submodules=none',
      '--',
    ],
    { encoding: 'utf8', env: environment },
  )
  return worktreeDiff.status === 0
}

function phase6UntrackedPaths(repoRoot) {
  const listing = spawnSync(
    'git',
    [
      '-C',
      repoRoot,
      'ls-files',
      '--others',
      '--exclude-standard',
      '-z',
    ],
    {
      encoding: 'buffer',
      env: phase6ProcessEnvironment(),
    },
  )
  if (listing.status !== 0) return null
  const records = phase6NulRecords(listing.stdout)
  if (!records) return null
  const paths = records.map(phase6Utf8Path)
  return paths.includes(null) ? null : paths
}

function phase6IsAncestor(repoRoot, ancestor, descendant) {
  const result = spawnSync(
    'git',
    [
      '-C',
      repoRoot,
      'merge-base',
      '--is-ancestor',
      ancestor,
      descendant,
    ],
    {
      encoding: 'utf8',
      env: phase6ProcessEnvironment(),
    },
  )
  return [0, 1].includes(result.status)
    ? result.status === 0
    : null
}

function phase6RangeMatchesAllowlist(repoRoot, baseline, head) {
  const diff = spawnSync(
    'git',
    [
      '-C',
      repoRoot,
      'diff',
      '--name-status',
      '-z',
      '--no-renames',
      baseline,
      head,
    ],
    {
      encoding: 'buffer',
      env: phase6ProcessEnvironment(),
    },
  )
  if (diff.status !== 0) return false
  const records = phase6NulRecords(diff.stdout)
  if (!records || records.length % 2 !== 0) return false
  const seen = new Set()
  for (let index = 0; index < records.length; index += 2) {
    const status = records[index].toString('ascii')
    const path = phase6Utf8Path(records[index + 1])
    if (
      !['A', 'M'].includes(status) ||
      !path ||
      !SOURCE_CHANGE_ALLOWLIST.includes(path) ||
      seen.has(path)
    ) {
      return false
    }
    seen.add(path)
  }
  return true
}

function phase6TopologyBinding(
  repoRoot,
  mode,
  sourceSha,
  integrationSha,
  artifactSourceSha,
) {
  const source =
    mode === 'source' ? sourceSha : artifactSourceSha
  if (
    source === PHASE6_REJECTED_SOURCE_SHA ||
    phase6IsAncestor(repoRoot, PHASE6_PLAN_REF, source) !== true ||
    phase6IsAncestor(repoRoot, PHASE6_SOURCE_BASELINE, source) !== true ||
    !phase6RangeMatchesAllowlist(
      repoRoot,
      PHASE6_SOURCE_BASELINE,
      source,
    )
  ) {
    return false
  }
  for (const excluded of PHASE6_EXCLUDED_ANCESTORS) {
    if (phase6IsAncestor(repoRoot, excluded, source) !== false) {
      return false
    }
  }
  if (mode === 'source') return true
  if (
    phase6IsAncestor(
      repoRoot,
      PHASE6_EVIDENCE_BASELINE,
      integrationSha,
    ) !== true ||
    !phase6RangeMatchesAllowlist(
      repoRoot,
      PHASE6_EVIDENCE_BASELINE,
      integrationSha,
    )
  ) {
    return false
  }
  return PHASE6_EXCLUDED_ANCESTORS.every(
    (excluded) =>
      phase6IsAncestor(repoRoot, excluded, integrationSha) === false,
  )
}

function phase6GitBinding(
  repoRoot,
  commandId,
  mode,
  sourceSha,
  integrationSha,
  artifactSourceSha,
) {
  const head = spawnSync(
    'git',
    [
      '-C',
      repoRoot,
      'rev-parse',
      '--show-toplevel',
      '--verify',
      'HEAD^{commit}',
    ],
    {
      encoding: 'utf8',
      env: phase6ProcessEnvironment(),
    },
  )
  const headLines = head.stdout.trim().split('\n')
  if (
    head.status !== 0 ||
    headLines.length !== 2 ||
    realpathSync(headLines[0]) !== realpathSync(repoRoot) ||
    headLines[1] !== (mode === 'source' ? sourceSha : integrationSha)
  ) {
    return false
  }
  if (
    !phase6TopologyBinding(
      repoRoot,
      mode,
      sourceSha,
      integrationSha,
      artifactSourceSha,
    )
  ) {
    return false
  }
  if (!phase6TrackedTreeBinding(repoRoot)) return false
  const artifactTree = phase6AllowlistTree(
    repoRoot,
    mode === 'source' ? sourceSha : artifactSourceSha,
  )
  if (!artifactTree) return false
  if (mode === 'integration') {
    const integrationTree = phase6AllowlistTree(
      repoRoot,
      integrationSha,
    )
    if (
      !integrationTree ||
      SOURCE_CHANGE_ALLOWLIST.some(
        (path) => artifactTree.get(path) !== integrationTree.get(path),
      )
    ) {
      return false
    }
  }
  const untracked = phase6UntrackedPaths(repoRoot)
  if (!untracked) return false
  if (mode === 'source') return untracked.length === 0
  return true
}

function phase6Argument(name, beforeSeparator) {
  const index = beforeSeparator.lastIndexOf(name)
  return index >= 0 ? beforeSeparator[index + 1] : undefined
}

function phase6InsidePath(root, target) {
  const location = relative(root, target)
  return (
    location === '' ||
    (!location.startsWith(`..${sep}`) &&
      location !== '..' &&
      !isAbsolute(location))
  )
}

function phase6SafeParent(target, requiredRoot, forbiddenRoot) {
  const trustedRoot = requiredRoot
    ? realpathSync(requiredRoot)
    : null
  const excludedRoot = forbiddenRoot
    ? realpathSync(forbiddenRoot)
    : null
  let cursor = dirname(target)
  while (true) {
    const entry = lstatSync(cursor, { throwIfNoEntry: false })
    if (entry) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) return false
      const real = realpathSync(cursor)
      if (
        trustedRoot &&
        !phase6InsidePath(trustedRoot, real)
      ) {
        return false
      }
      if (
        excludedRoot &&
        phase6InsidePath(excludedRoot, real)
      ) {
        return false
      }
    }
    if (trustedRoot && cursor === trustedRoot) {
      return Boolean(entry)
    }
    const parent = dirname(cursor)
    if (parent === cursor) return trustedRoot === null
    cursor = parent
  }
}

function phase6OutputPathSafe(repoRoot, mode, outputPath) {
  const canonicalRepoRoot = realpathSync(repoRoot)
  if (mode === 'source') {
    return !(
      resolve(outputPath) !== outputPath ||
      phase6InsidePath(canonicalRepoRoot, outputPath) ||
      !phase6SafeParent(outputPath, null, canonicalRepoRoot)
    )
  }
  return (
    phase6InsidePath(canonicalRepoRoot, outputPath) &&
    phase6SafeParent(outputPath, canonicalRepoRoot, null)
  )
}

function phase6ArchivePathSafe(repoRoot, archivePath) {
  const canonicalRepoRoot = realpathSync(repoRoot)
  return (
    resolve(archivePath) === archivePath &&
    !phase6InsidePath(canonicalRepoRoot, archivePath) &&
    phase6SafeParent(archivePath, null, canonicalRepoRoot)
  )
}

function runPhase6Command() {
  const nodeIdentity = phase6NodeIdentity()
  if (!nodeIdentity) {
    phase6Failure('C04_NODE_IDENTITY')
    return
  }

  const separator = process.argv.indexOf('--')
  const beforeSeparator =
    separator >= 0 ? process.argv.slice(2, separator) : process.argv.slice(2)
  const argv = separator >= 0 ? process.argv.slice(separator + 1) : []
  const commandId = phase6Argument('--command-id', beforeSeparator)
  const mode = phase6Argument('--mode', beforeSeparator)
  const planRef = phase6Argument('--plan-ref', beforeSeparator)
  const sourceSha = phase6Argument('--source-sha', beforeSeparator)
  const integrationSha = phase6Argument(
    '--integration-sha',
    beforeSeparator,
  )
  const artifactSourceSha = phase6Argument(
    '--artifact-source-sha',
    beforeSeparator,
  )
  const output = phase6Argument('--output', beforeSeparator)
  const archivePath = phase6Argument('--archive-path', beforeSeparator)
  const archiveCommand = [
    'rc-archive',
    'rc-verify-archive',
  ].includes(commandId)
  const validSourceBinding =
    mode === 'source' &&
    GIT_SHA.test(sourceSha ?? '') &&
    typeof output === 'string' &&
    isAbsolute(output)
  const validIntegrationBinding =
    mode === 'integration' &&
    GIT_SHA.test(integrationSha ?? '') &&
    GIT_SHA.test(artifactSourceSha ?? '') &&
    isRepoRelativePath(output)
  const expectedWrapperArguments =
    validSourceBinding
      ? [
          '--phase6-run',
          '--command-id',
          commandId,
          '--mode',
          'source',
          '--plan-ref',
          PHASE6_PLAN_REF,
          '--source-sha',
          sourceSha,
          '--output',
          output,
          ...(archiveCommand
            ? ['--archive-path', archivePath]
            : []),
        ]
      : validIntegrationBinding
        ? [
            '--phase6-run',
            '--command-id',
            commandId,
            '--mode',
            'integration',
            '--plan-ref',
            PHASE6_PLAN_REF,
            '--integration-sha',
            integrationSha,
            '--artifact-source-sha',
            artifactSourceSha,
            '--output',
            output,
            ...(archiveCommand
              ? ['--archive-path', archivePath]
              : []),
          ]
        : null
  if (
    !PHASE6_WRAPPER_COMMAND_IDS.includes(commandId) ||
    planRef !== PHASE6_PLAN_REF ||
    (!validSourceBinding && !validIntegrationBinding) ||
    (archiveCommand
      ? typeof archivePath !== 'string' || !isAbsolute(archivePath)
      : archivePath !== undefined) ||
    !sameJson(beforeSeparator, expectedWrapperArguments)
  ) {
    phase6Failure('C04_PHASE6_ARGUMENT')
    return
  }
  if (
    mode === 'integration' &&
    output !== phase6OutputPath('C04', commandId)
  ) {
    phase6Failure('C04_PHASE6_OUTPUT_PATH')
    return
  }
  const repoRoot = resolve(import.meta.dirname, '..', '..')
  const prototypeRoot = resolve(repoRoot, 'prototype')
  const identity = {
    schemaVersion: 'c04-phase6-command-identity-v1',
    commandId,
    mode,
    ...nodeIdentity,
    workingDirectory: 'prototype',
    outputPath: output,
    ...(archiveCommand ? { archivePath } : {}),
    argv,
    planRef,
    ...(mode === 'source'
      ? { sourceSha }
      : { integrationSha, artifactSourceSha }),
  }
  if (!sameJson(argv, expectedPhase6Argv(identity))) {
    phase6Failure('C04_NODE_COMMAND')
    return
  }
  if (
    !phase6GitBinding(
      repoRoot,
      commandId,
      mode,
      sourceSha,
      integrationSha,
      artifactSourceSha,
    )
  ) {
    phase6Failure('C04_PHASE6_GIT_BINDING')
    return
  }
  if (
    mode === 'integration' &&
    !phase6PriorIntegrationEvidence(
      repoRoot,
      commandId,
      integrationSha,
      artifactSourceSha,
      archivePath,
    )
  ) {
    phase6Failure('C04_PHASE6_PRIOR_EVIDENCE')
    return
  }

  const outputPath =
    mode === 'source'
      ? output
      : resolve(repoRoot, output)
  const jsonOutput = PHASE6_JSON_COMMAND_IDS.has(commandId)
  try {
    if (!phase6OutputPathSafe(repoRoot, mode, outputPath)) {
      phase6Failure('C04_PHASE6_OUTPUT_PATH')
      return
    }
  } catch {
    phase6Failure('C04_PHASE6_OUTPUT_PATH')
    return
  }
  if (archivePath) {
    try {
      if (!phase6ArchivePathSafe(repoRoot, archivePath)) {
        phase6Failure('C04_PHASE6_ARCHIVE_PATH')
        return
      }
    } catch {
      phase6Failure('C04_PHASE6_ARCHIVE_PATH')
      return
    }
  }
  if (
    lstatSync(outputPath, { throwIfNoEntry: false }) ||
    (jsonOutput &&
      lstatSync(`${outputPath}.sha256`, { throwIfNoEntry: false }))
  ) {
    phase6Failure('C04_PHASE6_OUTPUT_EXISTS')
    return
  }
  const archiveEntry = archivePath
    ? lstatSync(archivePath, { throwIfNoEntry: false })
    : null
  if (commandId === 'rc-archive' && archiveEntry) {
    phase6Failure('C04_PHASE6_ARCHIVE_EXISTS')
    return
  }
  if (commandId === 'rc-verify-archive') {
    if (!archiveEntry) {
      phase6Failure('C04_PHASE6_ARCHIVE_MISSING')
      return
    }
    if (archiveEntry.isSymbolicLink() || !archiveEntry.isFile()) {
      phase6Failure('C04_PHASE6_ARCHIVE_TYPE')
      return
    }
  }
  if (jsonOutput) mkdirSync(dirname(outputPath), { recursive: true })
  const childEnvironment = phase6ProcessEnvironment()
  if (jsonOutput) {
    childEnvironment.C04_PHASE6_IDENTITY_V1 = JSON.stringify(identity)
  } else {
    delete childEnvironment.C04_PHASE6_IDENTITY_V1
  }
  const child = spawnSync(argv[0], argv.slice(1), {
    encoding: 'utf8',
    env: childEnvironment,
    cwd: prototypeRoot,
    maxBuffer: 128 * 1024 * 1024,
  })
  if (child.error) {
    phase6Failure('C04_PHASE6_CHILD')
    return
  }
  if (jsonOutput) {
    if (child.status !== 0) {
      if (child.stderr) process.stderr.write(child.stderr)
      process.exitCode = child.status ?? 1
      return
    }
    try {
      const outputBytes = readFileSync(outputPath)
      const document = JSON.parse(outputBytes.toString('utf8'))
      const sidecar = readFileSync(`${outputPath}.sha256`, 'utf8')
      const outputLabel = mode === 'integration' ? output : outputPath
      const expectedStatus =
        commandId === 'frozen-evidence-guard' && mode === 'source'
          ? 'PASS_SOURCE_SCOPE'
          : PHASE6_JSON_SUCCESS_STATUS[commandId]
      const expectedSidecar =
        `${createHash('sha256').update(outputBytes).digest('hex')}` +
        `  ${outputLabel}\n`
      if (
        JSON.stringify(document.phase6Identity) !==
          JSON.stringify(identity) ||
        document.status !== expectedStatus ||
        sidecar !== expectedSidecar
      ) {
        throw new Error('C04_PHASE6_IDENTITY')
      }
    } catch {
      phase6Failure('C04_PHASE6_IDENTITY')
    }
    return
  }

  const textRecord = {
    schemaVersion: 'c04-phase6-text-record-v1',
    phase6Identity: identity,
    childExitCode: child.status,
    stdoutBase64: Buffer.from(child.stdout).toString('base64'),
    stderrBase64: Buffer.from(child.stderr).toString('base64'),
  }
  const bytes =
    'C04_PHASE6_IDENTITY_V1\n' +
    `${JSON.stringify(textRecord)}\n`
  mkdirSync(dirname(outputPath), { recursive: true })
  try {
    writeFileSync(outputPath, bytes, { flag: 'wx' })
  } catch (error) {
    phase6Failure(
      error?.code === 'EEXIST'
        ? 'C04_PHASE6_OUTPUT_EXISTS'
        : 'C04_PHASE6_OUTPUT_PATH',
    )
    return
  }
  if (child.status !== 0) process.exitCode = child.status ?? 1
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url) &&
  process.argv.includes('--phase6-run')
) {
  runPhase6Command()
}
