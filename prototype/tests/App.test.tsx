import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App, CharacterDecisionPanel } from '../src/app/App'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'

const TEST_BUILD_METADATA = {
  buildId: 'g1-e2e-unit.1',
  gitSha: '1111111111111111111111111111111111111111',
  artifactHash: '2'.repeat(64),
  artifactHashAlgorithm: 'sha256-canonical-file-manifest-v1' as const,
  artifactManifestPath: 'artifact-manifest.json' as const,
  initialStateHash: 'fnv1a32-bbad047d',
  initialStateHashAlgorithm: 'fnv1a32-stable-json-v1' as const,
}

function renderStartedApp() {
  render(<App buildMetadata={TEST_BUILD_METADATA} />)
  fireEvent.click(screen.getByRole('button', { name: '创建固定初态会话' }))
}

describe('minimal weekly flow UI', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('opens on the weekly issue summary instead of a full schedule grid', () => {
    renderStartedApp()

    expect(screen.getByRole('heading', { name: '本周三项取舍' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /水泵需要 2 个预防性维修块/ })).toBeInTheDocument()
    expect(screen.getByText(/点击“水泵需要 2 个预防性维修块”/)).toBeInTheDocument()
    expect(screen.queryByText('112')).not.toBeInTheDocument()
  })

  it('locates the activity block and immediately updates forecast and reason', () => {
    renderStartedApp()

    const forecastPanel = screen.getByRole('heading', { name: '粮食' }).closest('section')
    expect(forecastPanel).not.toBeNull()
    expect(within(forecastPanel!).getByText('3–11')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /水泵需要 2 个预防性维修块/ }))
    expect(
      screen.getByRole('button', { name: /水泵需要 2 个预防性维修块/ }),
    ).toHaveTextContent('已定位 · 待处理')
    fireEvent.click(screen.getByRole('button', { name: /补足第 2 个检修块/ }))

    expect(screen.getByRole('button', { name: /补足第 2 个检修块/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(forecastPanel!).getByText('9')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /水泵检修已安排 2 个维修块/ }),
    ).toHaveTextContent('已安排 · 等待事件')
    expect(screen.getByText(/已安排 2 个水泵维修块/)).toBeInTheDocument()
    expect(screen.getByText(/粮食 3–11 → 9；维修保障/)).toBeInTheDocument()
  })

  it('keeps the pump summary and located block label in sync with the chosen plan', () => {
    renderStartedApp()

    fireEvent.click(screen.getByRole('button', { name: /水泵需要 2 个预防性维修块/ }))
    const schedulePanel = screen.getByRole('heading', {
      name: '林禾 · 周二 B2',
    }).closest('section')
    expect(schedulePanel).not.toBeNull()
    expect(within(schedulePanel!).getByText('休息 · 基础计划')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /补足第 2 个检修块/ }))

    expect(within(schedulePanel!).getByText('维修 · 本周例外')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /水泵检修已安排 2 个维修块/ }),
    ).toBeInTheDocument()
  })

  it('keeps the 112-cell week grid behind disclosure and supports one batch action', () => {
    renderStartedApp()

    expect(screen.queryByRole('grid', { name: '第 1 周完整计划' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '展开完整周计划' }))

    const grid = screen.getByRole('grid', { name: '第 1 周完整计划' })
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(112)
    expect(within(grid).getByText('林禾')).toBeInTheDocument()
    expect(within(grid).getByText('乔磐')).toBeInTheDocument()
    expect(within(grid).getByText('苏霁')).toBeInTheDocument()
    expect(within(grid).getByText('陈渡')).toBeInTheDocument()

    fireEvent.click(
      within(grid).getByRole('gridcell', { name: /林禾 第1日 B1 09–12/ }),
    )
    fireEvent.click(
      within(grid).getByRole('gridcell', { name: /乔磐 第1日 B1 09–12/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: '批量修改 2 格' }))

    expect(screen.getByText(/action-0001 作为一个事务修改 2 个活动块/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '撤销上次日程修改' })).toBeEnabled()
  })

  it('exposes explicit permanent scope, copy-day, undo, and a second 112-cell week', () => {
    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '展开完整周计划' }))

    expect(screen.getByRole('option', { name: '设为后续基础计划' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '复制这一天' }))
    expect(screen.getByRole('button', { name: '撤销上次日程修改' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '撤销上次日程修改' }))
    expect(screen.getByText(/已撤销 action-0001，恢复 4 个活动块/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '第 2 周' }))
    expect(
      within(screen.getByRole('grid', { name: '第 2 周完整计划' })).getAllByRole('gridcell'),
    ).toHaveLength(112)
  })

  it('marks a mild food gap as accepted without changing its forecast math', () => {
    renderStartedApp()
    const foodPanel = screen.getByRole('heading', { name: '粮食' }).closest('section')
    expect(foodPanel).not.toBeNull()
    expect(within(foodPanel!).getByText('3–11')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '接受轻度粮食缺口' }))

    expect(within(foodPanel!).getByText('3–11')).toBeInTheDocument()
    expect(within(foodPanel!).getByText(/轻度缺口 · 已接受风险/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '撤回风险接受' })).toBeEnabled()
    expect(screen.getByText(/不再作为未处理错误催促/)).toBeInTheDocument()
  })

  it('shows Qiao Pan red-line warning before a third consecutive overtime is submitted', () => {
    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '展开完整周计划' }))
    const grid = screen.getByRole('grid', { name: '第 1 周完整计划' })
    for (const day of ['第1日', '第2日', '第3日']) {
      fireEvent.click(
        within(grid).getByRole('gridcell', {
          name: new RegExp(`乔磐 ${day} B4 20–23`),
        }),
      )
    }
    fireEvent.change(screen.getByLabelText('批量活动'), {
      target: { value: 'repair' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('乔磐红线预警')
    expect(screen.getByRole('alert')).toHaveTextContent('第三个连续加班日')
    expect(screen.getByRole('button', { name: '先调整红线冲突' })).toBeDisabled()
  })

  it('shows both Lin He request consequences during week two', () => {
    const weekTwoState = {
      ...scenario.createInitialState(),
      currentTick: 1062,
      recap: null,
      completedWeekIndexes: [0],
    }
    render(<CharacterDecisionPanel simulation={weekTwoState} />)

    expect(screen.getByText(/接受：粮食产出 −2/)).toBeInTheDocument()
    expect(screen.getByText(/拒绝：粮食不变/)).toBeInTheDocument()
  })

  it('does not reveal the week-two request while the clock is still at tick 1002', () => {
    render(
      <CharacterDecisionPanel
        simulation={{
          ...scenario.createInitialState(),
          currentTick: 1002,
          recap: null,
          completedWeekIndexes: [0],
        }}
      />,
    )

    expect(screen.queryByText(/接受：粮食产出 −2/)).not.toBeInTheDocument()
  })

  it('renders the authoritative map route and updates loss and food after opening the shortcut', () => {
    renderStartedApp()
    const mapPanel = screen.getByRole('heading', {
      name: '运输路径与人物位置',
    }).closest('section')
    const foodPanel = screen.getByRole('heading', { name: '粮食' }).closest('section')
    expect(mapPanel).not.toBeNull()
    expect(foodPanel).not.toBeNull()
    expect(within(mapPanel!).getByText('北侧绕行 · 损耗 6')).toBeInTheDocument()
    expect(within(foodPanel!).getByText('3–11')).toBeInTheDocument()
    expect(within(mapPanel!).getByText(/远距离搬运损失 4/)).toBeInTheDocument()

    fireEvent.click(
      within(mapPanel!).getByRole('button', {
        name: '开启短通路 · 维修保障 −1',
      }),
    )

    expect(within(mapPanel!).getByText('南侧短通路 · 损耗 2')).toBeInTheDocument()
    expect(within(foodPanel!).getByText('7–15')).toBeInTheDocument()
    expect(screen.getByText(/北侧绕行 860 米 \/ 损耗 6 → 南侧短通路 470 米/)).toBeInTheDocument()
  })

  it('enters week two paused with inherited-plan context and only new exceptions', () => {
    vi.useFakeTimers()
    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '开始运行' }))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByRole('heading', { name: /水泵故障并停机/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认后继续' }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByRole('heading', { name: /周末偏差复盘/ })).toBeInTheDocument()
    expect(screen.getByText('本周安排已完成并结算，不是被撤销')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '粮食' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保留休息' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('聚落时钟')).toHaveTextContent('复盘中')

    fireEvent.click(screen.getByRole('button', { name: '确认复盘并进入第二周' }))

    expect(screen.getByRole('heading', { name: '第二周新增例外' })).toBeInTheDocument()
    expect(screen.getByLabelText('聚落时钟')).toHaveTextContent('周一 09:00')
    expect(screen.getByText('基础计划已继承')).toBeInTheDocument()
    expect(screen.getAllByText(/第一周一次性例外已结算失效/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /林禾请求周二 B1 学习/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '林禾 · 周二 B1' })).toBeInTheDocument()
    expect(screen.queryByText(/点击“水泵需要 2 个预防性维修块”/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /林禾请求周二 B1 学习/ }))
    expect(screen.getByRole('button', { name: '接受学习请求' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拒绝并保留农务' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '使用化肥：粮食 +6' }))
    expect(
      screen.getByRole('button', { name: /化肥已在第二周使用/ }),
    ).toHaveTextContent('本周已使用化肥，库存为 0')
    expect(screen.getByLabelText('聚落时钟')).toHaveTextContent('已暂停')
    expect(screen.queryByRole('button', { name: /水泵需要 2 个预防性维修块/ })).not.toBeInTheDocument()
  })

  it('keeps one complete export immutable across a failed save and retry', async () => {
    vi.useFakeTimers()
    const requestBodies: string[] = []
    const fixedSha256 = 'ab'.repeat(32)
    const realCrypto = globalThis.crypto
    const cryptoMock = {
      randomUUID: realCrypto.randomUUID.bind(realCrypto),
      subtle: {
        digest: vi
          .fn()
          .mockResolvedValue(Uint8Array.from({ length: 32 }, () => 0xab).buffer),
      },
    } as unknown as Crypto
    vi.stubGlobal('crypto', cryptoMock)
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const rawJson = String(init?.body)
      requestBodies.push(rawJson)
      if (requestBodies.length === 1) {
        return new Response(
          JSON.stringify({ error: '同一会话证据链缺失或不一致' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
      const payload = JSON.parse(rawJson)
      const filename =
        `${payload.meta.buildId}-${payload.meta.sampleId}-${payload.meta.sessionId}.json`
      return new Response(
        JSON.stringify({
          schemaVersion: 'gate1-capture-receipt-v1',
          captureVersion: 'gate1-capture-host-v1',
          filename,
          bytes: new TextEncoder().encode(rawJson).byteLength,
          sha256: fixedSha256,
          capturedAtUtc: '2026-07-26T06:00:00.000Z',
          sampleId: payload.meta.sampleId,
          sessionId: payload.meta.sessionId,
          buildId: payload.meta.buildId,
          gitSha: payload.meta.gitSha,
          artifactHash: payload.meta.artifactHash,
          downloadUrl: '/__gate1/capture/123e4567-e89b-42d3-a456-426614174000',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '8×' }))
    fireEvent.click(screen.getByRole('button', { name: '开始运行' }))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    fireEvent.click(screen.getByRole('button', { name: '确认后继续' }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    fireEvent.click(
      screen.getByRole('button', { name: '确认复盘并进入第二周' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: '开启短通路 · 维修保障 −1' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /林禾请求周二 B1 学习/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: '接受学习请求' }))
    fireEvent.click(screen.getByRole('button', { name: '开始运行' }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.getByText('第 2 周结束')).toBeInTheDocument()
    const clearButton = screen.getByRole('button', {
      name: '结束并清空会话',
    })
    expect(clearButton).toBeDisabled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下载匿名 JSON' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      '同一会话证据链缺失或不一致',
    )
    expect(screen.getByRole('region', {
      name: '当前测试会话元数据',
    })).toBeInTheDocument()
    expect(clearButton).toBeDisabled()
    expect(anchorClick).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下载匿名 JSON' }))
    })
    expect(screen.getByText(/已保存并校验 tick 2010/)).toHaveTextContent(
      '已保存并校验 tick 2010 的匿名记录。',
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBodies[1]).toBe(requestBodies[0])
    const payload = JSON.parse(requestBodies[1])
    expect(
      payload.actions.find(
        (entry: { action: { type: string } }) =>
          entry.action.type === 'CONTINUE_TO_NEXT_WEEK',
      )?.atTick,
    ).toBe(1002)
    expect(
      payload.candidateEditGroups,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: 'OPEN_TRANSPORT_SHORTCUT',
          weekIndex: 1,
        }),
      ]),
    )
    expect(
      payload.telemetry,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'week-started',
          atTick: 1062,
          weekIndex: 1,
        }),
      ]),
    )
    expect(
      payload.telemetry.filter(
        (entry: { type: string }) => entry.type === 'export-created',
      ),
    ).toHaveLength(1)
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(clearButton).toBeEnabled()

    fireEvent.click(clearButton)
    expect(
      screen.getByRole('heading', { name: '开始匿名新会话' }),
    ).toBeInTheDocument()
  })

  it('keeps one blocked capture immutable across a failed save and retry', async () => {
    const requestBodies: string[] = []
    const fixedSha256 = 'cd'.repeat(32)
    const realCrypto = globalThis.crypto
    const cryptoMock = {
      randomUUID: realCrypto.randomUUID.bind(realCrypto),
      subtle: {
        digest: vi
          .fn()
          .mockResolvedValue(Uint8Array.from({ length: 32 }, () => 0xcd).buffer),
      },
    } as unknown as Crypto
    vi.stubGlobal('crypto', cryptoMock)
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const rawJson = String(init?.body)
      requestBodies.push(rawJson)
      if (requestBodies.length === 1) {
        return new Response(
          JSON.stringify({ error: '同一会话证据链缺失或不一致' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
      const payload = JSON.parse(rawJson)
      const filename =
        `${payload.meta.buildId}-${payload.meta.sampleId}-${payload.meta.sessionId}.json`
      return new Response(
        JSON.stringify({
          schemaVersion: 'gate1-capture-receipt-v1',
          captureVersion: 'gate1-capture-host-v1',
          filename,
          bytes: new TextEncoder().encode(rawJson).byteLength,
          sha256: fixedSha256,
          capturedAtUtc: '2026-07-26T06:00:00.000Z',
          sampleId: payload.meta.sampleId,
          sessionId: payload.meta.sessionId,
          buildId: payload.meta.buildId,
          gitSha: payload.meta.gitSha,
          artifactHash: payload.meta.artifactHash,
          downloadUrl: '/__gate1/capture/123e4567-e89b-42d3-a456-426614174001',
          captureKind: 'blocked',
          blockedAtTick: payload.blockedAtTick,
          isComplete: false,
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    renderStartedApp()
    const clearButton = screen.getByRole('button', {
      name: '结束并清空会话',
    })
    const blockedReason = screen.getByRole('textbox', {
      name: /阻断原因/,
    })
    fireEvent.change(blockedReason, {
      target: { value: 'tick 54 无法继续，复现步骤固定。' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '保存阻断记录' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      '同一会话证据链缺失或不一致',
    )
    expect(blockedReason).toBeDisabled()
    expect(clearButton).toBeDisabled()
    expect(
      screen.getByRole('button', { name: '保存阻断记录' }),
    ).toBeEnabled()
    expect(anchorClick).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '保存阻断记录' }))
    })
    expect(screen.getByText(/已保存并校验 tick 54/)).toHaveTextContent(
      '已保存并校验 tick 54 的阻断记录（非完整场次）。',
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBodies[1]).toBe(requestBodies[0])
    const payload = JSON.parse(requestBodies[1])
    expect(payload.captureKind).toBe('blocked')
    expect(payload.blockedAtTick).toBe(54)
    expect(payload.finalState.isComplete).toBe(false)
    expect(
      payload.telemetry.filter(
        (entry: { type: string }) => entry.type === 'blocked-capture-created',
      ),
    ).toHaveLength(1)
    expect(
      payload.telemetry.filter(
        (entry: { type: string }) => entry.type === 'export-created',
      ),
    ).toHaveLength(0)
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(clearButton).toBeEnabled()
  })
})
