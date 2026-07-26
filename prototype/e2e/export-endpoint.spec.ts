import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { expect, test, type APIRequestContext } from '@playwright/test'

interface RcBuildMetadata {
  artifactHash: string
  buildId: string
  gitSha: string
  initialStateHash: string
}

async function readBuildMetadata(request: APIRequestContext) {
  const response = await request.get('/rc-build.json')
  expect(response.ok()).toBe(true)
  return (await response.json()) as RcBuildMetadata
}

function validPayload(
  buildMetadata: RcBuildMetadata,
  sessionId = randomUUID(),
) {
  return {
    actions: [],
    candidateEditGroups: [],
    domainEvents: [],
    finalState: {
      completedWeekCount: 2,
      isComplete: true,
      processedScriptEventIds: [],
      recapCount: 2,
    },
    finalStateHash: 'fnv1a32-1234abcd',
    finalTick: 2010,
    machineTiming: {
      machineElapsedMs: 1000,
      machineEndedAtEpochMs: 2,
      machineStartedAtEpochMs: 1,
      week1RawDurationMs: 500,
      week2RawDurationMs: 500,
    },
    meta: {
      artifactHash: buildMetadata.artifactHash,
      buildId: buildMetadata.buildId,
      fixedSeed: 104729,
      gitSha: buildMetadata.gitSha,
      initialStateHash: buildMetadata.initialStateHash,
      inputDevice: 'browser-pointer-keyboard',
      sampleId: 'A99',
      scenarioId: 'gate1-two-week-management',
      scenarioVersion: '0.4.0',
      sessionId,
      viewport: '1440x900',
    },
    recap: [
      {
        weekIndex: 0,
        planned: { low: 0, high: 0 },
        actual: 0,
        itemIds: [],
        sourceIds: [],
      },
      {
        weekIndex: 1,
        planned: { low: 0, high: 0 },
        actual: 0,
        itemIds: [],
        sourceIds: [],
      },
    ],
    schemaVersion: 'gate1-playtest-v1',
    speedTrajectory: [],
    summary: {
      week1CandidateEditCount: 0,
      week2CandidateEditCount: 0,
    },
    telemetry: [
      {
        type: 'export-created',
        atTick: 2010,
        machineOffsetMs: 1000,
      },
    ],
  }
}

function validBlockedPayload(
  buildMetadata: RcBuildMetadata,
  sessionId = randomUUID(),
) {
  const payload = validPayload(buildMetadata, sessionId)
  return {
    ...payload,
    captureKind: 'blocked',
    blockedAtTick: 288,
    blockedReason: '水泵事件后界面无法继续推进',
    finalTick: 288,
    finalState: {
      ...payload.finalState,
      completedWeekCount: 0,
      isComplete: false,
      recapCount: 0,
    },
    recap: [],
    telemetry: [
      {
        type: 'blocked-capture-created',
        atTick: 288,
        machineOffsetMs: 1000,
      },
    ],
  }
}

test('playtest host captures raw bytes once and returns a verified attachment', async ({
  request,
}) => {
  const buildMetadata = await readBuildMetadata(request)
  const payload = validPayload(buildMetadata)
  const rawJson = JSON.stringify(payload, null, 2)
  const rawBytes = Buffer.from(rawJson, 'utf8')
  const expectedSha256 = createHash('sha256').update(rawBytes).digest('hex')
  const expectedFilename =
    `${payload.meta.buildId}-${payload.meta.sampleId}-${payload.meta.sessionId}.json`

  const firstCapture = await request.post('/__gate1/capture', {
    data: rawBytes,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })

  expect(firstCapture.status()).toBe(201)
  expect(firstCapture.headers()['content-type']).toBe(
    'application/json; charset=utf-8',
  )
  expect(firstCapture.headers()['cache-control']).toBe('no-store')
  const firstReceipt = await firstCapture.json()
  expect(firstReceipt).toMatchObject({
    schemaVersion: 'gate1-capture-receipt-v1',
    captureVersion: 'gate1-capture-host-v1',
    filename: expectedFilename,
    bytes: rawBytes.byteLength,
    sha256: expectedSha256,
    sampleId: payload.meta.sampleId,
    sessionId: payload.meta.sessionId,
    buildId: buildMetadata.buildId,
    gitSha: buildMetadata.gitSha,
    artifactHash: buildMetadata.artifactHash,
  })
  expect(firstReceipt.capturedAtUtc).toEqual(expect.any(String))
  expect(firstReceipt.downloadUrl).toMatch(
    /^\/__gate1\/capture\/[a-f0-9-]+$/,
  )
  expect(JSON.stringify(firstReceipt)).not.toContain('/tmp/')
  expect(JSON.stringify(firstReceipt)).not.toContain('/Users/')
  const captureRoot = join(process.cwd(), 'test-results', 'captures')
  const rawPath = join(captureRoot, expectedFilename)
  expect(readFileSync(rawPath).equals(rawBytes)).toBe(true)
  expect(readFileSync(`${rawPath}.sha256`, 'utf8')).toBe(
    `${expectedSha256}  ${expectedFilename}\n`,
  )
  const { downloadUrl: _downloadUrl, ...storedReceipt } = firstReceipt
  expect(JSON.parse(readFileSync(`${rawPath}.receipt.json`, 'utf8'))).toEqual(
    storedReceipt,
  )

  const download = await request.get(firstReceipt.downloadUrl)
  expect(download.status()).toBe(200)
  expect(download.headers()['content-type']).toBe(
    'application/json; charset=utf-8',
  )
  expect(download.headers()['content-disposition']).toBe(
    `attachment; filename="${expectedFilename}"`,
  )
  expect(download.headers()['content-length']).toBe(String(rawBytes.byteLength))
  expect(download.headers()['cache-control']).toBe('no-store')
  const downloadedBytes = await download.body()
  expect(downloadedBytes.equals(rawBytes)).toBe(true)
  expect(createHash('sha256').update(downloadedBytes).digest('hex')).toBe(
    firstReceipt.sha256,
  )

  const retry = await request.post('/__gate1/capture', {
    data: rawBytes,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
  expect(retry.status()).toBe(200)
  const retryReceipt = await retry.json()
  expect(retryReceipt).toMatchObject({
    filename: firstReceipt.filename,
    bytes: firstReceipt.bytes,
    sha256: firstReceipt.sha256,
    capturedAtUtc: firstReceipt.capturedAtUtc,
  })

  const conflictingBytes = Buffer.from(
    JSON.stringify(
      {
        ...payload,
        machineTiming: {
          ...payload.machineTiming,
          machineElapsedMs: payload.machineTiming.machineElapsedMs + 1,
        },
      },
      null,
      2,
    ),
    'utf8',
  )
  const conflict = await request.post('/__gate1/capture', {
    data: conflictingBytes,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
  expect(conflict.status()).toBe(409)
  await expect(conflict.json()).resolves.toEqual({
    error: '同一会话证据链缺失或不一致',
  })
})

test('playtest host captures an unfinished blocked record as verifiable evidence', async ({
  request,
}) => {
  const buildMetadata = await readBuildMetadata(request)
  const payload = validBlockedPayload(buildMetadata)
  const rawJson = JSON.stringify(payload, null, 2)
  const rawBytes = Buffer.from(rawJson, 'utf8')
  const expectedSha256 = createHash('sha256').update(rawBytes).digest('hex')
  const expectedFilename =
    `${payload.meta.buildId}-${payload.meta.sampleId}-${payload.meta.sessionId}.json`

  const capture = await request.post('/__gate1/capture', {
    data: rawBytes,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })

  expect(capture.status()).toBe(201)
  const receipt = await capture.json()
  expect(receipt).toMatchObject({
    schemaVersion: 'gate1-capture-receipt-v1',
    captureVersion: 'gate1-capture-host-v1',
    captureKind: 'blocked',
    blockedAtTick: 288,
    isComplete: false,
    filename: expectedFilename,
    bytes: rawBytes.byteLength,
    sha256: expectedSha256,
  })
  const captureRoot = join(process.cwd(), 'test-results', 'captures')
  const rawPath = join(captureRoot, expectedFilename)
  expect(readFileSync(rawPath).equals(rawBytes)).toBe(true)
  expect(readFileSync(`${rawPath}.sha256`, 'utf8')).toBe(
    `${expectedSha256}  ${expectedFilename}\n`,
  )
  expect(
    JSON.parse(readFileSync(`${rawPath}.receipt.json`, 'utf8')),
  ).toMatchObject({
    captureKind: 'blocked',
    blockedAtTick: 288,
    isComplete: false,
  })
})

test('playtest host rejects an empty or oversized blocked reason', async ({
  request,
}) => {
  const buildMetadata = await readBuildMetadata(request)
  for (const blockedReason of ['', '   ', 'x'.repeat(241)]) {
    const payload = {
      ...validBlockedPayload(buildMetadata),
      blockedReason,
    }
    const response = await request.post('/__gate1/capture', {
      data: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status(), `reason length=${blockedReason.length}`).toBe(400)
  }
})

test('playtest host rejects blocked mode and state contradictions', async ({
  request,
}) => {
  const buildMetadata = await readBuildMetadata(request)
  const invalidPayloads = [
    {
      label: 'missing blocked capture marker',
      payload: {
        ...validBlockedPayload(buildMetadata),
        telemetry: [],
      },
    },
    {
      label: 'complete export marker in blocked mode',
      payload: {
        ...validBlockedPayload(buildMetadata),
        telemetry: [
          {
            type: 'export-created',
            atTick: 288,
            machineOffsetMs: 1000,
          },
        ],
      },
    },
    {
      label: 'blocked tick differs from final tick',
      payload: {
        ...validBlockedPayload(buildMetadata),
        blockedAtTick: 287,
      },
    },
    {
      label: 'blocked mode claims completion',
      payload: {
        ...validBlockedPayload(buildMetadata),
        finalState: {
          ...validBlockedPayload(buildMetadata).finalState,
          isComplete: true,
        },
      },
    },
  ]

  for (const { label, payload } of invalidPayloads) {
    const response = await request.post('/__gate1/capture', {
      data: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status(), label).toBe(400)
  }
})

test('playtest host rejects malformed or out-of-contract captures', async ({
  request,
}) => {
  const buildMetadata = await readBuildMetadata(request)

  const wrongContentType = await request.post('/__gate1/capture', {
    data: JSON.stringify(validPayload(buildMetadata)),
    headers: { 'Content-Type': 'text/plain' },
  })
  expect(wrongContentType.status()).toBe(415)

  const invalidJson = await request.post('/__gate1/capture', {
    data: Buffer.from('{"schemaVersion":', 'utf8'),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(invalidJson.status()).toBe(400)

  const invalidUtf8 = await request.post('/__gate1/capture', {
    data: Buffer.from([0xc3, 0x28]),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(invalidUtf8.status()).toBe(400)

  const missingField = validPayload(buildMetadata)
  delete (missingField as Partial<typeof missingField>).recap
  const missingFieldResponse = await request.post('/__gate1/capture', {
    data: JSON.stringify(missingField),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(missingFieldResponse.status()).toBe(400)

  const extraField = {
    ...validPayload(buildMetadata),
    forbiddenFreeText: 'must not be accepted',
  }
  const extraFieldResponse = await request.post('/__gate1/capture', {
    data: JSON.stringify(extraField),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(extraFieldResponse.status()).toBe(400)

  const wrongBuild = validPayload(buildMetadata)
  wrongBuild.meta.buildId = 'g1-e2e-not-current'
  const wrongBuildResponse = await request.post('/__gate1/capture', {
    data: JSON.stringify(wrongBuild),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(wrongBuildResponse.status()).toBe(400)

  const incompleteCaptures = [
    {
      label: 'non-final tick',
      payload: { ...validPayload(buildMetadata), finalTick: 2009 },
    },
    {
      label: 'incomplete final state',
      payload: {
        ...validPayload(buildMetadata),
        finalState: {
          ...validPayload(buildMetadata).finalState,
          isComplete: false,
        },
      },
    },
    {
      label: 'one completed week',
      payload: {
        ...validPayload(buildMetadata),
        finalState: {
          ...validPayload(buildMetadata).finalState,
          completedWeekCount: 1,
        },
      },
    },
    {
      label: 'one recap in final state',
      payload: {
        ...validPayload(buildMetadata),
        finalState: {
          ...validPayload(buildMetadata).finalState,
          recapCount: 1,
        },
      },
    },
    {
      label: 'extra final state field',
      payload: {
        ...validPayload(buildMetadata),
        finalState: {
          ...validPayload(buildMetadata).finalState,
          forbiddenFreeText: 'must not be accepted',
        },
      },
    },
    {
      label: 'invalid processed event ids',
      payload: {
        ...validPayload(buildMetadata),
        finalState: {
          ...validPayload(buildMetadata).finalState,
          processedScriptEventIds: ['pump-incident-day-3', 1],
        },
      },
    },
    {
      label: 'missing week recap',
      payload: {
        ...validPayload(buildMetadata),
        recap: validPayload(buildMetadata).recap.slice(0, 1),
      },
    },
    {
      label: 'duplicate week recap',
      payload: {
        ...validPayload(buildMetadata),
        recap: validPayload(buildMetadata).recap.map((recap) => ({
          ...recap,
          weekIndex: 0,
        })),
      },
    },
    {
      label: 'malformed week recap',
      payload: {
        ...validPayload(buildMetadata),
        recap: validPayload(buildMetadata).recap.map((recap, index) =>
          index === 0
            ? {
                ...recap,
                planned: { low: 0 },
              }
            : recap,
        ),
      },
    },
    {
      label: 'missing export-created',
      payload: {
        ...validPayload(buildMetadata),
        telemetry: [],
      },
    },
    {
      label: 'duplicate export-created',
      payload: {
        ...validPayload(buildMetadata),
        telemetry: [
          ...validPayload(buildMetadata).telemetry,
          ...validPayload(buildMetadata).telemetry,
        ],
      },
    },
    {
      label: 'export-created before final tick',
      payload: {
        ...validPayload(buildMetadata),
        telemetry: validPayload(buildMetadata).telemetry.map((entry) => ({
          ...entry,
          atTick: 2009,
        })),
      },
    },
  ]
  for (const { label, payload } of incompleteCaptures) {
    const response = await request.post('/__gate1/capture', {
      data: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status(), label).toBe(400)
  }

  for (const sampleId of ['A01suffix', 'A01"', 'A01\r\nInjected']) {
    const maliciousSample = validPayload(buildMetadata)
    maliciousSample.meta.sampleId = sampleId
    const maliciousSampleResponse = await request.post('/__gate1/capture', {
      data: JSON.stringify(maliciousSample),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(
      maliciousSampleResponse.status(),
      `sampleId=${JSON.stringify(sampleId)}`,
    ).toBe(400)
  }

  const tooLarge = await request.post('/__gate1/capture', {
    data: Buffer.alloc(2 * 1024 * 1024 + 1, 0x20),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(tooLarge.status()).toBe(413)

  const invalidToken = await request.get(
    '/__gate1/capture/00000000-0000-4000-8000-000000000000',
  )
  expect(invalidToken.status()).toBe(404)
})

test('playtest host rejects a missing or tampered committed sidecar', async ({
  request,
}) => {
  const buildMetadata = await readBuildMetadata(request)
  const captureRoot = join(process.cwd(), 'test-results', 'captures')
  const mutations = [
    {
      label: 'missing sha256',
      suffix: '.sha256',
      mutate(path: string) {
        unlinkSync(path)
      },
    },
    {
      label: 'tampered sha256',
      suffix: '.sha256',
      mutate(path: string) {
        writeFileSync(path, `${'0'.repeat(64)}  tampered.json\n`)
      },
    },
    {
      label: 'missing receipt',
      suffix: '.receipt.json',
      mutate(path: string) {
        unlinkSync(path)
      },
    },
    {
      label: 'tampered receipt',
      suffix: '.receipt.json',
      mutate(path: string) {
        const receipt = JSON.parse(readFileSync(path, 'utf8'))
        writeFileSync(
          path,
          `${JSON.stringify({ ...receipt, sha256: '0'.repeat(64) }, null, 2)}\n`,
        )
      },
    },
    {
      label: 'non-canonical receipt bytes',
      suffix: '.receipt.json',
      mutate(path: string) {
        const receipt = JSON.parse(readFileSync(path, 'utf8'))
        writeFileSync(path, JSON.stringify(receipt))
      },
    },
  ]

  for (const mutation of mutations) {
    const payload = validPayload(buildMetadata)
    const rawBytes = Buffer.from(JSON.stringify(payload, null, 2))
    const filename =
      `${payload.meta.buildId}-${payload.meta.sampleId}-${payload.meta.sessionId}.json`
    const first = await request.post('/__gate1/capture', {
      data: rawBytes,
      headers: { 'Content-Type': 'application/json' },
    })
    expect(first.status(), mutation.label).toBe(201)

    mutation.mutate(join(captureRoot, `${filename}${mutation.suffix}`))
    const retry = await request.post('/__gate1/capture', {
      data: rawBytes,
      headers: { 'Content-Type': 'application/json' },
    })
    expect(retry.status(), mutation.label).toBe(409)
    await expect(retry.json()).resolves.toEqual({
      error: '同一会话证据链缺失或不一致',
    })
  }
})

test('playtest host only recovers an uncommitted raw from two exact sidecars', async ({
  request,
}) => {
  const buildMetadata = await readBuildMetadata(request)
  const captureRoot = join(process.cwd(), 'test-results', 'captures')
  const payload = validPayload(buildMetadata)
  const rawBytes = Buffer.from(JSON.stringify(payload, null, 2))
  const sha256 = createHash('sha256').update(rawBytes).digest('hex')
  const filename =
    `${payload.meta.buildId}-${payload.meta.sampleId}-${payload.meta.sessionId}.json`
  const rawPath = join(captureRoot, filename)
  const receipt = {
    schemaVersion: 'gate1-capture-receipt-v1',
    captureVersion: 'gate1-capture-host-v1',
    filename,
    bytes: rawBytes.byteLength,
    sha256,
    capturedAtUtc: '2026-07-26T06:00:00.000Z',
    sampleId: payload.meta.sampleId,
    sessionId: payload.meta.sessionId,
    buildId: payload.meta.buildId,
    gitSha: payload.meta.gitSha,
    artifactHash: payload.meta.artifactHash,
  }
  writeFileSync(`${rawPath}.sha256`, `${sha256}  ${filename}\n`, {
    flag: 'wx',
    mode: 0o600,
  })
  writeFileSync(
    `${rawPath}.receipt.json`,
    `${JSON.stringify(receipt, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 },
  )

  const recovered = await request.post('/__gate1/capture', {
    data: rawBytes,
    headers: { 'Content-Type': 'application/json' },
  })
  expect(recovered.status()).toBe(201)
  expect(readFileSync(rawPath).equals(rawBytes)).toBe(true)
  expect(await recovered.json()).toMatchObject(receipt)

  const partialPayload = validPayload(buildMetadata)
  const partialBytes = Buffer.from(JSON.stringify(partialPayload, null, 2))
  const partialSha256 = createHash('sha256')
    .update(partialBytes)
    .digest('hex')
  const partialFilename =
    `${partialPayload.meta.buildId}-${partialPayload.meta.sampleId}-${partialPayload.meta.sessionId}.json`
  const partialRawPath = join(captureRoot, partialFilename)
  writeFileSync(
    `${partialRawPath}.sha256`,
    `${partialSha256}  ${partialFilename}\n`,
    { flag: 'wx', mode: 0o600 },
  )
  const partial = await request.post('/__gate1/capture', {
    data: partialBytes,
    headers: { 'Content-Type': 'application/json' },
  })
  expect(partial.status()).toBe(409)
  expect(existsSync(partialRawPath)).toBe(false)
  expect(
    readdirSync(captureRoot).filter((name) => name.endsWith('.tmp')),
  ).toEqual([])
})
