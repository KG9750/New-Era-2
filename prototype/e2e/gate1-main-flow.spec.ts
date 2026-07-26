import { createHash } from 'node:crypto'
import { expect, test, type Download, type Page } from '@playwright/test'

async function readDownload(download: Download) {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function downloadSession(page: Page) {
  const capturePending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/__gate1/capture' &&
      response.request().method() === 'POST',
  )
  const downloadPending = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载匿名 JSON' }).click()
  const [capture, download] = await Promise.all([
    capturePending,
    downloadPending,
  ])
  expect([200, 201]).toContain(capture.status())
  const receipt = await capture.json()
  const requestBytes = capture.request().postDataBuffer()
  expect(requestBytes).not.toBeNull()
  expect(new URL(download.url()).pathname).toBe(receipt.downloadUrl)
  expect(download.suggestedFilename()).toBe(receipt.filename)
  expect(await download.failure()).toBeNull()
  const downloadedBytes = await readDownload(download)
  expect(downloadedBytes.byteLength).toBe(receipt.bytes)
  expect(createHash('sha256').update(downloadedBytes).digest('hex')).toBe(
    receipt.sha256,
  )
  expect(downloadedBytes.equals(requestBytes!)).toBe(true)
  return {
    exported: JSON.parse(downloadedBytes.toString('utf8')),
    receipt,
    requestBytes: requestBytes!,
  }
}

test('new session to two-week export and memory clear', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.clock.install({ time: new Date('2026-07-26T06:00:00Z') })
  await page.goto('/')
  const buildMetadata = await page
    .request
    .get('/rc-build.json')
    .then((response) => response.json())

  await expect(
    page.getByRole('heading', { name: '开始匿名新会话' }),
  ).toBeVisible()
  await expect(page.getByText(buildMetadata.buildId)).toBeVisible()
  await expect(page.getByTitle(buildMetadata.gitSha)).toBeVisible()
  await expect(page.getByTitle(buildMetadata.artifactHash)).toBeVisible()
  await expect(page.getByText(buildMetadata.initialStateHash)).toBeVisible()
  const sampleInput = page.getByLabel('匿名编号')
  await sampleInput.fill('M-C')
  await sampleInput.focus()
  await page.keyboard.press('Tab')
  const createSessionButton = page.getByRole('button', {
    name: '创建固定初态会话',
  })
  await expect(createSessionButton).toBeFocused()
  expect(
    await createSessionButton.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    ),
  ).not.toBe('none')
  await page.keyboard.press('Enter')

  const meta = page.getByRole('region', { name: '当前测试会话元数据' })
  await expect(meta).toContainText('M-C')
  await expect(meta).toContainText(buildMetadata.buildId)
  await expect(meta).toContainText(buildMetadata.gitSha)
  await expect(meta).toContainText(buildMetadata.artifactHash)
  await expect(meta).toContainText(buildMetadata.initialStateHash)
  await expect(meta).toContainText('0.4.0')
  await expect(meta).toContainText('104729')
  const firstSessionId = (await meta.locator('div').last().locator('strong').textContent())!

  await page.getByRole('button', { name: '展开完整周计划' }).click()
  const firstWeekGrid = page.getByRole('grid', { name: '第 1 周完整计划' })
  await firstWeekGrid
    .getByRole('gridcell', { name: /陈渡 第1日 B3 16–19/ })
    .click()
  await page.getByLabel('批量活动').selectOption('study')
  await page.getByRole('button', { name: '修改所选格' }).click()
  await page.getByRole('button', { name: '撤销上次日程修改' }).click()
  await page.getByRole('button', { name: '收起' }).click()

  await page
    .getByRole('button', { name: /水泵需要 2 个预防性维修块/ })
    .click()
  await expect(
    page.getByRole('button', { name: /水泵需要 2 个预防性维修块/ }),
  ).toContainText('已定位 · 待处理')
  await page.getByRole('button', { name: /补足第 2 个检修块/ }).click()
  await expect(
    page.getByRole('button', { name: /水泵检修已安排 2 个维修块/ }),
  ).toContainText('已安排 · 等待事件')
  await page
    .getByRole('button', { name: '开启短通路 · 维修保障 −1' })
    .click()

  await page.getByRole('button', { name: '8×' }).click()
  await page.getByRole('button', { name: '开始运行' }).click()
  await page.clock.runFor(10_000)
  await expect(page.getByRole('heading', { name: /水泵异常，检修奏效/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /水泵检修已安排 2 个维修块/ }),
  ).toContainText('已兑现 · 检修奏效')
  await page.getByRole('button', { name: '确认后继续' }).click()
  await expect(page.getByText(/事件触发时，时钟自动暂停/)).toBeVisible()
  await expect(page.getByText(/时钟已自动暂停/)).toHaveCount(0)
  await page.clock.runFor(22_000)
  await expect(page.getByRole('heading', { name: /周末偏差复盘/ })).toBeVisible()
  await expect(page.getByText('本周安排已完成并结算，不是被撤销')).toBeVisible()
  await expect(page.getByRole('heading', { name: '粮食' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '保留休息' })).toHaveCount(0)

  await page.getByRole('button', { name: '确认复盘并进入第二周' }).click()
  await expect(page.getByText('基础计划已继承')).toBeVisible()
  await page
    .getByRole('button', { name: /林禾请求周二 B1 学习/ })
    .click()
  await page.getByRole('button', { name: '接受学习请求' }).click()
  await page.getByRole('button', { name: '开始运行' }).click()
  await page.clock.runFor(33_000)

  await expect(page.getByText('第 2 周结束')).toBeVisible()
  await expect(page.getByLabel(/两周总进度 100%/)).toBeVisible()
  await expect(page.getByText(/冻结为第二周结算快照/)).toBeVisible()
  await expect(page.getByRole('heading', { name: '粮食' })).toHaveCount(0)
  const recap = page.getByRole('heading', {
    name: /周末偏差复盘/,
  }).locator('..')
  await expect(recap).toContainText('12–13')
  await expect(recap).toContainText('12')
  const clearSessionButton = page.getByRole('button', {
    name: '结束并清空会话',
  })
  await expect(clearSessionButton).toBeDisabled()

  let failedRequestBytes: Buffer | undefined
  await page.route('**/__gate1/capture', async (route) => {
    failedRequestBytes = route.request().postDataBuffer() ?? undefined
    await route.fulfill({
      status: 500,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ error: '技术验证注入：证据目录暂不可写' }),
    })
  })
  await page.getByRole('button', { name: '下载匿名 JSON' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    '技术验证注入：证据目录暂不可写',
  )
  expect(failedRequestBytes).toBeDefined()
  await expect(meta).toContainText(firstSessionId)
  await expect(clearSessionButton).toBeDisabled()

  await page.unroute('**/__gate1/capture')
  const { exported, receipt, requestBytes } = await downloadSession(page)
  expect(requestBytes.equals(failedRequestBytes!)).toBe(true)
  expect(receipt).toMatchObject({
    schemaVersion: 'gate1-capture-receipt-v1',
    captureVersion: 'gate1-capture-host-v1',
    sampleId: 'M-C',
    sessionId: firstSessionId,
    buildId: buildMetadata.buildId,
    gitSha: buildMetadata.gitSha,
    artifactHash: buildMetadata.artifactHash,
  })
  await expect(page.getByText(/已保存并校验 tick 2010/)).toHaveText(
    '已保存并校验 tick 2010 的匿名记录。',
  )
  await expect(clearSessionButton).toBeEnabled()

  expect(exported).toMatchObject({
    schemaVersion: 'gate1-playtest-v1',
    meta: {
      sampleId: 'M-C',
      sessionId: firstSessionId,
      buildId: buildMetadata.buildId,
      gitSha: buildMetadata.gitSha,
      artifactHash: buildMetadata.artifactHash,
      initialStateHash: buildMetadata.initialStateHash,
      scenarioVersion: '0.4.0',
      fixedSeed: 104729,
    },
    finalTick: 2010,
    finalState: {
      isComplete: true,
      completedWeekCount: 2,
      recapCount: 2,
    },
  })
  expect(exported.recap).toHaveLength(2)
  expect(exported.machineTiming.week1RawDurationMs).toBeGreaterThan(0)
  expect(exported.machineTiming.week2RawDurationMs).toBeGreaterThan(0)
  expect(exported.domainEvents.map((event: { type: string }) => event.type)).toEqual(
    expect.arrayContaining(['pump-incident', 'week-ended']),
  )
  expect(exported.speedTrajectory.map((entry: { speed: number }) => entry.speed)).toContain(8)
  expect(
    exported.telemetry.filter(
      (entry: { type: string }) => entry.type === 'export-created',
    ),
  ).toHaveLength(1)
  expect(
    exported.actions.find(
      (action: { action: { type: string } }) =>
        action.action.type === 'UNDO_SCHEDULE',
    ).undoOfActionId,
  ).toBe('action-0001')
  expect(exported.summary).not.toHaveProperty('week1EffectiveEditCount')

  const exportedText = JSON.stringify(exported)
  for (const forbidden of [
    'realName',
    'email',
    'phone',
    'hostNotes',
    'freeText',
    'location.href',
    'Error.stack',
    '/Users/',
  ]) {
    expect(exportedText).not.toContain(forbidden)
  }

  await clearSessionButton.click()
  await expect(
    page.getByRole('heading', { name: '开始匿名新会话' }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: '当前测试会话元数据' })).toHaveCount(0)

  await page.reload()
  await expect(
    page.getByRole('heading', { name: '开始匿名新会话' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '创建固定初态会话' }).click()
  const secondMeta = page.getByRole('region', { name: '当前测试会话元数据' })
  const secondSessionId = (await secondMeta.locator('div').last().locator('strong').textContent())!
  expect(secondSessionId).not.toBe(firstSessionId)
  await expect(secondMeta).not.toContainText(firstSessionId)
  await expect(page.getByRole('button', { name: '下载匿名 JSON' })).toBeDisabled()
  await expect(page.getByRole('heading', { name: '因果记录' })).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
  expect(consoleErrors).toHaveLength(1)
  expect(consoleErrors[0]).toContain('500')
  expect(pageErrors).toEqual([])
})
