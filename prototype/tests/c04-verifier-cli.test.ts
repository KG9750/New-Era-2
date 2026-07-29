// @ts-nocheck -- production CLI coverage intentionally uses child processes.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const node = process.execPath
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
const canonicalIdentityInput =
  `${c04Root}/diagnostics/TECH-RC9-D16/` +
  'diagnostic-isolation-input.json'
const canonicalIdentityOutput =
  `${c04Root}/evidence/diagnostic-isolation/` +
  'TECH-RC9-D16-verification.json'

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

function run(script: string, args: string[]) {
  return spawnSync(node, [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH:
        '/opt/homebrew/opt/node@24/bin:' +
        '/opt/homebrew/bin:/usr/bin:/bin',
    },
  })
}

function parseLastJson(text: string) {
  return JSON.parse(text.trim().split('\n').at(-1))
}

function sha256(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('hex')
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
      expectSingleError(sentinelRun, errorCode)
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
    'accepts the exact source argv and publishes a no-clobber pair',
    () => {
    const root = temporaryDirectory('new-era-frozen-pass-')
    const output = join(root, 'guard.json')
    const head = currentHead()
    const args = [
      '--mode',
      'source',
      '--baseline',
      sourceBaseline,
      '--head',
      head,
      '--output',
      output,
    ]
    const result = run(frozen, args)
    expect(result.status, result.stderr).toBe(0)
    expect(parseLastJson(result.stdout)).toMatchObject({
      status: 'PASS_SOURCE_SCOPE',
      errorCode: null,
      commandArgv: args,
    })
    expect(existsSync(output)).toBe(true)
    expect(existsSync(`${output}.sha256`)).toBe(true)

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
    const head = currentHead()
    const artifact = materializeC04Artifact(head)
    const args = [
      '--baseline',
      sourceBaseline,
      '--head',
      head,
      '--artifact-git-sha',
      head,
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
    })
    expect(existsSync(output)).toBe(true)
    expect(existsSync(`${output}.sha256`)).toBe(true)

    const repeated = run(runtime, args)
    expectSingleError(repeated, 'C04_RUNTIME_OUTPUT_EXISTS')
    },
  )

  it('rejects an artifact directory symlink without producing output', () => {
    const root = temporaryDirectory('new-era-runtime-link-')
    const artifact = materializeC04Artifact(currentHead())
    const artifactLink = join(root, 'artifact-link')
    const output = join(root, 'runtime.json')
    symlinkSync(artifact, artifactLink)
    const result = run(runtime, [
      '--head',
      currentHead(),
      '--artifact-git-sha',
      currentHead(),
      '--artifact-dir',
      artifactLink,
      '--output',
      output,
    ])
    expectSingleError(result, 'C04_RUNTIME_ARTIFACT_DIFF')
    expect(existsSync(output)).toBe(false)
    expect(existsSync(`${output}.sha256`)).toBe(false)
  })

  it('rejects artifact source identity mismatch without publishing failure output', () => {
    const root = temporaryDirectory('new-era-runtime-binding-')
    const head = currentHead()
    const artifact = materializeC04Artifact(head)
    const output = join(root, 'runtime.json')
    const result = run(runtime, [
      '--head',
      head,
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
    const head = currentHead()
    const artifact = materializeC04Artifact(head)
    const output = join(root, 'runtime.json')
    writeFileSync(output, 'sentinel\n')
    const result = run(runtime, [
      '--head',
      head,
      '--artifact-git-sha',
      head,
      '--artifact-dir',
      artifact,
      '--output',
      output,
    ])
    expectSingleError(result, 'PARTIAL_EVIDENCE_GROUP')
    expect(readFileSync(output, 'utf8')).toBe('sentinel\n')
  })
})
