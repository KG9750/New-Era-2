import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const prototypeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(prototypeRoot, '..')

function readOption(name) {
  const index = process.argv.indexOf(name)
  if (index === -1 || index === process.argv.length - 1) {
    throw new Error(`缺少参数：${name}`)
  }
  return process.argv[index + 1]
}

function gitText(...args) {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
  }).trim()
}

function gitBuffer(...args) {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  })
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

async function collectWorkingInventory(root, prefix = '') {
  const inventory = []
  for (
    const entry of (
      await readdir(root, { withFileTypes: true })
    ).sort((left, right) => left.name.localeCompare(right.name))
  ) {
    const path = resolve(root, entry.name)
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      inventory.push(...await collectWorkingInventory(path, relativePath))
      continue
    }
    const stat = await lstat(path)
    if (!stat.isFile()) {
      throw new Error(`守卫路径包含非普通文件：${relativePath}`)
    }
    inventory.push({
      path: relativePath,
      sha256: sha256(await readFile(path)),
    })
  }
  return inventory
}

function collectBaselineInventory(baseline, repoRelativePath) {
  const listing = gitText(
    'ls-tree',
    '-r',
    '--full-tree',
    baseline,
    '--',
    repoRelativePath,
  )
  if (!listing) {
    throw new Error(`基线中不存在守卫路径：${repoRelativePath}`)
  }

  return listing.split('\n').map((line) => {
    const match = line.match(/^\d+ blob ([a-f0-9]{40})\t(.+)$/)
    if (!match) {
      throw new Error(`无法解析基线 tree 条目：${line}`)
    }
    const [, blobSha, fullPath] = match
    return {
      path: fullPath.slice(repoRelativePath.length + 1),
      sha256: sha256(gitBuffer('cat-file', 'blob', blobSha)),
    }
  })
}

const baselineInput = readOption('--baseline')
const pathInput = readOption('--path')
const baseline = gitText('rev-parse', '--verify', `${baselineInput}^{commit}`)
const currentHead = gitText('rev-parse', '--verify', 'HEAD^{commit}')
const guardedPath = resolve(prototypeRoot, pathInput)
const repoPrefix = `${repoRoot}${sep}`
if (!guardedPath.startsWith(repoPrefix)) {
  throw new Error('守卫路径必须位于当前仓库内')
}
const repoRelativePath = relative(repoRoot, guardedPath).split(sep).join('/')

const baselineTree = gitText('rev-parse', `${baseline}:${repoRelativePath}`)
const currentTree = gitText('rev-parse', `${currentHead}:${repoRelativePath}`)
if (baselineTree !== currentTree) {
  throw new Error(
    `Git subtree tree ID 已变化：baseline=${baselineTree} current=${currentTree}`,
  )
}

const baselineInventory = collectBaselineInventory(
  baseline,
  repoRelativePath,
)
const workingInventory = await collectWorkingInventory(guardedPath)
baselineInventory.sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
)
workingInventory.sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
)
if (JSON.stringify(baselineInventory) !== JSON.stringify(workingInventory)) {
  const baselineByPath = new Map(
    baselineInventory.map((entry) => [entry.path, entry.sha256]),
  )
  const workingByPath = new Map(
    workingInventory.map((entry) => [entry.path, entry.sha256]),
  )
  const paths = [...new Set([
    ...baselineByPath.keys(),
    ...workingByPath.keys(),
  ])].sort()
  const differences = paths
    .filter((path) => baselineByPath.get(path) !== workingByPath.get(path))
    .map(
      (path) =>
        `${path}: baseline=${baselineByPath.get(path) ?? 'MISSING'} current=${workingByPath.get(path) ?? 'MISSING'}`,
    )
  throw new Error(
    `逐文件 SHA-256 inventory 已变化：\n${differences.join('\n')}`,
  )
}

console.log(
  [
    'RC8 tree guard PASS',
    `baseline=${baseline}`,
    `currentHead=${currentHead}`,
    `path=${repoRelativePath}`,
    `tree=${baselineTree}`,
    `files=${baselineInventory.length}`,
    `inventorySha256=${sha256(Buffer.from(JSON.stringify(baselineInventory)))}`,
  ].join(' '),
)
