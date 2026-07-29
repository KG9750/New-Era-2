import { createHash, randomBytes } from 'node:crypto'
import {
  closeSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

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

function normalizedRelativePath(root, absolutePath) {
  return relative(root, absolutePath).split(sep).join('/')
}

function collectEntries(root, directory = root) {
  return readdirSync(directory)
    .flatMap((name) => {
      const absolutePath = join(directory, name)
      const stats = lstatSync(absolutePath)
      const path = normalizedRelativePath(root, absolutePath)
      if (stats.isSymbolicLink()) {
        fail(`archive 不允许符号链接：${path}`)
      }
      if (stats.isDirectory()) {
        return [
          { absolutePath, path: `${path}/`, type: 'directory' },
          ...collectEntries(root, absolutePath),
        ]
      }
      if (!stats.isFile()) {
        fail(`archive 只允许普通文件和目录：${path}`)
      }
      return [{ absolutePath, path, type: 'file' }]
    })
    .sort((left, right) => utf8Compare(left.path, right.path))
}

function fsyncDirectory(directory) {
  const descriptor = openSync(directory, 'r')
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

function openTemporaryArchive(outputPath) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const temporaryPath = `${outputPath}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`
    try {
      return {
        descriptor: openSync(temporaryPath, 'wx', 0o644),
        temporaryPath,
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }
  }
  fail('archive 无法分配唯一临时文件')
}

function writeString(header, offset, length, value, label) {
  const bytes = Buffer.from(value, 'utf8')
  if (bytes.byteLength > length) {
    fail(`${label} 超出 ustar 字段长度：${value}`)
  }
  bytes.copy(header, offset)
}

function writeOctal(header, offset, length, value, label) {
  const octal = value.toString(8)
  if (octal.length > length - 1) {
    fail(`${label} 超出 ustar 数值范围：${value}`)
  }
  writeString(
    header,
    offset,
    length,
    `${octal.padStart(length - 1, '0')}\0`,
    label,
  )
}

function splitUstarPath(path) {
  if (Buffer.byteLength(path) <= 100) {
    return { name: path, prefix: '' }
  }
  const slashIndexes = [...path.matchAll(/\//g)]
    .map((match) => match.index)
    .filter((index) => index !== undefined)
    .reverse()
  for (const index of slashIndexes) {
    const prefix = path.slice(0, index)
    const name = path.slice(index + 1)
    if (
      name.length > 0 &&
      Buffer.byteLength(name) <= 100 &&
      Buffer.byteLength(prefix) <= 155
    ) {
      return { name, prefix }
    }
  }
  fail(`路径无法写入 ustar header：${path}`)
}

function createHeader(entry, sourceDateEpoch, size) {
  const header = Buffer.alloc(BLOCK_SIZE)
  const { name, prefix } = splitUstarPath(entry.path)
  writeString(header, 0, 100, name, 'path')
  writeOctal(
    header,
    100,
    8,
    entry.type === 'directory' ? 0o755 : 0o644,
    'mode',
  )
  writeOctal(header, 108, 8, 0, 'uid')
  writeOctal(header, 116, 8, 0, 'gid')
  writeOctal(header, 124, 12, size, 'size')
  writeOctal(header, 136, 12, sourceDateEpoch, 'mtime')
  header.fill(0x20, 148, 156)
  writeString(
    header,
    156,
    1,
    entry.type === 'directory' ? '5' : '0',
    'type',
  )
  writeString(header, 257, 6, 'ustar\0', 'magic')
  writeString(header, 263, 2, '00', 'version')
  writeString(header, 265, 32, 'root', 'owner')
  writeString(header, 297, 32, 'root', 'group')
  writeOctal(header, 329, 8, 0, 'device major')
  writeOctal(header, 337, 8, 0, 'device minor')
  writeString(header, 345, 155, prefix, 'prefix')

  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  const checksumField = `${checksum.toString(8).padStart(6, '0')}\0 `
  writeString(header, 148, 8, checksumField, 'checksum')
  return header
}

const inputArgument = argument('--input')
const outputArgument = argument('--output')
const epochArgument =
  argument('--source-date-epoch') ?? process.env.SOURCE_DATE_EPOCH

if (!inputArgument || !outputArgument || epochArgument === undefined) {
  fail(
    '用法：node scripts/create-deterministic-archive.mjs --input <目录> --output <archive.tar> --source-date-epoch <epoch>',
  )
}

const inputRoot = resolve(inputArgument)
const outputPath = resolve(outputArgument)
const inputStats = lstatSync(inputRoot, { throwIfNoEntry: false })
if (!inputStats?.isDirectory()) fail(`archive 输入不是目录：${inputRoot}`)
const outputRelative = relative(inputRoot, outputPath)
if (
  outputRelative === '' ||
  (!outputRelative.startsWith(`..${sep}`) &&
    outputRelative !== '..' &&
    !isAbsolute(outputRelative))
) {
  fail('archive 输出不得位于输入目录内')
}
if (lstatSync(outputPath, { throwIfNoEntry: false })) {
  fail(`RC_ARCHIVE_OUTPUT_EXISTS：${outputPath}`)
}

const sourceDateEpoch = Number(epochArgument)
if (
  !Number.isSafeInteger(sourceDateEpoch) ||
  sourceDateEpoch < 0 ||
  sourceDateEpoch > MAX_SOURCE_DATE_EPOCH
) {
  fail(`SOURCE_DATE_EPOCH 无效：${epochArgument}`)
}

const entries = collectEntries(inputRoot)
if (entries.length === 0) fail('archive 输入目录为空')

const blocks = []
for (const entry of entries) {
  const content =
    entry.type === 'file'
      ? readFileSync(entry.absolutePath)
      : Buffer.alloc(0)
  blocks.push(createHeader(entry, sourceDateEpoch, content.byteLength))
  if (content.byteLength > 0) {
    blocks.push(content)
    const padding = content.byteLength % BLOCK_SIZE
    if (padding > 0) blocks.push(Buffer.alloc(BLOCK_SIZE - padding))
  }
}
blocks.push(Buffer.alloc(BLOCK_SIZE * 2))
const archive = Buffer.concat(blocks)
const archiveHash = createHash('sha256').update(archive).digest('hex')

mkdirSync(dirname(outputPath), { recursive: true })
const outputDirectory = dirname(outputPath)
const { descriptor, temporaryPath } = openTemporaryArchive(outputPath)
let descriptorOpen = true
try {
  writeFileSync(descriptor, archive)
  fsyncSync(descriptor)
  closeSync(descriptor)
  descriptorOpen = false
  fsyncDirectory(outputDirectory)
  linkSync(temporaryPath, outputPath)
  fsyncDirectory(outputDirectory)
  unlinkSync(temporaryPath)
  fsyncDirectory(outputDirectory)
} catch (error) {
  if (descriptorOpen) closeSync(descriptor)
  try {
    unlinkSync(temporaryPath)
    fsyncDirectory(outputDirectory)
  } catch (cleanupError) {
    if (cleanupError?.code !== 'ENOENT') throw cleanupError
  }
  if (error?.code === 'EEXIST') {
    fail(`RC_ARCHIVE_OUTPUT_EXISTS：${outputPath}`)
  }
  throw error
}

process.stdout.write(
  `${JSON.stringify({
    archive: outputPath,
    archiveFormat: 'ustar',
    archiveHash,
    bytes: archive.byteLength,
    entryCount: entries.length,
    sourceDateEpoch,
  })}\n`,
)
