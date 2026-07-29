import { createHash, randomUUID } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  closeSync,
  constants as fsConstants,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path'

const SCHEMA_VERSION = 'gate1a-frozen-evidence-guard-v1'
const SOURCE_BASELINE = 'cd2fc9716d98c160fe530c593347992f18bf96e4'
const EVIDENCE_BASELINE = '5b9438cc5123ba35d8a703f3507bbf463e90176d'
const SHA_PATTERN = /^[a-f0-9]{40}$/
const C04_ROOT =
  'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C04'
const COHORT_ROOT =
  'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01'
const ALLOWED_OPTIONS = new Set(['--mode', '--baseline', '--head', '--output'])
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

const FROZEN_PATHS = [
  {
    path: 'data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01',
    treeId: 'c5714f7ca7adb5e8fe052d4d00f27c545b988347',
    fileCount: 67,
    inventorySha256:
      '3f55528ad8993aae8646a152489227eee76c280e0ae2c2d092b57dc2ec5398e2',
  },
  {
    path: 'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C01',
    treeId: '55f661518c7ed8a2cc99f0fc0f25fabecd24c286',
    fileCount: 41,
    inventorySha256:
      'fa7a926f64dfff08e2c86b1baa8f87217aecce5e99232154f534110538c2f5c6',
  },
  {
    path: 'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C02',
    treeId: '9b7dbae2c0c5d1bba45399e77dac65766911d3b3',
    fileCount: 62,
    inventorySha256:
      '250a9d82e0e2056af1622bd063e806d236178e72ee93b1a6f178708d056f4664',
  },
  {
    path: 'data/playtests/weekly-management-slice/gate1a/g1a-20260727-rc9-01/candidates/C03',
    treeId: '6c3e5bf9bf4808724534c7c1fb472fc487a4d350',
    fileCount: 65,
    inventorySha256:
      '1c107b09ebdc4eacf0ac2bae388402aee2f12ad1dadbf081e547da66ac40462d',
  },
]

const prototypeRoot = resolve(import.meta.dirname, '..')
const repoRoot = resolve(prototypeRoot, '..')
const canonicalRepoRoot = realpathSync(repoRoot)

class GuardFailure extends Error {
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
    throw new GuardFailure(
      'FROZEN_EVIDENCE_SHAPE',
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
      throw new GuardFailure(
        'FROZEN_EVIDENCE_SHAPE',
        `未知、重复或无效参数：${name}`,
      )
    }
    options[name] = value
  }
  for (const required of ALLOWED_OPTIONS) {
    if (!Object.hasOwn(options, required)) {
      throw new GuardFailure(
        'FROZEN_EVIDENCE_SHAPE',
        `缺少参数：${required}`,
      )
    }
  }
  if (!['source', 'evidence-lineage'].includes(options['--mode'])) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_SHAPE',
      `未知 mode：${options['--mode']}`,
    )
  }
  if (
    !SHA_PATTERN.test(options['--baseline']) ||
    !SHA_PATTERN.test(options['--head'])
  ) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_SHAPE',
      'baseline 与 head 必须是完整的 40 位 Git commit SHA',
    )
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
    throw new GuardFailure(
      'FROZEN_EVIDENCE_SHAPE',
      `${label} 不是当前仓库可解析的 commit：${input}`,
    )
  }
}

function resolveOutputPath(output) {
  return isAbsolute(output) ? resolve(output) : resolve(canonicalRepoRoot, output)
}

function lstatOutputPath(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw new GuardFailure(
      'FROZEN_EVIDENCE_OUTPUT_PATH',
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
        throw new GuardFailure(
          'FROZEN_EVIDENCE_OUTPUT_PATH',
          `无法解析 output 既有 ancestor：${cursor}`,
        )
      }
    }
    const parent = dirname(cursor)
    if (parent === cursor) {
      throw new GuardFailure(
        'FROZEN_EVIDENCE_OUTPUT_PATH',
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
      `${C04_ROOT}/evidence/phase6-retry-01/frozen-evidence-guard.json` ||
    relativePath ===
      `${C04_ROOT}/evidence/freeze-audit/frozen-evidence-guard.json`
  ) {
    return true
  }
  return new RegExp(
    `^${COHORT_ROOT}/(?:evidence/reviews/IR|seals/S)` +
      '(?:0[1-9]|[1-9][0-9]+)/verifiers/' +
      'frozen-evidence-guard\\.json$',
  ).test(relativePath)
}

function validateOutput(output, mode) {
  const outputPath = resolveOutputPath(output)
  const canonicalTarget = canonicalFreshTarget(outputPath)
  const lexicalLocation = repoLocation(outputPath)
  const canonicalLocation = repoLocation(canonicalTarget)
  if (
    (lexicalLocation.inside || canonicalLocation.inside) &&
    (lexicalLocation.inside !== canonicalLocation.inside ||
      lexicalLocation.relativePath !== canonicalLocation.relativePath)
  ) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_OUTPUT_PATH',
      `output symlink ancestor 改变 repo namespace：${output}`,
    )
  }
  const {
    inside: insideRepo,
    relativePath,
  } = canonicalLocation
  if (
    (mode === 'source' && (!isAbsolute(output) || insideRepo)) ||
    (mode === 'evidence-lineage' &&
      (!insideRepo || !outputAllowed(relativePath)))
  ) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_OUTPUT_PATH',
      `output 与 ${mode} mode 不匹配：${output}`,
    )
  }
  const parentStat = lstatOutputPath(dirname(outputPath))
  if (!parentStat?.isDirectory() || parentStat.isSymbolicLink()) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_OUTPUT_PATH',
      `output 父目录必须是既有普通目录：${dirname(outputPath)}`,
    )
  }
  const sidecarPath = `${outputPath}.sha256`
  const outputExists = Boolean(lstatOutputPath(outputPath))
  const sidecarExists = Boolean(lstatOutputPath(sidecarPath))
  if (outputExists !== sidecarExists) {
    throw new GuardFailure(
      'PARTIAL_EVIDENCE_GROUP',
      `JSON/sidecar 只存在一个成员：${output}`,
    )
  }
  if (outputExists) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_OUTPUT_EXISTS',
      `output group 已存在：${output}`,
    )
  }
  return {
    outputPath,
    sidecarPath,
    relativePath,
    insideRepo,
    canonicalTarget,
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

function writeJsonGroup(output, value, mode, initialDestination) {
  const {
    outputPath,
    sidecarPath,
    relativePath,
    insideRepo,
    canonicalTarget,
  } = validateOutput(output, mode)
  if (
    outputPath !== initialDestination.outputPath ||
    canonicalTarget !== initialDestination.canonicalTarget ||
    relativePath !== initialDestination.relativePath ||
    insideRepo !== initialDestination.insideRepo
  ) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_OUTPUT_PATH',
      `output destination 在写入前发生变化：${output}`,
    )
  }
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
      throw new GuardFailure(
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

function isAncestor(ancestor, descendant) {
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
    { encoding: 'utf8' },
  )
  if (result.error || ![0, 1].includes(result.status)) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_SHAPE',
      `无法验证 source commit ancestry：${
        result.error?.message ?? result.stderr.trim()
      }`,
    )
  }
  return result.status === 0
}

function parseSourceDiff(output) {
  if (!output) return []
  return output.split('\n').map((line) => {
    const fields = line.split('\t')
    if (fields.length !== 2) {
      throw new GuardFailure(
        'FROZEN_EVIDENCE_SHAPE',
        `无法解析 Git diff 条目或检测到 rename/copy：${line}`,
      )
    }
    return { status: fields[0], path: fields[1] }
  })
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

function sourceChanges(baseline, head) {
  if (
    SOURCE_CHANGE_ALLOWLIST.length !== 49 ||
    SOURCE_CHANGE_ALLOWLIST_SET.size !== 49
  ) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_SHAPE',
      'source change allowlist 必须恰好包含 49 个无重复 exact path',
    )
  }
  if (!isAncestor(baseline, head)) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_SOURCE_DIFF',
      'source head 必须是冻结 source baseline 的后代',
    )
  }
  const output = gitText(
    'diff',
    '--name-status',
    '--no-renames',
    baseline,
    head,
  )
  const changes = parseSourceDiff(output)
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
  return { changes, bindings, violations }
}

function treeIdAt(commit, path) {
  try {
    return gitText('rev-parse', `${commit}:${path}`)
  } catch {
    return null
  }
}

function collectInventory(commit, rootPath) {
  const listing = gitBuffer(
    'ls-tree',
    '-r',
    '-l',
    '-z',
    commit,
    '--',
    rootPath,
  )
    .toString('utf8')
    .split('\0')
    .filter(Boolean)

  const inventoryLines = listing.map((entry) => {
    const match = entry.match(
      /^([0-7]{6}) blob ([a-f0-9]{40})\s+([0-9]+)\t([\s\S]+)$/,
    )
    if (!match) {
      throw new GuardFailure(
        'FROZEN_EVIDENCE_SHAPE',
        `无法解析 Git tree blob：${entry}`,
      )
    }
    const [, , blobId, listedBytes, fullPath] = match
    const relativePath = fullPath.slice(rootPath.length + 1)
    if (!relativePath || !fullPath.startsWith(`${rootPath}/`)) {
      throw new GuardFailure(
        'FROZEN_EVIDENCE_SHAPE',
        `Git tree blob 不在冻结路径内：${fullPath}`,
      )
    }
    const content = gitBuffer('cat-file', 'blob', blobId)
    if (content.byteLength !== Number(listedBytes)) {
      throw new GuardFailure(
        'FROZEN_EVIDENCE_SHAPE',
        `Git blob 字节数无法复算：${fullPath}`,
      )
    }
    return `${sha256(content)}  ${content.byteLength}  ${relativePath}\n`
  })

  return {
    fileCount: inventoryLines.length,
    inventorySha256: sha256(Buffer.from(inventoryLines.join(''), 'utf8')),
  }
}

function evidenceObservations(head) {
  return FROZEN_PATHS.map((expected) => {
    const actualTreeId = treeIdAt(head, expected.path)
    const actual = collectInventory(head, expected.path)
    return {
      path: expected.path,
      expected: {
        treeId: expected.treeId,
        fileCount: expected.fileCount,
        inventorySha256: expected.inventorySha256,
      },
      actual: {
        treeId: actualTreeId,
        fileCount: actual.fileCount,
        inventorySha256: actual.inventorySha256,
      },
      matches: {
        tree: actualTreeId === expected.treeId,
        fileCount: actual.fileCount === expected.fileCount,
        inventory: actual.inventorySha256 === expected.inventorySha256,
      },
    }
  })
}

function evidenceFailureCodes(observations) {
  const codes = []
  if (observations.some((entry) => !entry.matches.tree)) {
    codes.push('FROZEN_EVIDENCE_TREE')
  }
  if (observations.some((entry) => !entry.matches.fileCount)) {
    codes.push('FROZEN_EVIDENCE_FILE_COUNT')
  }
  if (observations.some((entry) => !entry.matches.inventory)) {
    codes.push('FROZEN_EVIDENCE_INVENTORY')
  }
  return codes
}

const argv = process.argv.slice(2)
let options
let result = {
  schemaVersion: SCHEMA_VERSION,
  status: 'FAIL',
  errorCode: null,
  commandArgv: argv,
  inventoryAlgorithm:
    'sha256-lines-content-sha256-two-spaces-bytes-two-spaces-relative-path-lf-v1',
}

try {
  options = parseOptions(argv)
  const mode = options['--mode']
  const outputDestination = validateOutput(options['--output'], mode)
  const baseline = resolveCommit(options['--baseline'], 'baseline')
  const head = resolveCommit(options['--head'], 'head')
  const requiredBaseline =
    mode === 'source' ? SOURCE_BASELINE : EVIDENCE_BASELINE
  if (baseline !== requiredBaseline) {
    throw new GuardFailure(
      'FROZEN_EVIDENCE_SHAPE',
      `${mode} mode 的 baseline 必须等于 ${requiredBaseline}`,
    )
  }

  result = {
    ...result,
    mode,
    baselineSha: baseline,
    headSha: head,
  }

  if (mode === 'source') {
    const source = sourceChanges(baseline, head)
    result.observations = [
      {
        path: 'source-change-allowlist',
        allowlistCount: SOURCE_CHANGE_ALLOWLIST.length,
        changedFileCount: source.changes.length,
        changes: source.changes,
        bindings: source.bindings,
        violations: source.violations,
      },
    ]
    if (source.violations.length > 0) {
      throw new GuardFailure(
        'FROZEN_EVIDENCE_SOURCE_DIFF',
        'source baseline 与 head 不满足 49-path exact allowlist',
        { violations: source.violations },
      )
    }
    result.status = 'PASS_SOURCE_SCOPE'
  } else {
    const observations = evidenceObservations(head)
    const failureCodes = evidenceFailureCodes(observations)
    result.observations = observations
    result.failureCodes = failureCodes
    if (failureCodes.length > 0) {
      throw new GuardFailure(
        failureCodes[0],
        `冻结证据不一致：${failureCodes.join(', ')}`,
        { failureCodes },
      )
    }
    result.status = 'PASS_EVIDENCE_LINEAGE'
  }

  writeJsonGroup(
    options['--output'],
    result,
    mode,
    outputDestination,
  )
  process.stdout.write(`${JSON.stringify(result)}\n`)
} catch (error) {
  const failure =
    error instanceof GuardFailure
      ? error
      : new GuardFailure(
          'FROZEN_EVIDENCE_SHAPE',
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
