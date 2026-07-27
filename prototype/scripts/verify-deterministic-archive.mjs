import { createHash } from 'node:crypto'
import {
  lstatSync,
  readFileSync,
  readdirSync,
} from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

const BLOCK_SIZE = 512
const MAX_SOURCE_DATE_EPOCH = 8_589_934_591

function argument(name) {
  const index = process.argv.lastIndexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function utf8Compare(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right))
}

function fieldString(header, offset, length) {
  const value = header.subarray(offset, offset + length)
  const end = value.indexOf(0)
  return value.subarray(0, end < 0 ? value.length : end).toString('utf8')
}

function octalField(header, offset, length, label) {
  const raw = fieldString(header, offset, length).trim()
  if (!/^[0-7]+$/.test(raw)) fail(`archive ${label} 不是标准八进制字段`)
  return Number.parseInt(raw, 8)
}

function isZeroBlock(block) {
  return block.every((byte) => byte === 0)
}

function parseArchive(archive, sourceDateEpoch) {
  if (
    archive.byteLength < BLOCK_SIZE * 2 ||
    archive.byteLength % BLOCK_SIZE !== 0
  ) {
    fail('archive 长度不是完整的 ustar block')
  }

  const entries = []
  let offset = 0
  while (offset < archive.byteLength) {
    const header = archive.subarray(offset, offset + BLOCK_SIZE)
    if (isZeroBlock(header)) {
      const trailer = archive.subarray(offset)
      if (
        trailer.byteLength !== BLOCK_SIZE * 2 ||
        !isZeroBlock(trailer)
      ) {
        fail('archive 结尾必须恰好包含两个空 block')
      }
      return entries
    }

    const checksum = octalField(header, 148, 8, 'checksum')
    const checksumHeader = Buffer.from(header)
    checksumHeader.fill(0x20, 148, 156)
    const actualChecksum = checksumHeader.reduce(
      (sum, byte) => sum + byte,
      0,
    )
    if (checksum !== actualChecksum) fail('archive header checksum 不一致')

    if (
      fieldString(header, 257, 6) !== 'ustar' ||
      fieldString(header, 263, 2) !== '00'
    ) {
      fail('archive 不是受支持的 ustar 格式')
    }

    const name = fieldString(header, 0, 100)
    const prefix = fieldString(header, 345, 155)
    const path = prefix ? `${prefix}/${name}` : name
    if (
      !path ||
      isAbsolute(path) ||
      path.split('/').some((part) => part === '..' || part === '.')
    ) {
      fail(`archive 包含不安全路径：${path}`)
    }

    const type = fieldString(header, 156, 1)
    if (type !== '0' && type !== '5') {
      fail(`archive 包含不受支持的条目类型：${type}`)
    }
    const directory = type === '5'
    const size = octalField(header, 124, 12, 'size')
    const mode = octalField(header, 100, 8, 'mode')
    if (mode !== (directory ? 0o755 : 0o644)) {
      fail(`archive mode 未固定：${path}`)
    }
    if (
      octalField(header, 108, 8, 'uid') !== 0 ||
      octalField(header, 116, 8, 'gid') !== 0 ||
      fieldString(header, 265, 32) !== 'root' ||
      fieldString(header, 297, 32) !== 'root'
    ) {
      fail(`archive owner/group 未固定：${path}`)
    }
    if (
      octalField(header, 329, 8, 'device major') !== 0 ||
      octalField(header, 337, 8, 'device minor') !== 0
    ) {
      fail(`archive device metadata 未清零：${path}`)
    }
    if (octalField(header, 136, 12, 'mtime') !== sourceDateEpoch) {
      fail(`archive mtime 与 SOURCE_DATE_EPOCH 不一致：${path}`)
    }
    if (
      (directory && (!path.endsWith('/') || size !== 0)) ||
      (!directory && path.endsWith('/'))
    ) {
      fail(`archive 条目路径与类型矛盾：${path}`)
    }

    const contentStart = offset + BLOCK_SIZE
    const contentEnd = contentStart + size
    const paddedEnd =
      contentStart + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE
    if (paddedEnd > archive.byteLength) fail(`archive 条目越界：${path}`)
    const padding = archive.subarray(contentEnd, paddedEnd)
    if (!isZeroBlock(padding)) fail(`archive padding 未清零：${path}`)
    entries.push({
      content: archive.subarray(contentStart, contentEnd),
      path,
      type: directory ? 'directory' : 'file',
    })
    offset = paddedEnd
  }
  fail('archive 缺少两个结尾空 block')
}

function collectInputEntries(root, directory = root) {
  return readdirSync(directory)
    .flatMap((name) => {
      const absolutePath = join(directory, name)
      const stats = lstatSync(absolutePath)
      const path = relative(root, absolutePath).split(sep).join('/')
      if (stats.isSymbolicLink()) {
        fail(`archive 输入不允许符号链接：${path}`)
      }
      if (stats.isDirectory()) {
        return [
          {
            content: Buffer.alloc(0),
            path: `${path}/`,
            type: 'directory',
          },
          ...collectInputEntries(root, absolutePath),
        ]
      }
      if (!stats.isFile()) {
        fail(`archive 输入只允许普通文件和目录：${path}`)
      }
      return [{
        content: readFileSync(absolutePath),
        path,
        type: 'file',
      }]
    })
    .sort((left, right) => utf8Compare(left.path, right.path))
}

const inputArgument = argument('--input')
const archiveArgument = argument('--archive')
const epochArgument =
  argument('--source-date-epoch') ?? process.env.SOURCE_DATE_EPOCH

if (!inputArgument || !archiveArgument || epochArgument === undefined) {
  fail(
    '用法：node scripts/verify-deterministic-archive.mjs --input <目录> --archive <archive.tar> --source-date-epoch <epoch>',
  )
}

const sourceDateEpoch = Number(epochArgument)
if (
  !Number.isSafeInteger(sourceDateEpoch) ||
  sourceDateEpoch < 0 ||
  sourceDateEpoch > MAX_SOURCE_DATE_EPOCH
) {
  fail(`SOURCE_DATE_EPOCH 无效：${epochArgument}`)
}

const inputRoot = resolve(inputArgument)
const inputStats = lstatSync(inputRoot, { throwIfNoEntry: false })
if (!inputStats?.isDirectory()) fail(`archive 输入不是目录：${inputRoot}`)
const archivePath = resolve(archiveArgument)
const archive = readFileSync(archivePath)
const archiveEntries = parseArchive(archive, sourceDateEpoch)
const inputEntries = collectInputEntries(inputRoot)

const archivePaths = archiveEntries.map((entry) => entry.path)
if (
  new Set(archivePaths).size !== archivePaths.length ||
  archivePaths.some(
    (path, index) => index > 0 && utf8Compare(archivePaths[index - 1], path) >= 0,
  )
) {
  fail('archive 条目未按 UTF-8 路径严格排序或存在重复')
}
if (archiveEntries.length !== inputEntries.length) {
  fail('archive 条目数量与输入目录不一致')
}
archiveEntries.forEach((entry, index) => {
  const expected = inputEntries[index]
  if (
    entry.path !== expected.path ||
    entry.type !== expected.type ||
    !entry.content.equals(expected.content)
  ) {
    fail(`archive 条目与输入目录不一致：${entry.path}`)
  }
})

process.stdout.write(
  `${JSON.stringify({
    verified: true,
    archive: archivePath,
    archiveFormat: 'ustar',
    archiveHash: createHash('sha256').update(archive).digest('hex'),
    bytes: archive.byteLength,
    entryCount: archiveEntries.length,
    sourceDateEpoch,
  })}\n`,
)
