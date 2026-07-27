import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  chromium,
  expect,
  test,
  type Download,
  type Page,
} from '@playwright/test'

async function readDownload(download: Download) {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function downloadSession(
  page: Page,
  buttonName = '下载匿名 JSON',
) {
  const capturePending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/__gate1/capture' &&
      response.request().method() === 'POST',
  )
  const downloadPending = page.waitForEvent('download')
  await page.getByRole('button', { name: buttonName }).click()
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
  const rawPath = join(
    process.cwd(),
    'test-results',
    'captures',
    receipt.filename,
  )
  expect(readFileSync(rawPath).equals(requestBytes!)).toBe(true)
  expect(readFileSync(`${rawPath}.sha256`, 'utf8')).toBe(
    `${receipt.sha256}  ${receipt.filename}\n`,
  )
  const { downloadUrl: _downloadUrl, ...storedReceipt } = receipt
  expect(
    JSON.parse(readFileSync(`${rawPath}.receipt.json`, 'utf8')),
  ).toEqual(storedReceipt)
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
  await sampleInput.fill('A38')
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
  const authorityPending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        '/__gate1/session-authority' &&
      response.request().method() === 'POST',
  )
  await page.keyboard.press('Enter')
  const authorityResponse = await authorityPending
  expect(authorityResponse.status()).toBe(201)
  const issuedAuthority = await authorityResponse.json()
  expect(issuedAuthority).toMatchObject({
    diagnosisId: 'A38',
    candidateBuildAuthorityHash:
      buildMetadata.artifactHash,
  })
  expect(issuedAuthority.sessionAuthorityToken).toMatch(
    /^[a-f0-9]{64}$/,
  )

  const meta = page.getByRole('region', { name: '当前测试会话元数据' })
  await expect(meta).toContainText('A38')
  await expect(meta).toContainText(buildMetadata.buildId)
  await expect(meta).toContainText(buildMetadata.gitSha)
  await expect(meta).toContainText(buildMetadata.artifactHash)
  await expect(meta).toContainText(buildMetadata.initialStateHash)
  await expect(meta).toContainText('0.5.1')
  await expect(meta).toContainText('104729')
  const firstSessionId = (await meta.locator('div').last().locator('strong').textContent())!
  await expect(
    page.getByRole('heading', { name: '本周三项取舍' }),
  ).toBeVisible()

  await page.getByRole('button', { name: '展开完整周计划' }).click()
  const firstWeekGrid = page.getByRole('grid', { name: '第 1 周完整计划' })
  await expect(firstWeekGrid).toBeVisible()
  await firstWeekGrid
    .getByRole('gridcell', { name: /陈渡 第1日 B3 16–19/ })
    .click()
  await page.getByLabel('批量活动').selectOption('study')
  await page.getByRole('button', { name: '修改所选格' }).click()
  await page.getByRole('button', { name: '撤销上次日程修改' }).click()
  await page.getByRole('button', { name: '收起' }).click()

  await page.getByRole('button', { name: '比较容量取舍' }).click()
  const preventiveDialog = page.getByRole('dialog', {
    name: '一个休息格，两种持久后果',
  })
  await expect(preventiveDialog).toBeVisible()
  const preventiveCandidates = preventiveDialog
    .getByRole('list', { name: '预防容量候选' })
    .getByRole('button')
  await expect(preventiveCandidates).toHaveCount(2)
  await expect(preventiveCandidates.nth(0)).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(preventiveCandidates.nth(1)).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(preventiveDialog).not.toContainText('推荐')
  await page.keyboard.press('Enter')
  await expect(preventiveCandidates.nth(0)).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(preventiveCandidates.nth(1)).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page
    .getByRole('button', { name: '安排第二次预防检修' })
    .focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { name: '林禾 · 周二 B2' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '查看容量结果' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '安排第二次预防检修' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: '指定保护性恢复' }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: '开启短通路 · 维修保障 −1' })
    .click()

  await page.getByRole('button', { name: '8×' }).click()
  await page.getByRole('button', { name: '开始运行' }).click()
  await page.clock.runFor(10_000)
  await expect(page.getByRole('heading', { name: /水泵异常，检修奏效/ })).toBeVisible()
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
  await page.getByRole('button', { name: '比较应急班次' }).click()
  const recoveryDialog = page.getByRole('dialog', {
    name: '同一个应急班次投向哪里',
  })
  const recoveryCandidates = recoveryDialog
    .getByRole('list', { name: '恢复资源候选' })
    .getByRole('button')
  const sharedRecoveryState = recoveryDialog.getByLabel(
    '恢复资源共享状态',
  )
  await expect(sharedRecoveryState).toContainText(
    '当前粮食',
  )
  await expect(sharedRecoveryState).toContainText('目标 ≥12')
  await expect(sharedRecoveryState).toContainText(
    '当前维修',
  )
  await expect(sharedRecoveryState).toContainText('目标 ≥5')
  await expect(sharedRecoveryState).toContainText(
    /设备负荷(?:稳定|脆弱)/,
  )
  await expect(sharedRecoveryState).toContainText(
    '基础设施压力',
  )
  const recoveryCandidateCards =
    recoveryDialog.getByRole('listitem')
  await expect(recoveryCandidateCards).toHaveCount(2)
  for (const card of await recoveryCandidateCards.all()) {
    await expect(card).toContainText('选择后粮食')
    await expect(card).toContainText('选择后维修')
    await expect(card).toContainText('负荷')
    await expect(card).toContainText('准备度')
    await expect(card).toContainText('压力')
  }
  const candidateWidths =
    await recoveryCandidateCards.evaluateAll((cards) =>
      cards.map(
        (card) => card.getBoundingClientRect().width,
      ),
    )
  expect(
    Math.abs(candidateWidths[0] - candidateWidths[1]),
  ).toBeLessThanOrEqual(1)
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
  await expect(recoveryCandidates).toHaveCount(2)
  await expect(recoveryCandidates.nth(0)).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(recoveryCandidates.nth(1)).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page.keyboard.press('Space')
  await expect(recoveryCandidates.nth(0)).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(recoveryCandidates.nth(1)).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page
    .getByRole('button', { name: '分配给粮食生产' })
    .focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: '查看分配结果' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '分配给维修备件' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: '分配给粮食生产' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: '比较回应方案' }).click()
  await expect(
    page.getByRole('dialog', { name: '林禾的学习请求' }),
  ).toBeVisible()
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
  await expect(recap).toContainText('7–8')
  await expect(recap).toContainText('实际期末7')
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
    sampleId: 'A38',
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
    schemaVersion: 'gate1-playtest-v2',
    protocolVersion:
      'weekly-management-slice-playtest-v0.3',
    scenarioVersion: '0.5.1',
    captureKind: 'complete',
    meta: {
      sampleId: 'A38',
      diagnosisId: 'A38',
      sessionId: firstSessionId,
      buildId: buildMetadata.buildId,
      gitSha: buildMetadata.gitSha,
      artifactHash: buildMetadata.artifactHash,
      candidateBuildAuthorityHash:
        buildMetadata.artifactHash,
      initialStateHash: buildMetadata.initialStateHash,
      protocolVersion:
        'weekly-management-slice-playtest-v0.3',
      scenarioVersion: '0.5.1',
      fixedSeed: 104729,
    },
    finalTick: 2010,
    finalState: {
      isComplete: true,
      completedWeekCount: 2,
      recapCount: 2,
    },
    summary: {
      week1C03TerminalCommitmentCount: 1,
      week2C03TerminalCommitmentCount: 1,
    },
  })
  expect(exported.managementChoiceOpportunitiesV03).toHaveLength(2)
  expect(
    exported.managementChoiceOpportunitiesV03.map(
      (opportunity: {
        choiceSetId: string
        terminalState: string
      }) => [
        opportunity.choiceSetId,
        opportunity.terminalState,
      ],
    ),
  ).toEqual([
    [
      'choice:w0:preventive-capacity',
      'schedule-preventive-maintenance',
    ],
    [
      'choice:w1:recovery-allocation',
      'allocate-food-production',
    ],
  ])
  expect(exported.managementChoiceCommitmentsV03).toHaveLength(2)
  const c03Actions = exported.actions.filter(
    (action: { type: string }) =>
      action.type === 'COMMIT_MANAGEMENT_CHOICE',
  )
  expect(c03Actions).toHaveLength(2)
  for (const action of c03Actions) {
    expect(action).toMatchObject({
      diagnosisId: exported.meta.diagnosisId,
      sessionId: exported.meta.sessionId,
      candidateBuildAuthorityHash:
        exported.meta.candidateBuildAuthorityHash,
      sessionAuthorityToken:
        exported.meta.sessionAuthorityToken,
      projectionBaseHash: expect.stringMatching(
        /^[a-f0-9]{64}$/,
      ),
      candidateProjectionHash: expect.stringMatching(
        /^[a-f0-9]{64}$/,
      ),
      requiredConsequenceIds: expect.any(Array),
      effectFingerprints: expect.any(Array),
      terminalState: expect.any(String),
    })
  }
  expect(exported.meta).toMatchObject(issuedAuthority)
  const c03Fingerprints =
    exported.managementChoiceCommitmentsV03.flatMap(
      (commitment: { effectFingerprints: string[] }) =>
        commitment.effectFingerprints,
    )
  expect(new Set(c03Fingerprints).size).toBe(
    c03Fingerprints.length,
  )
  expect(Object.keys(exported.effectOwnershipV03).sort()).toEqual(
    [...c03Fingerprints].sort(),
  )
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
      (action: { type: string }) => action.type === 'UNDO',
    ).revertsActionId,
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
  await expect(clearSessionButton).toBeDisabled()

  await page.getByRole('button', { name: '8×' }).click()
  await page.getByRole('button', { name: '开始运行' }).click()
  await page.clock.runFor(10_000)
  await expect(
    page.getByRole('heading', { name: /水泵故障并停机/ }),
  ).toBeVisible()

  await page
    .getByLabel('阻断原因')
    .fill('水泵事件后操作无法继续，保留当前状态供复现')
  let failedBlockedRequestBytes: Buffer | undefined
  await page.route('**/__gate1/capture', async (route) => {
    failedBlockedRequestBytes =
      route.request().postDataBuffer() ?? undefined
    await route.fulfill({
      status: 500,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        error: '技术验证注入：阻断证据目录暂不可写',
      }),
    })
  })
  await page.getByRole('button', { name: '保存阻断记录' }).click()
  await expect(
    page
      .getByRole('region', { name: '导出或结束当前会话' })
      .getByRole('alert'),
  ).toHaveText('技术验证注入：阻断证据目录暂不可写')
  await expect(
    page.getByText(
      '阻断记录已冻结；保存失败时请重试，成功前不能清空。',
    ),
  ).toBeVisible()
  expect(failedBlockedRequestBytes).toBeDefined()
  await expect(clearSessionButton).toBeDisabled()

  await page.unroute('**/__gate1/capture')
  const blockedCapture = await downloadSession(page, '保存阻断记录')
  expect(
    blockedCapture.requestBytes.equals(failedBlockedRequestBytes!),
  ).toBe(true)

  expect(blockedCapture.receipt).toMatchObject({
    captureKind: 'blocked',
    blockedAtTick: 342,
    isComplete: false,
  })
  expect(blockedCapture.exported).toMatchObject({
    protocolVersion:
      'weekly-management-slice-playtest-v0.3',
    scenarioVersion: '0.5.1',
    captureKind: 'blocked',
    blockedAtTick: 342,
    blockedReason: '水泵事件后操作无法继续，保留当前状态供复现',
    finalTick: 342,
    finalState: {
      isComplete: false,
      completedWeekCount: 0,
      recapCount: 0,
    },
  })
  expect(blockedCapture.exported.recap).toEqual([])
  expect(
    blockedCapture.exported.telemetry.filter(
      (entry: { type: string }) => entry.type === 'export-created',
    ),
  ).toHaveLength(0)
  expect(
    blockedCapture.exported.telemetry.filter(
      (entry: { type: string }) => entry.type === 'blocked-capture-created',
    ),
  ).toHaveLength(1)
  await expect(
    page.getByText('已保存并校验 tick 342 的阻断记录（非完整场次）。'),
  ).toBeVisible()
  await expect(page.getByText(/两周流程已完成/)).toHaveCount(0)
  await expect(clearSessionButton).toBeEnabled()
  expect(consoleErrors).toHaveLength(2)
  expect(consoleErrors.every((message) => message.includes('500'))).toBe(true)
  expect(pageErrors).toEqual([])

  await clearSessionButton.click()
  await expect(
    page.getByRole('heading', { name: '开始匿名新会话' }),
  ).toBeVisible()
})

test('skipping both C03 choices reaches two honest recaps and a zero-commitment export', async ({}, testInfo) => {
  const browser = await chromium.launch(
    testInfo.project.use.launchOptions,
  )
  const page = await browser.newPage({
    baseURL: testInfo.project.use.baseURL,
    viewport: testInfo.project.use.viewport,
  })
  try {
    await page.clock.install({
      time: new Date('2026-07-26T06:00:00Z'),
    })
    await page.goto('/')
    await page.getByLabel('匿名编号').fill('A39')
    const authorityPending = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        '/__gate1/session-authority' &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: '创建固定初态会话' })
      .click()
    expect((await authorityPending).status()).toBe(201)

    await page.getByRole('button', { name: '8×' }).click()
    await page
      .getByRole('button', { name: '开始运行' })
      .click()
    await page.clock.runFor(10_000)
    await expect(
      page.getByRole('heading', { name: /水泵故障并停机/ }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: '确认后继续' })
      .click()
    await page.clock.runFor(22_000)

    const weekOneRecap = page.getByRole('heading', {
      name: /周末偏差复盘/,
    }).locator('..')
    await expect(weekOneRecap).toContainText(
      '管理者没有指定专项方案；林禾按普通休息执行，未获得专项恢复或人员准备度提升。',
    )
    await expect(weekOneRecap).not.toContainText(
      /terminalState=|omitted|unqualified-direct-edit/,
    )
    await page
      .getByRole('button', {
        name: '确认复盘并进入第二周',
      })
      .click()

    await page
      .getByRole('button', { name: '开始运行' })
      .click()
    await page.clock.runFor(6_000)
    await expect(
      page.getByRole('heading', {
        name: '林禾请求逾期，默认保留农务',
      }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: '确认后继续' })
      .click()
    await page.clock.runFor(27_000)

    await expect(page.getByText('第 2 周结束')).toBeVisible()
    const weekTwoRecap = page.getByRole('heading', {
      name: /周末偏差复盘/,
    }).locator('..')
    await expect(weekTwoRecap).toContainText(
      '管理者没有指定应急班次用途，本周未获得额外粮食或维修保障。',
    )
    await expect(weekTwoRecap).not.toContainText(
      /terminalState=|omitted|unqualified-direct-edit/,
    )

    const { exported } = await downloadSession(page)
    expect(exported).toMatchObject({
      captureKind: 'complete',
      finalTick: 2010,
      finalState: {
        isComplete: true,
        completedWeekCount: 2,
        recapCount: 2,
      },
      summary: {
        week1C03TerminalCommitmentCount: 0,
        week2C03TerminalCommitmentCount: 0,
      },
    })
    expect(exported.recap).toHaveLength(2)
    expect(
      exported.actions.filter(
        ({ type }: { type: string }) =>
          type === 'COMMIT_MANAGEMENT_CHOICE',
      ),
    ).toEqual([])
    expect(
      exported.managementChoiceOpportunitiesV03.map(
        ({
          terminalState,
        }: {
          terminalState: string
        }) => terminalState,
      ),
    ).toEqual(['omitted', 'omitted'])
  } finally {
    await browser.close()
  }
})
