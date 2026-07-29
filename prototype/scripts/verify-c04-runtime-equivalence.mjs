import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  closeSync,
  constants as fsConstants,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import {
  phase6IdentityFromEnvironment,
  reservedPhase6IdentityFromEnvironment,
} from './candidate-manifest-contract.mjs'

const SCHEMA_VERSION = 'gate1a-c04-runtime-equivalence-v1'
const SOURCE_BASELINE = 'cd2fc9716d98c160fe530c593347992f18bf96e4'
const EVIDENCE_BASELINE = '5b9438cc5123ba35d8a703f3507bbf463e90176d'
const C03_EVIDENCE_COMMIT = '5b9438cc5123ba35d8a703f3507bbf463e90176d'
const C03_ARTIFACT_ROOT =
  'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C03/rc-dist'
const EXPECTED_BUILD_ID = 'g1-rc-20260729.rc9-c04'
const EXPECTED_ARTIFACT_HASH =
  '9a7ddde0234d82798b2625c050710143f8f4b94bd6d14bd121910a76831abb65'
const EXPECTED_MANIFEST_HASH =
  'c336706bf7193c07a7f552dfbfe77cf02ec36259c72cc08b8f0c6ee8fc84cc37'
const C04_ROOT =
  'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04'
const COHORT_ROOT =
  'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01'
const SHA_PATTERN = /^[a-f0-9]{40}$/
const ALLOWED_OPTIONS = new Set([
  '--baseline',
  '--head',
  '--artifact-git-sha',
  '--artifact-dir',
  '--output',
])
const SOURCE_CHANGE_ALLOWLIST = Object.freeze(
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
const SOURCE_CHANGE_ALLOWLIST_SET = new Set(SOURCE_CHANGE_ALLOWLIST)

const prototypeRoot = resolve(import.meta.dirname, '..')
const repoRoot = resolve(prototypeRoot, '..')
const canonicalRepoRoot = realpathSync(repoRoot)

class EquivalenceFailure extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.code = code
    this.details = details
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function parseOptions(argv) {
  if (argv.length % 2 !== 0) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_SHAPE',
      '参数必须使用 --name value 形式',
    )
  }
  const options = {}
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]
    if (
      !ALLOWED_OPTIONS.has(name) ||
      typeof value !== 'string' ||
      value.length === 0 ||
      value.startsWith('--') ||
      Object.hasOwn(options, name)
    ) {
      throw new EquivalenceFailure(
        'C04_RUNTIME_SHAPE',
        `未知、重复或无效参数：${name}`,
      )
    }
    options[name] = value
  }
  if (
    options['--baseline'] !== undefined &&
    !SHA_PATTERN.test(options['--baseline'])
  ) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_SHAPE',
      'baseline 必须是完整的 40 位 Git commit SHA',
    )
  }
  if (
    options['--head'] !== undefined &&
    !SHA_PATTERN.test(options['--head'])
  ) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_SHAPE',
      'head 必须是完整的 40 位 Git commit SHA',
    )
  }
  if (
    options['--artifact-git-sha'] !== undefined &&
    !SHA_PATTERN.test(options['--artifact-git-sha'])
  ) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_SHAPE',
      'artifact-git-sha 必须是完整的 40 位 Git commit SHA',
    )
  }
  for (const required of ['--head', '--artifact-git-sha', '--output']) {
    if (!Object.hasOwn(options, required)) {
      throw new EquivalenceFailure(
        'C04_RUNTIME_SHAPE',
        `缺少参数：${required}`,
      )
    }
  }
  return options
}

function gitText(...args) {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
}

function gitBuffer(...args) {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  })
}

function resolveCommit(input, label) {
  try {
    return gitText('rev-parse', '--verify', `${input}^{commit}`)
  } catch {
    throw new EquivalenceFailure(
      'C04_RUNTIME_SHAPE',
      `${label} 不是当前仓库可解析的 commit：${input}`,
    )
  }
}

function resolveFromRepo(input) {
  return isAbsolute(input) ? resolve(input) : resolve(canonicalRepoRoot, input)
}

function displayPath(absolutePath, originalInput) {
  const repoPrefix = `${canonicalRepoRoot}${sep}`
  return absolutePath.startsWith(repoPrefix)
    ? relative(canonicalRepoRoot, absolutePath).split(sep).join('/')
    : originalInput
}

function lstatOutputPath(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw new EquivalenceFailure(
      'C04_RUNTIME_OUTPUT_PATH',
      `无法检查 output path：${path}`,
    )
  }
}

function canonicalFreshTarget(path) {
  const suffix = []
  let cursor = path
  while (true) {
    const stats = lstatOutputPath(cursor)
    if (stats) {
      try {
        return resolve(realpathSync(cursor), ...suffix)
      } catch {
        throw new EquivalenceFailure(
          'C04_RUNTIME_OUTPUT_PATH',
          `无法解析 output 既有 ancestor：${cursor}`,
        )
      }
    }
    const parent = dirname(cursor)
    if (parent === cursor) {
      throw new EquivalenceFailure(
        'C04_RUNTIME_OUTPUT_PATH',
        `无法定位 output 既有 ancestor：${path}`,
      )
    }
    suffix.unshift(basename(cursor))
    cursor = parent
  }
}

function repoLocation(path) {
  const normalized = relative(canonicalRepoRoot, path)
  return {
    inside:
      normalized !== '..' && !normalized.startsWith(`..${sep}`),
    relativePath: normalized.split(sep).join('/'),
  }
}

function outputAllowed(relativePath) {
  if (
    relativePath ===
      `${C04_ROOT}/evidence/phase6-retry-02/runtime-equivalence.json` ||
    relativePath ===
      `${C04_ROOT}/evidence/freeze-audit/runtime-equivalence.json`
  ) {
    return true
  }
  return new RegExp(
    `^${COHORT_ROOT}/(?:evidence/reviews/IR|seals/S)` +
      '(?:0[1-9]|[1-9][0-9]+)/verifiers/' +
      'runtime-equivalence\\.json$',
  ).test(relativePath)
}

function validateOutput(output, verificationMode) {
  const outputPath = resolveFromRepo(output)
  const canonicalTarget = canonicalFreshTarget(outputPath)
  const lexicalLocation = repoLocation(outputPath)
  const canonicalLocation = repoLocation(canonicalTarget)
  if (
    (lexicalLocation.inside || canonicalLocation.inside) &&
    (lexicalLocation.inside !== canonicalLocation.inside ||
      lexicalLocation.relativePath !== canonicalLocation.relativePath)
  ) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_OUTPUT_PATH',
      `output symlink ancestor 改变 repo namespace：${output}`,
    )
  }
  const {
    inside: insideRepo,
    relativePath,
  } = canonicalLocation
  if (
    (verificationMode === 'source' &&
      (!isAbsolute(output) || insideRepo)) ||
    (verificationMode === 'evidence-lineage-integration' &&
      (!insideRepo || !outputAllowed(relativePath)))
  ) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_OUTPUT_PATH',
      `output 与 ${verificationMode} mode 不匹配：${output}`,
    )
  }
  const parentStat = lstatOutputPath(dirname(outputPath))
  if (!parentStat?.isDirectory() || parentStat.isSymbolicLink()) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_OUTPUT_PATH',
      `output 父目录必须是既有普通目录：${dirname(outputPath)}`,
    )
  }
  const sidecarPath = `${outputPath}.sha256`
  return {
    outputPath,
    sidecarPath,
    relativePath,
    insideRepo,
    canonicalTarget,
  }
}

function validateOutputGroup(destination, output) {
  const outputExists = Boolean(
    lstatOutputPath(destination.outputPath),
  )
  const sidecarExists = Boolean(
    lstatOutputPath(destination.sidecarPath),
  )
  if (outputExists !== sidecarExists) {
    throw new EquivalenceFailure(
      'PARTIAL_EVIDENCE_GROUP',
      `JSON/sidecar 只存在一个成员：${
        displayPath(destination.outputPath, output)
      }`,
    )
  }
  if (outputExists) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_OUTPUT_EXISTS',
      `output group 已存在：${
        displayPath(destination.outputPath, output)
      }`,
    )
  }
}

function fsyncDirectorySync(path) {
  const descriptor = openSync(path, fsConstants.O_RDONLY)
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

function writeJsonGroup(
  output,
  value,
  verificationMode,
  initialDestination,
) {
  const {
    outputPath,
    sidecarPath,
    relativePath,
    insideRepo,
    canonicalTarget,
  } = validateOutput(output, verificationMode)
  if (
    outputPath !== initialDestination.outputPath ||
    canonicalTarget !== initialDestination.canonicalTarget ||
    relativePath !== initialDestination.relativePath ||
    insideRepo !== initialDestination.insideRepo
  ) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_OUTPUT_PATH',
      `output destination 在写入前发生变化：${output}`,
    )
  }
  validateOutputGroup(
    {
      outputPath,
      sidecarPath,
    },
    output,
  )
  const temporaryPath =
    `${outputPath}.tmp-${process.pid}-${randomUUID()}`
  const temporarySidecarPath = `${temporaryPath}.sha256`
  const jsonBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
  const sidecarBytes = Buffer.from(
    `${sha256(jsonBytes)}  ${insideRepo ? relativePath : outputPath}\n`,
    'utf8',
  )
  let descriptor
  let sidecarDescriptor
  let outputPublished = false
  let sidecarPublished = false
  try {
    descriptor = openSync(
      temporaryPath,
      fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        fsConstants.O_WRONLY,
      0o600,
    )
    sidecarDescriptor = openSync(
      temporarySidecarPath,
      fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        fsConstants.O_WRONLY,
      0o600,
    )
    writeFileSync(descriptor, jsonBytes)
    writeFileSync(sidecarDescriptor, sidecarBytes)
    fsyncSync(descriptor)
    fsyncSync(sidecarDescriptor)
    closeSync(descriptor)
    descriptor = undefined
    closeSync(sidecarDescriptor)
    sidecarDescriptor = undefined
    fsyncDirectorySync(dirname(outputPath))
    linkSync(temporaryPath, outputPath)
    outputPublished = true
    linkSync(temporarySidecarPath, sidecarPath)
    sidecarPublished = true
    fsyncDirectorySync(dirname(outputPath))
  } catch (error) {
    if (outputPublished) {
      try { unlinkSync(outputPath) } catch {}
    }
    if (sidecarPublished) {
      try { unlinkSync(sidecarPath) } catch {}
    }
    try { unlinkSync(temporaryPath) } catch {}
    try { unlinkSync(temporarySidecarPath) } catch {}
    try { fsyncDirectorySync(dirname(outputPath)) } catch {}
    if (
      Boolean(lstatOutputPath(outputPath)) ||
      Boolean(lstatOutputPath(sidecarPath))
    ) {
      throw new EquivalenceFailure(
        'PARTIAL_EVIDENCE_GROUP',
        `JSON/sidecar group 发布失败且有成员残留：${output}`,
      )
    }
    throw error
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (sidecarDescriptor !== undefined) closeSync(sidecarDescriptor)
    try {
      unlinkSync(temporaryPath)
    } catch {
      // Staging name may already be removed.
    }
    try { unlinkSync(temporarySidecarPath) } catch {}
    try { fsyncDirectorySync(dirname(outputPath)) } catch {}
  }
}

function readJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new EquivalenceFailure(
      'C04_RUNTIME_ARTIFACT_DIFF',
      `${label} 不是有效 JSON`,
    )
  }
}

function collectFiles(root, prefix = '') {
  return readdirSync(root, { withFileTypes: true })
    .sort((left, right) =>
      Buffer.from(left.name).compare(Buffer.from(right.name)),
    )
    .flatMap((entry) => {
      const absolutePath = join(root, entry.name)
      const normalizedPath = prefix
        ? `${prefix}/${entry.name}`
        : entry.name
      const stat = lstatSync(absolutePath)
      if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
        throw new EquivalenceFailure(
          'C04_RUNTIME_ARTIFACT_DIFF',
          `C04 artifact 含非普通文件：${normalizedPath}`,
        )
      }
      return stat.isDirectory()
        ? collectFiles(absolutePath, normalizedPath)
        : [normalizedPath]
    })
}

function parseNameStatus(output) {
  if (!output) return []
  return output.split('\n').map((line) => {
    const fields = line.split('\t')
    if (fields.length !== 2) {
      throw new EquivalenceFailure(
        'C04_RUNTIME_SHAPE',
        `无法解析 Git diff 条目或检测到 rename/copy：${line}`,
      )
    }
    return {
      status: fields[0],
      path: fields[1],
    }
  })
}

function isAncestor(ancestor, descendant) {
  try {
    execFileSync(
      'git',
      ['-C', repoRoot, 'merge-base', '--is-ancestor', ancestor, descendant],
      { stdio: 'ignore' },
    )
    return true
  } catch {
    return false
  }
}

function sourceBlobBinding(commit, path) {
  const listing = gitText('ls-tree', commit, '--', path)
  const match = listing.match(
    /^(100644|100755) blob ([a-f0-9]{40})\t([\s\S]+)$/,
  )
  if (!match || match[3] !== path) {
    return { path, present: false, mode: null, blobId: null }
  }
  return {
    path,
    present: true,
    mode: match[1],
    blobId: match[2],
  }
}

function sourceScope(baseline, head) {
  if (
    SOURCE_CHANGE_ALLOWLIST.length !== 49 ||
    SOURCE_CHANGE_ALLOWLIST_SET.size !== 49
  ) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_SHAPE',
      'source change allowlist 必须恰好包含 49 个无重复 exact path',
    )
  }
  const changes = parseNameStatus(
    gitText('diff', '--name-status', '--no-renames', baseline, head),
  )
  const bindings = SOURCE_CHANGE_ALLOWLIST.map((path) =>
    sourceBlobBinding(head, path),
  )
  const violations = [
    ...changes
      .filter(
        (entry) =>
          !['A', 'M'].includes(entry.status) ||
          !SOURCE_CHANGE_ALLOWLIST_SET.has(entry.path),
      )
      .map((entry) => ({
        ...entry,
        reason: !SOURCE_CHANGE_ALLOWLIST_SET.has(entry.path)
          ? 'PATH_OUTSIDE_EXACT_ALLOWLIST'
          : 'STATUS_NOT_ADD_OR_MODIFY',
      })),
    ...bindings
      .filter((entry) => !entry.present)
      .map((entry) => ({
        status: 'MISSING',
        path: entry.path,
        reason: 'ALLOWLIST_BLOB_MISSING_OR_NON_REGULAR',
      })),
  ]
  return { baseline, head, changes, bindings, violations }
}

function compareSourceBlobs(sourceBindings, headBindings) {
  return SOURCE_CHANGE_ALLOWLIST.flatMap((path, index) => {
    const source = sourceBindings[index]
    const head = headBindings[index]
    return source.present &&
      head.present &&
      source.mode === head.mode &&
      source.blobId === head.blobId
      ? []
      : [
          {
            path,
            source: {
              present: source.present,
              mode: source.mode,
              blobId: source.blobId,
            },
            head: {
              present: head.present,
              mode: head.mode,
              blobId: head.blobId,
            },
            reason: 'SOURCE_BLOB_IDENTITY_MISMATCH',
          },
        ]
  })
}

function compareMetadata(candidate, reference, head) {
  const candidateKeys = Object.keys(candidate).sort()
  const referenceKeys = Object.keys(reference).sort()
  if (JSON.stringify(candidateKeys) !== JSON.stringify(referenceKeys)) {
    return false
  }
  if (
    candidate.buildId !== EXPECTED_BUILD_ID ||
    candidate.gitSha !== head
  ) {
    return false
  }
  return referenceKeys.every(
    (key) =>
      ['buildId', 'gitSha'].includes(key) ||
      JSON.stringify(candidate[key]) === JSON.stringify(reference[key]),
  )
}

const argv = process.argv.slice(2)
let options
let result = {
  schemaVersion: SCHEMA_VERSION,
  status: 'FAIL',
  errorCode: null,
  commandArgv: argv,
}

try {
  options = parseOptions(argv)
  let phase6Identity
  try {
    const reservedIdentity = reservedPhase6IdentityFromEnvironment(
      canonicalRepoRoot,
      resolveFromRepo(options['--output']),
      'runtime-equivalence',
      {
        integrationSha: options['--head'],
        artifactSourceSha: options['--artifact-git-sha'],
      },
    )
    phase6Identity =
      reservedIdentity ??
      phase6IdentityFromEnvironment('runtime-equivalence')
  } catch {
    throw new EquivalenceFailure(
      'C04_PHASE6_IDENTITY',
      'reserved Phase 6 identity preflight failed',
    )
  }
  const baseline = resolveCommit(
    options['--baseline'] ?? SOURCE_BASELINE,
    'baseline',
  )
  if (baseline !== SOURCE_BASELINE) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_SHAPE',
      `baseline 必须等于 ${SOURCE_BASELINE}`,
    )
  }
  const head = resolveCommit(options['--head'], 'head')
  const artifactGitSha = resolveCommit(
    options['--artifact-git-sha'],
    'artifact-git-sha',
  )
  const verificationMode =
    head === artifactGitSha ? 'source' : 'evidence-lineage-integration'
  const outputDestination = validateOutput(
    options['--output'],
    verificationMode,
  )

  const artifactDirInput = options['--artifact-dir'] ?? 'prototype/dist'
  const artifactRoot = resolveFromRepo(artifactDirInput)
  const artifactRootStat = lstatSync(artifactRoot, {
    throwIfNoEntry: false,
  })
  if (!artifactRootStat?.isDirectory() || artifactRootStat.isSymbolicLink()) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_ARTIFACT_DIFF',
      'C04 artifact-dir 必须是既有普通目录且不得为 symlink',
    )
  }
  let canonicalArtifactRoot
  try {
    canonicalArtifactRoot = realpathSync(artifactRoot)
  } catch {
    throw new EquivalenceFailure(
      'C04_RUNTIME_ARTIFACT_DIFF',
      '无法解析 C04 artifact-dir',
    )
  }
  if (
    outputDestination.canonicalTarget === canonicalArtifactRoot ||
    outputDestination.canonicalTarget.startsWith(
      `${canonicalArtifactRoot}${sep}`,
    )
  ) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_OUTPUT_PATH',
      'runtime equivalence output 不得位于 artifact-dir 内',
    )
  }
  validateOutputGroup(outputDestination, options['--output'])
  const candidateMetadataBytes = readFileSync(
    join(artifactRoot, 'rc-build.json'),
  )
  const candidateMetadata = readJson(
    candidateMetadataBytes,
    'C04 rc-build.json',
  )
  const metadataHead =
    typeof candidateMetadata.gitSha === 'string'
      ? candidateMetadata.gitSha
      : ''
  if (!SHA_PATTERN.test(metadataHead)) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_ARTIFACT_DIFF',
      'C04 rc-build.json 缺少完整 gitSha',
    )
  }
  if (metadataHead !== artifactGitSha) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_ARTIFACT_DIFF',
      'C04 rc-build.json gitSha 与 artifact-git-sha 不一致',
    )
  }

  if (!isAncestor(SOURCE_BASELINE, artifactGitSha)) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_SOURCE_DIFF',
      'artifact-git-sha 必须是冻结 source baseline 的后代',
    )
  }
  const sourceCommitScope = sourceScope(SOURCE_BASELINE, artifactGitSha)
  let headScope = sourceCommitScope
  let sourceBlobIdentityMismatches = []
  if (verificationMode === 'evidence-lineage-integration') {
    if (!isAncestor(EVIDENCE_BASELINE, head)) {
      throw new EquivalenceFailure(
        'C04_RUNTIME_SOURCE_DIFF',
        'integration head 必须是冻结 evidence baseline 的后代',
      )
    }
    headScope = sourceScope(EVIDENCE_BASELINE, head)
    sourceBlobIdentityMismatches = compareSourceBlobs(
      sourceCommitScope.bindings,
      headScope.bindings,
    )
  }
  const changedForbiddenPaths = [
    ...sourceCommitScope.violations,
    ...(verificationMode === 'evidence-lineage-integration'
      ? headScope.violations
      : []),
    ...sourceBlobIdentityMismatches,
  ]
  result = {
    ...result,
    verificationMode,
    verificationInputSha: head,
    headSha: head,
    artifactGitSha,
    sourceBaselineSha: baseline,
    changedForbiddenPaths,
    source: {
      baselineSha: baseline,
      headSha: head,
      evidenceBaselineSha:
        verificationMode === 'evidence-lineage-integration'
          ? EVIDENCE_BASELINE
          : null,
      allowlistCount: SOURCE_CHANGE_ALLOWLIST.length,
      exactPathAllowlist: SOURCE_CHANGE_ALLOWLIST,
      sourceCommitScope,
      headScope,
      sourceBlobIdentityMismatches,
      changedForbiddenPaths,
    },
  }
  if (changedForbiddenPaths.length > 0) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_SOURCE_DIFF',
      'C04 source 修改了禁止路径',
    )
  }

  const referenceManifestPath =
    `${C03_ARTIFACT_ROOT}/artifact-manifest.json`
  const referenceMetadataPath = `${C03_ARTIFACT_ROOT}/rc-build.json`
  const referenceManifestBytes = gitBuffer(
    'show',
    `${C03_EVIDENCE_COMMIT}:${referenceManifestPath}`,
  )
  const referenceMetadataBytes = gitBuffer(
    'show',
    `${C03_EVIDENCE_COMMIT}:${referenceMetadataPath}`,
  )
  const referenceManifest = readJson(
    referenceManifestBytes,
    'C03 artifact-manifest.json',
  )
  const referenceMetadata = readJson(
    referenceMetadataBytes,
    'C03 rc-build.json',
  )
  const referenceManifestHash = sha256(referenceManifestBytes)
  const referenceArtifactHash = sha256(
    Buffer.from(JSON.stringify(referenceManifest.files), 'utf8'),
  )
  if (
    referenceManifestHash !== EXPECTED_MANIFEST_HASH ||
    referenceArtifactHash !== EXPECTED_ARTIFACT_HASH ||
    referenceMetadata.artifactHash !== EXPECTED_ARTIFACT_HASH ||
    !Array.isArray(referenceManifest.files) ||
    referenceManifest.files.length !== 5
  ) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_ARTIFACT_DIFF',
      '冻结的 C03 artifact authority 无法复算',
    )
  }

  const candidateManifestBytes = readFileSync(
    join(artifactRoot, 'artifact-manifest.json'),
  )
  const candidateManifest = readJson(
    candidateManifestBytes,
    'C04 artifact-manifest.json',
  )
  const candidateManifestHash = sha256(candidateManifestBytes)
  const candidateArtifactHash = sha256(
    Buffer.from(JSON.stringify(candidateManifest.files), 'utf8'),
  )
  const manifestBytesEqual =
    candidateManifestBytes.equals(referenceManifestBytes)
  const metadataEquivalent = compareMetadata(
    candidateMetadata,
    referenceMetadata,
    artifactGitSha,
  )

  const canonicalFiles = referenceManifest.files.map((entry) => {
    const candidateBytes = readFileSync(join(artifactRoot, entry.path))
    const referenceBytes = gitBuffer(
      'show',
      `${C03_EVIDENCE_COMMIT}:${C03_ARTIFACT_ROOT}/${entry.path}`,
    )
    return {
      path: entry.path,
      expectedBytes: referenceBytes.byteLength,
      actualBytes: candidateBytes.byteLength,
      expectedSha256: sha256(referenceBytes),
      actualSha256: sha256(candidateBytes),
      bytesEqual: candidateBytes.equals(referenceBytes),
    }
  })
  const expectedArtifactFiles = [
    ...referenceManifest.files.map((entry) => entry.path),
    'artifact-manifest.json',
    'rc-build.json',
  ].sort()
  const actualArtifactFiles = collectFiles(artifactRoot).sort()
  const artifactInventoryEqual =
    JSON.stringify(actualArtifactFiles) ===
    JSON.stringify(expectedArtifactFiles)

  result.artifact = {
    referenceCommit: C03_EVIDENCE_COMMIT,
    referencePath: C03_ARTIFACT_ROOT,
    artifactDir: displayPath(artifactRoot, artifactDirInput),
    canonicalFileCount: canonicalFiles.length,
    expectedArtifactHash: EXPECTED_ARTIFACT_HASH,
    actualArtifactHash: candidateArtifactHash,
    metadataArtifactHash: candidateMetadata.artifactHash ?? null,
    expectedArtifactManifestSha256: EXPECTED_MANIFEST_HASH,
    actualArtifactManifestSha256: candidateManifestHash,
    artifactManifestBytesEqual: manifestBytesEqual,
    artifactInventoryEqual,
    expectedArtifactFiles,
    actualArtifactFiles,
    metadataIdentity: {
      expectedBuildId: EXPECTED_BUILD_ID,
      actualBuildId: candidateMetadata.buildId ?? null,
      expectedGitSha: artifactGitSha,
      actualGitSha: candidateMetadata.gitSha ?? null,
      onlyBuildIdAndGitShaDifferFromC03: metadataEquivalent,
    },
    canonicalFiles,
  }

  if (
    candidateManifestHash !== EXPECTED_MANIFEST_HASH ||
    candidateArtifactHash !== EXPECTED_ARTIFACT_HASH ||
    candidateMetadata.artifactHash !== EXPECTED_ARTIFACT_HASH ||
    !manifestBytesEqual ||
    !metadataEquivalent ||
    !artifactInventoryEqual ||
    canonicalFiles.some((entry) => !entry.bytesEqual)
  ) {
    throw new EquivalenceFailure(
      'C04_RUNTIME_ARTIFACT_DIFF',
      'C04 artifact 与冻结的 C03 runtime 不等价',
    )
  }

  result.status = 'PASS_RUNTIME_EQUIVALENCE'
  result.errorCode = null
  result.canonicalFileCount = canonicalFiles.length
  result.artifactManifestBytesEqual = manifestBytesEqual
  result.artifactInventoryEqual = artifactInventoryEqual
  result.metadataIdentityOnly = metadataEquivalent
  result.expectedArtifactHash = EXPECTED_ARTIFACT_HASH
  result.actualArtifactHash = candidateArtifactHash
  result.expectedArtifactManifestSha256 = EXPECTED_MANIFEST_HASH
  result.actualArtifactManifestSha256 = candidateManifestHash
  result.canonicalFiles = canonicalFiles
  if (phase6Identity) result.phase6Identity = phase6Identity
  writeJsonGroup(
    options['--output'],
    result,
    verificationMode,
    outputDestination,
  )
  process.stdout.write(`${JSON.stringify(result)}\n`)
} catch (error) {
  const failure =
    error instanceof EquivalenceFailure
      ? error
      : new EquivalenceFailure(
          'C04_RUNTIME_ARTIFACT_DIFF',
          error instanceof Error ? error.message : String(error),
        )
  result = {
    ...result,
    status: 'FAIL',
    errorCode: failure.code,
    error: failure.message,
    ...failure.details,
  }
  process.stderr.write(`${JSON.stringify(result)}\n`)
  process.exitCode = 1
}
