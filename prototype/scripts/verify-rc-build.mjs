import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

const METADATA_FILE = 'rc-build.json'
const MANIFEST_FILE = 'artifact-manifest.json'
const prototypeRoot = resolve(import.meta.dirname, '..')

function argument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const distRoot = resolve(
  prototypeRoot,
  argument('--dist') ?? 'dist',
)

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${label} 无法读取：${error instanceof Error ? error.message : error}`)
  }
}

function collectPayloadFiles(directory) {
  return readdirSync(directory)
    .flatMap((name) => {
      const absolutePath = join(directory, name)
      return statSync(absolutePath).isDirectory()
        ? collectPayloadFiles(absolutePath)
        : [absolutePath]
    })
    .filter((absolutePath) => {
      const path = relative(distRoot, absolutePath)
      return path !== METADATA_FILE && path !== MANIFEST_FILE
    })
    .sort((left, right) =>
      relative(distRoot, left).localeCompare(relative(distRoot, right), 'en'),
    )
}

const metadata = readJson(join(distRoot, METADATA_FILE), 'RC 构建元数据')
const manifest = readJson(join(distRoot, MANIFEST_FILE), 'RC artifact manifest')
if (manifest.schemaVersion !== 'gate1-artifact-manifest-v1') {
  fail('RC artifact manifest schemaVersion 无效')
}
if (metadata.artifactManifestPath !== MANIFEST_FILE) {
  fail('RC 构建元数据没有指向冻结 manifest')
}
if (metadata.artifactHashAlgorithm !== 'sha256-canonical-file-manifest-v1') {
  fail('RC artifactHash 算法不受支持')
}
if (metadata.initialStateHashAlgorithm !== 'fnv1a32-stable-json-v1') {
  fail('RC initialStateHash 算法不受支持')
}

const files = collectPayloadFiles(distRoot).map((absolutePath) => {
  const bytes = readFileSync(absolutePath)
  return {
    path: relative(distRoot, absolutePath).split(sep).join('/'),
    size: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
})
if (JSON.stringify(files) !== JSON.stringify(manifest.files)) {
  fail('RC payload 与 artifact manifest 不一致')
}
const artifactHash = createHash('sha256')
  .update(JSON.stringify(files))
  .digest('hex')
if (artifactHash !== metadata.artifactHash) {
  fail('RC artifactHash 与 payload manifest 不一致')
}

const initialStateHashResult = spawnSync(
  'npm',
  ['exec', '--', 'vite-node', 'scripts/initial-state-hash.ts'],
  {
    cwd: prototypeRoot,
    encoding: 'utf8',
    env: process.env,
  },
)
if (initialStateHashResult.status !== 0) {
  process.stderr.write(initialStateHashResult.stderr)
  fail('无法重新计算固定初态哈希')
}
const initialStateHash = initialStateHashResult.stdout.trim()
if (initialStateHash !== metadata.initialStateHash) {
  fail('RC initialStateHash 与当前固定场景不一致')
}

process.stdout.write(
  `${JSON.stringify({
    verified: true,
    buildId: metadata.buildId,
    gitSha: metadata.gitSha,
    artifactHash,
    artifactFileCount: files.length,
    excludedFromArtifactHash: [METADATA_FILE, MANIFEST_FILE],
    initialStateHash,
  })}\n`,
)
