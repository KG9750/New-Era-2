import { createHash, randomUUID } from 'node:crypto'
import {
  createReadStream,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'

const CAPTURE_PATH = '/__gate1/capture'
const CAPTURE_VERSION = 'gate1-capture-host-v1'
const MAX_EXPORT_BYTES = 2 * 1024 * 1024
const MAX_BLOCKED_REASON_LENGTH = 240
const SCENARIO_START_TICK = 54
const BUILD_ID_PATTERN = /^g1-(?:rc|e2e)-[a-z0-9.-]+$/i
const SAMPLE_ID_PATTERN = /^(?:(?:A|P)\d{2,}|M-[ABC])$/
const SESSION_ID_PATTERN = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i
const ARTIFACT_HASH_PATTERN = /^[a-f0-9]{64}$/i
const INITIAL_STATE_HASH_PATTERN = /^fnv1a32-[a-f0-9]{8}$/i
const EXPORT_KEYS = [
  'actions',
  'candidateEditGroups',
  'domainEvents',
  'finalState',
  'finalStateHash',
  'finalTick',
  'machineTiming',
  'meta',
  'recap',
  'schemaVersion',
  'speedTrajectory',
  'summary',
  'telemetry',
]
const BLOCKED_EXPORT_KEYS = [
  ...EXPORT_KEYS,
  'blockedAtTick',
  'blockedReason',
  'captureKind',
]
const META_KEYS = [
  'artifactHash',
  'buildId',
  'fixedSeed',
  'gitSha',
  'initialStateHash',
  'inputDevice',
  'sampleId',
  'scenarioId',
  'scenarioVersion',
  'sessionId',
  'viewport',
]
const FINAL_STATE_KEYS = [
  'completedWeekCount',
  'isComplete',
  'processedScriptEventIds',
  'recapCount',
]
const RECAP_KEYS = [
  'actual',
  'itemIds',
  'planned',
  'sourceIds',
  'weekIndex',
]
const PLANNED_KEYS = ['high', 'low']
const RECEIPT_KEYS = [
  'artifactHash',
  'buildId',
  'bytes',
  'capturedAtUtc',
  'captureVersion',
  'filename',
  'gitSha',
  'sampleId',
  'schemaVersion',
  'sessionId',
  'sha256',
]
const BLOCKED_RECEIPT_KEYS = [
  ...RECEIPT_KEYS,
  'blockedAtTick',
  'captureKind',
  'isComplete',
]
const REQUIRED_ARRAYS = [
  'actions',
  'candidateEditGroups',
  'domainEvents',
  'recap',
  'speedTrajectory',
  'telemetry',
]
const REQUIRED_OBJECTS = [
  'finalState',
  'machineTiming',
  'summary',
]
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
}

function argument(name) {
  const index = process.argv.lastIndexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function sendJson(response, status, payload) {
  const bytes = Buffer.from(`${JSON.stringify(payload)}\n`)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': bytes.byteLength,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(bytes)
}

function hasExactKeys(value, keys) {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...keys].sort())
  )
}

function validExport(value, buildMetadata) {
  const isBlocked = value?.captureKind === 'blocked'
  if (
    !value ||
    typeof value !== 'object' ||
    value.schemaVersion !== 'gate1-playtest-v1' ||
    !hasExactKeys(value, isBlocked ? BLOCKED_EXPORT_KEYS : EXPORT_KEYS) ||
    !value.meta ||
    typeof value.meta !== 'object' ||
    !hasExactKeys(value.meta, META_KEYS) ||
    typeof value.finalStateHash !== 'string' ||
    !INITIAL_STATE_HASH_PATTERN.test(value.finalStateHash)
  ) {
    return false
  }
  if (
    REQUIRED_ARRAYS.some((key) => !Array.isArray(value[key])) ||
    REQUIRED_OBJECTS.some(
      (key) =>
        !value[key] ||
        typeof value[key] !== 'object' ||
        Array.isArray(value[key]),
    )
  ) {
    return false
  }

  const meta = value.meta
  const validRecaps = value.recap.every(
    (recap) =>
      recap &&
      typeof recap === 'object' &&
      !Array.isArray(recap) &&
      hasExactKeys(recap, RECAP_KEYS) &&
      recap.planned &&
      typeof recap.planned === 'object' &&
      !Array.isArray(recap.planned) &&
      hasExactKeys(recap.planned, PLANNED_KEYS) &&
      Number.isFinite(recap.planned.low) &&
      Number.isFinite(recap.planned.high) &&
      Number.isFinite(recap.actual) &&
      Array.isArray(recap.itemIds) &&
      recap.itemIds.every((itemId) => typeof itemId === 'string') &&
      Array.isArray(recap.sourceIds) &&
      recap.sourceIds.every((sourceId) => typeof sourceId === 'string') &&
      recap.itemIds.length === recap.sourceIds.length &&
      Number.isInteger(recap.weekIndex),
  )
  const recapWeekIndexes = validRecaps
    ? value.recap.map((recap) => recap.weekIndex).sort()
    : []
  const exportCreated = value.telemetry.filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      entry.type === 'export-created',
  )
  const blockedCaptureCreated = value.telemetry.filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      entry.type === 'blocked-capture-created',
  )
  const validCommonContract =
    hasExactKeys(value.finalState, FINAL_STATE_KEYS) &&
    Array.isArray(value.finalState.processedScriptEventIds) &&
    value.finalState.processedScriptEventIds.every(
      (eventId) => typeof eventId === 'string',
    ) &&
    validRecaps &&
    typeof meta.sampleId === 'string' &&
    SAMPLE_ID_PATTERN.test(meta.sampleId) &&
    meta.sampleId.length <= 16 &&
    typeof meta.sessionId === 'string' &&
    SESSION_ID_PATTERN.test(meta.sessionId) &&
    typeof meta.buildId === 'string' &&
    BUILD_ID_PATTERN.test(meta.buildId) &&
    meta.buildId.length <= 64 &&
    meta.buildId === buildMetadata.buildId &&
    typeof meta.gitSha === 'string' &&
    GIT_SHA_PATTERN.test(meta.gitSha) &&
    meta.gitSha === buildMetadata.gitSha &&
    typeof meta.artifactHash === 'string' &&
    ARTIFACT_HASH_PATTERN.test(meta.artifactHash) &&
    meta.artifactHash === buildMetadata.artifactHash &&
    typeof meta.initialStateHash === 'string' &&
    INITIAL_STATE_HASH_PATTERN.test(meta.initialStateHash) &&
    meta.initialStateHash === buildMetadata.initialStateHash &&
    typeof meta.scenarioId === 'string' &&
    meta.scenarioId === 'gate1-two-week-management' &&
    typeof meta.scenarioVersion === 'string' &&
    meta.scenarioVersion === '0.4.0' &&
    Number.isInteger(meta.fixedSeed) &&
    meta.fixedSeed === 104729 &&
    typeof meta.viewport === 'string' &&
    /^\d+x\d+$/.test(meta.viewport) &&
    typeof meta.inputDevice === 'string' &&
    meta.inputDevice === 'browser-pointer-keyboard'
  if (!validCommonContract) return false

  if (isBlocked) {
    return (
      Number.isInteger(value.blockedAtTick) &&
      value.blockedAtTick >= SCENARIO_START_TICK &&
      value.blockedAtTick <= 2010 &&
      value.finalTick === value.blockedAtTick &&
      typeof value.blockedReason === 'string' &&
      value.blockedReason === value.blockedReason.trim() &&
      value.blockedReason.length > 0 &&
      value.blockedReason.length <= MAX_BLOCKED_REASON_LENGTH &&
      value.finalState.isComplete === false &&
      Number.isInteger(value.finalState.completedWeekCount) &&
      value.finalState.completedWeekCount >= 0 &&
      value.finalState.completedWeekCount <= 2 &&
      value.finalState.recapCount === value.finalState.completedWeekCount &&
      value.recap.length === value.finalState.recapCount &&
      JSON.stringify(recapWeekIndexes) ===
        JSON.stringify(value.recap.map((_, weekIndex) => weekIndex)) &&
      exportCreated.length === 0 &&
      blockedCaptureCreated.length === 1 &&
      blockedCaptureCreated[0].atTick === value.blockedAtTick
    )
  }

  return (
    value.finalTick === 2010 &&
    value.finalState.isComplete === true &&
    value.finalState.completedWeekCount === 2 &&
    value.finalState.recapCount === 2 &&
    value.recap.length === 2 &&
    JSON.stringify(recapWeekIndexes) === JSON.stringify([0, 1]) &&
    exportCreated.length === 1 &&
    exportCreated[0].atTick === 2010 &&
    blockedCaptureCreated.length === 0
  )
}

function readBody(request, response, onComplete) {
  const chunks = []
  let byteLength = 0
  request.on('data', (chunk) => {
    byteLength += chunk.byteLength
    if (byteLength <= MAX_EXPORT_BYTES) chunks.push(chunk)
  })
  request.on('end', () => {
    if (byteLength > MAX_EXPORT_BYTES) {
      sendJson(response, 413, { error: '匿名导出超过大小上限' })
      return
    }
    onComplete(Buffer.concat(chunks))
  })
  request.on('error', () => {
    if (!response.headersSent) {
      sendJson(response, 400, { error: '匿名导出请求中断' })
    }
  })
}

function installIfAbsent(path, bytes) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  writeFileSync(temporaryPath, bytes, { flag: 'wx', mode: 0o600 })
  try {
    linkSync(temporaryPath, path)
    return true
  } catch (error) {
    if (error?.code === 'EEXIST') return false
    throw error
  } finally {
    unlinkSync(temporaryPath)
  }
}

function createReceipt(
  filename,
  bytes,
  sha256,
  metadata,
  capturedAtUtc,
  capture,
) {
  return {
    schemaVersion: 'gate1-capture-receipt-v1',
    captureVersion: CAPTURE_VERSION,
    filename,
    bytes: bytes.byteLength,
    sha256,
    capturedAtUtc,
    sampleId: metadata.sampleId,
    sessionId: metadata.sessionId,
    buildId: metadata.buildId,
    gitSha: metadata.gitSha,
    artifactHash: metadata.artifactHash,
    ...(capture?.captureKind === 'blocked'
      ? {
          captureKind: 'blocked',
          blockedAtTick: capture.blockedAtTick,
          isComplete: false,
        }
      : {}),
  }
}

function validCapturedAt(value) {
  if (typeof value !== 'string') return false
  try {
    return new Date(value).toISOString() === value
  } catch {
    return false
  }
}

function readMatchingReceipt(path, expected) {
  let receipt
  let receiptText
  try {
    receiptText = readFileSync(path, 'utf8')
    receipt = JSON.parse(receiptText)
  } catch {
    return undefined
  }
  if (
    !receipt ||
    typeof receipt !== 'object' ||
    Array.isArray(receipt) ||
    !hasExactKeys(
      receipt,
      receipt.captureKind === 'blocked'
        ? BLOCKED_RECEIPT_KEYS
        : RECEIPT_KEYS,
    ) ||
    !validCapturedAt(receipt.capturedAtUtc) ||
    receiptText !== `${JSON.stringify(receipt, null, 2)}\n`
  ) {
    return undefined
  }
  return Object.entries(expected).every(
    ([key, value]) => receipt[key] === value,
  )
    ? receipt
    : undefined
}

function matchingEvidence(sidecarPath, receiptPath, sidecarBytes, expectedReceipt) {
  if (!existsSync(sidecarPath) || !existsSync(receiptPath)) return undefined
  if (!readFileSync(sidecarPath).equals(sidecarBytes)) return undefined
  return readMatchingReceipt(receiptPath, expectedReceipt)
}

function writeCapture(captureRoot, filename, bytes, metadata, capture) {
  const rawPath = join(captureRoot, filename)
  const sidecarPath = `${rawPath}.sha256`
  const receiptPath = `${rawPath}.receipt.json`
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const sidecarBytes = Buffer.from(`${sha256}  ${filename}\n`)
  const expectedReceipt = createReceipt(
    filename,
    bytes,
    sha256,
    metadata,
    undefined,
    capture,
  )
  delete expectedReceipt.capturedAtUtc

  const rawExists = existsSync(rawPath)
  const sidecarExists = existsSync(sidecarPath)
  const receiptExists = existsSync(receiptPath)
  if (rawExists) {
    if (!readFileSync(rawPath).equals(bytes)) return { conflict: true }
    const receipt = matchingEvidence(
      sidecarPath,
      receiptPath,
      sidecarBytes,
      expectedReceipt,
    )
    return receipt
      ? { receipt, status: 200, rawPath }
      : { conflict: true }
  }
  if (sidecarExists !== receiptExists) return { conflict: true }
  if (sidecarExists && receiptExists) {
    const receipt = matchingEvidence(
      sidecarPath,
      receiptPath,
      sidecarBytes,
      expectedReceipt,
    )
    if (!receipt) return { conflict: true }
    const installed = installIfAbsent(rawPath, bytes)
    if (!installed && !readFileSync(rawPath).equals(bytes)) {
      return { conflict: true }
    }
    return { receipt, status: installed ? 201 : 200, rawPath }
  }

  const newReceipt = createReceipt(
    filename,
    bytes,
    sha256,
    metadata,
    new Date().toISOString(),
    capture,
  )
  const receiptBytes = Buffer.from(`${JSON.stringify(newReceipt, null, 2)}\n`)
  if (!installIfAbsent(sidecarPath, sidecarBytes)) return { conflict: true }
  if (!installIfAbsent(receiptPath, receiptBytes)) return { conflict: true }
  const receipt = matchingEvidence(
    sidecarPath,
    receiptPath,
    sidecarBytes,
    expectedReceipt,
  )
  if (!receipt) return { conflict: true }

  const installed = installIfAbsent(rawPath, bytes)
  if (!installed && !readFileSync(rawPath).equals(bytes)) {
    return { conflict: true }
  }
  return { receipt, status: installed ? 201 : 200, rawPath }
}

function createHandler(distRoot, captureRoot, buildMetadata) {
  const downloads = new Map()

  return (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (request.method === 'POST' && url.pathname === CAPTURE_PATH) {
      if (!request.headers['content-type']?.startsWith('application/json')) {
        sendJson(response, 415, { error: '匿名导出必须使用 JSON' })
        return
      }
      readBody(request, response, (bytes) => {
        let payload
        try {
          const text = bytes.toString('utf8')
          if (!Buffer.from(text, 'utf8').equals(bytes)) {
            sendJson(response, 400, { error: '匿名导出不是有效 UTF-8' })
            return
          }
          payload = JSON.parse(text)
        } catch {
          sendJson(response, 400, { error: '匿名导出不是有效 JSON' })
          return
        }
        if (!validExport(payload, buildMetadata)) {
          sendJson(response, 400, { error: '匿名导出合同无效' })
          return
        }

        const { meta } = payload
        const capture =
          payload.captureKind === 'blocked'
            ? {
                captureKind: 'blocked',
                blockedAtTick: payload.blockedAtTick,
              }
            : undefined
        const filename = `${meta.buildId}-${meta.sampleId}-${meta.sessionId}.json`
        let result
        try {
          result = writeCapture(captureRoot, filename, bytes, meta, capture)
        } catch {
          sendJson(response, 500, { error: '匿名导出无法写入证据目录' })
          return
        }
        if (result.conflict) {
          sendJson(response, 409, { error: '同一会话证据链缺失或不一致' })
          return
        }

        const token = randomUUID()
        downloads.set(token, {
          filename,
          rawPath: result.rawPath,
        })
        sendJson(response, result.status, {
          ...result.receipt,
          downloadUrl: `${CAPTURE_PATH}/${token}`,
        })
      })
      return
    }

    if (request.method === 'GET' && url.pathname.startsWith(`${CAPTURE_PATH}/`)) {
      const token = url.pathname.slice(CAPTURE_PATH.length + 1)
      const download = downloads.get(token)
      if (!download || !SESSION_ID_PATTERN.test(token)) {
        sendJson(response, 404, { error: '匿名导出下载凭据无效' })
        return
      }
      let size
      try {
        size = statSync(download.rawPath).size
      } catch {
        sendJson(response, 404, { error: '匿名导出文件不存在' })
        return
      }
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${download.filename}"`,
        'Content-Length': size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      createReadStream(download.rawPath).pipe(response)
      return
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Method Not Allowed' })
      return
    }
    let pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      sendJson(response, 400, { error: 'URL 无效' })
      return
    }
    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
    const absolutePath = resolve(distRoot, relativePath)
    if (
      absolutePath !== distRoot &&
      !absolutePath.startsWith(`${distRoot}${sep}`)
    ) {
      sendJson(response, 404, { error: 'Not Found' })
      return
    }
    let stat
    try {
      stat = statSync(absolutePath)
    } catch {
      sendJson(response, 404, { error: 'Not Found' })
      return
    }
    if (!stat.isFile()) {
      sendJson(response, 404, { error: 'Not Found' })
      return
    }
    response.writeHead(200, {
      'Content-Type':
        CONTENT_TYPES[extname(absolutePath)] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': relativePath === 'index.html' ? 'no-store' : 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    createReadStream(absolutePath).pipe(response)
  }
}

export function createPlaytestHost({
  captureRoot,
  distRoot,
  host = '127.0.0.1',
  port = 4186,
}) {
  const resolvedDistRoot = resolve(distRoot)
  const resolvedCaptureRoot = resolve(captureRoot)
  const buildMetadata = JSON.parse(
    readFileSync(join(resolvedDistRoot, 'rc-build.json'), 'utf8'),
  )
  mkdirSync(resolvedCaptureRoot, { recursive: true })
  const server = createServer(
    createHandler(resolvedDistRoot, resolvedCaptureRoot, buildMetadata),
  )
  return {
    captureRoot: resolvedCaptureRoot,
    host,
    port,
    server,
    start() {
      return new Promise((resolveStart, reject) => {
        server.once('error', reject)
        server.listen(port, host, () => {
          server.off('error', reject)
          resolveStart(server.address())
        })
      })
    },
  }
}

async function main() {
  const host = argument('--host') ?? '127.0.0.1'
  const port = Number(argument('--port') ?? 4186)
  const explicitCaptureRoot = argument('--capture-dir')
  const distRoot = import.meta.dirname
  const captureRoot = resolve(
    explicitCaptureRoot ?? join(distRoot, '..', 'captures'),
  )
  if (host !== '127.0.0.1') {
    throw new Error('Gate 1 capture host 只允许绑定 127.0.0.1')
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Gate 1 capture host 端口无效')
  }
  const playtestHost = createPlaytestHost({
    captureRoot,
    distRoot,
    host,
    port,
  })
  await playtestHost.start()
  process.stdout.write(
    `Gate 1 RC listening on http://${host}:${port}/; capture=${captureRoot}\n`,
  )

  const stop = () => {
    playtestHost.server.close(() => {
      process.exit(0)
    })
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`)
    process.exit(1)
  })
}
