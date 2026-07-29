import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  link,
  lstat,
  open,
  readFile,
  realpath,
  unlink,
} from 'node:fs/promises'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  sep,
} from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import {
  AUTHORITY_PROFILES,
  EVIDENCE_BASELINE,
  RC9_COHORT_ROOT,
  REJECTION_AUTHORITIES,
  SOURCE_CHANGE_ALLOWLIST,
  antiPassEvidencePath,
  candidateBuildManifestPath,
  candidateManifestPath,
  candidateRoot,
  diagnosticManifestPath,
  frozenEvidenceGuardPath,
  isRecord,
  isRepoRelativePath,
  phase6IdentityFromEnvironment,
  reservedPhase6IdentityFromEnvironment,
  validateCandidateAuthority,
  validateCandidateManifest,
  validatePhase6Identity,
} from './candidate-manifest-contract.mjs'

const execFileAsync = promisify(execFile)
const SCHEMA_VERSION = 'candidate-manifest-verification-v1'
const prototypeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultRepoRoot = resolve(prototypeRoot, '..')
const fixturesRoot = join(prototypeRoot, 'tests', 'fixtures')
const manifestFixturesRoot = join(fixturesRoot, 'manifests')
const expectationsPath = join(fixturesRoot, 'fixture-expectations.json')
const CANONICAL_CM01_PATH = candidateManifestPath('CM01')
const C04_ROOT = `${RC9_COHORT_ROOT}/candidates/C04`
const HEX_64 = /^[a-f0-9]{64}$/
const GIT_SHA = /^[a-f0-9]{40}$/
const SOURCE_BASELINE = 'cd2fc9716d98c160fe530c593347992f18bf96e4'
const PLAN_REF = '52eb452a5ffec167a3809d3f372e62b9d8524124'
const REJECTED_SOURCE_SHA = 'a39c63387242b0aaea0c76c6e36cc5bdc4851909'
const EXCLUDED_C04_ANCESTORS = Object.freeze([
  '3cc6de4f6c8458f51936a893b95ea08e62bb0883',
  'bbda54826dc529ad3b93c55c4fd164463c842401',
  'b027ad8019d8fa46eaf7596c40eb28f470cc8c06',
  '6752c3b4f73a17fadcfc2420c9b9c6ededeeceb9',
])
const ISOLATION_PROFILE = 'standalone-codex-cli-v2'
const ISOLATION_CLI_BINARY =
  '/Applications/ChatGPT.app/Contents/Resources/codex'
const ISOLATION_CLI_VERSION = 'codex-cli 0.146.0-alpha.3.1'
const ISOLATION_CLI_SHA256 =
  '6d8be49e49751554df16572369e636cbe02c84b208cad3dc35528c846eeca223'
const ISOLATION_CLI_TEAM_IDENTIFIER = '2DC432GLL2'
const ISOLATION_CLI_AUTHORITY =
  'Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)'
const ISOLATION_NODE_EXECUTABLE = '/opt/homebrew/opt/node@24/bin/node'
const ISOLATION_NODE_VERSION = 'v24.18.0'
const ISOLATION_NODE_SHA256 =
  '72c18e2eeda260f67a5b2b66e96fa9b5ad82864676ebb54925695d87120cae3f'
const FROZEN_EVIDENCE = Object.freeze([
  {
    path: 'data/playtests/weekly-management-slice/gate1a/g1a-20260726-rc8-01',
    treeId: 'c5714f7ca7adb5e8fe052d4d00f27c545b988347',
    fileCount: 67,
    inventorySha256:
      '3f55528ad8993aae8646a152489227eee76c280e0ae2c2d092b57dc2ec5398e2',
  },
  {
    path: `${RC9_COHORT_ROOT}/candidates/C01`,
    treeId: '55f661518c7ed8a2cc99f0fc0f25fabecd24c286',
    fileCount: 41,
    inventorySha256:
      'fa7a926f64dfff08e2c86b1baa8f87217aecce5e99232154f534110538c2f5c6',
  },
  {
    path: `${RC9_COHORT_ROOT}/candidates/C02`,
    treeId: '9b7dbae2c0c5d1bba45399e77dac65766911d3b3',
    fileCount: 62,
    inventorySha256:
      '250a9d82e0e2056af1622bd063e806d236178e72ee93b1a6f178708d056f4664',
  },
  {
    path: `${RC9_COHORT_ROOT}/candidates/C03`,
    treeId: '6c3e5bf9bf4808724534c7c1fb472fc487a4d350',
    fileCount: 65,
    inventorySha256:
      '1c107b09ebdc4eacf0ac2bae388402aee2f12ad1dadbf081e547da66ac40462d',
  },
])

class VerificationError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function unwrap(document, kind) {
  return document?.kind === kind && isRecord(document.input)
    ? document.input
    : document
}

function parseArguments(argv) {
  const modes = argv.filter((entry) =>
    ['--fixtures', '--probe', '--manifest'].includes(entry),
  )
  if (modes.length !== 1) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_MODE',
      '必须且只能指定 --fixtures、--probe 或 --manifest 之一',
    )
  }
  const mode = modes[0].slice(2)
  const valueOptions = new Set([
    '--probe',
    '--manifest',
    '--manifest-git-sha',
    '--repo-root',
    '--output',
  ])
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index]
    if (name === '--fixtures') {
      if (Object.hasOwn(options, name)) {
        throw new VerificationError(
          'CANDIDATE_MANIFEST_MODE',
          '重复 --fixtures',
        )
      }
      options[name] = true
      continue
    }
    if (!valueOptions.has(name)) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_MODE',
        `未知参数：${name}`,
      )
    }
    const value = argv[index + 1]
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.startsWith('--') ||
      Object.hasOwn(options, name)
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_MODE',
        `缺失、重复或无效参数：${name}`,
      )
    }
    options[name] = value
    index += 1
  }
  if (
    (mode === 'probe' && !options['--probe']) ||
    (mode === 'manifest' && !options['--manifest']) ||
    (mode === 'manifest' && !options['--manifest-git-sha']) ||
    (mode !== 'manifest' && options['--manifest-git-sha']) ||
    ((mode === 'probe' || mode === 'manifest') &&
      !options['--repo-root']) ||
    !options['--output']
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_MODE',
      `${mode} 模式缺少必需参数`,
    )
  }
  const expectedOptionSets = {
    fixtures: ['--fixtures', '--output'],
    probe: ['--probe', '--repo-root', '--output'],
    manifest: [
      '--manifest',
      '--manifest-git-sha',
      '--repo-root',
      '--output',
    ],
  }
  if (
    !sameJson(
      Object.keys(options).sort(),
      [...expectedOptionSets[mode]].sort(),
    )
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_MODE',
      `${mode} 模式参数集合不精确`,
    )
  }
  return { mode, options }
}

function repoPath(repoRoot, path) {
  if (!isRepoRelativePath(path)) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_PATH',
      `不是 canonical repo-relative path：${path}`,
    )
  }
  const absolute = resolve(repoRoot, path)
  const normalized = relative(repoRoot, absolute)
  if (
    normalized === '..' ||
    normalized.startsWith(`..${sep}`) ||
    normalized.split(sep).join('/') !== path
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_PATH',
      `路径越出或不规范：${path}`,
    )
  }
  return absolute
}

function outputPath(options, repoRoot, mode) {
  const value = options['--output']
  if (mode === 'manifest') {
    return repoPath(repoRoot, value)
  }
  return isAbsolute(value) ? value : repoPath(repoRoot, value)
}

async function lstatOutputPath(path) {
  try {
    return await lstat(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw new VerificationError(
      'CANDIDATE_MANIFEST_OUTPUT_PATH',
      `无法检查 output path：${path}`,
    )
  }
}

async function pathExists(path) {
  return (await lstatOutputPath(path)) !== null
}

async function fsyncDirectory(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function displayOutputPath(path, repoRoot) {
  const normalized = relative(repoRoot, path)
  return normalized === '..' || normalized.startsWith(`..${sep}`)
    ? path
    : normalized.split(sep).join('/')
}

async function canonicalFreshTarget(path) {
  const suffix = []
  let cursor = path
  while (true) {
    const stats = await lstatOutputPath(cursor)
    if (stats) {
      try {
        return resolve(await realpath(cursor), ...suffix)
      } catch {
        throw new VerificationError(
          'CANDIDATE_MANIFEST_OUTPUT_PATH',
          `无法解析 output 既有 ancestor：${cursor}`,
        )
      }
    }
    const parent = dirname(cursor)
    if (parent === cursor) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_OUTPUT_PATH',
        `无法定位 output 既有 ancestor：${path}`,
      )
    }
    suffix.unshift(basename(cursor))
    cursor = parent
  }
}

function repoLocation(repoRoot, path) {
  const normalized = relative(repoRoot, path)
  return {
    inside:
      normalized !== '..' && !normalized.startsWith(`..${sep}`),
    relativePath: normalized.split(sep).join('/'),
  }
}

async function validatePhase6ArchivePath(repoRoot, archivePath) {
  if (
    typeof archivePath !== 'string' ||
    !isAbsolute(archivePath) ||
    resolve(archivePath) !== archivePath
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_COMMAND',
      'Phase 6 archivePath 必须是 canonical absolute path',
    )
  }
  const targetStats = await lstatOutputPath(archivePath)
  if (
    targetStats &&
    (targetStats.isSymbolicLink() || !targetStats.isFile())
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_COMMAND',
      'Phase 6 archivePath 若已存在则必须是 non-symlink regular file',
    )
  }
  let canonicalTarget
  try {
    canonicalTarget = await canonicalFreshTarget(archivePath)
  } catch {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_COMMAND',
      'Phase 6 archivePath existing ancestor 无法安全解析',
    )
  }
  const lexicalLocation = repoLocation(repoRoot, archivePath)
  const canonicalLocation = repoLocation(repoRoot, canonicalTarget)
  if (
    lexicalLocation.inside ||
    canonicalLocation.inside ||
    canonicalTarget !== archivePath
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_COMMAND',
      'Phase 6 archivePath 必须位于 repo 外且 existing ancestor 不得为 symlink：' +
        `archive=${archivePath} canonical=${canonicalTarget} ` +
        `lexicalInside=${lexicalLocation.inside} ` +
        `canonicalInside=${canonicalLocation.inside}`,
    )
  }
}

async function validateOutputDestination(path, repoRoot, mode) {
  const sidecarPath = `${path}.sha256`
  const outputExists = await pathExists(path)
  const sidecarExists = await pathExists(sidecarPath)
  if (outputExists !== sidecarExists) {
    throw new VerificationError(
      'PARTIAL_EVIDENCE_GROUP',
      `JSON/sidecar 只存在一个成员：${displayOutputPath(path, repoRoot)}`,
    )
  }
  if (outputExists) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_OUTPUT_EXISTS',
      `output group 已存在：${displayOutputPath(path, repoRoot)}`,
    )
  }
  const parent = dirname(path)
  const parentStat = await lstatOutputPath(parent)
  if (!parentStat?.isDirectory() || parentStat.isSymbolicLink()) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_OUTPUT_PATH',
      `output 父目录必须是既有普通目录：${parent}`,
    )
  }
  const canonicalTarget = await canonicalFreshTarget(path)
  const lexicalLocation = repoLocation(repoRoot, path)
  const canonicalLocation = repoLocation(repoRoot, canonicalTarget)
  if (
    (lexicalLocation.inside || canonicalLocation.inside) &&
    (lexicalLocation.inside !== canonicalLocation.inside ||
      lexicalLocation.relativePath !== canonicalLocation.relativePath)
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_OUTPUT_PATH',
      `output symlink ancestor 改变 repo namespace：${displayOutputPath(path, repoRoot)}`,
    )
  }
  const { inside: insideRepo, relativePath } = canonicalLocation
  const fixedRelativePath = {
    fixtures:
      `${C04_ROOT}/evidence/phase6-retry-02/manifest-fixtures.json`,
    probe:
      `${C04_ROOT}/evidence/phase6-retry-02/manifest-probe.json`,
  }[mode]
  const validManifestPath =
    relativePath ===
      `${C04_ROOT}/evidence/freeze-audit/full-manifest-verification.json` ||
    new RegExp(
      `^${RC9_COHORT_ROOT}/(?:evidence/reviews/IR|seals/S)` +
        '(?:0[1-9]|[1-9][0-9]+)/verifiers/' +
        'full-manifest-verification\\.json$',
    ).test(relativePath)
  if (
    insideRepo &&
    (mode === 'manifest'
      ? !validManifestPath
      : relativePath !== fixedRelativePath)
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_OUTPUT_PATH',
      `repo 内 output 不在固定 namespace：${relativePath}`,
    )
  }
  return {
    outputPath: path,
    canonicalTarget,
    insideRepo,
    relativePath,
  }
}

async function writeExclusiveGroup(
  path,
  result,
  repoRoot,
  mode,
  initialDestination,
) {
  const finalDestination = await validateOutputDestination(
    path,
    repoRoot,
    mode,
  )
  if (
    finalDestination.outputPath !== initialDestination.outputPath ||
    finalDestination.canonicalTarget !==
      initialDestination.canonicalTarget ||
    finalDestination.insideRepo !== initialDestination.insideRepo ||
    finalDestination.relativePath !== initialDestination.relativePath
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_OUTPUT_PATH',
      `output destination 在写入前发生变化：${displayOutputPath(path, repoRoot)}`,
    )
  }
  const sidecarPath = `${path}.sha256`
  const jsonBytes = Buffer.from(`${JSON.stringify(result, null, 2)}\n`, 'utf8')
  const sidecarBytes = Buffer.from(
    `${sha256(jsonBytes)}  ${displayOutputPath(path, repoRoot)}\n`,
    'utf8',
  )
  const temporaryPath = join(
    dirname(path),
    `.${posix.basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  )
  const temporarySidecarPath = `${temporaryPath}.sha256`
  let handle
  let sidecarHandle
  let jsonPublished = false
  let sidecarPublished = false
  try {
    handle = await open(temporaryPath, 'wx', 0o600)
    sidecarHandle = await open(temporarySidecarPath, 'wx', 0o600)
    await handle.writeFile(jsonBytes)
    await sidecarHandle.writeFile(sidecarBytes)
    await handle.sync()
    await sidecarHandle.sync()
    await handle.close()
    handle = undefined
    await sidecarHandle.close()
    sidecarHandle = undefined
    await fsyncDirectory(dirname(path))
    await link(temporaryPath, path)
    jsonPublished = true
    await link(temporarySidecarPath, sidecarPath)
    sidecarPublished = true
    await fsyncDirectory(dirname(path))
  } catch (error) {
    if (jsonPublished) await unlink(path).catch(() => {})
    if (sidecarPublished) await unlink(sidecarPath).catch(() => {})
    await unlink(temporaryPath).catch(() => {})
    await unlink(temporarySidecarPath).catch(() => {})
    await fsyncDirectory(dirname(path)).catch(() => {})
    const jsonRemains = await pathExists(path)
    const sidecarRemains = await pathExists(sidecarPath)
    if (jsonRemains !== sidecarRemains || jsonRemains || sidecarRemains) {
      throw new VerificationError(
        'PARTIAL_EVIDENCE_GROUP',
        `JSON/sidecar group 发布失败且有成员残留：${displayOutputPath(path, repoRoot)}`,
      )
    }
    if (error?.code === 'EEXIST') {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_OUTPUT_EXISTS',
        `output group 已存在：${displayOutputPath(path, repoRoot)}`,
      )
    }
    throw error
  } finally {
    if (handle) await handle.close()
    if (sidecarHandle) await sidecarHandle.close()
    await unlink(temporaryPath).catch(() => {})
    await unlink(temporarySidecarPath).catch(() => {})
    await fsyncDirectory(dirname(path)).catch(() => {})
  }
}

async function readJsonFile(path, code) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    throw new VerificationError(
      code,
      `${path} 无法读取或解析：${error instanceof Error ? error.message : error}`,
    )
  }
}

function parseJsonBytes(bytes, label, code) {
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new VerificationError(code, `${label} 不是有效 JSON`)
  }
}

async function git(repoRoot, args, encoding = 'utf8') {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: repoRoot,
      encoding,
      maxBuffer: 128 * 1024 * 1024,
    })
    return stdout
  } catch (error) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_GIT_BINDING',
      `git ${args.join(' ')} 失败：${error instanceof Error ? error.message : error}`,
    )
  }
}

async function resolveCommit(repoRoot, commit) {
  const observed = String(
    await git(repoRoot, ['rev-parse', '--verify', `${commit}^{commit}`]),
  ).trim()
  if (observed !== commit) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_GIT_BINDING',
      `Git SHA 不是精确 commit：${commit}`,
    )
  }
}

async function assertAncestor(repoRoot, ancestor, descendant, label) {
  try {
    await execFileAsync(
      'git',
      ['merge-base', '--is-ancestor', ancestor, descendant],
      { cwd: repoRoot },
    )
  } catch {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_GIT_BINDING',
      `${label} 拓扑无效：${ancestor} 不是 ${descendant} 的祖先`,
    )
  }
}

async function isAncestor(repoRoot, ancestor, descendant) {
  try {
    await execFileAsync(
      'git',
      ['merge-base', '--is-ancestor', ancestor, descendant],
      { cwd: repoRoot },
    )
    return true
  } catch (error) {
    if (error?.code === 1) return false
    throw new VerificationError(
      'CANDIDATE_MANIFEST_GIT_BINDING',
      `无法重放 Git ancestry：${ancestor} -> ${descendant}`,
    )
  }
}

function parseNulFields(bytes, label) {
  if (bytes.length === 0) return []
  if (bytes.at(-1) !== 0) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_GIT_BINDING',
      `${label} 不是完整 NUL-delimited Git output`,
    )
  }
  const fields = []
  let start = 0
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0) continue
    if (index === start) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_GIT_BINDING',
        `${label} 含空 Git field`,
      )
    }
    const field = bytes.subarray(start, index)
    const decoded = field.toString('utf8')
    if (!Buffer.from(decoded, 'utf8').equals(field)) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_GIT_BINDING',
        `${label} 含非 canonical UTF-8 field`,
      )
    }
    fields.push(decoded)
    start = index + 1
  }
  return fields
}

async function replayAllowlistRange(repoRoot, baseline, head, label) {
  const diffOutput = await git(
    repoRoot,
    [
      'diff',
      '--name-status',
      '-z',
      '--no-renames',
      baseline,
      head,
    ],
    'buffer',
  )
  const fields = parseNulFields(
    Buffer.isBuffer(diffOutput) ? diffOutput : Buffer.from(diffOutput),
    `${label} diff`,
  )
  if (fields.length % 2 !== 0) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_GIT_BINDING',
      `${label} diff field count 无效`,
    )
  }
  const changes = []
  const seen = new Set()
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index]
    const path = fields[index + 1]
    if (
      !['A', 'M'].includes(status) ||
      !SOURCE_CHANGE_ALLOWLIST.includes(path) ||
      seen.has(path)
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_GIT_BINDING',
        `${label} 含非 exact-49 allowlist A/M change：${status} ${path}`,
      )
    }
    seen.add(path)
    changes.push({ status, path })
  }
  const treeOutput = await git(
    repoRoot,
    [
      'ls-tree',
      '-r',
      '-z',
      '--full-tree',
      head,
      '--',
      ...SOURCE_CHANGE_ALLOWLIST,
    ],
    'buffer',
  )
  const records = parseNulFields(
    Buffer.isBuffer(treeOutput) ? treeOutput : Buffer.from(treeOutput),
    `${label} allowlist tree`,
  )
  const bindings = new Map()
  for (const record of records) {
    const match = record.match(
      /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/,
    )
    if (
      !match ||
      !SOURCE_CHANGE_ALLOWLIST.includes(match[3]) ||
      bindings.has(match[3])
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_GIT_BINDING',
        `${label} allowlist tree 含非 ordinary/duplicate blob`,
      )
    }
    bindings.set(match[3], {
      mode: match[1],
      blobId: match[2],
    })
  }
  if (
    SOURCE_CHANGE_ALLOWLIST.length !== 49 ||
    new Set(SOURCE_CHANGE_ALLOWLIST).size !== 49 ||
    bindings.size !== 49
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_GIT_BINDING',
      `${label} 未绑定完整 49-path allowlist`,
    )
  }
  return { changes, bindings }
}

async function replayC04Topology(repoRoot, input) {
  if (input.sourceSha === REJECTED_SOURCE_SHA) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_GIT_BINDING',
      'C04 source 不得复用 A02 source',
    )
  }
  await assertAncestor(repoRoot, PLAN_REF, input.sourceSha, 'plan_ref -> S')
  await assertAncestor(
    repoRoot,
    SOURCE_BASELINE,
    input.sourceSha,
    'source baseline -> S',
  )
  await assertAncestor(
    repoRoot,
    EVIDENCE_BASELINE,
    input.dependencyIntegrationSha,
    'evidence baseline -> I',
  )
  for (const excluded of EXCLUDED_C04_ANCESTORS) {
    if (
      (await isAncestor(repoRoot, excluded, input.sourceSha)) ||
      (await isAncestor(
        repoRoot,
        excluded,
        input.dependencyIntegrationSha,
      ))
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_GIT_BINDING',
        `失败尝试 commit 不得成为 S/I ancestor：${excluded}`,
      )
    }
  }
  const source = await replayAllowlistRange(
    repoRoot,
    SOURCE_BASELINE,
    input.sourceSha,
    'source baseline -> S',
  )
  const integration = await replayAllowlistRange(
    repoRoot,
    EVIDENCE_BASELINE,
    input.dependencyIntegrationSha,
    'evidence baseline -> I',
  )
  for (const path of SOURCE_CHANGE_ALLOWLIST) {
    if (
      !sameJson(
        source.bindings.get(path),
        integration.bindings.get(path),
      )
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_GIT_BINDING',
        `S/I allowlist mode/blob 不一致：${path}`,
      )
    }
  }
  return {
    planRef: PLAN_REF,
    sourceBaseline: SOURCE_BASELINE,
    evidenceBaseline: EVIDENCE_BASELINE,
    sourceChangedPaths: source.changes,
    integrationChangedPaths: integration.changes,
    allowlistCount: SOURCE_CHANGE_ALLOWLIST.length,
    excludedAncestors: EXCLUDED_C04_ANCESTORS,
  }
}

async function gitBlob(repoRoot, commit, path) {
  if (!isRepoRelativePath(path)) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_PATH',
      `Git binding path 不规范：${path}`,
    )
  }
  const listing = String(
    await git(repoRoot, ['ls-tree', commit, '--', path]),
  ).trim()
  const match = listing.match(
    /^(100644|100755) blob [a-f0-9]{40}\t(.+)$/,
  )
  if (!match || match[2] !== path) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_GIT_BINDING',
      `${commit}:${path} 不是唯一普通 Git blob`,
    )
  }
  const stdout = await git(
    repoRoot,
    ['show', `${commit}:${path}`],
    'buffer',
  )
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout)
}

async function bindGitBlob(
  repoRoot,
  commit,
  path,
  expectedHash,
  code,
) {
  const bytes = await gitBlob(repoRoot, commit, path)
  const observedHash = sha256(bytes)
  if (observedHash !== expectedHash) {
    throw new VerificationError(
      code,
      `${path} hash mismatch expected=${expectedHash} observed=${observedHash}`,
    )
  }
  return {
    path,
    sha256: observedHash,
    bytes: bytes.length,
    content: bytes,
  }
}

async function bindGitSidecar(
  repoRoot,
  commit,
  targetPath,
  targetHash,
  code,
) {
  const sidecarPath = `${targetPath}.sha256`
  const expectedBytes = Buffer.from(
    `${targetHash}  ${targetPath}\n`,
    'utf8',
  )
  const binding = await bindGitBlob(
    repoRoot,
    commit,
    sidecarPath,
    sha256(expectedBytes),
    code,
  )
  if (!binding.content.equals(expectedBytes)) {
    throw new VerificationError(
      code,
      `${sidecarPath} 内容与 target hash/path 不一致`,
    )
  }
  return binding
}

async function bindWorktreeFile(repoRoot, path, expectedHash, code) {
  const absolutePath = repoPath(repoRoot, path)
  const stat = await lstat(absolutePath).catch(() => null)
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new VerificationError(
      code,
      `${path} 必须是工作树普通文件且不得为 symlink`,
    )
  }
  const bytes = await readFile(absolutePath).catch((error) => {
    throw new VerificationError(
      code,
      `${path} 无法读取：${error instanceof Error ? error.message : error}`,
    )
  })
  const observedHash = sha256(bytes)
  if (observedHash !== expectedHash) {
    throw new VerificationError(
      code,
      `${path} hash mismatch expected=${expectedHash} observed=${observedHash}`,
    )
  }
  return {
    path,
    sha256: observedHash,
    bytes: bytes.length,
  }
}

function publicBinding(binding, extra = {}) {
  return {
    ...extra,
    path: binding.path,
    sha256: binding.sha256,
    bytes: binding.bytes,
  }
}

function assertEqual(actual, expected, label, code = 'CANDIDATE_MANIFEST_EVIDENCE') {
  if (actual !== expected) {
    throw new VerificationError(
      code,
      `${label} mismatch expected=${expected} observed=${actual}`,
    )
  }
}

function assertBuildIdentity(document, input, label) {
  assertEqual(document.candidateAttempt, input.candidateAttempt, `${label}.candidateAttempt`)
  assertEqual(document.sourceSha, input.sourceSha, `${label}.sourceSha`)
  assertEqual(
    document.dependencyIntegrationSha,
    input.dependencyIntegrationSha,
    `${label}.dependencyIntegrationSha`,
  )
  assertEqual(document.buildId, input.buildId, `${label}.buildId`)
  assertEqual(document.scenarioId, input.scenarioId, `${label}.scenarioId`)
  assertEqual(
    document.scenarioVersion,
    input.scenarioVersion,
    `${label}.scenarioVersion`,
  )
  assertEqual(
    document.protocolVersion,
    input.protocolVersion,
    `${label}.protocolVersion`,
  )
  assertEqual(
    document.playtestSchemaVersion ?? document.schemaVersion,
    input.schemaVersion,
    `${label}.playtestSchemaVersion`,
  )
}

async function runFixtures() {
  const expectations = await readJsonFile(
    expectationsPath,
    'CANDIDATE_MANIFEST_FIXTURES',
  )
  const rows = []
  const failures = []
  for (const expectation of expectations.fixtures ?? []) {
    if (!expectation.file?.startsWith('manifests/')) continue
    const fixture = await readJsonFile(
      join(fixturesRoot, expectation.file),
      'CANDIDATE_MANIFEST_FIXTURES',
    )
    if (
      !['candidate-manifest', 'candidate-authority-probe'].includes(
        fixture.kind,
      )
    ) {
      continue
    }
    const validation =
      fixture.kind === 'candidate-manifest'
        ? validateCandidateManifest(fixture.input)
        : validateCandidateAuthority(fixture.input)
    const actual = {
      accepted: validation.accepted,
      errorCode: validation.errorCode,
    }
    const expected = {
      accepted: expectation.assertions.accepted,
      errorCode: expectation.assertions.errorCode,
    }
    rows.push({ file: expectation.file, ...actual })
    if (!sameJson(actual, expected)) {
      failures.push({ file: expectation.file, expected, actual })
    }
  }
  if (failures.length > 0) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_FIXTURES',
      JSON.stringify(failures),
    )
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    status: 'PASS_FIXTURES',
    accepted: true,
    fullManifestVerified: false,
    fixtureCount: rows.length,
    fixtures: rows,
  }
}

async function verifyAuthorityWorktree(input, repoRoot) {
  const validation = validateCandidateAuthority(input)
  if (!validation.accepted) {
    throw new VerificationError(
      validation.errorCode,
      'authority profile contract rejected input',
    )
  }
  const bindings = []
  for (const entry of input.authorityHashes) {
    const binding = await bindWorktreeFile(
      repoRoot,
      entry.path,
      entry.sha256,
      'CANDIDATE_MANIFEST_AUTHORITY',
    )
    bindings.push(publicBinding(binding, { role: entry.role }))
  }
  return { validation, bindings }
}

async function verifyAuthorityGit(input, repoRoot) {
  const validation = validateCandidateAuthority(input)
  if (!validation.accepted) {
    throw new VerificationError(
      validation.errorCode,
      'authority profile contract rejected input',
    )
  }
  const bindings = []
  for (const entry of input.authorityHashes) {
    const integrationBinding = await bindGitBlob(
      repoRoot,
      input.dependencyIntegrationSha,
      entry.path,
      entry.sha256,
      'CANDIDATE_MANIFEST_AUTHORITY',
    )
    const binding = await bindGitBlob(
      repoRoot,
      input.candidateEvidenceSnapshotSha,
      entry.path,
      entry.sha256,
      'CANDIDATE_MANIFEST_AUTHORITY',
    )
    if (!binding.content.equals(integrationBinding.content)) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_AUTHORITY',
        `${entry.role} authority 在 I/E 之间发生变化`,
      )
    }
    bindings.push(
      publicBinding(binding, {
        role: entry.role,
        integrationSha: input.dependencyIntegrationSha,
        evidenceSnapshotSha: input.candidateEvidenceSnapshotSha,
      }),
    )
  }
  return { validation, bindings }
}

async function runProbe(repoRoot, options, resolvedOutputPath) {
  const probePath = resolve(options['--probe'])
  const probeStat = await lstat(probePath).catch(() => null)
  if (!probeStat?.isFile() || probeStat.isSymbolicLink()) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_PROBE',
      'probe input 必须是普通文件且不得为 symlink',
    )
  }
  const outputRelativeToInputDirectory = relative(
    dirname(probePath),
    resolvedOutputPath,
  )
  if (
    probePath === resolvedOutputPath ||
    outputRelativeToInputDirectory === '' ||
    (!outputRelativeToInputDirectory.startsWith(`..${sep}`) &&
      outputRelativeToInputDirectory !== '..')
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_SELF_REFERENCE',
      'probe output 不得等于 input 或位于 input 目录',
    )
  }
  const document = await readJsonFile(
    probePath,
    'CANDIDATE_MANIFEST_PROBE',
  )
  const input = unwrap(document, 'candidate-authority-probe')
  const { validation, bindings } = await verifyAuthorityWorktree(
    input,
    repoRoot,
  )
  for (const entry of input.authorityHashes) {
    if (repoPath(repoRoot, entry.path) === resolvedOutputPath) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_SELF_REFERENCE',
        `probe output alias authority：${entry.role}`,
      )
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    status: 'PASS_AUTHORITY_PREFLIGHT',
    accepted: true,
    fullManifestVerified: false,
    ...validation.summary,
    authorityBindings: bindings,
  }
}

function evidenceInventoryHash(diagnosticManifest, relativePath) {
  const entries = diagnosticManifest.evidenceInventory ?? []
  const match = entries.filter((entry) => entry.path === relativePath)
  if (
    match.length !== 1 ||
    !HEX_64.test(match[0].sha256 ?? '')
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
      `diagnostics evidenceInventory 缺失或重复：${relativePath}`,
    )
  }
  return match[0].sha256
}

async function verifyDiagnosticSamples(
  repoRoot,
  input,
  diagnosticManifest,
  inputAliases,
) {
  const diagnosticRoot = posix.dirname(input.diagnosticManifest.path)
  const evidenceSha = input.candidateEvidenceSnapshotSha
  const bindings = []
  for (const sampleId of input.diagnosticManifest.sampleIds) {
    const sampleSummary = diagnosticManifest.samples?.find(
      (entry) => entry.sampleId === sampleId,
    )
    if (
      !isRecord(sampleSummary) ||
      sampleSummary.status !== 'VALID_DIAGNOSTIC' ||
      sampleSummary.includedInDiagnosticMedian !== true ||
      sampleSummary.includedInGate1ADenominator !== false
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_DIAGNOSTIC',
        `${sampleId} diagnostics summary 无效`,
      )
    }
    const sampleRelativePath = `${sampleId}/sample-record.json`
    const samplePath = `${diagnosticRoot}/${sampleRelativePath}`
    const expectedSampleHash = evidenceInventoryHash(
      diagnosticManifest,
      sampleRelativePath,
    )
    const sampleBinding = await bindGitBlob(
      repoRoot,
      evidenceSha,
      samplePath,
      expectedSampleHash,
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
    )
    inputAliases.add(samplePath)
    const sampleRecord = parseJsonBytes(
      sampleBinding.content,
      samplePath,
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
    )
    assertEqual(sampleRecord.sampleId, sampleId, `${sampleId}.sampleId`)
    assertEqual(
      sampleRecord.candidateAttempt,
      input.candidateAttempt,
      `${sampleId}.candidateAttempt`,
    )
    assertEqual(
      sampleRecord.validityDecision?.status,
      'VALID_DIAGNOSTIC',
      `${sampleId}.validityDecision.status`,
    )
    assertEqual(
      sampleRecord.validityDecision?.includedInGate1ADenominator,
      false,
      `${sampleId}.includedInGate1ADenominator`,
    )
    const release = sampleRecord.releaseCandidate
    assertEqual(release?.buildId, input.buildId, `${sampleId}.buildId`)
    assertEqual(release?.gitSha, input.sourceSha, `${sampleId}.sourceSha`)
    assertEqual(
      release?.dependencyIntegrationSha,
      input.dependencyIntegrationSha,
      `${sampleId}.dependencyIntegrationSha`,
    )
    assertEqual(
      release?.candidateBuildManifestHash,
      input.candidateAttemptManifestHash,
      `${sampleId}.candidateBuildManifestHash`,
    )
    assertEqual(release?.artifactHash, input.artifactHash, `${sampleId}.artifactHash`)
    assertEqual(release?.archiveHash, input.archiveHash, `${sampleId}.archiveHash`)
    assertEqual(release?.scenarioId, input.scenarioId, `${sampleId}.scenarioId`)
    assertEqual(
      release?.scenarioVersion,
      input.scenarioVersion,
      `${sampleId}.scenarioVersion`,
    )
    assertEqual(
      release?.protocolVersion,
      input.protocolVersion,
      `${sampleId}.protocolVersion`,
    )

    const identity = sampleRecord.identityAndIsolation
    if (
      !isRecord(identity) ||
      identity.diagnosticIsolationProfile !== ISOLATION_PROFILE ||
      identity.agentCliBinaryPath !== ISOLATION_CLI_BINARY ||
      identity.agentCliVersion !== ISOLATION_CLI_VERSION ||
      identity.agentCliBinarySha256 !== ISOLATION_CLI_SHA256 ||
      identity.agentCliTeamIdentifier !==
        ISOLATION_CLI_TEAM_IDENTIFIER ||
      identity.agentCliAuthority !== ISOLATION_CLI_AUTHORITY ||
      !HEX_64.test(identity.isolationPreflightHash ?? '') ||
      !HEX_64.test(identity.isolationVerificationHash ?? '') ||
      !HEX_64.test(identity.canonicalInputHash ?? '')
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_DIAGNOSTIC',
        `${sampleId} isolation identity binding 无效`,
      )
    }
    const canonicalInputPath =
      `${diagnosticRoot}/${sampleId}/diagnostic-isolation-input.json`
    const canonicalInputSidecarPath = `${canonicalInputPath}.sha256`
    const verificationPath =
      `${candidateRoot(input.candidateAttempt)}/evidence/diagnostic-isolation/${sampleId}-verification.json`
    const verificationSidecarPath = `${verificationPath}.sha256`
    assertEqual(
      identity.canonicalInputPath,
      canonicalInputPath,
      `${sampleId}.canonicalInputPath`,
    )
    const canonicalInputBinding = await bindGitBlob(
      repoRoot,
      evidenceSha,
      canonicalInputPath,
      identity.canonicalInputHash,
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
    )
    const verificationBinding = await bindGitBlob(
      repoRoot,
      evidenceSha,
      verificationPath,
      identity.isolationVerificationHash,
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
    )
    const canonicalInputSidecarBytes = Buffer.from(
      `${identity.canonicalInputHash}  ${canonicalInputPath}\n`,
      'utf8',
    )
    const verificationSidecarBytes = Buffer.from(
      `${identity.isolationVerificationHash}  ${verificationPath}\n`,
      'utf8',
    )
    const canonicalInputSidecarBinding = await bindGitBlob(
      repoRoot,
      evidenceSha,
      canonicalInputSidecarPath,
      sha256(canonicalInputSidecarBytes),
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
    )
    const verificationSidecarBinding = await bindGitBlob(
      repoRoot,
      evidenceSha,
      verificationSidecarPath,
      sha256(verificationSidecarBytes),
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
    )
    if (
      !canonicalInputSidecarBinding.content.equals(
        canonicalInputSidecarBytes,
      ) ||
      !verificationSidecarBinding.content.equals(verificationSidecarBytes)
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_DIAGNOSTIC',
        `${sampleId} isolation sidecar 内容无效`,
      )
    }
    inputAliases.add(canonicalInputPath)
    inputAliases.add(canonicalInputSidecarPath)
    inputAliases.add(verificationPath)
    inputAliases.add(verificationSidecarPath)
    const canonicalInput = parseJsonBytes(
      canonicalInputBinding.content,
      canonicalInputPath,
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
    )
    assertEqual(canonicalInput.sampleId, sampleId, `${sampleId}.input.sampleId`)
    assertEqual(
      canonicalInput.preflight?.diagnosticIsolationProfile,
      ISOLATION_PROFILE,
      `${sampleId}.input.profile`,
    )
    assertEqual(
      canonicalInput.preflight?.cliBinaryPath,
      ISOLATION_CLI_BINARY,
      `${sampleId}.input.cliBinaryPath`,
    )
    assertEqual(
      canonicalInput.preflight?.agentCliVersion,
      ISOLATION_CLI_VERSION,
      `${sampleId}.input.agentCliVersion`,
    )
    assertEqual(
      canonicalInput.preflight?.cliBinarySha256,
      ISOLATION_CLI_SHA256,
      `${sampleId}.input.cliBinarySha256`,
    )
    assertEqual(
      canonicalInput.preflight?.cliTeamIdentifier,
      ISOLATION_CLI_TEAM_IDENTIFIER,
      `${sampleId}.input.cliTeamIdentifier`,
    )
    assertEqual(
      canonicalInput.preflight?.cliAuthority,
      ISOLATION_CLI_AUTHORITY,
      `${sampleId}.input.cliAuthority`,
    )
    assertEqual(
      canonicalInput.preflight?.nodeExecutable,
      ISOLATION_NODE_EXECUTABLE,
      `${sampleId}.input.nodeExecutable`,
    )
    assertEqual(
      canonicalInput.preflight?.nodeVersion,
      ISOLATION_NODE_VERSION,
      `${sampleId}.input.nodeVersion`,
    )
    assertEqual(
      canonicalInput.preflight?.nodeBinarySha256,
      ISOLATION_NODE_SHA256,
      `${sampleId}.input.nodeBinarySha256`,
    )
    assertEqual(
      canonicalInput.identityAndIsolation?.agentSessionId,
      identity.agentSessionId,
      `${sampleId}.input.agentSessionId`,
    )
    assertEqual(
      sha256(canonicalJson(canonicalInput.preflight)),
      identity.isolationPreflightHash,
      `${sampleId}.isolationPreflightHash`,
    )
    assertEqual(
      verificationBinding.sha256,
      identity.isolationVerificationHash,
      `${sampleId}.isolationVerificationHash`,
    )
    const verification = parseJsonBytes(
      verificationBinding.content,
      verificationPath,
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
    )
    assertEqual(
      verification.schemaVersion,
      'new-era-diagnostic-isolation-result-v2',
      `${sampleId}.isolation schema`,
    )
    assertEqual(verification.accepted, true, `${sampleId}.isolation accepted`)
    assertEqual(
      verification.status,
      'PASS_DIAGNOSTIC_ISOLATION',
      `${sampleId}.isolation status`,
    )
    assertEqual(
      verification.summary?.sampleId,
      sampleId,
      `${sampleId}.isolation sampleId`,
    )
    assertEqual(
      verification.summary?.canonicalInputPath,
      canonicalInputPath,
      `${sampleId}.verification.canonicalInputPath`,
    )
    assertEqual(
      verification.summary?.canonicalInputHash,
      identity.canonicalInputHash,
      `${sampleId}.verification.canonicalInputHash`,
    )
    for (const field of [
      'agentSessionId',
      'privateRolloutObjectId',
      'privateCliEventObjectId',
      'agentRolloutSha256',
      'agentRolloutStructuralEvidencePath',
      'agentRolloutStructuralEvidenceHash',
      'cliEventStructuralEvidencePath',
      'cliEventStructuralEvidenceHash',
      'browserContextId',
      'browserPageId',
      'isolationPreflightHash',
      'agentCliBinaryPath',
      'agentCliVersion',
      'agentCliBinarySha256',
      'agentCliTeamIdentifier',
      'agentCliAuthority',
    ]) {
      assertEqual(
        verification.summary?.[field],
        identity[field],
        `${sampleId}.identity.${field}`,
      )
    }
    const structuralBindings = []
    for (const [pathField, hashField] of [
      [
        'agentRolloutStructuralEvidencePath',
        'agentRolloutStructuralEvidenceHash',
      ],
      [
        'cliEventStructuralEvidencePath',
        'cliEventStructuralEvidenceHash',
      ],
    ]) {
      const structuralPath = identity[pathField]
      if (
        !isRepoRelativePath(structuralPath) ||
        !structuralPath.startsWith(`${diagnosticRoot}/${sampleId}/`)
      ) {
        throw new VerificationError(
          'CANDIDATE_MANIFEST_DIAGNOSTIC',
          `${sampleId}.${pathField} 不是 canonical sample path`,
        )
      }
      const structuralBinding = await bindGitBlob(
        repoRoot,
        evidenceSha,
        structuralPath,
        identity[hashField],
        'CANDIDATE_MANIFEST_DIAGNOSTIC',
      )
      inputAliases.add(structuralPath)
      structuralBindings.push(publicBinding(structuralBinding))
    }
    const validityRelativePath = `${sampleId}/validity-decision.md`
    const validityPath = `${diagnosticRoot}/${validityRelativePath}`
    const validityBinding = await bindGitBlob(
      repoRoot,
      evidenceSha,
      validityPath,
      evidenceInventoryHash(diagnosticManifest, validityRelativePath),
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
    )
    inputAliases.add(validityPath)
    bindings.push({
      sampleId,
      sampleRecord: publicBinding(sampleBinding),
      canonicalInput: publicBinding(canonicalInputBinding),
      canonicalInputSidecar: publicBinding(canonicalInputSidecarBinding),
      isolationVerification: publicBinding(verificationBinding),
      isolationVerificationSidecar: publicBinding(
        verificationSidecarBinding,
      ),
      structuralEvidence: structuralBindings,
      validityDecision: publicBinding(validityBinding),
    })
  }
  return bindings
}

async function verifyAntiPass(
  repoRoot,
  input,
  inputAliases,
) {
  const bindings = []
  const evidenceSha = input.candidateEvidenceSnapshotSha
  for (const entry of input.antiPass) {
    const binding = await bindGitBlob(
      repoRoot,
      evidenceSha,
      entry.evidencePath,
      entry.evidenceHash,
      'CANDIDATE_MANIFEST_ANTI_PASS',
    )
    inputAliases.add(entry.evidencePath)
    const evidence = parseJsonBytes(
      binding.content,
      entry.evidencePath,
      'CANDIDATE_MANIFEST_ANTI_PASS',
    )
    assertEqual(evidence.sampleId, entry.sampleId, `${entry.sampleId}.sampleId`)
    assertEqual(
      evidence.schemaVersion,
      'gate1-rc9-anti-pass-result-v1',
      `${entry.sampleId}.schemaVersion`,
    )
    assertEqual(evidence.status, 'PASS', `${entry.sampleId}.status`)
    assertEqual(
      evidence.candidateAttempt,
      input.candidateAttempt,
      `${entry.sampleId}.candidateAttempt`,
    )
    assertEqual(evidence.buildId, input.buildId, `${entry.sampleId}.buildId`)
    assertEqual(evidence.sourceSha, input.sourceSha, `${entry.sampleId}.sourceSha`)
    assertEqual(
      evidence.artifactHash,
      input.artifactHash,
      `${entry.sampleId}.artifactHash`,
    )
    assertEqual(
      evidence.sessionAuthority?.diagnosisId,
      entry.sampleId,
      `${entry.sampleId}.sessionAuthority`,
    )
    assertEqual(
      evidence.sessionAuthority?.candidateBuildAuthorityHash,
      input.artifactHash,
      `${entry.sampleId}.candidateBuildAuthorityHash`,
    )
    assertEqual(
      evidence.sessionAuthority?.applicationSessionCount,
      1,
      `${entry.sampleId}.applicationSessionCount`,
    )
    const machine = evidence.machineEvidence
    if (!isRecord(machine)) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ANTI_PASS',
        `${entry.sampleId}.machineEvidence 缺失`,
      )
    }
    const evidenceRoot = posix.dirname(entry.evidencePath)
    const paths = {
      raw: `${evidenceRoot}/${machine.serverRawPath}`,
      sidecar: `${evidenceRoot}/${machine.sha256SidecarPath}`,
      receipt: `${evidenceRoot}/${machine.receiptPath}`,
      browser: `${evidenceRoot}/${machine.browserDownloadPath}`,
    }
    if (
      Object.values(paths).some(
        (path) =>
          !isRepoRelativePath(path) ||
          !path.startsWith(`${evidenceRoot}/`),
      )
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ANTI_PASS',
        `${entry.sampleId} machine evidence path 不规范`,
      )
    }
    const raw = await bindGitBlob(
      repoRoot,
      evidenceSha,
      paths.raw,
      machine.serverRawSha256,
      'CANDIDATE_MANIFEST_ANTI_PASS',
    )
    const sidecar = await bindGitBlob(
      repoRoot,
      evidenceSha,
      paths.sidecar,
      machine.sha256SidecarSha256,
      'CANDIDATE_MANIFEST_ANTI_PASS',
    )
    const receipt = await bindGitBlob(
      repoRoot,
      evidenceSha,
      paths.receipt,
      machine.receiptSha256,
      'CANDIDATE_MANIFEST_ANTI_PASS',
    )
    const browser = await bindGitBlob(
      repoRoot,
      evidenceSha,
      paths.browser,
      machine.browserDownloadSha256,
      'CANDIDATE_MANIFEST_ANTI_PASS',
    )
    Object.values(paths).forEach((path) => inputAliases.add(path))
    assertEqual(raw.bytes, machine.serverRawBytes, `${entry.sampleId}.raw bytes`)
    assertEqual(browser.bytes, machine.browserDownloadBytes, `${entry.sampleId}.download bytes`)
    if (!raw.content.equals(browser.content)) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ANTI_PASS',
        `${entry.sampleId} raw/download 不一致`,
      )
    }
    const sidecarHash = sidecar.content
      .toString('utf8')
      .trim()
      .split(/\s+/)[0]
    assertEqual(sidecarHash, raw.sha256, `${entry.sampleId}.sidecar claim`)
    const receiptDocument = parseJsonBytes(
      receipt.content,
      paths.receipt,
      'CANDIDATE_MANIFEST_ANTI_PASS',
    )
    assertEqual(receiptDocument.sha256, raw.sha256, `${entry.sampleId}.receipt hash`)
    assertEqual(receiptDocument.bytes, raw.bytes, `${entry.sampleId}.receipt bytes`)
    assertEqual(receiptDocument.sampleId, entry.sampleId, `${entry.sampleId}.receipt sample`)
    assertEqual(receiptDocument.buildId, input.buildId, `${entry.sampleId}.receipt build`)
    assertEqual(receiptDocument.gitSha, input.sourceSha, `${entry.sampleId}.receipt source`)
    assertEqual(receiptDocument.artifactHash, input.artifactHash, `${entry.sampleId}.receipt artifact`)
    if (
      machine.allClaimsMatchServerRaw !== true ||
      machine.browserDownloadSha256 !== raw.sha256
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ANTI_PASS',
        `${entry.sampleId} 四方一致性声明无效`,
      )
    }
    const rawDocument = parseJsonBytes(
      raw.content,
      paths.raw,
      'CANDIDATE_MANIFEST_ANTI_PASS',
    )
    assertEqual(rawDocument.schemaVersion, input.schemaVersion, `${entry.sampleId}.raw schema`)
    assertEqual(rawDocument.meta?.sampleId, entry.sampleId, `${entry.sampleId}.raw sampleId`)
    assertEqual(rawDocument.meta?.diagnosisId, entry.sampleId, `${entry.sampleId}.raw diagnosisId`)
    assertEqual(rawDocument.meta?.buildId, input.buildId, `${entry.sampleId}.raw buildId`)
    assertEqual(rawDocument.meta?.gitSha, input.sourceSha, `${entry.sampleId}.raw sourceSha`)
    assertEqual(rawDocument.meta?.artifactHash, input.artifactHash, `${entry.sampleId}.raw artifactHash`)
    assertEqual(rawDocument.meta?.scenarioId, input.scenarioId, `${entry.sampleId}.raw scenarioId`)
    assertEqual(rawDocument.meta?.scenarioVersion, input.scenarioVersion, `${entry.sampleId}.raw scenarioVersion`)
    assertEqual(rawDocument.meta?.protocolVersion, input.protocolVersion, `${entry.sampleId}.raw protocolVersion`)
    assertEqual(rawDocument.finalTick, 2010, `${entry.sampleId}.raw finalTick`)
    const expectedPathKind =
      entry.sampleId === 'TECH-RC9-P07'
        ? 'prominent-cta-and-repeat-submit'
        : 'minimal-intervention-and-invalid-consequence'
    const expectedCounts =
      entry.sampleId === 'TECH-RC9-P07' ? [1, 1] : [0, 0]
    assertEqual(evidence.pathKind, expectedPathKind, `${entry.sampleId}.pathKind`)
    const actions = rawDocument.actions
    const commitments = rawDocument.managementChoiceCommitmentsV03
    const opportunities = rawDocument.managementChoiceOpportunitiesV03
    if (
      !Array.isArray(actions) ||
      !Array.isArray(commitments) ||
      !Array.isArray(opportunities) ||
      opportunities.length !== 2
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ANTI_PASS',
        `${entry.sampleId} raw canonical ledger 缺失`,
      )
    }
    const commitmentActions = actions.filter(
      (action) => action?.type === 'COMMIT_MANAGEMENT_CHOICE',
    )
    const actionIds = commitmentActions.map((action) => action.id)
    const commitmentIds = commitments.map((commitment) => commitment.actionId)
    if (
      new Set(actionIds).size !== actionIds.length ||
      new Set(commitmentIds).size !== commitmentIds.length ||
      !sameJson([...actionIds].sort(), [...commitmentIds].sort()) ||
      commitments.some(
        (commitment) =>
          ![0, 1].includes(commitment?.week) ||
          commitment.commitCause !== 'explicit-candidate-action' ||
          commitment.diagnosisId !== entry.sampleId ||
          commitment.sessionId !== rawDocument.meta?.sessionId ||
          commitment.candidateBuildAuthorityHash !== input.artifactHash ||
          typeof commitment.idempotencyKey !== 'string',
      ) ||
      new Set(commitments.map((commitment) => commitment.idempotencyKey))
        .size !== commitments.length
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ANTI_PASS',
        `${entry.sampleId} raw actions 与 canonical ledger 不一致或重复补计`,
      )
    }
    const observedCounts = [0, 1].map(
      (week) =>
        commitments.filter((commitment) => commitment.week === week).length,
    )
    if (!sameJson(observedCounts, expectedCounts)) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ANTI_PASS',
        `${entry.sampleId} terminal count mismatch expected=${expectedCounts.join('/')} observed=${observedCounts.join('/')}`,
      )
    }
    for (const week of [0, 1]) {
      const opportunity = opportunities.find(
        (candidate) => candidate?.week === week,
      )
      if (
        !opportunity ||
        (expectedCounts[week] === 0 &&
          (opportunity.terminalState !== 'omitted' ||
            opportunity.committedAtSequence !== null)) ||
        (expectedCounts[week] === 1 &&
          (opportunity.terminalState === 'omitted' ||
            !Number.isSafeInteger(opportunity.committedAtSequence)))
      ) {
        throw new VerificationError(
          'CANDIDATE_MANIFEST_ANTI_PASS',
          `${entry.sampleId} W${week + 1} terminal 与重算计数不一致`,
        )
      }
    }
    const assertions = evidence.assertions
    const assertedCounts =
      entry.sampleId === 'TECH-RC9-P07'
        ? [
            assertions?.w1ExplicitCommitmentCount,
            assertions?.w2ExplicitCommitmentCount,
          ]
        : [
            assertions?.w1C03TerminalCommitmentCount,
            assertions?.w2C03TerminalCommitmentCount,
          ]
    if (
      !sameJson(assertedCounts, expectedCounts) ||
      assertions?.canonicalTerminalCommitmentCount !==
        expectedCounts[0] + expectedCounts[1] ||
      assertions?.finalTick !== 2010 ||
      assertions?.twoWeeksCompleted !== true ||
      assertions?.recapCount !== 2
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ANTI_PASS',
        `${entry.sampleId} assertions 与 raw 重算不一致`,
      )
    }
    if (
      entry.sampleId === 'TECH-RC9-P07' &&
      [
        assertions.summaryCtaCommitmentDelta,
        assertions.openCloseLocateExpandCommitmentDelta,
        assertions.containerEnterSpaceCommitmentDelta,
        assertions.continueCommitmentDelta,
        assertions.w1RepeatCommitmentDelta,
        assertions.w2RepeatCommitmentDelta,
        assertions.reloadCommitmentDelta,
        assertions.identicalExportRetryCommitmentDelta,
        evidence.runtimeAntiPass?.directScheduleEdits?.w1Count,
        evidence.runtimeAntiPass?.directScheduleEdits?.w2CountAtDeadline,
      ].some((value) => value !== 0)
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ANTI_PASS',
        `${entry.sampleId} 非显式路线发生补计`,
      )
    }
    if (
      !Array.isArray(evidence.validationCommands) ||
      evidence.validationCommands.some((command) => command?.status !== 'PASS') ||
      !evidence.validationCommands.some(
        (command) =>
          String(command.id).includes('ledger-validator') &&
          command.terminalCommitmentCount ===
            expectedCounts[0] + expectedCounts[1],
      ) ||
      evidence.hostStopped !== true ||
      evidence.sessionCleared !== true
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ANTI_PASS',
        `${entry.sampleId} host/ledger validator 合同不完整`,
      )
    }
    bindings.push({
      sampleId: entry.sampleId,
      result: publicBinding(binding),
      raw: publicBinding(raw),
      sidecar: publicBinding(sidecar),
      receipt: publicBinding(receipt),
      browserDownload: publicBinding(browser),
    })
  }
  return bindings
}

function parseTarArchive(bytes, expectedEpoch) {
  if (bytes.length === 0 || bytes.length % 512 !== 0) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_ARCHIVE',
      'archive 长度不是完整的 512-byte blocks',
    )
  }
  const entries = []
  const seenPaths = new Set()
  let offset = 0
  let zeroBlocks = 0
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512)
    if (header.every((value) => value === 0)) {
      zeroBlocks += 1
      offset += 512
      if (zeroBlocks === 2) break
      continue
    }
    zeroBlocks = 0
    const text = (start, length) =>
      header
        .subarray(start, start + length)
        .toString('utf8')
        .replace(/\0.*$/s, '')
    const name = text(0, 100)
    const prefix = text(345, 155)
    const path = prefix ? `${prefix}/${name}` : name
    const sizeField = header.subarray(124, 136).toString('ascii')
    const mtimeField = header.subarray(136, 148).toString('ascii')
    const modeField = header.subarray(100, 108).toString('ascii')
    const uidField = header.subarray(108, 116).toString('ascii')
    const gidField = header.subarray(116, 124).toString('ascii')
    const sizeText = sizeField.replace(/\0$/, '')
    const size = Number.parseInt(sizeText || '0', 8)
    const mtime = Number.parseInt(mtimeField.replace(/\0$/, '') || '0', 8)
    const mode = Number.parseInt(modeField.replace(/\0$/, '') || '0', 8)
    const uid = Number.parseInt(uidField.replace(/\0$/, '') || '0', 8)
    const gid = Number.parseInt(gidField.replace(/\0$/, '') || '0', 8)
    const type = String.fromCharCode(header[156])
    const checksumField = header.subarray(148, 156).toString('ascii')
    const checksumText = checksumField.slice(0, 6)
    const expectedChecksum = Number.parseInt(checksumText || '0', 8)
    const checksumHeader = Buffer.from(header)
    checksumHeader.fill(32, 148, 156)
    const actualChecksum = checksumHeader.reduce(
      (sum, value) => sum + value,
      0,
    )
    if (
      !/^[0-7]{7}\0$/.test(modeField) ||
      !/^[0-7]{7}\0$/.test(uidField) ||
      !/^[0-7]{7}\0$/.test(gidField) ||
      !/^[0-7]{11}\0$/.test(sizeField) ||
      !/^[0-7]{11}\0$/.test(mtimeField) ||
      !/^[0-7]{6}\0 $/.test(checksumField) ||
      header.subarray(257, 263).toString('binary') !== 'ustar\0' ||
      header.subarray(263, 265).toString('ascii') !== '00' ||
      text(265, 32) !== 'root' ||
      text(297, 32) !== 'root' ||
      Number.parseInt(text(329, 8) || '0', 8) !== 0 ||
      Number.parseInt(text(337, 8) || '0', 8) !== 0 ||
      !isRepoRelativePath(type === '5' ? path.replace(/\/$/, '') : path) ||
      seenPaths.has(path) ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      mtime !== expectedEpoch ||
      uid !== 0 ||
      gid !== 0 ||
      expectedChecksum !== actualChecksum ||
      !['0', '5'].includes(type) ||
      (type === '5' && (size !== 0 || !path.endsWith('/') || mode !== 0o755)) ||
      (type === '0' && (path.endsWith('/') || mode !== 0o644))
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ARCHIVE',
        `archive header 无效：${path}`,
      )
    }
    seenPaths.add(path)
    const contentStart = offset + 512
    const contentEnd = contentStart + size
    if (contentEnd > bytes.length) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ARCHIVE',
        `archive entry 越界：${path}`,
      )
    }
    const paddedEnd =
      contentStart + Math.ceil(size / 512) * 512
    if (
      paddedEnd > bytes.length ||
      bytes
        .subarray(contentEnd, paddedEnd)
        .some((value) => value !== 0)
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ARCHIVE',
        `archive entry padding 无效：${path}`,
      )
    }
    entries.push({
      path,
      type: type === '5' ? 'directory' : 'file',
      bytes: size,
      sha256:
        type === '5'
          ? null
          : sha256(bytes.subarray(contentStart, contentEnd)),
    })
    offset = paddedEnd
  }
  if (zeroBlocks < 2 || offset !== bytes.length) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_ARCHIVE',
      'archive 缺少精确终止双零块或含 trailing data',
    )
  }
  const paths = entries.map((entry) => entry.path)
  const canonicalOrder = [...paths].sort((left, right) =>
    Buffer.from(left).compare(Buffer.from(right)),
  )
  if (!sameJson(paths, canonicalOrder)) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_ARCHIVE',
      'archive entry 顺序不是 canonical byte order',
    )
  }
  return entries
}

async function verifyArtifactAndArchive(
  repoRoot,
  input,
  candidateBuild,
  inputAliases,
) {
  const root = candidateRoot(input.candidateAttempt)
  const artifactRoot = `${root}/rc-dist`
  const expectedManifestPath = `${artifactRoot}/artifact-manifest.json`
  const expectedMetadataPath = `${artifactRoot}/rc-build.json`
  const expectedArchivePath = `${root}/rc-dist.tar`
  const evidenceSha = input.candidateEvidenceSnapshotSha
  if (
    candidateBuild.archive?.format !== 'ustar' ||
    !Number.isSafeInteger(candidateBuild.sourceDateEpoch) ||
    candidateBuild.sourceDateEpoch < 0
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_ARCHIVE',
      'candidateBuild archive format/SOURCE_DATE_EPOCH 无效',
    )
  }
  assertEqual(
    candidateBuild.artifact?.artifactManifestPath,
    expectedManifestPath,
    'candidateBuild.artifactManifestPath',
  )
  assertEqual(
    candidateBuild.artifact?.rcBuildMetadataPath,
    expectedMetadataPath,
    'candidateBuild.rcBuildMetadataPath',
  )
  assertEqual(
    candidateBuild.archive?.path,
    expectedArchivePath,
    'candidateBuild.archive.path',
  )
  const artifactManifest = await bindGitBlob(
    repoRoot,
    evidenceSha,
    expectedManifestPath,
    candidateBuild.artifact.artifactManifestHash,
    'CANDIDATE_MANIFEST_ARTIFACT',
  )
  const metadata = await bindGitBlob(
    repoRoot,
    evidenceSha,
    expectedMetadataPath,
    candidateBuild.artifact.rcBuildMetadataHash,
    'CANDIDATE_MANIFEST_ARTIFACT',
  )
  const archive = await bindGitBlob(
    repoRoot,
    evidenceSha,
    expectedArchivePath,
    input.archiveHash,
    'CANDIDATE_MANIFEST_ARCHIVE',
  )
  inputAliases.add(expectedManifestPath)
  inputAliases.add(expectedMetadataPath)
  inputAliases.add(expectedArchivePath)
  const manifestDocument = parseJsonBytes(
    artifactManifest.content,
    expectedManifestPath,
    'CANDIDATE_MANIFEST_ARTIFACT',
  )
  const metadataDocument = parseJsonBytes(
    metadata.content,
    expectedMetadataPath,
    'CANDIDATE_MANIFEST_ARTIFACT',
  )
  if (
    manifestDocument.schemaVersion !== 'gate1-artifact-manifest-v1' ||
    !Array.isArray(manifestDocument.files) ||
    manifestDocument.files.length === 0 ||
    sha256(Buffer.from(JSON.stringify(manifestDocument.files), 'utf8')) !==
      input.artifactHash
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_ARTIFACT',
      'artifact manifest 内容或 canonical artifact hash 无效',
    )
  }
  assertEqual(metadataDocument.buildId, input.buildId, 'rc-build.buildId')
  assertEqual(metadataDocument.gitSha, input.sourceSha, 'rc-build.gitSha')
  assertEqual(metadataDocument.artifactHash, input.artifactHash, 'rc-build.artifactHash')
  const artifactFiles = []
  const seenPaths = new Set()
  for (const entry of manifestDocument.files) {
    if (
      !isRecord(entry) ||
      !isRepoRelativePath(entry.path) ||
      seenPaths.has(entry.path) ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      !HEX_64.test(entry.sha256 ?? '')
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_ARTIFACT',
        'artifact manifest file entry 无效',
      )
    }
    seenPaths.add(entry.path)
    const path = `${artifactRoot}/${entry.path}`
    const binding = await bindGitBlob(
      repoRoot,
      evidenceSha,
      path,
      entry.sha256,
      'CANDIDATE_MANIFEST_ARTIFACT',
    )
    assertEqual(binding.bytes, entry.size, `${entry.path}.size`)
    inputAliases.add(path)
    artifactFiles.push(publicBinding(binding))
  }
  const archiveEntries = parseTarArchive(
    archive.content,
    candidateBuild.sourceDateEpoch,
  )
  const archiveFiles = archiveEntries
    .filter((entry) => entry.type === 'file')
    .map(({ path, bytes, sha256: entrySha256 }) => ({
      path,
      bytes,
      sha256: entrySha256,
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
  const expectedArchiveFiles = [
    ...artifactFiles.map((entry) => ({
      path: entry.path.slice(`${artifactRoot}/`.length),
      bytes: entry.bytes,
      sha256: entry.sha256,
    })),
    {
      path: 'artifact-manifest.json',
      bytes: artifactManifest.bytes,
      sha256: artifactManifest.sha256,
    },
    {
      path: 'rc-build.json',
      bytes: metadata.bytes,
      sha256: metadata.sha256,
    },
  ].sort((left, right) => left.path.localeCompare(right.path))
  if (!sameJson(archiveFiles, expectedArchiveFiles)) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_ARCHIVE',
      'archive regular-file inventory 与 artifact authority 不一致',
    )
  }
  const expectedArchivePaths = new Set(
    expectedArchiveFiles.map((entry) => entry.path),
  )
  for (const filePath of [...expectedArchivePaths]) {
    const parts = filePath.split('/')
    for (let index = 1; index < parts.length; index += 1) {
      expectedArchivePaths.add(`${parts.slice(0, index).join('/')}/`)
    }
  }
  const orderedExpectedPaths = [...expectedArchivePaths].sort(
    (left, right) => Buffer.from(left).compare(Buffer.from(right)),
  )
  if (
    !sameJson(
      archiveEntries.map((entry) => entry.path),
      orderedExpectedPaths,
    )
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_ARCHIVE',
      'archive 完整 entry inventory 与 artifact authority 不一致',
    )
  }
  assertEqual(
    candidateBuild.archive.bytes,
    archive.bytes,
    'candidateBuild.archive.bytes',
  )
  assertEqual(
    candidateBuild.archive.entryCount,
    archiveEntries.length,
    'candidateBuild.archive.entryCount',
  )
  return {
    artifactManifest: publicBinding(artifactManifest),
    rcBuildMetadata: publicBinding(metadata),
    artifactFiles,
    archive: {
      ...publicBinding(archive),
      entryCount: archiveEntries.length,
      entries: archiveEntries,
    },
  }
}

async function verifyFrozenEvidence(
  repoRoot,
  input,
  guardDocument,
) {
  assertEqual(
    guardDocument.schemaVersion,
    'gate1a-frozen-evidence-guard-v1',
    'frozenEvidenceGuard.schemaVersion',
  )
  assertEqual(guardDocument.mode, 'evidence-lineage', 'frozenEvidenceGuard.mode')
  assertEqual(
    guardDocument.status,
    'PASS_EVIDENCE_LINEAGE',
    'frozenEvidenceGuard.status',
  )
  assertEqual(
    guardDocument.baselineSha,
    EVIDENCE_BASELINE,
    'frozenEvidenceGuard.baselineSha',
  )
  assertEqual(
    guardDocument.headSha,
    input.dependencyIntegrationSha,
    'frozenEvidenceGuard.headSha',
  )
  const observed = []
  for (const frozen of FROZEN_EVIDENCE) {
    const treeId = String(
      await git(
        repoRoot,
        ['rev-parse', `${input.dependencyIntegrationSha}:${frozen.path}`],
      ),
    ).trim()
    assertEqual(treeId, frozen.treeId, `${frozen.path}.treeId`)
    const listing = String(
      await git(repoRoot, [
        'ls-tree',
        '-r',
        '-l',
        input.dependencyIntegrationSha,
        '--',
        frozen.path,
      ]),
    )
      .trim()
      .split('\n')
      .filter(Boolean)
    const inventoryLines = []
    for (const line of listing) {
      const match = line.match(
        /^(\d+) blob ([a-f0-9]{40})\s+(\d+)\t(.+)$/,
      )
      if (!match || !match[4].startsWith(`${frozen.path}/`)) {
        throw new VerificationError(
          'CANDIDATE_MANIFEST_EVIDENCE',
          `无法解析 frozen tree：${line}`,
        )
      }
      const content = await git(
        repoRoot,
        ['cat-file', 'blob', match[2]],
        'buffer',
      )
      const bytes = Buffer.isBuffer(content)
        ? content
        : Buffer.from(content)
      assertEqual(bytes.length, Number(match[3]), `${match[4]}.bytes`)
      inventoryLines.push(
        `${sha256(bytes)}  ${bytes.length}  ${match[4].slice(frozen.path.length + 1)}\n`,
      )
    }
    const inventorySha256 = sha256(inventoryLines.join(''))
    assertEqual(listing.length, frozen.fileCount, `${frozen.path}.fileCount`)
    assertEqual(
      inventorySha256,
      frozen.inventorySha256,
      `${frozen.path}.inventorySha256`,
    )
    const guardObservation = guardDocument.observations?.find(
      (entry) => entry.path === frozen.path,
    )
    if (
      !isRecord(guardObservation) ||
      guardObservation.actual?.treeId !== treeId ||
      guardObservation.actual?.fileCount !== listing.length ||
      guardObservation.actual?.inventorySha256 !== inventorySha256 ||
      !Object.values(guardObservation.matches ?? {}).every(
        (value) => value === true,
      )
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_EVIDENCE',
        `${frozen.path} guard output 与独立复算不一致`,
      )
    }
    observed.push({
      path: frozen.path,
      treeId,
      fileCount: listing.length,
      inventorySha256,
    })
  }
  return observed
}

function parsePhase6Command(entry, binding, input) {
  let identity
  let content = binding.content
  if (
    ['manifest-fixtures', 'manifest-probe', 'runtime-equivalence'].includes(
      entry.id,
    )
  ) {
    const document = parseJsonBytes(
      binding.content,
      entry.outputPath,
      'CANDIDATE_MANIFEST_COMMAND',
    )
    identity = document.phase6Identity
  } else {
    const lines = binding.content.toString('utf8').split('\n')
    if (
      lines[0] !== 'C04_PHASE6_IDENTITY_V1' ||
      lines.length !== 3 ||
      lines[2] !== ''
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_COMMAND',
        `${entry.id} 缺少 Phase 6 identity header`,
      )
    }
    try {
      const record = JSON.parse(lines[1])
      if (
        !isRecord(record) ||
        record.schemaVersion !== 'c04-phase6-text-record-v1' ||
        !sameJson(
          Object.keys(record).sort(),
          [
            'childExitCode',
            'phase6Identity',
            'schemaVersion',
            'stderrBase64',
            'stdoutBase64',
          ],
        ) ||
        record.childExitCode !== 0 ||
        typeof record.stdoutBase64 !== 'string' ||
        typeof record.stderrBase64 !== 'string'
      ) {
        throw new Error('invalid text record')
      }
      const stdout = Buffer.from(record.stdoutBase64, 'base64')
      const stderr = Buffer.from(record.stderrBase64, 'base64')
      if (
        stdout.toString('base64') !== record.stdoutBase64 ||
        stderr.toString('base64') !== record.stderrBase64
      ) {
        throw new Error('invalid base64')
      }
      identity = record.phase6Identity
      content = stdout
    } catch {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_COMMAND',
        `${entry.id} Phase 6 text record 无效或 child exit 非零`,
      )
    }
  }
  if (
    !validatePhase6Identity(identity, entry.id) ||
    identity.mode !== 'integration' ||
    identity.integrationSha !== input.dependencyIntegrationSha ||
    identity.artifactSourceSha !== input.sourceSha ||
    identity.outputPath !== entry.outputPath
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_COMMAND',
      `${entry.id} Phase 6 identity 与 manifest lineage 不一致`,
    )
  }
  return { content, identity }
}

function parseCommandStdoutJson(content, path) {
  const lines = content.toString('utf8').trim().split('\n')
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const document = JSON.parse(lines[index])
      if (isRecord(document)) return document
    } catch {
      continue
    }
  }
  throw new VerificationError(
    'CANDIDATE_MANIFEST_COMMAND',
    `${path} stdout 缺少最终 JSON object`,
  )
}

function parseCriticalCommand(entry, content, input, candidateBuild) {
  if (
    ![
      'manifest-fixtures',
      'manifest-probe',
      'runtime-equivalence',
      'rc-archive',
      'rc-verify',
      'rc-verify-archive',
      'rc-repro',
    ].includes(entry.id)
  ) {
    return null
  }
  const document =
    ['manifest-fixtures', 'manifest-probe', 'runtime-equivalence'].includes(
      entry.id,
    )
      ? parseJsonBytes(
          content,
          entry.outputPath,
          'CANDIDATE_MANIFEST_COMMAND',
        )
      : parseCommandStdoutJson(content, entry.outputPath)
  if (entry.id === 'manifest-fixtures') {
    assertEqual(document.schemaVersion, SCHEMA_VERSION, 'manifest-fixtures.schemaVersion')
    assertEqual(document.status, 'PASS_FIXTURES', 'manifest-fixtures.status')
    assertEqual(document.fullManifestVerified, false, 'manifest-fixtures.fullManifestVerified')
  } else if (entry.id === 'manifest-probe') {
    assertEqual(document.schemaVersion, SCHEMA_VERSION, 'manifest-probe.schemaVersion')
    assertEqual(document.status, 'PASS_AUTHORITY_PREFLIGHT', 'manifest-probe.status')
    assertEqual(document.fullManifestVerified, false, 'manifest-probe.fullManifestVerified')
    assertEqual(document.authorityProfile, input.authorityProfile, 'manifest-probe.authorityProfile')
    assertEqual(document.scenarioVersion, input.scenarioVersion, 'manifest-probe.scenarioVersion')
    assertEqual(document.protocolVersion, input.protocolVersion, 'manifest-probe.protocolVersion')
  } else if (entry.id === 'runtime-equivalence') {
    assertEqual(
      document.schemaVersion,
      'gate1a-c04-runtime-equivalence-v1',
      'runtime-equivalence.schemaVersion',
    )
    assertEqual(document.status, 'PASS_RUNTIME_EQUIVALENCE', 'runtime-equivalence.status')
    assertEqual(document.errorCode, null, 'runtime-equivalence.errorCode')
    assertEqual(
      document.verificationInputSha,
      input.dependencyIntegrationSha,
      'runtime-equivalence.verificationInputSha',
    )
    assertEqual(
      document.headSha,
      input.dependencyIntegrationSha,
      'runtime-equivalence.headSha',
    )
    assertEqual(
      document.artifactGitSha,
      input.sourceSha,
      'runtime-equivalence.artifactGitSha',
    )
    assertEqual(
      document.sourceBaselineSha,
      'cd2fc9716d98c160fe530c593347992f18bf96e4',
      'runtime-equivalence.sourceBaselineSha',
    )
    if (!sameJson(document.changedForbiddenPaths, [])) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_COMMAND',
        'runtime-equivalence.changedForbiddenPaths 必须为空',
      )
    }
    assertEqual(document.canonicalFileCount, 5, 'runtime-equivalence.canonicalFileCount')
    assertEqual(document.artifactManifestBytesEqual, true, 'runtime-equivalence.artifactManifestBytesEqual')
    assertEqual(document.artifactInventoryEqual, true, 'runtime-equivalence.artifactInventoryEqual')
    assertEqual(document.metadataIdentityOnly, true, 'runtime-equivalence.metadataIdentityOnly')
    assertEqual(
      document.expectedArtifactHash,
      '9a7ddde0234d82798b2625c050710143f8f4b94bd6d14bd121910a76831abb65',
      'runtime-equivalence.expectedArtifactHash',
    )
    assertEqual(document.actualArtifactHash, input.artifactHash, 'runtime-equivalence.actualArtifactHash')
    assertEqual(
      document.expectedArtifactManifestSha256,
      'c336706bf7193c07a7f552dfbfe77cf02ec36259c72cc08b8f0c6ee8fc84cc37',
      'runtime-equivalence.expectedManifestHash',
    )
    assertEqual(
      document.actualArtifactManifestSha256,
      'c336706bf7193c07a7f552dfbfe77cf02ec36259c72cc08b8f0c6ee8fc84cc37',
      'runtime-equivalence.actualManifestHash',
    )
    if (
      !Array.isArray(document.canonicalFiles) ||
      document.canonicalFiles.length !== 5 ||
      document.canonicalFiles.some(
        (file) =>
          !isRecord(file) ||
          !isRepoRelativePath(file.path) ||
          !Number.isSafeInteger(file.expectedBytes) ||
          file.expectedBytes !== file.actualBytes ||
          !HEX_64.test(file.expectedSha256 ?? '') ||
          file.expectedSha256 !== file.actualSha256 ||
          file.bytesEqual !== true,
      )
    ) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_COMMAND',
        'runtime-equivalence canonicalFiles 合同不完整',
      )
    }
    assertEqual(
      document.source?.baselineSha,
      'cd2fc9716d98c160fe530c593347992f18bf96e4',
      'runtime-equivalence.baselineSha',
    )
    assertEqual(
      document.source?.headSha,
      input.dependencyIntegrationSha,
      'runtime-equivalence.headSha',
    )
    if (!sameJson(document.source?.changedForbiddenPaths, [])) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_COMMAND',
        'runtime-equivalence.source.changedForbiddenPaths 必须为空',
      )
    }
    assertEqual(
      document.artifact?.artifactDir,
      `${candidateRoot(input.candidateAttempt)}/rc-dist`,
      'runtime-equivalence.artifactDir',
    )
    assertEqual(
      document.artifact?.actualArtifactHash,
      input.artifactHash,
      'runtime-equivalence.artifactHash',
    )
    assertEqual(
      document.artifact?.metadataIdentity?.expectedGitSha,
      input.sourceSha,
      'runtime-equivalence.expectedGitSha',
    )
    assertEqual(
      document.artifact?.metadataIdentity?.actualGitSha,
      input.sourceSha,
      'runtime-equivalence.actualGitSha',
    )
  } else if (entry.id === 'rc-archive') {
    assertEqual(document.archiveFormat, 'ustar', 'rc-archive.archiveFormat')
    assertEqual(document.archiveHash, input.archiveHash, 'rc-archive.archiveHash')
    assertEqual(document.bytes, candidateBuild.archive?.bytes, 'rc-archive.bytes')
    assertEqual(document.entryCount, candidateBuild.archive?.entryCount, 'rc-archive.entryCount')
    assertEqual(
      document.sourceDateEpoch,
      candidateBuild.sourceDateEpoch,
      'rc-archive.sourceDateEpoch',
    )
  } else if (entry.id === 'rc-verify') {
    assertEqual(document.verified, true, 'rc-verify.verified')
    assertEqual(document.buildId, input.buildId, 'rc-verify.buildId')
    assertEqual(document.gitSha, input.sourceSha, 'rc-verify.gitSha')
    assertEqual(document.artifactHash, input.artifactHash, 'rc-verify.artifactHash')
  } else if (entry.id === 'rc-verify-archive') {
    assertEqual(document.verified, true, 'rc-verify-archive.verified')
    assertEqual(document.archiveFormat, 'ustar', 'rc-verify-archive.archiveFormat')
    assertEqual(document.archiveHash, input.archiveHash, 'rc-verify-archive.archiveHash')
    assertEqual(document.bytes, candidateBuild.archive?.bytes, 'rc-verify-archive.bytes')
    assertEqual(document.entryCount, candidateBuild.archive?.entryCount, 'rc-verify-archive.entryCount')
    assertEqual(
      document.sourceDateEpoch,
      candidateBuild.sourceDateEpoch,
      'rc-verify-archive.sourceDateEpoch',
    )
  } else if (entry.id === 'rc-repro') {
    assertEqual(document.reproducible, true, 'rc-repro.reproducible')
    assertEqual(document.buildId, input.buildId, 'rc-repro.buildId')
    assertEqual(document.gitSha, input.sourceSha, 'rc-repro.gitSha')
    assertEqual(document.archiveHash, input.archiveHash, 'rc-repro.archiveHash')
  }
  return {
    schemaVersion: document.schemaVersion ?? null,
    status: document.status ?? null,
    ...(entry.id === 'rc-archive' ||
    entry.id === 'rc-verify-archive'
      ? {
          archive: document.archive,
          archiveFormat: document.archiveFormat,
          archiveHash: document.archiveHash,
          bytes: document.bytes,
          entryCount: document.entryCount,
          sourceDateEpoch: document.sourceDateEpoch,
        }
      : {}),
  }
}

function assertNoOutputAlias(repoRoot, output, aliases) {
  for (const path of aliases) {
    if (repoPath(repoRoot, path) === output) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_SELF_REFERENCE',
        `manifest verification output alias input：${path}`,
      )
    }
  }
}

async function runFullManifest(
  repoRoot,
  options,
  resolvedOutputPath,
) {
  const manifestArgument = options['--manifest']
  if (!isRepoRelativePath(manifestArgument)) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_PATH',
      '--manifest 必须是 canonical repo-relative path',
    )
  }
  assertEqual(
    manifestArgument,
    CANONICAL_CM01_PATH,
    'candidate manifest canonical path',
    'CANDIDATE_MANIFEST_PATH',
  )
  const manifestGitSha = options['--manifest-git-sha']
  await resolveCommit(repoRoot, manifestGitSha)
  const manifestBytes = await gitBlob(
    repoRoot,
    manifestGitSha,
    manifestArgument,
  )
  const manifestHash = sha256(manifestBytes)
  const manifestSidecarBinding = await bindGitSidecar(
    repoRoot,
    manifestGitSha,
    manifestArgument,
    manifestHash,
    'CANDIDATE_MANIFEST_GIT_BINDING',
  )
  const document = parseJsonBytes(
    manifestBytes,
    manifestArgument,
    'CANDIDATE_MANIFEST_JSON',
  )
  const input = unwrap(document, 'candidate-manifest')
  const validation = validateCandidateManifest(input)
  if (!validation.accepted) {
    throw new VerificationError(
      validation.errorCode,
      'candidate manifest contract rejected input',
    )
  }
  assertEqual(input.candidateManifestId, 'CM01', 'candidateManifestId')
  assertEqual(input.candidateAttempt, 'C04', 'candidateAttempt')
  assertEqual(
    manifestArgument,
    candidateManifestPath(input.candidateManifestId),
    'candidate manifest canonical path',
    'CANDIDATE_MANIFEST_PATH',
  )
  await resolveCommit(repoRoot, input.sourceSha)
  await resolveCommit(repoRoot, input.dependencyIntegrationSha)
  await resolveCommit(repoRoot, input.candidateEvidenceSnapshotSha)
  const topology = await replayC04Topology(repoRoot, input)
  if (
    new Set([
      input.sourceSha,
      input.dependencyIntegrationSha,
      input.candidateEvidenceSnapshotSha,
      manifestGitSha,
    ]).size !== 4
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_GIT_BINDING',
      'source/I/E/M 必须是四个不同的 commit',
    )
  }
  await assertAncestor(
    repoRoot,
    input.dependencyIntegrationSha,
    input.candidateEvidenceSnapshotSha,
    'I -> E',
  )
  await assertAncestor(
    repoRoot,
    input.candidateEvidenceSnapshotSha,
    manifestGitSha,
    'E -> M',
  )
  const inputAliases = new Set([
    manifestArgument,
    input.candidateAttemptManifestPath,
    input.diagnosticManifest.path,
    input.frozenEvidenceGuard.path,
    ...input.authorityHashes.map((entry) => entry.path),
    ...input.antiPass.map((entry) => entry.evidencePath),
    ...input.rejectedAttempts.map((entry) => entry.rejectionPath),
    ...input.commandResults.map((entry) => entry.outputPath),
  ])
  assertNoOutputAlias(repoRoot, resolvedOutputPath, inputAliases)

  const { bindings: authorityBindings } = await verifyAuthorityGit(
    input,
    repoRoot,
  )
  const candidateBuildBinding = await bindGitBlob(
    repoRoot,
    input.candidateEvidenceSnapshotSha,
    input.candidateAttemptManifestPath,
    input.candidateAttemptManifestHash,
    'CANDIDATE_MANIFEST_EVIDENCE',
  )
  const candidateBuild = parseJsonBytes(
    candidateBuildBinding.content,
    input.candidateAttemptManifestPath,
    'CANDIDATE_MANIFEST_EVIDENCE',
  )
  assertBuildIdentity(candidateBuild, input, 'candidateBuild')
  assertEqual(
    candidateBuild.artifact?.artifactHash,
    input.artifactHash,
    'candidateBuild.artifactHash',
  )
  assertEqual(
    candidateBuild.archive?.sha256,
    input.archiveHash,
    'candidateBuild.archiveHash',
  )
  if (!sameJson(candidateBuild.authorityHashes, input.authorityHashes)) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_AUTHORITY',
      'candidate-build authorityHashes 与 CM 不一致',
    )
  }

  const diagnosticBinding = await bindGitBlob(
    repoRoot,
    input.candidateEvidenceSnapshotSha,
    input.diagnosticManifest.path,
    input.diagnosticManifest.sha256,
    'CANDIDATE_MANIFEST_DIAGNOSTIC',
  )
  const diagnosticManifest = parseJsonBytes(
    diagnosticBinding.content,
    input.diagnosticManifest.path,
    'CANDIDATE_MANIFEST_DIAGNOSTIC',
  )
  assertBuildIdentity(diagnosticManifest, input, 'diagnosticManifest')
  assertEqual(diagnosticManifest.status, 'PASS', 'diagnosticManifest.status')
  assertEqual(
    diagnosticManifest.candidateBuildManifestHash,
    input.candidateAttemptManifestHash,
    'diagnosticManifest.candidateBuildManifestHash',
  )
  assertEqual(diagnosticManifest.artifactHash, input.artifactHash, 'diagnosticManifest.artifactHash')
  assertEqual(diagnosticManifest.archiveHash, input.archiveHash, 'diagnosticManifest.archiveHash')
  const diagnosticIds =
    diagnosticManifest.allocatedSampleIds ??
    diagnosticManifest.samples?.map((entry) => entry.sampleId)
  if (!sameJson(diagnosticIds, input.diagnosticManifest.sampleIds)) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_DIAGNOSTIC',
      'diagnostic sample ID set mismatch',
    )
  }
  const sampleBindings = await verifyDiagnosticSamples(
    repoRoot,
    input,
    diagnosticManifest,
    inputAliases,
  )
  const antiPassBindings = await verifyAntiPass(
    repoRoot,
    input,
    inputAliases,
  )
  const artifactBindings = await verifyArtifactAndArchive(
    repoRoot,
    input,
    candidateBuild,
    inputAliases,
  )

  const rejectionBindings = []
  for (const entry of input.rejectedAttempts) {
    const authority = REJECTION_AUTHORITIES[entry.candidateAttempt]
    assertEqual(entry.rejectionPath, authority.path, `${entry.candidateAttempt}.rejectionPath`)
    assertEqual(entry.rejectionHash, authority.sha256, `${entry.candidateAttempt}.rejectionHash`)
    const binding = await bindGitBlob(
      repoRoot,
      input.candidateEvidenceSnapshotSha,
      entry.rejectionPath,
      entry.rejectionHash,
      'CANDIDATE_MANIFEST_HISTORY',
    )
    const rejection = parseJsonBytes(
      binding.content,
      entry.rejectionPath,
      'CANDIDATE_MANIFEST_HISTORY',
    )
    assertEqual(
      rejection.candidateAttempt,
      entry.candidateAttempt,
      `${entry.candidateAttempt}.rejection.candidateAttempt`,
    )
    if (!String(rejection.status).startsWith('REJECTED_')) {
      throw new VerificationError(
        'CANDIDATE_MANIFEST_HISTORY',
        `${entry.candidateAttempt} rejection status 无效`,
      )
    }
    rejectionBindings.push(
      publicBinding(binding, {
        candidateAttempt: entry.candidateAttempt,
        status: rejection.status,
      }),
    )
  }

  const commandBindings = []
  const commandBindingsById = new Map()
  for (const entry of input.commandResults) {
    const binding = await bindGitBlob(
      repoRoot,
      input.candidateEvidenceSnapshotSha,
      entry.outputPath,
      entry.outputHash,
      'CANDIDATE_MANIFEST_COMMAND',
    )
    const phase6 = parsePhase6Command(entry, binding, input)
    const parsed = parseCriticalCommand(
      entry,
      phase6.content,
      input,
      candidateBuild,
    )
    const sidecar =
      ['manifest-fixtures', 'manifest-probe', 'runtime-equivalence'].includes(
        entry.id,
      )
        ? publicBinding(
            await bindGitSidecar(
              repoRoot,
              input.candidateEvidenceSnapshotSha,
              entry.outputPath,
              entry.outputHash,
              'CANDIDATE_MANIFEST_COMMAND',
            ),
          )
        : null
    const commandBinding = publicBinding(binding, {
      id: entry.id,
      parsed,
      phase6Identity: phase6.identity,
      sidecar,
    })
    commandBindings.push(commandBinding)
    commandBindingsById.set(entry.id, commandBinding)
  }
  const archiveCommand = commandBindingsById.get('rc-archive')
  const archiveVerifyCommand =
    commandBindingsById.get('rc-verify-archive')
  if (archiveCommand) {
    await validatePhase6ArchivePath(
      repoRoot,
      archiveCommand.phase6Identity.archivePath,
    )
  }
  if (
    !archiveCommand ||
    !archiveVerifyCommand ||
    archiveCommand.phase6Identity.archivePath !==
      archiveVerifyCommand.phase6Identity.archivePath ||
    archiveCommand.parsed.archive !==
      archiveCommand.phase6Identity.archivePath ||
    archiveVerifyCommand.parsed.archive !==
      archiveVerifyCommand.phase6Identity.archivePath ||
    !sameJson(archiveCommand.parsed, archiveVerifyCommand.parsed)
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_COMMAND',
      'rc-archive 与 rc-verify-archive 的 path/format/hash/bytes/entryCount/epoch 未完整交叉绑定',
    )
  }
  const guardBinding = await bindGitBlob(
    repoRoot,
    input.candidateEvidenceSnapshotSha,
    input.frozenEvidenceGuard.path,
    input.frozenEvidenceGuard.sha256,
    'CANDIDATE_MANIFEST_EVIDENCE',
  )
  const guardDocument = parseJsonBytes(
    guardBinding.content,
    input.frozenEvidenceGuard.path,
    'CANDIDATE_MANIFEST_EVIDENCE',
  )
  if (
    !validatePhase6Identity(
      guardDocument.phase6Identity,
      'frozen-evidence-guard',
    ) ||
    guardDocument.phase6Identity.mode !== 'integration' ||
    guardDocument.phase6Identity.integrationSha !==
      input.dependencyIntegrationSha ||
    guardDocument.phase6Identity.artifactSourceSha !== input.sourceSha ||
    guardDocument.phase6Identity.outputPath !==
      input.frozenEvidenceGuard.path
  ) {
    throw new VerificationError(
      'CANDIDATE_MANIFEST_COMMAND',
      'frozen-evidence guard Phase 6 identity 与 manifest lineage 不一致',
    )
  }
  const guardSidecarBinding = await bindGitSidecar(
    repoRoot,
    input.candidateEvidenceSnapshotSha,
    input.frozenEvidenceGuard.path,
    input.frozenEvidenceGuard.sha256,
    'CANDIDATE_MANIFEST_EVIDENCE',
  )
  const frozenObservations = await verifyFrozenEvidence(
    repoRoot,
    input,
    guardDocument,
  )
  assertNoOutputAlias(repoRoot, resolvedOutputPath, inputAliases)

  return {
    schemaVersion: SCHEMA_VERSION,
    status: 'PASS_FULL_MANIFEST',
    accepted: true,
    fullManifestVerified: true,
    manifestGitSha,
    candidateEvidenceSnapshotSha: input.candidateEvidenceSnapshotSha,
    ...validation.summary,
    manifest: {
      path: manifestArgument,
      sha256: manifestHash,
      bytes: manifestBytes.length,
      sidecar: publicBinding(manifestSidecarBinding),
    },
    bindings: {
      topology,
      authority: authorityBindings,
      candidateBuild: publicBinding(candidateBuildBinding),
      diagnosticManifest: publicBinding(diagnosticBinding),
      sampleRecords: sampleBindings,
      antiPass: antiPassBindings,
      artifact: artifactBindings,
      rejectedAttempts: rejectionBindings,
      commandResults: commandBindings,
      frozenEvidenceGuard: {
        ...publicBinding(guardBinding),
        sidecar: publicBinding(guardSidecarBinding),
        observedTrees: frozenObservations,
      },
    },
  }
}

const argv = process.argv.slice(2)
let resolvedOutputPath
let repoRoot = defaultRepoRoot
try {
  const { mode, options } = parseArguments(argv)
  repoRoot = await realpath(
    mode === 'fixtures'
      ? defaultRepoRoot
      : resolve(options['--repo-root']),
  )
  resolvedOutputPath = outputPath(options, repoRoot, mode)
  const phase6CommandId =
    mode === 'fixtures'
      ? 'manifest-fixtures'
      : mode === 'probe'
        ? 'manifest-probe'
        : null
  const reservedPhase6Identity = phase6CommandId
    ? reservedPhase6IdentityFromEnvironment(
        repoRoot,
        resolvedOutputPath,
        phase6CommandId,
      )
    : null
  if (reservedPhase6Identity) {
    const head = String(
      await git(repoRoot, [
        'rev-parse',
        '--verify',
        'HEAD^{commit}',
      ]),
    ).trim()
    if (head !== reservedPhase6Identity.integrationSha) {
      throw new VerificationError(
        'C04_PHASE6_IDENTITY',
        'reserved Phase 6 identity does not match repository HEAD',
      )
    }
    await replayC04Topology(repoRoot, {
      sourceSha: reservedPhase6Identity.artifactSourceSha,
      dependencyIntegrationSha:
        reservedPhase6Identity.integrationSha,
    })
  }
  const phase6Identity =
    phase6CommandId && !reservedPhase6Identity
      ? phase6IdentityFromEnvironment(phase6CommandId)
      : reservedPhase6Identity
  const outputDestination = await validateOutputDestination(
    resolvedOutputPath,
    repoRoot,
    mode,
  )
  const result =
    mode === 'fixtures'
      ? await runFixtures()
      : mode === 'probe'
        ? await runProbe(
            repoRoot,
            options,
            resolvedOutputPath,
          )
        : await runFullManifest(
            repoRoot,
            options,
            resolvedOutputPath,
          )
  const publishedResult = phase6Identity
    ? { ...result, phase6Identity }
    : result
  await writeExclusiveGroup(
    resolvedOutputPath,
    publishedResult,
    repoRoot,
    mode,
    outputDestination,
  )
  process.stdout.write(`${JSON.stringify(publishedResult)}\n`)
} catch (error) {
  const result = {
    schemaVersion: SCHEMA_VERSION,
    status: 'FAIL',
    accepted: false,
    fullManifestVerified: false,
    errorCode:
      error instanceof VerificationError
        ? error.code
        : error instanceof Error &&
            error.message === 'C04_PHASE6_IDENTITY'
          ? 'C04_PHASE6_IDENTITY'
        : 'CANDIDATE_MANIFEST_INTERNAL',
    message:
      error instanceof Error && error.message === 'C04_PHASE6_IDENTITY'
        ? 'reserved Phase 6 identity preflight failed'
        : error instanceof Error
          ? error.message
          : String(error),
  }
  process.stderr.write(`${JSON.stringify(result)}\n`)
  process.exitCode = 1
}
