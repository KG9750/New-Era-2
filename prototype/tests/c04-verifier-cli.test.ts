// @ts-nocheck -- production CLI coverage intentionally uses child processes.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  commandOutputPath,
  expectedPhase6Argv,
  frozenEvidenceGuardPath,
  PHASE6_WRAPPER_COMMAND_IDS,
  SOURCE_CHANGE_ALLOWLIST,
} from '../scripts/candidate-manifest-contract.mjs'

const node = process.execPath
const phase6 = resolve('scripts', 'candidate-manifest-contract.mjs')
const isolation = resolve('scripts', 'verify-diagnostic-isolation.mjs')
const frozen = resolve('scripts', 'verify-frozen-evidence.mjs')
const runtime = resolve('scripts', 'verify-c04-runtime-equivalence.mjs')
const sourceBaseline = 'cd2fc9716d98c160fe530c593347992f18bf96e4'
const evidenceBaseline = '5b9438cc5123ba35d8a703f3507bbf463e90176d'
const c03ArtifactRoot =
  'data/playtests/weekly-management-slice/gate1a/' +
  'g1a-20260727-rc9-01/candidates/C03/rc-dist'
const c04Root =
  'data/playtests/weekly-management-slice/gate1a/' +
  'g1a-20260727-rc9-01/candidates/C04'
const phase6Path =
  '/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin'
const phase6PlanRef = '441f7d96635e9176c8aea3ff21454d596c287c49'
const phase6PackageScript =
  `PATH=${phase6Path} ` +
  '/opt/homebrew/opt/node@24/bin/node ' +
  'scripts/candidate-manifest-contract.mjs --phase6-run'
const canonicalIdentityInput =
  `${c04Root}/diagnostics/TECH-RC9-D16/` +
  'diagnostic-isolation-input.json'
const canonicalIdentityOutput =
  `${c04Root}/evidence/diagnostic-isolation/` +
  'TECH-RC9-D16-verification.json'
const canonicalAggregateOutput =
  `${c04Root}/evidence/freeze-audit/` +
  'diagnostic-isolation-aggregate.json'

const negativeCases = {
  G01: 'ISOLATION_GRAMMAR_EXACT_KEYS',
  G02: 'ISOLATION_GRAMMAR_EXACT_KEYS',
  G03: 'ISOLATION_GRAMMAR_NATIVE_TYPE',
  G04: 'ISOLATION_GRAMMAR_TOP_LEVEL',
  G05: 'ISOLATION_GRAMMAR_SUBTYPE',
  L01: 'ISOLATION_MCP_LIFECYCLE',
  L02: 'ISOLATION_MCP_LIFECYCLE',
  L03: 'ISOLATION_MCP_LIFECYCLE',
  L04: 'ISOLATION_MCP_STATUS',
  C01: 'ISOLATION_CORRELATION_THREAD',
  C02: 'ISOLATION_CORRELATION_TURN',
  C03: 'ISOLATION_CORRELATION_FUNCTION',
  C04: 'ISOLATION_CORRELATION_CUSTOM_EQUALITY',
  C05: 'ISOLATION_CORRELATION_CUSTOM_INEQUALITY',
  C06: 'ISOLATION_CORRELATION_MCP_EQUALITY',
  C07: 'ISOLATION_CORRELATION_MCP_INEQUALITY',
  O01: 'ISOLATION_ORDER_PERSISTED_TOOL',
  O02: 'ISOLATION_ORDER_EXEC_MCP',
  T01: 'ISOLATION_ORDER_TOOL_SEARCH',
  T02: 'ISOLATION_TOOL_SEARCH_PROVIDER',
  T03: 'ISOLATION_TOOL_SEARCH_STATUS',
  T04: 'ISOLATION_TOOL_SEARCH_ARGUMENTS',
  T05: 'ISOLATION_TOOL_SEARCH_ARGUMENTS',
  T06: 'ISOLATION_CORRELATION_TOOL_SEARCH_EQUALITY',
  T07: 'ISOLATION_CORRELATION_TOOL_SEARCH_INEQUALITY',
  T08: 'ISOLATION_CORRELATION_TOOL_SEARCH_INEQUALITY',
  T09: 'ISOLATION_CORRELATION_TOOL_SEARCH_INEQUALITY',
  R01: 'ISOLATION_RESPONSE_ID_UNIQUENESS',
  S01: 'ISOLATION_GOLDEN_SOURCE_COMMITMENT',
  S02: 'ISOLATION_GOLDEN_SOURCE_UNAVAILABLE',
  U01: 'ISOLATION_TOOL_POLICY_LEAF',
} as const

const identityCases = [
  'C04_CLI_BINARY_PATH',
  'C04_CLI_VERSION',
  'C04_CLI_BINARY_SHA256',
  'C04_CLI_TEAM_IDENTIFIER',
  'C04_CLI_AUTHORITY',
  'C04_NODE_IDENTITY',
] as const

const identityMutations = {
  C04_CLI_BINARY_PATH: ['cliBinaryPath', 'string'],
  C04_CLI_VERSION: ['agentCliVersion', 'string'],
  C04_CLI_BINARY_SHA256: ['cliBinarySha256', 'string'],
  C04_CLI_TEAM_IDENTIFIER: ['cliTeamIdentifier', 'string'],
  C04_CLI_AUTHORITY: ['cliAuthority', 'string'],
  C04_NODE_IDENTITY: ['nodeBinarySha256', 'hash'],
} as const

function temporaryDirectory(prefix: string) {
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)))
}

function run(
  script: string,
  args: string[],
  cwd = process.cwd(),
  extraEnvironment = {},
) {
  return spawnSync(node, [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH:
        '/opt/homebrew/opt/node@24/bin:' +
        '/opt/homebrew/bin:/usr/bin:/bin',
      ...extraEnvironment,
    },
  })
}

function parseLastJson(text: string) {
  return JSON.parse(text.trim().split('\n').at(-1))
}

function sha256(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('hex')
}

function expectExactSidecar(outputPath: string, label = outputPath) {
  const outputBytes = readFileSync(outputPath)
  expect(readFileSync(`${outputPath}.sha256`)).toEqual(
    Buffer.from(`${sha256(outputBytes)}  ${label}\n`),
  )
}

function expectSingleError(result, errorCode: string) {
  expect(result.status).not.toBe(0)
  expect(result.stdout).toBe('')
  const document = parseLastJson(result.stderr)
  expect(document.errorCode).toBe(errorCode)
  if (Object.hasOwn(document, 'accepted')) {
    expect(document.accepted).toBe(false)
  }
  expect(result.stderr.split(errorCode)).toHaveLength(2)
  return document
}

function git(...args: string[]) {
  const result = spawnSync('git', args, {
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  })
  expect(result.status, result.stderr.toString()).toBe(0)
  return result.stdout
}

function currentHead() {
  return git('rev-parse', 'HEAD').toString('utf8').trim()
}

function resolvesCommit(ref: string) {
  const result = spawnSync(
    'git',
    ['rev-parse', '--verify', `${ref}^{commit}`],
    { encoding: 'utf8' },
  )
  return result.status === 0 ? result.stdout.trim() : null
}

function isAncestor(ancestor: string, descendant: string) {
  return spawnSync(
    'git',
    ['merge-base', '--is-ancestor', ancestor, descendant],
  ).status === 0
}

function currentSourceHead() {
  const head = currentHead()
  if (isAncestor(sourceBaseline, head)) return head
  for (const ref of [
    'refs/heads/codex/rc9-08r3-c04-implementation',
    'refs/remotes/origin/codex/rc9-08r3-c04-implementation',
  ]) {
    const candidate = resolvesCommit(ref)
    if (candidate && isAncestor(sourceBaseline, candidate)) {
      return candidate
    }
  }
  throw new Error('C04 source branch ref is unavailable')
}

function sourceVerificationContext() {
  const sourceHead = currentSourceHead()
  return {
    mode: 'source',
    baseline: sourceBaseline,
    head: sourceHead,
    sourceHead,
    expectedStatus: 'PASS_SOURCE_SCOPE',
  }
}

function sourceImplementationCommitted() {
  const result = spawnSync(
    'git',
    [
      'status',
      '--porcelain',
      '--',
      'scripts/verify-diagnostic-isolation.mjs',
      'scripts/verify-frozen-evidence.mjs',
      'scripts/verify-c04-runtime-equivalence.mjs',
      'tests/c04-verifier-cli.test.ts',
    ],
    { encoding: 'utf8' },
  )
  return result.status === 0 && result.stdout.trim() === ''
}

function materializeVerifierRepository(scriptPath: string) {
  const root = temporaryDirectory('new-era-verifier-repo-')
  const repo = join(root, 'repo')
  const clone = spawnSync(
    'git',
    ['clone', '--quiet', '--shared', resolve('..'), repo],
    { encoding: 'utf8' },
  )
  expect(clone.status, clone.stderr).toBe(0)
  const copiedScript = join(
    repo,
    'prototype',
    'scripts',
    basename(scriptPath),
  )
  copyFileSync(scriptPath, copiedScript)
  copyFileSync(
    phase6,
    join(dirname(copiedScript), 'candidate-manifest-contract.mjs'),
  )
  return { root, repo, script: copiedScript }
}

function materializePhase6Wrapper() {
  const root = temporaryDirectory('new-era-phase6-wrapper-')
  const repo = join(root, 'repo')
  const prototype = join(repo, 'prototype')
  const script = join(
    prototype,
    'scripts',
    'candidate-manifest-contract.mjs',
  )
  const clone = spawnSync(
    'git',
    ['clone', '--quiet', '--shared', resolve('..'), repo],
    { encoding: 'utf8' },
  )
  expect(clone.status, clone.stderr).toBe(0)
  gitIn(repo, 'checkout', '--quiet', phase6PlanRef)
  copyFileSync(phase6, script)
  copyFileSync(resolve('package.json'), join(prototype, 'package.json'))
  gitIn(repo, 'config', 'user.name', 'Phase 6 Test')
  gitIn(repo, 'config', 'user.email', 'phase6@example.invalid')
  gitIn(
    repo,
    'add',
    'prototype/package.json',
    'prototype/scripts/candidate-manifest-contract.mjs',
  )
  gitIn(repo, 'commit', '--quiet', '-m', 'fixture source implementation')
  const sourceSha = gitIn(repo, 'rev-parse', 'HEAD')
  const integrationSha = materializeIntegrationCommit(repo, sourceSha)
  gitIn(repo, 'checkout', '--quiet', sourceSha)
  return {
    root,
    repo,
    prototype,
    script,
    sourceSha,
    integrationSha,
  }
}

function materializeIntegrationCommit(repo: string, sourceSha: string) {
  gitIn(repo, 'checkout', '--quiet', '-B', 'fixture-integration', evidenceBaseline)
  gitIn(repo, 'checkout', sourceSha, '--', ...SOURCE_CHANGE_ALLOWLIST)
  gitIn(repo, 'add', '--', ...SOURCE_CHANGE_ALLOWLIST)
  gitIn(repo, 'commit', '--quiet', '-m', 'fixture evidence integration')
  return gitIn(repo, 'rev-parse', 'HEAD')
}

function materializePriorIntegrationOutputs(fixture, commandId: string) {
  const currentIndex = PHASE6_WRAPPER_COMMAND_IDS.indexOf(commandId)
  expect(currentIndex).toBeGreaterThanOrEqual(0)
  for (const priorCommandId of PHASE6_WRAPPER_COMMAND_IDS.slice(
    0,
    currentIndex,
  )) {
    const output = phase6IntegrationOutput(priorCommandId)
    const target = join(fixture.repo, output)
    mkdirSync(dirname(target), { recursive: true })
    const identity = phase6IntegrationIdentity(
      fixture,
      priorCommandId,
      output,
    )
    if (priorCommandId === 'rc-archive') {
      mkdirSync(dirname(identity.archivePath), { recursive: true })
      writeFileSync(identity.archivePath, 'controlled archive\n', {
        flag: 'wx',
      })
    }
    if (
      ['rc-archive', 'rc-verify-archive'].includes(priorCommandId)
    ) {
      const archiveBytes = readFileSync(identity.archivePath)
      const observation = {
        ...(priorCommandId === 'rc-verify-archive'
          ? { verified: true }
          : {}),
        archive: identity.archivePath,
        archiveFormat: 'ustar',
        archiveHash: sha256(archiveBytes),
        bytes: archiveBytes.length,
        entryCount: 1,
        sourceDateEpoch: 946684800,
      }
      const record = {
        schemaVersion: 'c04-phase6-text-record-v1',
        phase6Identity: identity,
        childExitCode: 0,
        stdoutBase64: Buffer.from(
          `${JSON.stringify(observation)}\n`,
        ).toString('base64'),
        stderrBase64: '',
      }
      writeFileSync(
        target,
        `C04_PHASE6_IDENTITY_V1\n${JSON.stringify(record)}\n`,
      )
    } else if (
      [
        'frozen-evidence-guard',
        'manifest-fixtures',
        'manifest-probe',
        'runtime-equivalence',
      ].includes(priorCommandId)
    ) {
      const statuses = {
        'frozen-evidence-guard': 'PASS_EVIDENCE_LINEAGE',
        'manifest-fixtures': 'PASS_FIXTURES',
        'manifest-probe': 'PASS_AUTHORITY_PREFLIGHT',
        'runtime-equivalence': 'PASS_RUNTIME_EQUIVALENCE',
      }
      const bytes = Buffer.from(
        `${JSON.stringify({
          status: statuses[priorCommandId],
          phase6Identity: identity,
        })}\n`,
      )
      writeFileSync(target, bytes)
      writeFileSync(
        `${target}.sha256`,
        `${sha256(bytes)}  ${output}\n`,
      )
    } else {
      const record = {
        schemaVersion: 'c04-phase6-text-record-v1',
        phase6Identity: identity,
        childExitCode: 0,
        stdoutBase64: Buffer.from(
          `prior ${priorCommandId}\n`,
        ).toString('base64'),
        stderrBase64: '',
      }
      writeFileSync(
        target,
        `C04_PHASE6_IDENTITY_V1\n${JSON.stringify(record)}\n`,
      )
    }
  }
}

function phase6IntegrationOutput(commandId: string) {
  return commandId === 'frozen-evidence-guard'
    ? frozenEvidenceGuardPath('C04')
    : commandOutputPath('C04', commandId)
}

function phase6WrapperOutput(fixture, commandId: string, mode: string) {
  return mode === 'source'
    ? join(fixture.root, 'source-output', phase6IntegrationOutput(commandId).split('/').at(-1))
    : phase6IntegrationOutput(commandId)
}

function phase6ArchivePath(fixture, mode: string) {
  return join(fixture.root, 'archives', `${mode}.tar`)
}

function phase6ChildArgv(
  fixture,
  commandId: string,
  mode: string,
  output: string,
) {
  const identity = {
    commandId,
    mode,
    outputPath: output,
    ...(['rc-archive', 'rc-verify-archive'].includes(commandId)
      ? { archivePath: phase6ArchivePath(fixture, mode) }
      : {}),
    ...(mode === 'source'
      ? { sourceSha: fixture.sourceSha }
      : {
          integrationSha: fixture.integrationSha,
          artifactSourceSha: fixture.sourceSha,
        }),
  }
  return expectedPhase6Argv(identity)
}

function phase6IntegrationIdentity(
  fixture,
  commandId: string,
  output: string,
  artifactSourceSha = fixture.sourceSha ?? fixture.sourceHead,
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
    outputPath: output,
    planRef: phase6PlanRef,
    ...(['rc-archive', 'rc-verify-archive'].includes(commandId)
      ? { archivePath: phase6ArchivePath(fixture, 'integration') }
      : {}),
    integrationSha: fixture.integrationSha,
    artifactSourceSha,
    argv: [],
  }
  identity.argv = expectedPhase6Argv(identity)
  return identity
}

function phase6WrapperArgv(
  fixture,
  commandId: string,
  mode: string,
  output: string,
  childArgv = phase6ChildArgv(fixture, commandId, mode, output),
) {
  const targetHead =
    mode === 'source' ? fixture.sourceSha : fixture.integrationSha
  if (gitIn(fixture.repo, 'rev-parse', 'HEAD') !== targetHead) {
    gitIn(fixture.repo, 'checkout', '--quiet', targetHead)
  }
  return [
    '--command-id',
    commandId,
    '--mode',
    mode,
    '--plan-ref',
    phase6PlanRef,
    ...(mode === 'source'
      ? ['--source-sha', fixture.sourceSha]
      : [
          '--integration-sha',
          fixture.integrationSha,
          '--artifact-source-sha',
          fixture.sourceSha,
        ]),
    '--output',
    output,
    ...(['rc-archive', 'rc-verify-archive'].includes(commandId)
      ? ['--archive-path', phase6ArchivePath(fixture, mode)]
      : []),
    '--',
    ...childArgv,
  ]
}

function materializePhase6NpmWrapper() {
  const fixture = materializePhase6Wrapper()
  const fakeCommand = join(
    fixture.prototype,
    'scripts',
    'check-playtest-fixtures.mjs',
  )
  const packagePath = join(fixture.prototype, 'package.json')
  const fakeSource = `
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const lifecycleCommandIds = {
  lint: 'lint',
  'test:run': 'test',
  build: 'build',
  'rc:build': 'rc-build',
  'rc:verify': 'rc-verify',
  'e2e:rc': 'e2e-rc',
  'rc:archive': 'rc-archive',
  'rc:verify-archive': 'rc-verify-archive',
  'schema:fixtures': 'schema-fixtures',
  'guard:rc8': 'guard-rc8',
  'manifest:verify': 'manifest-fixtures',
  'runtime:equivalence': 'runtime-equivalence',
  'rc:repro': 'rc-repro',
  'guard:frozen-evidence': 'frozen-evidence-guard',
}
const identity =
  process.env.C04_PHASE6_IDENTITY_V1 === undefined
    ? { commandId: lifecycleCommandIds[process.env.npm_lifecycle_event] }
    : JSON.parse(process.env.C04_PHASE6_IDENTITY_V1)
if (process.env.PATH !== ${JSON.stringify(phase6Path)}) process.exit(91)
if (
  process.env.PHASE6_TEST_REQUIRE_IDENTITY_ABSENT &&
  process.env.C04_PHASE6_IDENTITY_V1 !== undefined
) {
  process.exit(92)
}
if (process.env.PHASE6_TEST_SENTINEL) {
  writeFileSync(process.env.PHASE6_TEST_SENTINEL, identity.commandId)
}
if (process.env.PHASE6_TEST_EXIT_CODE) {
  process.stderr.write('forced child failure\\n')
  process.exit(Number(process.env.PHASE6_TEST_EXIT_CODE))
}
if (identity.commandId === 'rc-archive') {
  const argv = process.argv.slice(2)
  const index = argv.lastIndexOf('--output')
  const archive = argv[index + 1]
  mkdirSync(dirname(archive), { recursive: true })
  writeFileSync(archive, 'controlled archive\\n', { flag: 'wx' })
}
if (identity.commandId === 'rc-archive' || identity.commandId === 'rc-verify-archive') {
  const argv = process.argv.slice(2)
  const archiveArgument =
    identity.commandId === 'rc-archive' ? '--output' : '--archive'
  const archive =
    identity.archivePath ?? argv[argv.lastIndexOf(archiveArgument) + 1]
  const archiveBytes = readFileSync(archive)
  process.stdout.write(JSON.stringify({
    ...(identity.commandId === 'rc-verify-archive' ? { verified: true } : {}),
    archive,
    archiveFormat: 'ustar',
    archiveHash: createHash('sha256').update(archiveBytes).digest('hex'),
    bytes: archiveBytes.length,
    entryCount: 1,
    sourceDateEpoch: 946684800,
  }) + '\\n')
} else {
const jsonIds = new Set([
  'frozen-evidence-guard',
  'manifest-fixtures',
  'manifest-probe',
  'runtime-equivalence',
])
if (jsonIds.has(identity.commandId)) {
  const argv = process.argv.slice(2)
  const index = argv.lastIndexOf('--output')
  const output = argv[index + 1]
  const outputPath =
    identity.mode === 'integration'
      ? resolve(import.meta.dirname, '..', '..', output)
      : output
  const statuses = {
    'frozen-evidence-guard':
      identity.mode === 'source'
        ? 'PASS_SOURCE_SCOPE'
        : 'PASS_EVIDENCE_LINEAGE',
    'manifest-fixtures': 'PASS_FIXTURES',
    'manifest-probe': 'PASS_AUTHORITY_PREFLIGHT',
    'runtime-equivalence': 'PASS_RUNTIME_EQUIVALENCE',
  }
  const bytes = Buffer.from(JSON.stringify({
    status: statuses[identity.commandId],
    phase6Identity: identity,
  }) + '\\n')
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, bytes, { flag: 'wx' })
  const label = identity.mode === 'integration' ? output : outputPath
  const hash = createHash('sha256').update(bytes).digest('hex')
  writeFileSync(outputPath + '.sha256', hash + '  ' + label + '\\n', {
    flag: 'wx',
  })
} else {
  const source =
    'process.stdout.write(JSON.stringify({' +
    'path:process.env.PATH,execPath:process.execPath,cwd:process.cwd()}))'
  const child = spawnSync('node', ['-e', source], {
    encoding: 'utf8',
    env: process.env,
  })
  if (child.status !== 0) process.exit(child.status)
  process.stdout.write(child.stdout)
}
}
`
  const scripts = Object.fromEntries(
    [
      'lint',
      'test:run',
      'build',
      'rc:build',
      'rc:verify',
      'e2e:rc',
      'rc:archive',
      'rc:verify-archive',
      'schema:fixtures',
      'guard:rc8',
      'manifest:verify',
      'runtime:equivalence',
      'rc:repro',
      'guard:frozen-evidence',
    ].map((script) => [
      script,
      `PATH=${phase6Path} ` +
        '/opt/homebrew/opt/node@24/bin/node scripts/check-playtest-fixtures.mjs',
    ]),
  )
  scripts['phase6:run'] = phase6PackageScript
  writeFileSync(fakeCommand, fakeSource)
  writeFileSync(
    packagePath,
    `${JSON.stringify({
      name: 'phase6-wrapper-fixture',
      private: true,
      type: 'module',
      scripts,
    }, null, 2)}\n`,
  )
  gitIn(
    fixture.repo,
    'add',
    'prototype/package.json',
    'prototype/scripts/check-playtest-fixtures.mjs',
  )
  gitIn(fixture.repo, 'commit', '--quiet', '-m', 'fixture npm source')
  const sourceSha = gitIn(fixture.repo, 'rev-parse', 'HEAD')
  const integrationSha = materializeIntegrationCommit(
    fixture.repo,
    sourceSha,
  )
  gitIn(fixture.repo, 'checkout', '--quiet', sourceSha)
  return { ...fixture, sourceSha, integrationSha }
}

function materializePhase6ManifestWrapper() {
  const fixture = materializePhase6Wrapper()
  const verifier = join(
    fixture.prototype,
    'scripts',
    'verify-playtest-manifest.mjs',
  )
  copyFileSync(resolve('scripts', 'verify-playtest-manifest.mjs'), verifier)
  const fixtureRoot = join(fixture.prototype, 'tests', 'fixtures')
  mkdirSync(dirname(fixtureRoot), { recursive: true })
  cpSync(resolve('tests', 'fixtures'), fixtureRoot, { recursive: true })
  gitIn(fixture.repo, 'add', 'prototype/scripts/verify-playtest-manifest.mjs', 'prototype/tests/fixtures')
  gitIn(fixture.repo, 'commit', '--quiet', '-m', 'fixture manifest source')
  const sourceSha = gitIn(fixture.repo, 'rev-parse', 'HEAD')
  const integrationSha = materializeIntegrationCommit(
    fixture.repo,
    sourceSha,
  )
  gitIn(fixture.repo, 'checkout', '--quiet', sourceSha)
  return { ...fixture, verifier, sourceSha, integrationSha }
}

function materializeMutatedPhase6Wrapper(search: string, replacement: string) {
  const fixture = materializePhase6Wrapper()
  const source = readFileSync(fixture.script, 'utf8')
  expect(source.includes(search)).toBe(true)
  writeFileSync(fixture.script, source.replace(search, replacement))
  return fixture
}

function gitIn(repo: string, ...args: string[]) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
  })
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}

function materializeIntegrationVerifierRepository(scriptPath: string) {
  const root = temporaryDirectory('new-era-integration-verifier-repo-')
  const repo = join(root, 'repo')
  const clone = spawnSync(
    'git',
    ['clone', '--quiet', '--shared', resolve('..'), repo],
    { encoding: 'utf8' },
  )
  expect(clone.status, clone.stderr).toBe(0)
  const sourceHead = currentSourceHead()
  gitIn(repo, 'checkout', '--quiet', evidenceBaseline)
  const changedPaths = gitIn(
    repo,
    'diff',
    '--name-only',
    sourceBaseline,
    sourceHead,
  ).split('\n').filter(Boolean)
  gitIn(repo, 'checkout', sourceHead, '--', ...changedPaths)
  gitIn(repo, 'config', 'user.name', 'C04 Test')
  gitIn(repo, 'config', 'user.email', 'c04-test@example.invalid')
  gitIn(repo, 'add', '--', ...changedPaths)
  gitIn(repo, 'commit', '--quiet', '-m', 'materialize C04 integration')
  const integrationSha = gitIn(repo, 'rev-parse', 'HEAD')
  const copiedScript = join(
    repo,
    'prototype',
    'scripts',
    basename(scriptPath),
  )
  copyFileSync(scriptPath, copiedScript)
  copyFileSync(
    phase6,
    join(dirname(copiedScript), 'candidate-manifest-contract.mjs'),
  )
  return {
    root,
    repo,
    script: copiedScript,
    sourceHead,
    integrationSha,
  }
}

function materializeIdentityCase(errorCode: keyof typeof identityMutations) {
  const root = temporaryDirectory('new-era-identity-production-')
  const script = join(
    root,
    'prototype',
    'scripts',
    'verify-diagnostic-isolation.mjs',
  )
  const inputPath = join(root, canonicalIdentityInput)
  const outputPath = join(root, canonicalIdentityOutput)
  mkdirSync(dirname(script), { recursive: true })
  mkdirSync(dirname(inputPath), { recursive: true })
  mkdirSync(dirname(outputPath), { recursive: true })
  copyFileSync(isolation, script)

  const input = JSON.parse(
    readFileSync(
      resolve(
        'tests',
        'fixtures',
        'isolation',
        'sample-valid.json',
      ),
      'utf8',
    ),
  )
  delete input.synthetic
  const [field, mutation] = identityMutations[errorCode]
  input.preflight[field] =
    mutation === 'hash'
      ? 'f'.repeat(64)
      : `${input.preflight[field]}-drift`
  const inputBytes = Buffer.from(
    `${JSON.stringify(input, null, 2)}\n`,
    'utf8',
  )
  const inputHash = sha256(inputBytes)
  const sidecarBytes = Buffer.from(
    `${inputHash}  diagnostic-isolation-input.json\n`,
    'utf8',
  )
  writeFileSync(inputPath, inputBytes)
  writeFileSync(`${inputPath}.sha256`, sidecarBytes)
  return {
    root,
    script,
    inputPath,
    outputPath,
    inputBytes,
    inputHash,
    sidecarBytes,
  }
}

const postSourceCommitIt = sourceImplementationCommitted() ? it : it.skip

function materializeC04Artifact(artifactGitSha: string) {
  const root = temporaryDirectory('new-era-c04-artifact-')
  const manifestPath = `${c03ArtifactRoot}/artifact-manifest.json`
  const manifestBytes = git(
    'show',
    `${evidenceBaseline}:${manifestPath}`,
  )
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  for (const entry of manifest.files) {
    const target = join(root, entry.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(
      target,
      git(
        'show',
        `${evidenceBaseline}:${c03ArtifactRoot}/${entry.path}`,
      ),
    )
  }
  writeFileSync(join(root, 'artifact-manifest.json'), manifestBytes)
  const metadata = JSON.parse(
    git(
      'show',
      `${evidenceBaseline}:${c03ArtifactRoot}/rc-build.json`,
    ).toString('utf8'),
  )
  metadata.buildId = 'g1-rc-20260729.rc9-c04'
  metadata.gitSha = artifactGitSha
  writeFileSync(
    join(root, 'rc-build.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
  )
  return root
}

describe('C04 Phase 6 Node wrapper', () => {
  it('exposes the wrapper as the only Phase 6 npm entrypoint', () => {
    const packageDocument = JSON.parse(
      readFileSync(resolve('package.json'), 'utf8'),
    )
    expect(packageDocument.scripts['phase6:run']).toBe(
      phase6PackageScript,
    )
  })

  it('exports the frozen 15-command contract with independent archive assertions', () => {
    expect(PHASE6_WRAPPER_COMMAND_IDS).toEqual([
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
    const fixture = {
      integrationSha: '1'.repeat(40),
      sourceSha: '2'.repeat(40),
    }
    const archive = '/tmp/c04-contract-archive.tar'
    const output = '/tmp/c04-contract-output.txt'
    const createIdentity = {
      commandId: 'rc-archive',
      mode: 'source',
      sourceSha: fixture.integrationSha,
      outputPath: output,
      archivePath: archive,
    }
    const verifyIdentity = {
      ...createIdentity,
      commandId: 'rc-verify-archive',
    }
    expect(expectedPhase6Argv(createIdentity)).toEqual([
      'npm',
      'run',
      'rc:archive',
      '--',
      '--input',
      'dist',
      '--output',
      archive,
      '--source-date-epoch',
      '946684800',
    ])
    expect(expectedPhase6Argv(verifyIdentity)).toEqual([
      'npm',
      'run',
      'rc:verify-archive',
      '--',
      '--input',
      'dist',
      '--archive',
      archive,
      '--source-date-epoch',
      '946684800',
    ])
  })

  it('runs the real npm entrypoint with the exact Node environment', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = phase6WrapperOutput(fixture, 'lint', 'source')
    const sentinel = join(fixture.root, 'npm-child-started.txt')
    const result = spawnSync(
      '/opt/homebrew/opt/node@24/bin/npm',
      [
        'run',
        'phase6:run',
        '--',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: sentinel,
        },
      },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(sentinel, 'utf8')).toBe('lint')
    expect(existsSync(output)).toBe(true)
  })

  it('accepts all 15 exact argv contracts within the Git child budget', () => {
    const fixture = materializePhase6NpmWrapper()
    for (const mode of ['source', 'integration']) {
      for (const commandId of PHASE6_WRAPPER_COMMAND_IDS) {
        const output = phase6WrapperOutput(
          fixture,
          commandId,
          mode,
        )
        const sentinel = join(
          fixture.root,
          `legal-${mode}-${commandId}.txt`,
        )
        const gitTrace = join(
          fixture.root,
          `git-trace-${mode}-${commandId}.jsonl`,
        )
        const result = spawnSync(
          node,
          [
            fixture.script,
            '--phase6-run',
            ...phase6WrapperArgv(
              fixture,
              commandId,
              mode,
              output,
            ),
          ],
          {
            cwd: fixture.prototype,
            encoding: 'utf8',
            env: {
              ...process.env,
              PATH: phase6Path,
              PHASE6_TEST_SENTINEL: sentinel,
              GIT_TRACE2_EVENT: gitTrace,
            },
          },
        )

        expect(
          result.status,
          `${mode}/${commandId}: ${result.stderr}`,
        ).toBe(0)
        expect(readFileSync(sentinel, 'utf8')).toBe(commandId)
        const gitChildren = readFileSync(gitTrace, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
          .filter((event) => event.event === 'start')
        expect(gitChildren.length).toBeGreaterThan(0)
        expect(
          gitChildren.length,
          `${mode}/${commandId} Git child count`,
        ).toBeLessThanOrEqual(mode === 'source' ? 16 : 24)
        const outputPath =
          mode === 'source' ? output : join(fixture.repo, output)
        expect(existsSync(outputPath)).toBe(true)
      }
    }
  }, 30_000)

  it('rejects every missing, extra, changed, reordered, or cross-mode argv before child/output', () => {
    const fixture = materializePhase6NpmWrapper()
    for (const mode of ['source', 'integration']) {
      for (const commandId of PHASE6_WRAPPER_COMMAND_IDS) {
        const output = phase6WrapperOutput(
          fixture,
          commandId,
          mode,
        )
        const exact = phase6ChildArgv(
          fixture,
          commandId,
          mode,
          output,
        )
        const changed = [...exact]
        changed[Math.floor(changed.length / 2)] = '__drift__'
        const reordered = [...exact]
        ;[reordered[0], reordered[1]] = [
          reordered[1],
          reordered[0],
        ]
        const mutations = [
          ['missing', exact.slice(0, -1)],
          ['extra', [...exact, '--unexpected']],
          ['changed', changed],
          ['reordered', reordered],
        ]
        const otherMode =
          mode === 'source' ? 'integration' : 'source'
        const crossMode = phase6ChildArgv(
          fixture,
          commandId,
          otherMode,
          phase6WrapperOutput(fixture, commandId, otherMode),
        )
        if (JSON.stringify(crossMode) !== JSON.stringify(exact)) {
          mutations.push(['cross-mode', crossMode])
        }

        for (const [mutation, argv] of mutations) {
          const sentinel = join(
            fixture.root,
            `invalid-${mode}-${commandId}-${mutation}.txt`,
          )
          const result = spawnSync(
            node,
            [
              fixture.script,
              '--phase6-run',
              ...phase6WrapperArgv(
                fixture,
                commandId,
                mode,
                output,
                argv,
              ),
            ],
            {
              cwd: fixture.prototype,
              encoding: 'utf8',
              env: {
                ...process.env,
                PATH: phase6Path,
                PHASE6_TEST_SENTINEL: sentinel,
              },
            },
          )

          expectSingleError(result, 'C04_NODE_COMMAND')
          expect(existsSync(sentinel)).toBe(false)
          const outputPath =
            mode === 'source' ? output : join(fixture.repo, output)
          expect(existsSync(outputPath)).toBe(false)
          expect(existsSync(dirname(outputPath))).toBe(false)
        }
      }
    }
  }, 60_000)

  it('rejects an ambient PATH mismatch before creating output', () => {
    const root = temporaryDirectory('new-era-phase6-node-path-')
    const output = join(root, 'missing', 'lint.txt')
    const result = spawnSync(
      node,
      [
        phase6,
        '--phase6-run',
        '--command-id',
        'lint',
        '--mode',
        'source',
        '--plan-ref',
        '441f7d96635e9176c8aea3ff21454d596c287c49',
        '--source-sha',
        '1'.repeat(40),
        '--output',
        output,
        '--',
        node,
        '--version',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: '/opt/homebrew/bin:/usr/bin:/bin',
        },
      },
    )

    expectSingleError(result, 'C04_NODE_IDENTITY')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(dirname(output))).toBe(false)
  })

  it('rejects source identity drift and Git repository redirection', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = phase6WrapperOutput(fixture, 'lint', 'source')
    const marker = join(fixture.root, 'child-started.txt')
    const args = phase6WrapperArgv(
      fixture,
      'lint',
      'source',
      output,
    )
    args[args.indexOf('--source-sha') + 1] = '1'.repeat(40)
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...args,
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_GIT_BINDING')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(dirname(output))).toBe(false)
    expect(existsSync(marker)).toBe(false)

    const redirectedFixture = materializePhase6NpmWrapper()
    const dirtyRepo = join(redirectedFixture.root, 'dirty-execution')
    const clone = spawnSync(
      'git',
      [
        'clone',
        '--quiet',
        '--no-local',
        redirectedFixture.repo,
        dirtyRepo,
      ],
      { encoding: 'utf8' },
    )
    expect(clone.status, clone.stderr).toBe(0)
    const dirtyFixture = {
      ...redirectedFixture,
      repo: dirtyRepo,
      prototype: join(dirtyRepo, 'prototype'),
      script: join(
        dirtyRepo,
        'prototype',
        'scripts',
        'candidate-manifest-contract.mjs',
      ),
    }
    const redirectedOutput = join(
      redirectedFixture.root,
      'git-environment-redirection',
      'lint.txt',
    )
    const redirectedMarker = join(
      redirectedFixture.root,
      'redirected-child-started.txt',
    )
    const redirectedArgs = phase6WrapperArgv(
      dirtyFixture,
      'lint',
      'source',
      redirectedOutput,
    )
    writeFileSync(join(dirtyRepo, 'CONTEXT.md'), 'dirty worktree\n')
    writeFileSync(
      join(dirtyRepo, 'prototype', 'untracked-input.txt'),
      'untracked input\n',
    )

    const redirectedResult = spawnSync(
      node,
      [
        dirtyFixture.script,
        '--phase6-run',
        ...redirectedArgs,
      ],
      {
        cwd: dirtyFixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          GIT_DIR: join(redirectedFixture.repo, '.git'),
          GIT_WORK_TREE: redirectedFixture.repo,
          PHASE6_TEST_SENTINEL: redirectedMarker,
        },
      },
    )

    expectSingleError(redirectedResult, 'C04_PHASE6_GIT_BINDING')
    expect(existsSync(redirectedOutput)).toBe(false)
    expect(existsSync(dirname(redirectedOutput))).toBe(false)
    expect(existsSync(redirectedMarker)).toBe(false)
  })

  it('rejects a source head that does not descend from the frozen plan_ref', () => {
    const fixture = materializePhase6NpmWrapper()
    gitIn(
      fixture.repo,
      'checkout',
      '--quiet',
      '--orphan',
      'fixture-invalid-source',
    )
    gitIn(
      fixture.repo,
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      'unrelated fixture source',
    )
    fixture.sourceSha = gitIn(fixture.repo, 'rev-parse', 'HEAD')
    const output = phase6WrapperOutput(fixture, 'lint', 'source')
    const marker = join(fixture.root, 'child-started.txt')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_GIT_BINDING')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(dirname(output))).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it('rejects a source output inside the repository before starting the child', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = join(fixture.repo, 'forbidden-output', 'lint.txt')
    const marker = join(fixture.root, 'child-started.txt')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(dirname(output))).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it('rejects a source output whose existing ancestor is a symlink', () => {
    const fixture = materializePhase6NpmWrapper()
    const target = join(fixture.root, 'output-target')
    const alias = join(fixture.root, 'output-alias')
    const output = join(alias, 'missing', 'lint.txt')
    const marker = join(fixture.root, 'child-started.txt')
    mkdirSync(target)
    symlinkSync(target, alias)
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(join(target, 'missing'))).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it('rejects a source output with a symlink above an existing ordinary parent', () => {
    const fixture = materializePhase6NpmWrapper()
    const target = join(fixture.root, 'deep-output-target')
    const alias = join(fixture.root, 'deep-output-alias')
    const ordinaryParent = join(target, 'existing')
    const output = join(alias, 'existing', 'lint.txt')
    const marker = join(fixture.root, 'child-started.txt')
    mkdirSync(ordinaryParent, { recursive: true })
    symlinkSync(target, alias)
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(join(ordinaryParent, 'lint.txt'))).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it('rejects a dirty allowlisted worktree path before starting the child', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = phase6WrapperOutput(fixture, 'lint', 'source')
    const marker = join(fixture.root, 'child-started.txt')
    writeFileSync(
      join(fixture.prototype, 'package.json'),
      `${readFileSync(join(fixture.prototype, 'package.json'), 'utf8')}\n`,
    )
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_GIT_BINDING')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(dirname(output))).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it.each([
    ['assume-unchanged', false, '--assume-unchanged', '--no-assume-unchanged'],
    ['assume-unchanged', true, '--assume-unchanged', '--no-assume-unchanged'],
    ['skip-worktree', false, '--skip-worktree', '--no-skip-worktree'],
    ['skip-worktree', true, '--skip-worktree', '--no-skip-worktree'],
  ])(
    'rejects a %s flag when tracked path dirty=%s',
    (_label, dirty, setFlag, clearFlag) => {
      const fixture = materializePhase6NpmWrapper()
      const output = phase6WrapperOutput(fixture, 'lint', 'source')
      const marker = join(fixture.root, 'child-started.txt')
      try {
        gitIn(
          fixture.repo,
          'update-index',
          setFlag,
          'prototype/package.json',
        )
        if (dirty) {
          writeFileSync(
            join(fixture.prototype, 'package.json'),
            `${readFileSync(
              join(fixture.prototype, 'package.json'),
              'utf8',
            )}\n`,
          )
        }
        const result = spawnSync(
          node,
          [
            fixture.script,
            '--phase6-run',
            ...phase6WrapperArgv(
              fixture,
              'lint',
              'source',
              output,
            ),
          ],
          {
            cwd: fixture.prototype,
            encoding: 'utf8',
            env: {
              ...process.env,
              PATH: phase6Path,
              PHASE6_TEST_SENTINEL: marker,
            },
          },
        )

        expectSingleError(result, 'C04_PHASE6_GIT_BINDING')
        expect(existsSync(output)).toBe(false)
        expect(existsSync(dirname(output))).toBe(false)
        expect(existsSync(marker)).toBe(false)
      } finally {
        gitIn(
          fixture.repo,
          'update-index',
          clearFlag,
          'prototype/package.json',
        )
        rmSync(fixture.root, { recursive: true, force: true })
      }
    },
  )

  it('accepts NUL-delimited Git records and filtered worktree bytes', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = phase6WrapperOutput(fixture, 'lint', 'source')
    const marker = join(fixture.root, 'child-started.txt')
    try {
      const control = join(fixture.repo, '.gitignore')
      const original = readFileSync(control, 'utf8')
      writeFileSync(
        join(fixture.repo, '.git', 'info', 'attributes'),
        '.gitignore text eol=crlf\n',
      )
      writeFileSync(control, original.replaceAll('\n', '\r\n'))
      gitIn(fixture.repo, 'add', '--renormalize', '.gitignore')
      gitIn(fixture.repo, 'update-index', '--refresh')

      const result = spawnSync(
        node,
        [
          fixture.script,
          '--phase6-run',
          ...phase6WrapperArgv(
            fixture,
            'lint',
            'source',
            output,
          ),
        ],
        {
          cwd: fixture.prototype,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: phase6Path,
            PHASE6_TEST_SENTINEL: marker,
          },
        },
      )

      expect(result.status, result.stderr).toBe(0)
      expect(readFileSync(marker, 'utf8')).toBe('lint')
      expect(existsSync(output)).toBe(true)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it.each([
    ['index differs from HEAD and worktree', (fixture) => {
      const control = join(fixture.repo, '.gitignore')
      const original = readFileSync(control)
      writeFileSync(control, 'index-only bytes\n')
      gitIn(fixture.repo, 'add', '.gitignore')
      writeFileSync(control, original)
    }],
    ['ordinary file becomes a symlink', (fixture) => {
      const control = join(fixture.repo, '.gitignore')
      unlinkSync(control)
      symlinkSync('.node-version', control)
    }],
    ['ordinary file executable mode changes', (fixture) => {
      chmodSync(join(fixture.repo, '.gitignore'), 0o755)
    }],
  ])(
    'rejects tracked binding when %s',
    (_label, mutate) => {
      const fixture = materializePhase6NpmWrapper()
      const output = phase6WrapperOutput(fixture, 'lint', 'source')
      const marker = join(fixture.root, 'child-started.txt')
      try {
        mutate(fixture)
        const result = spawnSync(
          node,
          [
            fixture.script,
            '--phase6-run',
            ...phase6WrapperArgv(
              fixture,
              'lint',
              'source',
              output,
            ),
          ],
          {
            cwd: fixture.prototype,
            encoding: 'utf8',
            env: {
              ...process.env,
              PATH: phase6Path,
              PHASE6_TEST_SENTINEL: marker,
            },
          },
        )

        expectSingleError(result, 'C04_PHASE6_GIT_BINDING')
        expect(existsSync(output)).toBe(false)
        expect(existsSync(dirname(output))).toBe(false)
        expect(existsSync(marker)).toBe(false)
      } finally {
        rmSync(fixture.root, { recursive: true, force: true })
      }
    },
  )

  it.each([
    ['modified worktree', (fixture) => {
      writeFileSync(
        join(fixture.repo, '.gitignore'),
        'dirty control\n',
      )
    }],
    ['staged index', (fixture) => {
      writeFileSync(
        join(fixture.repo, '.gitignore'),
        'staged control\n',
      )
      gitIn(fixture.repo, 'add', '.gitignore')
    }],
    ['tracked deletion', (fixture) => {
      unlinkSync(join(fixture.repo, '.gitignore'))
    }],
    ['tracked typechange', (fixture) => {
      const control = join(fixture.repo, '.gitignore')
      unlinkSync(control)
      symlinkSync('.node-version', control)
    }],
  ])(
    'rejects a non-allowlist tracked %s before child/output',
    (_label, mutate) => {
      const fixture = materializePhase6NpmWrapper()
      const output = phase6WrapperOutput(fixture, 'lint', 'source')
      const marker = join(fixture.root, 'child-started.txt')
      mutate(fixture)

      const result = spawnSync(
        node,
        [
          fixture.script,
          '--phase6-run',
          ...phase6WrapperArgv(
            fixture,
            'lint',
            'source',
            output,
          ),
        ],
        {
          cwd: fixture.prototype,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: phase6Path,
            PHASE6_TEST_SENTINEL: marker,
          },
        },
      )

      expectSingleError(result, 'C04_PHASE6_GIT_BINDING')
      expect(existsSync(output)).toBe(false)
      expect(existsSync(dirname(output))).toBe(false)
      expect(existsSync(marker)).toBe(false)
    },
  )

  it.each(['source', 'integration'])(
    'rejects unexpected nonignored untracked content in %s mode',
    (mode) => {
      const fixture = materializePhase6NpmWrapper()
      const output = phase6WrapperOutput(fixture, 'lint', mode)
      const outputPath =
        mode === 'source' ? output : join(fixture.repo, output)
      const marker = join(fixture.root, 'child-started.txt')
      writeFileSync(join(fixture.repo, 'unexpected.txt'), 'unexpected\n')

      const result = spawnSync(
        node,
        [
          fixture.script,
          '--phase6-run',
          ...phase6WrapperArgv(
            fixture,
            'lint',
            mode,
            output,
          ),
        ],
        {
          cwd: fixture.prototype,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: phase6Path,
            PHASE6_TEST_SENTINEL: marker,
          },
        },
      )

      expectSingleError(
        result,
        mode === 'integration'
          ? 'C04_PHASE6_PRIOR_EVIDENCE'
          : 'C04_PHASE6_GIT_BINDING',
      )
      expect(existsSync(outputPath)).toBe(false)
      expect(existsSync(dirname(outputPath))).toBe(false)
      expect(existsSync(marker)).toBe(false)
    },
  )

  it.each([
    ['future', 'build.txt'],
    ['unknown', 'unknown-command.txt'],
  ])(
    'rejects a %s retry-03 output before the current integration command',
    (_label, filename) => {
      const fixture = materializePhase6NpmWrapper()
      materializePriorIntegrationOutputs(fixture, 'test')
      const output = phase6WrapperOutput(fixture, 'test', 'integration')
      const outputPath = join(fixture.repo, output)
      const marker = join(fixture.root, 'child-started.txt')
      const unexpected = join(
        fixture.repo,
        c04Root,
        'evidence',
        'phase6-retry-03',
        filename,
      )
      writeFileSync(unexpected, 'not yet authorized\n')

      const result = spawnSync(
        node,
        [
          fixture.script,
          '--phase6-run',
          ...phase6WrapperArgv(
            fixture,
            'test',
            'integration',
            output,
          ),
        ],
        {
          cwd: fixture.prototype,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: phase6Path,
            PHASE6_TEST_SENTINEL: marker,
          },
        },
      )

      expectSingleError(result, 'C04_PHASE6_PRIOR_EVIDENCE')
      expect(existsSync(outputPath)).toBe(false)
      expect(existsSync(marker)).toBe(false)
    },
  )

  it('rejects a pre-existing current integration output before the child starts', () => {
    const fixture = materializePhase6NpmWrapper()
    materializePriorIntegrationOutputs(fixture, 'test')
    const output = phase6WrapperOutput(fixture, 'test', 'integration')
    const outputPath = join(fixture.repo, output)
    const marker = join(fixture.root, 'child-started.txt')
    const existingBytes = Buffer.from('pre-existing current output\n')
    writeFileSync(outputPath, existingBytes)

    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'test',
          'integration',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_PRIOR_EVIDENCE')
    expect(readFileSync(outputPath)).toEqual(existingBytes)
    expect(existsSync(marker)).toBe(false)
  })

  it('rejects placeholder bytes in an otherwise exact prior integration namespace', () => {
    const fixture = materializePhase6NpmWrapper()
    materializePriorIntegrationOutputs(fixture, 'test')
    writeFileSync(
      join(fixture.repo, phase6IntegrationOutput('lint')),
      'placeholder lint bytes\n',
    )
    const output = phase6WrapperOutput(fixture, 'test', 'integration')
    const outputPath = join(fixture.repo, output)
    const marker = join(fixture.root, 'child-started.txt')

    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'test',
          'integration',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_PRIOR_EVIDENCE')
    expect(existsSync(marker)).toBe(false)
    expect(existsSync(outputPath)).toBe(false)
  })

  it('accepts exact validated prior TXT records for the current integration command', () => {
    const fixture = materializePhase6NpmWrapper()
    materializePriorIntegrationOutputs(fixture, 'test')
    const output = phase6WrapperOutput(fixture, 'test', 'integration')
    const outputPath = join(fixture.repo, output)
    const marker = join(fixture.root, 'child-started.txt')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'test',
          'integration',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(marker, 'utf8')).toBe('test')
    expect(existsSync(outputPath)).toBe(true)
  })

  it.each([
    ['nonzero exit', (record) => {
      record.childExitCode = 7
    }],
    ['wrong identity', (record) => {
      record.phase6Identity.planRef = '0'.repeat(40)
    }],
    ['wrong argv', (record) => {
      record.phase6Identity.argv.push('--unexpected-tail')
    }],
    ['wrong output path', (record) => {
      record.phase6Identity.outputPath =
        phase6IntegrationOutput('build')
    }],
  ])(
    'rejects a prior TXT record with %s before child/output',
    (_label, mutate) => {
      const fixture = materializePhase6NpmWrapper()
      materializePriorIntegrationOutputs(fixture, 'test')
      const priorPath = join(
        fixture.repo,
        phase6IntegrationOutput('lint'),
      )
      const lines = readFileSync(priorPath, 'utf8').split('\n')
      const record = JSON.parse(lines[1])
      mutate(record)
      writeFileSync(
        priorPath,
        `C04_PHASE6_IDENTITY_V1\n${JSON.stringify(record)}\n`,
      )
      const output = phase6WrapperOutput(
        fixture,
        'test',
        'integration',
      )
      const outputPath = join(fixture.repo, output)
      const marker = join(fixture.root, 'child-started.txt')
      const result = spawnSync(
        node,
        [
          fixture.script,
          '--phase6-run',
          ...phase6WrapperArgv(
            fixture,
            'test',
            'integration',
            output,
          ),
        ],
        {
          cwd: fixture.prototype,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: phase6Path,
            PHASE6_TEST_SENTINEL: marker,
          },
        },
      )

      expectSingleError(result, 'C04_PHASE6_PRIOR_EVIDENCE')
      expect(existsSync(marker)).toBe(false)
      expect(existsSync(outputPath)).toBe(false)
    },
  )

  it('rejects a prior JSON record with a missing sidecar before child/output', () => {
    const fixture = materializePhase6NpmWrapper()
    materializePriorIntegrationOutputs(fixture, 'manifest-probe')
    unlinkSync(
      `${join(
        fixture.repo,
        phase6IntegrationOutput('manifest-fixtures'),
      )}.sha256`,
    )
    const output = phase6WrapperOutput(
      fixture,
      'manifest-probe',
      'integration',
    )
    const outputPath = join(fixture.repo, output)
    const marker = join(fixture.root, 'child-started.txt')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'manifest-probe',
          'integration',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_PRIOR_EVIDENCE')
    expect(existsSync(marker)).toBe(false)
    expect(existsSync(outputPath)).toBe(false)
  })

  it.each([
    'wrong status',
    'wrong identity',
    'wrong sidecar hash',
    'wrong sidecar path',
  ])(
    'rejects a prior JSON record with %s before child/output',
    (mutation) => {
      const fixture = materializePhase6NpmWrapper()
      materializePriorIntegrationOutputs(fixture, 'manifest-probe')
      const priorOutput =
        phase6IntegrationOutput('manifest-fixtures')
      const priorPath = join(fixture.repo, priorOutput)
      const document = JSON.parse(readFileSync(priorPath, 'utf8'))
      if (mutation === 'wrong status') {
        document.status = 'PASS_FIXTURES_DRIFT'
      } else if (mutation === 'wrong identity') {
        document.phase6Identity.planRef = '0'.repeat(40)
      }
      const bytes = Buffer.from(`${JSON.stringify(document)}\n`)
      writeFileSync(priorPath, bytes)
      const sidecar =
        mutation === 'wrong sidecar hash'
          ? `${'0'.repeat(64)}  ${priorOutput}\n`
          : mutation === 'wrong sidecar path'
            ? `${sha256(bytes)}  ${priorOutput}.drift\n`
            : `${sha256(bytes)}  ${priorOutput}\n`
      writeFileSync(`${priorPath}.sha256`, sidecar)

      const output = phase6WrapperOutput(
        fixture,
        'manifest-probe',
        'integration',
      )
      const outputPath = join(fixture.repo, output)
      const marker = join(fixture.root, 'child-started.txt')
      const result = spawnSync(
        node,
        [
          fixture.script,
          '--phase6-run',
          ...phase6WrapperArgv(
            fixture,
            'manifest-probe',
            'integration',
            output,
          ),
        ],
        {
          cwd: fixture.prototype,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: phase6Path,
            PHASE6_TEST_SENTINEL: marker,
          },
        },
      )

      expectSingleError(result, 'C04_PHASE6_PRIOR_EVIDENCE')
      expect(existsSync(marker)).toBe(false)
      expect(existsSync(outputPath)).toBe(false)
    },
  )

  it('rejects rc-verify-archive when it does not reuse the prior archive path', () => {
    const fixture = materializePhase6NpmWrapper()
    materializePriorIntegrationOutputs(fixture, 'rc-verify-archive')
    const output = phase6WrapperOutput(
      fixture,
      'rc-verify-archive',
      'integration',
    )
    const outputPath = join(fixture.repo, output)
    const originalArchive = phase6ArchivePath(fixture, 'integration')
    const alternateArchive = join(
      fixture.root,
      'archives',
      'integration-alternate.tar',
    )
    copyFileSync(originalArchive, alternateArchive)
    const marker = join(fixture.root, 'child-started.txt')
    const args = phase6WrapperArgv(
      fixture,
      'rc-verify-archive',
      'integration',
      output,
    ).map((entry) =>
      entry === originalArchive ? alternateArchive : entry
    )
    const result = spawnSync(
      node,
      [fixture.script, '--phase6-run', ...args],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_PRIOR_EVIDENCE')
    expect(existsSync(marker)).toBe(false)
    expect(existsSync(outputPath)).toBe(false)
  })

  it.each(['archive path', 'archive metadata'])(
    'rejects prior archive records with mismatched %s',
    (mutation) => {
      const fixture = materializePhase6NpmWrapper()
      materializePriorIntegrationOutputs(fixture, 'schema-fixtures')
      const verifyOutput =
        phase6IntegrationOutput('rc-verify-archive')
      const verifyPath = join(fixture.repo, verifyOutput)
      const lines = readFileSync(verifyPath, 'utf8').split('\n')
      const record = JSON.parse(lines[1])
      const observation = JSON.parse(
        Buffer.from(record.stdoutBase64, 'base64').toString('utf8'),
      )
      if (mutation === 'archive path') {
        const alternateArchive = join(
          fixture.root,
          'archives',
          'prior-verify-alternate.tar',
        )
        copyFileSync(record.phase6Identity.archivePath, alternateArchive)
        record.phase6Identity.archivePath = alternateArchive
        record.phase6Identity.argv = expectedPhase6Argv(
          record.phase6Identity,
        )
        observation.archive = alternateArchive
      } else {
        observation.entryCount += 1
      }
      record.stdoutBase64 = Buffer.from(
        `${JSON.stringify(observation)}\n`,
      ).toString('base64')
      writeFileSync(
        verifyPath,
        `C04_PHASE6_IDENTITY_V1\n${JSON.stringify(record)}\n`,
      )

      const output = phase6WrapperOutput(
        fixture,
        'schema-fixtures',
        'integration',
      )
      const outputPath = join(fixture.repo, output)
      const marker = join(fixture.root, 'child-started.txt')
      const result = spawnSync(
        node,
        [
          fixture.script,
          '--phase6-run',
          ...phase6WrapperArgv(
            fixture,
            'schema-fixtures',
            'integration',
            output,
          ),
        ],
        {
          cwd: fixture.prototype,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: phase6Path,
            PHASE6_TEST_SENTINEL: marker,
          },
        },
      )

      expectSingleError(result, 'C04_PHASE6_PRIOR_EVIDENCE')
      expect(existsSync(marker)).toBe(false)
      expect(existsSync(outputPath)).toBe(false)
    },
  )

  it('requires the retry-03 root to be completely absent before integration lint', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = phase6WrapperOutput(
      fixture,
      'lint',
      'integration',
    )
    const outputPath = join(fixture.repo, output)
    mkdirSync(dirname(outputPath), { recursive: true })
    const marker = join(fixture.root, 'child-started.txt')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'integration',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_PRIOR_EVIDENCE')
    expect(existsSync(marker)).toBe(false)
    expect(existsSync(outputPath)).toBe(false)
  })

  it('rejects equal source/integration allowlist entries that are not ordinary blobs', () => {
    const fixture = materializePhase6NpmWrapper()
    const path =
      'docs/exec-plans/evidence/' +
      '2026-07-29-c04-cli-compatibility-probe.json'
    const target = join(fixture.repo, path)
    unlinkSync(target)
    symlinkSync(
      '2026-07-29-c04-compatibility-amendment-review.json',
      target,
    )
    gitIn(fixture.repo, 'add', path)
    gitIn(fixture.repo, 'commit', '--quiet', '-m', 'fixture symlink source')
    fixture.sourceSha = gitIn(fixture.repo, 'rev-parse', 'HEAD')
    gitIn(
      fixture.repo,
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      'fixture symlink integration',
    )
    fixture.integrationSha = gitIn(fixture.repo, 'rev-parse', 'HEAD')
    const output = phase6WrapperOutput(fixture, 'lint', 'integration')
    const outputPath = join(fixture.repo, output)
    const marker = join(fixture.root, 'child-started.txt')

    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'integration',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_GIT_BINDING')
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it('rejects integration when an allowlisted blob differs from source', () => {
    const fixture = materializePhase6NpmWrapper()
    const packagePath = join(fixture.prototype, 'package.json')
    writeFileSync(
      packagePath,
      `${readFileSync(packagePath, 'utf8')}\n`,
    )
    gitIn(fixture.repo, 'add', 'prototype/package.json')
    gitIn(
      fixture.repo,
      'commit',
      '--quiet',
      '-m',
      'fixture integration blob drift',
    )
    fixture.integrationSha = gitIn(fixture.repo, 'rev-parse', 'HEAD')
    const output = phase6WrapperOutput(
      fixture,
      'lint',
      'integration',
    )
    const outputPath = join(fixture.repo, output)
    const marker = join(fixture.root, 'child-started.txt')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'integration',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_GIT_BINDING')
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(dirname(outputPath))).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it.each([
    ["const PHASE6_NODE_VERSION = 'v24.18.0'", "const PHASE6_NODE_VERSION = 'v24.18.1'"],
    [
      "'72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f'",
      `'${'f'.repeat(64)}'`,
    ],
    [
      "'/opt/homebrew/Cellar/node@24/24.18.0/bin/node'",
      "'/bin/sh'",
    ],
  ])(
    'rejects a frozen Node identity mismatch before output creation',
    (search, replacement) => {
      const fixture = materializeMutatedPhase6Wrapper(search, replacement)
      const output = join(fixture.root, 'missing', 'lint.txt')
      const result = spawnSync(
        node,
        [
          fixture.script,
          '--phase6-run',
          '--command-id',
          'lint',
          '--mode',
          'source',
          '--plan-ref',
          '441f7d96635e9176c8aea3ff21454d596c287c49',
          '--source-sha',
          '1'.repeat(40),
          '--output',
          output,
          '--',
          'node',
          '--version',
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH:
              '/opt/homebrew/opt/node@24/bin:' +
              '/opt/homebrew/bin:/usr/bin:/bin',
          },
        },
      )

      expectSingleError(result, 'C04_NODE_IDENTITY')
      expect(existsSync(output)).toBe(false)
      expect(existsSync(dirname(output))).toBe(false)
    },
  )

  it('passes the fixed Node environment to a text child without exposing the reserved identity', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = join(fixture.root, 'missing', 'lint.txt')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_REQUIRE_IDENTITY_ABSENT: '1',
        },
      },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toBe('')
    const lines = readFileSync(output, 'utf8').split('\n')
    expect(lines[0]).toBe('C04_PHASE6_IDENTITY_V1')
    const record = JSON.parse(lines[1])
    expect(record).toMatchObject({
      schemaVersion: 'c04-phase6-text-record-v1',
      childExitCode: 0,
    })
    expect(record.phase6Identity).toEqual({
      schemaVersion: 'c04-phase6-command-identity-v1',
      commandId: 'lint',
      mode: 'source',
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
      outputPath: output,
      argv: ['npm', 'run', 'lint'],
      planRef: '441f7d96635e9176c8aea3ff21454d596c287c49',
      sourceSha: fixture.sourceSha,
    })
    expect(parseLastJson(
      Buffer.from(record.stdoutBase64, 'base64').toString('utf8'),
    )).toEqual({
      path:
        '/opt/homebrew/opt/node@24/bin:' +
        '/opt/homebrew/bin:/usr/bin:/bin',
      execPath: '/opt/homebrew/Cellar/node@24/24.18.0/bin/node',
      cwd: fixture.prototype,
    })
    expect(record.stderrBase64).toBe('')
  })

  it('preserves the fixed Node identity through a nested child process', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = join(fixture.root, 'nested', 'rc-repro.txt')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'rc-repro',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
        },
      },
    )

    expect(result.status, result.stderr).toBe(0)
    const record = JSON.parse(
      readFileSync(output, 'utf8').split('\n')[1],
    )
    expect(parseLastJson(
      Buffer.from(record.stdoutBase64, 'base64').toString('utf8'),
    )).toEqual({
      path:
        '/opt/homebrew/opt/node@24/bin:' +
        '/opt/homebrew/bin:/usr/bin:/bin',
      execPath: '/opt/homebrew/Cellar/node@24/24.18.0/bin/node',
      cwd: fixture.prototype,
    })
  })

  it('records the actual nonzero child exit and returns it unchanged', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = join(fixture.root, 'nonzero', 'lint.txt')
    const marker = join(fixture.root, 'child-started.txt')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
          PHASE6_TEST_EXIT_CODE: '17',
        },
      },
    )

    expect(result.status).toBe(17)
    expect(result.stdout).toBe('')
    expect(readFileSync(marker, 'utf8')).toBe('lint')
    const lines = readFileSync(output, 'utf8').split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('C04_PHASE6_IDENTITY_V1')
    const record = JSON.parse(lines[1])
    expect(record.childExitCode).toBe(17)
    expect(
      Buffer.from(record.stderrBase64, 'base64').toString('utf8'),
    ).toContain('forced child failure')
  })

  it('rejects an existing output before starting the child', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = join(fixture.root, 'lint.txt')
    const marker = join(fixture.root, 'child-started.txt')
    const sentinel = Buffer.from('phase6-sentinel\n')
    writeFileSync(output, sentinel)
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_OUTPUT_EXISTS')
    expect(readFileSync(output)).toEqual(sentinel)
    expect(existsSync(marker)).toBe(false)
  })

  it('rejects a repository-internal archive path before starting the child', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = phase6WrapperOutput(
      fixture,
      'rc-archive',
      'source',
    )
    const originalArchive = phase6ArchivePath(fixture, 'source')
    const archive = join(fixture.repo, 'forbidden-archive.tar')
    const marker = join(fixture.root, 'child-started.txt')
    const args = phase6WrapperArgv(
      fixture,
      'rc-archive',
      'source',
      output,
    ).map((entry) => entry === originalArchive ? archive : entry)
    const result = spawnSync(
      node,
      [fixture.script, '--phase6-run', ...args],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_ARCHIVE_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(archive)).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it('rejects an archive path whose existing ancestor is a symlink', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = phase6WrapperOutput(
      fixture,
      'rc-archive',
      'source',
    )
    const target = join(fixture.root, 'archive-target')
    const alias = join(fixture.root, 'archive-alias')
    const archive = join(alias, 'missing', 'rc-dist.tar')
    const originalArchive = phase6ArchivePath(fixture, 'source')
    const marker = join(fixture.root, 'child-started.txt')
    mkdirSync(target)
    symlinkSync(target, alias)
    const args = phase6WrapperArgv(
      fixture,
      'rc-archive',
      'source',
      output,
    ).map((entry) => entry === originalArchive ? archive : entry)
    const result = spawnSync(
      node,
      [fixture.script, '--phase6-run', ...args],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_ARCHIVE_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(join(target, 'missing'))).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it('rejects an archive with a symlink above an existing ordinary parent', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = phase6WrapperOutput(
      fixture,
      'rc-archive',
      'source',
    )
    const target = join(fixture.root, 'deep-archive-target')
    const alias = join(fixture.root, 'deep-archive-alias')
    const ordinaryParent = join(target, 'existing')
    const archive = join(alias, 'existing', 'rc-dist.tar')
    const originalArchive = phase6ArchivePath(fixture, 'source')
    const marker = join(fixture.root, 'child-started.txt')
    mkdirSync(ordinaryParent, { recursive: true })
    symlinkSync(target, alias)
    const args = phase6WrapperArgv(
      fixture,
      'rc-archive',
      'source',
      output,
    ).map((entry) => entry === originalArchive ? archive : entry)
    const result = spawnSync(
      node,
      [fixture.script, '--phase6-run', ...args],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_ARCHIVE_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(join(ordinaryParent, 'rc-dist.tar'))).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it('runs rc-archive then rc-verify-archive against the same created archive', () => {
    const fixture = materializePhase6NpmWrapper()
    const archive = phase6ArchivePath(fixture, 'source')
    const createOutput = phase6WrapperOutput(
      fixture,
      'rc-archive',
      'source',
    )
    const verifyOutput = phase6WrapperOutput(
      fixture,
      'rc-verify-archive',
      'source',
    )
    const createMarker = join(fixture.root, 'archive-child-started.txt')
    const verifyMarker = join(fixture.root, 'verify-child-started.txt')
    const create = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'rc-archive',
          'source',
          createOutput,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: createMarker,
        },
      },
    )
    expect(create.status, create.stderr).toBe(0)
    expect(lstatSync(archive).isFile()).toBe(true)
    expect(readFileSync(createMarker, 'utf8')).toBe('rc-archive')

    const verify = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'rc-verify-archive',
          'source',
          verifyOutput,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: verifyMarker,
        },
      },
    )

    expect(verify.status, verify.stderr).toBe(0)
    expect(readFileSync(verifyMarker, 'utf8')).toBe(
      'rc-verify-archive',
    )
    expect(existsSync(createOutput)).toBe(true)
    expect(existsSync(verifyOutput)).toBe(true)
  })

  it('rejects rc-archive when its create-new archive already exists', () => {
    const fixture = materializePhase6NpmWrapper()
    const output = phase6WrapperOutput(
      fixture,
      'rc-archive',
      'source',
    )
    const archive = phase6ArchivePath(fixture, 'source')
    const marker = join(fixture.root, 'child-started.txt')
    mkdirSync(dirname(archive), { recursive: true })
    writeFileSync(archive, 'existing archive\n')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'rc-archive',
          'source',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          PHASE6_TEST_SENTINEL: marker,
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_ARCHIVE_EXISTS')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })

  it.each([
    ['missing', 'C04_PHASE6_ARCHIVE_MISSING'],
    ['directory', 'C04_PHASE6_ARCHIVE_TYPE'],
    ['symlink', 'C04_PHASE6_ARCHIVE_TYPE'],
  ])(
    'rejects a %s rc-verify-archive input before starting the child',
    (archiveKind, errorCode) => {
      const fixture = materializePhase6NpmWrapper()
      const output = phase6WrapperOutput(
        fixture,
        'rc-verify-archive',
        'source',
      )
      const archive = phase6ArchivePath(fixture, 'source')
      const marker = join(fixture.root, 'child-started.txt')
      if (archiveKind === 'directory') {
        mkdirSync(archive, { recursive: true })
      } else if (archiveKind === 'symlink') {
        const target = join(fixture.root, 'archive-target.tar')
        mkdirSync(dirname(archive), { recursive: true })
        writeFileSync(target, 'archive target\n')
        symlinkSync(target, archive)
      }
      const result = spawnSync(
        node,
        [
          fixture.script,
          '--phase6-run',
          ...phase6WrapperArgv(
            fixture,
            'rc-verify-archive',
            'source',
            output,
          ),
        ],
        {
          cwd: fixture.prototype,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: phase6Path,
            PHASE6_TEST_SENTINEL: marker,
          },
        },
      )

      expectSingleError(result, errorCode)
      expect(existsSync(output)).toBe(false)
      expect(existsSync(dirname(output))).toBe(false)
      expect(existsSync(marker)).toBe(false)
    },
  )

  it.each(['rc-archive', 'rc-verify-archive'])(
    'rejects %s metadata that differs from the child argv',
    (commandId) => {
      const fixture = materializePhase6NpmWrapper()
      const output = phase6WrapperOutput(
        fixture,
        commandId,
        'source',
      )
      const marker = join(fixture.root, 'child-started.txt')
      const args = phase6WrapperArgv(
        fixture,
        commandId,
        'source',
        output,
      )
      args[args.indexOf('--archive-path') + 1] =
        join(fixture.root, 'archives', 'metadata-only.tar')
      const result = spawnSync(
        node,
        [fixture.script, '--phase6-run', ...args],
        {
          cwd: fixture.prototype,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: phase6Path,
            PHASE6_TEST_SENTINEL: marker,
          },
        },
      )

      expectSingleError(result, 'C04_NODE_COMMAND')
      expect(existsSync(output)).toBe(false)
      expect(existsSync(dirname(output))).toBe(false)
      expect(existsSync(marker)).toBe(false)
    },
  )

  it('binds integration output to retry-03 from a non-repo cwd', () => {
    const fixture = materializePhase6NpmWrapper()
    const output =
      `${c04Root}/evidence/phase6-retry-03/` +
      'lint.txt'
    const outputPath = join(fixture.repo, output)
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'lint',
          'integration',
          output,
        ),
      ],
      {
        cwd: fixture.root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
        },
      },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(outputPath)).toBe(true)
    expect(existsSync(join(fixture.root, output))).toBe(false)
    const record = JSON.parse(
      readFileSync(outputPath, 'utf8').split('\n')[1],
    )
    const identity = record.phase6Identity
    expect(identity).toMatchObject({
      commandId: 'lint',
      mode: 'integration',
      planRef: '441f7d96635e9176c8aea3ff21454d596c287c49',
      integrationSha: fixture.integrationSha,
      artifactSourceSha: fixture.sourceSha,
      argv: ['npm', 'run', 'lint'],
    })
    expect(identity).not.toHaveProperty('sourceSha')
    expect(parseLastJson(
      Buffer.from(record.stdoutBase64, 'base64').toString('utf8'),
    ).cwd).toBe(fixture.prototype)
  })

  it.each(['phase6-retry-01', 'phase6-retry-02'])(
    'rejects the unallocated integration namespace %s before creating it',
    (namespace) => {
      const fixture = materializePhase6Wrapper()
      const output =
        `${c04Root}/evidence/${namespace}/` +
        'lint.txt'
      const outputPath = join(fixture.repo, output)
      const result = spawnSync(
        node,
        [
          fixture.script,
          '--phase6-run',
          '--command-id',
          'lint',
          '--mode',
          'integration',
          '--plan-ref',
          '441f7d96635e9176c8aea3ff21454d596c287c49',
          '--integration-sha',
          fixture.integrationSha,
          '--artifact-source-sha',
          fixture.sourceSha,
          '--output',
          output,
          '--',
          'node',
          '--version',
        ],
        {
          cwd: fixture.root,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH:
              '/opt/homebrew/opt/node@24/bin:' +
              '/opt/homebrew/bin:/usr/bin:/bin',
          },
        },
      )

      expectSingleError(result, 'C04_PHASE6_OUTPUT_PATH')
      expect(existsSync(outputPath)).toBe(false)
      expect(existsSync(dirname(outputPath))).toBe(false)
    },
  )

  it('publishes a verifier JSON pair with the same Phase 6 identity', () => {
    const fixture = materializePhase6ManifestWrapper()
    materializePriorIntegrationOutputs(fixture, 'manifest-fixtures')
    const output =
      `${c04Root}/evidence/phase6-retry-03/` +
      'manifest-fixtures.json'
    const outputPath = join(fixture.repo, output)
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--phase6-run',
        ...phase6WrapperArgv(
          fixture,
          'manifest-fixtures',
          'integration',
          output,
        ),
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH:
            '/opt/homebrew/opt/node@24/bin:' +
            '/opt/homebrew/bin:/usr/bin:/bin',
        },
      },
    )

    expect(result.status, result.stderr).toBe(0)
    const document = JSON.parse(readFileSync(outputPath, 'utf8'))
    expect(document.phase6Identity).toMatchObject({
      commandId: 'manifest-fixtures',
      mode: 'integration',
      integrationSha: fixture.integrationSha,
      artifactSourceSha: fixture.sourceSha,
      argv: [
        'npm',
        'run',
        'manifest:verify',
        '--',
        '--fixtures',
        '--output',
        output,
      ],
    })
    expectExactSidecar(outputPath, output)
  })
})

describe('C04 reserved Phase 6 direct CLI identity', () => {
  it('rejects a reserved manifest fixtures output without identity before creating its parent', () => {
    const fixture = materializePhase6ManifestWrapper()
    const output = phase6IntegrationOutput('manifest-fixtures')
    const outputPath = join(fixture.repo, output)
    const result = spawnSync(
      node,
      [
        fixture.verifier,
        '--fixtures',
        '--output',
        output,
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: { ...process.env, PATH: phase6Path },
      },
    )

    expectSingleError(result, 'C04_PHASE6_IDENTITY')
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(dirname(outputPath))).toBe(false)
  })

  it('rejects a reserved manifest output with the wrong integration identity before creating its parent', () => {
    const fixture = materializePhase6ManifestWrapper()
    const output = phase6IntegrationOutput('manifest-fixtures')
    const outputPath = join(fixture.repo, output)
    const identity = phase6IntegrationIdentity(
      fixture,
      'manifest-fixtures',
      output,
    )
    identity.integrationSha = '0'.repeat(40)
    identity.argv = expectedPhase6Argv(identity)
    const result = spawnSync(
      node,
      [
        fixture.verifier,
        '--fixtures',
        '--output',
        output,
      ],
      {
        cwd: fixture.prototype,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: phase6Path,
          C04_PHASE6_IDENTITY_V1: JSON.stringify(identity),
        },
      },
    )

    expectSingleError(result, 'C04_PHASE6_IDENTITY')
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(dirname(outputPath))).toBe(false)
  })

  it('rejects a reserved frozen-evidence output without identity before creating its parent', () => {
    const fixture = materializeIntegrationVerifierRepository(frozen)
    const output = phase6IntegrationOutput('frozen-evidence-guard')
    const outputPath = join(fixture.repo, output)
    const result = run(
      fixture.script,
      [
        '--mode',
        'evidence-lineage',
        '--baseline',
        evidenceBaseline,
        '--head',
        fixture.integrationSha,
        '--output',
        output,
      ],
      join(fixture.repo, 'prototype'),
    )

    expectSingleError(result, 'C04_PHASE6_IDENTITY')
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(dirname(outputPath))).toBe(false)
  })

  it('rejects a reserved runtime-equivalence output without identity before creating its parent', () => {
    const fixture = materializeIntegrationVerifierRepository(runtime)
    const output = phase6IntegrationOutput('runtime-equivalence')
    const outputPath = join(fixture.repo, output)
    const result = run(
      fixture.script,
      [
        '--baseline',
        sourceBaseline,
        '--head',
        fixture.integrationSha,
        '--artifact-git-sha',
        fixture.sourceHead,
        '--output',
        output,
      ],
      join(fixture.repo, 'prototype'),
    )

    expectSingleError(result, 'C04_PHASE6_IDENTITY')
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(dirname(outputPath))).toBe(false)
  })
})

describe('C04 diagnostic-isolation production CLI', () => {
  it('validates both raw goldens and mechanically executes all 31 cases', () => {
    const result = run(isolation, ['--fixtures'])
    expect(result.status, result.stderr).toBe(0)
    expect(parseLastJson(result.stdout)).toMatchObject({
      accepted: true,
      status: 'PASS_DIAGNOSTIC_ISOLATION_FIXTURES',
      summary: {
        requiredNegativeCases: 31,
        executedNegativeCases: 31,
        uniqueNegativeCases: 31,
        toolInvocationCount: 0,
      },
    })
  })

  it.each(Object.entries(negativeCases))(
    '%s is an independent production subprocess with exact fail-closed output',
    (fixtureId, errorCode) => {
      const root = temporaryDirectory(`new-era-isolation-${fixtureId}-`)
      const freshOutput = join(root, 'fresh.json')
      const result = run(isolation, [
        '--fixture-case',
        fixtureId,
        '--output',
        freshOutput,
      ])
      const document = expectSingleError(result, errorCode)
      expect(document.summary.canonicalInputRehashed).toBe(true)
      expect(existsSync(freshOutput)).toBe(false)
      expect(existsSync(`${freshOutput}.sha256`)).toBe(false)
      if (fixtureId === 'U01') {
        expect(document.summary.toolInvocationCount).toBe(0)
      }

      const sentinel = join(root, 'sentinel.json')
      const sentinelBytes = Buffer.from(`sentinel-${fixtureId}\n`)
      writeFileSync(sentinel, sentinelBytes)
      const before = sha256(readFileSync(sentinel))
      const sentinelRun = run(isolation, [
        '--fixture-case',
        fixtureId,
        '--output',
        sentinel,
      ])
      expectSingleError(sentinelRun, errorCode)
      expect(sha256(readFileSync(sentinel))).toBe(before)
      expect(readFileSync(sentinel)).toEqual(sentinelBytes)
      expect(existsSync(`${sentinel}.sha256`)).toBe(false)
    },
  )

  it.each(identityCases)(
    '%s is rejected through the normal canonical --input path',
    (errorCode) => {
      const fixture = materializeIdentityCase(errorCode)
      const result = run(fixture.script, [
        '--input',
        fixture.inputPath,
        '--output',
        fixture.outputPath,
      ])
      const document = expectSingleError(result, errorCode)
      expect(document.summary.canonicalInputRehashed).toBe(true)
      expect(document.summary.canonicalInputHash).toBe(fixture.inputHash)
      expect(document.summary.toolInvocationCount).toBe(0)
      expect(readFileSync(fixture.inputPath)).toEqual(fixture.inputBytes)
      expect(readFileSync(`${fixture.inputPath}.sha256`)).toEqual(
        fixture.sidecarBytes,
      )
      expect(existsSync(fixture.outputPath)).toBe(false)
      expect(existsSync(`${fixture.outputPath}.sha256`)).toBe(false)

      const sentinelBytes = Buffer.from(`sentinel-${errorCode}\n`)
      const sentinelSidecarBytes = Buffer.from(
        `sentinel-sidecar-${errorCode}\n`,
      )
      writeFileSync(fixture.outputPath, sentinelBytes)
      writeFileSync(
        `${fixture.outputPath}.sha256`,
        sentinelSidecarBytes,
      )
      const before = sha256(readFileSync(fixture.outputPath))
      const sidecarBefore = sha256(
        readFileSync(`${fixture.outputPath}.sha256`),
      )
      const sentinelRun = run(fixture.script, [
        '--input',
        fixture.inputPath,
        '--output',
        fixture.outputPath,
      ])
      expectSingleError(
        sentinelRun,
        'DIAGNOSTIC_ISOLATION_OUTPUT_EXISTS',
      )
      expect(sha256(readFileSync(fixture.outputPath))).toBe(before)
      expect(
        sha256(readFileSync(`${fixture.outputPath}.sha256`)),
      ).toBe(sidecarBefore)
      expect(readFileSync(fixture.outputPath)).toEqual(sentinelBytes)
      expect(readFileSync(`${fixture.outputPath}.sha256`)).toEqual(
        sentinelSidecarBytes,
      )
    },
  )

  it('does not expose an identity self-test or hidden bypass mode', () => {
    const result = run(isolation, [
      '--identity-case',
      'C04_CLI_VERSION',
    ])
    expectSingleError(result, 'DIAGNOSTIC_ISOLATION_CLI')
  })

  it('rejects an input symlink and leaves a fresh output absent', () => {
    const root = temporaryDirectory('new-era-isolation-input-link-')
    const target = join(root, 'target.json')
    const input = join(root, 'input.json')
    const output = join(root, 'output.json')
    writeFileSync(target, '{}\n')
    symlinkSync(target, input)
    const result = run(isolation, [
      '--input',
      input,
      '--output',
      output,
    ])
    expectSingleError(result, 'DIAGNOSTIC_ISOLATION_INPUT_READ')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('rejects an output ancestor symlink into old C04 evidence', () => {
    const fixture = materializeVerifierRepository(isolation)
    const input = join(fixture.root, 'input.json')
    const oldEvidence = join(fixture.repo, c04Root, 'evidence', 'phase6')
    const targetParent = join(oldEvidence, 'ancestor-link-target')
    const alias = join(fixture.root, 'phase6-alias')
    const output = join(
      alias,
      'ancestor-link-target',
      'diagnostic-isolation.json',
    )
    writeFileSync(input, '{}\n')
    mkdirSync(targetParent, { recursive: true })
    symlinkSync(oldEvidence, alias)

    const result = run(fixture.script, [
      '--input',
      input,
      '--output',
      output,
    ])

    expectSingleError(result, 'DIAGNOSTIC_ISOLATION_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('rejects an arbitrary fresh repo-internal output namespace', () => {
    const fixture = materializeVerifierRepository(isolation)
    const input = join(fixture.root, 'input.json')
    const output = join(
      fixture.repo,
      'fresh-diagnostic-output',
      'diagnostic-isolation.json',
    )
    writeFileSync(input, '{}\n')
    mkdirSync(dirname(output), { recursive: true })

    const result = run(fixture.script, [
      '--input',
      input,
      '--output',
      output,
    ])

    expectSingleError(result, 'DIAGNOSTIC_ISOLATION_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('maps a non-directory diagnostic output ancestor to the output-path error', () => {
    const fixture = materializeVerifierRepository(isolation)
    const input = join(fixture.root, 'input.json')
    const ancestor = join(fixture.root, 'ancestor-file')
    const output = join(ancestor, 'diagnostic.json')
    writeFileSync(input, '{}\n')
    writeFileSync(ancestor, 'not-a-directory\n')
    const result = run(fixture.script, [
      '--input',
      input,
      '--output',
      output,
    ])

    expectSingleError(result, 'DIAGNOSTIC_ISOLATION_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('rejects a relative diagnostic output escape', () => {
    const fixture = materializeVerifierRepository(isolation)
    const input = join(fixture.root, 'input.json')
    const output = '../external-diagnostic.json'
    const resolvedOutput = resolve(fixture.repo, output)
    writeFileSync(input, '{}\n')
    const result = run(fixture.script, [
      '--input',
      input,
      '--output',
      output,
    ])

    expectSingleError(result, 'DIAGNOSTIC_ISOLATION_OUTPUT_PATH')
    expect(existsSync(resolvedOutput)).toBe(false)
    expect(existsSync(`${resolvedOutput}.sha256`)).toBe(false)
  })

  it('rejects zero-valued diagnostic review and seal namespaces', () => {
    const fixture = materializeVerifierRepository(isolation)
    const input = join(fixture.root, 'input.json')
    writeFileSync(input, '{}\n')
    for (const output of [
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/evidence/reviews/IR0/verifiers/' +
        'diagnostic-isolation-aggregate.json',
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/evidence/reviews/IR00/verifiers/' +
        'diagnostic-isolation-aggregate.json',
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/seals/S0/verifiers/' +
        'diagnostic-isolation-aggregate.json',
    ]) {
      const outputPath = join(fixture.repo, output)
      mkdirSync(dirname(outputPath), { recursive: true })
      const result = run(fixture.script, [
        '--input',
        input,
        '--output',
        output,
      ])

      expectSingleError(result, 'DIAGNOSTIC_ISOLATION_OUTPUT_PATH')
      expect(existsSync(outputPath)).toBe(false)
      expect(existsSync(`${outputPath}.sha256`)).toBe(false)
    }
  })

  it('allows IR01 and S01 aggregate namespaces past output validation', () => {
    const fixture = materializeVerifierRepository(isolation)
    const input = join(fixture.root, 'input.json')
    writeFileSync(input, '{}\n')
    for (const output of [
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/evidence/reviews/IR01/verifiers/' +
        'diagnostic-isolation-aggregate.json',
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/seals/S01/verifiers/' +
        'diagnostic-isolation-aggregate.json',
    ]) {
      const outputPath = join(fixture.repo, output)
      mkdirSync(dirname(outputPath), { recursive: true })
      const result = run(fixture.script, [
        '--input',
        input,
        '--output',
        output,
      ])

      expectSingleError(result, 'DIAGNOSTIC_ISOLATION_SHAPE')
      expect(existsSync(outputPath)).toBe(false)
      expect(existsSync(`${outputPath}.sha256`)).toBe(false)
    }
  })

  it('resolves a repo-relative canonical output from prototype cwd', () => {
    const fixture = materializeIdentityCase('C04_CLI_VERSION')
    const result = spawnSync(
      node,
      [
        fixture.script,
        '--input',
        fixture.inputPath,
        '--output',
        canonicalIdentityOutput,
      ],
      {
        cwd: join(fixture.root, 'prototype'),
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH:
            '/opt/homebrew/opt/node@24/bin:' +
            '/opt/homebrew/bin:/usr/bin:/bin',
        },
      },
    )

    expectSingleError(result, 'C04_CLI_VERSION')
    expect(existsSync(fixture.outputPath)).toBe(false)
    expect(existsSync(`${fixture.outputPath}.sha256`)).toBe(false)
  })

  it('rejects a complete canonical sample output group before opening a missing input', () => {
    const fixture = materializeVerifierRepository(isolation)
    const input = join(fixture.repo, canonicalIdentityInput)
    const output = join(fixture.repo, canonicalIdentityOutput)
    const outputBytes = Buffer.from('{"sentinel":"sample-output"}\n')
    const sidecarBytes = Buffer.from(
      `${sha256(outputBytes)}  ${canonicalIdentityOutput}\n`,
    )
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, outputBytes, { mode: 0o640 })
    writeFileSync(`${output}.sha256`, sidecarBytes, { mode: 0o600 })
    const outputMode = lstatSync(output).mode
    const sidecarMode = lstatSync(`${output}.sha256`).mode

    const result = run(fixture.script, [
      '--input',
      input,
      '--output',
      output,
    ])

    expectSingleError(
      result,
      'DIAGNOSTIC_ISOLATION_OUTPUT_EXISTS',
    )
    expect(readFileSync(output)).toEqual(outputBytes)
    expect(readFileSync(`${output}.sha256`)).toEqual(sidecarBytes)
    expect(lstatSync(output).mode).toBe(outputMode)
    expect(lstatSync(`${output}.sha256`).mode).toBe(sidecarMode)
  })

  it('rejects a complete canonical aggregate output group before parsing an invalid input', () => {
    const fixture = materializeVerifierRepository(isolation)
    const input = join(fixture.root, 'invalid-aggregate-input.json')
    const output = join(fixture.repo, canonicalAggregateOutput)
    const outputBytes = Buffer.from('{"sentinel":"aggregate-output"}\n')
    const sidecarBytes = Buffer.from(
      `${sha256(outputBytes)}  ${canonicalAggregateOutput}\n`,
    )
    writeFileSync(input, 'not-json\n')
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, outputBytes, { mode: 0o640 })
    writeFileSync(`${output}.sha256`, sidecarBytes, { mode: 0o600 })
    const outputMode = lstatSync(output).mode
    const sidecarMode = lstatSync(`${output}.sha256`).mode

    const result = run(fixture.script, [
      '--input',
      input,
      '--output',
      output,
    ])

    expectSingleError(
      result,
      'DIAGNOSTIC_ISOLATION_OUTPUT_EXISTS',
    )
    expect(readFileSync(output)).toEqual(outputBytes)
    expect(readFileSync(`${output}.sha256`)).toEqual(sidecarBytes)
    expect(lstatSync(output).mode).toBe(outputMode)
    expect(lstatSync(`${output}.sha256`).mode).toBe(sidecarMode)
  })

  it('rejects partial and complete output groups without clobbering bytes', () => {
    const root = temporaryDirectory('new-era-isolation-output-')
    const input = join(root, 'input.json')
    const output = join(root, 'output.json')
    writeFileSync(input, '{}\n')
    writeFileSync(output, 'sentinel\n')
    const partial = run(isolation, [
      '--input',
      input,
      '--output',
      output,
    ])
    expectSingleError(partial, 'PARTIAL_EVIDENCE_GROUP')
    expect(readFileSync(output, 'utf8')).toBe('sentinel\n')

    writeFileSync(`${output}.sha256`, 'sidecar-sentinel\n')
    const complete = run(isolation, [
      '--input',
      input,
      '--output',
      output,
    ])
    expectSingleError(
      complete,
      'DIAGNOSTIC_ISOLATION_OUTPUT_EXISTS',
    )
    expect(readFileSync(output, 'utf8')).toBe('sentinel\n')
    expect(readFileSync(`${output}.sha256`, 'utf8')).toBe(
      'sidecar-sentinel\n',
    )
  })
})

describe('C04 frozen-evidence production CLI', () => {
  postSourceCommitIt(
    'accepts the exact source or integration argv and publishes a no-clobber pair',
    () => {
    const root = temporaryDirectory('new-era-frozen-pass-')
    const output = join(root, 'guard.json')
    const context = sourceVerificationContext()
    const args = [
      '--mode',
      context.mode,
      '--baseline',
      context.baseline,
      '--head',
      context.head,
      '--output',
      output,
    ]
    const result = run(frozen, args)
    expect(result.status, result.stderr).toBe(0)
    expect(parseLastJson(result.stdout)).toMatchObject({
      status: context.expectedStatus,
      errorCode: null,
      commandArgv: args,
    })
    expect(existsSync(output)).toBe(true)
    expectExactSidecar(output)

    const repeated = run(frozen, args)
    expectSingleError(repeated, 'FROZEN_EVIDENCE_OUTPUT_EXISTS')
    },
  )

  it('rejects output symlink state without changing its target', () => {
    const root = temporaryDirectory('new-era-frozen-link-')
    const target = join(root, 'target.json')
    const output = join(root, 'guard.json')
    writeFileSync(target, 'sentinel\n')
    symlinkSync(target, output)
    const result = run(frozen, [
      '--mode',
      'source',
      '--baseline',
      sourceBaseline,
      '--head',
      currentHead(),
      '--output',
      output,
    ])
    expectSingleError(result, 'PARTIAL_EVIDENCE_GROUP')
    expect(readFileSync(target, 'utf8')).toBe('sentinel\n')
  })

  it('rejects an output ancestor symlink into old C04 evidence', () => {
    const fixture = materializeVerifierRepository(frozen)
    const oldEvidence = join(fixture.repo, c04Root, 'evidence', 'phase6')
    const targetParent = join(oldEvidence, 'ancestor-link-target')
    const alias = join(fixture.root, 'phase6-alias')
    const output = join(
      alias,
      'ancestor-link-target',
      'frozen-evidence-guard.json',
    )
    mkdirSync(targetParent, { recursive: true })
    symlinkSync(oldEvidence, alias)

    const result = run(fixture.script, [
      '--mode',
      'source',
      '--baseline',
      sourceBaseline,
      '--head',
      currentHead(),
      '--output',
      output,
    ])

    expectSingleError(result, 'FROZEN_EVIDENCE_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('preserves a truly external absolute temp output', () => {
    const fixture = materializeVerifierRepository(frozen)
    const output = join(fixture.root, 'external', 'guard.json')
    mkdirSync(dirname(output), { recursive: true })
    const result = run(fixture.script, [
      '--mode',
      'source',
      '--baseline',
      sourceBaseline,
      '--head',
      currentHead(),
      '--output',
      output,
    ])

    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(output)).toBe(true)
    expectExactSidecar(output)
  })

  it('rejects an evidence-lineage guard bound to an external output', () => {
    const fixture = materializeIntegrationVerifierRepository(frozen)
    const output = join(fixture.root, 'external', 'guard.json')
    mkdirSync(dirname(output), { recursive: true })
    const result = run(fixture.script, [
      '--mode',
      'evidence-lineage',
      '--baseline',
      evidenceBaseline,
      '--head',
      fixture.integrationSha,
      '--output',
      output,
    ])

    expectSingleError(result, 'FROZEN_EVIDENCE_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('rejects a relative escape even when it resolves outside the repo', () => {
    const fixture = materializeVerifierRepository(frozen)
    const output = '../external-source-guard.json'
    const resolvedOutput = resolve(fixture.repo, output)
    const result = run(fixture.script, [
      '--mode',
      'source',
      '--baseline',
      sourceBaseline,
      '--head',
      currentHead(),
      '--output',
      output,
    ])

    expectSingleError(result, 'FROZEN_EVIDENCE_OUTPUT_PATH')
    expect(existsSync(resolvedOutput)).toBe(false)
    expect(existsSync(`${resolvedOutput}.sha256`)).toBe(false)
  })

  it('rejects a source guard bound to the reserved retry output before path validation', () => {
    const fixture = materializeVerifierRepository(frozen)
    const output =
      `${c04Root}/evidence/phase6-retry-03/` +
      'frozen-evidence-guard.json'
    mkdirSync(dirname(join(fixture.repo, output)), { recursive: true })
    const result = run(
      fixture.script,
      [
        '--mode',
        'source',
        '--baseline',
        sourceBaseline,
        '--head',
        currentHead(),
        '--output',
        output,
      ],
      join(fixture.repo, 'prototype'),
    )

    expectSingleError(result, 'C04_PHASE6_IDENTITY')
    expect(existsSync(join(fixture.repo, output))).toBe(false)
    expect(existsSync(`${join(fixture.repo, output)}.sha256`)).toBe(false)
    expect(existsSync(join(fixture.repo, 'prototype', output))).toBe(false)
  })

  it('rejects an evidence-lineage guard bound to the archived retry-02 namespace', () => {
    const fixture = materializeIntegrationVerifierRepository(frozen)
    const output =
      `${c04Root}/evidence/phase6-retry-02/` +
      'frozen-evidence-guard.json'
    const outputPath = join(fixture.repo, output)
    mkdirSync(dirname(outputPath), { recursive: true })
    const result = run(
      fixture.script,
      [
        '--mode',
        'evidence-lineage',
        '--baseline',
        evidenceBaseline,
        '--head',
        fixture.integrationSha,
        '--output',
        output,
      ],
      join(fixture.repo, 'prototype'),
    )

    expectSingleError(result, 'FROZEN_EVIDENCE_OUTPUT_PATH')
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(`${outputPath}.sha256`)).toBe(false)
  })

  it('publishes an evidence-lineage guard to the repo-relative retry namespace', () => {
    const fixture = materializeIntegrationVerifierRepository(frozen)
    const output =
      `${c04Root}/evidence/phase6-retry-03/` +
      'frozen-evidence-guard.json'
    const outputPath = join(fixture.repo, output)
    mkdirSync(dirname(outputPath), { recursive: true })
    const identity = phase6IntegrationIdentity(
      fixture,
      'frozen-evidence-guard',
      output,
      fixture.sourceHead,
    )
    const result = run(
      fixture.script,
      [
        '--mode',
        'evidence-lineage',
        '--baseline',
        evidenceBaseline,
        '--head',
        fixture.integrationSha,
        '--output',
        output,
      ],
      join(fixture.repo, 'prototype'),
      {
        C04_PHASE6_IDENTITY_V1: JSON.stringify(identity),
      },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(outputPath)).toBe(true)
    expect(existsSync(join(fixture.repo, 'prototype', output))).toBe(false)
    expectExactSidecar(outputPath, output)
  })

  it('rejects zero-valued review and seal namespaces', () => {
    const fixture = materializeIntegrationVerifierRepository(frozen)
    for (const output of [
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/evidence/reviews/IR0/verifiers/' +
        'frozen-evidence-guard.json',
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/evidence/reviews/IR00/verifiers/' +
        'frozen-evidence-guard.json',
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/seals/S0/verifiers/' +
        'frozen-evidence-guard.json',
    ]) {
      const outputPath = join(fixture.repo, output)
      mkdirSync(dirname(outputPath), { recursive: true })
      const result = run(fixture.script, [
        '--mode',
        'evidence-lineage',
        '--baseline',
        evidenceBaseline,
        '--head',
        fixture.integrationSha,
        '--output',
        output,
      ])

      expectSingleError(result, 'FROZEN_EVIDENCE_OUTPUT_PATH')
      expect(existsSync(outputPath)).toBe(false)
      expect(existsSync(`${outputPath}.sha256`)).toBe(false)
    }
  })

  it('accepts allocated IR01 and S01 evidence-lineage namespaces', () => {
    const fixture = materializeIntegrationVerifierRepository(frozen)
    for (const output of [
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/evidence/reviews/IR01/verifiers/' +
        'frozen-evidence-guard.json',
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/seals/S01/verifiers/' +
        'frozen-evidence-guard.json',
    ]) {
      const outputPath = join(fixture.repo, output)
      mkdirSync(dirname(outputPath), { recursive: true })
      const result = run(fixture.script, [
        '--mode',
        'evidence-lineage',
        '--baseline',
        evidenceBaseline,
        '--head',
        fixture.integrationSha,
        '--output',
        output,
      ])

      expect(result.status, result.stderr).toBe(0)
      expectExactSidecar(outputPath, output)
    }
  })

  it('maps a non-directory output ancestor to the output-path error', () => {
    const fixture = materializeVerifierRepository(frozen)
    const ancestor = join(fixture.root, 'ancestor-file')
    const output = join(ancestor, 'guard.json')
    writeFileSync(ancestor, 'not-a-directory\n')
    const result = run(fixture.script, [
      '--mode',
      'source',
      '--baseline',
      sourceBaseline,
      '--head',
      currentHead(),
      '--output',
      output,
    ])

    expectSingleError(result, 'FROZEN_EVIDENCE_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('fails closed when source and mode baseline binding disagree', () => {
    const root = temporaryDirectory('new-era-frozen-binding-')
    const output = join(root, 'guard.json')
    const result = run(frozen, [
      '--mode',
      'source',
      '--baseline',
      evidenceBaseline,
      '--head',
      currentHead(),
      '--output',
      output,
    ])
    expectSingleError(result, 'FROZEN_EVIDENCE_SHAPE')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })
})

describe('C04 runtime-equivalence production CLI', () => {
  postSourceCommitIt(
    'accepts exact source/I/artifact argv and publishes a no-clobber pair',
    () => {
    const root = temporaryDirectory('new-era-runtime-pass-')
    const output = join(root, 'runtime.json')
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const args = [
      '--baseline',
      sourceBaseline,
      '--head',
      context.head,
      '--artifact-git-sha',
      context.sourceHead,
      '--artifact-dir',
      artifact,
      '--output',
      output,
    ]
    const result = run(runtime, args)
    expect(result.status, result.stderr).toBe(0)
    expect(parseLastJson(result.stdout)).toMatchObject({
      status: 'PASS_RUNTIME_EQUIVALENCE',
      errorCode: null,
      commandArgv: args,
      metadataIdentityOnly: true,
      headSha: context.head,
      artifactGitSha: context.sourceHead,
    })
    expect(existsSync(output)).toBe(true)
    expectExactSidecar(output)

    const repeated = run(runtime, args)
    expectSingleError(repeated, 'C04_RUNTIME_OUTPUT_EXISTS')
    },
  )

  it('rejects an artifact directory symlink without producing output', () => {
    const root = temporaryDirectory('new-era-runtime-link-')
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const artifactLink = join(root, 'artifact-link')
    const output = join(root, 'runtime.json')
    symlinkSync(artifact, artifactLink)
    const result = run(runtime, [
      '--head',
      context.head,
      '--artifact-git-sha',
      context.sourceHead,
      '--artifact-dir',
      artifactLink,
      '--output',
      output,
    ])
    expectSingleError(result, 'C04_RUNTIME_ARTIFACT_DIFF')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('rejects an output located inside the artifact directory', () => {
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const output = join(artifact, 'verification', 'runtime.json')
    mkdirSync(dirname(output), { recursive: true })
    const result = run(runtime, [
      '--baseline',
      sourceBaseline,
      '--head',
      context.sourceHead,
      '--artifact-git-sha',
      context.sourceHead,
      '--artifact-dir',
      artifact,
      '--output',
      output,
    ])

    expectSingleError(result, 'C04_RUNTIME_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('rejects the artifact directory itself as output before no-clobber checks', () => {
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const manifest = JSON.parse(
      readFileSync(join(artifact, 'artifact-manifest.json'), 'utf8'),
    )
    const artifactFiles = [
      ...manifest.files.map((entry) => entry.path),
      'artifact-manifest.json',
      'rc-build.json',
    ]
    const before = artifactFiles.map((path) => ({
      path,
      bytes: readFileSync(join(artifact, path)),
    }))
    expect(existsSync(`${artifact}.sha256`)).toBe(false)

    const result = run(runtime, [
      '--baseline',
      sourceBaseline,
      '--head',
      context.sourceHead,
      '--artifact-git-sha',
      context.sourceHead,
      '--artifact-dir',
      artifact,
      '--output',
      artifact,
    ])

    expectSingleError(result, 'C04_RUNTIME_OUTPUT_PATH')
    expect(existsSync(artifact)).toBe(true)
    expect(existsSync(`${artifact}.sha256`)).toBe(false)
    for (const entry of before) {
      expect(readFileSync(join(artifact, entry.path))).toEqual(
        entry.bytes,
      )
    }
  })

  it('rejects an output ancestor symlink into old C04 evidence', () => {
    const fixture = materializeVerifierRepository(runtime)
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const oldEvidence = join(fixture.repo, c04Root, 'evidence', 'phase6')
    const targetParent = join(oldEvidence, 'ancestor-link-target')
    const alias = join(fixture.root, 'phase6-alias')
    const output = join(
      alias,
      'ancestor-link-target',
      'runtime-equivalence.json',
    )
    mkdirSync(targetParent, { recursive: true })
    symlinkSync(oldEvidence, alias)

    const result = run(fixture.script, [
      '--baseline',
      sourceBaseline,
      '--head',
      context.head,
      '--artifact-git-sha',
      context.sourceHead,
      '--artifact-dir',
      artifact,
      '--output',
      output,
    ])

    expectSingleError(result, 'C04_RUNTIME_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('preserves a truly external absolute temp output', () => {
    const fixture = materializeVerifierRepository(runtime)
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const output = join(fixture.root, 'external', 'runtime.json')
    mkdirSync(dirname(output), { recursive: true })
    const result = run(fixture.script, [
      '--baseline',
      sourceBaseline,
      '--head',
      context.head,
      '--artifact-git-sha',
      context.sourceHead,
      '--artifact-dir',
      artifact,
      '--output',
      output,
    ])

    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(output)).toBe(true)
    expectExactSidecar(output)
  })

  it('rejects an integration verification bound to an external output', () => {
    const fixture = materializeIntegrationVerifierRepository(runtime)
    const artifact = materializeC04Artifact(fixture.sourceHead)
    const output = join(fixture.root, 'external', 'runtime.json')
    mkdirSync(dirname(output), { recursive: true })
    const result = run(fixture.script, [
      '--baseline',
      sourceBaseline,
      '--head',
      fixture.integrationSha,
      '--artifact-git-sha',
      fixture.sourceHead,
      '--artifact-dir',
      artifact,
      '--output',
      output,
    ])

    expectSingleError(result, 'C04_RUNTIME_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('rejects a relative output escape in source mode', () => {
    const fixture = materializeVerifierRepository(runtime)
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const output = '../external-runtime.json'
    const resolvedOutput = resolve(fixture.repo, output)
    const result = run(fixture.script, [
      '--baseline',
      sourceBaseline,
      '--head',
      context.sourceHead,
      '--artifact-git-sha',
      context.sourceHead,
      '--artifact-dir',
      artifact,
      '--output',
      output,
    ])

    expectSingleError(result, 'C04_RUNTIME_OUTPUT_PATH')
    expect(existsSync(resolvedOutput)).toBe(false)
    expect(existsSync(`${resolvedOutput}.sha256`)).toBe(false)
  })

  it('rejects a source verification bound to the reserved retry output before path validation', () => {
    const fixture = materializeVerifierRepository(runtime)
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const output =
      `${c04Root}/evidence/phase6-retry-03/` +
      'runtime-equivalence.json'
    mkdirSync(dirname(join(fixture.repo, output)), { recursive: true })
    const result = run(
      fixture.script,
      [
        '--baseline',
        sourceBaseline,
        '--head',
        context.head,
        '--artifact-git-sha',
        context.sourceHead,
        '--artifact-dir',
        artifact,
        '--output',
        output,
      ],
      join(fixture.repo, 'prototype'),
    )

    expectSingleError(result, 'C04_PHASE6_IDENTITY')
    expect(existsSync(join(fixture.repo, output))).toBe(false)
    expect(existsSync(`${join(fixture.repo, output)}.sha256`)).toBe(false)
    expect(existsSync(join(fixture.repo, 'prototype', output))).toBe(false)
  })

  it('rejects an integration verification bound to the archived retry-02 namespace', () => {
    const fixture = materializeIntegrationVerifierRepository(runtime)
    const artifact = materializeC04Artifact(fixture.sourceHead)
    const output =
      `${c04Root}/evidence/phase6-retry-02/` +
      'runtime-equivalence.json'
    const outputPath = join(fixture.repo, output)
    mkdirSync(dirname(outputPath), { recursive: true })
    const result = run(
      fixture.script,
      [
        '--baseline',
        sourceBaseline,
        '--head',
        fixture.integrationSha,
        '--artifact-git-sha',
        fixture.sourceHead,
        '--artifact-dir',
        artifact,
        '--output',
        output,
      ],
      join(fixture.repo, 'prototype'),
    )

    expectSingleError(result, 'C04_RUNTIME_OUTPUT_PATH')
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(`${outputPath}.sha256`)).toBe(false)
  })

  it('publishes an integration verification to the repo-relative retry namespace', () => {
    const fixture = materializeIntegrationVerifierRepository(runtime)
    const artifact = materializeC04Artifact(fixture.sourceHead)
    const output =
      `${c04Root}/evidence/phase6-retry-03/` +
      'runtime-equivalence.json'
    const outputPath = join(fixture.repo, output)
    mkdirSync(dirname(outputPath), { recursive: true })
    const identity = phase6IntegrationIdentity(
      fixture,
      'runtime-equivalence',
      output,
      fixture.sourceHead,
    )
    const result = run(
      fixture.script,
      [
        '--baseline',
        sourceBaseline,
        '--head',
        fixture.integrationSha,
        '--artifact-git-sha',
        fixture.sourceHead,
        '--artifact-dir',
        artifact,
        '--output',
        output,
      ],
      join(fixture.repo, 'prototype'),
      {
        C04_PHASE6_IDENTITY_V1: JSON.stringify(identity),
      },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(outputPath)).toBe(true)
    expect(existsSync(join(fixture.repo, 'prototype', output))).toBe(false)
    expectExactSidecar(outputPath, output)
  })

  it('rejects zero-valued runtime review and seal namespaces', () => {
    const fixture = materializeIntegrationVerifierRepository(runtime)
    const artifact = materializeC04Artifact(fixture.sourceHead)
    for (const output of [
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/evidence/reviews/IR0/verifiers/' +
        'runtime-equivalence.json',
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/evidence/reviews/IR00/verifiers/' +
        'runtime-equivalence.json',
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/seals/S0/verifiers/' +
        'runtime-equivalence.json',
    ]) {
      const outputPath = join(fixture.repo, output)
      mkdirSync(dirname(outputPath), { recursive: true })
      const result = run(fixture.script, [
        '--baseline',
        sourceBaseline,
        '--head',
        fixture.integrationSha,
        '--artifact-git-sha',
        fixture.sourceHead,
        '--artifact-dir',
        artifact,
        '--output',
        output,
      ])

      expectSingleError(result, 'C04_RUNTIME_OUTPUT_PATH')
      expect(existsSync(outputPath)).toBe(false)
      expect(existsSync(`${outputPath}.sha256`)).toBe(false)
    }
  })

  it('accepts allocated IR01 and S01 runtime namespaces', () => {
    const fixture = materializeIntegrationVerifierRepository(runtime)
    const artifact = materializeC04Artifact(fixture.sourceHead)
    for (const output of [
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/evidence/reviews/IR01/verifiers/' +
        'runtime-equivalence.json',
      'data/playtests/weekly-management-slice/gate1a/' +
        'g1a-20260727-rc9-01/seals/S01/verifiers/' +
        'runtime-equivalence.json',
    ]) {
      const outputPath = join(fixture.repo, output)
      mkdirSync(dirname(outputPath), { recursive: true })
      const result = run(fixture.script, [
        '--baseline',
        sourceBaseline,
        '--head',
        fixture.integrationSha,
        '--artifact-git-sha',
        fixture.sourceHead,
        '--artifact-dir',
        artifact,
        '--output',
        output,
      ])

      expect(result.status, result.stderr).toBe(0)
      expectExactSidecar(outputPath, output)
    }
  })

  it('maps a non-directory runtime output ancestor to the output-path error', () => {
    const fixture = materializeVerifierRepository(runtime)
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const ancestor = join(fixture.root, 'ancestor-file')
    const output = join(ancestor, 'runtime.json')
    writeFileSync(ancestor, 'not-a-directory\n')
    const result = run(fixture.script, [
      '--baseline',
      sourceBaseline,
      '--head',
      context.sourceHead,
      '--artifact-git-sha',
      context.sourceHead,
      '--artifact-dir',
      artifact,
      '--output',
      output,
    ])

    expectSingleError(result, 'C04_RUNTIME_OUTPUT_PATH')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('rejects artifact source identity mismatch without publishing failure output', () => {
    const root = temporaryDirectory('new-era-runtime-binding-')
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const output = join(root, 'runtime.json')
    const result = run(runtime, [
      '--head',
      sourceBaseline,
      '--artifact-git-sha',
      sourceBaseline,
      '--artifact-dir',
      artifact,
      '--output',
      output,
    ])
    expectSingleError(result, 'C04_RUNTIME_ARTIFACT_DIFF')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('preserves a sentinel output on partial-group rejection', () => {
    const root = temporaryDirectory('new-era-runtime-sentinel-')
    const context = sourceVerificationContext()
    const artifact = materializeC04Artifact(context.sourceHead)
    const output = join(root, 'runtime.json')
    writeFileSync(output, 'sentinel\n')
    const result = run(runtime, [
      '--head',
      context.head,
      '--artifact-git-sha',
      context.sourceHead,
      '--artifact-dir',
      artifact,
      '--output',
      output,
    ])
    expectSingleError(result, 'PARTIAL_EVIDENCE_GROUP')
    expect(readFileSync(output, 'utf8')).toBe('sentinel\n')
  })
})
