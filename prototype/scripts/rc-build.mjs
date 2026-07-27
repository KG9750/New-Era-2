import { createHash } from 'node:crypto'
import {
  copyFileSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

const METADATA_FILE = 'rc-build.json'
const MANIFEST_FILE = 'artifact-manifest.json'
const BUILD_ID_PATTERN = /^g1-(?:rc|e2e)-[a-z0-9.-]+$/i
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i

function argument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const buildId = argument('--build-id')
const gitSha = argument('--git-sha')?.toLowerCase()

if (!buildId || !BUILD_ID_PATTERN.test(buildId)) {
  fail('用法：npm run rc:build -- --build-id g1-rc-YYYYMMDD.N --git-sha <40位SHA>')
}
if (!gitSha || !GIT_SHA_PATTERN.test(gitSha)) {
  fail('rc:build 需要完整的 40 位 Git SHA')
}

const prototypeRoot = resolve(import.meta.dirname, '..')
const distRoot = join(prototypeRoot, 'dist')
const build = spawnSync('npm', ['run', 'build'], {
  cwd: prototypeRoot,
  env: process.env,
  stdio: 'inherit',
})
if (build.error) fail(`无法启动生产构建：${build.error.message}`)
if (build.status !== 0) process.exit(build.status ?? 1)

const initialStateHashResult = spawnSync(
  'npm',
  ['exec', '--', 'vite-node', 'scripts/initial-state-hash.ts'],
  {
    cwd: prototypeRoot,
    encoding: 'utf8',
    env: process.env,
  },
)
if (initialStateHashResult.error) {
  fail(`无法计算固定初态哈希：${initialStateHashResult.error.message}`)
}
if (initialStateHashResult.status !== 0) {
  process.stderr.write(initialStateHashResult.stderr)
  fail('固定初态哈希计算失败')
}
const initialStateHash = initialStateHashResult.stdout.trim()
if (!/^fnv1a32-[a-f0-9]{8}$/.test(initialStateHash)) {
  fail(`固定初态哈希格式无效：${initialStateHash}`)
}

copyFileSync(
  join(prototypeRoot, 'scripts', 'playtest-host.mjs'),
  join(distRoot, 'playtest-host.mjs'),
)
copyFileSync(
  join(
    prototypeRoot,
    'scripts',
    'management-ledger-contract.mjs',
  ),
  join(distRoot, 'management-ledger-contract.mjs'),
)

function collectFiles(directory) {
  return readdirSync(directory)
    .flatMap((name) => {
      const absolutePath = join(directory, name)
      return statSync(absolutePath).isDirectory()
        ? collectFiles(absolutePath)
        : [absolutePath]
    })
    .filter((absolutePath) => {
      const path = relative(distRoot, absolutePath)
      return path !== METADATA_FILE && path !== MANIFEST_FILE
    })
}

const artifactFiles = collectFiles(distRoot).sort((left, right) =>
  relative(distRoot, left).localeCompare(relative(distRoot, right), 'en'),
)
if (artifactFiles.length === 0) fail('生产构建没有生成可哈希产物')

const files = artifactFiles.map((absolutePath) => {
  const normalizedPath = relative(distRoot, absolutePath).split(sep).join('/')
  const bytes = readFileSync(absolutePath)
  return {
    path: normalizedPath,
    size: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
})
const manifest = {
  schemaVersion: 'gate1-artifact-manifest-v1',
  files,
}
const artifactHash = createHash('sha256')
  .update(JSON.stringify(files))
  .digest('hex')
const metadata = {
  buildId,
  gitSha,
  artifactHash,
  artifactHashAlgorithm: 'sha256-canonical-file-manifest-v1',
  artifactManifestPath: MANIFEST_FILE,
  initialStateHash,
  initialStateHashAlgorithm: 'fnv1a32-stable-json-v1',
}
const manifestPath = join(distRoot, MANIFEST_FILE)
const manifestTemporaryPath = `${manifestPath}.tmp`
writeFileSync(manifestTemporaryPath, `${JSON.stringify(manifest, null, 2)}\n`)
renameSync(manifestTemporaryPath, manifestPath)
const metadataPath = join(distRoot, METADATA_FILE)
const temporaryPath = `${metadataPath}.tmp`
writeFileSync(temporaryPath, `${JSON.stringify(metadata, null, 2)}\n`)
renameSync(temporaryPath, metadataPath)

process.stdout.write(
  `${JSON.stringify({
    metadataPath: METADATA_FILE,
    artifactManifestPath: MANIFEST_FILE,
    artifactHashAlgorithm: metadata.artifactHashAlgorithm,
    excludedFromArtifactHash: [METADATA_FILE, MANIFEST_FILE],
    artifactFileCount: artifactFiles.length,
    ...metadata,
  })}\n`,
)
