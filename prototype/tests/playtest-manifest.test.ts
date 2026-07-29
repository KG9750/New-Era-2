// @ts-nocheck -- integration coverage invokes the production Node CLI.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  expectedPhase6Argv,
  SOURCE_CHANGE_ALLOWLIST,
  validateCandidateManifest,
} from '../scripts/candidate-manifest-contract.mjs'

const verifier = resolve('scripts', 'verify-playtest-manifest.mjs')
const canonicalManifest =
  'data/playtests/weekly-management-slice/gate1a/' +
  'g1a-20260727-rc9-01/candidate-manifests/CM01/' +
  'candidate-manifest.json'
const fullOutput =
  'data/playtests/weekly-management-slice/gate1a/' +
  'g1a-20260727-rc9-01/candidates/C04/evidence/' +
  'freeze-audit/full-manifest-verification.json'
const cohort =
  'data/playtests/weekly-management-slice/gate1a/' +
  'g1a-20260727-rc9-01'
const c04Root = `${cohort}/candidates/C04`
const evidenceBaseline = '5b9438cc5123ba35d8a703f3507bbf463e90176d'
const sourceBaseline = 'cd2fc9716d98c160fe530c593347992f18bf96e4'
const phase6PlanRef = '52eb452a5ffec167a3809d3f372e62b9d8524124'
const phase6Path =
  '/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin'
const excludedC04Ancestors = [
  ['A01 provisional I', 'source', '3cc6de4f6c8458f51936a893b95ea08e62bb0883'],
  ['A01 preservation', 'integration', 'bbda54826dc529ad3b93c55c4fd164463c842401'],
  ['A02 failed I', 'source', 'b027ad8019d8fa46eaf7596c40eb28f470cc8c06'],
  ['A02 preservation', 'integration', '6752c3b4f73a17fadcfc2420c9b9c6ededeeceb9'],
]
const artifactManifestSha256 =
  'c336706bf7193c07a7f552dfbfe77cf02ec36259c72cc08b8f0c6ee8fc84cc37'
const artifactHash =
  '9a7ddde0234d82798b2625c050710143f8f4b94bd6d14bd121910a76831abb65'
const buildId = 'g1-rc-20260729.rc9-c04'
const diagnosticIds = [
  'TECH-RC9-D16',
  'TECH-RC9-D17',
  'TECH-RC9-D18',
  'TECH-RC9-D19',
  'TECH-RC9-D20',
]
const antiPassIds = ['TECH-RC9-P07', 'TECH-RC9-P08']
const authorityPaths = [
  ['protocol', 'docs/product-specs/weekly-management-slice-playtest-v0.3.md'],
  [
    'c03-management-authority',
    'docs/design-docs/gate1-c03-management-choice-authority.md',
  ],
  ['c03-branch-matrix', 'docs/design-docs/gate1-rc9-branch-matrix.md'],
  [
    'c04-recovery-plan',
    'docs/exec-plans/active/2026-07-29-gate1a-rc9-c04-recovery-plan.md',
  ],
  [
    'operations',
    'docs/exec-plans/active/2026-07-27-gate1a-rc9-test-operations.md',
  ],
  ['player-packet', `${cohort}/player-packet-v0.2.md`],
  ['interview', `${cohort}/post-session-interview-v0.2.md`],
  ['fixture-oracle', 'prototype/tests/fixtures/fixture-expectations.json'],
  ['capture-host', 'prototype/scripts/playtest-host.mjs'],
]
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
  'manifest-fixtures',
  'manifest-probe',
  'runtime-equivalence',
  'rc-repro',
]
const frozenEvidence = [
  {
    path: 'data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01',
    treeId: 'c5714f7ca7adb5e8fe052d4d00f27c545b988347',
    fileCount: 67,
    inventorySha256:
      '3f55528ad8993aae8646a152489227eee76c280e0ae2c2d092b57dc2ec5398e2',
  },
  {
    path: `${cohort}/candidates/C01`,
    treeId: '55f661518c7ed8a2cc99f0fc0f25fabecd24c286',
    fileCount: 41,
    inventorySha256:
      'fa7a926f64dfff08e2c86b1baa8f87217aecce5e99232154f534110538c2f5c6',
  },
  {
    path: `${cohort}/candidates/C02`,
    treeId: '9b7dbae2c0c5d1bba45399e77dac65766911d3b3',
    fileCount: 62,
    inventorySha256:
      '250a9d82e0e2056af1622bd063e806d236178e72ee93b1a6f178708d056f4664',
  },
  {
    path: `${cohort}/candidates/C03`,
    treeId: '6c3e5bf9bf4808724534c7c1fb472fc487a4d350',
    fileCount: 65,
    inventorySha256:
      '1c107b09ebdc4eacf0ac2bae388402aee2f12ad1dadbf081e547da66ac40462d',
  },
]

function temporaryDirectory(prefix: string) {
  return mkdtempSync(join(tmpdir(), prefix))
}

function expectExactSidecar(outputPath: string, label = outputPath) {
  const outputBytes = readFileSync(outputPath)
  expect(readFileSync(`${outputPath}.sha256`)).toEqual(
    Buffer.from(`${sha256(outputBytes)}  ${label}\n`),
  )
}

function materializeManifestVerifierRepository(prefix: string) {
  const root = temporaryDirectory(prefix)
  const repo = join(root, 'repo')
  const prototype = join(repo, 'prototype')
  const script = join(
    prototype,
    'scripts',
    'verify-playtest-manifest.mjs',
  )
  mkdirSync(join(prototype, 'scripts'), { recursive: true })
  cpSync(verifier, script)
  cpSync(
    resolve('scripts', 'candidate-manifest-contract.mjs'),
    join(prototype, 'scripts', 'candidate-manifest-contract.mjs'),
  )
  cpSync(
    resolve('tests', 'fixtures'),
    join(prototype, 'tests', 'fixtures'),
    { recursive: true },
  )
  for (const [, path] of authorityPaths) {
    const target = join(repo, path)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(resolve('..', path), target)
  }
  return { prototype, repo, script }
}

function run(args: string[], cwd = process.cwd()) {
  return spawnSync(process.execPath, [verifier, ...args], {
    cwd,
    encoding: 'utf8',
  })
}

function parseLine(output: string) {
  return JSON.parse(output.trim().split('\n').at(-1))
}

function git(repo: string, ...args: string[]) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
  })
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}

function gitBytes(repo: string, ...args: string[]) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'buffer',
    maxBuffer: 128 * 1024 * 1024,
  })
  expect(result.status, result.stderr.toString()).toBe(0)
  return result.stdout
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex')
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function integrationPhase6Identity(
  fixture,
  commandId: string,
  outputPath: string,
) {
  const identity = {
    schemaVersion: 'c04-phase6-command-identity-v1',
    commandId,
    mode: 'integration',
    environment: { PATH: phase6Path },
    commandVNodePath: '/opt/homebrew/opt/node@24/bin/node',
    resolvedNodeRealPath:
      '/opt/homebrew/Cellar/node@24/24.18.0/bin/node',
    nodeVersion: 'v24.18.0',
    nodeBinarySha256:
      '72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f',
    workingDirectory: 'prototype',
    outputPath,
    planRef: phase6PlanRef,
    integrationSha: fixture.integrationSha,
    artifactSourceSha: fixture.sourceSha,
    argv: [],
  }
  identity.argv = expectedPhase6Argv(identity)
  return identity
}

function writeRepoFile(repo: string, path: string, bytes: Buffer | string) {
  const target = join(repo, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, bytes)
}

function writeJson(repo: string, path: string, value) {
  const bytes = jsonBytes(value)
  writeRepoFile(repo, path, bytes)
  return { bytes, sha256: sha256(bytes) }
}

function writeSidecar(repo: string, path: string, hash: string) {
  const bytes = Buffer.from(`${hash}  ${path}\n`)
  writeRepoFile(repo, `${path}.sha256`, bytes)
  return { bytes, sha256: sha256(bytes) }
}

function cloneRepository(source: string, prefix: string) {
  const parent = temporaryDirectory(prefix)
  const repo = join(parent, 'repo')
  const result = spawnSync(
    'git',
    ['clone', '--quiet', '--shared', '--no-checkout', source, repo],
    { encoding: 'utf8' },
  )
  expect(result.status, result.stderr).toBe(0)
  git(repo, 'config', 'user.name', 'Manifest Test')
  git(repo, 'config', 'user.email', 'manifest@example.invalid')
  return repo
}

function diagnosticFixture(
  repo: string,
  sampleId: string,
  sourceSha: string,
  integrationSha: string,
  candidateBuildHash: string,
  archiveHash: string,
) {
  const diagnosticRoot = `${c04Root}/diagnostics`
  const sampleRoot = `${diagnosticRoot}/${sampleId}`
  const verificationPath =
    `${c04Root}/evidence/diagnostic-isolation/` +
    `${sampleId}-verification.json`
  const canonicalInputPath =
    `${sampleRoot}/diagnostic-isolation-input.json`
  const rolloutPath = `${sampleRoot}/rollout-structure.json`
  const cliPath = `${sampleRoot}/cli-structure.json`
  const rollout = writeJson(repo, rolloutPath, { sampleId, stream: 'rollout' })
  const cli = writeJson(repo, cliPath, { sampleId, stream: 'cli' })
  const preflight = {
    diagnosticIsolationProfile: 'standalone-codex-cli-v2',
    cliBinaryPath: '/Applications/ChatGPT.app/Contents/Resources/codex',
    agentCliVersion: 'codex-cli 0.146.0-alpha.3.1',
    cliBinarySha256:
      '6d8be49e49751554df16572369e636cbe02c84b208cad3dc35528c846eeca223',
    cliTeamIdentifier: '2DC432GLL2',
    cliAuthority:
      'Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)',
    nodeExecutable: '/opt/homebrew/opt/node@24/bin/node',
    nodeVersion: 'v24.18.0',
    nodeBinarySha256:
      '72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f',
  }
  const agentSessionId = `session-${sampleId}`
  const canonicalInput = writeJson(repo, canonicalInputPath, {
    sampleId,
    preflight,
    identityAndIsolation: { agentSessionId },
  })
  writeSidecar(repo, canonicalInputPath, canonicalInput.sha256)
  const identity = {
    diagnosticIsolationProfile: 'standalone-codex-cli-v2',
    agentSessionId,
    privateRolloutObjectId: `rollout-${sampleId}`,
    privateCliEventObjectId: `cli-${sampleId}`,
    agentRolloutSha256: '1'.repeat(64),
    agentRolloutStructuralEvidencePath: rolloutPath,
    agentRolloutStructuralEvidenceHash: rollout.sha256,
    cliEventStructuralEvidencePath: cliPath,
    cliEventStructuralEvidenceHash: cli.sha256,
    browserContextId: `context-${sampleId}`,
    browserPageId: `page-${sampleId}`,
    isolationPreflightHash: sha256(canonicalJson(preflight)),
    agentCliBinaryPath: preflight.cliBinaryPath,
    agentCliVersion: preflight.agentCliVersion,
    agentCliBinarySha256: preflight.cliBinarySha256,
    agentCliTeamIdentifier: preflight.cliTeamIdentifier,
    agentCliAuthority: preflight.cliAuthority,
    canonicalInputPath,
    canonicalInputHash: canonicalInput.sha256,
  }
  const verification = writeJson(repo, verificationPath, {
    schemaVersion: 'new-era-diagnostic-isolation-result-v2',
    accepted: true,
    status: 'PASS_DIAGNOSTIC_ISOLATION',
    summary: {
      sampleId,
      canonicalInputPath,
      canonicalInputHash: canonicalInput.sha256,
      ...identity,
    },
  })
  writeSidecar(repo, verificationPath, verification.sha256)
  identity.isolationVerificationHash = verification.sha256
  const sampleRecord = writeJson(repo, `${sampleRoot}/sample-record.json`, {
    sampleId,
    candidateAttempt: 'C04',
    validityDecision: {
      status: 'VALID_DIAGNOSTIC',
      includedInGate1ADenominator: false,
    },
    releaseCandidate: {
      buildId,
      gitSha: sourceSha,
      dependencyIntegrationSha: integrationSha,
      candidateBuildManifestHash: candidateBuildHash,
      artifactHash,
      archiveHash,
      scenarioId: 'gate1-two-week-management',
      scenarioVersion: '0.5.1',
      protocolVersion: 'weekly-management-slice-playtest-v0.3',
    },
    identityAndIsolation: identity,
  })
  const validity = Buffer.from(`# ${sampleId}\n\nVALID_DIAGNOSTIC\n`)
  writeRepoFile(repo, `${sampleRoot}/validity-decision.md`, validity)
  return {
    sampleId,
    sampleRecordHash: sampleRecord.sha256,
    validityHash: sha256(validity),
  }
}

function antiPassFixture(
  repo: string,
  sampleId: string,
  sourceSha: string,
) {
  const evidenceRoot = `${c04Root}/anti-pass/${sampleId}`
  const committed = sampleId === 'TECH-RC9-P07'
  const sessionId = `session-${sampleId}`
  const commitments = committed
    ? [0, 1].map((week) => ({
        actionId: `${sampleId}-action-${week}`,
        week,
        commitCause: 'explicit-candidate-action',
        diagnosisId: sampleId,
        sessionId,
        candidateBuildAuthorityHash: artifactHash,
        idempotencyKey: `${sampleId}-key-${week}`,
      }))
    : []
  const raw = writeJson(repo, `${evidenceRoot}/capture.json`, {
    schemaVersion: 'gate1-playtest-v2',
    meta: {
      sampleId,
      diagnosisId: sampleId,
      buildId,
      gitSha: sourceSha,
      artifactHash,
      scenarioId: 'gate1-two-week-management',
      scenarioVersion: '0.5.1',
      protocolVersion: 'weekly-management-slice-playtest-v0.3',
      sessionId,
    },
    finalTick: 2010,
    actions: commitments.map((entry) => ({
      id: entry.actionId,
      type: 'COMMIT_MANAGEMENT_CHOICE',
    })),
    managementChoiceCommitmentsV03: commitments,
    managementChoiceOpportunitiesV03: [0, 1].map((week) => ({
      week,
      terminalState: committed ? 'committed' : 'omitted',
      committedAtSequence: committed ? week + 1 : null,
    })),
  })
  writeRepoFile(repo, `${evidenceRoot}/browser-download.json`, raw.bytes)
  const rawSidecar = Buffer.from(
    `${raw.sha256}  ${evidenceRoot}/capture.json\n`,
  )
  writeRepoFile(repo, `${evidenceRoot}/capture.json.sha256`, rawSidecar)
  const receipt = writeJson(repo, `${evidenceRoot}/receipt.json`, {
    sha256: raw.sha256,
    bytes: raw.bytes.length,
    sampleId,
    buildId,
    gitSha: sourceSha,
    artifactHash,
  })
  const terminalCount = committed ? 2 : 0
  const result = writeJson(repo, `${evidenceRoot}/result.json`, {
    sampleId,
    schemaVersion: 'gate1-rc9-anti-pass-result-v1',
    status: 'PASS',
    candidateAttempt: 'C04',
    buildId,
    sourceSha,
    artifactHash,
    pathKind: committed
      ? 'prominent-cta-and-repeat-submit'
      : 'minimal-intervention-and-invalid-consequence',
    sessionAuthority: {
      diagnosisId: sampleId,
      candidateBuildAuthorityHash: artifactHash,
      applicationSessionCount: 1,
    },
    machineEvidence: {
      serverRawPath: 'capture.json',
      sha256SidecarPath: 'capture.json.sha256',
      receiptPath: 'receipt.json',
      browserDownloadPath: 'browser-download.json',
      serverRawSha256: raw.sha256,
      serverRawBytes: raw.bytes.length,
      sha256SidecarSha256: sha256(rawSidecar),
      receiptSha256: receipt.sha256,
      browserDownloadSha256: raw.sha256,
      browserDownloadBytes: raw.bytes.length,
      allClaimsMatchServerRaw: true,
    },
    assertions: {
      ...(committed
        ? {
            w1ExplicitCommitmentCount: 1,
            w2ExplicitCommitmentCount: 1,
            summaryCtaCommitmentDelta: 0,
            openCloseLocateExpandCommitmentDelta: 0,
            containerEnterSpaceCommitmentDelta: 0,
            continueCommitmentDelta: 0,
            w1RepeatCommitmentDelta: 0,
            w2RepeatCommitmentDelta: 0,
            reloadCommitmentDelta: 0,
            identicalExportRetryCommitmentDelta: 0,
          }
        : {
            w1C03TerminalCommitmentCount: 0,
            w2C03TerminalCommitmentCount: 0,
          }),
      canonicalTerminalCommitmentCount: terminalCount,
      finalTick: 2010,
      twoWeeksCompleted: true,
      recapCount: 2,
    },
    runtimeAntiPass: committed
      ? { directScheduleEdits: { w1Count: 0, w2CountAtDeadline: 0 } }
      : undefined,
    validationCommands: [
      {
        id: 'ledger-validator',
        status: 'PASS',
        terminalCommitmentCount: terminalCount,
      },
    ],
    hostStopped: true,
    sessionCleared: true,
  })
  return {
    sampleId,
    status: 'PASS',
    evidencePath: `${evidenceRoot}/result.json`,
    evidenceHash: result.sha256,
  }
}

function createFullManifestRepository({
  phase6Identities = true,
  mismatchedPhase6Command = null,
  mismatchedPhase6ArgvCommand = null,
  frozenPhase6Identity = true,
  textChildExitCommand = null,
  textRecordMissingChildExitCommand = null,
  textRecordSchemaMismatchCommand = null,
  archivePathMismatch = false,
  phase6ArchivePathFactory = null,
  archiveEpochMismatch = false,
  mismatchedFrozenPhase6Argv = false,
  sourceTopologyMutation = null,
  integrationTopologyMutation = null,
  excludedAncestorTarget = null,
  excludedAncestorSha = null,
} = {}) {
  const sourceRepo = resolve('..')
  const repo = cloneRepository(
    sourceRepo,
    'new-era-full-manifest-authority-',
  )
  git(
    repo,
    'checkout',
    '--quiet',
    sourceTopologyMutation === 'plan-ref-not-ancestor'
      ? sourceBaseline
      : phase6PlanRef,
  )
  git(repo, 'switch', '--quiet', '-c', 'full-manifest-source')
  for (const path of SOURCE_CHANGE_ALLOWLIST) {
    const target = join(repo, path)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(join(sourceRepo, path), target)
  }
  git(repo, 'add', '--', ...SOURCE_CHANGE_ALLOWLIST)
  git(repo, 'commit', '--quiet', '-m', 'fixture source implementation')
  const deletedAllowlistPath =
    sourceTopologyMutation === 'allowlist-deletion'
      ? SOURCE_CHANGE_ALLOWLIST.at(-1)
      : null
  if (deletedAllowlistPath) {
    unlinkSync(join(repo, deletedAllowlistPath))
    git(repo, 'add', '--update', '--', deletedAllowlistPath)
    git(repo, 'commit', '--quiet', '-m', 'fixture source deletion')
  }
  if (sourceTopologyMutation === 'non-allowlist-path') {
    const unexpectedPath = 'c04-topology-outside-allowlist.txt'
    writeRepoFile(repo, unexpectedPath, 'unexpected committed path\n')
    git(repo, 'add', '--', unexpectedPath)
    git(repo, 'commit', '--quiet', '-m', 'fixture non-allowlist source')
  }
  if (excludedAncestorTarget === 'source') {
    git(
      repo,
      'merge',
      '--quiet',
      '--no-ff',
      '--allow-unrelated-histories',
      '-s',
      'ours',
      excludedAncestorSha,
      '-m',
      'fixture excluded source ancestor',
    )
  }
  const sourceSha = git(repo, 'rev-parse', 'HEAD')

  git(repo, 'checkout', '--quiet', evidenceBaseline)
  git(repo, 'switch', '--quiet', '-c', 'full-manifest-fixture')
  git(
    repo,
    'checkout',
    sourceSha,
    '--',
    ...SOURCE_CHANGE_ALLOWLIST.filter(
      (path) => path !== deletedAllowlistPath,
    ),
  )
  if (deletedAllowlistPath) {
    git(repo, 'rm', '--quiet', '--ignore-unmatch', '--', deletedAllowlistPath)
  }
  git(
    repo,
    'add',
    '--',
    ...SOURCE_CHANGE_ALLOWLIST.filter(
      (path) => path !== deletedAllowlistPath,
    ),
  )
  git(repo, 'commit', '--quiet', '-m', 'fixture integration authority')
  if (integrationTopologyMutation === 'blob-mismatch') {
    const mismatchedPath =
      'prototype/scripts/check-playtest-fixtures.mjs'
    writeRepoFile(
      repo,
      mismatchedPath,
      Buffer.concat([
        readFileSync(join(repo, mismatchedPath)),
        Buffer.from('\n// integration blob mismatch\n'),
      ]),
    )
    git(repo, 'add', '--', mismatchedPath)
    git(repo, 'commit', '--quiet', '-m', 'fixture integration mismatch')
  }
  if (excludedAncestorTarget === 'integration') {
    git(
      repo,
      'merge',
      '--quiet',
      '--no-ff',
      '--allow-unrelated-histories',
      '-s',
      'ours',
      excludedAncestorSha,
      '-m',
      'fixture excluded integration ancestor',
    )
  }
  const integrationSha = git(repo, 'rev-parse', 'HEAD')
  const authorityHashes = authorityPaths.map(([role, path]) => ({
    role,
    path,
    sha256: sha256(readFileSync(join(repo, path))),
  }))

  const c03ArtifactRoot = `${cohort}/candidates/C03/rc-dist`
  const c04ArtifactRoot = `${c04Root}/rc-dist`
  const artifactManifestBytes = gitBytes(
    repo,
    'show',
    `${evidenceBaseline}:${c03ArtifactRoot}/artifact-manifest.json`,
  )
  expect(sha256(artifactManifestBytes)).toBe(artifactManifestSha256)
  const artifactManifest = JSON.parse(artifactManifestBytes.toString('utf8'))
  writeRepoFile(
    repo,
    `${c04ArtifactRoot}/artifact-manifest.json`,
    artifactManifestBytes,
  )
  for (const entry of artifactManifest.files) {
    writeRepoFile(
      repo,
      `${c04ArtifactRoot}/${entry.path}`,
      gitBytes(
        repo,
        'show',
        `${evidenceBaseline}:${c03ArtifactRoot}/${entry.path}`,
      ),
    )
  }
  const rcBuild = writeJson(repo, `${c04ArtifactRoot}/rc-build.json`, {
    buildId,
    gitSha: sourceSha,
    artifactHash,
  })
  const archivePath = `${c04Root}/rc-dist.tar`
  const archiveResult = spawnSync(
    process.execPath,
    [
      resolve('scripts', 'create-deterministic-archive.mjs'),
      '--input',
      join(repo, c04ArtifactRoot),
      '--output',
      join(repo, archivePath),
      '--source-date-epoch',
      '946684800',
    ],
    { encoding: 'utf8' },
  )
  expect(archiveResult.status, archiveResult.stderr).toBe(0)
  const archiveBytes = readFileSync(join(repo, archivePath))
  const archiveHash = sha256(archiveBytes)
  const candidateBuildPath = `${c04Root}/candidate-build-manifest.json`
  const candidateBuild = writeJson(repo, candidateBuildPath, {
    candidateAttempt: 'C04',
    sourceSha,
    dependencyIntegrationSha: integrationSha,
    buildId,
    scenarioId: 'gate1-two-week-management',
    scenarioVersion: '0.5.1',
    protocolVersion: 'weekly-management-slice-playtest-v0.3',
    playtestSchemaVersion: 'gate1-playtest-v2',
    sourceDateEpoch: 946684800,
    artifact: {
      artifactHash,
      artifactManifestPath: `${c04ArtifactRoot}/artifact-manifest.json`,
      artifactManifestHash: artifactManifestSha256,
      rcBuildMetadataPath: `${c04ArtifactRoot}/rc-build.json`,
      rcBuildMetadataHash: rcBuild.sha256,
    },
    archive: {
      path: archivePath,
      format: 'ustar',
      sha256: archiveHash,
      bytes: archiveBytes.length,
      entryCount: 8,
    },
    authorityHashes,
  })

  const diagnosticRows = diagnosticIds.map((sampleId) =>
    diagnosticFixture(
      repo,
      sampleId,
      sourceSha,
      integrationSha,
      candidateBuild.sha256,
      archiveHash,
    ),
  )
  const diagnosticManifest = writeJson(
    repo,
    `${c04Root}/diagnostics/manifest.json`,
    {
      candidateAttempt: 'C04',
      sourceSha,
      dependencyIntegrationSha: integrationSha,
      buildId,
      scenarioId: 'gate1-two-week-management',
      scenarioVersion: '0.5.1',
      protocolVersion: 'weekly-management-slice-playtest-v0.3',
      playtestSchemaVersion: 'gate1-playtest-v2',
      status: 'PASS',
      candidateBuildManifestHash: candidateBuild.sha256,
      artifactHash,
      archiveHash,
      allocatedSampleIds: diagnosticIds,
      samples: diagnosticIds.map((sampleId) => ({
        sampleId,
        status: 'VALID_DIAGNOSTIC',
        includedInDiagnosticMedian: true,
        includedInGate1ADenominator: false,
      })),
      evidenceInventory: diagnosticRows.flatMap((row) => [
        {
          path: `${row.sampleId}/sample-record.json`,
          sha256: row.sampleRecordHash,
        },
        {
          path: `${row.sampleId}/validity-decision.md`,
          sha256: row.validityHash,
        },
      ]),
    },
  )
  const antiPass = antiPassIds.map((sampleId) =>
    antiPassFixture(repo, sampleId, sourceSha),
  )
  const phase6ArchivePath = phase6ArchivePathFactory
    ? phase6ArchivePathFactory(repo)
    : join(
        realpathSync(dirname(repo)),
        'phase6-archive-output.tar',
      )

  const commandResults = requiredCommandIds.map((id) => {
    const outputPath =
      `${c04Root}/evidence/phase6-retry-02/` +
      ({
        'schema-fixtures': 'schema-fixtures.txt',
        'guard-rc8': 'guard-rc8.txt',
        'manifest-fixtures': 'manifest-fixtures.json',
        'manifest-probe': 'manifest-probe.json',
        'runtime-equivalence': 'runtime-equivalence.json',
        'rc-verify': 'rc-verify.txt',
        'rc-verify-archive': 'rc-verify-archive.txt',
        'rc-repro': 'rc-repro.txt',
      }[id] ?? `${id}.txt`)
    let value
    const phase6Identity = {
      schemaVersion: 'c04-phase6-command-identity-v1',
      commandId: id,
      mode: 'integration',
      environment: {
        PATH:
          '/opt/homebrew/opt/node@24/bin:' +
          '/opt/homebrew/bin:/usr/bin:/bin',
      },
      commandVNodePath: '/opt/homebrew/opt/node@24/bin/node',
      resolvedNodeRealPath:
        '/opt/homebrew/Cellar/node@24/24.18.0/bin/node',
      nodeVersion: 'v24.18.0',
      nodeBinarySha256:
        '72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f',
      workingDirectory: 'prototype',
      outputPath,
      planRef: '52eb452a5ffec167a3809d3f372e62b9d8524124',
      integrationSha,
      artifactSourceSha: sourceSha,
    }
    if (['rc-archive', 'rc-verify-archive'].includes(id)) {
      phase6Identity.archivePath =
        archivePathMismatch && id === 'rc-verify-archive'
          ? `${phase6ArchivePath}.mismatch`
          : phase6ArchivePath
    }
    phase6Identity.argv = expectedPhase6Argv(phase6Identity)
    if (id === mismatchedPhase6ArgvCommand) {
      phase6Identity.argv = [
        ...phase6Identity.argv,
        '--unexpected-tail',
      ]
    }
    if (id === mismatchedPhase6Command) {
      phase6Identity.integrationSha = '9'.repeat(40)
    }
    if (id === 'manifest-fixtures') {
      value = {
        schemaVersion: 'candidate-manifest-verification-v1',
        status: 'PASS_FIXTURES',
        fullManifestVerified: false,
      }
    } else if (id === 'manifest-probe') {
      value = {
        schemaVersion: 'candidate-manifest-verification-v1',
        status: 'PASS_AUTHORITY_PREFLIGHT',
        fullManifestVerified: false,
        authorityProfile: 'rc9-v03',
        scenarioVersion: '0.5.1',
        protocolVersion: 'weekly-management-slice-playtest-v0.3',
      }
    } else if (id === 'runtime-equivalence') {
      value = {
        schemaVersion: 'gate1a-c04-runtime-equivalence-v1',
        status: 'PASS_RUNTIME_EQUIVALENCE',
        errorCode: null,
        verificationInputSha: integrationSha,
        headSha: integrationSha,
        artifactGitSha: sourceSha,
        sourceBaselineSha: sourceBaseline,
        changedForbiddenPaths: [],
        canonicalFileCount: 5,
        artifactManifestBytesEqual: true,
        artifactInventoryEqual: true,
        metadataIdentityOnly: true,
        expectedArtifactHash: artifactHash,
        actualArtifactHash: artifactHash,
        expectedArtifactManifestSha256: artifactManifestSha256,
        actualArtifactManifestSha256: artifactManifestSha256,
        canonicalFiles: artifactManifest.files.map((entry) => ({
          path: entry.path,
          expectedBytes: entry.size,
          actualBytes: entry.size,
          expectedSha256: entry.sha256,
          actualSha256: entry.sha256,
          bytesEqual: true,
        })),
        source: {
          baselineSha: sourceBaseline,
          headSha: integrationSha,
          changedForbiddenPaths: [],
        },
        artifact: {
          artifactDir: c04ArtifactRoot,
          actualArtifactHash: artifactHash,
          metadataIdentity: {
            expectedGitSha: sourceSha,
            actualGitSha: sourceSha,
          },
        },
      }
    } else if (id === 'rc-archive') {
      value = {
        archive: phase6Identity.archivePath,
        archiveFormat: 'ustar',
        archiveHash,
        bytes: archiveBytes.length,
        entryCount: 8,
        sourceDateEpoch: 946684800,
      }
    } else if (id === 'rc-verify') {
      value = {
        verified: true,
        buildId,
        gitSha: sourceSha,
        artifactHash,
      }
    } else if (id === 'rc-verify-archive') {
      value = {
        verified: true,
        archive: phase6Identity.archivePath,
        archiveFormat: 'ustar',
        archiveHash,
        bytes: archiveBytes.length,
        entryCount: 8,
        sourceDateEpoch: archiveEpochMismatch
          ? 946684801
          : 946684800,
      }
    } else if (id === 'rc-repro') {
      value = {
        reproducible: true,
        buildId,
        gitSha: sourceSha,
        archiveHash,
      }
    }
    const jsonCommand = [
      'manifest-fixtures',
      'manifest-probe',
      'runtime-equivalence',
    ].includes(id)
    let binding
    if (jsonCommand) {
      binding = writeJson(
        repo,
        outputPath,
        phase6Identities
          ? { ...value, phase6Identity }
          : value,
      )
      writeSidecar(repo, outputPath, binding.sha256)
    } else {
      const childStdout =
        value === undefined
          ? `PASS ${id}\n`
          : `${JSON.stringify(value)}\n`
      const textRecord = {
        schemaVersion: 'c04-phase6-text-record-v1',
        phase6Identity,
        childExitCode: id === textChildExitCommand ? 17 : 0,
        stdoutBase64: Buffer.from(childStdout).toString('base64'),
        stderrBase64: '',
      }
      if (id === textRecordMissingChildExitCommand) {
        delete textRecord.childExitCode
      }
      if (id === textRecordSchemaMismatchCommand) {
        textRecord.schemaVersion = 'c04-phase6-text-record-v0'
      }
      const bytes = Buffer.from(
        phase6Identities
          ? 'C04_PHASE6_IDENTITY_V1\n' +
              `${JSON.stringify(textRecord)}\n`
          : childStdout,
      )
      writeRepoFile(repo, outputPath, bytes)
      binding = { bytes, sha256: sha256(bytes) }
    }
    return { id, status: 'PASS', outputPath, outputHash: binding.sha256 }
  })

  const guardPath =
    `${c04Root}/evidence/phase6-retry-02/frozen-evidence-guard.json`
  const guardDocument = {
    schemaVersion: 'gate1a-frozen-evidence-guard-v1',
    mode: 'evidence-lineage',
    status: 'PASS_EVIDENCE_LINEAGE',
    baselineSha: evidenceBaseline,
    headSha: integrationSha,
    observations: frozenEvidence.map((entry) => ({
      path: entry.path,
      actual: {
        treeId: entry.treeId,
        fileCount: entry.fileCount,
        inventorySha256: entry.inventorySha256,
      },
      matches: {
        treeId: true,
        fileCount: true,
        inventorySha256: true,
      },
    })),
    ...(frozenPhase6Identity
      ? {
          phase6Identity: {
            schemaVersion: 'c04-phase6-command-identity-v1',
            commandId: 'frozen-evidence-guard',
            mode: 'integration',
            environment: {
              PATH:
                '/opt/homebrew/opt/node@24/bin:' +
                '/opt/homebrew/bin:/usr/bin:/bin',
            },
            commandVNodePath: '/opt/homebrew/opt/node@24/bin/node',
            resolvedNodeRealPath:
              '/opt/homebrew/Cellar/node@24/24.18.0/bin/node',
            nodeVersion: 'v24.18.0',
            nodeBinarySha256:
              '72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f',
            workingDirectory: 'prototype',
            outputPath: guardPath,
            planRef: '52eb452a5ffec167a3809d3f372e62b9d8524124',
            integrationSha,
            artifactSourceSha: sourceSha,
          },
        }
      : {}),
  }
  if (guardDocument.phase6Identity) {
    guardDocument.phase6Identity.argv = expectedPhase6Argv(
      guardDocument.phase6Identity,
    )
    if (mismatchedFrozenPhase6Argv) {
      guardDocument.phase6Identity.argv.push('--unexpected-tail')
    }
  }
  const guard = writeJson(repo, guardPath, guardDocument)
  writeSidecar(repo, guardPath, guard.sha256)
  git(repo, 'add', c04Root)
  git(repo, 'commit', '--quiet', '-m', 'fixture evidence snapshot')
  const evidenceSha = git(repo, 'rev-parse', 'HEAD')

  const manifest = {
    candidateManifestId: 'CM01',
    candidateAttempt: 'C04',
    status: 'PENDING_INDEPENDENT_REVIEW',
    sourceSha,
    dependencyIntegrationSha: integrationSha,
    candidateEvidenceSnapshotSha: evidenceSha,
    candidateAttemptManifestHash: candidateBuild.sha256,
    candidateAttemptManifestPath: candidateBuildPath,
    buildId,
    scenarioId: 'gate1-two-week-management',
    scenarioVersion: '0.5.1',
    schemaVersion: 'gate1-playtest-v2',
    artifactHash,
    archiveHash,
    authorityHashes,
    diagnosticManifest: {
      status: 'PASS',
      path: `${c04Root}/diagnostics/manifest.json`,
      sha256: diagnosticManifest.sha256,
      sampleIds: diagnosticIds,
    },
    antiPass,
    rc8Guard: {
      baselineSha: 'c0f4269bc3fef56962199629bad8db041aafc5f0',
      treeId: 'c5714f7ca7adb5e8fe052d4d00f27c545b988347',
      inventorySha256: '3'.repeat(64),
      status: 'PASS',
    },
    commandResults,
    priorManifests: [],
    rejectedAttempts: [
      {
        candidateAttempt: 'C01',
        rejectionPath: `${cohort}/candidates/C01/rejection-record.json`,
        rejectionHash:
          '2408890b5fe84b42663a4960ce1f8595a4603a200c5aa864391eedfa32e91cd0',
      },
      {
        candidateAttempt: 'C02',
        rejectionPath: `${cohort}/candidates/C02/rejection-record.json`,
        rejectionHash:
          '9265bde06a4f59dd85e122f4372229c5259b0c1dea26bd269c24d8acbf188397',
      },
      {
        candidateAttempt: 'C03',
        rejectionPath: `${cohort}/candidates/C03/rejection-record.json`,
        rejectionHash:
          '5550936b5298269e16b53c40df7a597d6c839a6dda155298e6f0a99fd7f0df6f',
      },
    ],
    authorityProfile: 'rc9-v03',
    protocolVersion: 'weekly-management-slice-playtest-v0.3',
    frozenEvidenceGuard: {
      path: guardPath,
      sha256: guard.sha256,
      baselineSha: evidenceBaseline,
      status: 'PASS_EVIDENCE_LINEAGE',
    },
  }
  const manifestBinding = writeJson(repo, canonicalManifest, manifest)
  writeSidecar(repo, canonicalManifest, manifestBinding.sha256)
  git(repo, 'add', canonicalManifest, `${canonicalManifest}.sha256`)
  git(repo, 'commit', '--quiet', '-m', 'fixture candidate manifest')
  const manifestSha = git(repo, 'rev-parse', 'HEAD')
  return {
    repo,
    sourceSha,
    integrationSha,
    evidenceSha,
    manifestSha,
    manifestHash: manifestBinding.sha256,
    manifestBytes: manifestBinding.bytes,
  }
}

function cloneFullManifestRepository(fixture) {
  const repo = cloneRepository(fixture.repo, 'new-era-full-manifest-case-')
  git(repo, 'checkout', '--quiet', fixture.manifestSha)
  mkdirSync(dirname(join(repo, fullOutput)), { recursive: true })
  return repo
}

function fullArgs(repo: string, manifestGitSha: string) {
  return [
    '--manifest',
    canonicalManifest,
    '--manifest-git-sha',
    manifestGitSha,
    '--repo-root',
    repo,
    '--output',
    fullOutput,
  ]
}

function expectFullFailurePreservesOutputs(
  repo: string,
  args: string[],
  errorCode: string,
) {
  const output = join(repo, fullOutput)
  const sidecar = `${output}.sha256`
  const fresh = run(args)
  expect(fresh.status).toBe(1)
  expect(parseLine(fresh.stderr).errorCode).toBe(errorCode)
  expect(existsSync(output)).toBe(false)
  expect(existsSync(sidecar)).toBe(false)

  const outputSentinel = Buffer.from('full-output-sentinel\n')
  const sidecarSentinel = Buffer.from('full-sidecar-sentinel\n')
  writeFileSync(output, outputSentinel)
  writeFileSync(sidecar, sidecarSentinel)
  const repeated = run(args)
  expect(repeated.status).toBe(1)
  expect(readFileSync(output)).toEqual(outputSentinel)
  expect(readFileSync(sidecar)).toEqual(sidecarSentinel)
}

describe('candidate playtest manifest shared contract', () => {
  it('accepts only retry-02 command evidence for C04', () => {
    const fixtureDocument = JSON.parse(
      readFileSync(
        resolve(
          'tests',
          'fixtures',
          'manifests',
          'candidate-c04-synthetic-valid.json',
        ),
        'utf8',
      ),
    )
    const fixture = fixtureDocument.input

    expect(validateCandidateManifest(fixture).accepted).toBe(true)
    const archived = JSON.parse(
      JSON.stringify(fixture).replaceAll(
        'phase6-retry-02',
        'phase6-retry-01',
      ),
    )
    expect(validateCandidateManifest(archived)).toEqual({
      accepted: false,
      errorCode: 'CANDIDATE_MANIFEST_EVIDENCE',
    })
  })
})

describe('candidate playtest manifest production CLI', () => {
  let fullFixture

  beforeAll(() => {
    fullFixture = createFullManifestRepository()
  })

  it('runs fixtures mode and atomically publishes JSON plus sidecar', () => {
    const root = temporaryDirectory('new-era-manifest-fixtures-')
    const output = join(root, 'fixtures.json')
    const result = run(['--fixtures', '--output', output])

    expect(result.status, result.stderr).toBe(0)
    expect(parseLine(result.stdout)).toMatchObject({
      status: 'PASS_FIXTURES',
      accepted: true,
      fullManifestVerified: false,
    })
    const jsonBytes = readFileSync(output)
    expectExactSidecar(output)
    expect(jsonBytes.length).toBeGreaterThan(0)

    const repeated = run(['--fixtures', '--output', output])
    expect(repeated.status).toBe(1)
    expect(parseLine(repeated.stderr).errorCode).toBe(
      'CANDIDATE_MANIFEST_OUTPUT_EXISTS',
    )
  })

  it('resolves a repo-relative fixtures output from repoRoot, not cwd', () => {
    const repo = cloneRepository(
      fullFixture.repo,
      'new-era-manifest-relative-output-',
    )
    git(repo, 'checkout', '--quiet', fullFixture.integrationSha)
    const prototype = join(repo, 'prototype')
    const script = join(
      prototype,
      'scripts',
      'verify-playtest-manifest.mjs',
    )
    const output =
      `${c04Root}/evidence/phase6-retry-02/manifest-fixtures.json`
    mkdirSync(join(prototype, 'scripts'), { recursive: true })
    mkdirSync(dirname(join(repo, output)), { recursive: true })
    cpSync(verifier, script)
    cpSync(
      resolve('scripts', 'candidate-manifest-contract.mjs'),
      join(prototype, 'scripts', 'candidate-manifest-contract.mjs'),
    )
    cpSync(
      resolve('tests', 'fixtures'),
      join(prototype, 'tests', 'fixtures'),
      { recursive: true },
    )
    const fixturesIdentity = integrationPhase6Identity(
      fullFixture,
      'manifest-fixtures',
      output,
    )

    const result = spawnSync(
      process.execPath,
      [script, '--fixtures', '--output', output],
      {
        cwd: prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          C04_PHASE6_IDENTITY_V1:
            JSON.stringify(fixturesIdentity),
        },
      },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(join(repo, output))).toBe(true)
    expect(existsSync(join(prototype, output))).toBe(false)
    expectExactSidecar(join(repo, output), output)

    const probeOutput =
      `${c04Root}/evidence/phase6-retry-02/manifest-probe.json`
    const probeIdentity = integrationPhase6Identity(
      fullFixture,
      'manifest-probe',
      probeOutput,
    )
    const probe = spawnSync(
      process.execPath,
      [
        script,
        '--probe',
        'tests/fixtures/manifests/candidate-c04-authority-probe.json',
        '--repo-root',
        '..',
        '--output',
        probeOutput,
      ],
      {
        cwd: prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          C04_PHASE6_IDENTITY_V1:
            JSON.stringify(probeIdentity),
        },
      },
    )

    expect(probe.status, probe.stderr).toBe(0)
    expect(existsSync(join(repo, probeOutput))).toBe(true)
    expect(existsSync(join(prototype, probeOutput))).toBe(false)
    expectExactSidecar(join(repo, probeOutput), probeOutput)
  })

  it.each([
    [
      'fixtures',
      [
        '--fixtures',
        '--output',
        `${c04Root}/evidence/phase6-retry-02/manifest-probe.json`,
      ],
    ],
    [
      'probe',
      [
        '--probe',
        'tests/fixtures/manifests/candidate-c04-authority-probe.json',
        '--repo-root',
        '..',
        '--output',
        `${c04Root}/evidence/phase6-retry-02/manifest-fixtures.json`,
      ],
    ],
  ])(
    'rejects %s mode bound to the other Phase 6 manifest filename',
    (_mode, args) => {
      const fixture = materializeManifestVerifierRepository(
        'new-era-manifest-mode-output-',
      )
      const output = join(fixture.repo, args.at(-1))
      mkdirSync(dirname(output), { recursive: true })

      const result = spawnSync(
        process.execPath,
        [fixture.script, ...args],
        { cwd: fixture.prototype, encoding: 'utf8' },
      )

      expect(result.status).toBe(1)
      expect(parseLine(result.stderr).errorCode).toBe(
        'CANDIDATE_MANIFEST_OUTPUT_PATH',
      )
      expect(existsSync(output)).toBe(false)
      expect(existsSync(`${output}.sha256`)).toBe(false)
    },
  )

  it.each([
    [
      'fixtures',
      [
        '--fixtures',
        '--output',
        `${c04Root}/evidence/phase6-retry-01/manifest-fixtures.json`,
      ],
    ],
    [
      'probe',
      [
        '--probe',
        'tests/fixtures/manifests/candidate-c04-authority-probe.json',
        '--repo-root',
        '..',
        '--output',
        `${c04Root}/evidence/phase6-retry-01/manifest-probe.json`,
      ],
    ],
  ])(
    'rejects %s mode bound to the archived retry-01 namespace',
    (_mode, args) => {
      const fixture = materializeManifestVerifierRepository(
        'new-era-manifest-archived-retry-',
      )
      const output = join(fixture.repo, args.at(-1))
      mkdirSync(dirname(output), { recursive: true })
      const result = spawnSync(
        process.execPath,
        [fixture.script, ...args],
        { cwd: fixture.prototype, encoding: 'utf8' },
      )

      expect(result.status).toBe(1)
      expect(parseLine(result.stderr).errorCode).toBe(
        'CANDIDATE_MANIFEST_OUTPUT_PATH',
      )
      expect(existsSync(output)).toBe(false)
      expect(existsSync(`${output}.sha256`)).toBe(false)
    },
  )

  it('rejects an ancestor symlink into old C04 evidence without publishing', () => {
    const root = temporaryDirectory('new-era-manifest-output-ancestor-link-')
    const repo = join(root, 'repo')
    const prototype = join(repo, 'prototype')
    const script = join(
      prototype,
      'scripts',
      'verify-playtest-manifest.mjs',
    )
    const oldEvidence = join(repo, c04Root, 'evidence', 'phase6')
    const targetParent = join(oldEvidence, 'ancestor-link-target')
    const alias = join(root, 'phase6-alias')
    const output = join(
      alias,
      'ancestor-link-target',
      'manifest-fixtures.json',
    )
    mkdirSync(join(prototype, 'scripts'), { recursive: true })
    mkdirSync(targetParent, { recursive: true })
    cpSync(verifier, script)
    cpSync(
      resolve('scripts', 'candidate-manifest-contract.mjs'),
      join(prototype, 'scripts', 'candidate-manifest-contract.mjs'),
    )
    cpSync(
      resolve('tests', 'fixtures'),
      join(prototype, 'tests', 'fixtures'),
      { recursive: true },
    )
    symlinkSync(oldEvidence, alias)

    const result = spawnSync(
      process.execPath,
      [script, '--fixtures', '--output', output],
      { cwd: prototype, encoding: 'utf8' },
    )

    expect(result.status).toBe(1)
    expect(parseLine(result.stderr).errorCode).toBe(
      'CANDIDATE_MANIFEST_OUTPUT_PATH',
    )
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('maps a non-directory output ancestor to the manifest output-path error', () => {
    const ancestor = join(
      temporaryDirectory('new-era-manifest-output-file-'),
      'ancestor-file',
    )
    const output = join(ancestor, 'manifest-fixtures.json')
    writeFileSync(ancestor, 'not-a-directory\n')

    const result = run(['--fixtures', '--output', output])

    expect(result.status).toBe(1)
    expect(parseLine(result.stderr).errorCode).toBe(
      'CANDIDATE_MANIFEST_OUTPUT_PATH',
    )
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('runs probe mode against the nine real authority files', () => {
    const root = temporaryDirectory('new-era-manifest-probe-')
    const output = join(root, 'probe.json')
    const result = run([
      '--probe',
      resolve(
        'tests',
        'fixtures',
        'manifests',
        'candidate-c04-authority-probe.json',
      ),
      '--repo-root',
      '..',
      '--output',
      output,
    ])

    expect(result.status, result.stderr).toBe(0)
    expect(parseLine(result.stdout)).toMatchObject({
      status: 'PASS_AUTHORITY_PREFLIGHT',
      accepted: true,
      fullManifestVerified: false,
      authorityProfile: 'rc9-v03',
      scenarioVersion: '0.5.1',
      protocolVersion: 'weekly-management-slice-playtest-v0.3',
    })
    expectExactSidecar(output)
  })

  it('rejects full mode when Phase 6 command identities are absent', () => {
    const missingIdentityFixture = createFullManifestRepository({
      phase6Identities: false,
    })
    const repo = cloneFullManifestRepository(missingIdentityFixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, missingIdentityFixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects a Phase 6 identity bound to a different integration SHA', () => {
    const mismatchedIdentityFixture = createFullManifestRepository({
      mismatchedPhase6Command: 'lint',
    })
    const repo = cloneFullManifestRepository(mismatchedIdentityFixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, mismatchedIdentityFixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects a Phase 6 identity with a trailing argv token', () => {
    const mismatchedArgvFixture = createFullManifestRepository({
      mismatchedPhase6ArgvCommand: 'test',
    })
    const repo = cloneFullManifestRepository(mismatchedArgvFixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, mismatchedArgvFixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects a Phase 6 text record with a nonzero child exit', () => {
    const nonzeroChildFixture = createFullManifestRepository({
      textChildExitCommand: 'lint',
    })
    const repo = cloneFullManifestRepository(nonzeroChildFixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, nonzeroChildFixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it.each([
    ['missing childExitCode', { textRecordMissingChildExitCommand: 'lint' }],
    ['wrong schema', { textRecordSchemaMismatchCommand: 'lint' }],
  ])('rejects a Phase 6 text record with %s', (_label, options) => {
    const invalidTextRecordFixture =
      createFullManifestRepository(options)
    const repo = cloneFullManifestRepository(invalidTextRecordFixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, invalidTextRecordFixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects archive commands bound to different absolute paths', () => {
    const mismatchedArchiveFixture = createFullManifestRepository({
      archivePathMismatch: true,
    })
    const repo = cloneFullManifestRepository(mismatchedArchiveFixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, mismatchedArchiveFixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects an archive identity whose absolute target is inside the verifier repository', () => {
    const fixture = createFullManifestRepository({
      phase6ArchivePathFactory: (repo) =>
        join(realpathSync(repo), 'forbidden-phase6-archive.tar'),
    })
    mkdirSync(dirname(join(fixture.repo, fullOutput)), {
      recursive: true,
    })
    expectFullFailurePreservesOutputs(
      fixture.repo,
      fullArgs(fixture.repo, fixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects an archive identity with an existing symlink ancestor', () => {
    const fixture = createFullManifestRepository({
      phase6ArchivePathFactory: (repo) => {
        const parent = realpathSync(dirname(repo))
        const target = join(parent, 'archive-target')
        const alias = join(parent, 'archive-alias')
        mkdirSync(target)
        symlinkSync(target, alias)
        return join(alias, 'missing', 'phase6-archive.tar')
      },
    })
    mkdirSync(dirname(join(fixture.repo, fullOutput)), {
      recursive: true,
    })
    expectFullFailurePreservesOutputs(
      fixture.repo,
      fullArgs(fixture.repo, fixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects a noncanonical absolute archive identity alias', () => {
    const fixture = createFullManifestRepository({
      phase6ArchivePathFactory: (repo) =>
        `${realpathSync(dirname(repo))}/archive-alias/../phase6-archive.tar`,
    })
    mkdirSync(dirname(join(fixture.repo, fullOutput)), {
      recursive: true,
    })
    expectFullFailurePreservesOutputs(
      fixture.repo,
      fullArgs(fixture.repo, fixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects an existing repo-external directory as the archive target', () => {
    const fixture = createFullManifestRepository({
      phase6ArchivePathFactory: (repo) => {
        const target = join(
          realpathSync(dirname(repo)),
          'existing-phase6-archive-directory',
        )
        mkdirSync(target)
        return target
      },
    })
    mkdirSync(dirname(join(fixture.repo, fullOutput)), {
      recursive: true,
    })
    expectFullFailurePreservesOutputs(
      fixture.repo,
      fullArgs(fixture.repo, fixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects an existing repo-external symlink as the archive target', () => {
    const fixture = createFullManifestRepository({
      phase6ArchivePathFactory: (repo) => {
        const parent = realpathSync(dirname(repo))
        const target = join(parent, 'existing-phase6-archive-file.tar')
        const alias = join(parent, 'existing-phase6-archive-link.tar')
        writeFileSync(target, 'existing archive\n')
        symlinkSync(target, alias)
        return alias
      },
    })
    mkdirSync(dirname(join(fixture.repo, fullOutput)), {
      recursive: true,
    })
    expectFullFailurePreservesOutputs(
      fixture.repo,
      fullArgs(fixture.repo, fixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('accepts an existing repo-external regular archive target', () => {
    const fixture = createFullManifestRepository({
      phase6ArchivePathFactory: (repo) => {
        const target = join(
          realpathSync(dirname(repo)),
          'existing-phase6-archive-file.tar',
        )
        writeFileSync(target, 'existing archive\n')
        return target
      },
    })
    mkdirSync(dirname(join(fixture.repo, fullOutput)), {
      recursive: true,
    })
    const result = run(fullArgs(fixture.repo, fixture.manifestSha))

    expect(result.status, result.stderr).toBe(0)
    expect(parseLine(result.stdout)).toMatchObject({
      status: 'PASS_FULL_MANIFEST',
      fullManifestVerified: true,
    })
  })

  it('rejects archive verification with a mismatched epoch', () => {
    const mismatchedArchiveFixture = createFullManifestRepository({
      archiveEpochMismatch: true,
    })
    const repo = cloneFullManifestRepository(mismatchedArchiveFixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, mismatchedArchiveFixture.manifestSha),
      'CANDIDATE_MANIFEST_EVIDENCE',
    )
  })

  it('rejects a frozen-evidence guard without its Phase 6 identity', () => {
    const missingFrozenIdentityFixture = createFullManifestRepository({
      frozenPhase6Identity: false,
    })
    const repo = cloneFullManifestRepository(missingFrozenIdentityFixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, missingFrozenIdentityFixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects a frozen-evidence guard with a trailing argv token', () => {
    const mismatchedFrozenIdentityFixture =
      createFullManifestRepository({
        mismatchedFrozenPhase6Argv: true,
      })
    const repo = cloneFullManifestRepository(
      mismatchedFrozenIdentityFixture,
    )
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, mismatchedFrozenIdentityFixture.manifestSha),
      'CANDIDATE_MANIFEST_COMMAND',
    )
  })

  it('rejects S when plan_ref is not its ancestor', () => {
    const fixture = createFullManifestRepository({
      sourceTopologyMutation: 'plan-ref-not-ancestor',
    })
    const repo = cloneFullManifestRepository(fixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, fixture.manifestSha),
      'CANDIDATE_MANIFEST_GIT_BINDING',
    )
  })

  it('rejects S when its source range deletes an allowlist path', () => {
    const fixture = createFullManifestRepository({
      sourceTopologyMutation: 'allowlist-deletion',
    })
    const repo = cloneFullManifestRepository(fixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, fixture.manifestSha),
      'CANDIDATE_MANIFEST_GIT_BINDING',
    )
  })

  it('rejects S with a committed non-allowlist path', () => {
    const fixture = createFullManifestRepository({
      sourceTopologyMutation: 'non-allowlist-path',
    })
    const repo = cloneFullManifestRepository(fixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, fixture.manifestSha),
      'CANDIDATE_MANIFEST_GIT_BINDING',
    )
  })

  it.each(excludedC04Ancestors)(
    'rejects %s as a %s ancestor',
    (_label, target, excludedAncestorSha) => {
      const fixture = createFullManifestRepository({
        excludedAncestorTarget: target,
        excludedAncestorSha,
      })
      const repo = cloneFullManifestRepository(fixture)
      expectFullFailurePreservesOutputs(
        repo,
        fullArgs(repo, fixture.manifestSha),
        'CANDIDATE_MANIFEST_GIT_BINDING',
      )
    },
  )

  it('rejects an integration allowlist blob that differs from S', () => {
    const fixture = createFullManifestRepository({
      integrationTopologyMutation: 'blob-mismatch',
    })
    const repo = cloneFullManifestRepository(fixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, fixture.manifestSha),
      'CANDIDATE_MANIFEST_GIT_BINDING',
    )
  })

  it('runs full mode from M Git objects and publishes exact bound output', () => {
    const repo = cloneFullManifestRepository(fullFixture)
    const manifestPath = join(repo, canonicalManifest)
    const manifestSidecarPath = `${manifestPath}.sha256`
    writeFileSync(manifestPath, '{"worktreeSubstitution":true}\n')
    writeFileSync(manifestSidecarPath, 'worktree-sidecar-substitution\n')

    const result = run(fullArgs(repo, fullFixture.manifestSha))
    expect(result.status, result.stderr).toBe(0)
    const stdout = parseLine(result.stdout)
    const outputPath = join(repo, fullOutput)
    const outputSidecarPath = `${outputPath}.sha256`
    const outputBytes = readFileSync(outputPath)
    const outputSidecarBytes = readFileSync(outputSidecarPath)
    expect(JSON.parse(outputBytes.toString('utf8'))).toEqual(stdout)
    expect(stdout).toMatchObject({
      schemaVersion: 'candidate-manifest-verification-v1',
      status: 'PASS_FULL_MANIFEST',
      accepted: true,
      fullManifestVerified: true,
      manifestGitSha: fullFixture.manifestSha,
      candidateEvidenceSnapshotSha: fullFixture.evidenceSha,
      candidateManifestId: 'CM01',
      candidateAttempt: 'C04',
      authorityProfile: 'rc9-v03',
      manifest: {
        path: canonicalManifest,
        sha256: fullFixture.manifestHash,
        bytes: fullFixture.manifestBytes.length,
        sidecar: {
          path: `${canonicalManifest}.sha256`,
          sha256: sha256(
            Buffer.from(
              `${fullFixture.manifestHash}  ${canonicalManifest}\n`,
            ),
          ),
        },
      },
    })
    expect(outputSidecarBytes).toEqual(
      Buffer.from(`${sha256(outputBytes)}  ${fullOutput}\n`),
    )

    const beforeJson = Buffer.from(outputBytes)
    const beforeSidecar = Buffer.from(outputSidecarBytes)
    const repeated = run(fullArgs(repo, fullFixture.manifestSha))
    expect(repeated.status).toBe(1)
    expect(parseLine(repeated.stderr).errorCode).toBe(
      'CANDIDATE_MANIFEST_OUTPUT_EXISTS',
    )
    expect(readFileSync(outputPath)).toEqual(beforeJson)
    expect(readFileSync(outputSidecarPath)).toEqual(beforeSidecar)
  }, 15_000)

  it.each([
    `${c04Root}/evidence/phase6-retry-02/manifest-fixtures.json`,
    `${c04Root}/evidence/phase6-retry-02/manifest-probe.json`,
  ])(
    'rejects full mode bound to the Phase 6 output %s',
    (output) => {
      const repo = cloneFullManifestRepository(fullFixture)
      mkdirSync(dirname(join(repo, output)), { recursive: true })
      unlinkSync(join(repo, output))
      unlinkSync(`${join(repo, output)}.sha256`)
      const args = fullArgs(repo, fullFixture.manifestSha)
      args[args.length - 1] = output

      const result = run(args)

      expect(result.status).toBe(1)
      expect(parseLine(result.stderr).errorCode).toBe(
        'CANDIDATE_MANIFEST_OUTPUT_PATH',
      )
      expect(existsSync(join(repo, output))).toBe(false)
      expect(existsSync(`${join(repo, output)}.sha256`)).toBe(false)
    },
  )

  it.each([
    `${cohort}/evidence/reviews/IR0/verifiers/full-manifest-verification.json`,
    `${cohort}/evidence/reviews/IR00/verifiers/full-manifest-verification.json`,
    `${cohort}/seals/S0/verifiers/full-manifest-verification.json`,
  ])('rejects a non-allocated review or seal output %s', (output) => {
    const repo = cloneFullManifestRepository(fullFixture)
    mkdirSync(dirname(join(repo, output)), { recursive: true })
    const args = fullArgs(repo, fullFixture.manifestSha)
    args[args.length - 1] = output

    const result = run(args)

    expect(result.status).toBe(1)
    expect(parseLine(result.stderr).errorCode).toBe(
      'CANDIDATE_MANIFEST_OUTPUT_PATH',
    )
    expect(existsSync(join(repo, output))).toBe(false)
    expect(existsSync(`${join(repo, output)}.sha256`)).toBe(false)
  })

  it.each([
    `${cohort}/evidence/reviews/IR01/verifiers/full-manifest-verification.json`,
    `${cohort}/seals/S01/verifiers/full-manifest-verification.json`,
  ])('accepts an allocated review or seal output %s', (output) => {
    const repo = cloneFullManifestRepository(fullFixture)
    mkdirSync(dirname(join(repo, output)), { recursive: true })
    const args = fullArgs(repo, fullFixture.manifestSha)
    args[args.length - 1] = output

    const result = run(args)

    expect(result.status, result.stderr).toBe(0)
    const outputPath = join(repo, output)
    const outputBytes = readFileSync(outputPath)
    expect(readFileSync(`${outputPath}.sha256`)).toEqual(
      Buffer.from(`${sha256(outputBytes)}  ${output}\n`),
    )
  })

  it('rejects full mode without --manifest-git-sha and preserves outputs', () => {
    const repo = cloneFullManifestRepository(fullFixture)
    expectFullFailurePreservesOutputs(repo, [
      '--manifest',
      canonicalManifest,
      '--repo-root',
      repo,
      '--output',
      fullOutput,
    ], 'CANDIDATE_MANIFEST_MODE')
  })

  it('rejects an unresolved manifest Git SHA and preserves outputs', () => {
    const repo = cloneFullManifestRepository(fullFixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, 'f'.repeat(40)),
      'CANDIDATE_MANIFEST_GIT_BINDING',
    )
  })

  it('rejects a non-canonical manifest path and preserves outputs', () => {
    const repo = cloneFullManifestRepository(fullFixture)
    const args = fullArgs(repo, fullFixture.manifestSha)
    args[1] = `${c04Root}/candidate-build-manifest.json`
    expectFullFailurePreservesOutputs(
      repo,
      args,
      'CANDIDATE_MANIFEST_PATH',
    )
  })

  it('rejects M when the canonical manifest path is absent', () => {
    const repo = cloneFullManifestRepository(fullFixture)
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, fullFixture.evidenceSha),
      'CANDIDATE_MANIFEST_GIT_BINDING',
    )
  })

  it('rejects M when the canonical manifest is not a regular Git blob', () => {
    const repo = cloneFullManifestRepository(fullFixture)
    const manifestPath = join(repo, canonicalManifest)
    const targetPath = join(dirname(manifestPath), 'manifest-target.json')
    unlinkSync(manifestPath)
    writeFileSync(targetPath, fullFixture.manifestBytes)
    symlinkSync('manifest-target.json', manifestPath)
    git(
      repo,
      'add',
      canonicalManifest,
      `${dirname(canonicalManifest)}/manifest-target.json`,
    )
    git(repo, 'commit', '--quiet', '-m', 'fixture non-blob manifest')
    const nonBlobManifestSha = git(repo, 'rev-parse', 'HEAD')
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, nonBlobManifestSha),
      'CANDIDATE_MANIFEST_GIT_BINDING',
    )
  })

  it('rejects M when its committed manifest sidecar does not bind the blob', () => {
    const repo = cloneFullManifestRepository(fullFixture)
    writeFileSync(
      join(repo, `${canonicalManifest}.sha256`),
      `${'0'.repeat(64)}  ${canonicalManifest}\n`,
    )
    git(repo, 'add', `${canonicalManifest}.sha256`)
    git(repo, 'commit', '--quiet', '-m', 'fixture bad manifest sidecar')
    const badSidecarManifestSha = git(repo, 'rev-parse', 'HEAD')
    expectFullFailurePreservesOutputs(
      repo,
      fullArgs(repo, badSidecarManifestSha),
      'CANDIDATE_MANIFEST_GIT_BINDING',
    )
  })

  it('has no hidden two-argument fixture bypass', () => {
    const result = run([
      '--manifest',
      resolve(
        'tests',
        'fixtures',
        'manifests',
        'candidate-valid.json',
      ),
    ])

    expect(result.status).toBe(1)
    expect(parseLine(result.stderr).errorCode).toBe(
      'CANDIDATE_MANIFEST_MODE',
    )
  })

  it('fails closed on a partial output group', () => {
    const root = temporaryDirectory('new-era-manifest-partial-')
    const output = join(root, 'fixtures.json')
    writeFileSync(output, 'sentinel\n')

    const result = run(['--fixtures', '--output', output])
    expect(result.status).toBe(1)
    expect(parseLine(result.stderr).errorCode).toBe(
      'PARTIAL_EVIDENCE_GROUP',
    )
    expect(readFileSync(output, 'utf8')).toBe('sentinel\n')
  })

  it('rejects an output symlink without following or replacing it', () => {
    const root = temporaryDirectory('new-era-manifest-symlink-')
    const target = join(root, 'target.json')
    const output = join(root, 'fixtures.json')
    writeFileSync(target, 'sentinel\n')
    symlinkSync(target, output)

    const result = run(['--fixtures', '--output', output])
    expect(result.status).toBe(1)
    expect(parseLine(result.stderr).errorCode).toBe(
      'PARTIAL_EVIDENCE_GROUP',
    )
    expect(readFileSync(target, 'utf8')).toBe('sentinel\n')
  })
})
